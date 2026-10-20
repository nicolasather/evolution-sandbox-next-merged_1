/** Persistence for the worker. One interface, three implementations: in memory (tests, SWARM_DEV), a JSON file (single-box dev, survives restarts),
 *  and Postgres (production: the real tables of migration 008). Exactly-once effects come from primary keys, so a crash between "apply" and
 *  "checkpoint" cannot double-credit: replaying the same event is a no-op. */
import { promises as fs } from 'node:fs';
import type { Room, RoomEvent, Results } from '../domain';

export type Sql = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }> };
export type SessionRec = { roomId: string; hostId: string; config: unknown; seed: number; status: 'active' | 'finished' | 'abandoned'; checkpoint: Room | null; checkpointRev: number };
export type Seat = { id: string; name: string; teamId: string; role: string };
export interface Store {
  acquire(roomId: string, workerId: string, ttlSec: number): Promise<boolean>;
  load(roomId: string): Promise<SessionRec | null>;
  saveSeat(roomId: string, s: Seat): Promise<void>;
  saveCheckpoint(roomId: string, workerId: string, rev: number, room: Room): Promise<boolean>;
  recordAnswer(roomId: string, a: { window: string; pid: string; questionId: string; response: unknown; frac: number; correct: boolean }): Promise<boolean>;
  /** answers already stored for a window: a restored worker re-applies them so a crash never loses a graded answer */
  answersFor(roomId: string, window: string): Promise<{ pid: string; frac: number; correct: boolean }[]>;
  recordEvents(roomId: string, events: RoomEvent[]): Promise<void>;
  findRoomByCode(code: string): Promise<string | null>;
  audit(roomId: string, a: { id: string; cmd: string; detail?: string; at: number }): Promise<void>;
  finish(roomId: string, status: 'finished' | 'abandoned', results: Results | null): Promise<void>;
  /** delete terminal sessions older than the retention window (checkpoint only; answers, credits and results stay for reporting) */
  sweep(olderThanMs: number): Promise<number>;
  close(): Promise<void>;
}

export class MemoryStore implements Store {
  sessions = new Map<string, SessionRec & { workerId?: string; leaseUntil?: number; finishedAt?: number }>();
  answers = new Map<string, { frac: number; correct: boolean }>(); credits = new Map<string, number>(); purchases = new Map<string, unknown>(); audits = new Set<string>(); seats = new Map<string, Seat>(); results = new Map<string, Results>();
  now = () => Date.now();
  seed(rec: Pick<SessionRec, 'roomId' | 'hostId' | 'config' | 'seed'> & Partial<SessionRec> & { code?: string }) { if (rec.code) this.codes.set(rec.code.toUpperCase(), rec.roomId); this.sessions.set(rec.roomId, { status: 'active', checkpoint: null, checkpointRev: 0, ...rec }); }
  async acquire(roomId: string, w: string, ttl: number) { const s = this.sessions.get(roomId); if (!s || s.status !== 'active') return false; if (s.workerId && s.workerId !== w && (s.leaseUntil ?? 0) >= this.now()) return false; s.workerId = w; s.leaseUntil = this.now() + ttl * 1000; return true; }
  async load(roomId: string) { const s = this.sessions.get(roomId); return s ? { ...s, checkpoint: s.checkpoint ? (JSON.parse(JSON.stringify(s.checkpoint)) as Room) : null } : null; }
  async saveSeat(roomId: string, s: Seat) { this.seats.set(`${roomId}:${s.id}`, s); }
  async saveCheckpoint(roomId: string, w: string, rev: number, room: Room) { const s = this.sessions.get(roomId); if (!s || s.workerId !== w || (s.leaseUntil ?? 0) < this.now() || s.checkpointRev > rev || s.status !== 'active') return false; s.checkpoint = JSON.parse(JSON.stringify(room)) as Room; s.checkpointRev = rev; return true; }
  async recordAnswer(roomId: string, a: { window: string; pid: string; frac: number; correct: boolean }) { const k = `${roomId}:${a.window}:${a.pid}`; if (this.answers.has(k)) return false; this.answers.set(k, { frac: a.frac, correct: a.correct }); return true; }
  async answersFor(roomId: string, window: string) { const out: { pid: string; frac: number; correct: boolean }[] = []; for (const [k, v] of this.answers) { const [r, w, pid] = k.split(':'); if (r === roomId && w === window) out.push({ pid: pid!, ...v }); } return out; }
  codes = new Map<string, string>();
  async findRoomByCode(code: string) { const id = this.codes.get(code.toUpperCase()); return id && this.sessions.get(id)?.status === 'active' ? id : null; }
  async recordEvents(roomId: string, events: RoomEvent[]) {
    for (const e of events) {
      if (e.k === 'award') this.credits.set(`${roomId}:${e.a?.q}:${e.team}`, Number(e.a?.award ?? 0));
      if (e.k === 'purchase' && e.a?.draft) this.purchases.set(`${roomId}:${e.a.draft}:${e.team}`, e.a);
    }
  }
  async audit(roomId: string, a: { id: string }) { this.audits.add(`${roomId}:${a.id}`); }
  async finish(roomId: string, status: 'finished' | 'abandoned', results: Results | null) { const s = this.sessions.get(roomId); if (!s) return; s.status = status; s.finishedAt = this.now(); if (results && !this.results.has(roomId)) this.results.set(roomId, results); s.checkpoint = null; }
  async sweep(olderThanMs: number) { let n = 0; for (const [k, s] of this.sessions) if (s.status !== 'active' && (s.finishedAt ?? 0) < this.now() - olderThanMs) { this.sessions.delete(k); n++; } return n; }
  async close() {}
}

/** Same behaviour, persisted as one JSON file (atomic write-then-rename) so a dev worker survives a restart. */
export class FileStore extends MemoryStore {
  constructor(private path: string) { super(); }
  static async open(path: string) {
    const s = new FileStore(path);
    try { const j = JSON.parse(await fs.readFile(path, 'utf8')) as { sessions: [string, never][]; answers: [string, never][]; credits: [string, number][] }; s.sessions = new Map(j.sessions); s.answers = new Map(j.answers); s.credits = new Map(j.credits); } catch { /* first run */ }
    return s;
  }
  private async dump() { const tmp = `${this.path}.tmp`; await fs.writeFile(tmp, JSON.stringify({ sessions: [...this.sessions], answers: [...this.answers], credits: [...this.credits] })); await fs.rename(tmp, this.path); }
  async saveCheckpoint(roomId: string, w: string, rev: number, room: Room) { const ok = await super.saveCheckpoint(roomId, w, rev, room); if (ok) await this.dump(); return ok; }
  async recordAnswer(roomId: string, a: { window: string; pid: string; questionId: string; response: unknown; frac: number; correct: boolean }) { const ok = await super.recordAnswer(roomId, a); if (ok) await this.dump(); return ok; }
  async finish(roomId: string, status: 'finished' | 'abandoned', results: Results | null) { await super.finish(roomId, status, results); await this.dump(); }
}

export class PgStore implements Store {
  constructor(private sql: Sql, private end?: () => Promise<void>) {}
  async acquire(roomId: string, w: string, ttl: number) { const r = await this.sql.query<{ ok: boolean }>('select swarm_acquire_lease($1::uuid,$2,$3) as ok', [roomId, w, ttl]); return r.rows[0]?.ok === true; }
  async load(roomId: string) {
    const r = await this.sql.query<{ room_id: string; host_id: string; config: unknown; seed: string; status: SessionRec['status']; checkpoint: Room | null; checkpoint_rev: string }>('select room_id, host_id, config, seed, status, checkpoint, checkpoint_rev from swarm_sessions where room_id = $1::uuid', [roomId]);
    const x = r.rows[0]; return x ? { roomId: x.room_id, hostId: x.host_id, config: x.config, seed: Number(x.seed), status: x.status, checkpoint: x.checkpoint, checkpointRev: Number(x.checkpoint_rev) } : null;
  }
  async saveSeat(roomId: string, s: Seat) {
    await this.sql.query(`insert into swarm_participants(room_id, participant_id, display_name, name_key, team_id, role) values ($1::uuid,$2,$3,$4,$5,$6)
      on conflict (room_id, participant_id) do update set team_id = excluded.team_id, role = excluded.role, last_seen_at = now()`, [roomId, s.id, s.name, s.name.normalize('NFKC').trim().toLowerCase(), s.teamId, s.role]);
  }
  async saveCheckpoint(roomId: string, w: string, rev: number, room: Room) { const r = await this.sql.query<{ ok: boolean }>('select swarm_save_checkpoint($1::uuid,$2,$3::bigint,$4::jsonb) as ok', [roomId, w, rev, JSON.stringify(room)]); return r.rows[0]?.ok === true; }
  async recordAnswer(roomId: string, a: { window: string; pid: string; questionId: string; response: unknown; frac: number; correct: boolean }) {
    const r = await this.sql.query('insert into swarm_answers(room_id, window_id, participant_id, question_id, response, fraction, correct) values ($1::uuid,$2,$3,$4::uuid,$5::jsonb,$6,$7) on conflict do nothing returning 1', [roomId, a.window, a.pid, a.questionId, JSON.stringify(a.response).slice(0, 3900), a.frac, a.correct]);
    return r.rows.length === 1;
  }
  async answersFor(roomId: string, window: string) { const r = await this.sql.query<{ participant_id: string; fraction: string; correct: boolean }>('select participant_id, fraction, correct from swarm_answers where room_id = $1::uuid and window_id = $2', [roomId, window]); return r.rows.map((x) => ({ pid: x.participant_id, frac: Number(x.fraction), correct: x.correct })); }
  async findRoomByCode(code: string) { const r = await this.sql.query<{ room_id: string }>("select s.room_id from swarm_sessions s join rooms r on r.id = s.room_id where r.join_code = $1 and s.status = 'active'", [code.toUpperCase()]); return r.rows[0]?.room_id ?? null; }
  async recordEvents(roomId: string, events: RoomEvent[]) {
    for (const e of events) {
      if (e.k === 'award') await this.sql.query('insert into swarm_credits(room_id, window_id, team_id, amount, eligible) values ($1::uuid,$2,$3,$4,$5) on conflict do nothing', [roomId, String(e.a?.q), e.team, Math.min(100, Number(e.a?.award ?? 0)), Number(e.a?.eligible ?? 0)]);
      if (e.k === 'purchase' && e.a?.draft) await this.sql.query('insert into swarm_purchases(room_id, draft_id, team_id, upgrade, cost, wallet_before, wallet_after, how) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing', [roomId, String(e.a.draft), e.team, e.a.upgrade, e.a.cost, e.a.walletBefore, e.a.walletAfter, e.a.how]);
    }
  }
  async audit(roomId: string, a: { id: string; cmd: string; detail?: string; at: number }) { await this.sql.query('insert into swarm_audit(room_id, command_id, cmd, detail, at_ms) values ($1::uuid,$2,$3,$4,$5) on conflict do nothing', [roomId, a.id.slice(0, 60), a.cmd.slice(0, 30), a.detail?.slice(0, 300) ?? null, a.at]); }
  async finish(roomId: string, status: 'finished' | 'abandoned', results: Results | null) {
    if (results) await this.sql.query('insert into swarm_results(room_id, outcome, reason, standings) values ($1::uuid,$2,$3,$4::jsonb) on conflict do nothing', [roomId, results.outcome, results.reason, JSON.stringify(results.standings)]);
    await this.sql.query("update swarm_sessions set status = $2, finished_at = now(), checkpoint = null, updated_at = now() where room_id = $1::uuid and status = 'active'", [roomId, status]);
  }
  async sweep(olderThanMs: number) { const r = await this.sql.query('update swarm_sessions set checkpoint = null where status <> \'active\' and checkpoint is not null and finished_at < now() - make_interval(secs => $1) returning 1', [olderThanMs / 1000]); return r.rows.length; }
  async close() { await this.end?.(); }
}
