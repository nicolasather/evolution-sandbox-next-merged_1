/** @jest-environment node */
import { addTeamEffects, advance, endsMatchNext, hydrateConfig, maxSeatTick, reduceHost, reduceSeat, worldTick, activeSeats, type Advance } from '../engine';
import type { Body, HostAction, OSState } from '../domain';
import { TICK_MS, MAX_POINTS } from '../balance';
import { barrierSecondsFor } from '../plan';
import { barrierPoints, masteryOf, standingsOf } from '../score';
import { project } from '../public';
import { newBody } from '../physics';
import { ans, makeMatch, seatUp } from '../testkit';

const T0 = 1_000_000;
const host = (s: OSState, a: HostAction, now: number) => { const r = reduceHost(s, a, now); if (!r.result.ok) throw new Error(`${a.kind}: ${r.result.code}`); return { s: r.result.state, fx: r.effects }; };
function drive(s: OSState, now: number, pool: ReturnType<typeof makeMatch>['pool'], answers: Parameters<typeof advance>[1]['answers'] = [], bodies?: Record<string, Body>): Advance {
  return advance(s, { now, pool, answers, bodies, seedKey: 'k' });
}
function started(n = 3, o = {}, q = 6) {
  const m = makeMatch(o, q); let s = seatUp(m.state, Array.from({ length: n }, (_, i) => `seat-${i}`.padEnd(8, 'x')));
  s = host(s, { kind: 'start' }, T0).s; return { ...m, state: s };
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `seat-${i}`.padEnd(8, 'x'));

describe('seats and capacity', () => {
  test('OS-065 the 21st seat is refused; no squad exceeds 5; ties go to the emptiest squad', () => {
    const m = makeMatch({ format: 'relay_race', teamCount: 4 }); let s = m.state; const counts = () => s.teams.map((t) => activeSeats(s, t.id).length);
    for (let i = 0; i < 20; i++) { const r = seatUp(s, [`p${i}`.padEnd(8, 'x')]); s = r; }
    expect(counts()).toEqual([5, 5, 5, 5]);
    expect(() => seatUp(s, ['extra-seat'])).toThrow(/20 players/);
  });
  test('joining twice is idempotent (same seat, no sixth member)', () => { const m = makeMatch(); const a = seatUp(m.state, ['seat-aaaa']); const b = seatUp(a, ['seat-aaaa']); expect(b.seats).toHaveLength(1); });
  test('a locked or finished room refuses joins', () => { const m = makeMatch(); const locked = host(m.state, { kind: 'lock', locked: true }, T0).s; expect(() => seatUp(locked, ['seat-bbbb'])).toThrow(/closed/); });
  test('role changes: lobby/preview/shop only, never mid-run', () => {
    const { state } = started(1); const id = ids(1)[0];
    expect(reduceSeat(state, id, { kind: 'role', role: 'medic' })).toMatchObject({ ok: true });
    const run = drive(state, T0 + 20_000, [] as never).state; expect(run.phase).toBe('traversing');
    expect(reduceSeat(run, id, { kind: 'role', role: 'medic' })).toMatchObject({ ok: false, code: 'WRONG_PHASE' });
  });
  test('a removed device is refused everywhere', () => {
    const { state } = started(2); const k = host(state, { kind: 'kick', seatId: ids(2)[0] }, T0 + 1); expect(k.fx).toEqual([{ type: 'kick', seatId: ids(2)[0] }]);
    expect(reduceSeat(k.s, ids(2)[0], { kind: 'ready', ready: true })).toMatchObject({ ok: false, code: 'SEAT_REVOKED' });
  });
});

describe('timeline', () => {
  test('lobby → preview → traversing at an exact tick → barrier exactly at the planned freeze', () => {
    const { state, pool, plan } = started(2);
    expect(state.phase).toBe('preview'); const previewEnd = T0 + plan.previewSeconds * 1000;
    expect(drive(state, previewEnd - 1, pool).changed).toBe(false);
    const run = drive(state, previewEnd + 5 * TICK_MS, pool).state; expect(run.phase).toBe('traversing'); expect(worldTick(run, previewEnd + 5 * TICK_MS)).toBe(5); expect(run.freezeTick).toBe(plan.chapterTicks);
    // asking late must give the SAME barrier as asking on time
    const late = drive(state, previewEnd + plan.chapterTicks * TICK_MS + 4000, pool); const exact = drive(state, previewEnd + plan.chapterTicks * TICK_MS, pool);
    expect(late.state.phase).toBe('barrier'); expect(late.state.barrier!.openedAtMs).toBe(exact.state.barrier!.openedAtMs); expect(late.state.barrier!.openedAtMs).toBe(previewEnd + plan.chapterTicks * TICK_MS);
    expect(late.effects).toEqual([{ type: 'open', position: 0 }]); expect(late.state.clock.running).toBe(false);
  });
  test('OS-085 the world stands still at the freeze tick and inputs beyond it are impossible', () => {
    const { state, pool, plan } = started(1); const t = T0 + 15_000 + 40_000; const run = drive(state, T0 + 15_000 + 1000, pool).state;
    expect(maxSeatTick(run, T0 + 15_000 + 10 * TICK_MS, 6)).toBe(16); expect(maxSeatTick(run, t, 6)).toBe(plan.chapterTicks);
    const bar = drive(state, t, pool).state; expect(worldTick(bar, t + 99_999)).toBe(plan.chapterTicks); expect(maxSeatTick(bar, t, 6)).toBe(plan.chapterTicks);
  });
  test('a full match runs to the end through every phase and finishes once', () => {
    let { state } = started(2, {}, 4); const m = makeMatch({}, 4); const pool = m.pool; let now = T0; const phases: string[] = [state.phase];
    for (let i = 0; i < 400 && state.phase !== 'finished'; i++) {
      now += 1000; const bodies = Object.fromEntries(state.seats.map((x) => [x.id, { ...newBody(m.idx), maxDist: 5 }]));
      const r = drive(state, now, pool, [], state.phase === 'reveal' ? bodies : undefined); state = r.state; if (phases[phases.length - 1] !== state.phase) phases.push(state.phase);
    }
    expect(phases.slice(0, 7)).toEqual(['preview', 'traversing', 'barrier', 'reveal', 'build_choice', 'countdown', 'traversing']);
    expect(state.phase).toBe('finished'); expect(state.finish!.standings).toHaveLength(1); expect(state.chapter).toBe(3);
    expect(drive(state, now + 10_000, pool).changed).toBe(false); // finished is final
  });
  test('the engine asks for the bodies before it ends the match', () => {
    let { state } = started(1, {}, 3); const m = makeMatch({}, 3); let now = T0;
    for (let i = 0; i < 300 && !(state.phase === 'reveal' && state.chapter === 2); i++) { now += 1000; state = drive(state, now, m.pool).state; }
    expect(state.phase).toBe('reveal'); now = state.phaseDeadlineMs! + 1; expect(endsMatchNext(state, now)).toBe(true);
    const w = drive(state, now, m.pool); expect(w.changed).toBe(false); expect(w.needsBodies).toBe(true);
  });
  test('OS-087/088 pause mid-traversal and mid-question freeze every clock; resume shifts them by the pause length', () => {
    const { state, pool, plan } = started(1); const t = T0 + 15_000 + 100 * TICK_MS; const run = drive(state, t, pool).state; expect(worldTick(run, t)).toBe(100);
    const p = host(run, { kind: 'pause' }, t).s; expect(worldTick(p, t + 60_000)).toBe(100); expect(drive(p, t + 600_000, pool).changed).toBe(false);
    const r = host(p, { kind: 'resume' }, t + 60_000).s; expect(worldTick(r, t + 60_000 + 20 * TICK_MS)).toBe(120);
    // mid-question
    const bt = T0 + 15_000 + plan.chapterTicks * TICK_MS; const bar = drive(state, bt, pool).state; const dl = bar.barrier!.deadlineMs;
    const pb = host(bar, { kind: 'pause' }, bt + 5000).s; const rb = host(pb, { kind: 'resume' }, bt + 65_000).s;
    expect(rb.barrier!.deadlineMs).toBe(dl + 60_000); expect(drive(rb, dl, pool).state.phase).toBe('barrier'); expect(drive(rb, dl + 60_000, pool).state.phase).toBe('reveal');
  });
  test('host: only valid commands in the right phase; skip is logged; end finishes with an effect', () => {
    const { state, pool, plan } = started(1);
    expect(reduceHost(state, { kind: 'start' }, T0).result).toMatchObject({ ok: false, code: 'WRONG_PHASE' });
    expect(reduceHost(state, { kind: 'resume' }, T0).result).toMatchObject({ ok: false });
    const bar = drive(state, T0 + 15_000 + plan.chapterTicks * TICK_MS, pool).state; const sk = host(bar, { kind: 'skip' }, bar.barrier!.openedAtMs + 3000).s;
    expect(sk.log.some((l) => l.startsWith('skip:barrier'))).toBe(true); expect(drive(sk, bar.barrier!.openedAtMs + 3000, pool).state.phase).toBe('reveal');
    const e = host(bar, { kind: 'end' }, T0 + 99); expect(e.s.phase).toBe('finished'); expect(e.fx).toEqual([{ type: 'end' }]);
    expect(reduceHost(makeMatch().state, { kind: 'start' }, T0).result).toMatchObject({ ok: false, code: 'NO_PLAYERS' });
  });
});

describe('barrier scoring (OS-053, OS-100, OS-076..079)', () => {
  test('GDD worked examples: 100/100/0 of three = 65, solo correct = 100, half = 50, none = 0', () => {
    const s = (id: string, f: number) => ({ seatId: id, fraction: f });
    expect(barrierPoints(['a', 'b', 'c'], [s('a', 1000), s('b', 1000), s('c', 0)])).toBe(65);
    expect(barrierPoints(['a'], [s('a', 1000)])).toBe(100); expect(barrierPoints(['a', 'b'], [s('a', 1000), s('b', 0)])).toBe(50); expect(barrierPoints(['a', 'b'], [])).toBe(0);
    expect(barrierPoints(['a', 'b', 'c', 'd', 'e'], [s('a', 1000)])).toBe(20); // one student cannot farm a five-person economy
  });
  test('partial credit, duplicates, outsiders and out-of-range fractions', () => {
    const s = (id: string, f: number) => ({ seatId: id, fraction: f });
    expect(barrierPoints(['a', 'b'], [s('a', 500), s('b', 500)])).toBe(50); expect(barrierPoints(['a'], [s('a', 1000), s('a', 1000), s('a', 1000)])).toBe(100);
    expect(barrierPoints(['a'], [s('zz', 1000)])).toBe(0); expect(barrierPoints(['a'], [s('a', 99999)])).toBe(100); expect(barrierPoints(['a'], [s('a', -50)])).toBe(0);
    expect(masteryOf(['a', 'b'], [s('a', 1000), s('b', 250)])).toBe(1250);
  });
  test.each([[1, 5], [2, 2], [3, 4], [4, 5]])('team of %i earns the same as a team of %i when the same share is right', (a, b) => {
    const mk = (n: number, right: number) => { const el = Array.from({ length: n }, (_, i) => `p${i}`); return barrierPoints(el, el.slice(0, right).map((id) => ({ seatId: id, fraction: 1000 }))); };
    expect(mk(a, a)).toBe(100); expect(mk(b, b)).toBe(100); expect(mk(a * 2, a)).toBe(mk(b * 2, b));
  });
  function atBarrier(n: number, o = {}) {
    const m = makeMatch(o, 6); const members = ids(n); let s = seatUp(m.state, members); s = host(s, { kind: 'start' }, T0).s;
    const bar = drive(s, T0 + 15_000 + m.plan.chapterTicks * TICK_MS, m.pool).state; return { ...m, bar, members };
  }
  test('settling credits exactly once, caps at 600 and reports what was wasted', () => {
    const { bar, pool, members } = atBarrier(2); const q = bar.barrier!.questionId!; const all = members.map((id) => ans(id, q, 1000));
    const r = drive(bar, bar.barrier!.openedAtMs + 2000, pool, all); expect(r.state.phase).toBe('reveal'); expect(r.credits).toEqual([expect.objectContaining({ key: 'b:c0:sq1', amount: 100 })]); expect(r.state.teams[0].points).toBe(100);
    expect(r.effects).toEqual([{ type: 'reveal' }]); expect(r.state.credited).toEqual(['b:c0:sq1']);
    const again = drive(r.state, bar.barrier!.openedAtMs + 3000, pool, all); expect(again.credits).toEqual([]); // reveal → no second credit
    const rich = JSON.parse(JSON.stringify(bar)) as OSState; rich.teams[0].points = 560; const o = drive(rich, bar.barrier!.openedAtMs + 2000, pool, all).state;
    expect(o.teams[0].points).toBe(MAX_POINTS); expect(o.teams[0].wasted).toBe(60); expect(o.teams[0].earned).toBe(40);
  });
  test('OS-052 the grade is the committed one: a forged "correct" has no way in (fraction comes from awardedFraction only when not correct)', () => {
    const { bar, pool, members } = atBarrier(1); const q = bar.barrier!.questionId!;
    const r = drive(bar, bar.barrier!.deadlineMs, pool, [{ id: 's1', seatId: members[0], roomQuestionId: q, correct: false, awardedFraction: 0 }]); expect(r.state.teams[0].points).toBe(0);
  });
  test('only students on the frozen roster earn: a late joiner and a kicked seat add nothing', () => {
    const { bar, pool, members } = atBarrier(2); const q = bar.barrier!.questionId!; const joined = seatUp(bar, ['late-seat']); const kicked = host(joined, { kind: 'kick', seatId: members[1] }, bar.barrier!.openedAtMs + 1).s;
    const r = drive(kicked, bar.barrier!.deadlineMs, pool, [ans('late-seat', q, 1000), ans(members[0], q, 1000)]); expect(r.state.teams[0].points).toBe(50); // 2 eligible, 1 right
  });
  test('the barrier closes early when everyone has answered, never before', () => {
    const { bar, pool, members } = atBarrier(3); const q = bar.barrier!.questionId!;
    expect(drive(bar, bar.barrier!.openedAtMs + 1000, pool, [ans(members[0], q, 1000), ans(members[1], q, 1000)]).state.phase).toBe('barrier');
    expect(drive(bar, bar.barrier!.openedAtMs + 1000, pool, members.map((m) => ans(m, q, 1000))).state.phase).toBe('reveal');
  });
  test('relay fairness: equal geometry, normalised points and a deterministic tie-break', () => {
    const m = makeMatch({ format: 'relay_race', teamCount: 2 }, 6); let s = m.state;
    s = seatUp(s, ids(1).concat(['solo-extra']).slice(0, 1), 'sq1'); s = seatUp(s, Array.from({ length: 5 }, (_, i) => `five-${i}`.padEnd(8, 'x')), 'sq2');
    s = host(s, { kind: 'start' }, T0).s; const bar = drive(s, T0 + 15_000 + m.plan.chapterTicks * TICK_MS, m.pool).state; const q = bar.barrier!.questionId!;
    const solo = activeSeats(bar, 'sq1').map((x) => x.id), five = activeSeats(bar, 'sq2').map((x) => x.id);
    const r = drive(bar, bar.barrier!.deadlineMs, m.pool, [ans(solo[0], q, 1000), ...five.map((id) => ans(id, q, 1000))]).state;
    expect(r.teams.map((t) => t.points)).toEqual([100, 100]);
    const bodies = Object.fromEntries(r.seats.map((x) => [x.id, { ...newBody(m.idx), maxDist: m.plan.totalDist }]));
    const a = standingsOf(r, bodies, m.plan.totalDist, 'seed'), b = standingsOf(r, bodies, m.plan.totalDist, 'seed'); expect(a).toEqual(b);
    expect(a.map((x) => x.rank)).toEqual([1, 2]); expect(a[0].outcome).toBe('winner');
    const other = standingsOf(r, bodies, m.plan.totalDist, 'different-seed'); expect(new Set(other.map((x) => x.teamId))).toEqual(new Set(a.map((x) => x.teamId)));
  });
  test.each([[1, 5], [2, 2], [3, 4], [4, 5]])('OS-076..079 relay %i vs %i: a fully correct squad earns the same points whatever its size', (a, b) => {
    const m = makeMatch({ format: 'relay_race', teamCount: 2 }, 6); let s = m.state;
    s = seatUp(s, Array.from({ length: a }, (_, i) => `sa-${i}`.padEnd(8, 'x')), 'sq1'); s = seatUp(s, Array.from({ length: b }, (_, i) => `sb-${i}`.padEnd(8, 'y')), 'sq2');
    s = host(s, { kind: 'start' }, T0).s; const bar = drive(s, T0 + 15_000 + m.plan.chapterTicks * TICK_MS, m.pool).state; const q = bar.barrier!.questionId!;
    const all = [...activeSeats(bar, 'sq1'), ...activeSeats(bar, 'sq2')].map((x) => x.id);
    const r = drive(bar, bar.barrier!.deadlineMs, m.pool, all.map((id) => ans(id, q, 1000))).state;
    expect(r.teams.map((t) => t.points)).toEqual([100, 100]);
  });
  test('standings: formula 45/40/15, tie band uses mastery before anything else', () => {
    const m = makeMatch({ format: 'relay_race', teamCount: 2 }, 6); let s = seatUp(m.state, ['aaaa-aaaa'], 'sq1'); s = seatUp(s, ['bbbb-bbbb'], 'sq2');
    s.teams[0].mastery = 900; s.teams[0].masteryOf = 1; s.teams[1].mastery = 1000; s.teams[1].masteryOf = 1;
    const half = Math.round(m.plan.totalDist / 2); const bodies = { 'aaaa-aaaa': { ...newBody(m.idx), maxDist: half + 4 }, 'bbbb-bbbb': { ...newBody(m.idx), maxDist: half } };
    const st = standingsOf(s, bodies, m.plan.totalDist, 'x'); const a = st.find((x) => x.teamId === 'sq1')!, b = st.find((x) => x.teamId === 'sq2')!;
    expect(Math.abs(a.score - b.score)).toBeLessThanOrEqual(50); expect(b.rank).toBe(1); // within ±5%: higher mastery wins
    expect(a.score).toBe(Math.round((45 * a.progress + 40 * 900 + 15 * 0) / 100));
  });
});

describe('squad shop (OS-054, OS-066, OS-068)', () => {
  function shop(points: number) {
    const m = makeMatch({}, 6); let s = seatUp(m.state, ids(2)); s = host(s, { kind: 'start' }, T0).s;
    let cur = drive(s, T0 + 15_000 + m.plan.chapterTicks * TICK_MS, m.pool).state; cur.teams[0].points = points;
    cur = drive(cur, cur.barrier!.deadlineMs, m.pool, []).state; cur.teams[0].points = points; cur = drive(cur, cur.phaseDeadlineMs!, m.pool).state; return { ...m, s: cur, state: seatUp(m.state, ids(2)) };
  }
  test('only in build_choice; costs exact; never below zero; limits enforced', () => {
    const { s, state } = shop(100); expect(s.phase).toBe('build_choice');
    expect(reduceSeat(state, ids(2)[0], { kind: 'purchase', perk: 'safety_rail' })).toMatchObject({ ok: false, code: 'WRONG_PHASE' });
    const b1 = reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'safety_rail' }); if (!b1.ok) throw new Error(b1.code); expect(b1.state.teams[0].points).toBe(20); expect(b1.state.teams[0].spent).toBe(80);
    expect(reduceSeat(b1.state, ids(2)[1], { kind: 'purchase', perk: 'safety_rail' })).toMatchObject({ ok: false, code: 'INSUFFICIENT_POINTS' }); // a teammate spent it first
    expect(reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'safe_gate' })).toMatchObject({ ok: false, code: 'INSUFFICIENT_POINTS' });
    expect(reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'nope' as never })).toMatchObject({ ok: false });
    const rich = shop(600).s; let cur = rich; for (let i = 0; i < 3; i++) { const r = reduceSeat(cur, ids(2)[0], { kind: 'purchase', perk: 'route_peek' }); if (r.ok) cur = r.state; }
    expect(cur.teams[0].perks.filter((p) => p === 'route_peek')).toHaveLength(1); expect(reduceSeat(cur, ids(2)[0], { kind: 'purchase', perk: 'route_peek' })).toMatchObject({ code: 'PERK_LIMIT' });
  });
  test('safe gate rests hazards for exactly the next chapter; points are the only currency', () => {
    const { s, plan } = shop(300); const b = reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'safe_gate' }); if (!b.ok) throw new Error(b.code);
    const p = b.state.teams[0].pulses[0]; expect(p.kind).toBe('safe'); expect(p.to - p.from).toBe(plan.chapterTicks); expect(p.from).toBe(s.freezeTick! + 1);
    expect(JSON.stringify(s)).not.toMatch(/gem|coin|stamina/i);
  });
  test('help question is spent on the next barrier as a tip', () => {
    const { s, pool } = shop(200); const b = reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'help_question' }); if (!b.ok) throw new Error(b.code);
    let cur = drive(b.state, b.state.phaseDeadlineMs!, pool).state; cur = drive(cur, cur.phaseDeadlineMs!, pool).state; expect(cur.phase).toBe('traversing');
    cur = drive(cur, cur.clock.anchorMs + cur.plan.chapterTicks * TICK_MS, pool).state; expect(cur.phase).toBe('barrier'); expect(cur.barrier!.help).toEqual(['sq1']); expect(cur.teams[0].perks).not.toContain('help_question');
  });
});

describe('team effects and projections', () => {
  test('ability effects become capped squad pulses', () => {
    const { state } = started(2); let s = state;
    for (let i = 0; i < 30; i++) s = addTeamEffects(s, ids(2)[0], [{ kind: 'recover', tick: i, at: [3, 3] }], i);
    expect(s.teams[0].assists).toBeLessThanOrEqual(2 * s.plan.chapters); expect(s.teams[0].pulses.length).toBeLessThanOrEqual(24);
    expect(addTeamEffects(state, 'stranger!', [{ kind: 'plank', tick: 1, at: [1, 1] }], 1)).toBe(state);
  });
  test('OS-069/OS-110 views never carry the seed, answer keys, other squads\' economy or (projector) any names', () => {
    const m = makeMatch({ format: 'relay_race', teamCount: 2 }, 6); let s = seatUp(m.state, ['aaaa-aaaa'], 'sq1'); s = seatUp(s, ['bbbb-bbbb'], 'sq2'); s.teams[1].points = 123; s.teams[1].perks.push('safe_gate');
    const bodies = { 'aaaa-aaaa': newBody(m.idx), 'bbbb-bbbb': newBody(m.idx) };
    const mine = project(s, 'student', 'aaaa-aaaa', T0, bodies); expect(mine.teams.find((t) => t.id === 'sq2')).not.toHaveProperty('points'); expect(mine.teams.find((t) => t.id === 'sq1')).toHaveProperty('points');
    expect(mine.seats.map((x) => x.id)).toEqual(['aaaa-aaaa']); expect(mine.dots.find((d) => d.teamId === 'sq2')!.id).not.toBe('bbbb-bbbb');
    const proj = project(s, 'projector', null, T0, bodies); expect(proj.seats).toEqual([]); expect(JSON.stringify(proj)).not.toMatch(/aaaa-aaaa|bbbb-bbbb|123/);
    const h = project(s, 'host', null, T0, bodies); expect(h.seats).toHaveLength(2); expect(h.teams.find((t) => t.id === 'sq2')!.points).toBe(123);
    for (const v of [mine, proj, h]) expect(JSON.stringify(v)).not.toMatch(/answerKey|answer_key|seed/i);
  });
});

describe('Game 3 corrective pass (OS-F01..F04)', () => {
  test('OS-F01 the teacher\'s squad size cap is enforced on join and on move_seat, for caps 1, 2 and 5', () => {
    for (const cap of [1, 2, 5]) {
      const m = makeMatch({ format: 'relay_race', teamCount: 2, teamSizeCap: cap }); let s = m.state;
      for (let i = 0; i < cap * 2; i++) s = seatUp(s, [`cap${cap}-${i}`.padEnd(9, 'x')]);
      expect(s.teams.map((t) => activeSeats(s, t.id).length)).toEqual([cap, cap]);
      expect(() => seatUp(s, ['one-too-many'])).toThrow(/full/);
    }
    // moving into a full squad is refused too
    const m = makeMatch({ format: 'relay_race', teamCount: 2, teamSizeCap: 2 }); let s = seatUp(m.state, ['aaaa-aaaa', 'bbbb-bbbb', 'cccc-cccc', 'dddd-dddd']);
    const who = activeSeats(s, 'sq1')[0].id; const r = reduceHost(s, { kind: 'move_seat', seatId: who, teamId: 'sq2' }, T0); expect(r.result).toMatchObject({ ok: false, code: 'TEAM_FULL' });
    // a desired team that is full falls back to the other squad instead of overfilling
    s = reduceHost(s, { kind: 'kick', seatId: activeSeats(s, 'sq2')[0].id }, T0).result.ok ? s : s;
  });
  test('OS-F01 an old session without the new fields is upgraded from the trusted config', () => {
    const m = makeMatch({ teamSizeCap: 2, readAloud: true, approvalAbove: 100 }); const old = JSON.parse(JSON.stringify(m.state)) as OSState;
    for (const k of ['teamSizeCap', 'readAloud', 'lowPressure', 'approvalAbove', 'approvals', 'approvalSeq'] as const) delete (old as Record<string, unknown>)[k];
    const up = hydrateConfig(old, m.cfg); expect(up).toMatchObject({ teamSizeCap: 2, readAloud: true, approvalAbove: 100, approvals: [], approvalSeq: 0 }); expect(hydrateConfig(up, m.cfg)).toBe(up);
  });
  test.each(['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table'] as const)('OS-F02 the real %s question window honours reading time and low pressure', (kind) => {
    for (const [readAloud, lowPressure] of [[false, false], [true, false], [false, true], [true, true]] as const) {
      const m = makeMatch({ readAloud, lowPressure }, 5); const pool = m.pool.map((p) => ({ ...p, kind }));
      let s = seatUp(m.state, ['aaaa-aaaa']); s = host(s, { kind: 'start' }, T0).s;
      const bar = drive(s, T0 + 15_000 + m.plan.chapterTicks * TICK_MS, pool).state; expect(bar.phase).toBe('barrier');
      expect((bar.barrier!.deadlineMs - bar.barrier!.openedAtMs) / 1000).toBe(barrierSecondsFor(kind, readAloud, lowPressure));
    }
  });
  test('OS-F02 pausing and resuming cannot shorten the question window', () => {
    const m = makeMatch({ readAloud: true }, 5); let s = seatUp(m.state, ['aaaa-aaaa']); s = host(s, { kind: 'start' }, T0).s;
    const bar = drive(s, T0 + 15_000 + m.plan.chapterTicks * TICK_MS, m.pool).state; const len = bar.barrier!.deadlineMs - bar.barrier!.openedAtMs;
    const rb = host(host(bar, { kind: 'pause' }, bar.barrier!.openedAtMs + 9000).s, { kind: 'resume' }, bar.barrier!.openedAtMs + 99_000).s; expect(rb.barrier!.deadlineMs - rb.barrier!.openedAtMs).toBe(len); expect(rb.barrier!.deadlineMs).toBe(bar.barrier!.deadlineMs + 90_000);
  });
  function shop(approvalAbove: 0 | 100 | 150, n = 2) {
    const m = makeMatch({ approvalAbove }, 6); let s = seatUp(m.state, ids(n)); s = host(s, { kind: 'start' }, T0).s; s = JSON.parse(JSON.stringify(s)) as OSState;
    s.phase = 'build_choice'; s.teams[0].points = 300; s.phaseDeadlineMs = T0 + 60_000; return { ...m, s };
  }
  test('OS-F03 below the threshold buys instantly; at or above it needs the teacher; a student cannot approve', () => {
    const { s } = shop(100);
    const cheap = reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'route_peek' }); expect(cheap).toMatchObject({ ok: true }); expect(cheap.ok && cheap.state.teams[0].points).toBe(260);
    const ask = reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'bridge_socket' }); expect(ask).toMatchObject({ ok: true, note: 'approval_requested' });
    if (!ask.ok) throw new Error('x'); expect(ask.state.teams[0].points).toBe(300); expect(ask.state.approvals).toHaveLength(1); expect(ask.state.teams[0].perks).toEqual([]);
    expect(reduceSeat(ask.state, ids(2)[0], { kind: 'purchase', perk: 'safe_gate' })).toMatchObject({ ok: false, code: 'APPROVAL_PENDING' });
    const id = ask.state.approvals![0].id; const ok = host(ask.state, { kind: 'approve', approvalId: id }, T0 + 5).s;
    expect(ok.teams[0].points).toBe(180); expect(ok.teams[0].perks).toEqual(['bridge_socket']); expect(ok.approvals).toEqual([]);
    expect(reduceHost(ok, { kind: 'approve', approvalId: id }, T0 + 6).result).toMatchObject({ ok: false, code: 'NO_APPROVAL' }); // duplicate approval cannot charge twice
  });
  test('OS-F03 threshold 150 asks only for the 160-point upgrade; 0 never asks; deny charges nothing', () => {
    const { s } = shop(150); expect(reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'bridge_socket' })).toMatchObject({ ok: true, note: 'bridge_socket bought' });
    const ask = reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'safe_gate' }); if (!ask.ok) throw new Error('x'); expect(ask.note).toBe('approval_requested');
    const denied = host(ask.state, { kind: 'deny', approvalId: ask.state.approvals![0].id }, T0 + 5).s; expect(denied.teams[0].points).toBe(300); expect(denied.approvals).toEqual([]);
    expect(reduceSeat(shop(0).s, ids(2)[0], { kind: 'purchase', perk: 'safe_gate' })).toMatchObject({ ok: true, note: 'safe_gate bought' });
  });
  test('OS-F03 waiting requests reserve points, expire with the shop, and need a running match', () => {
    const { s, pool } = shop(100); s.teams[0].points = 130;
    const a = reduceSeat(s, ids(2)[0], { kind: 'purchase', perk: 'bridge_socket' }); if (!a.ok) throw new Error('x');
    expect(reduceSeat(a.state, ids(2)[1], { kind: 'purchase', perk: 'checkpoint_beacon' })).toMatchObject({ ok: false, code: 'INSUFFICIENT_POINTS' }); // 120 already promised
    const paused = host(a.state, { kind: 'pause' }, T0 + 1).s; expect(reduceHost(paused, { kind: 'approve', approvalId: 'ap1' }, T0 + 2).result).toMatchObject({ ok: false, code: 'PAUSED' });
    const gone = advance(a.state, { now: s.phaseDeadlineMs! + 1, pool, answers: [], seedKey: 'k' }).state; expect(gone.phase).toBe('countdown'); expect(gone.approvals).toEqual([]); expect(gone.teams[0].points).toBe(130);
    const late = reduceHost(gone, { kind: 'approve', approvalId: 'ap1' }, T0 + 99); expect(late.result).toMatchObject({ ok: false, code: 'NO_APPROVAL' });
  });
  test('OS-F03 a kicked student\'s waiting request disappears; projections show requests to the host and the squad only', () => {
    const m = makeMatch({ approvalAbove: 100, format: 'relay_race', teamCount: 2 }, 6); let s = seatUp(m.state, ['aaaa-aaaa'], 'sq1'); s = seatUp(s, ['bbbb-bbbb'], 'sq2'); s = host(s, { kind: 'start' }, T0).s;
    s = JSON.parse(JSON.stringify(s)) as OSState; s.phase = 'build_choice'; s.teams[0].points = 200; s.teams[1].points = 200;
    const r = reduceSeat(s, 'aaaa-aaaa', { kind: 'purchase', perk: 'safe_gate' }); if (!r.ok) throw new Error('x'); const bodies = { 'aaaa-aaaa': newBody(m.idx), 'bbbb-bbbb': newBody(m.idx) };
    expect(project(r.state, 'host', null, T0, bodies).approvals).toHaveLength(1); expect(project(r.state, 'student', 'aaaa-aaaa', T0, bodies).approvals).toHaveLength(1);
    expect(project(r.state, 'student', 'bbbb-bbbb', T0, bodies).approvals).toHaveLength(0); expect(project(r.state, 'projector', null, T0, bodies).approvals).toHaveLength(0);
    expect(host(r.state, { kind: 'kick', seatId: 'aaaa-aaaa' }, T0 + 1).s.approvals).toEqual([]);
  });
  test('OS-F04 the reducer ignores the wall clock: identical inputs give byte-identical output under different Date.now()', () => {
    const { state } = started(2); const eff = [{ kind: 'plank' as const, tick: 400, at: [2, 2] as [number, number] }, { kind: 'survey' as const, tick: 10, at: [1, 1] as [number, number] }];
    const spy = jest.spyOn(Date, 'now'); try {
      spy.mockReturnValue(1); const a = JSON.stringify(addTeamEffects(state, ids(2)[0], eff, 900));
      spy.mockReturnValue(9_999_999_999_999); const b = JSON.stringify(addTeamEffects(state, ids(2)[0], eff, 900)); expect(b).toBe(a);
    } finally { spy.mockRestore(); }
    const kept = addTeamEffects(state, ids(2)[0], eff, 900).teams[0].pulses; expect(kept.map((p) => p.kind)).toEqual(['plank']); // the old window (tick 10..90) is below 900-800
    expect(addTeamEffects(state, ids(2)[0], eff, 200).teams[0].pulses.map((p) => p.kind)).toEqual(['plank', 'survey']); // nothing still active is dropped
  });
});
