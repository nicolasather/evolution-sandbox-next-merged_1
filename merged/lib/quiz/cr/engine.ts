/** Clue Racing engine: the match as a pure state machine.
 *  lobby → countdown → race → checkpoint → barrier (quiz) → reveal (clue) → route_choice → race … → finished.
 *  Every transition is due at an exact planned instant, the world only runs inside `race`, and every quiz window freezes ALL world time. */
import {
  ABILITY, BRIDGE_RANGE, MAX_ACTIVE_PERKS, MAX_SEATS_PER_ROOM, MAX_SEATS_PER_TEAM, PERK_COST, ROLE_COOLDOWN, RULES_VERSION, TEAM_BURST_TICKS, TICK_MS, WALLET_CAP, WINDOW_CREDIT_CAP,
} from './balance';
import type { Attempt, CommittedAnswer, CRConfig, CRState, Credit, HostAction, PoolEntry, Role, RoomEffect, SeatAction, SeatRec, Standing, TeamRec } from './domain';
import { PROTOCOL } from './domain';
import { buildEvidence } from './evidence';
import { dist } from './maps';
import { pickPositions, questionSeconds, type CRPlan } from './plan';
import { activeIn, allDone, assistRemaining, emptyObj, geoOf, hasPerk, isIdle, passFlag, pushFx, simulate, spawnFor, startLeg, tryStamp, type Timelines } from './sim';

export { RULES_VERSION };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });
const clampCap = (n: unknown) => Math.max(1, Math.min(MAX_SEATS_PER_TEAM, Number.isFinite(Number(n)) ? Math.floor(Number(n)) : MAX_SEATS_PER_TEAM));
export const TEAM_ROLES: readonly Role[] = ['scout', 'signal_keeper', 'cartographer', 'trail_maker', 'archivist'];

export function createSession(cfg: CRConfig, plan: CRPlan, pool: readonly PoolEntry[], teamIds: readonly string[], now: number): CRState {
  const positions = pickPositions(pool, plan.windows);
  const teams: TeamRec[] = teamIds.slice(0, cfg.teamCount).map((id, i) => ({ id, name: cfg.teamNames[i] ?? `Team ${i + 1}`, slot: i, wallet: 0, earned: 0, spent: 0, overflow: 0, masteryTotal: 0, masteryOf: 0, legsDone: 0, legsAssisted: 0, correctSites: 0, retries: 0, doneTicks: 0, coopTotal: 0, coopTarget: 0, perks: [], obj: emptyObj(), burstReadyTick: 0, cues: [], bridgeUntil: 0, pinned: null, awards: [] }));
  const legs = positions.length + 1; const stations = plan.stations.length === legs + 1 ? plan.stations : undefined;
  const rec = { windows: positions.length, legs, legSeconds: plan.legSeconds, revealSeconds: plan.revealSeconds, decisionSeconds: plan.decisionSeconds, countdownSeconds: plan.countdownSeconds, checkpointSeconds: plan.checkpointSeconds, minutes: plan.minutes, stations: stations ?? plan.stations, positions };
  if (!stations) rec.stations = stationsFor(positions.length);
  return {
    rulesVersion: RULES_VERSION, protocol: PROTOCOL, phase: 'lobby', format: cfg.format, mapId: cfg.mapId, locked: false, paused: false, pausedAtMs: null, tick: 0, leg: 0, phaseDeadlineMs: null, phaseStartedMs: now, extended: 0,
    seats: [], teams, plan: rec, question: null, live: null, credited: [], usedPositions: [], evidence: buildEvidence(cfg.seed, cfg.mapId, cfg.difficulty, cfg.format, rec.stations, legs), revealedLegs: 1, startedAtMs: null, finish: null, log: [],
    teamSizeCap: clampCap(cfg.teamSizeCap), lowPressure: !!cfg.lowPressure, readAloud: !!cfg.readAloud, perks: [...cfg.perks], teamCount: cfg.teamCount, seed: cfg.seed, difficulty: cfg.difficulty,
  };
}
import { stationPlan } from './maps';
const stationsFor = (windows: number) => stationPlan(windows);
/** Trusted room settings are mirrored from the stored config on every load, so a stale or tampered state can never widen a limit. */
export function hydrateConfig(s: CRState, cfg: Pick<CRConfig, 'teamSizeCap' | 'lowPressure' | 'readAloud' | 'perks' | 'seed' | 'difficulty'>): CRState {
  return { ...s, teamSizeCap: clampCap(cfg.teamSizeCap), lowPressure: !!cfg.lowPressure, readAloud: !!cfg.readAloud, perks: [...cfg.perks], seed: cfg.seed, difficulty: cfg.difficulty };
}
export const capOf = (s: CRState) => clampCap(s.teamSizeCap);
export const activeSeats = (s: CRState, teamId?: string) => s.seats.filter((x) => !x.revoked && (!teamId || x.teamId === teamId));

/** A team of one plays the Solo Pathfinder; larger teams use each of the five team roles at most once. Returns the seats whose role changed. */
export function reconcileRoles(s: CRState): string[] {
  const changed: string[] = [];
  for (const t of s.teams) {
    const mates = activeSeats(s, t.id).sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    if (mates.length === 1) { if (mates[0]!.role !== 'solo_pathfinder') { mates[0]!.role = 'solo_pathfinder'; mates[0]!.ready = false; changed.push(mates[0]!.id); } continue; }
    const used = new Set<Role>();
    for (const m of mates) { if (TEAM_ROLES.includes(m.role) && !used.has(m.role)) used.add(m.role); else m.role = 'solo_pathfinder'; }
    for (const m of mates) if (m.role === 'solo_pathfinder') { const free = TEAM_ROLES.find((r) => !used.has(r)); if (free) { m.role = free; used.add(free); m.ready = false; changed.push(m.id); } }
  }
  return changed;
}
export const worldTarget = (s: CRState, now: number): number => {
  const l = s.live; if (!l) return s.tick; if (s.phase !== 'race' || s.paused) return l.tick;
  return Math.min(l.endTick, l.anchorTick + Math.max(0, Math.floor((now - l.anchorMs) / TICK_MS)));
};

// ── seats ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function addSeat(s: CRState, seatId: string, name: string, now: number, desiredTeam: string | null): Attempt<CRState> {
  if (s.phase === 'finished') return fail('FINISHED', 'The match is over.');
  if (s.locked) return fail('LOCKED', 'The teacher has closed this room to new players.');
  if (s.seats.some((x) => x.id === seatId)) return { ok: true, state: s };
  if (activeSeats(s).length >= MAX_SEATS_PER_ROOM) return fail('ROOM_FULL', 'This room already has 20 players.');
  const cap = capOf(s); const counts = new Map(s.teams.map((t) => [t.id, activeSeats(s, t.id).length]));
  let team = desiredTeam && counts.has(desiredTeam) && (counts.get(desiredTeam) ?? 0) < cap ? desiredTeam : null;
  if (!team) { const open = s.teams.filter((t) => (counts.get(t.id) ?? 0) < cap).sort((a, b) => (counts.get(a.id)! - counts.get(b.id)!) || a.id.localeCompare(b.id)); team = open[0]?.id ?? null; }
  if (!team) return fail('TEAM_FULL', 'Every team is full.');
  const next = clone(s); const tick = next.live?.tick ?? 0;
  const seat: SeatRec = { id: seatId, name, teamId: team, role: 'solo_pathfinder', ready: false, revoked: false, joinedAt: now, x: 0, y: 0, ix: 0, iy: 0, seq: 0, seenTick: tick, abilityReadyTick: tick, joinedLeg: next.leg };
  next.seats.push(seat); reconcileRoles(next); const sp = spawnFor(next, seat); seat.x = sp.x; seat.y = sp.y; return { ok: true, state: next };
}
export function reduceSeat(s: CRState, seatId: string, a: SeatAction): Attempt<CRState> {
  const seat = s.seats.find((x) => x.id === seatId && !x.revoked); if (!seat) return fail('NO_SEAT', 'You are not in this match.');
  if (s.phase === 'finished') return fail('FINISHED', 'The match is over.');
  const next = clone(s); const me = next.seats.find((x) => x.id === seatId)!; const team = next.teams.find((t) => t.id === me.teamId)!;
  switch (a.kind) {
    case 'role': {
      if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'Roles are chosen in the lobby.');
      const size = activeSeats(s, me.teamId).length;
      if (size === 1) return fail('SOLO_ROLE', 'A team of one plays the Solo Pathfinder. More teammates unlock the five team roles.');
      if (!TEAM_ROLES.includes(a.role)) return fail('BAD_ROLE', 'Pick one of the five team roles.');
      const taken = activeSeats(s, me.teamId).find((x) => x.id !== seatId && x.role === a.role); if (taken) return fail('ROLE_TAKEN', 'A teammate already has that role.');
      me.role = a.role; me.ready = false; return { ok: true, state: next };
    }
    case 'ready': if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'The match already started.'); me.ready = a.ready; return { ok: true, state: next };
    case 'rename': if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'Names change in the lobby.'); me.name = a.name; return { ok: true, state: next };
    case 'vote': {
      if (s.paused) return fail('PAUSED', 'The game is paused.'); if (s.format !== 'split_route') return fail('WRONG_FORMAT', 'Only Split-Route Sprint has a road vote.');
      if (s.phase !== 'route_choice') return fail('WRONG_PHASE', 'The road vote is open between legs.');
      const g = geoOf(s); if (!g.offered.includes(a.option)) return fail('NOT_OFFERED', 'That road is not offered for this leg.');
      team.obj.votes[me.id] = a.option; return { ok: true, state: next };
    }
    case 'buy': {
      if (s.paused) return fail('PAUSED', 'The game is paused.'); if (s.phase !== 'route_choice') return fail('WRONG_PHASE', 'Perks can be bought between legs, while the route board is open.');
      if (!s.perks.includes(a.perk)) return fail('NOT_OFFERED', 'Your teacher turned that perk off.');
      if (hasPerk(team, a.perk, s.leg)) return fail('ALREADY_OWNED', 'Your team already has that perk for this leg.');
      if (team.perks.filter((p) => p.leg === s.leg).length >= MAX_ACTIVE_PERKS) return fail('PERK_LIMIT', `At most ${MAX_ACTIVE_PERKS} perks per leg.`);
      const price = PERK_COST[a.perk]; if (team.wallet < price) return fail('INSUFFICIENT_POINTS', `That costs ${price} points; your team has ${team.wallet}.`);
      team.wallet -= price; team.spent += price; team.perks.push({ id: a.perk, leg: s.leg }); next.log = [...next.log.slice(-39), `buy:${team.id}:${a.perk}`]; return { ok: true, state: next };
    }
    case 'ability': return castAbility(next, me, team);
    case 'pass': { const r = passFlag(next, me); return r.ok ? { ok: true, state: next, note: 'Passed' } : fail(r.code!, r.message!); }
    case 'inspect': {
      if (s.paused) return fail('PAUSED', 'The game is paused.'); const r = tryStamp(next, me, a.siteId);
      return r.ok ? { ok: true, state: next, note: r.right ? 'Stamped' : 'Wrong stamp — it rests for a moment' } : fail(r.code!, r.message!);
    }
  }
}
function castAbility(s: CRState, me: SeatRec, team: TeamRec): Attempt<CRState> {
  const live = s.live; if (s.phase !== 'race' || !live) return fail('WRONG_PHASE', 'Abilities work while the race is live.');
  if (s.paused) return fail('PAUSED', 'The game is paused.'); if (isIdle(live, me)) return fail('AWAY', 'Move to come back into the round.');
  if (team.obj.done) return fail('DONE', 'Your team already finished this leg.');
  const t = live.tick; if (t < me.abilityReadyTick) return fail('COOLDOWN', `Ready in ${Math.ceil(((me.abilityReadyTick - t) * TICK_MS) / 1000)} s.`);
  if (t < team.burstReadyTick) return fail('TEAM_BURST', `A teammate just used an ability. Ready in ${Math.ceil(((team.burstReadyTick - t) * TICK_MS) / 1000)} s.`);
  const g = geoOf(s); let note = ''; const keep = (k: 'pulse' | 'sight' | 'fold' | 'beacon', ticks: number, x?: number, y?: number) => { team.cues = [...team.cues.filter((c) => c.kind !== k), { kind: k, seatId: me.id, until: t + ticks, ...(x !== undefined ? { x: Math.round(x), y: Math.round(y!) } : {}) }]; };
  switch (me.role) {
    case 'solo_pathfinder': keep('pulse', ABILITY.pulse); note = 'Compass Pulse'; break;
    case 'scout': keep('sight', ABILITY.sight); note = 'Sightline'; break;
    case 'signal_keeper': keep('beacon', ABILITY.beacon, me.x, me.y); note = 'Rally Light'; break;
    case 'cartographer': keep('fold', ABILITY.fold); note = 'Map Fold'; break;
    case 'trail_maker': {
      if (!g.bridge) return fail('NO_BRIDGE', 'This leg has no bridge socket.'); if (team.bridgeUntil > t) return fail('ALREADY_OPEN', 'The bridge is already open.');
      if (dist(g.bridge.socket, me) > BRIDGE_RANGE) return fail('NO_SOCKET', 'Stand near the glowing bridge socket to unroll a bridge.');
      team.bridgeUntil = t + ABILITY.bridge; pushFx(live, 'bridge', g.bridge.socket.x, g.bridge.socket.y, team.id); note = 'Bridge Strip'; break;
    }
    case 'archivist': {
      const rev = Math.min(s.revealedLegs, s.evidence.length) - 1; if (rev < 0) return fail('NO_CLUE', 'No clue has been revealed yet.'); team.pinned = String(rev); note = 'Evidence Shelf'; break;
    }
  }
  const cd = Math.round(ROLE_COOLDOWN[me.role] * (hasPerk(team, 'extra_signal', live.leg) ? 0.75 : 1)); me.abilityReadyTick = t + cd; team.burstReadyTick = t + TEAM_BURST_TICKS;
  if (me.role !== 'trail_maker') pushFx(live, me.role === 'scout' ? 'sight' : me.role === 'cartographer' ? 'fold' : me.role === 'signal_keeper' ? 'beacon' : me.role === 'archivist' ? 'inspect' : 'pulse', me.x, me.y, team.id);
  return { ok: true, state: s, note };
}

// ── host controls ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const shiftTimes = (s: CRState, by: number) => { if (s.phaseDeadlineMs !== null) s.phaseDeadlineMs += by; s.phaseStartedMs += by; if (s.question) { s.question.openedAtMs += by; s.question.deadlineMs += by; } };
export function reduceHost(s: CRState, a: HostAction, now: number, pool: readonly PoolEntry[] = []): { result: Attempt<CRState>; effects: RoomEffect[] } {
  const effects: RoomEffect[] = []; const next = clone(s); const no = (code: string, message: string) => ({ result: fail(code, message), effects: [] as RoomEffect[] });
  switch (a.kind) {
    case 'start': {
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'The match already started.');
      if (s.teams.filter((t) => activeSeats(s, t.id).length > 0).length < 2) return no('NEED_TWO_TEAMS', 'Clue Racing needs at least two teams with a player each. Use Practice to try it alone.');
      if (!s.plan.positions.length) return no('NO_QUESTIONS', 'This quiz has no questions for the match. Add questions first.');
      reconcileRoles(next); next.startedAtMs = now; next.locked = false; next.phase = 'countdown'; next.phaseStartedMs = now; next.phaseDeadlineMs = now + s.plan.countdownSeconds * 1000; effects.push({ type: 'start' });
      for (const t of next.teams) { const g0 = geoOf(next, 0); activeSeats(next, t.id).forEach((m, i) => { const n = activeSeats(next, t.id).length; const ang = (i / n) * Math.PI * 2 + 0.6; const r = n <= 1 ? 0 : 54; m.x = Math.round(g0.hubA.x + Math.cos(ang) * r); m.y = Math.round(g0.hubA.y + Math.sin(ang) * r); }); }
      break;
    }
    case 'pause': { if (s.paused || s.phase === 'lobby' || s.phase === 'finished') return no('WRONG_PHASE', 'Nothing to pause.'); if (next.live) next.live.anchorTick = next.live.tick; next.paused = true; next.pausedAtMs = now; effects.push({ type: 'pause' }); break; }
    case 'resume': { if (!s.paused || s.pausedAtMs === null) return no('WRONG_PHASE', 'The match is not paused.'); shiftTimes(next, now - s.pausedAtMs); if (next.live) { next.live.anchorMs = now; next.live.anchorTick = next.live.tick; } next.paused = false; next.pausedAtMs = null; effects.push({ type: 'resume' }); break; }
    case 'lock': next.locked = a.locked; break;
    case 'end': { if (s.phase === 'finished') return no('WRONG_PHASE', 'The match is already over.'); const st = standingsOf(next); next.phase = 'finished'; next.phaseDeadlineMs = null; next.paused = false; next.pausedAtMs = null; next.finish = { reason: 'host_ended', at: now, standings: st.standings, tieNote: st.tieNote }; effects.push({ type: 'end' }); break; }
    case 'skip': {
      if (s.paused) return no('PAUSED', 'Resume the match first.'); if (!['countdown', 'race', 'checkpoint', 'barrier', 'reveal', 'route_choice'].includes(s.phase)) return no('WRONG_PHASE', 'There is nothing to skip right now.');
      if (s.phase === 'race' && next.live) next.live.endTick = Math.min(next.live.endTick, Math.max(next.live.tick, worldTarget(s, now))); else next.phaseDeadlineMs = now;
      if (s.phase === 'barrier' && next.question) next.question.deadlineMs = Math.min(next.question.deadlineMs, now); next.log = [...next.log.slice(-39), `skip:${s.phase}`]; break;
    }
    case 'extend': {
      if (s.phase === 'finished' || s.phase === 'lobby') return no('WRONG_PHASE', 'Extend while the match is running.'); if (s.extended >= 4) return no('EXTEND_LIMIT', 'You can extend at most four times.');
      if (s.phase === 'race' && next.live) next.live.endTick += 600; else if (next.phaseDeadlineMs !== null) { next.phaseDeadlineMs += 30000; if (next.question) next.question.deadlineMs += 30000; }
      next.extended += 1; next.log = [...next.log.slice(-39), 'extend']; break;
    }
    case 'kick': { const seat = next.seats.find((x) => x.id === a.seatId); if (!seat) return no('NO_SEAT', 'That student is not in this room.'); seat.revoked = true; if (next.phase === 'lobby') reconcileRoles(next); effects.push({ type: 'kick', seatId: a.seatId }); break; }
    case 'move_seat': {
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'Teams can only change in the lobby.'); const seat = next.seats.find((x) => x.id === a.seatId && !x.revoked); if (!seat) return no('NO_SEAT', 'That student is not in this room.');
      if (!next.teams.some((t) => t.id === a.teamId)) return no('NO_TEAM', 'Unknown team.'); if (activeSeats(next, a.teamId).filter((x) => x.id !== a.seatId).length >= capOf(s)) return no('TEAM_FULL', 'That team is full.');
      seat.teamId = a.teamId; seat.role = 'solo_pathfinder'; reconcileRoles(next); break;
    }
  }
  void pool; return { result: { ok: true, state: next }, effects };
}

// ── lazy advancement ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type AdvanceCtx = { now: number; pool: readonly PoolEntry[]; answers: readonly CommittedAnswer[]; timelines: Timelines };
export type Advance = { state: CRState; changed: boolean; effects: RoomEffect[]; credits: Credit[] };
function openWindow(next: CRState, at: number, window: number, pool: readonly PoolEntry[], effects: RoomEffect[]) {
  const position = next.plan.positions[window]; const entry = position === undefined ? undefined : pool.find((p) => p.position === position);
  const secs = questionSeconds(entry?.kind ?? 'multiple_choice', next.lowPressure, next.readAloud); const eligible: Record<string, string[]> = {};
  for (const t of next.teams) eligible[t.id] = activeSeats(next, t.id).map((x) => x.id);
  next.phase = 'barrier'; next.phaseStartedMs = at; next.phaseDeadlineMs = at + secs * 1000;
  for (const x of next.seats) { x.ix = 0; x.iy = 0; }
  next.question = { window, position: position ?? -1, questionId: entry?.id ?? null, openedAtMs: at, deadlineMs: at + secs * 1000, eligible, settled: false, skipped: !entry };
  if (entry) { if (!next.usedPositions.includes(position!)) next.usedPositions.push(position!); effects.push({ type: 'open', position: position! }); } else { next.phaseDeadlineMs = at; next.question.deadlineMs = at; }
}
function settle(next: CRState, ctx: AdvanceCtx, closeAt: number, credits: Credit[], effects: RoomEffect[]) {
  const q = next.question!;
  for (const t of next.teams) {
    const key = `w:${q.window}:${t.id}`; if (next.credited.includes(key)) continue; const elig = q.eligible[t.id] ?? [];
    const subs = ctx.answers.filter((x) => elig.includes(x.seatId)); const sum = subs.reduce((n, x) => n + (x.correct ? 1000 : Math.max(0, Math.min(999, x.awardedFraction))), 0);
    const mean = elig.length && !q.skipped ? sum / elig.length : 0; const award = Math.round((mean / 1000) * WINDOW_CREDIT_CAP);
    const room = Math.max(0, WALLET_CAP - t.wallet); const take = Math.min(room, award); t.wallet += take; t.overflow += award - take; t.earned += award; t.awards.push(award);
    if (!q.skipped) { t.masteryTotal += Math.round(mean); t.masteryOf += 1; }
    next.credited.push(key); credits.push({ key, teamId: t.id, amount: take, submissionIds: subs.map((x) => x.id) });
  }
  q.settled = true; next.revealedLegs = Math.min(next.evidence.length, q.window + 2);
  next.phase = 'reveal'; next.phaseStartedMs = closeAt; next.phaseDeadlineMs = closeAt + next.plan.revealSeconds * 1000; effects.push({ type: 'reveal' });
}
/** Advance every due transition (and the live world) up to `ctx.now`. Idempotent: calling it twice changes nothing the second time. */
export function advance(state: CRState, ctx: AdvanceCtx): Advance {
  let s = state; const effects: RoomEffect[] = []; const credits: Credit[] = []; let changed = false;
  for (let guard = 0; guard < 24; guard++) {
    if (s.paused || s.phase === 'lobby' || s.phase === 'finished') break;
    const next = clone(s); let moved = false; const due = s.phaseDeadlineMs !== null && ctx.now >= s.phaseDeadlineMs; const at = s.phaseDeadlineMs ?? ctx.now;
    if (s.phase === 'countdown') { if (due) { startLeg(next, 0, at); next.phase = 'race'; next.phaseStartedMs = at; next.phaseDeadlineMs = null; moved = true; } }
    else if (s.phase === 'race') {
      const l = s.live!; const target = worldTarget(s, ctx.now); if (target > l.tick) { simulate(next, target, ctx.timelines); moved = true; }
      if (next.live!.tick >= next.live!.endTick) {
        const end = next.live!.endTick; const when = l.anchorMs + (end - l.anchorTick) * TICK_MS; if (!allDone(next)) assistRemaining(next);
        next.tick = next.live!.tick; next.phase = 'checkpoint'; next.phaseStartedMs = when; next.phaseDeadlineMs = when + s.plan.checkpointSeconds * 1000; for (const x of next.seats) { x.ix = 0; x.iy = 0; } moved = true;
      }
    } else if (s.phase === 'checkpoint') {
      if (due) { if (s.leg >= s.plan.windows) { const st = standingsOf(next); next.phase = 'finished'; next.phaseDeadlineMs = null; next.phaseStartedMs = at; next.finish = { reason: 'completed', at, standings: st.standings, tieNote: st.tieNote }; effects.push({ type: 'end' }); } else openWindow(next, at, s.leg, ctx.pool, effects); moved = true; }
    } else if (s.phase === 'barrier') {
      const q = s.question!; const everyone = Object.values(q.eligible).flat(); const answered = new Set(ctx.answers.map((x) => x.seatId)); const allIn = !q.skipped && everyone.length > 0 && everyone.every((id) => answered.has(id)); const expired = ctx.now >= q.deadlineMs;
      if (expired || allIn || due) { settle(next, ctx, expired ? q.deadlineMs : ctx.now, credits, effects); moved = true; }
    } else if (s.phase === 'reveal') {
      if (due) { next.leg = s.leg + 1; for (const t of next.teams) { t.obj = emptyObj(); t.cues = []; t.bridgeUntil = 0; t.pinned = null; } next.phase = 'route_choice'; next.phaseStartedMs = at; next.phaseDeadlineMs = at + s.plan.decisionSeconds * 1000; moved = true; }
    } else if (s.phase === 'route_choice') {
      if (due) { startLeg(next, s.leg, at); next.phase = 'race'; next.phaseStartedMs = at; next.phaseDeadlineMs = null; moved = true; }
    }
    if (!moved) break; s = next; changed = true;
  }
  return { state: s, changed, effects, credits };
}

// ── standings ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Score (0–1000) = 60% quiz mastery + 25% route + 15% teamwork. Speed is never a factor; an assisted leg counts half for route and nothing for teamwork. */
export function standingsOf(s: CRState): { standings: Standing[]; tieNote: string | null } {
  const legs = Math.max(1, s.plan.legs); const rows = s.teams.map((t) => {
    const mastery = t.masteryOf ? Math.round(t.masteryTotal / t.masteryOf) : 0; const route = Math.max(0, Math.min(1000, Math.round(((t.legsDone - 0.5 * t.legsAssisted) * 1000) / legs)));
    const teamwork = t.coopTarget ? Math.max(0, Math.min(1000, Math.round((t.coopTotal * 1000) / t.coopTarget))) : 0;
    return { teamId: t.id, score: Math.round(0.6 * mastery + 0.25 * route + 0.15 * teamwork), mastery, route, teamwork, correctSites: t.correctSites, retries: t.retries, spent: t.spent, players: activeSeats(s, t.id).length };
  });
  rows.sort((a, b) => b.score - a.score || b.mastery - a.mastery || b.route - a.route || b.teamwork - a.teamwork || (a.teamId < b.teamId ? -1 : 1));
  const standings: Standing[] = []; let rank = 0; let tieNote: string | null = null;
  rows.forEach((r, i) => { const p = rows[i - 1]; const same = !!p && p.score === r.score && p.mastery === r.mastery && p.route === r.route && p.teamwork === r.teamwork; if (!same) rank = i + 1; standings.push({ ...r, rank, tied: false }); });
  for (const x of standings) x.tied = standings.filter((y) => y.rank === x.rank).length > 1;
  const tops = standings.filter((x) => x.rank === 1); if (tops.length > 1) tieNote = `Tie for first: ${tops.length} teams have the same score, mastery, route and teamwork. No random winner is picked.`;
  return { standings, tieNote };
}
export const seatOf = (s: CRState, id: string) => s.seats.find((x) => x.id === id);
export { activeIn };
