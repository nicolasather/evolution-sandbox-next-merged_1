/** Obstacle Survival — the pure session engine. No I/O, no timers, no randomness: every function maps (state, input) to a new state, so the same code runs in
 *  the serverless request path, in tests and in the offline practice. The server commits whatever comes out through one revision-locked transaction.
 *
 *  World time: a squad's world advances 1 tick per 50 ms of *server* time while the phase is 'traversing', up to the planned freeze tick, and stands still in
 *  every other phase (questions never cost running-world time). Clients cannot choose the time; they can only choose their own inputs for ticks the server has reached. */
import { MAX_POINTS, MAX_SEATS_PER_ROOM, MAX_SEATS_PER_TEAM, PERK_LIMIT, PERKS, RULES_VERSION, TICK_MS, PULSE_TICKS } from './balance';
import type { Attempt, Body, Credit, CommittedAnswer, HostAction, OSConfig, OSState, PoolEntry, Pulse, Role, RoomEffect, SeatAction, SeatRec, TeamRec } from './domain';
import { ROLES } from './domain';
import { barrierSecondsFor, pickPositions, type OSPlan } from './plan';
import { addPoints, barrierPoints, masteryOf, standingsOf, type Sub } from './score';
import type { TeamEffect } from './physics';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const fail = (code: string, message: string): { ok: false; code: string; message: string } => ({ ok: false, code, message });
export { RULES_VERSION };

export function createSession(cfg: OSConfig, plan: OSPlan, pool: readonly PoolEntry[], teamIds: readonly string[], now: number): OSState {
  const positions = pickPositions(pool, plan.chapters);
  const teams: TeamRec[] = teamIds.slice(0, cfg.teamCount).map((id, i) => ({ id, name: cfg.teamNames[i] ?? `Squad ${i + 1}`, points: 0, earned: 0, spent: 0, wasted: 0, mastery: 0, masteryOf: 0, perks: [], pulses: [], assists: 0, chaptersCleared: 0, barrierAwards: [] }));
  const { questionsNeeded: _n, questionsAvailable: _a, reviewCycle: _r, notes: _no, estimatedMinutes: _e, ...rec } = plan; void [_n, _a, _r, _no, _e];
  return {
    rulesVersion: RULES_VERSION, phase: 'lobby', format: cfg.format, locked: false, paused: false, pausedAtMs: null, chapter: 0,
    clock: { running: false, anchorMs: now, anchorTick: 0 }, freezeTick: null, phaseDeadlineMs: null, phaseStartedMs: now, seats: [], teams,
    plan: { ...rec, positions }, barrier: null, credited: [], usedPositions: [], startedAtMs: null, finish: null, log: [],
  };
}

// ── time ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The server's world tick at `now`. Frozen outside 'traversing'; capped at the planned freeze tick. */
export function worldTick(s: OSState, now: number): number {
  const c = s.clock; if (!c.running || s.paused) return c.anchorTick;
  const t = c.anchorTick + Math.max(0, Math.floor((now - c.anchorMs) / TICK_MS));
  return s.freezeTick !== null && s.phase === 'traversing' ? Math.min(t, s.freezeTick) : t;
}
export const limitsOf = (s: OSState) => s.plan.limitDist;
/** Highest tick a seat may submit right now (its own clock may run a little ahead of the server's to absorb network jitter, but never past a freeze). */
export function maxSeatTick(s: OSState, now: number, ahead: number): number {
  if (s.phase !== 'traversing' || s.paused) return worldTick(s, now);
  return Math.min(worldTick(s, now) + ahead, s.freezeTick ?? Infinity);
}

// ── seats ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const activeSeats = (s: OSState, teamId?: string) => s.seats.filter((x) => !x.revoked && (!teamId || x.teamId === teamId));
export function addSeat(s: OSState, seatId: string, name: string, now: number, desiredTeam: string | null): Attempt<OSState> {
  if (s.phase === 'finished') return fail('FINISHED', 'The match is over.');
  if (s.locked) return fail('LOCKED', 'The teacher has closed this room to new players.');
  if (s.seats.some((x) => x.id === seatId)) return { ok: true, state: s };
  if (activeSeats(s).length >= MAX_SEATS_PER_ROOM) return fail('ROOM_FULL', 'This room already has 20 players.');
  const cap = Math.min(MAX_SEATS_PER_TEAM, s.teams.length ? MAX_SEATS_PER_TEAM : 1);
  const counts = new Map(s.teams.map((t) => [t.id, activeSeats(s, t.id).length]));
  let team = desiredTeam && counts.has(desiredTeam) && (counts.get(desiredTeam) ?? 0) < cap ? desiredTeam : null;
  if (!team) { const open = s.teams.filter((t) => (counts.get(t.id) ?? 0) < cap).sort((a, b) => (counts.get(a.id)! - counts.get(b.id)!) || a.id.localeCompare(b.id)); team = open[0]?.id ?? null; }
  if (!team) return fail('TEAM_FULL', 'Every squad is full.');
  const next = clone(s); next.seats.push({ id: seatId, name, teamId: team, role: 'trailblazer', ready: false, revoked: false, joinedAt: now }); return { ok: true, state: next };
}

const ROLE_PHASES = new Set(['lobby', 'preview', 'build_choice', 'countdown']);
export function reduceSeat(s: OSState, seatId: string, a: SeatAction): Attempt<OSState> {
  const seat = s.seats.find((x) => x.id === seatId);
  if (!seat || seat.revoked) return fail('SEAT_REVOKED', 'The teacher removed this device from the match.');
  if (s.phase === 'finished') return fail('WRONG_PHASE', 'The match is over.');
  const next = clone(s); const me = next.seats.find((x) => x.id === seatId)!;
  if (a.kind === 'role') {
    if (!ROLES.includes(a.role)) return fail('BAD_ROLE', 'Unknown role.');
    if (!ROLE_PHASES.has(s.phase)) return fail('WRONG_PHASE', 'Roles can change between chapters, not mid-run.');
    me.role = a.role; return { ok: true, state: next };
  }
  if (a.kind === 'ready') { if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'The match already started.'); me.ready = a.ready; return { ok: true, state: next }; }
  if (a.kind === 'rename') { const n = a.name.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 24); if (!n) return fail('BAD_NAME', 'Choose a name.'); if (s.phase !== 'lobby') return fail('WRONG_PHASE', 'Names change in the lobby.'); me.name = n; return { ok: true, state: next }; }
  // purchase — the one place points leave a squad
  if (s.phase !== 'build_choice') return fail('WRONG_PHASE', 'The squad shop is only open between chapters.');
  const price = PERKS[a.perk]; if (!Number.isInteger(price)) return fail('BAD_PERK', 'Unknown upgrade.');
  const team = next.teams.find((t) => t.id === me.teamId)!;
  if (team.perks.filter((p) => p === a.perk).length >= PERK_LIMIT[a.perk]) return fail('PERK_LIMIT', 'Your squad already has the most of this upgrade.');
  if (team.points < price) return fail('INSUFFICIENT_POINTS', `You need ${price} points.`);
  team.points -= price; team.spent += price; team.perks.push(a.perk);
  if (a.perk === 'safe_gate' && s.freezeTick !== null) team.pulses.push({ kind: 'safe', from: s.freezeTick + 1, to: s.freezeTick + s.plan.chapterTicks + 1, seatId });
  if (team.points < 0 || team.points > MAX_POINTS) return fail('POINT_BOUNDS', 'Economy invariant.');
  next.log = [...next.log.slice(-39), `buy:${team.id}:${a.perk}`]; return { ok: true, state: next, note: `${a.perk} bought` };
}

/** Records the team-wide effects of an ability (plank / survey / recovery) in the squad's pulse list. Called by the input route in the SAME transaction as the body. */
export function addTeamEffects(s: OSState, seatId: string, effects: readonly TeamEffect[]): OSState {
  if (!effects.length) return s;
  const next = clone(s); const seat = next.seats.find((x) => x.id === seatId); const team = seat && next.teams.find((t) => t.id === seat.teamId); if (!team) return s;
  for (const e of effects) {
    team.pulses.push({ kind: e.kind, from: e.tick, to: e.tick + PULSE_TICKS[e.kind], seatId, at: e.at } satisfies Pulse);
    team.assists = Math.min(2 * s.plan.chapters, team.assists + 1);
  }
  // keep the list short: finished windows are of no use to any seat that is not hopelessly behind
  const floor = worldTick(next, Date.now()) - 800; team.pulses = team.pulses.filter((p) => p.to >= floor).slice(-24);
  return next;
}

// ── host ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function reduceHost(s: OSState, a: HostAction, now: number): { result: Attempt<OSState>; effects: RoomEffect[] } {
  const effects: RoomEffect[] = []; const next = clone(s);
  const no = (code: string, message: string) => ({ result: fail(code, message), effects: [] as RoomEffect[] });
  switch (a.kind) {
    case 'start':
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'The match already started.');
      if (!activeSeats(s).length) return no('NO_PLAYERS', 'Wait for at least one student to join.');
      next.phase = 'preview'; next.startedAtMs = now; next.phaseStartedMs = now; next.phaseDeadlineMs = now + s.plan.previewSeconds * 1000; next.locked = false; effects.push({ type: 'start' }); break;
    case 'pause': {
      if (s.paused || s.phase === 'lobby' || s.phase === 'finished') return no('WRONG_PHASE', 'Nothing to pause.');
      next.clock = { running: false, anchorMs: now, anchorTick: worldTick(s, now) }; next.paused = true; next.pausedAtMs = now; effects.push({ type: 'pause' }); break;
    }
    case 'resume': {
      if (!s.paused || s.pausedAtMs === null) return no('WRONG_PHASE', 'The match is not paused.');
      const shift = now - s.pausedAtMs; shiftTimes(next, shift);
      next.paused = false; next.pausedAtMs = null; next.clock = { running: s.phase === 'traversing', anchorMs: now, anchorTick: s.clock.anchorTick }; effects.push({ type: 'resume' }); break;
    }
    case 'lock': next.locked = a.locked; break;
    case 'end':
      if (s.phase === 'finished') return no('WRONG_PHASE', 'The match is already over.');
      next.phase = 'finished'; next.finish = { reason: 'host_ended', at: now, standings: [] }; next.phaseDeadlineMs = null; next.clock = { ...next.clock, running: false }; effects.push({ type: 'end' }); break;
    case 'skip': {
      if (s.paused) return no('PAUSED', 'Resume the match first.');
      if (!['barrier', 'reveal', 'build_choice', 'countdown', 'preview'].includes(s.phase)) return no('WRONG_PHASE', 'There is nothing to skip right now.');
      next.phaseDeadlineMs = now; next.log = [...next.log.slice(-39), `skip:${s.phase}`]; break;
    }
    case 'kick': {
      const seat = next.seats.find((x) => x.id === a.seatId); if (!seat) return no('NO_SEAT', 'That student is not in this room.');
      seat.revoked = true; effects.push({ type: 'kick', seatId: a.seatId }); break;
    }
    case 'move_seat': {
      if (s.phase !== 'lobby') return no('WRONG_PHASE', 'Squads can only change in the lobby.');
      const seat = next.seats.find((x) => x.id === a.seatId && !x.revoked); if (!seat) return no('NO_SEAT', 'That student is not in this room.');
      if (!next.teams.some((t) => t.id === a.teamId)) return no('NO_TEAM', 'Unknown squad.');
      if (activeSeats(next, a.teamId).filter((x) => x.id !== a.seatId).length >= MAX_SEATS_PER_TEAM) return no('TEAM_FULL', 'That squad is full.');
      seat.teamId = a.teamId; break;
    }
  }
  return { result: { ok: true, state: next }, effects };
}
function shiftTimes(s: OSState, by: number) {
  if (s.phaseDeadlineMs !== null) s.phaseDeadlineMs += by;
  s.phaseStartedMs += by;
  if (s.barrier) { s.barrier.openedAtMs += by; s.barrier.deadlineMs += by; }
}

// ── lazy advancement ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type AdvanceCtx = {
  now: number; pool: readonly PoolEntry[];
  /** committed answers for the OPEN barrier's question only */
  answers: readonly CommittedAnswer[];
  /** final seat bodies (already idled to the final tick); only needed on the transition into 'finished' */
  bodies?: Record<string, Body>; seedKey: string;
};
export type Advance = { state: OSState; changed: boolean; effects: RoomEffect[]; credits: Credit[]; needsBodies: boolean };

/** Does the next due transition need the seat bodies (i.e. is it the one that ends the match)? */
export function endsMatchNext(s: OSState, now: number): boolean {
  return s.phase === 'reveal' && !s.paused && s.phaseDeadlineMs !== null && now >= s.phaseDeadlineMs && s.chapter >= s.plan.chapters - 1;
}
export function advance(state: OSState, ctx: AdvanceCtx): Advance {
  let s = state; const effects: RoomEffect[] = []; const credits: Credit[] = []; let changed = false;
  for (let guard = 0; guard < 12; guard++) {
    if (s.paused || s.phase === 'lobby' || s.phase === 'finished') break;
    const next = clone(s); let moved = false;
    if (s.phase === 'preview') {
      if (s.phaseDeadlineMs !== null && ctx.now >= s.phaseDeadlineMs) {
        const at = s.phaseDeadlineMs; next.phase = 'traversing'; next.chapter = 0; next.clock = { running: true, anchorMs: at, anchorTick: 0 }; next.freezeTick = s.plan.chapterTicks; next.phaseDeadlineMs = null; next.phaseStartedMs = at; moved = true;
      }
    } else if (s.phase === 'traversing') {
      if (s.freezeTick !== null && worldTick(s, ctx.now) >= s.freezeTick) {
        const at = s.clock.anchorMs + (s.freezeTick - s.clock.anchorTick) * TICK_MS; // the exact planned instant, not "whenever someone asked"
        const position = s.plan.positions[s.chapter];
        if (position === undefined) { // not enough questions: end cleanly at this boundary
          next.phase = 'reveal'; next.phaseDeadlineMs = at; next.phaseStartedMs = at; next.clock = { running: false, anchorMs: at, anchorTick: s.freezeTick }; next.chapter = s.plan.chapters - 1; moved = true;
        } else {
          const entry = ctx.pool.find((p) => p.position === position);
          const secs = barrierSecondsFor(entry?.kind ?? 'multiple_choice', false, false);
          const eligible: Record<string, string[]> = {}; for (const t of s.teams) eligible[t.id] = activeSeats(s, t.id).map((x) => x.id);
          next.phase = 'barrier'; next.clock = { running: false, anchorMs: at, anchorTick: s.freezeTick }; next.phaseStartedMs = at; next.phaseDeadlineMs = at + secs * 1000;
          const help: string[] = []; // a bought "help question" is spent on this barrier: a strategy tip, never an answer or extra points
          for (const t of next.teams) { const i = t.perks.indexOf('help_question'); if (i >= 0) { t.perks.splice(i, 1); help.push(t.id); } }
          next.barrier = { chapter: s.chapter, phaseId: `c${s.chapter}`, position, questionId: entry?.id ?? null, openedAtMs: at, deadlineMs: at + secs * 1000, eligible, settled: false, help };
          if (!next.usedPositions.includes(position)) next.usedPositions.push(position);
          effects.push({ type: 'open', position }); moved = true;
        }
      }
    } else if (s.phase === 'barrier') {
      const b = s.barrier!; const everyone = Object.values(b.eligible).flat();
      const answered = new Set(ctx.answers.map((a) => a.seatId));
      const allIn = everyone.length > 0 && everyone.every((id) => answered.has(id));
      const expired = ctx.now >= b.deadlineMs; const skipped = s.phaseDeadlineMs !== null && ctx.now >= s.phaseDeadlineMs && s.phaseDeadlineMs < b.deadlineMs;
      if (expired || allIn || skipped) {
        const closeAt = expired ? b.deadlineMs : ctx.now;
        for (const t of next.teams) {
          const elig = b.eligible[t.id] ?? []; const subs: Sub[] = ctx.answers.filter((a) => elig.includes(a.seatId)).map((a) => ({ seatId: a.seatId, fraction: a.correct ? 1000 : a.awardedFraction }));
          const key = `b:${b.phaseId}:${t.id}`;
          if (next.credited.includes(key)) continue;
          const award = barrierPoints(elig, subs); const taken = addPoints(t, award);
          t.mastery += masteryOf(elig, subs); t.masteryOf += elig.length; t.barrierAwards.push(taken); if (award > 0) t.chaptersCleared++;
          next.credited.push(key); credits.push({ key, teamId: t.id, amount: award, submissionIds: ctx.answers.filter((a) => elig.includes(a.seatId)).map((a) => a.id) });
        }
        next.barrier = { ...b, settled: true }; next.phase = 'reveal'; next.phaseStartedMs = closeAt; next.phaseDeadlineMs = closeAt + s.plan.revealSeconds * 1000; effects.push({ type: 'reveal' }); moved = true;
      }
    } else if (s.phase === 'reveal') {
      if (s.phaseDeadlineMs !== null && ctx.now >= s.phaseDeadlineMs) {
        const at = s.phaseDeadlineMs;
        if (s.chapter >= s.plan.chapters - 1) {
          if (!ctx.bodies) break; // the server loads the bodies and calls again
          next.phase = 'finished'; next.phaseDeadlineMs = null; next.phaseStartedMs = at;
          next.finish = { reason: s.chapter >= s.plan.chapters - 1 ? 'time_up' : 'escaped', at, standings: standingsOf(next, ctx.bodies, s.plan.totalDist, ctx.seedKey) };
          const escapedAll = next.finish.standings.length > 0 && next.finish.standings.every((x) => x.outcome === 'escaped'); if (escapedAll) next.finish.reason = 'escaped';
          effects.push({ type: 'end' });
        } else { next.phase = 'build_choice'; next.phaseStartedMs = at; next.phaseDeadlineMs = at + s.plan.buildSeconds * 1000; }
        moved = true;
      }
    } else if (s.phase === 'build_choice') {
      if (s.phaseDeadlineMs !== null && ctx.now >= s.phaseDeadlineMs) { const at = s.phaseDeadlineMs; next.phase = 'countdown'; next.phaseStartedMs = at; next.phaseDeadlineMs = at + s.plan.countdownSeconds * 1000; moved = true; }
    } else if (s.phase === 'countdown') {
      if (s.phaseDeadlineMs !== null && ctx.now >= s.phaseDeadlineMs) {
        const at = s.phaseDeadlineMs; next.phase = 'traversing'; next.chapter = s.chapter + 1; next.barrier = null;
        next.clock = { running: true, anchorMs: at, anchorTick: s.freezeTick ?? s.clock.anchorTick }; next.freezeTick = (s.freezeTick ?? 0) + s.plan.chapterTicks; next.phaseDeadlineMs = null; next.phaseStartedMs = at; moved = true;
      }
    }
    if (!moved) break;
    s = next; changed = true;
  }
  return { state: s, changed, effects, credits, needsBodies: !s.paused && endsMatchNext(s, ctx.now) && !ctx.bodies };
}
export const roleOf = (s: OSState, seatId: string): Role | null => s.seats.find((x) => x.id === seatId)?.role ?? null;
export const seatOf = (s: OSState, seatId: string): SeatRec | undefined => s.seats.find((x) => x.id === seatId);
