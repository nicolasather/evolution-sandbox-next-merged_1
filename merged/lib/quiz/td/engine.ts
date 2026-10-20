/** TOWER DEFENSE match engine — pure, deterministic, clock-free (the caller passes `now`).
 *
 *  LOBBY → COUNTDOWN → [QUIZ_OPEN → REVEAL → BUILD → WAVE → WAVE_RESULT] × rounds → FINISHED
 *
 *  - `advance()` moves time-driven phases forward in bounded steps (lazy catch-up on any request: no setInterval, no in-memory loop).
 *  - `reduceSeat()` / `reduceHost()` validate one command against the authoritative state.
 *  - Points are the ONLY currency and only answers create them; every write is an integer with a log line.
 *  - Room side effects (open the question, reveal, pause, end) are RETURNED, never performed here: the server commits them in the same
 *    transaction as the state (td_commit), so a question can never be opened without the matching state, nor the reverse. */
import type { QuestionKind } from '../types';
import {
  COMEBACK_KIT_PCT, MAX_PLAYERS, MAX_SEATS_PER_TEAM, MAX_TOWERS_PER_TEAM, MOVE_COST_PCT, NETWORK_GRACE_MS, ROLE_CAPS, ROLES, SELL_REFUND_PCT,
  STARTING_CORE_HP, STARTING_POINTS, TARGET_CHANGE_COST, TICK_MS, TOWERS, WAGER_CAP, independentAward, roundAward, syncTeamAward,
} from './balance';
import {
  TD_BRANCHES, TD_ROLES, TD_TARGETING, TD_TOWERS, type TDBoardAction, type TDConfig, type TDErrorCode, type TDFinish, type TDHostAction, type TDPhase, type TDResult,
  type TDBossId, type TDRole, type TDRound, type TDSeat, type TDSeatAction, type TDStanding, type TDState, type TDTeam, type TDTower, type TDWaveInput,
} from './domain';
import { MAPS } from './maps';
import { planMatch } from './plan';
import { runWave } from './sim';
import { planWave } from './waves';

export const RULES_VERSION = 1 as const;
export type PoolEntry = { position: number; id: string; kind: QuestionKind; repeat: boolean };
/** A committed submission, as read from the answer pipeline's `submissions` table. Never client-claimed. */
export type CommittedAnswer = { id: string; seatId: string; roomQuestionId: string; correct: boolean; awardedFraction: number /* 0..1000 */ };
export type RoomEffect =
  | { type: 'start' } | { type: 'open'; position: number } | { type: 'reveal' } | { type: 'pause' } | { type: 'resume' } | { type: 'end' } | { type: 'kick'; seatId: string };
export type Credit = { key: string; teamId: string; amount: number; submissionIds: string[] };
export type AdvanceCtx = { now: number; seed: string; pool: PoolEntry[]; answers?: CommittedAnswer[]; presence?: Record<string, number>; hostSeenMs?: number | null };
export type Step = { state: TDState; effects: RoomEffect[]; credits: Credit[]; changed: boolean };

const TEAM_COLORS = ['Mint', 'Coral', 'Blue', 'Gold'] as const;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const fail = (code: TDErrorCode, message: string): TDResult => ({ ok: false, code, message });

function log(team: TDTeam, s: TDState, k: string, seat?: string, p?: Record<string, string | number>) {
  s.seq++; team.log.push({ n: s.seq, k, ...(seat ? { seat } : {}), ...(p ? { p } : {}) }); if (team.log.length > 40) team.log.shift();
}
function fx(s: TDState, kind: string, team?: string, ref?: string) { s.fx = { n: (s.fx?.n ?? 0) + 1, kind, ...(team ? { team } : {}), ...(ref ? { ref } : {}) }; }

export function emptyArmed(): TDTeam['armed'] { return { reinforce: [], salvo: [], purify: 0, protect: 0, scan: false }; }
function newTeam(id: string, name: string, i: number): TDTeam {
  return {
    id, name, colorIndex: i, points: STARTING_POINTS, coreHP: STARTING_CORE_HP, maxCoreHP: STARTING_CORE_HP, towers: [], armed: emptyArmed(), fallen: false,
    wavesCleared: 0, leaks: 0, kills: 0, earned: 0, spent: 0, refunded: 0, answered: 0, correct: 0, partialCredit: 0, pending: [], comebackKitChapter: -1, comebackKit: false,
    architectDiscountUsed: [], freeTargeting: [], log: [], lastWave: null, wager: 0, scanned: null,
  };
}

export function assertConfig(c: TDConfig): void {
  if (c.format === 'coop' && c.teamCount !== 1) throw new Error('Co-op has exactly one squad');
  if (c.format === 'versus' && (c.teamCount < 2 || c.teamCount > 4)) throw new Error('Versus needs 2–4 squads');
  if (!Number.isInteger(c.durationMinutes) || c.durationMinutes < 10 || c.durationMinutes > 45) throw new Error('Choose 10–45 minutes');
  if (!Number.isInteger(c.teamSizeCap) || c.teamSizeCap < 1 || c.teamSizeCap > MAX_SEATS_PER_TEAM) throw new Error('Squads hold 1–5 students');
  if (c.teamCount * c.teamSizeCap > MAX_PLAYERS) throw new Error('At most 20 students in one match');
  if (c.teamNames.length !== c.teamCount) throw new Error('One name per squad');
  if (c.modifiers.includes('secret_wager') && c.format !== 'versus') throw new Error('Secret Wager is only for competitive squads');
}

/** A fresh match (lobby). Deterministic for (config, pool, team ids). */
export function createMatch(config: TDConfig, pool: PoolEntry[], teamIds: string[], now: number): TDState {
  assertConfig(config);
  const originals = pool.filter((p) => !p.repeat);
  const plan = planMatch(config, originals.map((p) => p.kind), originals.length);
  return {
    schemaVersion: 1, rulesVersion: RULES_VERSION, phase: 'lobby', phaseStartedMs: now, phaseDeadlineMs: null, paused: null, pausedTotalMs: 0, startedMs: null, matchEndMs: null,
    locked: false, config, plan, teams: config.teamNames.map((n, i) => newTeam(teamIds[i]!, n, i)), seats: [], round: 0, rounds: [], usedPositions: [], finish: null, seq: 0, fx: null,
    extendedQuestion: false, extendedBuild: false,
  };
}

// ── seats ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const activeSeats = (s: TDState, teamId?: string) => s.seats.filter((x) => !x.revoked && x.teamId !== null && (teamId === undefined || x.teamId === teamId));
export function teamWithRoom(s: TDState, preferred?: string | null): string | null {
  const cap = s.config.teamSizeCap;
  if (preferred && s.teams.some((t) => t.id === preferred) && activeSeats(s, preferred).length < cap) return preferred;
  const open = s.teams.filter((t) => activeSeats(s, t.id).length < cap).sort((a, b) => activeSeats(s, a.id).length - activeSeats(s, b.id).length || a.colorIndex - b.colorIndex);
  return open[0]?.id ?? null;
}
/** A new device joined (after join_room_v2 created the player row). Seats beyond capacity wait without a squad until the host moves them. */
export function addSeat(state: TDState, seatId: string, name: string, now: number, preferredTeam?: string | null): TDResult {
  const s = clone(state);
  if (s.seats.some((x) => x.id === seatId)) return { ok: true, state: s };
  if (s.phase === 'finished') return fail('MATCH_FINISHED', 'This match has finished.');
  if (s.locked) return fail('ROOM_LOCKED', 'The teacher has closed this room to new players.');
  const teamId = s.phase === 'lobby' || s.phase === 'countdown' ? teamWithRoom(s, preferredTeam) : teamWithRoom(s, preferredTeam);
  s.seats.push({ id: seatId, teamId, name, role: null, ready: false, revoked: false, joinedAtMs: now, usedThisWave: [], answersThisRound: 0, answered: 0, correct: 0, partial: 0 });
  const t = s.teams.find((x) => x.id === teamId); if (t) log(t, s, 'joined', seatId);
  return { ok: true, state: s };
}

// ── board actions ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildCost(_s: TDState, team: TDTeam, seat: TDSeat, kind: (typeof TD_TOWERS)[number]): { cost: number; architect: boolean; kit: boolean } {
  let cost = TOWERS[kind].cost; let architect = false; let kit = false;
  if (kind === 'bolt' && team.comebackKit) { cost = Math.ceil((cost * COMEBACK_KIT_PCT) / 100); kit = true; }
  if (seat.role === 'architect' && !team.architectDiscountUsed.includes(seat.id)) { cost = Math.ceil((cost * 90) / 100); architect = true; }
  return { cost, architect, kit };
}
export const upgradeCost = (t: TDTower) => (t.level >= 3 ? null : TOWERS[t.kind].upgrade[t.level - 1]!);
export const sellRefund = (t: TDTower) => Math.floor((t.spent * SELL_REFUND_PCT) / 100);
export const moveCost = (t: TDTower) => (t.freeMove ? 0 : Math.ceil((t.spent * MOVE_COST_PCT) / 100));
export function targetCost(team: TDTeam, seat: TDSeat): number { return seat.role === 'tactician' && !team.freeTargeting.includes(seat.id) ? 0 : TARGET_CHANGE_COST; }

/** The exact cost of a board action and why it would be refused — the same function drives the UI preview and the server check. */
export function previewBoard(s: TDState, seat: TDSeat, a: TDBoardAction): { ok: boolean; cost: number; refund: number; code?: TDErrorCode; message: string } {
  const no = (code: TDErrorCode, message: string) => ({ ok: false, cost: 0, refund: 0, code, message });
  if (s.phase === 'finished') return no('MATCH_FINISHED', 'The match is over.');
  if (s.paused) return no('PAUSED', 'The game is paused.');
  if (s.phase !== 'build' && s.phase !== 'lobby') return no('WRONG_PHASE', 'Build only between waves.');
  if (s.phase === 'lobby') return no('WRONG_PHASE', 'Building opens after the first question.');
  const team = s.teams.find((t) => t.id === seat.teamId); if (!team || seat.revoked) return no('NOT_YOUR_TEAM', 'Not authorized for this squad.');
  if (team.fallen) return no('WRONG_PHASE', 'This squad’s core has fallen; keep answering to help the class report.');
  const map = MAPS[s.config.mapId];
  const towerOf = (id: string) => team.towers.find((t) => t.id === id);
  switch (a.kind) {
    case 'build': {
      if (!TD_TOWERS.includes(a.tower)) return no('INVALID_ACTION', 'Unknown tower.');
      if (!map.pads.some((p) => p.id === a.padId)) return no('INVALID_PAD', 'That is not a build pad.');
      if (team.towers.some((t) => t.padId === a.padId)) return no('PAD_OCCUPIED', 'Pad already occupied.');
      if (team.towers.length >= MAX_TOWERS_PER_TEAM) return no('MAX_TOWERS', `A squad can hold ${MAX_TOWERS_PER_TEAM} towers.`);
      const { cost } = buildCost(s, team, seat, a.tower);
      if (team.points < cost) return no('INSUFFICIENT_POINTS', `Insufficient points: need ${cost - team.points} more.`);
      return { ok: true, cost, refund: 0, message: `Build ${TOWERS[a.tower].name} for ${cost} points.` };
    }
    case 'upgrade': {
      const t = towerOf(a.towerId); if (!t) return no('TOWER_MISSING', 'That tower is gone.');
      const cost = upgradeCost(t); if (cost === null) return no('MAX_LEVEL', 'Tower is level 3.');
      if (t.level === 2) { if (!a.branch) return no('BRANCH_REQUIRED', 'Choose one of the two level-3 upgrades.'); if (!TD_BRANCHES[t.kind].includes(a.branch)) return no('BRANCH_INVALID', 'That upgrade does not belong to this tower.'); }
      if (team.points < cost) return no('INSUFFICIENT_POINTS', `Insufficient points: need ${cost - team.points} more.`);
      return { ok: true, cost, refund: 0, message: `Upgrade to level ${t.level + 1} for ${cost} points.` };
    }
    case 'sell': {
      const t = towerOf(a.towerId); if (!t) return no('TOWER_MISSING', 'That tower is gone.');
      return { ok: true, cost: 0, refund: sellRefund(t), message: `Sell for ${sellRefund(t)} points (half of ${t.spent}).` };
    }
    case 'move': {
      const t = towerOf(a.towerId); if (!t) return no('TOWER_MISSING', 'That tower is gone.');
      if (!map.pads.some((p) => p.id === a.padId)) return no('INVALID_PAD', 'That is not a build pad.');
      if (team.towers.some((x) => x.padId === a.padId)) return no('PAD_OCCUPIED', 'Pad already occupied.');
      const cost = moveCost(t); if (team.points < cost) return no('INSUFFICIENT_POINTS', `Insufficient points: need ${cost - team.points} more.`);
      return { ok: true, cost, refund: 0, message: cost ? `Move for ${cost} points.` : 'Move for free (cracked pad).' };
    }
    case 'target': {
      const t = towerOf(a.towerId); if (!t) return no('TOWER_MISSING', 'That tower is gone.');
      if (!TD_TARGETING.includes(a.policy)) return no('INVALID_ACTION', 'Unknown targeting.');
      if (t.kind === 'beacon') return no('INVALID_ACTION', 'Beacon Lantern does not attack.');
      if (t.targeting === a.policy) return no('INVALID_ACTION', 'Already using that targeting.');
      const cost = targetCost(team, seat); if (team.points < cost) return no('INSUFFICIENT_POINTS', `Insufficient points: need ${cost - team.points} more.`);
      return { ok: true, cost, refund: 0, message: cost ? `Change targeting for ${cost} points.` : 'Free targeting change (Tactician).' };
    }
  }
}

function applyBoard(s: TDState, seat: TDSeat, team: TDTeam, a: TDBoardAction, cost: number): string {
  const r = s.round;
  switch (a.kind) {
    case 'build': {
      const bc = buildCost(s, team, seat, a.tower);
      if (bc.architect) team.architectDiscountUsed.push(seat.id);
      if (bc.kit) team.comebackKit = false;
      const id = `t${r}x${s.seq + 1}`;
      team.towers.push({ id, padId: a.padId, kind: a.tower, level: 1, branch: null, spent: cost, targeting: 'first', builtBy: seat.id, builtRound: r, freeMove: false });
      team.points -= cost; team.spent += cost; log(team, s, 'built', seat.id, { tower: a.tower, pad: a.padId, cost }); fx(s, 'built', team.id, id); return id;
    }
    case 'upgrade': {
      const t = team.towers.find((x) => x.id === a.towerId)!; t.level = (t.level + 1) as 2 | 3; t.spent += cost; if (t.level === 3) t.branch = a.branch ?? null;
      team.points -= cost; team.spent += cost; log(team, s, 'upgraded', seat.id, { tower: t.kind, level: t.level, cost, ...(t.branch ? { branch: t.branch } : {}) }); fx(s, 'upgraded', team.id, t.id); return t.id;
    }
    case 'sell': {
      const t = team.towers.find((x) => x.id === a.towerId)!; const refund = sellRefund(t);
      team.towers = team.towers.filter((x) => x.id !== t.id); team.armed.reinforce = team.armed.reinforce.filter((x) => x !== t.id);
      team.points += refund; team.refunded += refund; log(team, s, 'sold', seat.id, { tower: t.kind, refund }); fx(s, 'sold', team.id, t.id); return t.id;
    }
    case 'move': {
      const t = team.towers.find((x) => x.id === a.towerId)!; const from = t.padId; t.padId = a.padId; t.freeMove = false;
      if (cost) { team.points -= cost; team.spent += cost; t.spent += 0; }
      log(team, s, 'moved', seat.id, { tower: t.kind, from, to: a.padId, cost }); fx(s, 'moved', team.id, t.id); return t.id;
    }
    case 'target': {
      const t = team.towers.find((x) => x.id === a.towerId)!; t.targeting = a.policy;
      if (cost === 0) team.freeTargeting.push(seat.id); else { team.points -= cost; team.spent += cost; }
      log(team, s, 'targeting', seat.id, { tower: t.kind, policy: a.policy, cost }); return t.id;
    }
  }
}

/** One student command. The seat id comes from the verified server session (cookie), never from the payload. */
export function reduceSeat(state: TDState, seatId: string, action: TDSeatAction): TDResult {
  const s = clone(state);
  const seat = s.seats.find((x) => x.id === seatId);
  if (!seat) return fail('NOT_YOUR_TEAM', 'Join the room first.');
  if (seat.revoked) return fail('SEAT_REVOKED', 'The teacher removed this device from the match.');
  if (s.phase === 'finished') return fail('MATCH_FINISHED', 'The match is over.');
  const team = s.teams.find((t) => t.id === seat.teamId) ?? null;
  const between = s.phase === 'lobby' || s.phase === 'build';
  switch (action.kind) {
    case 'ready': {
      if (!between) return fail('WRONG_PHASE', 'Ready is used in the lobby and between waves.');
      if (!team) return fail('NOT_YOUR_TEAM', 'Wait until the teacher places you in a squad.');
      seat.ready = !!action.ready; return { ok: true, state: s };
    }
    case 'role': {
      if (!between) return fail('WRONG_PHASE', 'Roles change in the lobby or between waves.');
      if (action.role !== null && !TD_ROLES.includes(action.role)) return fail('INVALID_ACTION', 'Unknown role.');
      seat.role = action.role; if (team) log(team, s, 'role', seat.id, { role: action.role ?? 'none' }); return { ok: true, state: s };
    }
    case 'team': {
      if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'Squads are chosen in the lobby; ask the teacher to move you later.');
      const target = s.teams.find((t) => t.id === action.teamId); if (!target) return fail('INVALID_ACTION', 'Unknown squad.');
      if (seat.teamId === target.id) return { ok: true, state: s };
      if (activeSeats(s, target.id).length >= s.config.teamSizeCap) return fail('SEAT_FULL', 'That squad is full.');
      seat.teamId = target.id; seat.ready = false; return { ok: true, state: s };
    }
    case 'wager': {
      if (!s.config.modifiers.includes('secret_wager')) return fail('INVALID_ACTION', 'Secret Wager is not enabled.');
      if (!team) return fail('NOT_YOUR_TEAM', 'Not authorized for this squad.');
      if (!['build', 'wave', 'wave_result', 'reveal', 'countdown'].includes(s.phase)) return fail('WRONG_PHASE', 'Stakes are set before the next question opens.');
      const amount = Math.trunc(Number(action.amount));
      if (!Number.isInteger(amount) || amount < 0 || amount > Math.min(WAGER_CAP, team.points)) return fail('INVALID_ACTION', `Stake 0–${Math.min(WAGER_CAP, team.points)} points.`);
      team.wager = amount; log(team, s, amount ? 'wagerSet' : 'wagerCleared', seat.id); return { ok: true, state: s };
    }
    case 'ability': {
      if (s.phase !== 'build') return fail('WRONG_PHASE', 'Abilities are armed between waves.');
      if (s.paused) return fail('PAUSED', 'The game is paused.');
      if (!team || team.fallen) return fail('NOT_YOUR_TEAM', 'Not authorized for this squad.');
      const role = Object.entries(ROLES).find(([, r]) => r.ability === action.ability)?.[0] as TDRole | undefined;
      if (!role || seat.role !== role) return fail('ROLE_REQUIRED', `Only a ${role ? ROLES[role].name : 'matching role'} can use that.`);
      if (seat.usedThisWave.includes(action.ability)) return fail('ABILITY_USED', 'Already used this wave.');
      if (action.ability === 'reinforce') { const t = team.towers.find((x) => x.id === action.towerId); if (!t) return fail('TOWER_MISSING', 'Pick one of your towers.'); if (team.armed.reinforce.includes(t.id)) return fail('ABILITY_USED', 'That tower is already reinforced.'); team.armed.reinforce.push(t.id); }
      if (action.ability === 'salvo') { const at = Math.round(Number(action.at)); if (!Number.isInteger(at) || at < 50 || at > 950) return fail('INVALID_ACTION', 'Mark a spot along the lane.'); team.armed.salvo.push(at); }
      if (action.ability === 'purify') team.armed.purify++;
      if (action.ability === 'protect') team.armed.protect++;
      if (action.ability === 'scan') team.armed.scan = true;
      seat.usedThisWave.push(action.ability); log(team, s, 'ability', seat.id, { ability: action.ability }); fx(s, 'ability', team.id, action.ability);
      return { ok: true, state: s };
    }
    default: {
      if (!team) return fail('NOT_YOUR_TEAM', 'Not authorized for this squad.');
      const pv = previewBoard(s, seat, action);
      if (!pv.ok) return fail(pv.code!, pv.message);
      const spend = pv.cost;
      if (s.config.approvalAbove > 0 && spend > s.config.approvalAbove && action.kind !== 'sell') {
        const id = `p${s.seq + 1}`; team.pending.push({ id, seat: seat.id, action, cost: spend }); log(team, s, 'awaitingApproval', seat.id, { cost: spend });
        return { ok: true, state: s, note: 'NEEDS_APPROVAL' };
      }
      applyBoard(s, seat, team, action, spend);
      return { ok: true, state: s };
    }
  }
}

// ── time-driven phases ──────────────────────────────────────────────────────────────────────────────────────────────────────
const chapterOf = (s: TDState, n: number) => s.plan.bossWaves.filter((b) => b < n).length + s.plan.miniBossWaves.filter((b) => b < n).length;
export function bossFor(s: TDState, n: number): { boss: TDBossId | null; mini: boolean } {
  const boss = MAPS[s.config.mapId].boss;
  if (s.plan.bossWaves.includes(n)) return { boss, mini: false };
  if (s.plan.miniBossWaves.includes(n)) return { boss, mini: true };
  return { boss: null, mini: false };
}
function setPhase(s: TDState, phase: TDPhase, start: number, seconds: number | null) {
  s.phase = phase; s.phaseStartedMs = start; s.phaseDeadlineMs = seconds === null ? null : start + seconds * 1000; fx(s, `phase:${phase}`);
}
function roundOf(s: TDState): TDRound | undefined { return s.rounds.find((r) => r.n === s.round); }

function pickQuestion(s: TDState, pool: PoolEntry[]): PoolEntry | null {
  const free = pool.filter((p) => !s.usedPositions.includes(p.position)).sort((a, b) => a.position - b.position);
  return free.find((p) => !p.repeat) ?? (s.plan.reviewCycle ? free.find((p) => p.repeat) ?? null : null);
}

function waveInputFor(s: TDState, team: TDTeam, r: TDRound): TDWaveInput {
  const roster = activeSeats(s, team.id);
  const count = (role: TDRole) => roster.filter((x) => x.role === role).length;
  return {
    teamId: team.id, mapId: s.config.mapId, wave: r.n,
    towers: team.towers.map((t) => ({ id: t.id, padId: t.padId, kind: t.kind, level: t.level, branch: t.branch, targeting: t.targeting, reinforced: team.armed.reinforce.includes(t.id) })),
    spawns: r.wave!.spawns, coreHP: team.coreHP, maxCoreHP: team.maxCoreHP,
    roleMods: { splashPct: Math.min(ROLE_CAPS.splashPct, 8 * count('artillerist')), statusPct: Math.min(ROLE_CAPS.statusPct, 10 * count('alchemist')) },
    armed: { salvo: [...team.armed.salvo], purify: team.armed.purify, protect: team.armed.protect }, lowPressure: s.config.lowPressure, boss: r.wave!.boss,
  };
}

function startRound(s: TDState, ctx: AdvanceCtx, at: number, effects: RoomEffect[]): void {
  const n = s.round + 1;
  if (n > s.plan.waves) { finishMatch(s, at, 'complete'); effects.push({ type: 'end' }); return; }
  if (s.matchEndMs !== null && at >= s.matchEndMs && s.round > 0) { finishMatch(s, at, 'time'); effects.push({ type: 'end' }); return; }
  // stale catch-up (nobody polled for a while): never start a question in the past — students always get the full reading time
  const start = Math.max(at, ctx.now - 2000);
  const { boss, mini } = bossFor(s, n);
  const wave = planWave({ seed: ctx.seed, wave: n, boss, mini, lowPressure: s.config.lowPressure });
  // host offline for more than a minute: hold the class at this boundary instead of running a question nobody supervises
  if (s.config.questionFlow === 'synchronized' && ctx.hostSeenMs !== undefined && ctx.hostSeenMs !== null && ctx.now - ctx.hostSeenMs > 60_000) { s.paused = { atMs: start, reason: 'host_offline' }; effects.push({ type: 'pause' }); return; }
  const round: TDRound = { n, question: null, openedAtMs: null, deadlineMs: null, eligible: {}, submitted: [], credited: false, award: {}, correctBySeat: {}, wave, waveStartMs: null, waveTicks: 0, waveInput: null, results: null };
  s.round = n; s.rounds.push(round); if (s.rounds.length > 24) s.rounds.splice(0, s.rounds.length - 24);
  for (const seat of s.seats) { seat.usedThisWave = []; seat.answersThisRound = 0; }
  for (const t of s.teams) { t.architectDiscountUsed = []; t.freeTargeting = []; }
  s.extendedQuestion = false; s.extendedBuild = false;
  if (s.config.questionFlow === 'independent') { enterBuild(s, start); return; }
  const q = pickQuestion(s, ctx.pool);
  if (!q) { finishMatch(s, start, 'questions'); effects.push({ type: 'end' }); return; }
  s.usedPositions.push(q.position);
  round.question = { roomQuestionId: q.id, position: q.position, kind: q.kind, index: n, total: s.plan.waves, repeat: q.repeat };
  round.openedAtMs = start; round.deadlineMs = start + s.plan.questionSeconds * 1000;
  // eligibility: present when the question opened (presence within 30 s); unknown presence (practice) counts everyone
  for (const t of s.teams) round.eligible[t.id] = activeSeats(s, t.id).filter((x) => !ctx.presence || (ctx.presence[x.id] ?? 0) >= start - 30_000).map((x) => x.id);
  setPhase(s, 'quiz_open', start, s.plan.questionSeconds); s.phaseDeadlineMs = round.deadlineMs;
  effects.push({ type: 'open', position: q.position });
}

function enterBuild(s: TDState, at: number) {
  for (const seat of s.seats) seat.ready = false;
  const chapter = chapterOf(s, s.round);
  for (const t of s.teams) {
    t.pending = [];
    // comeback kit: a squad that cannot afford any tower and holds fewer than two gets one half-price Bolt per chapter (same rule for every squad)
    if (!t.fallen && t.points < TOWERS.bolt.cost && t.towers.length < 2 && t.comebackKitChapter < chapter) { t.comebackKit = true; t.comebackKitChapter = chapter; log(t, s, 'comebackKit'); }
  }
  setPhase(s, 'build', at, s.plan.buildSeconds);
}

/** Close the synchronized question: credit every squad ONCE from committed submissions, settle wagers, reveal. */
function closeQuestion(s: TDState, ctx: AdvanceCtx, at: number, effects: RoomEffect[], credits: Credit[]) {
  const r = roundOf(s)!; const q = r.question!;
  const answers = (ctx.answers ?? []).filter((a) => a.roomQuestionId === q.roomQuestionId);
  r.submitted = [...new Set(answers.map((a) => a.seatId))];
  for (const t of s.teams) {
    const mine = answers.filter((a) => s.seats.find((x) => x.id === a.seatId)?.teamId === t.id);
    const eligible = new Set([...(r.eligible[t.id] ?? []), ...mine.map((a) => a.seatId)]);
    const correctMilli = mine.reduce((n, a) => n + Math.max(0, Math.min(1000, a.awardedFraction)), 0);
    const award = eligible.size ? syncTeamAward(roundAward(r.n), Math.min(correctMilli, eligible.size * 1000), eligible.size) : 0;
    r.award[t.id] = award;
    if (award > 0) { t.points += award; t.earned += award; log(t, s, 'earned', undefined, { n: award, correct: Math.round(correctMilli / 1000), of: eligible.size }); }
    else log(t, s, 'noAward', undefined, { of: eligible.size });
    credits.push({ key: `q:${q.roomQuestionId}:${t.id}`, teamId: t.id, amount: award, submissionIds: mine.map((a) => a.id) });
    t.answered += mine.length; t.correct += mine.filter((a) => a.awardedFraction >= 1000).length; t.partialCredit += correctMilli;
    for (const a of mine) { const seat = s.seats.find((x) => x.id === a.seatId); if (seat) { seat.answered++; if (a.awardedFraction >= 1000) seat.correct++; else if (a.awardedFraction > 0) seat.partial++; } r.correctBySeat[a.seatId] = a.awardedFraction; }
    // Secret Wager (competitive only): a squad with at least half of its eligible students correct wins its stake; otherwise it loses it (never below zero)
    const w = t.wager;
    if (w > 0) {
      const won = eligible.size > 0 && correctMilli * 2 >= eligible.size * 1000;
      if (won) { t.points += w; t.earned += w; log(t, s, 'wagerWon', undefined, { n: w }); } else { const loss = Math.min(w, t.points); t.points -= loss; log(t, s, 'wagerLost', undefined, { n: loss }); }
      t.wager = 0;
    }
  }
  r.credited = true;
  setPhase(s, 'reveal', at, s.plan.revealSeconds); effects.push({ type: 'reveal' });
}

function startWave(s: TDState, at: number, seed: string) {
  const r = roundOf(s)!; r.waveInput = {}; let maxTicks = 0;
  // Tactician scan: the squad learns which enemy types the NEXT wave brings (never answers, never other squads' boards)
  const next = r.n + 1 <= s.plan.waves ? planWave({ seed, wave: r.n + 1, ...bossFor(s, r.n + 1), lowPressure: s.config.lowPressure }) : null;
  for (const t of s.teams) t.scanned = t.armed.scan && next ? next.archetypes : null;
  for (const t of s.teams) {
    t.pending = [];
    if (t.fallen) continue;
    const input = waveInputFor(s, t, r); r.waveInput[t.id] = input;
    const out = runWave(input); r.results ??= {};
    r.results[t.id] = { ...out.result, core: out.core };
    maxTicks = Math.max(maxTicks, out.result.ticks);
  }
  r.waveTicks = maxTicks; r.waveStartMs = at;
  setPhase(s, 'wave', at, (maxTicks * TICK_MS + 1200) / 1000);
}

function endWave(s: TDState, at: number) {
  const r = roundOf(s)!; const results = r.results ?? {};
  for (const t of s.teams) {
    const res = results[t.id]; if (!res) continue;
    t.coreHP = res.core; t.leaks += res.leaks; t.kills += res.kills; t.lastWave = res;
    if (res.core <= 0) { t.fallen = true; log(t, s, 'coreFallen', undefined, { wave: r.n }); }
    else {
      t.wavesCleared++; log(t, s, res.outcome === 'held' ? 'waveHeld' : 'waveCleared', undefined, { wave: r.n, leaks: res.leaks });
      if (t.towers.some((x) => x.branch === 'core_relief') && t.coreHP < t.maxCoreHP) { t.coreHP++; log(t, s, 'coreRelief'); }
    }
    if (res.cracked) { const tw = t.towers.find((x) => x.id === res.cracked); if (tw) { tw.freeMove = true; log(t, s, 'padCracked', undefined, { tower: tw.kind }); } }
    t.armed = emptyArmed();
  }
  setPhase(s, 'wave_result', at, s.plan.resultSeconds);
  const live = s.teams.filter((t) => !t.fallen);
  if (live.length === 0) finishMatch(s, at, 'core'); // co-op: the shared core fell; versus: every squad's core fell
}

export function standings(s: TDState): TDStanding[] {
  const acc = (t: TDTeam) => (t.answered >= 3 ? Math.round(t.partialCredit / t.answered / 10) : null);
  const rows = s.teams.map((t) => ({ t, key: [t.wavesCleared, Math.round((t.coreHP * 1000) / Math.max(1, t.maxCoreHP)), acc(t) ?? -1, t.points] }));
  rows.sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return b.key[i]! - a.key[i]!; return 0; });
  let rank = 0; let prev: string | null = null;
  return rows.map((row, i) => {
    const sig = row.key.join(':'); if (sig !== prev) rank = i + 1; prev = sig;
    return { teamId: row.t.id, rank, wavesCleared: row.t.wavesCleared, coreHP: row.t.coreHP, maxCoreHP: row.t.maxCoreHP, accuracyPct: acc(row.t), answered: row.t.answered, points: row.t.points, outcome: row.t.fallen ? 'fallen' : 'standing' };
  });
}
export function finishMatch(s: TDState, at: number, reason: TDFinish['reason']) {
  if (s.finish) return;
  const st = standings(s);
  const coop = s.config.format === 'coop'; const team = s.teams[0]!;
  const outcome: TDFinish['outcome'] = coop ? (team.fallen ? 'defeat' : reason === 'complete' ? 'victory' : 'partial') : 'ranked';
  s.finish = { atMs: at, reason, outcome, standings: st };
  s.phase = 'finished'; s.phaseStartedMs = at; s.phaseDeadlineMs = null; fx(s, 'finished');
}

/** Lazy catch-up. Bounded: at most 12 transitions per call. Returns the new state and the room effects/credits to commit atomically. */
export function advance(state: TDState, ctx: AdvanceCtx): Step {
  const s = clone(state); const effects: RoomEffect[] = []; const credits: Credit[] = []; let changed = false;
  for (let guard = 0; guard < 12; guard++) {
    if (s.phase === 'finished' || s.phase === 'lobby' || s.paused) break;
    const deadline = s.phaseDeadlineMs;
    // early transitions that do not wait for the clock
    if (s.phase === 'quiz_open') {
      const r = roundOf(s)!; const answers = (ctx.answers ?? []).filter((a) => a.roomQuestionId === r.question?.roomQuestionId);
      const eligible = Object.values(r.eligible).flat();
      const everyone = eligible.length > 0 && eligible.every((id) => answers.some((a) => a.seatId === id));
      if (everyone || (deadline !== null && ctx.now >= deadline + NETWORK_GRACE_MS)) { closeQuestion(s, ctx, everyone ? ctx.now : deadline!, effects, credits); changed = true; continue; }
      break;
    }
    if (s.phase === 'build' && s.phaseDeadlineMs !== null && ctx.now - s.phaseStartedMs >= 3000) {
      const roster = s.seats.filter((x) => !x.revoked && x.teamId && !s.teams.find((t) => t.id === x.teamId)?.fallen);
      if (roster.length && roster.every((x) => x.ready) && s.teams.every((t) => t.pending.length === 0)) { startWave(s, ctx.now, ctx.seed); changed = true; continue; }
    }
    if (deadline === null || ctx.now < deadline) break;
    changed = true;
    switch (s.phase) {
      case 'countdown': startRound(s, ctx, deadline, effects); break;
      case 'reveal': enterBuild(s, deadline); break;
      case 'build': startWave(s, deadline, ctx.seed); break;
      case 'wave': endWave(s, deadline); break;
      case 'wave_result': startRound(s, ctx, deadline, effects); break;
      default: break;
    }
  }
  return { state: s, effects, credits, changed };
}

/** Independent flow: one personal answer, credited once per submission (key `s:<submissionId>`). */
export function creditPersonal(state: TDState, a: CommittedAnswer): { state: TDState; credit: Credit | null } {
  const s = clone(state); const seat = s.seats.find((x) => x.id === a.seatId); if (!seat || !seat.teamId) return { state, credit: null };
  const team = s.teams.find((t) => t.id === seat.teamId)!; const roster = Math.max(1, activeSeats(s, team.id).length);
  const amount = independentAward(a.awardedFraction, roster);
  seat.answered++; if (a.awardedFraction >= 1000) seat.correct++; else if (a.awardedFraction > 0) seat.partial++;
  team.answered++; if (a.awardedFraction >= 1000) team.correct++; team.partialCredit += Math.max(0, Math.min(1000, a.awardedFraction));
  if (amount > 0) { team.points += amount; team.earned += amount; log(team, s, 'earnedPersonal', seat.id, { n: amount }); }
  const r = roundOf(s); if (r) r.correctBySeat[seat.id] = (r.correctBySeat[seat.id] ?? 0) + a.awardedFraction;
  return { state: s, credit: { key: `s:${a.id}`, teamId: team.id, amount, submissionIds: [a.id] } };
}
/** Independent flow: may this seat open one more personal question now? */
export function personalAllowed(s: TDState, seatId: string): { ok: boolean; message: string } {
  const seat = s.seats.find((x) => x.id === seatId);
  if (s.config.questionFlow !== 'independent') return { ok: false, message: 'Questions are shared in this match.' };
  if (!seat || seat.revoked || !seat.teamId) return { ok: false, message: 'Join a squad first.' };
  if (s.paused) return { ok: false, message: 'The game is paused.' };
  if (!['build', 'wave', 'wave_result'].includes(s.phase)) return { ok: false, message: 'Personal questions open during the round.' };
  if (seat.answersThisRound >= s.plan.personalCap) return { ok: false, message: `You answered ${s.plan.personalCap} this round. New questions open next round.` };
  return { ok: true, message: '' };
}

// ── host ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function shiftAll(s: TDState, by: number) {
  if (s.phaseDeadlineMs !== null) s.phaseDeadlineMs += by; s.phaseStartedMs += by; if (s.matchEndMs !== null) s.matchEndMs += by;
  const r = roundOf(s); if (r) { if (r.deadlineMs !== null) r.deadlineMs += by; if (r.openedAtMs !== null) r.openedAtMs += by; if (r.waveStartMs !== null) r.waveStartMs += by; }
}
export function reduceHost(state: TDState, a: TDHostAction, now: number): { result: TDResult; effects: RoomEffect[] } {
  const s = clone(state); const effects: RoomEffect[] = [];
  const ok = (): { result: TDResult; effects: RoomEffect[] } => ({ result: { ok: true, state: s }, effects });
  const no = (code: TDErrorCode, message: string) => ({ result: fail(code, message), effects });
  if (s.phase === 'finished' && a.kind !== 'hide_names') return no('MATCH_FINISHED', 'The match is over.');
  switch (a.kind) {
    case 'start': {
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'The match has already started.');
      const empty = s.teams.filter((t) => activeSeats(s, t.id).length === 0);
      if (empty.length && !a.override) return no('NOT_READY_YET', `${empty.map((t) => t.name).join(', ')} ${empty.length === 1 ? 'has' : 'have'} no players yet. Start anyway to continue.`);
      for (const t of s.teams) {
        const wardens = activeSeats(s, t.id).filter((x) => x.role === 'warden').length;
        t.maxCoreHP = STARTING_CORE_HP + Math.min(ROLE_CAPS.wardenHP, 2 * wardens); t.coreHP = t.maxCoreHP;
      }
      s.startedMs = now; s.matchEndMs = now + s.plan.minutes * 60_000;
      setPhase(s, 'countdown', now, 3); effects.push({ type: 'start' });
      return ok();
    }
    case 'pause': { if (s.paused) return no('PAUSED', 'Already paused.'); if (s.phase === 'lobby') return no('WRONG_PHASE', 'Start the match first.'); s.paused = { atMs: now, reason: 'teacher' }; effects.push({ type: 'pause' }); return ok(); }
    case 'resume': {
      if (!s.paused) return no('INVALID_ACTION', 'The game is not paused.');
      const by = now - s.paused.atMs; s.pausedTotalMs += by; shiftAll(s, by); s.paused = null; effects.push({ type: 'resume' }); return ok();
    }
    case 'extend': {
      const sec = Math.round(Number(a.seconds)); if (!(sec >= 10 && sec <= 60)) return no('INVALID_ACTION', 'Extend by 10–60 seconds.');
      if (s.phase === 'quiz_open') { if (s.extendedQuestion) return no('INVALID_ACTION', 'Reading time was already extended for this question.'); s.extendedQuestion = true; const r = roundOf(s)!; r.deadlineMs! += sec * 1000; s.phaseDeadlineMs = r.deadlineMs; return ok(); }
      if (s.phase === 'build') { if (s.extendedBuild) return no('INVALID_ACTION', 'Build time was already extended this round.'); s.extendedBuild = true; s.phaseDeadlineMs! += sec * 1000; return ok(); }
      return no('WRONG_PHASE', 'Extend works during a question or a build.');
    }
    case 'advance': {
      if (s.paused) return no('PAUSED', 'Resume first.');
      if (s.phase === 'reveal' || s.phase === 'wave_result' || s.phase === 'countdown') { s.phaseDeadlineMs = now - 1; return ok(); }
      if (s.phase === 'quiz_open') { s.phaseDeadlineMs = now - NETWORK_GRACE_MS - 1; const r = roundOf(s)!; r.deadlineMs = s.phaseDeadlineMs; return ok(); }
      if (s.phase === 'build') { if (s.teams.some((t) => t.pending.length)) return no('NEEDS_APPROVAL', 'Approve or decline the waiting purchases first.'); s.phaseDeadlineMs = now - 1; return ok(); }
      return no('WRONG_PHASE', 'The wave plays to its end.');
    }
    case 'end': { finishMatch(s, now, 'teacher'); effects.push({ type: 'end' }); return ok(); }
    case 'kick': {
      const seat = s.seats.find((x) => x.id === a.seatId); if (!seat) return no('INVALID_ACTION', 'No such player.');
      seat.revoked = true; seat.ready = false; const t = s.teams.find((x) => x.id === seat.teamId); if (t) { t.pending = t.pending.filter((p) => p.seat !== seat.id); log(t, s, 'removed', seat.id); }
      effects.push({ type: 'kick', seatId: seat.id }); return ok();
    }
    case 'move_seat': {
      if (s.phase !== 'lobby' && s.phase !== 'build') return no('WRONG_PHASE', 'Move players in the lobby or between waves.');
      const seat = s.seats.find((x) => x.id === a.seatId); if (!seat || seat.revoked) return no('INVALID_ACTION', 'No such player.');
      if (a.teamId !== null) { if (!s.teams.some((t) => t.id === a.teamId)) return no('INVALID_ACTION', 'Unknown squad.'); if (seat.teamId !== a.teamId && activeSeats(s, a.teamId).length >= s.config.teamSizeCap) return no('SEAT_FULL', 'That squad is full.'); }
      seat.teamId = a.teamId; seat.ready = false; return ok();
    }
    case 'lock': { s.locked = !!a.locked; return ok(); }
    case 'hide_names': { s.config.hideNames = !!a.hide; return ok(); }
    case 'rename_team': {
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'Rename squads in the lobby.');
      const t = s.teams.find((x) => x.id === a.teamId); const name = String(a.name ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
      if (!t) return no('INVALID_ACTION', 'Unknown squad.'); if (name.length < 1 || name.length > 24) return no('INVALID_ACTION', 'Squad names are 1–24 characters.');
      if (s.teams.some((x) => x.id !== t.id && x.name.toLowerCase() === name.toLowerCase())) return no('INVALID_ACTION', 'Another squad already has that name.');
      t.name = name; return ok();
    }
    case 'approve': {
      if (s.phase !== 'build') return no('WRONG_PHASE', 'Approvals happen between waves.');
      const t = s.teams.find((x) => x.id === a.teamId); const p = t?.pending.find((x) => x.id === a.pendingId); if (!t || !p) return no('INVALID_ACTION', 'That request is gone.');
      t.pending = t.pending.filter((x) => x.id !== p.id);
      if (!a.approve) { log(t, s, 'declined', p.seat); return ok(); }
      const seat = s.seats.find((x) => x.id === p.seat); if (!seat || seat.revoked) return no('INVALID_ACTION', 'That player left.');
      const pv = previewBoard(s, seat, p.action); if (!pv.ok) return no(pv.code!, pv.message);
      applyBoard(s, seat, t, p.action, pv.cost); return ok();
    }
  }
}
export { TEAM_COLORS };
