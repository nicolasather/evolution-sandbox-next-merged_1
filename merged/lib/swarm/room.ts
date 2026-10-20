/** The authoritative room: lobby → roles → countdown → [wave → freeze → question → grade → upgrade → ready]* → results.
 *  Pure and deterministic given (state, commands, clock values). It never reads a clock itself: every function receives `nowMs`.
 *  The worker owns time, sockets and persistence; this module owns the rules. State is plain JSON so it checkpoints and replays. */
import { configSchema, isActivePhase, isTerminalPhase, MAX_PARTICIPANTS, type Arena, type AuditEntry, type Config, type Draft, type Participant, type Phase, type Room, type RoomEvent, type Role, type Team, type UpgradeKind, ENGINE_VERSION, ROLES } from './domain';
import { BOSS, DISCONNECT, ECONOMY, UPGRADE_DEFS, beaconHp } from './balance';
import { MAPS } from './maps';
import { planSession, questionSecondsFor } from './plan';
import { buyUpgrade, draftOffers, rankTeams, resolveVotes, teamAward } from './economy';
import { makeCtx, newArena, protectOnDisconnect, startWave, stepArena, castAbility, up, type SimCtx } from './sim';
import { seedFrom } from './rng';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; code: string; message: string };
const fail = (code: string, message: string) => ({ ok: false as const, code, message });
const TEAM_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
const MAX_EVENTS = 300, MAX_AUDIT = 200, MAX_LEDGER = 600;

export type CreateArgs = { id: string; code: string; config: unknown; seed: number; nowMs: number; pool: { id: string; kind: string }[] };
export function createRoom(args: CreateArgs): Room {
  const config: Config = configSchema.parse(args.config);
  const pool = args.pool;
  const plan = planSession({ minutes: config.minutes, poolSize: pool.length, focus: config.focus, difficulty: config.difficulty, allowReviewCycle: config.allowReviewCycle });
  const names = config.teamNames ?? (config.mode === 'coop' ? ['Beacon Crew'] : TEAM_NAMES.slice(0, config.teamCount));
  const teams: Record<string, Team> = {}; const order: string[] = [];
  for (let i = 0; i < config.teamCount; i++) {
    const id = `t${i + 1}`; order.push(id);
    teams[id] = { id, name: names[i] ?? TEAM_NAMES[i]!, wallet: 0, earned: 0, spent: 0, wavesCompleted: 0, upgrades: {}, drafts: 0, purchases: 0, questionsAnswered: 0, fracSum: 0, eligibleSum: 0, abandonMs: 0 };
  }
  if (new Set(order.map((i) => teams[i]!.name.toLowerCase())).size !== order.length) throw new Error('Teams need different names');
  const qPool = plan.reviewCycle ? Array.from({ length: plan.questionsTotal }, (_, i) => ({ ...pool[i % pool.length]!, repeat: i >= pool.length })) : pool.slice(0, plan.questionsTotal).map((q) => ({ ...q, repeat: false }));
  return {
    v: 1, engine: ENGINE_VERSION, id: args.id, code: args.code, config, seed: args.seed, phase: 'lobby', rev: 0, serverSeq: 0, tick: 0, createdMs: args.nowMs,
    paused: false, pausedAtMs: null, pauseReason: null, locked: false, wave: 0, waveTick: 0, breakIndex: 0, qPool, lateJoin: false, emptySinceMs: null, phaseEndsMs: null, resumeAtMs: null, breakQuestionsLeft: 0,
    teams, teamOrder: order, arenas: {}, roster: {}, rosterOrder: [], plan, quiz: null, draft: null, qUsed: 0, settledWindows: [], draftsDone: 0, results: null,
    hostSeenMs: args.nowMs, hostPresent: true, audit: [], ledger: [], endNonce: null, log: [], eventSeq: 0, events: [],
  };
}

// ── small utilities ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function emit(r: Room, k: string, o: { team?: string; pid?: string; a?: Record<string, unknown> } = {}) {
  const e: RoomEvent = { seq: ++r.eventSeq, tick: r.tick, k, ...o }; r.events.push(e); if (r.events.length > MAX_EVENTS) r.events.splice(0, r.events.length - MAX_EVENTS);
}
export function drainEvents(r: Room, afterSeq: number): RoomEvent[] { return r.events.filter((e) => e.seq > afterSeq); }
function once(r: Room, key: string): boolean { if (r.ledger.includes(key)) return false; r.ledger.push(key); if (r.ledger.length > MAX_LEDGER) r.ledger.splice(0, r.ledger.length - MAX_LEDGER); return true; }
const bump = (r: Room) => { r.rev++; r.serverSeq++; };
function setPhase(r: Room, p: Phase) { if (isTerminalPhase(r.phase) && p !== 'results') return; r.phase = p; bump(r); emit(r, 'phase', { a: { phase: p, wave: r.wave } }); }
export const membersOf = (r: Room, teamId: string): Participant[] => r.rosterOrder.map((id) => r.roster[id]!).filter((m) => m.teamId === teamId && !m.forfeited);
const connectedOf = (r: Room, teamId: string) => membersOf(r, teamId).filter((m) => m.connected && !m.pending);
const audit = (r: Room, at: number, cmd: string, id: string, detail?: string) => { const e: AuditEntry = { at, cmd, id, by: 'teacher', detail }; r.audit.push(e); if (r.audit.length > MAX_AUDIT) r.audit.shift(); };

const ctxCache = new WeakMap<Room, Map<string, SimCtx>>();
function ctxFor(r: Room, teamId: string): SimCtx {
  let m = ctxCache.get(r); if (!m) { m = new Map(); ctxCache.set(r, m); }
  let c = m.get(teamId);
  if (!c) { c = makeCtx(r.config, r.teams[teamId]!, Math.max(1, r.wave), r.plan.waves.length, r.roster, r.draftsDone); m.set(teamId, c); }
  return c;
}
const dropCtx = (r: Room) => ctxCache.delete(r);

// ── lobby: seats, roles, presence ───────────────────────────────────────────────────────────────────────────────────────
const norm = (s: string) => s.normalize('NFKC').trim().toLowerCase();
export function seat(r: Room, a: { id: string; name: string; desiredTeam?: string | null; role?: Role }, nowMs: number): Result<{ teamId: string; role: Role }> {
  if (r.roster[a.id]) { const p = r.roster[a.id]!; return { ok: true, teamId: p.teamId, role: p.role }; }
  if (isTerminalPhase(r.phase)) return fail('ended', 'This match has ended.');
  if (r.locked) return fail('locked', 'The teacher has closed this room to new players.');
  const started = r.phase !== 'lobby' && r.phase !== 'role_pick';
  if (started && !r.lateJoin) return fail('started', 'This match already started. Ask your teacher to let you in.');
  if (r.rosterOrder.length >= MAX_PARTICIPANTS) return fail('full', `This match holds ${MAX_PARTICIPANTS} players.`);
  if (r.rosterOrder.some((id) => norm(r.roster[id]!.name) === norm(a.name))) return fail('name_taken', 'That name is already taken in this room.');
  const cap = r.config.teamSizeCap;
  const size = (t: string) => membersOf(r, t).length;
  let teamId = a.desiredTeam && r.teams[a.desiredTeam] ? a.desiredTeam : null;
  if (teamId && size(teamId) >= cap) return fail('team_full', `${r.teams[teamId]!.name} is full (${cap} players). Pick another team.`);
  if (!teamId) { const open = r.teamOrder.filter((t) => size(t) < cap).sort((x, y) => size(x) - size(y) || r.teamOrder.indexOf(x) - r.teamOrder.indexOf(y)); teamId = open[0] ?? null; }
  if (!teamId) return fail('full', 'Every team is full.');
  const first = size(teamId) === 0;
  const p: Participant = { id: a.id, name: a.name, teamId, role: a.role ?? (() => { const open = rolesForSquad(size(teamId) + 1); return open[size(teamId) % open.length]!; })(), connected: true, forfeited: false, ready: false, captain: first, joinedMs: nowMs, lastSeenMs: nowMs, protections: 0, answered: 0, fracSum: 0, windows: 0, commands: 0, moves: 0, seq: 0, pending: started };
  r.roster[a.id] = p; r.rosterOrder.push(a.id); bump(r); emit(r, 'join', { pid: a.id, team: teamId });
  return { ok: true, teamId, role: p.role };
}
export function setRole(r: Room, pid: string, role: Role): Result {
  const p = r.roster[pid]; if (!p) return fail('unknown', 'Unknown player.');
  if (!ROLES.includes(role)) return fail('bad_role', 'Unknown role.');
  const lobby = r.phase === 'lobby' || r.phase === 'role_pick';
  const squad = Object.values(r.roster).filter((m) => m.teamId === p.teamId).length;
  if (p.role !== role && !rolesForSquad(squad).includes(role)) return fail('role_locked', `A squad of ${squad} can use: ${rolesForSquad(squad).map((x) => ROLE_DEFS[x].label).join(', ')}.`);
  const boundary = r.phase === 'ready' && r.config.allowRespec;
  if (!lobby && !boundary) return fail('wrong_phase', 'Roles can only change before the match or between waves when the teacher allows it.');
  p.role = role; p.ready = false; bump(r);
  const a = r.arenas[p.teamId]; const e = a?.players[pid];
  if (e) { const old = e.maxHp; const rd = require_role(role); e.maxHp = rd.hp; e.hp = Math.max(1, Math.round((e.hp / old) * rd.hp)); e.abilityMax = rd.abilityCd; e.abilityCd = Math.min(e.abilityCd, rd.abilityCd); e.fireCd = 0; dropCtx(r); }
  return { ok: true };
}
import { ROLE_DEFS, rolesForSquad } from './balance';
const require_role = (role: Role) => ROLE_DEFS[role];
export function setReady(r: Room, pid: string, ready: boolean): Result { const p = r.roster[pid]; if (!p) return fail('unknown', 'Unknown player.'); p.ready = ready; bump(r); return { ok: true }; }
export function connect(r: Room, pid: string, nowMs: number) { const p = r.roster[pid]; if (!p) return; p.connected = true; p.lastSeenMs = nowMs; r.emptySinceMs = null; bump(r); emit(r, 'online', { pid }); }
export function disconnect(r: Room, pid: string, nowMs: number) {
  const p = r.roster[pid]; if (!p || !p.connected) return; p.connected = false; p.lastSeenMs = nowMs; bump(r); emit(r, 'offline', { pid });
  const a = r.arenas[p.teamId]; if (a && isActivePhase(r.phase) && protectOnDisconnect(a, pid, p.protections)) p.protections++;
  if (Object.values(r.roster).every((m) => !m.connected)) r.emptySinceMs = nowMs;
}
/** Explicit, bounded forfeit: the seat is released and every denominator ignores it from the next window; the arena changes only at the next wave boundary. */
export function leave(r: Room, pid: string): Result {
  const p = r.roster[pid]; if (!p) return fail('unknown', 'Unknown player.');
  p.forfeited = true; p.connected = false; bump(r); emit(r, 'left', { pid, team: p.teamId });
  if (r.phase === 'lobby' || r.phase === 'role_pick') { delete r.roster[pid]; r.rosterOrder = r.rosterOrder.filter((i) => i !== pid); const rest = membersOf(r, p.teamId); if (p.captain && rest[0]) rest[0].captain = true; }
  return { ok: true };
}

// ── start ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function begin(r: Room, nowMs: number): Result {
  const empty = r.teamOrder.filter((t) => membersOf(r, t).length === 0);
  const remaining = r.teamOrder.filter((t) => !empty.includes(t));
  if (r.config.mode === 'coop' && remaining.length < 1) return fail('no_players', 'Wait for at least 1 player to join.');
  if (r.config.mode === 'versus' && remaining.length < 2) return fail('not_enough_teams', 'Versus needs at least 2 teams with 1 player each. Share the code and wait for players.');
  for (const t of empty) { delete r.teams[t]; r.teamOrder = r.teamOrder.filter((x) => x !== t); }
  for (const t of r.teamOrder) {
    const ms = membersOf(r, t);
    r.arenas[t] = newArena(t, ms.map((m) => ({ id: m.id, role: m.role })), r.seed);
    for (const m of ms) m.pending = false;
  }
  dropCtx(r); r.phase = 'countdown'; r.resumeAtMs = nowMs + ECONOMY.countdownSeconds * 1000; bump(r); emit(r, 'countdown', { a: { teams: r.teamOrder.length } });
  return { ok: true };
}

// ── host commands ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type HostCmd =
  | { cmd: 'start' } | { cmd: 'begin' } | { cmd: 'pause'; reason?: string } | { cmd: 'resume' } | { cmd: 'extend'; seconds: number } | { cmd: 'skip'; reason: string }
  | { cmd: 'end_request' } | { cmd: 'end_confirm'; nonce: string } | { cmd: 'kick'; pid: string } | { cmd: 'lock'; value: boolean } | { cmd: 'late_join'; value: boolean }
  | { cmd: 'assign'; pid: string; teamId?: string; role?: Role } | { cmd: 'ask_now' };
export function hostCommand(r: Room, c: HostCmd & { id: string; rev?: number }, nowMs: number): Result<{ nonce?: string }> {
  if (r.hostSeenMs < nowMs) r.hostSeenMs = nowMs; r.hostPresent = true;
  if (!once(r, `h:${c.id}`)) return { ok: true }; // exact retry of an applied command: no second effect
  if (c.rev !== undefined && c.rev !== r.rev && c.cmd !== 'pause') return fail('stale_revision', `The room changed (now revision ${r.rev}). Refresh and try again.`);
  if (isTerminalPhase(r.phase) && c.cmd !== 'lock') return fail('ended', 'The match has ended.');
  audit(r, nowMs, c.cmd, c.id);
  switch (c.cmd) {
    case 'start': if (r.phase !== 'lobby') return fail('wrong_phase', 'Already started.'); setPhase(r, 'role_pick'); return { ok: true };
    case 'begin': {
      if (r.phase !== 'role_pick' && r.phase !== 'lobby') return fail('wrong_phase', 'The match has already begun.');
      return begin(r, nowMs);
    }
    case 'pause': if (r.paused) return { ok: true }; if (r.phase === 'lobby' || r.phase === 'role_pick') return fail('wrong_phase', 'Nothing is running yet.'); r.paused = true; r.pausedAtMs = nowMs; r.pauseReason = c.reason ?? 'teacher'; bump(r); emit(r, 'pause', { a: { reason: r.pauseReason } }); return { ok: true };
    case 'resume': {
      if (!r.paused) return { ok: true };
      const d = nowMs - (r.pausedAtMs ?? nowMs);
      if (r.phaseEndsMs !== null) r.phaseEndsMs += d; if (r.resumeAtMs !== null) r.resumeAtMs += d; if (r.quiz?.status === 'open') r.quiz.deadlineMs += d; if (r.draft) r.draft.closesMs += d;
      r.paused = false; r.pausedAtMs = null; r.pauseReason = null; r.emptySinceMs = null; for (const tt of Object.values(r.teams)) tt.offlineSinceMs = null; r.hostSeenMs = nowMs; bump(r); emit(r, 'resume'); return { ok: true };
    }
    case 'extend': {
      if (r.phase !== 'question' || !r.quiz || r.quiz.status !== 'open') return fail('wrong_phase', 'Only an open question can be extended.');
      if (r.quiz.extensions >= 3) return fail('limit', 'A question can be extended at most 3 times.');
      const s = Math.max(5, Math.min(60, Math.round(c.seconds))); r.quiz.deadlineMs += s * 1000; r.quiz.extensions++; bump(r); return { ok: true };
    }
    case 'skip': {
      if (r.phase !== 'question' || !r.quiz) return fail('wrong_phase', 'Only an open question can be skipped.');
      if (!c.reason || c.reason.trim().length < 3) return fail('reason_required', 'Give a short reason for skipping (it is recorded).');
      audit(r, nowMs, 'skip_reason', c.id, c.reason.slice(0, 80)); r.quiz.status = 'skipped'; r.quiz.skipReason = c.reason.slice(0, 80); r.settledWindows.push(r.quiz.id);
      toGrade(r, nowMs, true); return { ok: true };
    }
    case 'end_request': { const n = `n${seedFrom(`${r.id}|${nowMs}|${r.rev}`).toString(36)}`; r.endNonce = { n, until: nowMs + 15000 }; return { ok: true, nonce: n }; }
    case 'end_confirm': {
      if (!r.endNonce || r.endNonce.n !== c.nonce || nowMs > r.endNonce.until) return fail('confirm_expired', 'Confirm again: ending needs a fresh two-step confirmation.');
      r.endNonce = null; finish(r, nowMs, 'teacher_ended', 'ended'); return { ok: true };
    }
    case 'kick': { const p = r.roster[c.pid]; if (!p) return fail('unknown', 'Unknown player.'); leave(r, c.pid); emit(r, 'kicked', { pid: c.pid }); return { ok: true }; }
    case 'lock': r.locked = c.value; bump(r); return { ok: true };
    case 'late_join': r.lateJoin = c.value; bump(r); return { ok: true };
    case 'assign': {
      const p = r.roster[c.pid]; if (!p) return fail('unknown', 'Unknown player.');
      if (c.role) { const lobby = r.phase === 'lobby' || r.phase === 'role_pick'; if (!lobby) return fail('wrong_phase', 'Roles change only before the match.'); p.role = c.role; }
      if (c.teamId) {
        if (!(r.phase === 'lobby' || r.phase === 'role_pick')) return fail('wrong_phase', 'Teams change only before the match.');
        if (!r.teams[c.teamId]) return fail('unknown_team', 'Unknown team.'); if (membersOf(r, c.teamId).filter((m) => m.id !== p.id).length >= r.config.teamSizeCap) return fail('team_full', 'That team is full.');
        p.teamId = c.teamId; p.captain = membersOf(r, c.teamId).filter((m) => m.id !== p.id).length === 0;
      }
      bump(r); return { ok: true };
    }
    case 'ask_now': {
      if (!isActivePhase(r.phase)) return fail('wrong_phase', 'A question can be launched from a running wave.');
      const pw = r.plan.waves[r.wave - 1]; if (!pw || pw.boss) return fail('not_safe', 'Not during a boss wave. Wait for it to end.');
      if (pw.questionsAfter === 0 || r.wave === r.plan.waves.length) return fail('not_safe', 'No question break follows this wave.');
      r.waveTick = pw.ticks; return { ok: true };
    }
  }
}

// ── the step ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function step(r: Room, nowMs: number): void {
  if (r.phase === 'results') return;
  if (r.phase === 'ending') { finalize(r, nowMs); return; }
  if (r.paused) return;
  // safety nets, all bounded and visible: host away, or the whole room offline
  if (r.phase !== 'lobby' && r.phase !== 'role_pick') {
    if (!r.hostPresent && nowMs - r.hostSeenMs > DISCONNECT.hostAbsenceMs) { r.paused = true; r.pausedAtMs = nowMs; r.pauseReason = 'host_away'; bump(r); emit(r, 'pause', { a: { reason: 'host_away' } }); return; }
    if (r.emptySinceMs !== null && nowMs - r.emptySinceMs > 30000) { r.paused = true; r.pausedAtMs = nowMs; r.pauseReason = 'everyone_offline'; bump(r); emit(r, 'pause', { a: { reason: 'everyone_offline' } }); return; }
  }
  if (r.phase !== 'lobby' && r.phase !== 'role_pick') {
    for (const t of r.teamOrder) {
      const a = r.arenas[t]!; const tm = r.teams[t]!; if (a.status !== 'alive') continue;
      if (connectedOf(r, t).length > 0) { tm.offlineSinceMs = null; continue; }
      if (tm.offlineSinceMs == null) tm.offlineSinceMs = nowMs;
      else if (nowMs - tm.offlineSinceMs > DISCONNECT.abandonMs) { a.status = 'abandoned'; a.fellAtWave = r.wave; bump(r); emit(r, 'abandoned', { team: t }); }
    }
  }
  switch (r.phase) {
    case 'countdown': if (r.resumeAtMs !== null && nowMs >= r.resumeAtMs) startWaveN(r, 1); return;
    case 'wave': case 'boss_wave': tickWorld(r, nowMs); return;
    case 'freeze': if (r.phaseEndsMs !== null && nowMs >= r.phaseEndsMs) openQuestion(r, nowMs); return;
    case 'question': {
      const q = r.quiz; if (!q) return;
      const all = Object.entries(q.eligible).every(([, ids]) => ids.every((id) => q.answers[id] !== undefined || !r.roster[id]?.connected));
      const anyone = Object.values(q.eligible).some((ids) => ids.length > 0);
      if (nowMs >= q.deadlineMs || (anyone && all && Object.values(q.eligible).every((ids) => ids.every((id) => q.answers[id] !== undefined)))) toGrade(r, nowMs, false);
      else if (!anyone) toGrade(r, nowMs, false);
      return;
    }
    case 'grade': if (r.phaseEndsMs !== null && nowMs >= r.phaseEndsMs) afterGrade(r, nowMs); return;
    case 'upgrade': if (r.draft && nowMs >= r.draft.closesMs) closeDraft(r, nowMs); return;
    case 'ready': if (r.resumeAtMs !== null && nowMs >= r.resumeAtMs) startWaveN(r, r.wave + 1); return;
    default: return;
  }
}

function startWaveN(r: Room, n: number) {
  r.wave = n; r.waveTick = 0; dropCtx(r);
  const pw = r.plan.waves[n - 1]!;
  for (const t of r.teamOrder) {
    const a = r.arenas[t]!; if (a.status !== 'alive') continue;
    for (const [pid, e] of Object.entries(a.players)) { if (r.roster[pid]?.forfeited) { delete a.players[pid]; void e; } }
    for (const m of membersOf(r, t)) { if (!a.players[m.id]) { const na = newArena(t, [{ id: m.id, role: m.role }], r.seed); a.players[m.id] = na.players[m.id]!; m.pending = false; } }
    startWave(a, ctxFor(r, t), pw, r.seed, r.roster);
  }
  r.phase = pw.boss ? 'boss_wave' : 'wave'; r.phaseEndsMs = null; r.resumeAtMs = null; bump(r); emit(r, 'wave', { a: { n, boss: pw.boss?.kind ?? null } });
}
function tickWorld(r: Room, nowMs: number) {
  r.tick++; r.serverSeq++; r.waveTick++;
  const pw = r.plan.waves[r.wave - 1]!;
  for (const t of r.teamOrder) {
    const a = r.arenas[t]!; if (a.status !== 'alive') continue;
    if (connectedOf(r, t).length === 0) { // nobody there: the arena holds still (no unfair losses), and a bounded rule eventually retires the team
      r.teams[t]!.abandonMs += 50; a.idleTicks++;
      continue;
    }
    stepArena(a, ctxFor(r, t), pw);
    if ((a.status as string) === 'fallen') emit(r, 'fallen', { team: t, a: { wave: r.wave } });
  }
  const live = r.teamOrder.filter((t) => r.arenas[t]!.status === 'alive');
  if (live.length === 0 || (r.config.mode === 'coop' && r.arenas[r.teamOrder[0]!]!.status !== 'alive')) { finish(r, nowMs, 'all_fallen', 'lost'); return; }
  let done: boolean;
  if (pw.boss) {
    const cap = pw.boss.final ? BOSS.capTicksFinal : BOSS.capTicksMini;
    done = live.every((t) => r.arenas[t]!.bossDead) || r.waveTick >= cap;
    if (done && r.waveTick >= cap) for (const t of live) { const a = r.arenas[t]!; if (!a.bossDead) { if (pw.boss.final) { a.status = 'fallen'; a.fellAtWave = r.wave; emit(r, 'fallen', { team: t, a: { wave: r.wave, why: 'time' } }); } else { a.enemies = a.enemies.filter((e) => !e.boss); a.hazards = []; a.bossDead = true; } } }
  } else done = r.waveTick >= pw.ticks;
  if (!done) return;
  const survivors = r.teamOrder.filter((t) => r.arenas[t]!.status === 'alive');
  for (const t of survivors) r.teams[t]!.wavesCompleted = Math.max(r.teams[t]!.wavesCompleted, r.wave);
  if (survivors.length === 0) { finish(r, nowMs, 'all_fallen', 'lost'); return; }
  for (const t of r.teamOrder) for (const p of Object.values(r.arenas[t]!.players)) { p.ix = 0; p.iy = 0; }
  if (r.wave >= r.plan.waves.length) { finish(r, nowMs, r.config.mode === 'coop' ? 'cleared' : 'complete', 'won'); return; }
  r.breakIndex = r.wave; r.breakQuestionsLeft = pw.questionsAfter; r.phase = 'freeze'; r.phaseEndsMs = nowMs + ECONOMY.freezeMs; bump(r); emit(r, 'freeze', { a: { wave: r.wave } });
}

// ── questions ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function openQuestion(r: Room, nowMs: number) {
  if (r.breakQuestionsLeft <= 0 || r.qUsed >= r.qPool.length) { afterQuestions(r, nowMs); return; }
  const q = r.qPool[r.qUsed]!; const index = r.qUsed; r.qUsed++;
  const eligible: Record<string, string[]> = {};
  for (const t of r.teamOrder) eligible[t] = connectedOf(r, t).filter((m) => !!r.arenas[t]?.players[m.id]).map((m) => m.id).sort();
  const secs = questionSecondsFor(q.kind, r.config.focus, r.config.questionSeconds);
  r.quiz = { id: `q${index + 1}`, index, questionId: q.id, openedMs: nowMs, deadlineMs: nowMs + secs * 1000, extensions: 0, eligible, answers: {}, status: 'open', settledTeams: [], skipReason: null, revealed: false };
  for (const t of r.teamOrder) for (const id of eligible[t]!) r.roster[id]!.windows++;
  r.phase = 'question'; r.phaseEndsMs = null; bump(r); emit(r, 'question', { a: { id: r.quiz.id, kind: q.kind, secs, repeat: q.repeat } });
}
export function canAnswer(r: Room, pid: string, windowId: string, nowMs: number): Result<{ replay?: { frac: number; correct: boolean } }> {
  const p = r.roster[pid]; if (!p || p.forfeited) return fail('unknown', 'Join the match first.');
  const q = r.quiz;
  if (!q || q.id !== windowId) return fail('stale', 'That question is no longer open.');
  if (q.answers[pid]) return { ok: true, replay: { frac: q.answers[pid]!.frac, correct: q.answers[pid]!.correct } }; // duplicate click: same stored result
  if (r.phase !== 'question' || q.status !== 'open') return fail('closed', 'This question has closed.');
  if (r.paused) return fail('paused', 'The match is paused.');
  if (nowMs > q.deadlineMs + 600) return fail('late', 'Time is up for this question.');
  if (!q.eligible[p.teamId]?.includes(pid)) return fail('not_eligible', 'You were not in the match when this question opened.');
  return { ok: true };
}
/** `grade` comes from the server's own grading of the stored key. This function never accepts a client-supplied number. */
export function recordAnswer(r: Room, pid: string, windowId: string, grade: { frac: number; correct: boolean }, nowMs: number): Result<{ frac: number; correct: boolean; duplicate: boolean }> {
  const can = canAnswer(r, pid, windowId, nowMs); if (!can.ok) return can;
  const q = r.quiz!;
  if (can.replay) return { ok: true, ...can.replay, duplicate: true };
  const frac = Math.min(1, Math.max(0, Number.isFinite(grade.frac) ? grade.frac : 0));
  q.answers[pid] = { frac, correct: !!grade.correct, atMs: nowMs }; r.roster[pid]!.commands++; bump(r); emit(r, 'answered', { pid, team: r.roster[pid]!.teamId });
  return { ok: true, frac, correct: !!grade.correct, duplicate: false };
}
function toGrade(r: Room, nowMs: number, skipped: boolean) {
  const q = r.quiz!; if (q.status === 'settled') return;
  if (!skipped) {
    if (!r.settledWindows.includes(q.id)) {
      r.settledWindows.push(q.id);
      for (const t of r.teamOrder) {
        if (q.settledTeams.includes(t)) continue;
        const ids = q.eligible[t] ?? []; const fr = ids.map((id) => q.answers[id]?.frac ?? 0);
        const team = r.teams[t]!; const a = r.arenas[t];
        const award = a && a.status === 'alive' ? teamAward(fr, ids.length) : 0;
        team.wallet += award; team.earned += award; q.settledTeams.push(t);
        team.questionsAnswered += ids.filter((id) => q.answers[id]).length; team.fracSum += fr.reduce((x, y) => x + y, 0); team.eligibleSum += ids.length;
        for (const id of ids) { const p = r.roster[id]!; if (q.answers[id]) { p.answered++; p.fracSum += q.answers[id]!.frac; } }
        emit(r, 'award', { team: t, a: { q: q.id, award, eligible: ids.length, frac: Math.round((fr.reduce((x, y) => x + y, 0) * 100) / Math.max(1, ids.length)) / 100 } });
      }
    }
    q.status = 'settled';
  } else q.status = 'skipped';
  q.revealed = true; r.phase = 'grade'; r.phaseEndsMs = nowMs + ECONOMY.grade[r.config.focus] * 1000; bump(r); emit(r, 'grade', { a: { q: q.id, skipped } });
}
function afterGrade(r: Room, nowMs: number) {
  r.breakQuestionsLeft--;
  if (r.breakQuestionsLeft > 0 && r.qUsed < r.qPool.length) { r.phase = 'freeze'; r.phaseEndsMs = nowMs; bump(r); openQuestion(r, nowMs); return; }
  afterQuestions(r, nowMs);
}
function afterQuestions(r: Room, nowMs: number) {
  const pw = r.plan.waves[r.breakIndex - 1];
  if (pw?.draftAfter && r.teamOrder.some((t) => r.arenas[t]!.status === 'alive')) { openDraft(r, nowMs); return; }
  toReady(r, nowMs);
}
function toReady(r: Room, nowMs: number) { r.quiz = r.quiz && r.quiz.status !== 'open' ? r.quiz : null; r.phase = 'ready'; r.phaseEndsMs = null; r.resumeAtMs = nowMs + ECONOMY.resumeSeconds * 1000; bump(r); emit(r, 'ready'); }

// ── upgrade drafts ──────────────────────────────────────────────────────────────────────────────────────────────────────
function votersOf(r: Room, t: string): Participant[] {
  const live = membersOf(r, t).filter((m) => m.connected && !!r.arenas[t]?.players[m.id]);
  if (r.config.captainOnlyDraft) { const cap = membersOf(r, t).find((m) => m.captain && m.connected) ?? live[0]; return cap ? [cap] : []; }
  return live;
}
function openDraft(r: Room, nowMs: number) {
  const index = r.draftsDone + 1; const offers: Record<string, UpgradeKind[]> = {}; const votes: Draft['votes'] = {};
  for (const t of r.teamOrder) { if (r.arenas[t]!.status !== 'alive') continue; offers[t] = draftOffers(r.seed, index, r.teams[t]!); votes[t] = {}; }
  r.draft = { id: `d${index}`, index, offers, votes, closesMs: nowMs + ECONOMY.draftSeconds * 1000, resolved: {} };
  r.phase = 'upgrade'; bump(r); emit(r, 'draft', { a: { id: r.draft.id } });
}
export function vote(r: Room, pid: string, draftId: string, upgrade: UpgradeKind, actionId: string): Result {
  const p = r.roster[pid]; const d = r.draft;
  if (!p || p.forfeited) return fail('unknown', 'Join the match first.');
  if (r.phase !== 'upgrade' || !d || d.id !== draftId) return fail('stale', 'That upgrade window is closed.');
  if (!once(r, `v:${pid}:${actionId}`)) return { ok: true };
  if (r.paused) return fail('paused', 'The match is paused.');
  const t = p.teamId; if (!d.offers[t]) return fail('no_draft', 'Your team has no upgrade window.');
  if (d.resolved[t]) return fail('resolved', 'Your team already chose.');
  if (!votersOf(r, t).some((m) => m.id === pid)) return fail('not_voter', r.config.captainOnlyDraft ? 'Only your captain chooses upgrades in this match.' : 'You are not in the upgrade vote.');
  if (!d.offers[t]!.includes(upgrade)) return fail('not_offered', 'That upgrade is not on offer.');
  const cost = UPGRADE_DEFS[upgrade].base + UPGRADE_DEFS[upgrade].perLevel * (r.teams[t]!.upgrades[upgrade] ?? 0);
  if (r.teams[t]!.wallet < cost) return fail('too_expensive', `You need ${cost} points for that.`);
  d.votes[t]![pid] = upgrade; bump(r); emit(r, 'vote', { pid, team: t });
  const vs = votersOf(r, t); if (vs.every((m) => d.votes[t]![m.id])) resolveTeam(r, t);
  if (Object.keys(d.offers).every((x) => d.resolved[x])) closeDraft(r, r.hostSeenMs);
  return { ok: true };
}
function resolveTeam(r: Room, t: string) {
  const d = r.draft!; if (d.resolved[t]) return;
  const team = r.teams[t]!; const voters: Record<string, Role> = {}; for (const m of votersOf(r, t)) voters[m.id] = m.role;
  const tally = resolveVotes({ seed: r.seed, draftIndex: d.index, teamId: t, offers: d.offers[t]!, wallet: team.wallet, upgrades: team.upgrades, votes: d.votes[t] ?? {}, voters });
  if (!tally.upgrade) { d.resolved[t] = { upgrade: null, cost: 0, walletBefore: team.wallet, walletAfter: team.wallet, how: 'none' }; emit(r, 'purchase', { team: t, a: { none: true, detail: tally.detail } }); return; }
  const b = buyUpgrade(team, d, t, tally.upgrade);
  if (tally.upgrade === 'beacon_plate') { const a = r.arenas[t]!; a.beacon.max += 12; a.beacon.hp = Math.min(a.beacon.max, a.beacon.hp + 8); }
  d.resolved[t] = { upgrade: tally.upgrade, cost: b.cost, walletBefore: b.walletBefore, walletAfter: b.walletAfter, how: tally.how };
  team.drafts++; dropCtx(r); emit(r, 'purchase', { team: t, a: { upgrade: tally.upgrade, cost: b.cost, walletBefore: b.walletBefore, walletAfter: b.walletAfter, how: tally.how, detail: tally.detail, draft: d.id } });
}
function closeDraft(r: Room, nowMs: number) {
  const d = r.draft; if (!d || r.phase !== 'upgrade') return;
  for (const t of Object.keys(d.offers)) resolveTeam(r, t);
  r.draftsDone++; dropCtx(r); toReady(r, nowMs);
}

// ── intents ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function playerMove(r: Room, pid: string, seq: number, x: number, y: number): Result {
  const p = r.roster[pid]; if (!p || p.forfeited) return fail('unknown', 'Join the match first.');
  if (!isActivePhase(r.phase) || r.paused) return fail('wrong_phase', 'Movement is paused right now.');
  if (!Number.isSafeInteger(seq) || seq <= p.seq) return fail('replay', 'Old input ignored.');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('bad_vector', 'Invalid direction.');
  const n = Math.hypot(x, y); const ix = n > 1 ? x / n : x, iy = n > 1 ? y / n : y;
  const e = r.arenas[p.teamId]?.players[pid]; if (!e) return fail('no_avatar', 'You join the arena at the next wave.');
  p.seq = seq; p.moves++; e.ix = ix; e.iy = iy; return { ok: true };
}
export function playerAbility(r: Room, pid: string, actionId: string): Result {
  const p = r.roster[pid]; if (!p || p.forfeited) return fail('unknown', 'Join the match first.');
  if (!isActivePhase(r.phase) || r.paused) return fail('wrong_phase', 'Abilities are paused right now.');
  if (!once(r, `a:${pid}:${actionId}`)) return { ok: true };
  const a = r.arenas[p.teamId]; if (!a || !a.players[pid]) return fail('no_avatar', 'You join the arena at the next wave.');
  if (!castAbility(a, ctxFor(r, p.teamId), pid)) return fail('not_ready', 'Ability is recharging.');
  p.commands++; emit(r, 'ability', { pid, team: p.teamId }); return { ok: true };
}

// ── finish ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
function finish(r: Room, nowMs: number, reason: string, outcome: 'won' | 'lost' | 'ended') {
  if (isTerminalPhase(r.phase)) return;
  if (r.quiz && r.quiz.status === 'open') toGrade(r, nowMs, false); // grade remaining windows by their saved deadline, once
  r.log.push(`end:${reason}`); r.phase = 'ending'; r.endNonce = null; r.results = { reason, outcome, standings: [], at: nowMs }; bump(r); emit(r, 'ending', { a: { reason, outcome } });
}
function finalize(r: Room, nowMs: number) {
  if (!r.results) r.results = { reason: 'ended', outcome: 'ended', standings: [], at: nowMs };
  const won = r.results.outcome === 'won';
  const inputs = r.teamOrder.map((t) => {
    const a = r.arenas[t]; const team = r.teams[t]!; const players = membersOf(r, t);
    const ps = a ? Object.values(a.players) : [];
    return { team, players, beaconPct: a ? (100 * a.beacon.hp) / Math.max(1, a.beacon.max) : 0, dmg: ps.reduce((x, p) => x + p.damageDealt, 0), activeSec: ps.reduce((x, p) => x + p.activeTicks, 0) / 20, fallenAt: a?.fellAtWave ?? null };
  });
  r.results.standings = rankTeams(inputs, r.config, won);
  r.results.at = nowMs; r.phase = 'results'; r.phaseEndsMs = null; r.resumeAtMs = null; bump(r); emit(r, 'results', { a: { outcome: r.results.outcome } });
}

// ── checkpoint / restore / hash ─────────────────────────────────────────────────────────────────────────────────────────
export const checkpoint = (r: Room): Room => JSON.parse(JSON.stringify(r)) as Room;
export function restore(c: unknown): Room {
  const r = JSON.parse(JSON.stringify(c)) as Room;
  if (r.v !== 1 || r.engine !== ENGINE_VERSION) throw new Error('incompatible checkpoint');
  return r;
}
export function hashRoom(r: Room): string {
  const s = JSON.stringify({ ...r, events: undefined, ledger: undefined, audit: undefined, log: undefined });
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16);
}
export const arenaOf = (r: Room, pid: string): Arena | undefined => { const p = r.roster[pid]; return p ? r.arenas[p.teamId] : undefined; };
export { beaconHp, MAPS, up };
