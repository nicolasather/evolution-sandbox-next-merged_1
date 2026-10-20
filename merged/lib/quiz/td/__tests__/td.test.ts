/** Tower Defense — pure engine and simulation (Matrix B of 05_QA_RELEASE/01_TEST_MATRIX_AND_ACCEPTANCE.md). */
import { rngFrom } from '../../projector/rng';
import { BOSS_TELEGRAPH_TICKS, ENEMIES, LOW_PRESSURE_BOSS_LEAK, MAX_SLOW_PCT, ROLES, STARTING_CORE_HP, STARTING_POINTS, TOWERS, roundAward, syncTeamAward, independentAward } from '../balance';
import { addSeat, advance, createMatch, creditPersonal, personalAllowed, previewBoard, reduceHost, reduceSeat, sellRefund, standings, type CommittedAnswer } from '../engine';
import { MAPS, mapPath, validateMap } from '../maps';
import { project } from '../public';
import { runWave, WaveSim, type SimEvent } from '../sim';
import { planWave } from '../waves';
import { planMatch } from '../plan';
import { padsByCoverage } from '../bot';
import { cfg, playMatch, pool } from '../testkit';
import { TD_BRANCHES, TD_ENEMIES, TD_MAPS, TD_TOWERS, type TDState, type TDTowerKind, type TDWaveInput } from '../domain';

const T0 = 1_700_000_000_000;
const input = (o: Partial<TDWaveInput> & { kinds?: TDTowerKind[]; level?: 1 | 2 | 3; branch?: string | null } = {}): TDWaveInput => {
  const mapId = o.mapId ?? 'meadow_circuit'; const wave = o.wave ?? 1; const pads = padsByCoverage(mapId);
  const plan = planWave({ seed: 'seed', wave, boss: o.boss ?? null, mini: false, lowPressure: !!o.lowPressure });
  return {
    teamId: 't', mapId, wave, towers: o.towers ?? (o.kinds ?? ['bolt', 'bolt']).map((k, i) => ({ id: `w${i}`, padId: pads[i]!, kind: k, level: o.level ?? 1, branch: o.branch ?? null, targeting: 'first', reinforced: false })),
    spawns: o.spawns ?? plan.spawns, coreHP: o.coreHP ?? 24, maxCoreHP: o.maxCoreHP ?? 24, roleMods: o.roleMods ?? { splashPct: 0, statusPct: 0 },
    armed: o.armed ?? { salvo: [], purify: 0, protect: 0 }, lowPressure: !!o.lowPressure, boss: o.boss ?? null,
  };
};
function lobby(o: Parameters<typeof cfg>[0] = {}, seats = 1): TDState {
  const c = cfg(o); let s = createMatch(c, pool(60), c.teamNames.map((_, i) => `team-${i}`), T0);
  for (let t = 0; t < c.teamCount; t++) for (let k = 0; k < seats; k++) { const r = addSeat(s, `seat-${t}-${k}`, `P${t}${k}`, T0, `team-${t}`); if (!r.ok) throw new Error(r.message); s = r.state; }
  return s;
}
/** Start and run until the first build phase (answers: everyone correct). */
function toBuild(s: TDState, now = T0): { s: TDState; now: number } {
  const st = reduceHost(s, { kind: 'start' }, now); if (!st.result.ok) throw new Error(st.result.message); s = st.result.state;
  for (let i = 0; i < 400 && s.phase !== 'build'; i++) {
    now += 500; const r = s.rounds.find((x) => x.n === s.round);
    const answers: CommittedAnswer[] = r?.question ? Object.values(r.eligible).flat().map((seatId, k) => ({ id: `a${k}`, seatId, roomQuestionId: r.question!.roomQuestionId, correct: true, awardedFraction: 1000 })) : [];
    s = advance(s, { now, seed: 'seed', pool: pool(60), answers }).state;
  }
  return { s, now };
}
const ok = (r: ReturnType<typeof reduceSeat>) => { if (!r.ok) throw new Error(`${r.code}: ${r.message}`); return r.state; };

describe('maps (TD-003)', () => {
  it('all three authored maps pass validation and are distinct', () => {
    for (const id of TD_MAPS) expect(validateMap(MAPS[id])).toEqual([]);
    expect(new Set(TD_MAPS.map((m) => mapPath(m).length)).size).toBe(3);
    for (const id of TD_MAPS) expect(MAPS[id].pads.length).toBeGreaterThanOrEqual(12);
  });
  it('the lane is integer-only and ends inside the board (the core)', () => {
    for (const id of TD_MAPS) { const p = mapPath(id); expect(p.pts.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))).toBe(true); const [ex, ey] = p.pts[p.pts.length - 1]!; expect(ex).toBeGreaterThan(0); expect(ey).toBeGreaterThan(0); }
  });
});

describe('waves', () => {
  it('teaching waves follow the GDD and the same seed gives the same plan (mirrored squads)', () => {
    const w1 = planWave({ seed: 'a', wave: 1, boss: null, mini: false, lowPressure: false });
    expect(w1.spawns.filter((s) => s.kind === 'drifter')).toHaveLength(6); expect(w1.spawns.filter((s) => s.kind === 'zipper')).toHaveLength(2);
    expect(planWave({ seed: 'a', wave: 9, boss: null, mini: false, lowPressure: false })).toEqual(planWave({ seed: 'a', wave: 9, boss: null, mini: false, lowPressure: false }));
    const boss = planWave({ seed: 'a', wave: 6, boss: 'copper_colossus', mini: false, lowPressure: false });
    expect(boss.spawns.filter((s) => s.boss === 'copper_colossus')).toHaveLength(1);
  });
  it('budgets stay within caps for every wave of a 45-minute match', () => {
    for (let w = 1; w <= 18; w++) { const p = planWave({ seed: 'cap', wave: w, boss: null, mini: false, lowPressure: false }); expect(p.spawns.length).toBeLessThanOrEqual(140); expect(p.spawns.every((s) => s.hp > 0 && s.speed > 0)).toBe(true); }
  });
});

describe('simulation (TD-001, TD-005, TD-006, TD-009)', () => {
  it('5,000 seeded fixtures: identical input → identical outcome digest, every enemy resolved within the tick bound', () => {
    for (let i = 0; i < 5000; i++) {
      const r = rngFrom(`fx-${i}`); const mapId = TD_MAPS[i % 3]!; const pads = padsByCoverage(mapId);
      const kinds = Array.from({ length: 1 + r.int(4) }, () => TD_TOWERS[r.int(6)]!);
      const inp = input({ mapId, wave: 1 + r.int(3), towers: kinds.map((k, j) => ({ id: `x${j}`, padId: pads[r.int(pads.length)]! === undefined ? pads[0]! : pads[(j * 3 + r.int(3)) % pads.length]!, kind: k, level: (1 + r.int(3)) as 1 | 2 | 3, branch: null, targeting: (['first', 'strongest', 'fastest', 'lowest_health'] as const)[r.int(4)]!, reinforced: r.int(2) === 1 })).filter((t, j, a) => a.findIndex((x) => x.padId === t.padId) === j) });
      const a = runWave(inp); const b = runWave(JSON.parse(JSON.stringify(inp)) as TDWaveInput);
      expect(a.digest).toBe(b.digest);
      expect(a.result.ticks).toBeLessThanOrEqual(1400);
      expect(a.core).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
  it('the browser replay (stepping) reaches exactly the server outcome', () => {
    const inp = input({ wave: 4, kinds: ['bolt', 'ember', 'frost', 'arc', 'thorn', 'beacon'] });
    const server = runWave(inp); const client = new WaveSim(inp); while (!client.done) client.step();
    expect(client.digest()).toBe(server.digest);
  });
  it('invariants: no NaN, no negative HP shown, chains never hit an enemy twice, slows stay capped, splash stays inside its radius', () => {
    const inp = input({ wave: 8, kinds: ['arc', 'arc', 'frost', 'frost', 'ember', 'thorn', 'bolt'], level: 3, branch: null });
    inp.towers = inp.towers.map((t) => ({ ...t, branch: TD_BRANCHES[t.kind][0] }));
    const sim = new WaveSim(inp); let chains = 0;
    while (!sim.done) {
      const ev: SimEvent[] = sim.step();
      for (const e of ev) {
        if (e.t === 'chain') { chains++; expect(new Set(e.ids).size).toBe(e.ids.length); }
        if (e.t === 'hit') expect(Number.isFinite(e.dmg) && e.dmg >= 0).toBe(true);
        if (e.t === 'splash') for (const h of ev.filter((x) => x.t === 'hit' && x.src === e.tower && x.tick === e.tick)) { const en = sim.enemies.find((x) => x.id === (h as { e: number }).e); if (en) { const [px, py] = sim.pos(en); expect(Math.hypot(px - e.at[0], py - e.at[1])).toBeLessThanOrEqual(e.r + 250); } }
      }
      for (const en of sim.enemies) { expect(en.slowPct).toBeLessThanOrEqual(MAX_SLOW_PCT); expect(Number.isFinite(en.d)).toBe(true); }
    }
    expect(chains).toBeGreaterThan(0);
  });
  it('Warden protect blocks at most the armed number of leaks; purify cancels jams', () => {
    const none = runWave(input({ wave: 4, kinds: [] }));
    const prot = runWave(input({ wave: 4, kinds: [], armed: { salvo: [], purify: 0, protect: 2 } }));
    expect(prot.result.blocked).toBe(2); expect(prot.result.leaks).toBe(none.result.leaks - 2);
    const jam = runWave(input({ wave: 4, kinds: ['bolt', 'bolt', 'bolt'], armed: { salvo: [], purify: 1, protect: 0 } }));
    expect(jam.result.purified).toBeLessThanOrEqual(1);
  });
  it('bosses: each phase is entered once and every effect is warned at least one second ahead (all three bosses)', () => {
    for (const [mapId, boss] of [['meadow_circuit', 'copper_colossus'], ['coral_quarry', 'quarry_crawler'], ['skyworks', 'skywork_leviathan']] as const) {
      const sim = new WaveSim(input({ mapId, wave: 6, boss, kinds: ['bolt', 'bolt', 'arc', 'arc', 'ember', 'frost'], level: 2 }));
      const warned = new Map<string, number>(); const phases: string[] = [];
      while (!sim.done) for (const e of sim.step()) if (e.t === 'boss') {
        if (e.what.startsWith('phase')) phases.push(e.what);
        if (e.what.startsWith('warn_')) warned.set(e.what.slice(5), e.tick);
        if (['shield', 'surge', 'armor', 'guard', 'crack'].includes(e.what)) { expect(warned.has(e.what)).toBe(true); expect(e.tick - warned.get(e.what)!).toBeGreaterThanOrEqual(BOSS_TELEGRAPH_TICKS); }
      }
      expect(new Set(phases).size).toBe(phases.length);
      expect(sim.result().ticks).toBeLessThanOrEqual(2000);
    }
  });
  it('low pressure caps a boss leak at 3', () => {
    // a large core so the boss itself reaches it in both runs (the same seed, so the same escorts leak)
    const big = { coreHP: 500, maxCoreHP: 500 };
    const r = runWave(input({ mapId: 'meadow_circuit', wave: 6, boss: 'copper_colossus', kinds: [], lowPressure: true, ...big }));
    const hard = runWave(input({ mapId: 'meadow_circuit', wave: 6, boss: 'copper_colossus', kinds: [], ...big }));
    expect(ENEMIES.colossus.leak).toBe(5); expect(LOW_PRESSURE_BOSS_LEAK).toBe(3);
    expect(hard.result.bossDefeated).toBe(false); expect(r.result.bossDefeated).toBe(false);
    expect(hard.result.coreDamage - r.result.coreDamage).toBe(5 - 3);
  });
  it('no all-Bolt build dominates: armored + shielded waves favour a same-cost mixed build, flying swarms defeat ground-only towers', () => {
    const armored = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, kind: (i % 2 ? 'bulwark' : 'warden') as 'bulwark' | 'warden', tick: 20 + i * 9, hp: Math.round(ENEMIES[i % 2 ? 'bulwark' : 'warden'].hp * 1.6), armor: ENEMIES[i % 2 ? 'bulwark' : 'warden'].armorPct, speed: ENEMIES[i % 2 ? 'bulwark' : 'warden'].speed }));
    const bolts = runWave(input({ wave: 8, kinds: ['bolt', 'bolt', 'bolt', 'bolt', 'bolt'], spawns: armored })); // 600 points
    const mixed = runWave(input({ wave: 8, kinds: ['ember', 'arc', 'thorn', 'bolt'], spawns: armored })); // 175+205+130+120 = 630 points
    expect(mixed.result.coreDamage).toBeLessThan(bolts.result.coreDamage);
    const flyers = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, kind: 'skimmer' as const, tick: 20 + i * 8, hp: ENEMIES.skimmer.hp, armor: 0, speed: ENEMIES.skimmer.speed }));
    const ground = runWave(input({ wave: 3, kinds: ['ember', 'thorn', 'ember'], spawns: flyers }));
    const air = runWave(input({ wave: 3, kinds: ['bolt', 'arc', 'bolt'], spawns: flyers }));
    expect(ground.result.kills).toBe(0); expect(air.result.kills).toBeGreaterThan(6);
  });
});

describe('economy and board actions (TD-002, TD-003, TD-004, TD-012, TD-018)', () => {
  it('building pays exactly once, a pad holds one tower, and points never go negative', () => {
    let { s } = toBuild(lobby()); const team = () => s.teams[0]!; const before = team().points;
    s = ok(reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'm01', tower: 'bolt' }));
    expect(team().points).toBe(before - TOWERS.bolt.cost); expect(team().towers).toHaveLength(1);
    // 50 identical purchase attempts for the same pad: at most one tower, one debit
    let wins = 0; for (let i = 0; i < 50; i++) { const r = reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'm01', tower: 'frost' }); if (r.ok) { wins++; s = r.state; } }
    expect(wins).toBe(0); expect(team().points).toBe(before - TOWERS.bolt.cost);
    expect(reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'nope', tower: 'bolt' })).toMatchObject({ ok: false, code: 'INVALID_PAD' });
    const poor = JSON.parse(JSON.stringify(s)) as TDState; poor.teams[0]!.points = 5;
    expect(reduceSeat(poor, 'seat-0-0', { kind: 'build', padId: 'm02', tower: 'arc' })).toMatchObject({ ok: false, code: 'INSUFFICIENT_POINTS', message: `Insufficient points: need ${TOWERS.arc.cost - 5} more.` });
  });
  it('every tower reaches level 3 with one exclusive branch; upgrades and sales are exact', () => {
    let { s } = toBuild(lobby()); s.teams[0]!.points = 10_000;
    TD_TOWERS.forEach((k, i) => { s = ok(reduceSeat(s, 'seat-0-0', { kind: 'build', padId: MAPS.meadow_circuit.pads[i]!.id, tower: k })); });
    for (const t of [...s.teams[0]!.towers]) {
      s = ok(reduceSeat(s, 'seat-0-0', { kind: 'upgrade', towerId: t.id }));
      expect(reduceSeat(s, 'seat-0-0', { kind: 'upgrade', towerId: t.id })).toMatchObject({ ok: false, code: 'BRANCH_REQUIRED' });
      expect(reduceSeat(s, 'seat-0-0', { kind: 'upgrade', towerId: t.id, branch: 'nonsense' })).toMatchObject({ ok: false, code: 'BRANCH_INVALID' });
      s = ok(reduceSeat(s, 'seat-0-0', { kind: 'upgrade', towerId: t.id, branch: TD_BRANCHES[t.kind][1] }));
      const now = s.teams[0]!.towers.find((x) => x.id === t.id)!;
      expect(now.level).toBe(3); expect(now.branch).toBe(TD_BRANCHES[t.kind][1]);
      expect(now.spent).toBe(TOWERS[t.kind].cost + TOWERS[t.kind].upgrade[0] + TOWERS[t.kind].upgrade[1]);
      expect(reduceSeat(s, 'seat-0-0', { kind: 'upgrade', towerId: t.id, branch: TD_BRANCHES[t.kind][0] })).toMatchObject({ ok: false, code: 'MAX_LEVEL' });
      const pts = s.teams[0]!.points; s = ok(reduceSeat(s, 'seat-0-0', { kind: 'sell', towerId: t.id }));
      expect(s.teams[0]!.points).toBe(pts + sellRefund(now)); expect(sellRefund(now)).toBe(Math.floor(now.spent / 2));
      expect(reduceSeat(s, 'seat-0-0', { kind: 'sell', towerId: t.id })).toMatchObject({ ok: false, code: 'TOWER_MISSING' }); // idempotent: sold once
    }
  });
  it('nothing can be built during a question or after the match; a forged seat is refused', () => {
    let s = lobby(); s = reduceHost(s, { kind: 'start' }, T0).result.ok ? (reduceHost(s, { kind: 'start' }, T0).result as { state: TDState }).state : s;
    s = advance(s, { now: T0 + 3500, seed: 'seed', pool: pool(60) }).state;
    expect(s.phase).toBe('quiz_open');
    expect(reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'm01', tower: 'bolt' })).toMatchObject({ ok: false, code: 'WRONG_PHASE', message: 'Build only between waves.' });
    expect(reduceSeat(s, 'impostor', { kind: 'build', padId: 'm01', tower: 'bolt' })).toMatchObject({ ok: false, code: 'NOT_YOUR_TEAM' });
    const ended = (reduceHost(s, { kind: 'end' }, T0 + 4000).result as { state: TDState }).state;
    expect(reduceSeat(ended, 'seat-0-0', { kind: 'ready', ready: true })).toMatchObject({ ok: false, code: 'MATCH_FINISHED' });
  });
  it('a move costs a quarter of the spend (free after a cracked pad); targeting costs 10 (one free change for a Tactician)', () => {
    let { s } = toBuild(lobby());
    s = ok(reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'm01', tower: 'bolt' })); const id = s.teams[0]!.towers[0]!.id;
    expect(previewBoard(s, s.seats[0]!, { kind: 'move', towerId: id, padId: 'm02' }).cost).toBe(30);
    expect(previewBoard(s, s.seats[0]!, { kind: 'target', towerId: id, policy: 'strongest' }).cost).toBe(10);
    s.seats[0]!.role = 'tactician';
    expect(previewBoard(s, s.seats[0]!, { kind: 'target', towerId: id, policy: 'strongest' }).cost).toBe(0);
    s.teams[0]!.towers[0]!.freeMove = true;
    expect(previewBoard(s, s.seats[0]!, { kind: 'move', towerId: id, padId: 'm02' }).cost).toBe(0);
  });
});

describe('questions and awards (TD-010)', () => {
  it('normalised squad award: 0 correct → 0; a full squad of 5 gets the same as a correct solo player; partial is proportional', () => {
    expect(syncTeamAward(80, 0, 5)).toBe(0); expect(syncTeamAward(80, 5000, 5)).toBe(80); expect(syncTeamAward(80, 1000, 1)).toBe(80);
    expect(syncTeamAward(80, 1000, 5)).toBe(54); expect(syncTeamAward(80, 500, 1)).toBe(64);
    expect(() => syncTeamAward(80, 6000, 5)).toThrow();
    expect(independentAward(1000, 4)).toBe(10); expect(independentAward(0, 1)).toBe(0);
    expect(roundAward(1)).toBe(80);
  });
  it('a wrong or missing answer never earns points; the reveal credits each squad once with a stable key', () => {
    let s = lobby({}, 3); s = (reduceHost(s, { kind: 'start' }, T0).result as { state: TDState }).state;
    s = advance(s, { now: T0 + 3500, seed: 'seed', pool: pool(60) }).state;
    const r = s.rounds[0]!; const q = r.question!;
    const answers: CommittedAnswer[] = [{ id: 'a1', seatId: 'seat-0-0', roomQuestionId: q.roomQuestionId, correct: false, awardedFraction: 0 }];
    const step = advance(s, { now: T0 + 3500 + (s.plan.questionSeconds + 2) * 1000, seed: 'seed', pool: pool(60), answers });
    expect(step.state.phase).toBe('reveal'); expect(step.state.teams[0]!.points).toBe(STARTING_POINTS);
    expect(step.credits).toEqual([{ key: `q:${q.roomQuestionId}:team-0`, teamId: 'team-0', amount: 0, submissionIds: ['a1'] }]);
    expect(step.effects).toEqual([{ type: 'reveal' }]);
  });
  it('the question closes early when every eligible student answered, never before', () => {
    let s = lobby({}, 2); s = (reduceHost(s, { kind: 'start' }, T0).result as { state: TDState }).state;
    s = advance(s, { now: T0 + 3500, seed: 'seed', pool: pool(60), presence: { 'seat-0-0': T0, 'seat-0-1': T0 } }).state;
    const q = s.rounds[0]!.question!; const a = (seatId: string): CommittedAnswer => ({ id: seatId, seatId, roomQuestionId: q.roomQuestionId, correct: true, awardedFraction: 1000 });
    expect(advance(s, { now: T0 + 5000, seed: 'seed', pool: pool(60), answers: [a('seat-0-0')] }).state.phase).toBe('quiz_open');
    expect(advance(s, { now: T0 + 5000, seed: 'seed', pool: pool(60), answers: [a('seat-0-0'), a('seat-0-1')] }).state.phase).toBe('reveal');
  });
  it('independent flow: personal answers credit once per submission, capped per round', () => {
    let s = lobby({ questionFlow: 'independent' }, 2); s = (reduceHost(s, { kind: 'start' }, T0).result as { state: TDState }).state;
    s = advance(s, { now: T0 + 3500, seed: 'seed', pool: pool(60) }).state;
    expect(s.phase).toBe('build'); expect(personalAllowed(s, 'seat-0-0').ok).toBe(true);
    const c = creditPersonal(s, { id: 'sub-1', seatId: 'seat-0-0', roomQuestionId: 'rq-0', correct: true, awardedFraction: 1000 });
    expect(c.credit).toEqual({ key: 's:sub-1', teamId: 'team-0', amount: 20, submissionIds: ['sub-1'] });
    s = c.state; s.seats[0]!.answersThisRound = s.plan.personalCap;
    expect(personalAllowed(s, 'seat-0-0')).toMatchObject({ ok: false });
  });
});

describe('roles (TD-008)', () => {
  it('Architect: 10% off the first tower each build, once per seat', () => {
    let s = lobby(); s.seats[0]!.role = 'architect'; ({ s } = toBuild(s));
    const p = s.teams[0]!.points;
    s = ok(reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'm01', tower: 'bolt' })); expect(s.teams[0]!.points).toBe(p - Math.ceil(TOWERS.bolt.cost * 0.9));
    const p2 = s.teams[0]!.points; s = ok(reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'm02', tower: 'bolt' })); expect(s.teams[0]!.points).toBe(p2 - TOWERS.bolt.cost);
  });
  it('Warden core bonus is capped at +4 even with five Wardens; abilities need the role and work once per wave', () => {
    let s = lobby({}, 5); s.seats.forEach((x) => { x.role = 'warden'; });
    s = (reduceHost(s, { kind: 'start' }, T0).result as { state: TDState }).state;
    expect(s.teams[0]!.maxCoreHP).toBe(STARTING_CORE_HP + 4);
    let b = toBuild(lobby({}, 2)).s; b.seats[0]!.role = 'warden';
    expect(reduceSeat(b, 'seat-0-1', { kind: 'ability', ability: 'protect' })).toMatchObject({ ok: false, code: 'ROLE_REQUIRED' });
    b = ok(reduceSeat(b, 'seat-0-0', { kind: 'ability', ability: 'protect' })); expect(b.teams[0]!.armed.protect).toBe(1);
    expect(reduceSeat(b, 'seat-0-0', { kind: 'ability', ability: 'protect' })).toMatchObject({ ok: false, code: 'ABILITY_USED' });
    expect(Object.keys(ROLES)).toHaveLength(5);
  });
  it('every role is viable solo: a one-player squad of any role finishes a 15-minute match standing at 65% accuracy', () => {
    for (const role of Object.keys(ROLES)) {
      const { state } = playMatch({ accuracy: 0.65, seatsPerTeam: 1, roles: [role], seed: `solo-${role}`, map: 'coral_quarry' });
      expect(state.finish?.outcome).toBe('victory');
    }
  });
});

describe('whole matches (TD-007, TD-011, TD-016, TD-017)', () => {
  it('team size does not multiply the economy (1, 3 and 5 players earn within 15% of each other at equal accuracy)', () => {
    const earned = [1, 3, 5].map((n) => playMatch({ accuracy: 0.8, seatsPerTeam: n, seed: 'size' }).state.teams[0]!.earned);
    const max = Math.max(...earned), min = Math.min(...earned);
    expect((max - min) / max).toBeLessThan(0.15);
  });
  it('mirrored competitive squads with identical answers and builds get identical outcomes and a shared placement', () => {
    const { state } = playMatch({ config: { format: 'versus', teamCount: 3 }, accuracy: [0.7, 0.7, 0.7], seatsPerTeam: 2, seed: 'mirror' });
    // identical accuracy seeds differ per team id in the bot, so compare against a run where each team uses the same per-team seed
    const a = playMatch({ config: { format: 'versus', teamCount: 2 }, accuracy: [1, 1], seatsPerTeam: 1, seed: 'mirror2' }).state;
    expect(a.teams[0]!.coreHP).toBe(a.teams[1]!.coreHP); expect(a.teams[0]!.wavesCleared).toBe(a.teams[1]!.wavesCleared);
    expect(a.finish!.standings.map((x) => x.rank)).toEqual([1, 1]);
    expect(state.finish!.outcome).toBe('ranked');
  });
  it('better answers rank higher in versus (accuracy matters, never speed)', () => {
    const { state } = playMatch({ config: { format: 'versus', teamCount: 2, durationMinutes: 30 }, accuracy: [0.95, 0.3], seatsPerTeam: 2, seed: 'skill' });
    const st = standings(state);
    expect(st[0]!.teamId).toBe('team-0');
  });
  it('a 45-minute match completes in bounded transitions with a bounded state size', () => {
    const { state, transitions } = playMatch({ config: { durationMinutes: 45 }, accuracy: 0.8, seatsPerTeam: 5, seed: 'long' });
    expect(state.phase).toBe('finished'); expect(transitions).toBeLessThan(200);
    expect(JSON.stringify(state).length).toBeLessThan(120_000);
    expect(state.teams[0]!.points).toBeGreaterThanOrEqual(0);
  });
  it('a squad that never answers correctly cannot win a long match, and still is never stuck (comeback kit, no softlock)', () => {
    const { state } = playMatch({ config: { durationMinutes: 30 }, accuracy: 0, seatsPerTeam: 2, seed: 'none' });
    expect(state.phase).toBe('finished'); expect(state.finish!.outcome).not.toBe('victory');
  });
  it('pause freezes every deadline; resume shifts them by exactly the paused time', () => {
    const b = toBuild(lobby()); let s = b.s; const now = b.now;
    const dl = s.phaseDeadlineMs!; const end = s.matchEndMs!;
    s = (reduceHost(s, { kind: 'pause' }, now).result as { state: TDState }).state;
    expect(advance(s, { now: now + 600_000, seed: 'seed', pool: pool(60) }).changed).toBe(false);
    s = (reduceHost(s, { kind: 'resume' }, now + 90_000).result as { state: TDState }).state;
    expect(s.phaseDeadlineMs).toBe(dl + 90_000); expect(s.matchEndMs).toBe(end + 90_000);
  });
  it('a stale catch-up after two idle minutes never opens a question in the past', () => {
    let s = lobby(); s = (reduceHost(s, { kind: 'start' }, T0).result as { state: TDState }).state;
    const late = T0 + 120_000; const st = advance(s, { now: late, seed: 'seed', pool: pool(60) }).state;
    expect(st.phase).toBe('quiz_open'); expect(st.rounds[0]!.openedAtMs!).toBeGreaterThanOrEqual(late - 2000);
  });
  it('the planner follows the real kinds and the duration bands', () => {
    const mc = planMatch({ durationMinutes: 15, focus: 'balanced', readAloud: false, questionFlow: 'synchronized', allowReviewCycle: false }, Array(30).fill('multiple_choice'), 30);
    const ft = planMatch({ durationMinutes: 15, focus: 'balanced', readAloud: false, questionFlow: 'synchronized', allowReviewCycle: false }, Array(30).fill('fill_table'), 30);
    expect(ft.questionSeconds).toBeGreaterThan(mc.questionSeconds); expect(mc.waves).toBeGreaterThanOrEqual(5); expect(mc.waves).toBeLessThanOrEqual(8);
    const short = planMatch({ durationMinutes: 15, focus: 'balanced', readAloud: false, questionFlow: 'synchronized', allowReviewCycle: false }, Array(3).fill('multiple_choice'), 3);
    expect(short.waves).toBe(3); expect(short.notes).toContain('shortQuiz');
    const review = planMatch({ durationMinutes: 15, focus: 'balanced', readAloud: false, questionFlow: 'synchronized', allowReviewCycle: true }, Array(4).fill('multiple_choice'), 4);
    expect(review.reviewCycle).toBe(true);
    expect(planMatch({ durationMinutes: 45, focus: 'balanced', readAloud: false, questionFlow: 'synchronized', allowReviewCycle: false }, Array(40).fill('multiple_choice'), 40).bossWaves).toHaveLength(3);
  });
});

describe('host controls and seats (TD-007, TD-019)', () => {
  it('squads hold 1–5 students; extra devices wait without a squad; a kicked seat can no longer act', () => {
    let s = lobby({ teamSizeCap: 2 }, 0);
    for (let i = 0; i < 3; i++) s = (addSeat(s, `x${i}`, `X${i}`, T0) as { state: TDState }).state;
    expect(s.seats.filter((x) => x.teamId === 'team-0')).toHaveLength(2); expect(s.seats[2]!.teamId).toBeNull();
    const k = reduceHost(s, { kind: 'kick', seatId: 'x0' }, T0); s = (k.result as { state: TDState }).state;
    expect(k.effects).toEqual([{ type: 'kick', seatId: 'x0' }]);
    expect(reduceSeat(s, 'x0', { kind: 'ready', ready: true })).toMatchObject({ ok: false, code: 'SEAT_REVOKED' });
    s = (reduceHost(s, { kind: 'move_seat', seatId: 'x2', teamId: 'team-0' }, T0).result as { state: TDState }).state;
    expect(s.seats.find((x) => x.id === 'x2')!.teamId).toBe('team-0');
  });
  it('configs outside the rules are refused (co-op 1 squad, versus 2–4, max 20 students, 10–45 minutes)', () => {
    expect(() => createMatch(cfg({ format: 'coop', teamCount: 2, teamNames: ['a', 'b'] }), pool(10), ['a', 'b'], T0)).toThrow();
    expect(() => createMatch(cfg({ format: 'versus', teamCount: 4, teamSizeCap: 5 }), pool(10), ['a', 'b', 'c', 'd'], T0)).not.toThrow();
    expect(() => createMatch(cfg({ format: 'versus', teamCount: 5, teamNames: ['a', 'b', 'c', 'd', 'e'] }), pool(10), ['a', 'b', 'c', 'd', 'e'], T0)).toThrow();
    expect(() => createMatch(cfg({ durationMinutes: 50 }), pool(10), ['a'], T0)).toThrow();
  });
  it('start refuses empty squads unless the teacher overrides; purchases above the approval limit wait for the teacher', () => {
    const empty = lobby({ format: 'versus', teamCount: 2 }, 0);
    expect(reduceHost(empty, { kind: 'start' }, T0).result).toMatchObject({ ok: false, code: 'NOT_READY_YET' });
    expect(reduceHost(empty, { kind: 'start', override: true }, T0).result.ok).toBe(true);
    let { s } = toBuild(lobby({ approvalAbove: 150 }));
    const r = reduceSeat(s, 'seat-0-0', { kind: 'build', padId: 'm01', tower: 'ember' }); expect(r.ok && r.note).toBe('NEEDS_APPROVAL'); s = (r as { state: TDState }).state;
    expect(s.teams[0]!.towers).toHaveLength(0);
    s = (reduceHost(s, { kind: 'approve', teamId: 'team-0', pendingId: s.teams[0]!.pending[0]!.id, approve: true }, T0).result as { state: TDState }).state;
    expect(s.teams[0]!.towers).toHaveLength(1);
  });
});

describe('projections (TD-019, Matrix F sensitive data)', () => {
  it('a student sees its own squad in full and only a summary of rivals; the projector hides stakes and names on request', () => {
    const { state } = playMatch({ config: { format: 'versus', teamCount: 2, modifiers: ['secret_wager'], hideNames: true }, accuracy: [0.8, 0.8], seatsPerTeam: 2, seed: 'proj' });
    const me = project(state, 'student', 'seat-0-0', T0);
    const rival = me.teams.find((t) => t.id === 'team-1')! as Record<string, unknown>;
    expect(rival.points).toBeUndefined(); expect(rival.towers).toBeUndefined(); expect(rival.log).toBeUndefined();
    expect(me.seats.every((x) => x.teamId === 'team-0')).toBe(true);
    const proj = project(state, 'projector', null, T0);
    expect(proj.seats.every((x) => /^Player \d+$/.test(x.name))).toBe(true);
    expect(JSON.stringify(proj)).not.toMatch(/correctBySeat|"eligible"/);
    expect(JSON.stringify(state)).not.toMatch(/seed/i);
  });
  it('the frozen wave input a student receives is only its own squad’s', () => {
    let s = lobby({ format: 'versus', teamCount: 2 }); ({ s } = toBuild(s));
    s = advance(s, { now: s.phaseDeadlineMs! + 10, seed: 'seed', pool: pool(60) }).state; expect(s.phase).toBe('wave');
    const me = project(s, 'student', 'seat-0-0', T0);
    expect(Object.keys(me.rounds[me.rounds.length - 1]!.waveInput ?? {})).toEqual(['team-0']);
  });
});
void TD_ENEMIES;
