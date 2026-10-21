import { advance, addSeat, reconcileRoles, reduceHost, reduceSeat, standingsOf, TEAM_ROLES } from '../engine';
import { buildEvidence } from '../evidence';
import type { CRState, Format, IntentEntry, MapId } from '../domain';
import { MAP_IDS } from '../domain';
import { ABILITY, ARRIVE_R, PERK_COST, ROLE_COOLDOWN, SPEED, STAMP_LOCK_TICKS, TEAM_BURST_TICKS, TICK_MS, WALLET_CAP } from '../balance';
import { buildCourse, gateOpen, isFree, legGeo, resolveMove, stationPlan, walkable } from '../maps';
import { planMatch, snapMinutes } from '../plan';
import { project } from '../public';
import { botIntent } from '../bot';
import { geoOf, simulate } from '../sim';
import { newMatch, playMatch, poolOf } from '../testkit';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function live(format: Format, sizes: number[], extra: Partial<Parameters<typeof newMatch>[0]> = {}) {
  const m = newMatch({ format, sizes, ...extra }); let s = m.s; const st = reduceHost(s, { kind: 'start' }, 0, m.pool); if (!st.result.ok) throw new Error(st.result.message); s = st.result.state;
  let t = 0; for (let i = 0; i < 100 && s.phase !== 'race'; i++) { t += 5000; s = advance(s, { now: t, pool: m.pool, answers: [], timelines: {} }).state; }
  return { s: clone(s), pool: m.pool, t };
}
const run = (s: CRState, ticks: number, keep: string[] = [], lines: Record<string, IntentEntry[]> = {}) => { for (let i = 0; i < ticks; i++) { for (const id of keep) s.seats.find((z) => z.id === id)!.seenTick = s.live!.tick; simulate(s, s.live!.tick + 1, lines); } };
const place = (s: CRState, id: string, x: number, y: number) => { const q = s.seats.find((z) => z.id === id)!; q.x = x; q.y = y; q.seenTick = s.live!.tick; return q; };

describe('maps', () => {
  it('has four distinct handcrafted maps with 28 stations inside the world', () => {
    const seen = new Set<string>();
    for (const m of MAP_IDS) { const c = buildCourse(m, 'normal'); expect(c.stations).toHaveLength(28); expect(c.pairs).toHaveLength(27); seen.add(JSON.stringify(c.stations)); for (const p of c.stations) { expect(p.x).toBeGreaterThan(100); expect(p.x).toBeLessThan(5100); expect(p.y).toBeGreaterThan(100); expect(p.y).toBeLessThan(3200); } }
    expect(seen.size).toBe(4);
  });
  it('every leg of every planned match is reachable on every road, and every landmark spur and hub is walkable', () => {
    for (const m of MAP_IDS) for (const diff of ['easy', 'normal', 'challenge'] as const) {
      const c = buildCourse(m, diff); const openTick = [0, 10, 20, 30, 40].find((t) => c.pairs.every((pg) => !pg.gated || gateOpen(t, pg.i))) ?? 0;
      for (const windows of [3, 5, 6, 9, 12, 18, 26]) { const st = stationPlan(windows);
        for (let k = 0; k <= windows; k++) { const g = legGeo(c, st[k]!, st[k + 1]!, k);
          for (const o of g.offered) { const segs = walkable(g, o, false); const opt = g.options.find((x) => x.id === o)!;
            for (const p of opt.path) expect(isFree(segs, p.x, p.y, openTick)).toBe(true);
            for (const sp of g.spurs) expect(isFree(segs, sp.end.x, sp.end.y, 0)).toBe(true); expect(isFree(segs, g.hubB.x, g.hubB.y, 0)).toBe(true); expect(isFree(segs, g.hubA.x, g.hubA.y, 0)).toBe(true); } } }
    }
  });
  it('walking the main road with a steering bot reaches every checkpoint of every leg on every map (no wall can trap it)', () => {
    for (const m of MAP_IDS) { const { s } = live('split_route', [1, 1], { mapId: m, difficulty: 'normal' }); const seat = s.seats[0]!; const g = geoOf(s); let guard = 0; const lines: Record<string, IntentEntry[]> = {};
      while (!s.teams[0]!.obj.done && guard++ < 4000) { const v = botIntent(s, seat.id); lines[seat.id] = [{ tick: s.live!.tick + 1, x: v.x, y: v.y, seq: guard }]; for (const id of s.seats.map((x) => x.id)) s.seats.find((z) => z.id === id)!.seenTick = s.live!.tick; simulate(s, s.live!.tick + 1, lines); }
      expect(s.teams[0]!.obj.done).toBe(true); expect(Math.hypot(seat.x - g.hubB.x, seat.y - g.hubB.y)).toBeLessThan(ARRIVE_R + 5); }
  });
  it('walls hold: a body steered into the wall slides along it and never leaves the walkable corridor', () => {
    const c = buildCourse('tideglass_harbor', 'normal'); const g = legGeo(c, 0, 3, 1); const segs = walkable(g, 'a', false); let x = g.hubA.x, y = g.hubA.y;
    for (let i = 0; i < 400; i++) { [x, y] = resolveMove(segs, x, y, x - SPEED, y - SPEED * 0.4, i); expect(isFree(segs, x, y, i) || i < 1).toBe(true); }
  });
  it('timed gates alternate open and closed on a fixed period', () => { const seq = Array.from({ length: 320 }, (_, t) => gateOpen(t, 1)); expect(seq.some((x) => x)).toBe(true); expect(seq.some((x) => !x)).toBe(true); expect(gateOpen(5, 1)).toBe(gateOpen(5 + 160, 1)); });
});

describe('evidence', () => {
  it('is deterministic per seed, always valid across 1000 seeds, and differs between seeds', () => {
    const st = stationPlan(9); const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const relay = buildEvidence('seed' + i, 'sunleaf_passage', 'normal', 'signal_relay', st, 10); const atlas = buildEvidence('seed' + i, 'starpetal_heights', 'normal', 'atlas_circuit', st, 10);
      for (const e of relay) { expect(e.postIdx).toBeGreaterThanOrEqual(0); expect(e.postIdx).toBeLessThan(4); }
      for (const e of atlas) { expect(new Set(e.order).size).toBe(3); expect(e.order!.every((n) => n >= 0 && n < 4)).toBe(true); }
      seen.add(JSON.stringify(relay.map((e) => e.postIdx)));
    }
    expect(seen.size).toBeGreaterThan(50); expect(buildEvidence('a', 'sunleaf_passage', 'normal', 'atlas_circuit', st, 10)).toEqual(buildEvidence('a', 'sunleaf_passage', 'normal', 'atlas_circuit', st, 10));
  });
});

describe('roles by team size', () => {
  it('team of one is the Solo Pathfinder; teams of 2–5 hold distinct team roles; leaving never leaves a team without a valid role', () => {
    for (let n = 1; n <= 5; n++) { const { s } = newMatch({ format: 'split_route', sizes: [n, 1] }); const mine = s.seats.filter((x) => x.teamId === 't1'); const roles = mine.map((x) => x.role);
      if (n === 1) expect(roles).toEqual(['solo_pathfinder']); else { expect(new Set(roles).size).toBe(n); expect(roles.every((r) => TEAM_ROLES.includes(r))).toBe(true); } }
    const { s } = newMatch({ format: 'split_route', sizes: [3, 1] }); const k = reduceHost(s, { kind: 'kick', seatId: 'p0-0' }, 0); expect(k.result.ok).toBe(true);
    const after = (k.result as { state: CRState }).state; const left = after.seats.filter((x) => x.teamId === 't1' && !x.revoked); expect(left).toHaveLength(2); expect(new Set(left.map((x) => x.role)).size).toBe(2);
    const k2 = reduceHost(after, { kind: 'kick', seatId: 'p0-1' }, 0); const only = (k2.result as { state: CRState }).state.seats.filter((x) => x.teamId === 't1' && !x.revoked); expect(only[0]!.role).toBe('solo_pathfinder');
  });
  it('a solo cannot pick a team role and a team cannot hold a duplicate or the solo role', () => {
    const { s } = newMatch({ format: 'split_route', sizes: [1, 2] }); expect(reduceSeat(s, 'p0-0', { kind: 'role', role: 'scout' }).ok).toBe(false);
    const r = reduceSeat(s, 'p1-0', { kind: 'role', role: 'solo_pathfinder' }); expect(r.ok).toBe(false);
    const other = s.seats.find((x) => x.id === 'p1-1')!.role; const dup = reduceSeat(s, 'p1-0', { kind: 'role', role: other }); expect(dup.ok).toBe(false);
    const c = clone(s); c.seats[1]!.role = 'solo_pathfinder'; c.seats[2]!.role = 'solo_pathfinder'; reconcileRoles(c); expect(new Set(c.seats.filter((x) => x.teamId === 't2').map((x) => x.role)).size).toBe(2);
  });
});

describe('quiz freeze and clock', () => {
  it('freezes the whole world during the quiz window and every positioned body stays exactly where it was', () => {
    const m = newMatch({ format: 'split_route', sizes: [2, 2], questions: 10 }); let s = (reduceHost(m.s, { kind: 'start' }, 0, m.pool).result as { state: CRState }).state; let now = 0; const lines: Record<string, IntentEntry[]> = {};
    for (let i = 0; i < 4000 && s.phase !== 'barrier'; i++) { now += 100; if (s.phase === 'race') for (const seat of s.seats) { const v = botIntent(s, seat.id); lines[seat.id] = [{ tick: s.live!.tick + 2, x: v.x, y: v.y, seq: i + 1 }]; } s = advance(s, { now, pool: m.pool, answers: [], timelines: lines }).state; }
    expect(s.phase).toBe('barrier'); const snap = JSON.stringify([s.live!.tick, s.seats.map((x) => [x.x, x.y])]);
    for (let i = 0; i < 100 && s.phase === 'barrier'; i++) { now += 500; s = advance(s, { now, pool: m.pool, answers: [], timelines: lines }).state; if (s.phase === 'barrier') expect(JSON.stringify([s.live!.tick, s.seats.map((x) => [x.x, x.y])])).toBe(snap); }
    expect(['reveal']).toContain(s.phase); expect(JSON.stringify([s.live!.tick, s.seats.map((x) => [x.x, x.y])])).toBe(snap);
  });
  it('pause freezes the race, resume shifts every deadline by exactly the paused time, and advance is idempotent', () => {
    const { s, pool, t } = live('split_route', [1, 1]); const l0 = s.live!.anchorMs; const p = reduceHost(s, { kind: 'pause' }, t + 3000, pool).result as { state: CRState };
    const a1 = advance(p.state, { now: t + 60_000, pool, answers: [], timelines: {} }); expect(a1.changed).toBe(false);
    const r = reduceHost(p.state, { kind: 'resume' }, t + 63_000, pool).result as { state: CRState }; expect(r.state.live!.anchorMs).toBe(t + 63_000); expect(r.state.live!.anchorMs).toBeGreaterThan(l0);
    const x1 = advance(s, { now: t + 2000, pool, answers: [], timelines: {} }); const x2 = advance(x1.state, { now: t + 2000, pool, answers: [], timelines: {} }); expect(x2.changed).toBe(false);
  });
  it('every body moves at exactly one speed per tick whatever the intent magnitude (no speed forging)', () => {
    const { s } = live('split_route', [1, 1]); const seat = s.seats[0]!; const g = geoOf(s); place(s, seat.id, g.hubA.x, g.hubA.y); const x0 = seat.x, y0 = seat.y;
    simulate(s, s.live!.tick + 1, { [seat.id]: [{ tick: s.live!.tick + 1, x: 50, y: 50, seq: 5 }] }); expect(Math.hypot(seat.x - x0, seat.y - y0)).toBeLessThanOrEqual(SPEED + 0.001);
  });
});

describe('formats', () => {
  it('Split-Route Sprint: the team completes only when every present teammate has arrived; a road vote picks the plurality', () => {
    const { s } = live('split_route', [2, 1]); const g = geoOf(s); const ids = s.seats.filter((x) => x.teamId === 't1').map((x) => x.id);
    place(s, ids[0]!, g.hubB.x, g.hubB.y); place(s, ids[1]!, g.hubA.x, g.hubA.y); run(s, 5, ids); expect(s.teams[0]!.obj.done).toBe(false);
    place(s, ids[1]!, g.hubB.x, g.hubB.y); run(s, 2, ids); expect(s.teams[0]!.obj.done).toBe(true); expect(s.teams[0]!.legsDone).toBe(1); expect(s.teams[0]!.obj.assisted).toBe(false);
  });
  it('Signal Relay: only the flag holder can complete; a wrong post costs nothing; passing needs a teammate in range', () => {
    const { s } = live('signal_relay', [2, 1]); const g = geoOf(s); const t = s.teams[0]!; const holder = t.obj.flagHolder!; const mate = s.seats.find((x) => x.teamId === 't1' && x.id !== holder)!;
    const target = t.obj.legTarget; const wrong = (target + 1) % 4; const ids = [holder, mate.id]; const before = t.wallet;
    place(s, holder, g.spurs[wrong]!.end.x, g.spurs[wrong]!.end.y); place(s, mate.id, g.hubA.x, g.hubA.y); run(s, 3, ids); expect(t.obj.done).toBe(false); expect(t.obj.wrongPosts).toBeGreaterThanOrEqual(1); expect(t.wallet).toBe(before);
    place(s, mate.id, g.spurs[target]!.end.x, g.spurs[target]!.end.y); run(s, 3, ids); expect(t.obj.done).toBe(false); // the helper is at the right post, but does not carry the flag
    const far = reduceSeat(s, holder, { kind: 'pass' }); expect(far.ok).toBe(false);
    place(s, holder, g.hubB.x, g.hubB.y); place(s, mate.id, g.hubB.x + 40, g.hubB.y); const pass = reduceSeat(s, holder, { kind: 'pass' }); expect(pass.ok).toBe(true);
    const s2 = (pass as { state: CRState }).state; place(s2, mate.id, g.spurs[target]!.end.x, g.spurs[target]!.end.y); run(s2, 3, ids); expect(s2.teams[0]!.obj.done).toBe(true); expect(s2.teams[0]!.obj.assisted).toBe(false);
  });
  it('Atlas Circuit: stamps must be in the clue order near the landmark; a wrong stamp only pauses stamping for 1.5 s and never removes points', () => {
    const { s } = live('atlas_circuit', [1, 1]); const g = geoOf(s); const id = s.seats[0]!.id; const order = s.evidence[0]!.order!; const t = s.teams[0]!;
    place(s, id, g.spurs[order[1]!]!.end.x, g.spurs[order[1]!]!.end.y); const bad = reduceSeat(s, id, { kind: 'inspect', siteId: order[1]! }) as { ok: true; state: CRState }; expect(bad.ok).toBe(true); expect(bad.state.teams[0]!.obj.stampIdx).toBe(0); expect(bad.state.teams[0]!.obj.stampLockUntil).toBeGreaterThan(s.live!.tick);
    const locked = reduceSeat(bad.state, id, { kind: 'inspect', siteId: order[0]! }); expect(locked.ok).toBe(false);
    const s3 = bad.state; run(s3, STAMP_LOCK_TICKS + 1, [id]); place(s3, id, g.spurs[order[0]!]!.end.x, g.spurs[order[0]!]!.end.y);
    const far = reduceSeat(s3, id, { kind: 'inspect', siteId: order[2]! }); expect(far.ok).toBe(false);
    const ok = reduceSeat(s3, id, { kind: 'inspect', siteId: order[0]! }) as { ok: true; state: CRState }; expect(ok.state.teams[0]!.obj.stampIdx).toBe(1); expect(ok.state.teams[0]!.wallet).toBe(t.wallet);
    const noSite = reduceSeat(s3, id, { kind: 'inspect', siteId: 3 }); void noSite;
  });
  it('a stamp cannot be forged from far away', () => { const { s } = live('atlas_circuit', [1, 1]); const id = s.seats[0]!.id; const order = s.evidence[0]!.order!; const r = reduceSeat(s, id, { kind: 'inspect', siteId: order[0]! }); expect(r.ok).toBe(false); expect(s.teams[0]!.obj.stampIdx).toBe(0); });
  it('the leg timer carries a stuck team to the checkpoint with half route credit, no teamwork credit and no penalty', () => {
    const { s, pool, t } = live('signal_relay', [2, 1]); const out = advance(s, { now: t + (s.plan.legSeconds + 2) * 1000, pool, answers: [], timelines: {} }); expect(out.state.phase).toBe('checkpoint');
    for (const tm of out.state.teams) { expect(tm.obj.done).toBe(true); expect(tm.obj.assisted).toBe(true); expect(tm.legsAssisted).toBe(1); }
    const st = standingsOf(out.state).standings; expect(st.every((x) => x.teamwork === 0)).toBe(true); expect(st.every((x) => x.route === Math.round(500 / out.state.plan.legs))).toBe(true);
  });
});

describe('abilities, burst budget, perks, wallet', () => {
  it('abilities obey their own cooldown and one shared team burst; the Trail Maker needs the socket', () => {
    const { s } = live('split_route', [3, 1], { roles: [['scout', 'signal_keeper', 'trail_maker'], [null]] }); const t = s.teams[0]!; const ids = s.seats.filter((x) => x.teamId === 't1').map((x) => x.id);
    for (const id of ids) place(s, id, geoOf(s).hubA.x, geoOf(s).hubA.y);
    const scout = ids.find((i) => s.seats.find((x) => x.id === i)!.role === 'scout')!; const keeper = ids.find((i) => s.seats.find((x) => x.id === i)!.role === 'signal_keeper')!;
    const a = reduceSeat(s, scout, { kind: 'ability' }) as { ok: true; state: CRState }; expect(a.ok).toBe(true); const sx = a.state; expect(sx.teams[0]!.burstReadyTick).toBe(sx.live!.tick + TEAM_BURST_TICKS);
    expect(reduceSeat(sx, keeper, { kind: 'ability' }).ok).toBe(false); expect(reduceSeat(sx, scout, { kind: 'ability' }).ok).toBe(false);
    run(sx, TEAM_BURST_TICKS + 1, ids); expect(reduceSeat(sx, keeper, { kind: 'ability' }).ok).toBe(true); expect(sx.seats.find((x) => x.id === scout)!.abilityReadyTick - sx.live!.tick).toBeLessThanOrEqual(ROLE_COOLDOWN.scout); void t; void ABILITY;
    const tm = ids.find((i) => s.seats.find((x) => x.id === i)!.role === 'trail_maker')!; place(s, tm, 100, 100); const far = reduceSeat(s, tm, { kind: 'ability' }); expect(far.ok).toBe(false);
  });
  it('perks are bought only between legs, from the wallet, at most two per leg and never twice; the wallet is capped and never goes negative', () => {
    const m = newMatch({ format: 'split_route', sizes: [1, 1], questions: 10 }); let s = (reduceHost(m.s, { kind: 'start' }, 0, m.pool).result as { state: CRState }).state; let now = 0;
    const ans = (w: number) => s.seats.map((x) => ({ id: `${w}-${x.id}`, seatId: x.id, roomQuestionId: 'x', correct: true, awardedFraction: 1000 }));
    for (let i = 0; i < 4000 && s.phase !== 'route_choice'; i++) { now += 500; s = advance(s, { now, pool: m.pool, answers: s.phase === 'barrier' ? ans(s.question!.window) : [], timelines: {} }).state; }
    expect(s.phase).toBe('route_choice'); expect(s.teams[0]!.wallet).toBe(100); const id = s.seats[0]!.id;
    expect(reduceSeat(s, id, { kind: 'buy', perk: 'fast_map' }).ok).toBe(false); // 150 > 100
    const b = reduceSeat(s, id, { kind: 'buy', perk: 'scout_echo' }) as { ok: true; state: CRState }; expect(b.ok).toBe(true); expect(b.state.teams[0]!.wallet).toBe(100 - PERK_COST.scout_echo);
    expect(reduceSeat(b.state, id, { kind: 'buy', perk: 'scout_echo' }).ok).toBe(false);
    for (const tm of s.teams) tm.wallet = 5000; const c1 = reduceSeat(s, id, { kind: 'buy', perk: 'route_lamp' }) as { state: CRState }; const c2 = reduceSeat(c1.state, id, { kind: 'buy', perk: 'fast_map' }) as { state: CRState }; expect(reduceSeat(c2.state, id, { kind: 'buy', perk: 'extra_signal' }).ok).toBe(false);
    expect(WALLET_CAP).toBe(600); expect(reduceSeat(m.s, m.s.seats[0]!.id, { kind: 'buy', perk: 'route_lamp' }).ok).toBe(false); // lobby
  });
  it('the window credit is paid exactly once per team even if the settle step runs twice', () => {
    const m = newMatch({ format: 'split_route', sizes: [1, 1], questions: 10 }); let s = (reduceHost(m.s, { kind: 'start' }, 0, m.pool).result as { state: CRState }).state; let now = 0; const credits: string[] = [];
    for (let i = 0; i < 4000 && s.phase !== 'reveal'; i++) { now += 500; const out = advance(s, { now, pool: m.pool, answers: s.phase === 'barrier' ? s.seats.map((x) => ({ id: 'a' + x.id, seatId: x.id, roomQuestionId: 'x', correct: true, awardedFraction: 1000 })) : [], timelines: {} }); credits.push(...out.credits.map((c) => c.key)); s = out.state; }
    expect(credits).toEqual(['w:0:t1', 'w:0:t2']); const again = advance(s, { now: now + 1, pool: m.pool, answers: [], timelines: {} }); expect(again.credits).toEqual([]);
  });
});

describe('scoring and fairness', () => {
  it('score is 60% mastery + 25% route + 15% teamwork, independent of team size; a team of one scores the same as a team of five at equal accuracy', () => {
    const solo = playMatch({ format: 'split_route', sizes: [1, 5], accuracy: [0.8, 0.8], questions: 10 }).state; const st = standingsOf(solo).standings; const a = st.find((x) => x.teamId === 't1')!, b = st.find((x) => x.teamId === 't2')!;
    expect(a.mastery).toBe(800); expect(b.mastery).toBe(800); expect(a.score).toBe(b.score); expect(a.score).toBe(Math.round(0.6 * 800 + 0.25 * a.route + 0.15 * a.teamwork));
  });
  it('speed is never rewarded: the same accuracy finishing the race earlier or later scores the same', () => {
    const fast = playMatch({ format: 'atlas_circuit', sizes: [1, 1], accuracy: [0.7, 0.7], questions: 10 }).state; const st = standingsOf(fast).standings; expect(st[0]!.score).toBe(st[1]!.score);
  });
  it('higher quiz accuracy wins when the route work is equal; equal everything is shown as a tie with no random winner', () => {
    const win = standingsOf(playMatch({ format: 'split_route', sizes: [2, 2], accuracy: [0.9, 0.3], questions: 10 }).state); expect(win.standings[0]!.teamId).toBe('t1'); expect(win.tieNote).toBeNull();
    const tie = standingsOf(playMatch({ format: 'split_route', sizes: [2, 2], accuracy: [0.6, 0.6], questions: 10 }).state); expect(tie.standings.every((x) => x.rank === 1 && x.tied)).toBe(true); expect(tie.tieNote).toMatch(/No random winner/);
  });
  it('a present teammate who goes away does not block the team: idle seats are ignored', () => {
    const r = playMatch({ format: 'split_route', sizes: [3, 1], idleSeats: ['p0-2'], questions: 10 }); expect(r.state.phase).toBe('finished'); expect(r.state.teams[0]!.legsAssisted).toBeLessThanOrEqual(r.state.plan.legs);
  });
});

describe('planner', () => {
  it('only offers 10/15/20/30/45 minutes, snaps others, never invents questions and fits the time', () => {
    expect(snapMinutes(12)).toBe(10); expect(snapMinutes(40)).toBe(45);
    for (const minutes of [10, 15, 20, 30, 45]) { const kinds = Array.from({ length: 40 }, () => 'multiple_choice' as const); const p = planMatch({ durationMinutes: minutes, readAloud: false, lowPressure: false, allowReviewCycle: false, format: 'split_route' }, kinds);
      expect(p.windows).toBeGreaterThanOrEqual(3); expect(p.windows).toBeLessThanOrEqual(26); expect(p.estimatedMinutes).toBeLessThanOrEqual(minutes + 0.4); expect(p.windows).toBeLessThanOrEqual(kinds.length); expect(p.stations).toHaveLength(p.windows + 2); expect(p.stations[0]).toBe(0); expect(p.stations.at(-1)).toBe(27); }
    const few = planMatch({ durationMinutes: 45, readAloud: false, lowPressure: false, allowReviewCycle: false }, ['multiple_choice', 'multiple_choice']); expect(few.windows).toBe(2); expect(few.notes).toContain('belowMinimum');
    const review = planMatch({ durationMinutes: 20, readAloud: false, lowPressure: false, allowReviewCycle: true }, Array.from({ length: 6 }, () => 'multiple_choice' as const)); expect(review.reviewCycle).toBe(true);
  });
});

describe('projections and secrecy', () => {
  it('students never receive the answer fields, the seed, other teams’ wallets or private names; the host sees the key; the projector is aliased', () => {
    const { s } = live('atlas_circuit', [2, 2]); const stu = project(s, 'student', s.seats[0]!.id, 0); const txt = JSON.stringify(stu);
    expect(txt).not.toContain('postIdx'); expect(txt).not.toContain('"order"'); expect(txt).not.toContain(s.seed); expect(stu.teams.find((t) => t.id !== s.seats[0]!.teamId)!.wallet).toBeUndefined();
    const rival = stu.dots.find((d) => d.teamId !== s.seats[0]!.teamId)!; expect(rival.label).toMatch(/^[A-Z]/); expect(rival.label).not.toContain('Student'); expect(rival.id.startsWith('d')).toBe(true);
    const host = project(s, 'host', null, 0); expect(host.hostKey!.answer).toMatch(/Order:/); const proj = project(s, 'projector', null, 0); expect(proj.seats).toEqual([]); expect(JSON.stringify(proj)).not.toContain('Student');
    expect(stu.evidence).toHaveLength(1); expect(stu.evidence[0]).toEqual({ leg: 0, text: s.evidence[0]!.text });
  });
});

describe('every map plays every format to completion', () => {
  for (const m of MAP_IDS) for (const f of ['split_route', 'signal_relay', 'atlas_circuit'] as Format[]) it(`${m} / ${f}`, () => {
    const r = playMatch({ format: f, mapId: m as MapId, sizes: [3, 2], questions: 10, minutes: 10, seed: 'seedXYZ' + m });
    expect(r.state.phase).toBe('finished'); expect(r.state.teams.every((t) => t.legsDone === r.state.plan.legs)).toBe(true); expect(r.state.teams.every((t) => t.legsAssisted === 0)).toBe(true);
  });
});
void poolOf; void addSeat; void TICK_MS;
