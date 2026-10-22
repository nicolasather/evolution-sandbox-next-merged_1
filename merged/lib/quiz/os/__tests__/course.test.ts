/** @jest-environment node */
import { HAZARD_KINDS, MAP_IDS, ROLES, type Course } from '../domain';
import { BASE_COURSES, clearBetween, courseFor, hazardActive, hazardWarning, makeIndex, solve, validateCourse } from '../course';
import { SPEED } from '../balance';
import { runBot } from '../bot';

describe('authored maps', () => {
  test.each(MAP_IDS)('%s passes static validation and has every hazard kind', (m) => {
    expect(validateCourse(BASE_COURSES[m])).toEqual([]);
    const kinds = new Set(BASE_COURSES[m].hazards.map((h) => h.kind));
    for (const k of HAZARD_KINDS) expect(kinds.has(k)).toBe(true);
  });
  test('four maps, three checkpoints each, 32x18', () => {
    expect(MAP_IDS).toHaveLength(4);
    for (const m of MAP_IDS) { expect(BASE_COURSES[m].checkpoints).toHaveLength(3); expect(BASE_COURSES[m].size).toEqual([32, 18]); }
  });
  test('validation rejects broken maps', () => {
    const base: Course = JSON.parse(JSON.stringify(BASE_COURSES.chalkyard_circuit));
    const mut = (f: (c: Course) => void) => { const c: Course = JSON.parse(JSON.stringify(base)); f(c); return validateCourse(c); };
    expect(mut((c) => { c.walkableCells.push(c.walkableCells[0]); })).toContain('duplicate cell');
    expect(mut((c) => { c.hazards[0].tile = [0, 0]; })).toContain('hazard outside walkable course');
    expect(mut((c) => { c.hazards[0].schedule.warningTicks = 1; })).toContain('unsafe hazard schedule');
    expect(mut((c) => { c.hazards[0].schedule.activeTicks = c.hazards[0].schedule.periodTicks - 5; })).toEqual(expect.arrayContaining(['safe interval under 1.5 s']));
    expect(mut((c) => { c.goal = [31, 0]; })).toContain('key location not walkable');
    expect(mut((c) => { c.walkableCells = c.walkableCells.filter(([x]) => x !== 12); })).toContain('goal unreachable');
  });
});
describe('hazard timing', () => {
  const h = BASE_COURSES.chalkyard_circuit.hazards[0];
  test('active/warning/idle are mutually exclusive and periodic', () => {
    const { periodTicks, activeTicks, warningTicks } = h.schedule; let act = 0, warn = 0;
    for (let t = 0; t < periodTicks; t++) { const a = hazardActive(h, t), w = hazardWarning(h, t); expect(a && w).toBe(false); act += a ? 1 : 0; warn += w ? 1 : 0; expect(hazardActive(h, t + periodTicks)).toBe(a); }
    expect(act).toBe(activeTicks); expect(warn).toBe(warningTicks);
  });
  test('the warning always comes right before an active window', () => {
    for (let t = 0; t < 400; t++) if (hazardWarning(h, t) && !hazardWarning(h, t + 1)) expect(hazardActive(h, t + 1)).toBe(true);
  });
  test('clearBetween agrees with brute force', () => {
    for (let from = 0; from < 130; from += 3) for (const len of [1, 5, 20, 45, 90, 300]) {
      let ok = true; for (let t = from; t < from + len; t++) if (hazardActive(h, t)) ok = false;
      expect(clearBetween(h, from, from + len - 1)).toBe(ok);
    }
  });
});
describe('solver and closed-loop bot', () => {
  test.each(MAP_IDS)('%s: every role clears the authored map on the real physics without a hit', (m) => {
    const idx = makeIndex(BASE_COURSES[m]);
    for (const r of ROLES) { const res = runBot(idx, r); expect({ r, reached: res.reached, hits: res.hits }).toEqual({ r, reached: true, hits: 0 }); }
  });
  test('an impossible map is reported as unsolvable', () => {
    const c: Course = JSON.parse(JSON.stringify(BASE_COURSES.chalkyard_circuit));
    // wall the corridor with hazards that are on all the time
    for (const h of c.hazards) { h.schedule.activeTicks = h.schedule.periodTicks - 1; }
    const idx = makeIndex(c); idx.cells.forEach(() => undefined);
    const bad = makeIndex({ ...c, walkableCells: c.expandedSafePath.map((p) => [...p] as [number, number]), hazards: c.hazards.map((h, i) => ({ ...h, tile: c.expandedSafePath[4 + i * 3] })) });
    expect(solve(bad)).toBeNull();
  });
  test('the slowest role is the planning speed', () => { expect(Math.min(...Object.values(SPEED))).toBe(SPEED.shieldbearer); });
});
describe('seeded variation (OS-115 style sweep, 1000 seeds)', () => {
  test('1000 seeds × 4 maps are solvable by the solver for the slowest and fastest role, also from every checkpoint', () => {
    let worst = 0;
    for (let i = 0; i < 1000; i++) for (const m of MAP_IDS) {
      const { idx } = courseFor(m, `sweep-${i}`, i % 7 === 0);
      for (const sp of [SPEED.shieldbearer, SPEED.pathfinder]) { const p = solve(idx, { speed: sp, allowSockets: false }); expect(p).not.toBeNull(); worst = Math.max(worst, p!.arriveTick); }
      for (const cp of idx.course.checkpoints) expect(solve(idx, { from: cp, allowSockets: false })).not.toBeNull();
    }
    expect(worst).toBeLessThan(1500);
  });
  test('the same seed always gives the same course; different seeds change the rhythm but never the geometry', () => {
    const a = courseFor('lantern_harbor', 'abc').idx.course, b = courseFor('lantern_harbor', 'abc').idx.course, c = courseFor('lantern_harbor', 'abd').idx.course;
    expect(a).toEqual(b); expect(a.hazards.map((h) => h.schedule.phaseOffsetTicks)).not.toEqual(c.hazards.map((h) => h.schedule.phaseOffsetTicks));
    expect(a.walkableCells).toEqual(c.walkableCells); expect(a.hazards.map((h) => h.tile)).toEqual(c.hazards.map((h) => h.tile));
  });
  test('closed-loop bot on REAL physics clears 1000 seeds (all 4 maps, roles rotated, start ticks varied)', () => {
    let hits = 0, failed = 0, runs = 0;
    for (let i = 0; i < 1000; i++) for (const m of MAP_IDS) {
      const { idx } = courseFor(m, `bot-${i}`, i % 5 === 0); const role = ROLES[(i + m.length) % 5];
      const r = runBot(idx, role, { startTick: (i * 37) % 900 }); runs++; hits += r.hits; if (!r.reached) failed++;
    }
    expect({ runs, failed, hits }).toEqual({ runs: 4000, failed: 0, hits: 0 });
  });
});
