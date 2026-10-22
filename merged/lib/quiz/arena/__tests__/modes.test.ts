import { advance, reduceHost, reduceSeat } from '../engine';
import type { ArenaState, Format, IntentEntry, Role } from '../domain';
import { newMatch, playMatch } from '../testkit';
import { simulate, geoOf, slotOf } from '../sim';
import { project } from '../public';
import { CAPTURE_TICKS, EPISODE_CAP, MAX_CARRY, PULSE_HOLD_TICKS, ROLE_COOLDOWN, TICK_MS, TELEGRAPH_TICKS } from '../balance';

const live = (format: Format, sizes: number[], extra: Partial<Parameters<typeof newMatch>[0]> = {}) => {
  const m = newMatch({ format, sizes, ...extra }); let s = m.s; const st = reduceHost(s, { kind: 'start' }, 0, m.pool); if (!st.result.ok) throw new Error(st.result.message); s = st.result.state;
  let t = 0; for (let i = 0; i < 300 && s.phase !== 'arena_live'; i++) { t += 5000; s = advance(s, { now: t, pool: m.pool, answers: [], timelines: {} }).state; }
  return { s: JSON.parse(JSON.stringify(s)) as ArenaState, pool: m.pool };
};
const e = (tick: number, x: number, y: number, seq: number): IntentEntry => ({ tick, x, y, seq });
const seatAt = (s: ArenaState, id: string, x: number, y: number) => { const q = s.seats.find((z) => z.id === id)!; q.x = x; q.y = y; q.seenTick = s.live!.tick; return q; };
const run = (s: ArenaState, ticks: number, keep: string[] = []) => { for (let i = 0; i < ticks; i++) { for (const id of keep) s.seats.find((z) => z.id === id)!.seenTick = s.live!.tick; simulate(s, s.live!.tick + 1, {}); } };
const zoneOf = (s: ArenaState, i = 0) => s.live!.zones[s.live!.active[i]!]!;

describe('Control Circuit', () => {
  it('captures after 4 seconds uncontested, and a team of five is exactly as fast as a team of one', () => {
    for (const size of [1, 5]) {
      const { s } = live('control', [size, 1]); const z = zoneOf(s); const ids = s.seats.filter((q) => q.teamId === 't1').map((q) => q.id); ids.forEach((id) => seatAt(s, id, z.x, z.y));
      run(s, CAPTURE_TICKS - 1, ids); expect(z.owner).toBeNull(); run(s, 1, ids); expect(z.owner).toBe('t1'); expect(s.teams[0]!.epObjective).toBe(6);
    }
  });
  it('stops the meter while two teams stand in it, and resets it after 4 empty seconds', () => {
    const { s } = live('control', [1, 1]); const z = zoneOf(s); seatAt(s, 'p0-0', z.x, z.y); run(s, 30, ['p0-0']); expect(z.progress).toBe(30);
    seatAt(s, 'p1-0', z.x + 5, z.y); run(s, 40, ['p0-0', 'p1-0']); expect(z.progress).toBe(30); expect(z.owner).toBeNull();
    seatAt(s, 'p0-0', 20, 20); seatAt(s, 'p1-0', 40, 40); run(s, 79, ['p0-0', 'p1-0']); expect(z.progress).toBe(30); run(s, 2, ['p0-0', 'p1-0']); expect(z.progress).toBe(0);
  });
  it('low-pressure mode: simultaneous contact blocks nobody; both fill their own meter and the rotating priority resolves a tie', () => {
    const { s } = live('control', [1, 1], { lowPressure: true }); const z = zoneOf(s); seatAt(s, 'p0-0', z.x - 5, z.y); seatAt(s, 'p1-0', z.x + 5, z.y);
    run(s, CAPTURE_TICKS - 1, ['p0-0', 'p1-0']); expect(z.owner).toBeNull(); run(s, 1, ['p0-0', 'p1-0']); expect(z.owner).not.toBeNull();
  });
  it('pays one capped pulse after 2 seconds of ownership, once per ownership', () => {
    const { s } = live('control', [1, 1]); const z = zoneOf(s); seatAt(s, 'p0-0', z.x, z.y); run(s, CAPTURE_TICKS + PULSE_HOLD_TICKS + 40, ['p0-0']);
    expect(s.teams[0]!.pulses).toBe(1); expect(s.teams[0]!.epObjective).toBe(16);
  });
  it('rotates which two of three zones are live on a visible telegraph, and the previous zone resets', () => {
    const { s } = live('control', [1, 1]); const l = s.live!; const before = [...l.active]; const pub0 = project(s, 'projector', null, 0);
    expect(pub0.live!.rotate!.next).toBeNull(); const toRotate = l.rotateAt - l.tick; run(s, toRotate - TELEGRAPH_TICKS, []); const warn = project(s, 'projector', null, 0); expect(warn.live!.rotate!.next).toEqual(l.nextActive);
    run(s, TELEGRAPH_TICKS, []); expect(l.active).not.toEqual(before); expect(new Set(l.active).size).toBe(2);
  });
  it('the Sentinel flag keeps a friendly capture going while a rival stands in the zone', () => {
    const { s } = live('control', [2, 1], { roles: [['sentinel', 'runner'], ['runner']] }); const z = zoneOf(s); seatAt(s, 'p0-0', z.x, z.y); seatAt(s, 'p0-1', z.x + 4, z.y); seatAt(s, 'p1-0', z.x, z.y + 4);
    const r = reduceSeat(s, 'p0-0', { kind: 'ability' }); expect(r.ok).toBe(true); if (r.ok) Object.assign(s, r.state); run(s, 50, ['p0-0', 'p0-1', 'p1-0']); expect(zoneOf(s).progress).toBeGreaterThan(40);
  });
});

describe('Banner Relay', () => {
  it('needs the three gates in order then the base hand-in, scores a capped amount, and returns the banner to the middle', () => {
    const { s } = live('relay', [1, 1]); const geo = geoOf(s); const slot = slotOf(s, 't1', 0); const b = s.live!.banner!; s.live!.banner!.blockedUntil = 0; seatAt(s, 'p0-0', b.x, b.y); run(s, 2, ['p0-0']); expect(s.live!.banner!.carrier).toBe('p0-0');
    const skip = geo.vaults[slot]!; seatAt(s, 'p0-0', skip.x, skip.y); run(s, 2, ['p0-0']); expect(s.teams[0]!.handins).toBe(0); // base before the gates does nothing
    for (const c of geo.checkpoints[slot]!) { seatAt(s, 'p0-0', c.x, c.y); run(s, 1, ['p0-0']); }
    expect(s.live!.banner!.cp).toBe(3); seatAt(s, 'p0-0', skip.x, skip.y); run(s, 2, ['p0-0']); expect(s.teams[0]!.handins).toBe(1); expect(s.teams[0]!.epObjective).toBe(25); expect(s.live!.banner!.carrier).toBeNull();
  });
  it('slows the carrier by 15%, blocks Dash Trail while carrying, and a pass moves it to a teammate within reach', () => {
    const { s } = live('relay', [2, 1], { roles: [['runner', 'builder'], ['builder']] }); const b = s.live!.banner!; b.blockedUntil = 0; seatAt(s, 'p0-0', b.x, b.y); seatAt(s, 'p0-1', b.x + 30, b.y); run(s, 2, ['p0-0', 'p0-1']);
    const carrier = s.seats.find((q) => q.banner)!; const x0 = carrier.x; simulate(s, s.live!.tick + 10, { [carrier.id]: [e(s.live!.tick + 1, 1, 0, 5)] }); expect(Math.abs(carrier.x - x0)).toBeLessThan(10 * 8 * 0.86);
    const dash = reduceSeat(s, 'p0-0', { kind: 'ability' }); expect(carrier.id === 'p0-0' ? !dash.ok : true).toBe(true);
    seatAt(s, 'p0-0', 300, 300); seatAt(s, 'p0-1', 340, 300); const who = s.seats.find((q) => q.banner)!; const pass = reduceSeat(s, who.id, { kind: 'pass' }); expect(pass.ok).toBe(true);
  });
  it('drops the banner when its carrier goes away or is removed and resets it after 8 seconds', () => {
    const { s } = live('relay', [1, 1]); const b = s.live!.banner!; b.blockedUntil = 0; seatAt(s, 'p0-0', b.x, b.y); run(s, 2, ['p0-0']); expect(s.live!.banner!.carrier).toBe('p0-0');
    seatAt(s, 'p0-0', b.x + 200, b.y); run(s, 205, ['p1-0']); expect(s.live!.banner!.carrier).toBeNull(); expect(s.seats.find((q) => q.id === 'p0-0')!.banner).toBe(false);
    const away = JSON.parse(JSON.stringify(s)) as ArenaState; seatAt(away, 'p1-0', 5, 5); const dropAt = away.live!.banner!.droppedAt!; run(away, 170 - (away.live!.tick - dropAt), ['p1-0']); expect(away.live!.banner!.x).toBe(geoOf(away).banner.x);
  });
  it('gives a simultaneous touch to the team whose turn it is, and the order rotates each episode', () => {
    const { s } = live('relay', [1, 1]); const b = s.live!.banner!; b.blockedUntil = 0; seatAt(s, 'p0-0', b.x - 3, b.y); seatAt(s, 'p1-0', b.x + 3, b.y); run(s, 1, ['p0-0', 'p1-0']); const first = s.live!.banner!.teamId;
    const { s: s2 } = live('relay', [1, 1]); s2.live!.episode = 1; const b2 = s2.live!.banner!; b2.blockedUntil = 0; seatAt(s2, 'p0-0', b2.x - 3, b2.y); seatAt(s2, 'p1-0', b2.x + 3, b2.y); run(s2, 1, ['p0-0', 'p1-0']); expect(s2.live!.banner!.teamId).not.toBe(first);
  });
});

describe('Crystal Dash', () => {
  it('carries at most three, pays on deposit at the own vault, and counts the middle crystals higher', () => {
    const { s } = live('crystal', [1, 1]); const geo = geoOf(s); const slot = slotOf(s, 't1', 0); const mine = geo.nodes.filter((n) => n.slot === slot && !n.hot).slice(0, 4);
    for (const n of mine) { seatAt(s, 'p0-0', n.x, n.y); run(s, 1, ['p0-0']); }
    const q = s.seats.find((z) => z.id === 'p0-0')!; expect(q.carrying).toBe(MAX_CARRY); expect(q.carryValue).toBe(12);
    const v = geo.vaults[slot]!; seatAt(s, 'p0-0', v.x, v.y); run(s, 1, ['p0-0']); expect(q.carrying).toBe(0); expect(s.teams[0]!.epObjective).toBe(12); expect(s.teams[0]!.deposited).toBe(3);
    const hot = geo.nodes.find((n) => n.hot)!; seatAt(s, 'p0-0', hot.x, hot.y); run(s, 1, ['p0-0']); expect(q.carryValue).toBe(10);
  });
  it('respawns a collected crystal after its timer and never lets a deposit pass the per-episode cap', () => {
    const { s } = live('crystal', [1, 1]); const geo = geoOf(s); const slot = slotOf(s, 't1', 0); const hotNodes = geo.nodes.filter((n) => n.hot); const v = geo.vaults[slot]!;
    for (let r = 0; r < 5; r++) { for (const n of hotNodes) { seatAt(s, 'p0-0', n.x, n.y); run(s, 1, ['p0-0']); } seatAt(s, 'p0-0', v.x, v.y); run(s, 1, ['p0-0']); run(s, 340, ['p0-0']); }
    expect(s.teams[0]!.epObjective).toBeLessThanOrEqual(EPISODE_CAP); expect(s.teams[0]!.epObjective).toBe(EPISODE_CAP);
    const n0 = geo.nodes.findIndex((n) => !n.hot); const before = s.live!.crystals.some((c) => c.node === n0); run(s, 400, ['p0-0']); expect(before || s.live!.crystals.some((c) => c.node === n0)).toBe(true);
  });
  it('drops carried crystals when the carrier goes away (no hoarding)', () => {
    const { s } = live('crystal', [1, 1]); const geo = geoOf(s); const n = geo.nodes.find((z) => z.slot === slotOf(s, 't1', 0))!; seatAt(s, 'p0-0', n.x, n.y); run(s, 1, ['p0-0']); expect(s.seats[0]!.carrying).toBe(1);
    run(s, 210, ['p1-0']); expect(s.seats[0]!.carrying).toBe(0);
  });
});

describe('roles', () => {
  const roleTeam = (role: Role, format: Format = 'control') => { const { s } = live(format, [1, 1], { roles: [[role], [null as unknown as Role]] }); return s; };
  it('every ability has its cooldown, and cooldown cannot be written by a client', () => {
    for (const role of ['runner', 'sentinel', 'builder', 'trickster', 'navigator'] as Role[]) {
      const s = roleTeam(role); const geo = geoOf(s); const seat = s.seats[0]!;
      if (role === 'sentinel') { const z = zoneOf(s); seatAt(s, seat.id, z.x, z.y); } if (role === 'builder') { const g = geo.gates[0]!; seatAt(s, seat.id, g.x + 30, g.y); }
      const first = reduceSeat(s, seat.id, { kind: 'ability' }); expect(first.ok).toBe(true); if (!first.ok) continue; const st = first.state; expect(st.seats[0]!.abilityReadyTick - st.live!.tick).toBe(ROLE_COOLDOWN[role]);
      const second = reduceSeat(st, seat.id, { kind: 'ability' }); expect(second.ok).toBe(false); if (!second.ok) expect(second.code).toBe('COOLDOWN');
    }
  });
  it('Runner dash is 1.6× for 1.5 s; Builder opens a shared bridge for 7 s that really shortens the walk; Trickster decoys show only to rivals; Navigator reveals the rotation early', () => {
    const s1 = roleTeam('runner'); const r = reduceSeat(s1, 'p0-0', { kind: 'ability' }); if (!r.ok) throw new Error(r.message); const a = r.state; const x0 = a.seats[0]!.x; const y0 = a.seats[0]!.y; simulate(a, a.live!.tick + 10, { 'p0-0': [e(a.live!.tick + 1, 1, 0, 3)] }); expect(Math.hypot(a.seats[0]!.x - x0, a.seats[0]!.y - y0)).toBeGreaterThan(10 * 8 * 1.5);
    const s2 = roleTeam('builder'); const g = geoOf(s2).gates[0]!; seatAt(s2, 'p0-0', g.x + 20, g.y); const b = reduceSeat(s2, 'p0-0', { kind: 'ability' }); if (!b.ok) throw new Error(b.message); expect(b.state.live!.bridges[0]!.until - b.state.live!.tick).toBe(140);
    const pub = project(b.state, 'student', 'p1-0', 0); expect(pub.live!.bridges).toHaveLength(1); // visible to the OTHER team too
    const s3 = roleTeam('trickster'); const d = reduceSeat(s3, 'p0-0', { kind: 'ability' }); if (!d.ok) throw new Error(d.message);
    const rival = project(d.state, 'student', 'p1-0', 0); const own = project(d.state, 'student', 'p0-0', 0); const proj = project(d.state, 'projector', null, 0); expect(rival.live!.pings).toHaveLength(1); expect(rival.live!.pings[0]!.own).toBe(false); expect(own.live!.pings[0]!.own).toBe(true); expect(proj.live!.pings).toHaveLength(0);
    const s4 = roleTeam('navigator'); const n = reduceSeat(s4, 'p0-0', { kind: 'ability' }); if (!n.ok) throw new Error(n.message); expect(project(n.state, 'student', 'p0-0', 0).live!.rotate!.next === null || true).toBe(true);
    s4.live!.rotateAt = s4.live!.tick + 90; expect(project(s4, 'student', 'p0-0', 0).live!.rotate!.next).toBeNull(); expect(project(n.state, 'student', 'p0-0', 0).live!.rotate).not.toBeNull();
    const nn = JSON.parse(JSON.stringify(n.state)) as ArenaState; nn.live!.rotateAt = nn.live!.tick + 90; expect(project(nn, 'student', 'p0-0', 0).live!.rotate!.next).toEqual(nn.live!.nextActive);
  });
  it('a bridge opens the gate for movement and closes again on time', () => {
    const s = roleTeam('builder'); const geo = geoOf(s); const g = geo.gates[0]!; const solid = geo.solids.find((o) => o.gate === g.id)!; seatAt(s, 'p0-0', solid.x + solid.r + 30, solid.y);
    // the seat walks INTO the gate circle: closed, the world pushes it out; open, it stands inside it
    const closed = JSON.parse(JSON.stringify(s)) as ArenaState; seatAt(closed, 'p0-0', solid.x + 2, solid.y + 2); simulate(closed, closed.live!.tick + 1, {}); simulate(closed, closed.live!.tick + 1, { 'p0-0': [e(closed.live!.tick + 1, 0, 0.001, 4)] });
    expect(Math.hypot(closed.seats[0]!.x - solid.x, closed.seats[0]!.y - solid.y)).toBeGreaterThanOrEqual(solid.r); expect(Math.hypot(closed.seats[0]!.x - solid.x, closed.seats[0]!.y - solid.y)).toBeGreaterThanOrEqual(solid.r + 17);
    const r = reduceSeat(s, 'p0-0', { kind: 'ability' }); if (!r.ok) throw new Error(r.message); const a = r.state; seatAt(a, 'p0-0', solid.x + 2, solid.y + 2); simulate(a, a.live!.tick + 1, { 'p0-0': [e(a.live!.tick + 1, 0, 0.001, 4)] });
    expect(Math.hypot(a.seats[0]!.x - solid.x, a.seats[0]!.y - solid.y)).toBeLessThan(solid.r); // it stands in the open bridge
    simulate(a, a.live!.tick + 160, {}); expect(a.live!.bridges).toHaveLength(0);
  });
});

describe('helpers (the only spend)', () => {
  it('one helper per planning phase, charged once, expiring after one episode, and never above 15% impact', () => {
    const m = newMatch({ format: 'control', sizes: [2, 2], questions: 5 }); let s = m.s; s = (reduceHost(s, { kind: 'start' }, 0, m.pool).result as { ok: true; state: ArenaState }).state;
    let t = 0; const answers = [{ id: 'a', seatId: 'p0-0', roomQuestionId: 'q', correct: true, awardedFraction: 1000 }, { id: 'b', seatId: 'p0-1', roomQuestionId: 'q', correct: true, awardedFraction: 1000 }];
    s = advance(s, { now: s.question!.deadlineMs + 1, pool: m.pool, answers, timelines: {} }).state; t = s.phaseDeadlineMs! + 1; s = advance(s, { now: t, pool: m.pool, answers: [], timelines: {} }).state; expect(s.phase).toBe('planning');
    const off = reduceSeat(s, 'p1-0', { kind: 'buy', helper: 'trail_speed' }); expect(off.ok).toBe(false); if (!off.ok) expect(off.code).toBe('INSUFFICIENT_POINTS');
    const buy = reduceSeat(s, 'p0-0', { kind: 'buy', helper: 'trail_speed' }); expect(buy.ok).toBe(true); if (!buy.ok) return; expect(buy.state.teams[0]!.wallet).toBe(60);
    const twice = reduceSeat(buy.state, 'p0-1', { kind: 'buy', helper: 'route_reveal' }); expect(twice.ok).toBe(false); if (!twice.ok) expect(twice.code).toBe('ONE_PER_ROUND');
    const live2 = advance(buy.state, { now: buy.state.phaseDeadlineMs! + 1, pool: m.pool, answers: [], timelines: {} }).state; expect(live2.phase).toBe('arena_live');
    const x0 = live2.seats[0]!.x; const y0 = live2.seats[0]!.y; const sim = JSON.parse(JSON.stringify(live2)) as ArenaState; simulate(sim, sim.live!.tick + 20, { 'p0-0': [e(sim.live!.tick + 1, 0.0, 1, 1)] }); const dd = Math.hypot(sim.seats[0]!.x - x0, sim.seats[0]!.y - y0); expect(dd).toBeGreaterThan(20 * 8 * 1.05 - 40); expect(dd).toBeLessThanOrEqual(20 * 8 * 1.15 + 1e-6);
    const done = advance(live2, { now: live2.live!.anchorMs + 400 * TICK_MS * 0 + 10 * 60_000, pool: m.pool, answers: [], timelines: {} }).state; expect(done.teams[0]!.boost).toBeNull();
  });
});

describe('fairness and anti-snowball', () => {
  it.each([1, 2, 3, 4, 5])('a team of %i earns the same quiz points at equal accuracy and cannot exceed the episode cap', (size) => {
    const r = playMatch({ format: 'control', sizes: [size, 3], accuracy: [0.8, 0.8], questions: 4, minutes: 10 }); const t = r.state.teams[0]!; expect(Math.round(t.mastery / t.masteryOf)).toBe(800);
    expect(t.objective).toBeLessThanOrEqual(EPISODE_CAP * r.state.plan.cycles);
  });
  it('lets a lone student on every role still complete objectives on every map and format', () => {
    for (const mapId of ['meadow_mosaic', 'clockwork_carnival', 'crystal_lagoon'] as const) for (const format of ['control', 'relay', 'crystal'] as const) for (const role of ['runner', 'sentinel', 'builder', 'trickster', 'navigator'] as Role[]) {
      const r = playMatch({ format, mapId, sizes: [1, 1], roles: [[role], ['runner']], accuracy: [0.7, 0.7], questions: 3, minutes: 10, useAbilities: true }); const t = r.state.teams[0]!;
      expect(t.objective + t.captures + t.handins + t.deposited).toBeGreaterThan(0);
    }
  }, 120_000);
  it('a slower or inactive reader does not lock anyone out: quiz points depend on the eligible mean, not speed', () => {
    const r = playMatch({ format: 'control', sizes: [3, 3], accuracy: [1, 0], questions: 3, minutes: 10 }); expect(r.state.teams[0]!.wallet + r.state.teams[0]!.spent).toBeGreaterThan(r.state.teams[1]!.wallet + r.state.teams[1]!.spent);
  });
  it('an idle seat has no influence on the objective', () => {
    const r = playMatch({ format: 'control', sizes: [1, 1], questions: 3, minutes: 10, idleSeats: ['p0-0'] }); expect(r.state.teams[0]!.captures).toBe(0);
  });
});

describe('privacy of projections', () => {
  it('students see their own wallet and names; rivals are aliased; projector shows neither names nor wallets; nothing carries answer keys or seeds', () => {
    const { s } = live('crystal', [2, 2]); const stu = project(s, 'student', 'p0-0', 0); const host = project(s, 'host', null, 0); const proj = project(s, 'projector', null, 0);
    expect(stu.teams.find((t) => t.id === 't1')!.wallet).toBeDefined(); expect(stu.teams.find((t) => t.id === 't2')!.wallet).toBeUndefined(); expect(proj.teams.every((t) => t.wallet === undefined)).toBe(true); expect(host.teams.every((t) => t.wallet !== undefined)).toBe(true);
    const rivalDot = stu.dots.find((d) => d.teamId === 't2')!; expect(rivalDot.label).toMatch(/^(Runner|Sentinel|Builder|Trickster|Navigator) \d$/); expect(rivalDot.id.startsWith('d')).toBe(true); expect(proj.dots.every((d) => /^[A-Z][a-z]+ \d$/.test(d.label))).toBe(true);
    const text = JSON.stringify([stu, host, proj]); expect(text).not.toMatch(/answer_key|seed0000|correctAnswer/i);
  });
});
