/** @jest-environment node */
import { applyBatch, idleTo, newBody, OPEN, stepInPlace, type Ctx, type StepOut } from '../physics';
import { BASE_COURSES, makeIndex, centerOf, ck } from '../course';
import { HOP_COOLDOWN_TICKS, MAX_BATCH, ROLE_COOLDOWNS, SPEED } from '../balance';
import type { Body, Input, Role } from '../domain';

const idx = makeIndex(BASE_COURSES.chalkyard_circuit);
const ctxOf = (role: Role = 'trailblazer', extra: Partial<Ctx> = {}): Ctx => ({ idx, role, perks: {}, pulses: [], ...OPEN, seatId: 'seat-aaaa', ...extra });
const out = (): StepOut => ({ events: [], effects: [], denied: { hop: 0, ability: 0 } });
const move = (dx: -1 | 0 | 1, dy: -1 | 0 | 1, hop = false, ability = false): Input => ({ dx, dy, hop, ...(ability ? { ability } : {}) });
const run = (b: Body, inputs: Input[], ctx = ctxOf()) => { const o = out(); const c = { ...b }; for (const i of inputs) stepInPlace(c, i, ctx, o); return { b: c, o }; };
const repeat = (i: Input, n: number) => Array.from({ length: n }, () => i);

describe('movement', () => {
  test('integer speed per role; diagonal is normalised', () => {
    for (const r of Object.keys(SPEED) as Role[]) { const b = newBody(idx); const x0 = b.x; const { b: c } = run(b, [move(1, 0)], ctxOf(r)); expect(c.x - x0).toBe(SPEED[r]); }
    const b = newBody(idx); const { b: d } = run(b, [move(1, 1)]); expect(d.x - b.x).toBe(Math.floor((SPEED.trailblazer * 707) / 1000)); expect(Number.isInteger(d.x)).toBe(true);
  });
  test('walls stop movement and the other axis can still slide', () => {
    const b = newBody(idx); const { b: c } = run(b, repeat(move(-1, 0), 80)); // start is at the left edge of the corridor
    expect(Math.floor(c.x / 1000)).toBeGreaterThanOrEqual(0); expect(idx.cells.has(ck(Math.floor(c.x / 1000), Math.floor(c.y / 1000)))).toBe(true);
    const { b: e } = run(b, repeat(move(-1, -1), 120)); expect(idx.cells.has(ck(Math.floor(e.x / 1000), Math.floor(e.y / 1000)))).toBe(true);
  });
  test('no input sequence can ever leave the walkable set (fuzz, 20000 ticks)', () => {
    let s = 7; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    for (const role of ['trailblazer', 'pathfinder'] as Role[]) {
      let b = newBody(idx); const o = out(); const c = ctxOf(role);
      for (let i = 0; i < 10000; i++) {
        stepInPlace(b, { dx: (Math.floor(rnd() * 3) - 1) as -1 | 0 | 1, dy: (Math.floor(rnd() * 3) - 1) as -1 | 0 | 1, hop: rnd() < 0.1, ability: rnd() < 0.02 }, c, o);
        if (!idx.cells.has(ck(Math.floor(b.x / 1000), Math.floor(b.y / 1000)))) throw new Error(`left the map at tick ${b.tick}: ${b.x},${b.y}`);
        if (b.tick % 2000 === 0) b = { ...b };
      }
    }
  });
  test('a closed gate is a wall and an open one is not', () => {
    const gate = 4; const c = ctxOf('trailblazer', { limits: [gate, Infinity], chapterTicks: 100 });
    const { b } = run(newBody(idx), repeat(move(1, 0), 60), c); expect(idx.dist.get(ck(Math.floor(b.x / 1000), Math.floor(b.y / 1000)))!).toBeLessThanOrEqual(gate);
    const cur = { ...b, tick: 100 }; const { b: after } = run(cur, repeat(move(1, 0), 80), c); expect(after.x).toBeGreaterThan(b.x);
  });
});
describe('determinism (OS-116, OS-117)', () => {
  const script = (n: number): Input[] => { let s = 99; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; return Array.from({ length: n }, () => ({ dx: (Math.floor(r() * 3) - 1) as -1 | 0 | 1, dy: (Math.floor(r() * 3) - 1) as -1 | 0 | 1, hop: r() < 0.08, ability: r() < 0.01 })); };
  test('100-tick replay is byte-identical, also when split into batches', () => {
    const inputs = script(100); const a = run(newBody(idx), inputs).b; const b = run(newBody(idx), inputs).b; expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    let cur = newBody(idx); for (let i = 0; i < 100; i += 25) { const r = applyBatch(cur, i + 1, inputs.slice(i, i + 25), ctxOf(), 1e9); if (!r.ok) throw new Error(r.code); cur = r.state.body; }
    expect(JSON.stringify(cur)).toBe(JSON.stringify(a));
  });
  test('2000-tick stress: all invariants hold every tick', () => {
    const inputs = script(2000); const b = newBody(idx); const o = out(); const c = ctxOf('medic'); let last = 0;
    for (const i of inputs) {
      stepInPlace(b, i, c, o); expect(b.tick).toBe(last + 1); last = b.tick;
      expect(Number.isSafeInteger(b.x) && Number.isSafeInteger(b.y)).toBe(true); expect(b.hits).toBeGreaterThanOrEqual(0); expect(b.maxDist).toBeLessThanOrEqual(idx.totalDist + 2); expect(b.stunUntil - b.tick).toBeLessThanOrEqual(30);
    }
    const again = run(newBody(idx), inputs, ctxOf('medic')).b; expect(JSON.stringify(again)).toBe(JSON.stringify(b));
  });
  test('the result never depends on how the ticks are grouped into requests', () => {
    const inputs = script(240); const whole = run(newBody(idx), inputs).b; let cur = newBody(idx);
    for (const size of [1, 7, 48, 48, 48, 48, 40]) { const from = cur.tick; if (from >= 240) break; const r = applyBatch(cur, from + 1, inputs.slice(from, from + size), ctxOf(), 1e9); if (!r.ok) throw new Error(r.code); cur = r.state.body; }
    expect(cur.tick).toBeGreaterThan(0); const part = run(newBody(idx), inputs.slice(0, cur.tick)).b; expect(JSON.stringify(cur)).toBe(JSON.stringify(part)); expect(whole.tick).toBe(240);
  });
});
describe('batch validation (server rejects forged movement)', () => {
  const ok = (fromTick: number, n: number, body = newBody(idx), max = 1000) => applyBatch(body, fromTick, repeat(move(0, 0), n), ctxOf(), max);
  test('OS-055 future tick, OS-056 old tick, gaps', () => {
    expect(ok(1, 10, newBody(idx), 5)).toMatchObject({ ok: false, code: 'FUTURE_TICK' });
    expect(ok(5, 3)).toMatchObject({ ok: false, code: 'TICK_GAP' });
    const b = { ...newBody(idx), tick: 20 }; expect(ok(10, 3, b)).toMatchObject({ ok: false, code: 'OLD_TICK' }); expect(ok(20, 3, b)).toMatchObject({ ok: false, code: 'OLD_TICK' });
    expect(ok(21, 3, b)).toMatchObject({ ok: true });
  });
  test('OS-064 oversized and empty batches; bad fromTick', () => {
    expect(ok(1, MAX_BATCH + 1)).toMatchObject({ ok: false, code: 'BATCH_SIZE' }); expect(ok(1, 0)).toMatchObject({ ok: false, code: 'BATCH_SIZE' });
    expect(ok(0, 1)).toMatchObject({ ok: false, code: 'TICK_INVALID' }); expect(ok(1.5, 1)).toMatchObject({ ok: false, code: 'TICK_INVALID' });
  });
  test('OS-057 teleports are not expressible: any sample with extra/out-of-range fields is refused', () => {
    const bad = [{ dx: 5, dy: 0, hop: false }, { dx: 0, dy: 0, hop: 'yes' }, { dx: 0.5, dy: 0, hop: false }, null, 7, { dx: 0, dy: 0, hop: false, ability: 'x' }];
    for (const s of bad) expect(applyBatch(newBody(idx), 1, [s], ctxOf(), 100)).toMatchObject({ ok: false, code: 'INPUT_INVALID' });
  });
  test('OS-058 pushing through a wall for a whole batch never moves into it', () => {
    const r = applyBatch(newBody(idx), 1, repeat(move(0, -1), 48), ctxOf(), 100); if (!r.ok) throw new Error(r.code);
    expect(idx.cells.has(ck(Math.floor(r.state.body.x / 1000), Math.floor(r.state.body.y / 1000)))).toBe(true);
  });
});
describe('cooldowns', () => {
  test('OS-059 hop on cooldown has no effect and is counted', () => {
    const b = newBody(idx); const { b: c, o } = run(b, [move(0, 0, true), move(0, 0, true), move(0, 0, true)]);
    expect(c.hopReadyTick).toBe(1 + HOP_COOLDOWN_TICKS); expect(o.denied.hop).toBe(2); expect(c.hopUntil).toBe(1 + 7);
    const { b: d } = run(c, repeat(move(0, 0), HOP_COOLDOWN_TICKS).concat([move(0, 0, true)])); expect(d.hopReadyTick).toBeGreaterThan(c.hopReadyTick);
  });
  test.each(['trailblazer', 'shieldbearer', 'bridgewright', 'pathfinder', 'medic'] as Role[])('OS-060 %s ability honours its cooldown server-side', (role) => {
    const c = ctxOf(role); const { b, o } = run(newBody(idx), [move(0, 0, false, true), move(0, 0, false, true)], c);
    expect(b.abilityReadyTick).toBe(1 + ROLE_COOLDOWNS[role]); expect(o.denied.ability).toBe(1); expect(o.events.filter((e) => e.kind === 'ability')).toHaveLength(1);
    const { b: later, o: o2 } = run({ ...b }, repeat(move(0, 0), ROLE_COOLDOWNS[role] - 2).concat([move(0, 0, false, true)]), c); expect(o2.denied.ability).toBe(0); expect(later.abilityReadyTick).toBeGreaterThan(b.abilityReadyTick);
  });
  test('role abilities do what they say', () => {
    const t = run(newBody(idx), [move(1, 0, false, true)], ctxOf('trailblazer')); expect(t.b.x - newBody(idx).x).toBeGreaterThan(SPEED.trailblazer);
    expect(run(newBody(idx), [move(0, 0, false, true)], ctxOf('shieldbearer')).b.guardUntil).toBeGreaterThan(1);
    for (const [role, kind] of [['bridgewright', 'plank'], ['pathfinder', 'survey'], ['medic', 'recover']] as [Role, string][]) expect(run(newBody(idx), [move(0, 0, false, true)], ctxOf(role)).o.effects.map((e) => e.kind)).toEqual([kind]);
  });
});
describe('hazards', () => {
  const place = (kind: string) => { const h = idx.course.hazards.find((x) => x.kind === kind)!; const b = newBody(idx); b.x = centerOf(h.tile[0]); b.y = centerOf(h.tile[1]); b.safeX = centerOf(h.tile[0] - 1); b.safeY = b.y; b.tick = 0; return { h, b }; };
  const onTick = (h: { schedule: { periodTicks: number; phaseOffsetTicks: number; activeTicks: number } }) => (h.schedule.periodTicks - h.schedule.phaseOffsetTicks) % h.schedule.periodTicks; // first tick where it is active
  test.each(['swipe_bar', 'falling_block', 'rolling_drum', 'spikes', 'pulse_gate', 'laser_grid', 'crumble_tile'])('OS-017.. %s hurts only while active, then grants recovery', (kind) => {
    const { h, b } = place(kind); const t0 = onTick(h); b.tick = t0; // next tick is t0+1 (active)
    const w = { ...b, tick: Math.max(0, t0 - 30 - 1) }; const idle = out(); const c0 = { ...w }; for (let i = w.tick; i < t0 - 2; i++) stepInPlace(c0, move(0, 0), ctxOf(), idle); expect(c0.hits).toBe(0); // quiet while idle/warning
    const hit = { ...b }; const o = out(); stepInPlace(hit, move(0, 0), ctxOf(), o); expect(hit.hits).toBe(1); expect(hit.stunUntil).toBeGreaterThan(hit.tick); expect(hit.invincibleUntil).toBeGreaterThanOrEqual(hit.tick + 18);
    const o2 = out(); for (let i = 0; i < 17; i++) stepInPlace(hit, move(0, 0), ctxOf(), o2); expect(hit.hits).toBe(1); // no chain-hit while recovering
  });
  test('hop clears a hazard, guard dome too, safety rail absorbs once', () => {
    const { h, b } = place('spikes'); b.tick = onTick(h);
    const hop = { ...b }; stepInPlace(hop, move(0, 0, true), ctxOf(), out()); expect(hop.hits).toBe(0);
    const g = { ...b, guardUntil: 99999 }; stepInPlace(g, move(0, 0), ctxOf(), out()); expect(g.hits).toBe(0);
    const r = { ...b }; const o = out(); stepInPlace(r, move(0, 0), ctxOf('trailblazer', { perks: { safety_rail: 1 } }), o); expect(r.hits).toBe(0); expect(r.shieldUsed).toBe(1); expect(o.events.some((e) => e.kind === 'shield')).toBe(true);
  });
  test('a safe-gate window and a plank make hazards harmless; group recovery halves the stun', () => {
    const { h, b } = place('falling_block'); b.tick = onTick(h);
    const safe = { ...b }; stepInPlace(safe, move(0, 0), ctxOf('trailblazer', { pulses: [{ kind: 'safe', from: 0, to: 9999, seatId: 'x' }] }), out()); expect(safe.hits).toBe(0);
    const plank = { ...b }; stepInPlace(plank, move(0, 0), ctxOf('trailblazer', { pulses: [{ kind: 'plank', from: 0, to: 9999, seatId: 'x', at: h.tile }] }), out()); expect(plank.hits).toBe(0);
    const far = { ...b }; stepInPlace(far, move(0, 0), ctxOf('trailblazer', { pulses: [{ kind: 'plank', from: 0, to: 9999, seatId: 'x', at: [h.tile[0] + 9, h.tile[1]] }] }), out()); expect(far.hits).toBe(1);
    const plain = { ...b }; stepInPlace(plain, move(0, 0), ctxOf(), out()); const half = { ...b }; stepInPlace(half, move(0, 0), ctxOf('trailblazer', { perks: { group_recovery: 1 } }), out());
    expect(half.stunUntil - half.tick).toBe(Math.ceil((plain.stunUntil - plain.tick) / 2));
  });
  test('rolling drum sends you back to the last checkpoint; swipe bar to the last safe tile', () => {
    const d = place('rolling_drum'); d.b.tick = onTick(d.h); stepInPlace(d.b, move(0, 0), ctxOf(), out()); expect([Math.floor(d.b.x / 1000), Math.floor(d.b.y / 1000)]).toEqual(idx.course.start);
    const s = place('swipe_bar'); s.b.tick = onTick(s.h); stepInPlace(s.b, move(0, 0), ctxOf(), out()); expect(Math.floor(s.b.x / 1000)).toBe(s.h.tile[0] - 1);
  });
  test('soft hazards never hurt: slime/mud slow, conveyor/wind push, bounce pad launches', () => {
    for (const kind of ['slime', 'mud_chute', 'conveyor', 'wind_fan', 'bounce_pad']) { const { h, b } = place(kind); b.tick = onTick(h); const c = { ...b }; for (let i = 0; i < 30; i++) stepInPlace(c, move(0, 0), ctxOf(), out()); expect(c.hits).toBe(0); }
    const { h, b } = place('slime'); b.tick = onTick(h); const c = { ...b }; stepInPlace(c, move(1, 0), ctxOf(), out()); expect(c.x - b.x).toBeLessThan(SPEED.trailblazer);
    const bp = place('bounce_pad'); bp.b.tick = onTick(bp.h); stepInPlace(bp.b, move(0, 0), ctxOf(), out()); expect(bp.b.hopUntil).toBeGreaterThan(bp.b.tick);
  });
  test('medic recovery window frees a stunned teammate', () => {
    const { h, b } = place('falling_block'); b.tick = onTick(h); const hit = { ...b }; stepInPlace(hit, move(0, 0), ctxOf(), out()); expect(hit.stunUntil).toBeGreaterThan(hit.tick);
    const o = out(); stepInPlace(hit, move(0, 0), ctxOf('trailblazer', { pulses: [{ kind: 'recover', from: 0, to: 9999, seatId: 'm' }] }), o); expect(hit.stunUntil).toBeLessThanOrEqual(hit.tick); expect(hit.rescues).toBe(1);
  });
  test('checkpoints are reached in order and counted once; goal is recorded once', () => {
    const cp = idx.course.checkpoints[0]; const b = newBody(idx); b.x = centerOf(cp[0]) - 90; b.y = centerOf(cp[1]); const c = { ...b };
    const o = out(); for (let i = 0; i < 5; i++) stepInPlace(c, move(1, 0), ctxOf('trailblazer'), o); expect(c.checkpoint).toBeGreaterThanOrEqual(1);
    expect(o.events.filter((e) => e.kind === 'checkpoint')).toHaveLength(1);
    const g = newBody(idx); g.x = centerOf(idx.course.goal[0]); g.y = centerOf(idx.course.goal[1]); const o2 = out(); stepInPlace(g, move(0, 0), ctxOf(), o2); stepInPlace(g, move(0, 0), ctxOf(), o2); expect(g.goalTick).toBe(1); expect(o2.events.filter((e) => e.kind === 'goal')).toHaveLength(1);
  });
});
test('idleTo pads deterministically and marks AFK time', () => { const r = idleTo(newBody(idx), 120, ctxOf()); expect(r.body.tick).toBe(120); expect(r.body.afkTicks).toBe(120); expect(idleTo(newBody(idx), 120, ctxOf()).body).toEqual(r.body); });
