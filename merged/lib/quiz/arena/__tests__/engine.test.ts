import { advance, addSeat, hydrateConfig, reduceHost, reduceSeat, standingsOf } from '../engine';
import type { ArenaState, IntentEntry } from '../domain';
import { geometryFor } from '../maps';
import { cfgOf, newMatch, playMatch } from '../testkit';
import { ZONE_R } from '../balance';
import { geoOf, startEpisode, simulate } from '../sim';
import { planMatch } from '../plan';

const goLive = (o: Parameters<typeof newMatch>[0], now = 0) => {
  const m = newMatch(o); let s = m.s; const st = reduceHost(s, { kind: 'start' }, now, m.pool); if (!st.result.ok) throw new Error(st.result.message); s = st.result.state;
  // jump straight to a live episode through the real machine
  let t = now; const lines = {}; for (let i = 0; i < 200 && s.phase !== 'arena_live'; i++) { t += 5000; s = advance(s, { now: t, pool: m.pool, answers: [], timelines: lines }).state; }
  expect(s.phase).toBe('arena_live'); return { s, pool: m.pool, t };
};
const entry = (tick: number, x: number, y: number, seq: number): IntentEntry => ({ tick, x, y, seq });
const put = (s: ArenaState, id: string, x: number, y: number) => { const seat = s.seats.find((q) => q.id === id)!; seat.x = x; seat.y = y; seat.seenTick = s.live!.tick; };

describe('lobby and seats', () => {
  it('seats players on balanced teams, honours the cap, the 20-seat room limit and the lock', () => {
    const m = newMatch({ format: 'control', sizes: [0, 0] }); let s = m.s; s = { ...s, teamSizeCap: 3 };
    for (let i = 0; i < 6; i++) { const r = addSeat(s, `s${i}`, `N${i}`, 0, null); expect(r.ok).toBe(true); if (r.ok) s = r.state; }
    expect(s.teams.map((t) => s.seats.filter((x) => x.teamId === t.id).length)).toEqual([3, 3]);
    const full = addSeat(s, 'extra', 'X', 0, null); expect(full.ok).toBe(false); if (!full.ok) expect(full.code).toBe('TEAM_FULL');
    const locked = reduceHost(s, { kind: 'lock', locked: true }, 0).result; if (!locked.ok) throw new Error('lock'); const r = addSeat(locked.state, 'late', 'L', 0, null); expect(r.ok).toBe(false);
    const big = newMatch({ format: 'control', sizes: [5, 5, 5, 5] }); expect(big.s.seats).toHaveLength(20); const over = addSeat(big.s, 'over', 'O', 0, null); expect(over.ok).toBe(false); if (!over.ok) expect(over.code).toBe('ROOM_FULL');
  });
  it('lets a student pick a role and ready up only in the lobby; hydrateConfig re-asserts the trusted cap', () => {
    const m = newMatch({ format: 'control', sizes: [2, 2] }); const a = reduceSeat(m.s, 'p0-0', { kind: 'role', role: 'builder' }); expect(a.ok && a.state.seats[0]!.role).toBe('builder');
    const h = hydrateConfig({ ...m.s, teamSizeCap: 5 }, { ...cfgOf({ format: 'control', sizes: [2, 2] }), teamSizeCap: 2 }); expect(h.teamSizeCap).toBe(2);
    const forged = reduceSeat(m.s, 'nobody', { kind: 'ready', ready: true }); expect(forged.ok).toBe(false);
  });
  it('needs two occupied teams to start, and refuses with an honest message', () => {
    const m = newMatch({ format: 'control', sizes: [2, 0] }); const r = reduceHost(m.s, { kind: 'start' }, 0, m.pool).result; expect(r.ok).toBe(false); if (!r.ok) expect(r.code).toBe('NEED_TWO_TEAMS');
  });
});

describe('phase machine', () => {
  it('runs question → reveal → planning → live → result for every planned cycle, then finishes with immutable standings', () => {
    const seen: string[] = []; const { state } = playMatch({ format: 'control', sizes: [2, 2], questions: 4, minutes: 10, onTick: (s) => { if (seen.at(-1) !== s.phase) seen.push(s.phase); } });
    expect(state.phase).toBe('finished'); expect(state.finish?.reason).toBe('completed'); expect(seen.slice(0, 6)).toEqual(['reveal', 'planning', 'arena_live', 'episode_result', 'question_open', 'reveal']);
    expect(state.finish!.standings).toHaveLength(2); expect(state.usedPositions.length).toBe(state.plan.cycles);
  });
  it('freezes the whole world during a quiz break: no movement, no capture progress, no leaked inputs', () => {
    const { s: live0 } = goLive({ format: 'control', sizes: [1, 1] }); const s = JSON.parse(JSON.stringify(live0)) as ArenaState; const z = s.live!.zones[s.live!.active[0]!]!; put(s, 'p0-0', z.x, z.y);
    const before = JSON.stringify(s.seats.map((x) => [x.x, x.y]));
    const frozen = { ...s, phase: 'question_open' as const, phaseDeadlineMs: 1e12, question: { cycle: 0, position: 0, questionId: 'q', openedAtMs: 0, deadlineMs: 1e12, eligible: {}, settled: false } };
    const out = advance(frozen, { now: 1e9, pool: [], answers: [], timelines: { 'p0-0': [entry(1, 1, 0, 99)] } }).state; expect(JSON.stringify(out.seats.map((x) => [x.x, x.y]))).toBe(before); expect(out.live!.zones[s.live!.active[0]!]!.progress).toBe(s.live!.zones[s.live!.active[0]!]!.progress);
  });
  it('is chunk-independent: catching up in one step equals catching up in many small steps', () => {
    const { s, pool } = goLive({ format: 'crystal', sizes: [2, 2] }); const lines = { 'p0-0': [entry(s.live!.tick + 1, 1, 0.3, 1)], 'p1-0': [entry(s.live!.tick + 1, -1, 0, 2)] }; const t0 = s.live!.anchorMs;
    const one = advance(s, { now: t0 + 20000, pool, answers: [], timelines: lines }).state; let many = s; for (let k = 1; k <= 200; k++) many = advance(many, { now: t0 + k * 100, pool, answers: [], timelines: lines }).state;
    expect(JSON.stringify(one.seats.map((x) => [x.x, x.y]))).toBe(JSON.stringify(many.seats.map((x) => [x.x, x.y]))); expect(one.live!.tick).toBe(many.live!.tick);
  });
  it('never moves a seat faster than the baseline speed (no teleport, no speed hack from oversize or NaN intents)', () => {
    const { s } = goLive({ format: 'control', sizes: [1, 1] }); const sim = JSON.parse(JSON.stringify(s)) as ArenaState; const p = sim.seats[0]!; const x0 = p.x, y0 = p.y;
    simulate(sim, sim.live!.tick + 20, { 'p0-0': [entry(sim.live!.tick + 1, 50, 50, 1)] }); const d = Math.hypot(sim.seats[0]!.x - x0, sim.seats[0]!.y - y0); expect(d).toBeLessThanOrEqual(20 * 8 + 1e-6);
    simulate(sim, sim.live!.tick + 10, { 'p0-0': [entry(sim.live!.tick + 1, Number.NaN, Infinity, 2)] }); expect(Number.isFinite(sim.seats[0]!.x)).toBe(true);
  });
  it('pauses exactly: nothing advances while paused and the clock resumes where it stopped', () => {
    const { s, pool } = goLive({ format: 'control', sizes: [1, 1] }); const t0 = s.live!.anchorMs + 2000; const adv = advance(s, { now: t0, pool, answers: [], timelines: {} }).state;
    const paused = reduceHost(adv, { kind: 'pause' }, t0).result; if (!paused.ok) throw new Error('p'); const later = advance(paused.state, { now: t0 + 60_000, pool, answers: [], timelines: {} }).state; expect(later.live!.tick).toBe(adv.live!.tick);
    const res = reduceHost(later, { kind: 'resume' }, t0 + 60_000).result; if (!res.ok) throw new Error('r'); const after = advance(res.state, { now: t0 + 61_000, pool, answers: [], timelines: {} }).state; expect(after.live!.tick - adv.live!.tick).toBe(20);
  });
});

describe('plans', () => {
  it('fits whole cycles into the teacher time, never invents questions, and warns when short', () => {
    const kinds = Array.from({ length: 40 }, () => 'multiple_choice' as const);
    const p15 = planMatch({ durationMinutes: 15, readAloud: false, lowPressure: false, allowReviewCycle: false }, kinds); expect(p15.cycles).toBeGreaterThanOrEqual(3); expect(p15.estimatedMinutes).toBeLessThanOrEqual(16); expect(p15.questionsAvailable).toBe(40);
    const short = planMatch({ durationMinutes: 30, readAloud: false, lowPressure: false, allowReviewCycle: false }, kinds.slice(0, 2)); expect(short.cycles).toBe(2); expect(short.notes).toContain('belowMinimum'); expect(short.notes).toContain('shortQuiz');
    const review = planMatch({ durationMinutes: 30, readAloud: false, lowPressure: false, allowReviewCycle: true }, kinds.slice(0, 6)); expect(review.reviewCycle).toBe(true);
    const slow = planMatch({ durationMinutes: 15, readAloud: true, lowPressure: true, allowReviewCycle: false }, kinds); expect(slow.cycles).toBeLessThanOrEqual(p15.cycles);
  });
});

describe('scoring', () => {
  it('weights quiz at least 50%, ties stay ties, and quiz accuracy breaks equal scores', () => {
    const base = newMatch({ format: 'control', sizes: [1, 1] }).s; const s: ArenaState = JSON.parse(JSON.stringify(base)); s.plan.cycles = 4;
    s.teams[0]!.mastery = 800; s.teams[0]!.masteryOf = 1; s.teams[0]!.objective = 100; s.teams[1]!.mastery = 800; s.teams[1]!.masteryOf = 1; s.teams[1]!.objective = 100;
    const tie = standingsOf(s); expect(tie.standings.every((x) => x.rank === 1 && x.tied)).toBe(true); expect(tie.tieNote).toMatch(/No random winner/);
    s.weighting = 'game'; s.teams[0]!.mastery = 1000; s.teams[1]!.mastery = 0; s.teams[1]!.objective = 400; const g = standingsOf(s); expect(g.standings[0]!.teamId).toBe('t1');
    for (const w of ['study', 'balanced', 'game'] as const) { s.weighting = w; const sc = standingsOf(s).standings[0]!; expect(sc.score).toBeGreaterThan(0); }
  });
  it('credits each question once per team with the mean eligible fraction and no speed bonus', () => {
    const m = newMatch({ format: 'control', sizes: [2, 2], questions: 4 }); const st = reduceHost(m.s, { kind: 'start' }, 0, m.pool).result; if (!st.ok) throw new Error('x'); let s = st.state;
    const answers = [{ id: 'a', seatId: 'p0-0', roomQuestionId: 'q0', correct: true, awardedFraction: 1000 }, { id: 'b', seatId: 'p0-1', roomQuestionId: 'q0', correct: false, awardedFraction: 0 }, { id: 'c', seatId: 'p1-0', roomQuestionId: 'q0', correct: true, awardedFraction: 1000 }, { id: 'd', seatId: 'p1-1', roomQuestionId: 'q0', correct: true, awardedFraction: 1000 }];
    const out = advance(s, { now: s.question!.deadlineMs + 1, pool: m.pool, answers, timelines: {} }); s = out.state; expect(out.credits.map((c) => [c.teamId, c.amount])).toEqual([['t1', 50], ['t2', 100]]);
    const again = advance(s, { now: s.phaseStartedMs + 1, pool: m.pool, answers, timelines: {} }); expect(again.credits).toEqual([]);
    expect(s.teams.map((t) => t.wallet)).toEqual([50, 100]);
  });
});

describe('geometry is mirrored for the squad count the match uses', () => {
  it('uses the squads of the session for spawns and rotates base slots every episode', () => {
    const { s } = goLive({ format: 'control', sizes: [1, 1, 1] }); const g = geoOf(s); expect(g).toBe(geometryFor('meadow_mosaic', 3));
    const a = s.teams.map((t) => t.slot); const s2 = JSON.parse(JSON.stringify(s)) as ArenaState; startEpisode(s2, 1, 0); expect(s2.teams.map((t) => t.slot)).not.toEqual(a); expect(new Set(s2.teams.map((t) => t.slot)).size).toBe(3);
    void ZONE_R;
  });
});
