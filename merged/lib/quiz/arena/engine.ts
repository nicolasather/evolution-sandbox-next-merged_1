/** Arena Clash engine: the match as a pure state machine. Phases: lobby → question_open → reveal → planning → arena_live → episode_result → (next question | finished).
 *  Every transition is due at an exact planned instant (never "whenever a client asked"), the world only runs inside arena_live, and the quiz break freezes everything. */
import { barrierSecondsFor } from '../os/plan';
import {
  ABILITY_TICKS, BRIDGE_RANGE, HANDOFF_R, HELPER_COST, MAX_SEATS_PER_ROOM, MAX_SEATS_PER_TEAM, QUESTION_POINTS, RULES_VERSION, ROLE_COOLDOWN, SHELTER_RANGE, TICK_MS, WEIGHTS, ZONE_R,
} from './balance';
import type {
  ArenaConfig, ArenaState, Attempt, CommittedAnswer, Credit, EpisodeResult, HostAction, IntentEntry, LiveRec, PoolEntry, RoomEffect, SeatAction, SeatRec, Standing, TeamRec,
} from './domain';
import { PROTOCOL, ROLES } from './domain';
import { nearestGate } from './maps';
import { pickPositions, type ArenaPlan } from './plan';
import { geoOf, isIdle, pushFx, simulate, slotOf, spawnFor, startEpisode, type Timelines } from './sim';

export { RULES_VERSION };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });
const clampCap = (n: unknown) => Math.max(1, Math.min(MAX_SEATS_PER_TEAM, Number.isFinite(Number(n)) ? Math.floor(Number(n)) : MAX_SEATS_PER_TEAM));

export function createSession(cfg: ArenaConfig, plan: ArenaPlan, pool: readonly PoolEntry[], teamIds: readonly string[], now: number): ArenaState {
  const positions = pickPositions(pool, plan.cycles);
  const teams: TeamRec[] = teamIds.slice(0, cfg.teamCount).map((id, i) => ({ id, name: cfg.teamNames[i] ?? `Team ${i + 1}`, slot: i, wallet: 0, earned: 0, spent: 0, mastery: 0, masteryOf: 0, objective: 0, epObjective: 0, pulses: 0, captures: 0, handins: 0, deposited: 0, boost: null, boughtInPlanning: false, scanUntil: 0, awards: [] }));
  const { questionsAvailable: _a, reviewCycle: _r, notes: _n, estimatedMinutes: _e, wanted: _w, quizShare: _q, ...rec } = plan; void [_a, _r, _n, _e, _w, _q];
  return {
    rulesVersion: RULES_VERSION, protocol: PROTOCOL, phase: 'lobby', format: cfg.format, mapId: cfg.mapId, locked: false, paused: false, pausedAtMs: null, tick: 0, cycle: 0, phaseDeadlineMs: null, phaseStartedMs: now,
    seats: [], teams, plan: { ...rec, cycles: positions.length, positions }, question: null, live: null, credited: [], usedPositions: [], startedAtMs: null, finish: null, log: [], lastResult: null,
    teamSizeCap: clampCap(cfg.teamSizeCap), weighting: cfg.weighting, lowPressure: !!cfg.lowPressure, readAloud: !!cfg.readAloud, helpers: [...cfg.helpers], teamCount: cfg.teamCount, seed: cfg.seed,
  };
}
/** Trusted room settings are mirrored from the stored config on every load, so a stale or tampered state can never widen a limit. */
export function hydrateConfig(s: ArenaState, cfg: Pick<ArenaConfig, 'teamSizeCap' | 'lowPressure' | 'readAloud' | 'weighting' | 'helpers' | 'seed'>): ArenaState {
  return { ...s, teamSizeCap: clampCap(cfg.teamSizeCap), lowPressure: !!cfg.lowPressure, readAloud: !!cfg.readAloud, weighting: cfg.weighting, helpers: [...cfg.helpers], seed: cfg.seed };
}
/** AC-03: a team of one always plays the Runner. Applied at once in the lobby (after a kick or a move). Mid-match the policy is explicit: a player who loses their teammates KEEPS the role they
 *  already hold until the match ends, so a cooldown or pending ability is never silently revoked. Returns the names of seats whose role changed. */
export function reconcileSolo(s: ArenaState): string[] {
  const changed: string[] = [];
  for (const t of s.teams) {
    const mates = activeSeats(s, t.id).sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    if (mates.length === 1) { if (mates[0]!.role !== 'runner') { mates[0]!.role = 'runner'; mates[0]!.ready = false; changed.push(mates[0]!.id); } continue; }
    // Distinct roles inside a team (lobby only): the earliest joiner keeps a contested role, later duplicates take the first free one. Mid-match nobody's role is revoked.
    if (s.phase !== 'lobby') continue;
    const used = new Set<string>(); const dups = [];
    for (const m of mates) { if (used.has(m.role)) dups.push(m); else used.add(m.role); }
    for (const m of dups) { const free = ROLES.find((r) => !used.has(r)); if (free) { m.role = free; m.ready = false; used.add(free); changed.push(m.id); } }
  }
  return changed;
}
export const capOf = (s: ArenaState) => clampCap(s.teamSizeCap);
export const activeSeats = (s: ArenaState, teamId?: string) => s.seats.filter((x) => !x.revoked && (!teamId || x.teamId === teamId));
export const quizWeight = (s: ArenaState) => Math.max(0.5, WEIGHTS[s.weighting] ?? 0.6);

// ── time ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The world tick the match should have reached at `now` (only moves during arena_live, never past the planned end of the episode). */
export function worldTarget(s: ArenaState, now: number): number {
  const l = s.live; if (!l) return s.tick; if (s.phase !== 'arena_live' || s.paused) return l.tick;
  return Math.min(l.endTick, l.anchorTick + Math.max(0, Math.floor((now - l.anchorMs) / TICK_MS)));
}

// ── seats ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function addSeat(s: ArenaState, seatId: string, name: string, now: number, desiredTeam: string | null): Attempt<ArenaState> {
  if (s.phase === 'finished') return fail('FINISHED', 'The match is over.');
  if (s.locked) return fail('LOCKED', 'The teacher has closed this room to new players.');
  if (s.seats.some((x) => x.id === seatId)) return { ok: true, state: s };
  if (activeSeats(s).length >= MAX_SEATS_PER_ROOM) return fail('ROOM_FULL', 'This room already has 20 players.');
  const cap = capOf(s); const counts = new Map(s.teams.map((t) => [t.id, activeSeats(s, t.id).length]));
  let team = desiredTeam && counts.has(desiredTeam) && (counts.get(desiredTeam) ?? 0) < cap ? desiredTeam : null;
  if (!team) { const open = s.teams.filter((t) => (counts.get(t.id) ?? 0) < cap).sort((a, b) => (counts.get(a.id)! - counts.get(b.id)!) || a.id.localeCompare(b.id)); team = open[0]?.id ?? null; }
  if (!team) return fail('TEAM_FULL', 'Every team is full.');
  const next = clone(s); const mates = activeSeats(next, team).length;
  const seat: SeatRec = { id: seatId, name, teamId: team, role: ROLES.find((r) => !activeSeats(next, team!).some((x) => x.role === r)) ?? ROLES[mates % ROLES.length]!, ready: false, revoked: false, joinedAt: now, x: 0, y: 0, ix: 0, iy: 0, seq: 0, seenTick: next.live?.tick ?? next.tick, abilityReadyTick: next.live?.tick ?? 0, carrying: 0, carryValue: 0, banner: false, dashUntil: 0, captures: 0, pulses: 0, deposits: 0, handins: 0, assists: 0 };
  next.seats.push(seat); const sp = spawnFor(next, seat, next.live?.episode ?? 0); seat.x = sp.x; seat.y = sp.y; return { ok: true, state: next };
}

export function reduceSeat(s: ArenaState, seatId: string, a: SeatAction): Attempt<ArenaState> {
  const seat = s.seats.find((x) => x.id === seatId && !x.revoked); if (!seat) return fail('NO_SEAT', 'You are not in this match.');
  if (s.phase === 'finished') return fail('FINISHED', 'The match is over.');
  const next = clone(s); const me = next.seats.find((x) => x.id === seatId)!; const team = next.teams.find((t) => t.id === me.teamId)!;
  switch (a.kind) {
    case 'role': if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'Roles are chosen in the lobby.'); if (!ROLES.includes(a.role)) return fail('BAD_ROLE', 'Unknown role.'); if (activeSeats(s, me.teamId).length === 1 && a.role !== 'runner') return fail('SOLO_ROLE', 'A team of one plays the Runner. More teammates unlock the other four roles.'); if (activeSeats(s, me.teamId).some((x) => x.id !== seatId && x.role === a.role)) return fail('ROLE_TAKEN', 'A teammate already has that role.'); me.role = a.role; me.ready = false; return { ok: true, state: next };
    case 'ready': if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'The match already started.'); me.ready = a.ready; return { ok: true, state: next };
    case 'rename': if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'Names change in the lobby.'); me.name = a.name; return { ok: true, state: next };
    case 'buy': {
      if (s.paused) return fail('PAUSED', 'The game is paused.');
      if (s.phase !== 'planning') return fail('WRONG_PHASE', 'Helpers can be bought between rounds, while the planning board is open.');
      if (!s.helpers.includes(a.helper)) return fail('NOT_OFFERED', 'Your teacher turned that helper off.');
      if (team.boughtInPlanning) return fail('ONE_PER_ROUND', 'Your team already chose a helper this round.');
      const price = HELPER_COST[a.helper]; if (team.wallet < price) return fail('INSUFFICIENT_POINTS', `That costs ${price} points; your team has ${team.wallet}.`);
      team.wallet -= price; team.spent += price; team.boughtInPlanning = true; team.boost = { kind: a.helper, episode: next.cycle }; next.log = [...next.log.slice(-39), `buy:${team.id}:${a.helper}`]; return { ok: true, state: next };
    }
    case 'ability': return castAbility(next, me, team);
    case 'pass': return passBanner(next, me);
  }
}
function castAbility(s: ArenaState, me: SeatRec, team: TeamRec): Attempt<ArenaState> {
  const live = s.live; if (s.phase !== 'arena_live' || !live) return fail('WRONG_PHASE', 'Abilities work while the arena is live.');
  if (s.paused) return fail('PAUSED', 'The game is paused.');
  if (isIdle(live, me)) return fail('AWAY', 'Move to come back into the round.');
  if (live.tick < me.abilityReadyTick) return fail('COOLDOWN', `Ready in ${Math.ceil(((me.abilityReadyTick - live.tick) * TICK_MS) / 1000)} s.`);
  const geo = geoOf(s); const t = live.tick; let note = '';
  switch (me.role) {
    case 'runner':
      if (me.banner) return fail('CARRYING', 'Dash Trail cannot speed up the banner. Pass it to a teammate first.');
      me.dashUntil = t + ABILITY_TICKS.dash; note = 'Dash Trail'; break;
    case 'sentinel': {
      let zone: string | null = null; let fx = me.x, fy = me.y;
      if (s.format === 'control') {
        const near = live.active.map((i) => live.zones[i]!).filter((z) => Math.hypot(z.x - me.x, z.y - me.y) <= ZONE_R + SHELTER_RANGE).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
        if (!near) return fail('NO_ZONE', 'Stand near a live zone to plant the Shelter Flag.'); zone = near.id; fx = near.x; fy = near.y;
      }
      live.flags = [...live.flags.filter((f) => f.teamId !== me.teamId), { teamId: me.teamId, zone, x: Math.round(fx), y: Math.round(fy), until: t + ABILITY_TICKS.shelter }]; note = 'Shelter Flag'; break;
    }
    case 'builder': {
      const gate = nearestGate(geo, me.x, me.y, BRIDGE_RANGE); if (!gate) return fail('NO_GATE', 'Stand near a marked shortcut to build a bridge.');
      if (live.bridges.some((b) => b.gate === gate.id)) return fail('ALREADY_OPEN', 'That bridge is already open.');
      live.bridges = [...live.bridges, { gate: gate.id, until: t + ABILITY_TICKS.bridge, teamId: me.teamId }]; pushFx(live, 'bridge', gate.x, gate.y, me.teamId); note = 'Quick Bridge'; break;
    }
    case 'trickster': live.decoys = [...live.decoys.filter((d) => d.teamId !== me.teamId), { teamId: me.teamId, x: Math.round(me.x), y: Math.round(me.y), until: t + ABILITY_TICKS.decoy }]; note = 'Decoy Beacon'; break;
    case 'navigator': team.scanUntil = t + ABILITY_TICKS.scan; note = 'Route Scan'; break;
  }
  me.abilityReadyTick = t + ROLE_COOLDOWN[me.role]; pushFx(live, 'ability', me.x, me.y, me.teamId); return { ok: true, state: s, note };
}
function passBanner(s: ArenaState, me: SeatRec): Attempt<ArenaState> {
  const live = s.live; if (s.phase !== 'arena_live' || !live || s.format !== 'relay') return fail('WRONG_PHASE', 'There is no banner to pass right now.');
  if (s.paused) return fail('PAUSED', 'The game is paused.'); if (!me.banner || live.banner?.carrier !== me.id) return fail('NO_BANNER', 'You are not carrying the banner.');
  const mate = s.seats.filter((x) => !x.revoked && x.teamId === me.teamId && x.id !== me.id && !isIdle(live, x) && Math.hypot(x.x - me.x, x.y - me.y) <= HANDOFF_R).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y) || (a.id < b.id ? -1 : 1))[0];
  if (!mate) return fail('NO_TEAMMATE', 'A teammate has to be right next to you to take the banner.');
  me.banner = false; mate.banner = true; mate.assists++; live.banner = { ...live.banner!, carrier: mate.id }; return { ok: true, state: s, note: 'Passed' };
}

// ── host controls ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function reduceHost(s: ArenaState, a: HostAction, now: number, pool: readonly PoolEntry[] = []): { result: Attempt<ArenaState>; effects: RoomEffect[] } {
  const effects: RoomEffect[] = []; const next = clone(s);
  const no = (code: string, message: string) => ({ result: fail(code, message), effects: [] as RoomEffect[] });
  switch (a.kind) {
    case 'start': {
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'The match already started.');
      const occupied = s.teams.filter((t) => activeSeats(s, t.id).length > 0).length;
      if (occupied < 2) return no('NEED_TWO_TEAMS', 'Arena Clash needs at least two teams with a player each. Use Practice to try it alone.');
      if (!s.plan.positions.length) return no('NO_QUESTIONS', 'This quiz has no questions for the match. Add questions first.');
      next.startedAtMs = now; next.locked = false; effects.push({ type: 'start' }); openQuestion(next, now, 0, pool, effects); break;
    }
    case 'pause': {
      if (s.paused || s.phase === 'lobby' || s.phase === 'finished') return no('WRONG_PHASE', 'Nothing to pause.');
      if (next.live) next.live.anchorTick = next.live.tick; // freeze exactly what was accepted before the pause
      next.paused = true; next.pausedAtMs = now; effects.push({ type: 'pause' }); break;
    }
    case 'resume': {
      if (!s.paused || s.pausedAtMs === null) return no('WRONG_PHASE', 'The match is not paused.');
      const shift = now - s.pausedAtMs; shiftTimes(next, shift); if (next.live) { next.live.anchorMs = now; next.live.anchorTick = next.live.tick; } next.paused = false; next.pausedAtMs = null; effects.push({ type: 'resume' }); break;
    }
    case 'lock': next.locked = a.locked; break;
    case 'end': {
      if (s.phase === 'finished') return no('WRONG_PHASE', 'The match is already over.');
      next.phase = 'finished'; next.phaseDeadlineMs = null; next.paused = false; next.pausedAtMs = null; next.finish = { reason: 'host_ended', at: now, standings: standingsOf(next).standings, tieNote: standingsOf(next).tieNote }; effects.push({ type: 'end' }); break;
    }
    case 'skip': {
      if (s.paused) return no('PAUSED', 'Resume the match first.');
      if (!['question_open', 'reveal', 'planning', 'arena_live', 'episode_result'].includes(s.phase)) return no('WRONG_PHASE', 'There is nothing to skip right now.');
      if (s.phase === 'arena_live' && next.live) next.live.endTick = Math.min(next.live.endTick, Math.max(next.live.tick, worldTarget(s, now))); else next.phaseDeadlineMs = now;
      if (s.phase === 'question_open' && next.question) next.question.deadlineMs = Math.min(next.question.deadlineMs, now); next.log = [...next.log.slice(-39), `skip:${s.phase}`]; break;
    }
    case 'extend': {
      if (s.phase === 'finished' || s.phase === 'lobby') return no('WRONG_PHASE', 'Extend while the match is running.');
      const used = new Set([...s.plan.positions]); const more = pickPositions(pool.filter((p) => !used.has(p.position)), 1);
      if (!more.length) return no('NO_MORE_QUESTIONS', 'The quiz has no more unused questions. End the match or add questions.');
      next.plan.positions = [...next.plan.positions, ...more]; next.plan.cycles = next.plan.positions.length; next.log = [...next.log.slice(-39), 'extend']; break;
    }
    case 'kick': {
      const seat = next.seats.find((x) => x.id === a.seatId); if (!seat) return no('NO_SEAT', 'That student is not in this room.');
      seat.revoked = true; if (next.phase === 'lobby') reconcileSolo(next); if (next.live) { if (seat.banner && next.live.banner?.carrier === seat.id) next.live.banner = { ...next.live.banner, carrier: null, teamId: null, cp: 0, droppedAt: next.live.tick, blockedUntil: next.live.tick }; seat.banner = false; seat.carrying = 0; seat.carryValue = 0; } effects.push({ type: 'kick', seatId: a.seatId }); break;
    }
    case 'move_seat': {
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'Teams can only change in the lobby.');
      const seat = next.seats.find((x) => x.id === a.seatId && !x.revoked); if (!seat) return no('NO_SEAT', 'That student is not in this room.');
      if (!next.teams.some((t) => t.id === a.teamId)) return no('NO_TEAM', 'Unknown team.');
      if (activeSeats(next, a.teamId).filter((x) => x.id !== a.seatId).length >= capOf(s)) return no('TEAM_FULL', 'That team is full.');
      seat.teamId = a.teamId; reconcileSolo(next); for (const x of next.seats.filter((q) => !q.revoked)) { const sp = spawnFor(next, x, 0); x.x = sp.x; x.y = sp.y; } break;
    }
  }
  return { result: { ok: true, state: next }, effects };
}
function shiftTimes(s: ArenaState, by: number) {
  if (s.phaseDeadlineMs !== null) s.phaseDeadlineMs += by; s.phaseStartedMs += by;
  if (s.question) { s.question.openedAtMs += by; s.question.deadlineMs += by; }
}

// ── lazy advancement ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type AdvanceCtx = { now: number; pool: readonly PoolEntry[]; answers: readonly CommittedAnswer[]; timelines: Timelines };
export type Advance = { state: ArenaState; changed: boolean; effects: RoomEffect[]; credits: Credit[] };
function openQuestion(next: ArenaState, at: number, cycle: number, pool: readonly PoolEntry[], effects: RoomEffect[]) {
  const position = next.plan.positions[cycle]; const entry = position === undefined ? undefined : pool.find((p) => p.position === position);
  const secs = barrierSecondsFor(entry?.kind ?? 'multiple_choice', !!next.readAloud, !!next.lowPressure);
  const eligible: Record<string, string[]> = {}; for (const t of next.teams) eligible[t.id] = activeSeats(next, t.id).map((x) => x.id);
  next.cycle = cycle; next.phase = 'question_open'; next.phaseStartedMs = at; next.phaseDeadlineMs = at + secs * 1000; next.live = next.live ? { ...next.live, fx: [] } : null;
  for (const x of next.seats) { x.ix = 0; x.iy = 0; } // no queued movement leaks across the freeze
  next.question = { cycle, position: position ?? -1, questionId: entry?.id ?? null, openedAtMs: at, deadlineMs: at + secs * 1000, eligible, settled: false };
  if (position !== undefined && !next.usedPositions.includes(position)) next.usedPositions.push(position);
  if (position !== undefined) effects.push({ type: 'open', position });
}
/** Advance every due transition (and the live world) up to `ctx.now`. Idempotent: calling it twice changes nothing the second time. */
export function advance(state: ArenaState, ctx: AdvanceCtx): Advance {
  let s = state; const effects: RoomEffect[] = []; const credits: Credit[] = []; let changed = false;
  for (let guard = 0; guard < 16; guard++) {
    if (s.paused || s.phase === 'lobby' || s.phase === 'finished') break;
    const next = clone(s); let moved = false; const due = s.phaseDeadlineMs !== null && ctx.now >= s.phaseDeadlineMs;
    if (s.phase === 'question_open') {
      const q = s.question!; const everyone = Object.values(q.eligible).flat(); const answered = new Set(ctx.answers.map((x) => x.seatId));
      const allIn = everyone.length > 0 && everyone.every((id) => answered.has(id)); const expired = ctx.now >= q.deadlineMs;
      if (expired || allIn || due) {
        const closeAt = expired ? q.deadlineMs : ctx.now;
        for (const t of next.teams) {
          const elig = q.eligible[t.id] ?? []; const key = `q:${q.cycle}:${t.id}`; if (next.credited.includes(key)) continue;
          const subs = ctx.answers.filter((x) => elig.includes(x.seatId)); const sum = subs.reduce((n, x) => n + (x.correct ? 1000 : Math.max(0, Math.min(999, x.awardedFraction))), 0);
          const mean = elig.length ? sum / elig.length : 0; const award = Math.round((mean / 1000) * QUESTION_POINTS);
          t.wallet += award; t.earned += award; t.awards.push(award); t.mastery += Math.round(mean); t.masteryOf += 1;
          next.credited.push(key); credits.push({ key, teamId: t.id, amount: award, submissionIds: subs.map((x) => x.id) });
        }
        next.question = { ...q, settled: true }; next.phase = 'reveal'; next.phaseStartedMs = closeAt; next.phaseDeadlineMs = closeAt + s.plan.revealSeconds * 1000; effects.push({ type: 'reveal' }); moved = true;
      }
    } else if (s.phase === 'reveal') {
      if (due) { const at = s.phaseDeadlineMs!; next.phase = 'planning'; next.phaseStartedMs = at; next.phaseDeadlineMs = at + s.plan.planningSeconds * 1000; for (const t of next.teams) t.boughtInPlanning = false; moved = true; }
    } else if (s.phase === 'planning') {
      if (due) { const at = s.phaseDeadlineMs!; next.phase = 'arena_live'; next.phaseStartedMs = at; next.phaseDeadlineMs = null; startEpisode(next, s.cycle, at); moved = true; }
    } else if (s.phase === 'arena_live') {
      const l = s.live!; const target = worldTarget(s, ctx.now);
      if (target > l.tick) { simulate(next, target, ctx.timelines); moved = true; }
      if (next.live!.tick >= next.live!.endTick) {
        const at = l.anchorMs + (next.live!.endTick - l.anchorTick) * TICK_MS; const res = closeEpisode(next); next.lastResult = res;
        next.tick = next.live!.tick; next.phase = 'episode_result'; next.phaseStartedMs = at; next.phaseDeadlineMs = at + s.plan.resultSeconds * 1000; for (const x of next.seats) { x.ix = 0; x.iy = 0; x.banner = false; x.carrying = 0; x.carryValue = 0; } moved = true;
      }
    } else if (s.phase === 'episode_result') {
      if (due) {
        const at = s.phaseDeadlineMs!;
        if (s.cycle + 1 >= s.plan.cycles) { const st = standingsOf(next); next.phase = 'finished'; next.phaseDeadlineMs = null; next.phaseStartedMs = at; next.finish = { reason: 'completed', at, standings: st.standings, tieNote: st.tieNote }; effects.push({ type: 'end' }); }
        else openQuestion(next, at, s.cycle + 1, ctx.pool, effects);
        moved = true;
      }
    }
    if (!moved) break; s = next; changed = true;
  }
  return { state: s, changed, effects, credits };
}
function closeEpisode(s: ArenaState): EpisodeResult {
  const live = s.live!; const res: EpisodeResult = { episode: live.episode, teams: [] };
  for (const t of s.teams) { t.objective += t.epObjective; res.teams.push({ teamId: t.id, points: t.epObjective, captures: t.captures, pulses: t.pulses, handins: t.handins, deposited: t.deposited }); if (t.boost && t.boost.episode === live.episode) t.boost = null; }
  return res;
}

// ── standings ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Score = quizWeight × quiz accuracy + (1 − quizWeight) × normalised arena points. Both are 0..1000 and independent of team size. Ties are shown as ties. */
export function standingsOf(s: ArenaState): { standings: Standing[]; tieNote: string | null } {
  const w = quizWeight(s); const episodes = Math.max(1, s.plan.cycles); const rows = s.teams.map((t) => {
    const quiz = t.masteryOf ? Math.round(t.mastery / t.masteryOf) : 0; const obj = Math.min(1000, Math.round((t.objective * 1000) / (episodes * 100)));
    return { teamId: t.id, quiz, objective: obj, score: Math.round(w * quiz + (1 - w) * obj), pulses: t.pulses, captures: t.captures, handins: t.handins, deposited: t.deposited, spent: t.spent, players: activeSeats(s, t.id).length };
  });
  rows.sort((a, b) => b.score - a.score || b.quiz - a.quiz || b.pulses - a.pulses || (a.teamId < b.teamId ? -1 : 1));
  const standings: Standing[] = []; let rank = 0; let tieNote: string | null = null;
  rows.forEach((r, i) => { const p = rows[i - 1]; const same = !!p && p.score === r.score && p.quiz === r.quiz && p.pulses === r.pulses; if (!same) rank = i + 1; standings.push({ ...r, rank, tied: false }); });
  for (const x of standings) x.tied = standings.filter((y) => y.rank === x.rank).length > 1;
  const tops = standings.filter((x) => x.rank === 1); if (tops.length > 1) tieNote = `Tie for first: ${tops.length} teams have the same score, quiz accuracy and objective pulses. No random winner is picked.`;
  return { standings, tieNote };
}
export const seatOf = (s: ArenaState, id: string) => s.seats.find((x) => x.id === id);
export { slotOf };
export type { IntentEntry, LiveRec };
