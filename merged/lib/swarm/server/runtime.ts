/** One live Swarm room inside the worker: owns the authoritative `Room`, the 20 Hz loop, per-viewer snapshots at 10 Hz, input handling,
 *  grading, persistence and presence. The simulation itself is `lib/swarm/room.ts` (pure); this file is only the wiring around it. */
import { TICK_HZ, SNAPSHOT_HZ, PROTOCOL, isTerminalPhase, type Room, type RoomEvent, type Role } from '../domain';
import { checkpoint, connect, createRoom, disconnect, hostCommand, leave, playerAbility, playerMove, recordAnswer, canAnswer, restore, seat, setReady, setRole, step, vote, type HostCmd } from '../room';
import { clientPacket, MAX_PACKET_BYTES, RATE, type ClientPacket, type ServerPacket, type ErrCode } from '../net/protocol';
import { buildView, diffViews, type Viewer, type ViewParts } from '../net/view';
import { gradeStored } from './grader';
import { hintOf, type StoredQuestion } from '../../quiz/public';
import type { Store, SessionRec } from './store';
import type { Metrics } from './metrics';

export interface Sock { send(data: string): void; close(code: number, reason: string): void; readonly buffered: number; readonly open: boolean }
export type Clock = { now(): number };
export const realClock: Clock = { now: () => Date.now() };

type Bucket = { tokens: number; at: number };
export type Conn = {
  id: number; sock: Sock; kind: 'player' | 'host' | 'screen'; sub: string; ready: boolean; focus?: string; prev: ViewParts | null; sinceFull: number; lastSendMs: number; needFull: boolean;
  buckets: Record<string, Bucket>; strikes: number; helloBy: number; bytesOut: number; bornMs: number;
};
export type RuntimeOpts = { clock?: Clock; workerId: string; store: Store; metrics: Metrics; log?: (m: string, o?: unknown) => void; checkpointEveryMs?: number; resultsTtlMs?: number; idleLobbyMs?: number };

let connSeq = 0;

export class RoomRuntime {
  room!: Room; questions = new Map<string, StoredQuestion>(); conns = new Map<number, Conn>(); bySub = new Map<string, Conn>();
  private timer: ReturnType<typeof setInterval> | null = null; private lastTickAt = 0; private tickCount = 0; private lastCheckpointMs = 0; private lastCheckpointRev = -1;
  private eventSeqSent = 0; private fxBuf: Record<string, unknown[]> = {}; private closed = false; private saving = false; finishedAtMs: number | null = null; private persisted = false;
  private readonly clock: Clock; private readonly cpEvery: number; readonly resultsTtlMs: number; readonly idleLobbyMs: number;
  constructor(public readonly roomId: string, private o: RuntimeOpts) { this.clock = o.clock ?? realClock; this.cpEvery = o.checkpointEveryMs ?? 5000; this.resultsTtlMs = o.resultsTtlMs ?? 30 * 60_000; this.idleLobbyMs = o.idleLobbyMs ?? 2 * 3600_000; }

  /** Build from a stored session: a checkpoint resumes exactly; a fresh session starts in the lobby. Throws if another worker holds the lease. */
  async open(rec: SessionRec & { code: string }, questions: StoredQuestion[]): Promise<void> {
    if (!(await this.o.store.acquire(this.roomId, this.o.workerId, 30))) throw new Error('lease_held');
    this.questions = new Map(questions.map((q) => [q.id, q]));
    const now = this.clock.now();
    if (rec.checkpoint) {
      this.room = restore(rec.checkpoint);
      // a crash can lose the last few seconds of answers from the checkpoint; the database keeps every graded one
      if (this.room.quiz && this.room.quiz.status === 'open') for (const a of await this.o.store.answersFor(this.roomId, this.room.quiz.id)) { if (!this.room.quiz.answers[a.pid] && this.room.roster[a.pid]) this.room.quiz.answers[a.pid] = { frac: a.frac, correct: a.correct, atMs: now }; }
      // nobody is connected after a restart: everyone is offline until their socket returns
      for (const m of Object.values(this.room.roster)) m.connected = false;
      this.room.hostPresent = false; this.room.hostSeenMs = now; this.room.emptySinceMs = now;
      // freeze wall-clock deadlines across the outage (the paused state resumes from the host)
      if (!this.room.paused && this.room.phase !== 'lobby' && this.room.phase !== 'role_pick' && !isTerminalPhase(this.room.phase)) { this.room.paused = true; this.room.pausedAtMs = now; this.room.pauseReason = 'worker_restarted'; }
      this.eventSeqSent = this.room.eventSeq;
    } else {
      this.room = createRoom({ id: this.roomId, code: rec.code, config: rec.config, seed: rec.seed, nowMs: now, pool: questions.map((q) => ({ id: q.id, kind: q.kind })) });
      this.eventSeqSent = 0;
    }
    this.lastTickAt = now; this.lastCheckpointMs = now;
    this.timer = setInterval(() => this.loop(), 1000 / TICK_HZ / 2); // wake at 40 Hz; the accumulator below runs exactly one step per 50 ms
    (this.timer as { unref?: () => void }).unref?.();
  }
  get status(): 'active' | 'results' | 'closed' { return this.closed ? 'closed' : isTerminalPhase(this.room.phase) ? 'results' : 'active'; }
  get phase() { return this.room.phase; }

  // ── loop ────────────────────────────────────────────────────────────────────────────────────
  private loop() {
    if (this.closed) return;
    const t0 = performance.now(); const now = this.clock.now(); const dt = 1000 / TICK_HZ;
    let due = Math.floor((now - this.lastTickAt) / dt);
    if (due <= 0) return;
    if (due > 5) { this.o.metrics.inc('tick_catchup_dropped', due - 5); this.lastTickAt = now - 5 * dt; due = 5; } // never spiral: a stalled event loop drops time instead of fast-forwarding the game
    for (let i = 0; i < due; i++) {
      this.lastTickAt += dt; this.tickCount++;
      step(this.room, this.lastTickAt);
      this.drainFx();
      if (this.tickCount % (TICK_HZ / SNAPSHOT_HZ) === 0) this.broadcast(this.lastTickAt);
    }
    this.flushEvents();
    if (!this.persisted && isTerminalPhase(this.room.phase) && this.room.phase === 'results') this.onResults();
    if (now - this.lastCheckpointMs >= this.cpEvery) void this.save();
    this.o.metrics.observe('tick_ms', performance.now() - t0);
  }
  private drainFx() { for (const t of this.room.teamOrder) { const a = this.room.arenas[t]; if (a && a.fx.length) { (this.fxBuf[t] ??= []).push(...a.fx.splice(0)); if (this.fxBuf[t]!.length > 120) this.fxBuf[t]!.splice(0, this.fxBuf[t]!.length - 120); } } }
  /** Push notable events (toasts) and persist exactly-once ledger effects. */
  private flushEvents() {
    const fresh = this.room.events.filter((e) => e.seq > this.eventSeqSent); if (!fresh.length) return;
    this.eventSeqSent = fresh[fresh.length - 1]!.seq;
    void this.o.store.recordEvents(this.roomId, fresh.filter((e) => e.k === 'award' || e.k === 'purchase')).catch((e) => this.fail('recordEvents', e));
    for (const c of this.conns.values()) {
      if (!c.ready) continue;
      const mine = c.kind === 'player' ? this.room.roster[c.sub]?.teamId : null;
      const out = fresh.filter((e) => !e.team || c.kind !== 'player' || e.team === mine).map(publicEvent);
      if (out.length) this.send(c, { t: 'ev', events: out });
    }
  }
  private onResults() {
    this.persisted = true; this.finishedAtMs = this.clock.now();
    void this.save().then(() => this.o.store.finish(this.roomId, 'finished', this.room.results)).catch((e) => this.fail('finish', e));
    this.o.metrics.inc('rooms_finished');
  }
  async save(): Promise<void> {
    if (this.saving || this.closed && !this.persisted) return; this.saving = true;
    try {
      const rev = this.room.serverSeq; if (rev === this.lastCheckpointRev && !isTerminalPhase(this.room.phase)) { this.lastCheckpointMs = this.clock.now(); return; }
      const ok = await this.o.store.saveCheckpoint(this.roomId, this.o.workerId, rev, checkpoint(this.room));
      if (!ok) { this.o.metrics.inc('checkpoint_refused'); this.o.log?.('checkpoint refused (lease lost?)', { room: this.roomId }); if (!(await this.o.store.acquire(this.roomId, this.o.workerId, 30))) this.close('lease_lost'); }
      else { this.lastCheckpointRev = rev; this.lastCheckpointMs = this.clock.now(); }
    } catch (e) { this.fail('checkpoint', e); } finally { this.saving = false; }
  }
  private fail(where: string, e: unknown) { this.o.metrics.inc('store_errors'); this.o.log?.(`store error in ${where}`, { room: this.roomId, err: e instanceof Error ? e.message : String(e) }); }

  // ── snapshots ───────────────────────────────────────────────────────────────────────────────
  private lookup = (id: string) => this.questions.get(id) ?? null;
  private viewerOf(c: Conn): Viewer { return c.kind === 'player' ? { kind: 'player', pid: c.sub } : { kind: c.kind, focus: c.focus }; }
  private broadcast(now: number) {
    for (const c of this.conns.values()) {
      if (!c.ready || !c.sock.open) continue;
      if (c.sock.buffered > 256 * 1024) { c.needFull = true; this.o.metrics.inc('snapshots_skipped_backpressure'); continue; } // a slow client gets fewer, fresher snapshots
      this.sendSnapshot(c, now);
    }
    for (const t of Object.keys(this.fxBuf)) this.fxBuf[t] = [];
  }
  sendSnapshot(c: Conn, now: number, forceFull = false) {
    const view = buildView(this.room, this.viewerOf(c), now, this.lookup);
    const teamKey = c.kind === 'player' ? this.room.roster[c.sub]?.teamId : (c.focus && this.room.teams[c.focus] ? c.focus : this.room.teamOrder[0]);
    const fx = (teamKey && this.fxBuf[teamKey]) || [];
    const full = forceFull || c.needFull || !c.prev || c.sinceFull >= SNAPSHOT_HZ * 3;
    const { delta } = diffViews(full ? null : c.prev, view);
    const empty = !delta.s && !delta.e && fx.length === 0;
    if (empty && !full && now - c.lastSendMs < 1000) return;
    c.prev = view; c.sinceFull = full ? 0 : c.sinceFull + 1; c.needFull = false; c.lastSendMs = now;
    const me = c.kind === 'player' ? this.room.roster[c.sub] : undefined;
    this.send(c, { t: 'snap', full, ack: me?.seq ?? 0, sm: now, seq: this.room.serverSeq, v: { ...delta, fx } });
  }
  send(c: Conn, p: ServerPacket) {
    if (!c.sock.open) return;
    const s = JSON.stringify(p); c.bytesOut += s.length; this.o.metrics.inc('bytes_out', s.length); if (p.t === 'snap') { this.o.metrics.observe('snapshot_bytes', s.length); this.o.metrics.inc(p.full ? 'snapshots_full' : 'snapshots_delta'); }
    try { c.sock.send(s); } catch { /* the socket close handler cleans up */ }
  }
  private err(c: Conn, code: ErrCode, message: string, fatal = false) { this.send(c, { t: 'err', code, message, fatal }); this.o.metrics.inc(`rejected_${code}`); if (fatal) c.sock.close(4000 + (code === 'bad_token' ? 3 : 0), code); }

  // ── connections ─────────────────────────────────────────────────────────────────────────────
  attach(sock: Sock, who: { kind: 'player' | 'host' | 'screen'; sub: string; focus?: string }): Conn | null {
    const now = this.clock.now();
    if (who.kind === 'player') { const m = this.room.roster[who.sub]; if (!m || m.forfeited) { sock.close(4403, 'not_in_room'); return null; } }
    if (who.kind === 'host' && this.room.audit.some((a) => a.cmd === 'kicked_host')) { sock.close(4403, 'forbidden'); return null; }
    const key = `${who.kind}:${who.sub}`; const old = this.bySub.get(key);
    const c: Conn = { id: ++connSeq, sock, kind: who.kind, sub: who.sub, focus: who.focus, ready: true, prev: null, sinceFull: 0, lastSendMs: 0, needFull: true, buckets: {}, strikes: 0, helloBy: 0, bytesOut: 0, bornMs: now };
    if (old) { this.detach(old, true); old.sock.close(4001, 'duplicate_socket'); this.o.metrics.inc('duplicate_socket_takeover'); }
    this.conns.set(c.id, c); this.bySub.set(key, c);
    if (who.kind === 'player') connect(this.room, who.sub, now);
    if (who.kind === 'host') { this.room.hostPresent = true; this.room.hostSeenMs = now; }
    const me = who.kind === 'player' ? this.room.roster[who.sub] : undefined;
    this.send(c, { t: 'welcome', proto: PROTOCOL, you: { id: who.sub, kind: who.kind, teamId: me?.teamId ?? null }, serverMs: now, tickHz: TICK_HZ, snapHz: SNAPSHOT_HZ, roomCode: this.room.code, resumed: !!old || (me ? me.moves > 0 || me.commands > 0 : false) });
    this.sendSnapshot(c, now, true); this.flushEventsTo(c);
    return c;
  }
  private flushEventsTo(_c: Conn) { /* new sockets get state from the snapshot; past toasts are not replayed */ }
  detach(c: Conn, takeover = false) {
    if (!this.conns.delete(c.id)) return; const key = `${c.kind}:${c.sub}`; if (this.bySub.get(key) === c) this.bySub.delete(key);
    if (takeover) return;
    const now = this.clock.now();
    if (c.kind === 'player') disconnect(this.room, c.sub, now);
    if (c.kind === 'host' && ![...this.conns.values()].some((x) => x.kind === 'host')) { this.room.hostPresent = false; this.room.hostSeenMs = now; }
  }

  // ── packets ─────────────────────────────────────────────────────────────────────────────────
  private allow(c: Conn, kind: keyof typeof RATE & string): boolean {
    const cfg = (RATE as unknown as Record<string, { perSec: number; burst: number }>)[kind]!; const now = this.clock.now();
    const b = (c.buckets[kind] ??= { tokens: cfg.burst, at: now });
    b.tokens = Math.min(cfg.burst, b.tokens + ((now - b.at) / 1000) * cfg.perSec); b.at = now;
    if (b.tokens < 1) return false; b.tokens -= 1; return true;
  }
  onMessage(c: Conn, raw: string) {
    if (raw.length > MAX_PACKET_BYTES) { this.err(c, 'bad_packet', 'Packet too large.', true); return; }
    let json: unknown; try { json = JSON.parse(raw); } catch { this.strike(c, 'Not JSON.'); return; }
    const parsed = clientPacket.safeParse(json); if (!parsed.success) { this.strike(c, 'Unknown or malformed packet.'); return; }
    const p = parsed.data; const now = this.clock.now();
    const bucket = p.t === 'move' ? 'move' : p.t === 'ability' ? 'ability' : p.t === 'answer' ? 'answer' : p.t === 'host' ? 'host' : 'other';
    if (!this.allow(c, bucket)) { this.o.metrics.inc('rate_limited'); if (++c.strikes >= RATE.strikesToClose) this.err(c, 'rate', 'Too many requests.', true); else if (bucket !== 'move') this.err(c, 'rate', 'Slow down a little.'); return; }
    if (p.t === 'ping') { this.send(c, { t: 'pong', c: p.c, sm: now }); return; }
    if (p.t === 'hello') { this.strike(c, 'Already connected.'); return; }
    if (p.t === 'focus') { if (c.kind !== 'player' && this.room.teams[p.team]) { c.focus = p.team; c.needFull = true; } return; }
    if (c.kind === 'screen') { this.err(c, 'not_host', 'This screen is view-only.'); return; }
    if (p.t === 'host') { if (c.kind !== 'host') { this.err(c, 'not_host', 'Only the teacher can do that.'); return; } this.onHost(c, p, now); return; }
    if (c.kind !== 'player') { this.err(c, 'unsupported', 'Players only.'); return; }
    const pid = c.sub;
    switch (p.t) {
      case 'move': { const r = playerMove(this.room, pid, p.seq, p.x, p.y); if (!r.ok) this.o.metrics.inc(`move_${r.code}`); return; }
      case 'ability': { const r = playerAbility(this.room, pid, p.id); if (!r.ok && r.code !== 'not_ready') this.o.metrics.inc(`ability_${r.code}`); this.drainFx(); return; }
      case 'role': { const r = setRole(this.room, pid, p.role as Role); if (!r.ok) this.err(c, 'game', r.message); else this.persistSeat(pid); return; }
      case 'ready': { setReady(this.room, pid, p.v); return; }
      case 'vote': { const r = vote(this.room, pid, p.d, p.u, `${pid}:${p.id}`); if (!r.ok) this.err(c, 'game', r.message); return; }
      case 'answer': void this.onAnswer(c, p); return;
      case 'hint': { const q = this.room.quiz; const row = q ? this.questions.get(q.questionId) : undefined; const ok = q && q.id === p.w && q.status === 'open' && q.eligible[this.room.roster[pid]?.teamId ?? '']?.includes(pid); this.send(c, { t: 'hint', w: p.w, hint: ok && row ? hintOf(row) : null }); return; }
      case 'leave': { leave(this.room, pid); c.sock.close(1000, 'left'); return; }
    }
  }
  private strike(c: Conn, message: string) { this.o.metrics.inc('rejected_bad_packet'); if (++c.strikes >= RATE.strikesToClose) this.err(c, 'bad_packet', message, true); else this.send(c, { t: 'err', code: 'bad_packet', message }); }
  private async onAnswer(c: Conn, p: Extract<ClientPacket, { t: 'answer' }>) {
    const pid = c.sub; const now = this.clock.now(); const can = canAnswer(this.room, pid, p.w, now);
    const reply = (o: Partial<Extract<ServerPacket, { t: 'ans' }>>) => this.send(c, { t: 'ans', w: p.w, id: p.id, ok: false, ...o });
    if (!can.ok) { reply({ code: can.code, message: can.message }); this.o.metrics.inc(`answer_${can.code}`); return; }
    if (can.replay) { reply({ ok: true, duplicate: true }); this.o.metrics.inc('answer_duplicate'); return; }
    const q = this.room.quiz!; const row = this.questions.get(q.questionId); if (!row) { reply({ code: 'no_question', message: 'This question is unavailable.' }); return; }
    const g = gradeStored(row, p.r); if (!g.ok) { reply({ code: 'bad_answer', message: g.message }); this.o.metrics.inc('answer_bad_format'); return; }
    const done = recordAnswer(this.room, pid, p.w, { frac: g.frac, correct: g.correct }, now); // idempotent: a racing duplicate sees the stored result
    if (!done.ok) { reply({ code: done.code, message: done.message }); return; }
    reply({ ok: true, duplicate: done.duplicate });
    if (!done.duplicate) { this.o.metrics.inc('answers_graded'); try { await this.o.store.recordAnswer(this.roomId, { window: p.w, pid, questionId: q.questionId, response: p.r, frac: g.frac, correct: g.correct }); } catch (e) { this.fail('recordAnswer', e); } }
  }
  private onHost(c: Conn, p: Extract<ClientPacket, { t: 'host' }>, now: number) {
    const cmd = p.cmd as HostCmd;
    const r = hostCommand(this.room, { ...cmd, id: p.id, rev: p.rev }, now);
    if (r.ok) {
      void this.o.store.audit(this.roomId, { id: p.id, cmd: cmd.cmd, detail: cmd.cmd === 'skip' ? cmd.reason : undefined, at: now }).catch((e) => this.fail('audit', e));
      if (cmd.cmd === 'kick') { const k = this.bySub.get(`player:${cmd.pid}`); if (k) { this.send(k, { t: 'bye', reason: 'removed' }); k.sock.close(4403, 'removed'); } this.persistSeat(cmd.pid); }
      if (cmd.cmd === 'assign') this.persistSeat(cmd.pid);
      if (cmd.cmd === 'start' || cmd.cmd === 'begin' || cmd.cmd === 'end_confirm' || cmd.cmd === 'pause' || cmd.cmd === 'resume') void this.save();
      this.send(c, { t: 'ack', id: p.id, ok: true, nonce: 'nonce' in r ? r.nonce : undefined });
    } else { this.send(c, { t: 'ack', id: p.id, ok: false, code: r.code, message: r.message }); if (r.code === 'stale_revision') this.o.metrics.inc('rejected_stale_revision'); }
    this.drainFx();
  }

  // ── seats (called by the HTTP join) ─────────────────────────────────────────────────────────
  seatPlayer(id: string, name: string, desiredTeam: string | null) {
    const now = this.clock.now(); const r = seat(this.room, { id, name, desiredTeam }, now);
    if (r.ok) this.persistSeat(id);
    return r;
  }
  persistSeat(pid: string) { const m = this.room.roster[pid]; if (m) void this.o.store.saveSeat(this.roomId, { id: m.id, name: m.name, teamId: m.teamId, role: m.role }).catch((e) => this.fail('saveSeat', e)); }
  takenNames(): string[] { return Object.values(this.room.roster).map((m) => m.name); }

  // ── lifecycle ───────────────────────────────────────────────────────────────────────────────
  /** retire: results kept for the TTL, an idle lobby for `idleLobbyMs`, a room with no host for 30 min is abandoned. */
  maintenance(now = this.clock.now()): 'keep' | 'drop' {
    if (this.closed) return 'drop';
    const r = this.room;
    if (r.phase === 'results') return this.finishedAtMs !== null && now - this.finishedAtMs > this.resultsTtlMs ? 'drop' : 'keep';
    if ((r.phase === 'lobby' || r.phase === 'role_pick') && now - r.createdMs > this.idleLobbyMs && r.rosterOrder.length === 0) { void this.o.store.finish(this.roomId, 'abandoned', null); return 'drop'; }
    if (!r.hostPresent && now - r.hostSeenMs > 30 * 60_000 && r.phase !== 'lobby') { void this.o.store.finish(this.roomId, 'abandoned', null).catch(() => undefined); return 'drop'; }
    return 'keep';
  }
  close(reason: string) {
    if (this.closed) return; this.closed = true; if (this.timer) clearInterval(this.timer);
    for (const c of [...this.conns.values()]) { this.send(c, { t: 'bye', reason }); c.sock.close(1001, reason); }
    this.conns.clear(); this.bySub.clear();
  }
  async shutdown(reason = 'restart') { if (!this.persisted) await this.save(); this.close(reason); }
}
const publicEvent = (e: RoomEvent) => ({ seq: e.seq, k: e.k, team: e.team, pid: e.pid, a: e.a && e.k !== 'purchase' ? e.a : e.a ? { upgrade: e.a.upgrade, cost: e.a.cost, how: e.a.how, none: e.a.none } : undefined });
