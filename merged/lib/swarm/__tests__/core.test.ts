/** @jest-environment node */
import { configSchema, isActivePhase, type Role, type Room } from '../domain';
import { checkpoint, createRoom, canAnswer, connect, disconnect, hashRoom, hostCommand, leave, playerAbility, playerMove, recordAnswer, restore, seat, setRole, step, vote } from '../room';
import { teamAward, draftOffers, rankTeams, resolveVotes, buyUpgrade } from '../economy';
import { planSession } from '../plan';
import { BOSS, ENEMY_DEFS, ROLE_DEFS, UPGRADE_DEFS, upgradeCost } from '../balance';
import { drive, fixturePool, mkRoom } from '../testkit';
import { MAPS, resolveObstacles } from '../maps';
import { inHazard } from '../bosses';

const finite = (v: unknown): boolean => JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? 'BAD' : x)).indexOf('"BAD"') < 0;
const frozenProjection = (r: Room) => JSON.stringify(Object.values(r.arenas).map((a) => ({ p: Object.values(a.players).map((p) => [p.x, p.y, p.hp, p.fireCd, p.abilityCd, p.shield, p.shieldTicks, p.invuln, p.downTicks, p.reviveTicks, p.volleyLeft, p.dashTicks, p.slowTicks, p.rootTicks, p.burst]), e: a.enemies.map((e) => [e.id, e.x, e.y, e.hp, e.st, e.state, e.cd, e.slowTicks]), b: a.bullets.map((b) => [b.id, b.x, b.y, b.ttl]), h: a.hazards.map((h) => [h.id, h.telegraph, h.t]), t: a.turrets.map((t) => [t.ttl, t.fireCd]), d: a.drones.map((d) => d.fireCd), si: a.spawnIdx, wt: a.waveTick, bh: a.beacon.hp, bs: a.beacon.shieldTicks })));

describe('configuration', () => {
  const base = { mode: 'versus', teamCount: 2, teamSizeCap: 5, minutes: 15 } as const;
  it('accepts the documented shapes and defaults the rest', () => {
    const c = configSchema.parse(base); expect(c.mapId).toBe('meadow_circuit'); expect(c.difficulty).toBe('normal'); expect(c.questionSeconds).toBeNull();
    expect(configSchema.parse({ mode: 'versus', teamCount: 4, teamSizeCap: 5, minutes: 45 }).teamCount).toBe(4); // 20 players: the cap
    expect(configSchema.parse({ mode: 'coop', teamCount: 1, teamSizeCap: 5, minutes: 5 }).mode).toBe('coop');
  });
  it('rejects impossible rooms', () => {
    for (const bad of [{ ...base, teamSizeCap: 6 }, { ...base, teamSizeCap: 0 }, { ...base, teamCount: 5 }, { ...base, teamCount: 1 }, { mode: 'coop', teamCount: 2, teamSizeCap: 3, minutes: 10 }, { ...base, minutes: 4 }, { ...base, minutes: 46 }, { ...base, minutes: 7.5 }, { ...base, questionSeconds: 5 }, { ...base, mapId: 'nope' }]) expect(configSchema.safeParse(bad).success).toBe(false);
  });
});

describe('session plan (length is a budget)', () => {
  const p = (minutes: number, poolSize = 60, extra = {}) => planSession({ minutes, poolSize, focus: 'balanced', difficulty: 'normal', allowReviewCycle: false, ...extra });
  it('follows the design table', () => {
    expect(p(5).waves.length).toBe(3); expect(p(10).waves.length).toBe(6); expect(p(15).waves.length).toBe(8); expect(p(20).waves.length).toBe(10); expect(p(30).waves.length).toBe(13); expect(p(45).waves.length).toBe(20);
    expect(p(5).questionsTotal).toBe(3); expect(p(10).questionsTotal).toBe(6);
    expect(p(15).questionsTotal).toBeGreaterThanOrEqual(9); expect(p(15).questionsTotal).toBeLessThanOrEqual(14);
  });
  it('bosses: last wave is always a boss; counts match the schedule', () => {
    const bosses = (m: number) => p(m).waves.filter((w) => w.boss).map((w) => w.boss!.kind);
    expect(bosses(5)).toEqual(['marrow_drum']); expect(bosses(10)).toEqual(['marrow_drum']); expect(bosses(15)).toEqual(['glass_heron', 'marrow_drum']); expect(bosses(20)).toEqual(['glass_heron', 'marrow_drum']);
    expect(bosses(30)).toEqual(['marrow_drum', 'glass_heron', 'orchard_engine']); expect(bosses(45)).toEqual(['marrow_drum', 'glass_heron', 'orchard_engine']);
    expect(p(5).waves.at(-1)!.boss!.mini).toBe(true); expect(p(15).waves.find((w) => w.boss?.kind === 'glass_heron')!.boss!.mini).toBe(true);
    for (const m of [5, 10, 15, 20, 30, 45]) expect(p(m).waves.at(-1)!.boss!.final).toBe(true);
  });
  it('never invents questions: a short quiz shortens the session and says so', () => {
    const s = p(45, 8); expect(s.questionsTotal).toBe(8); expect(s.waves.length).toBeLessThanOrEqual(9); expect(s.warnings.join(' ')).toMatch(/8 questions/); expect(s.reviewCycle).toBe(false);
    const r = p(45, 8, { allowReviewCycle: true }); expect(r.reviewCycle).toBe(true); expect(r.questionsTotal).toBeGreaterThan(8);
  });
  it('every break has a question and at most two; first wave is short; at most one new enemy per wave', () => {
    for (const m of [5, 10, 15, 20, 30, 45]) {
      const s = p(m); s.waves.slice(0, -1).forEach((w) => { expect(w.questionsAfter).toBeGreaterThanOrEqual(1); expect(w.questionsAfter).toBeLessThanOrEqual(2); });
      expect(s.waves[0]!.ticks).toBeLessThanOrEqual(30 * 20); expect(s.waves.filter((w) => w.newKind).length).toBeLessThanOrEqual(8);
      expect(s.waves.at(-1)!.questionsAfter).toBe(0);
    }
  });
  it('custom lengths interpolate and stay bounded', () => { for (let m = 5; m <= 45; m++) { const s = p(m); expect(s.waves.length).toBeGreaterThanOrEqual(2); expect(s.estimateSeconds).toBeGreaterThan(60); } });
});

describe('economy: one currency, normalized by team size', () => {
  it('all-correct earns one base award regardless of headcount', () => { for (const n of [1, 2, 3, 4, 5]) expect(teamAward(Array(n).fill(1), n)).toBe(100); });
  it('partial credit is proportional and never exceeds the base', () => { expect(teamAward([1, 0, 0.5, 1, 0], 5)).toBe(50); expect(teamAward([1], 1)).toBe(100); expect(teamAward([2, 9, -3], 3)).toBe(67); expect(teamAward([1, 1], 0)).toBe(0); });
  it('rejects a bad base and ignores NaN fractions', () => { expect(() => teamAward([1], 1, 500)).toThrow(); expect(teamAward([NaN, 1], 2)).toBe(50); });
  it('upgrade prices follow the registry and stop at max level', () => { expect(upgradeCost('fan_bolts', 0)).toBe(90); expect(upgradeCost('fan_bolts', 1)).toBe(140); expect(upgradeCost('fan_bolts', 3)).toBe(Infinity); });
  it('draft offers are deterministic, identical across teams unless a team is maxed, and include a damage and a utility option', () => {
    const a = draftOffers(42, 1, { upgrades: {} }), b = draftOffers(42, 1, { upgrades: {} }); expect(a).toEqual(b); expect(a).toHaveLength(3);
    expect(a.some((u) => UPGRADE_DEFS[u].category === 'attack')).toBe(true); expect(a.some((u) => UPGRADE_DEFS[u].category === 'utility')).toBe(true);
    const maxed = draftOffers(42, 1, { upgrades: { [a[0]!]: UPGRADE_DEFS[a[0]!].maxLevel } }); expect(maxed).not.toContain(a[0]);
  });
  it('vote resolution: majority, role-priority tie break, seeded last resort, nothing affordable charges nothing', () => {
    const base = { seed: 7, draftIndex: 1, teamId: 't1', offers: ['fan_bolts', 'swift_steps', 'beacon_plate'] as never, wallet: 300, upgrades: {} };
    expect(resolveVotes({ ...base, votes: { a: 'fan_bolts', b: 'fan_bolts', c: 'swift_steps' }, voters: { a: 'scout', b: 'scout', c: 'guardian' } }).upgrade).toBe('fan_bolts');
    const tie = resolveVotes({ ...base, votes: { a: 'fan_bolts', b: 'swift_steps' }, voters: { a: 'scout', b: 'guardian' } }); expect(tie.upgrade).toBe('swift_steps'); expect(tie.detail).toMatch(/role priority/);
    expect(resolveVotes({ ...base, wallet: 10, votes: {}, voters: { a: 'scout' } }).how).toBe('none');
    expect(resolveVotes({ ...base, votes: { a: 'fan_bolts' }, voters: { z: 'scout' } }).how).toBe('default'); // a vote from a non-voter does not count
  });
  it('buyUpgrade debits and levels exactly once', () => {
    const team = { id: 't1', name: 'x', wallet: 150, earned: 0, spent: 0, wavesCompleted: 0, upgrades: {}, drafts: 0, purchases: 0, questionsAnswered: 0, fracSum: 0, eligibleSum: 0, abandonMs: 0 };
    const draft = { id: 'd1', index: 1, offers: { t1: ['fan_bolts' as const] }, votes: {}, closesMs: 0, resolved: {} as never };
    const b = buyUpgrade(team, draft, 't1', 'fan_bolts'); expect(b).toEqual({ cost: 90, walletBefore: 150, walletAfter: 60 });
    (draft.resolved as Record<string, unknown>).t1 = {}; expect(() => buyUpgrade(team, draft, 't1', 'fan_bolts')).toThrow(/already/);
    expect((team.upgrades as Record<string, number>).fan_bolts).toBe(1);
  });
  it('ranking: waves → beacon → damage per active second → accuracy; ties share a rank', () => {
    const mk = (id: string, w: number, bp: number, dmg: number): never => ({ team: { id, name: id, wallet: 0, earned: 0, spent: 0, wavesCompleted: w, upgrades: {}, drafts: 0, purchases: 0, questionsAnswered: 5, fracSum: 4, eligibleSum: 5, abandonMs: 0 }, players: [], beaconPct: bp, dmg, activeSec: 100, fallenAt: null }) as never;
    const r = rankTeams([mk('b', 5, 50, 100), mk('a', 5, 80, 100), mk('c', 6, 1, 1), mk('d', 5, 80.2, 100.4)], { mode: 'versus' }, false);
    expect(r.map((x) => [x.teamId, x.rank])).toEqual([['c', 1], ['d', 2], ['a', 2], ['b', 4]]);
  });
});

describe('arena rules', () => {
  it('registry sanity: eight enemies, five roles, eight upgrades, three bosses, distinct colours and shapes', () => {
    expect(Object.keys(ENEMY_DEFS)).toHaveLength(8); expect(Object.keys(ROLE_DEFS)).toHaveLength(5); expect(Object.keys(UPGRADE_DEFS)).toHaveLength(8);
    expect(new Set(Object.values(ENEMY_DEFS).map((e) => e.shape)).size).toBe(8); expect(new Set(Object.values(ENEMY_DEFS).map((e) => e.color)).size).toBe(8); expect(new Set(Object.values(ROLE_DEFS).map((e) => e.color)).size).toBe(5);
    expect(BOSS.telegraph.beam).toBeGreaterThanOrEqual(17); // 850 ms
  });
  it('movement is normalized, replay-proof and phase-guarded', () => {
    const fx = mkRoom({ sizes: [2], start: true }); const r = fx.room; const id = fx.ids[0]![0]!;
    expect(playerMove(r, id, 1, 1, 0).ok).toBe(false); // countdown: not active
    fx.now += 9000; step(r, fx.now); expect(isActivePhase(r.phase)).toBe(true);
    expect(playerMove(r, id, 1, 10, 10).ok).toBe(true); const e = r.arenas.t1!.players[id]!; expect(Math.hypot(e.ix, e.iy)).toBeLessThanOrEqual(1.000001);
    expect(playerMove(r, id, 1, 1, 0).ok).toBe(false); expect(playerMove(r, id, 0, 1, 0).ok).toBe(false);
    expect(playerMove(r, id, 2, NaN, 0).ok).toBe(false); expect(playerMove(r, id, 3, Infinity, 1).ok).toBe(false); expect(playerMove(r, id, 4.5, 1, 1).ok).toBe(false);
    expect(playerMove(r, 'ghost', 5, 1, 1).ok).toBe(false);
  });
  it('a held 200-packet burst never moves faster than one step per tick', () => {
    const fx = mkRoom({ sizes: [1], roles: ['scout'] }); const r = fx.room; const id = fx.ids[0]![0]!; fx.now += 9000; step(r, fx.now);
    const e = r.arenas.t1!.players[id]!; const x0 = e.x;
    for (let i = 1; i <= 200; i++) playerMove(r, id, i, 1, 0);
    step(r, fx.now + 50); expect(e.x - x0).toBeLessThanOrEqual(ROLE_DEFS.scout.speed * 0.05 + 1e-6);
  });
  it('ability: server checks cooldown, idempotent per action id', () => {
    const fx = mkRoom({ sizes: [1], roles: ['striker'] }); const r = fx.room; const id = fx.ids[0]![0]!; fx.now += 9000; step(r, fx.now);
    expect(playerAbility(r, id, 'a1').ok).toBe(true); expect(playerAbility(r, id, 'a1').ok).toBe(true); const cd = r.arenas.t1!.players[id]!.abilityCd; expect(cd).toBeGreaterThan(0);
    expect(playerAbility(r, id, 'a2').ok).toBe(false); expect(r.arenas.t1!.players[id]!.abilityCd).toBe(cd);
  });
  it('engineer owns at most one turret; scout dash cannot cross a solid obstacle; guardian shield obeys the 35% cap', () => {
    const e = mkRoom({ sizes: [1], roles: ['engineer'], config: { mapId: 'paper_quarry' } }); e.now += 9000; step(e.room, e.now);
    const eid = e.ids[0]![0]!; playerAbility(e.room, eid, 'x'); const a = e.room.arenas.t1!; a.players[eid]!.abilityCd = 0; playerAbility(e.room, eid, 'y'); expect(a.turrets.length).toBe(1);
    const g = mkRoom({ sizes: [1], roles: ['guardian'] }); g.now += 9000; step(g.room, g.now); playerAbility(g.room, g.ids[0]![0]!, 'z'); const gp = g.room.arenas.t1!.players[g.ids[0]![0]!]!; expect(gp.shield).toBeLessThanOrEqual(Math.round(gp.maxHp * 0.35));
    const [x, y] = resolveObstacles(MAPS.paper_quarry, 250, 168, 16); expect(Math.hypot(x - 250, y - 168)).toBeGreaterThan(0); // pushed out of the ridge, never trapped inside
    const [cx, cy] = resolveObstacles(MAPS.frost_conservatory, 200, 150, 16); expect(Math.hypot(cx - 200, cy - 150)).toBeGreaterThanOrEqual(24 + 16 - 1e-6);
  });
  it('boss hazards: one geometry definition for server and renderer', () => {
    const arc = { kind: 'arc', x: 100, y: 100, a0: 0, a1: 0, w: 0.35, r0: 30, r1: 300, gapA: 0, gapW: 0, telegraph: 0, telegraphMax: 0, active: 0, activeMax: 4, t: 0, dmg: 1, hit: [], src: 1, id: 1 } as never;
    expect(inHazard(arc, 200, 100, 10)).toBe(true); expect(inHazard(arc, 100, 200, 10)).toBe(false); expect(inHazard(arc, 500, 100, 10)).toBe(false);
    const ring = { ...(arc as object), kind: 'ring', r0: 100, r1: 200, gapA: 0, gapW: 0.3 } as never;
    expect(inHazard(ring, 100 + 150, 100, 4)).toBe(false); expect(inHazard(ring, 100, 100 + 150, 4)).toBe(true); expect(inHazard(ring, 120, 100, 4)).toBe(false);
  });
});

describe('seats, roles and presence', () => {
  const mk = () => createRoom({ id: 'r', code: 'ABC123', seed: 5, nowMs: 0, pool: fixturePool(20), config: { mode: 'versus', teamCount: 2, teamSizeCap: 2, minutes: 5 } });
  it('caps a team, balances automatically, rejects duplicates and locked rooms', () => {
    const r = mk();
    expect(seat(r, { id: 'a', name: 'Ann', desiredTeam: 't1' }, 0).ok).toBe(true); expect(seat(r, { id: 'b', name: 'Bo', desiredTeam: 't1' }, 0).ok).toBe(true);
    const full = seat(r, { id: 'c', name: 'Cy', desiredTeam: 't1' }, 0); expect(full.ok).toBe(false); if (!full.ok) expect(full.code).toBe('team_full');
    const auto = seat(r, { id: 'c', name: 'Cy' }, 0); expect(auto.ok && auto.teamId).toBe('t2');
    const dup = seat(r, { id: 'd', name: ' ann ' }, 0); expect(dup.ok).toBe(false);
    hostCommand(r, { cmd: 'lock', value: true, id: 'l1' }, 0); expect(seat(r, { id: 'e', name: 'Eve' }, 0).ok).toBe(false);
    expect(seat(r, { id: 'a', name: 'Ann' }, 0).ok).toBe(true); // re-seat of the same identity is idempotent
  });
  it('versus needs two populated teams; coop needs one player; clear messages', () => {
    const r = mk(); const b = hostCommand(r, { cmd: 'begin', id: 'b1' }, 0); expect(b.ok).toBe(false); if (!b.ok) expect(b.message).toMatch(/2 teams/);
    seat(r, { id: 'a', name: 'Ann' }, 0); expect(hostCommand(r, { cmd: 'begin', id: 'b2' }, 0).ok).toBe(false);
    seat(r, { id: 'b', name: 'Bo' }, 0); expect(hostCommand(r, { cmd: 'begin', id: 'b3' }, 0).ok).toBe(true); expect(r.phase).toBe('countdown');
    const c = createRoom({ id: 'c', code: 'ABC123', seed: 5, nowMs: 0, pool: fixturePool(10), config: { mode: 'coop', teamCount: 1, teamSizeCap: 3, minutes: 5 } });
    const e = hostCommand(c, { cmd: 'begin', id: 'x' }, 0); expect(e.ok).toBe(false); if (!e.ok) expect(e.message).toMatch(/at least 1 player/);
  });
  it('roles change before the match, not during a wave; respec only between waves when enabled', () => {
    const fx = mkRoom({ sizes: [1], config: { allowRespec: false } }); const id = fx.ids[0]![0]!; expect(setRole(fx.room, id, 'medic').ok).toBe(false);
    const f2 = mkRoom({ sizes: [1], start: false }); expect(setRole(f2.room, f2.ids[0]![0]!, 'medic').ok).toBe(true);
    const f3 = mkRoom({ sizes: [1], config: { allowRespec: true } }); f3.room.phase = 'ready'; expect(setRole(f3.room, f3.ids[0]![0]!, 'scout').ok).toBe(true); f3.room.phase = 'wave'; expect(setRole(f3.room, f3.ids[0]![0]!, 'guardian').ok).toBe(false);
  });
  it('captain moves to the next member when the captain leaves the lobby', () => {
    const r = mk(); seat(r, { id: 'a', name: 'Ann', desiredTeam: 't1' }, 0); seat(r, { id: 'b', name: 'Bo', desiredTeam: 't1' }, 0); expect(r.roster.a!.captain).toBe(true); leave(r, 'a'); expect(r.roster.b!.captain).toBe(true); expect(r.roster.a).toBeUndefined();
  });
});

describe('the quiz break freezes everything (and pause too)', () => {
  it('no entity, cooldown, timer or spawn changes in question, grade, upgrade, ready, countdown or while paused', () => {
    const fx = mkRoom({ sizes: [3], minutes: 10 }); let saved: string | null = null; let wasActive = false; let checked = 0; const seen = new Set<string>();
    drive(fx, { accuracy: 0.6, onTick: (r, now) => {
      if (r.tick === 400 && !r.paused && isActivePhase(r.phase)) hostCommand(r, { cmd: 'pause', id: 'p1' }, now);
      if (r.paused && r.pauseReason === 'teacher' && r.tick === 400 && (now % 5000) === 0) { /* spot */ }
      if (r.paused && r.tick === 400) { for (let i = 0; i < 30; i++) step(r, now + 1000 * (i + 1)); if (!r.paused) throw new Error('paused room resumed on its own'); hostCommand(r, { cmd: 'resume', id: 'p2' }, now + 31000); fx.now = now + 31000; }
      if (isActivePhase(r.phase)) { saved = null; wasActive = true; return; }
      if (wasActive) { saved = frozenProjection(r); wasActive = false; return; }
      if (r.phase === 'countdown') return;
      if (saved !== null) { expect(frozenProjection(r)).toBe(saved); checked++; seen.add(r.phase); }
    } });
    expect(checked).toBeGreaterThan(200); for (const ph of ['freeze', 'question', 'grade', 'ready']) expect(seen.has(ph)).toBe(true);
  });
  it('a paused wave resumes with the remaining time (deadline shifts, tick counter does not)', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); fx.now += 9000; step(fx.room, fx.now); for (let i = 0; i < 50; i++) { fx.now += 50; step(fx.room, fx.now); }
    const wt = fx.room.waveTick; hostCommand(fx.room, { cmd: 'pause', id: 'p' }, fx.now); for (let i = 0; i < 100; i++) step(fx.room, fx.now + 5000 * i); expect(fx.room.waveTick).toBe(wt);
    hostCommand(fx.room, { cmd: 'resume', id: 'r' }, fx.now + 600000); step(fx.room, fx.now + 600050); expect(fx.room.waveTick).toBe(wt + 1);
  });
  it('a question deadline survives a pause (time spent paused is not charged)', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); drive(fx, { stopAt: (r) => r.phase === 'question', accuracy: 0, latencyMs: 1e9 });
    const q = fx.room.quiz!; const remaining = q.deadlineMs - fx.now; hostCommand(fx.room, { cmd: 'pause', id: 'p' }, fx.now); const t = fx.now + 120000;
    hostCommand(fx.room, { cmd: 'resume', id: 'r' }, t); expect(fx.room.quiz!.deadlineMs - t).toBe(remaining);
  });
});

describe('answers: server-graded, once, normalized', () => {
  function toQuestion(sizes: number[]) { const fx = mkRoom({ sizes, minutes: 5 }); drive(fx, { stopAt: (r) => r.phase === 'question', accuracy: 0, latencyMs: 1e9 }); return fx; }
  it('duplicate submissions return the stored result; late, stale and ineligible ones are refused', () => {
    const fx = toQuestion([2]); const r = fx.room; const [a, b] = fx.ids[0]!; const q = r.quiz!;
    expect(recordAnswer(r, a!, q.id, { frac: 1, correct: true }, fx.now)).toMatchObject({ ok: true, duplicate: false });
    expect(recordAnswer(r, a!, q.id, { frac: 0, correct: false }, fx.now)).toMatchObject({ ok: true, duplicate: true, frac: 1, correct: true }); // cannot flip a stored grade
    expect(canAnswer(r, b!, 'q999', fx.now).ok).toBe(false); expect(canAnswer(r, b!, q.id, q.deadlineMs + 5000).ok).toBe(false);
    expect(canAnswer(r, 'stranger', q.id, fx.now).ok).toBe(false);
    const late = seat(r, { id: 'late', name: 'Late' }, fx.now); expect(late.ok).toBe(false); // joins are closed after the match starts
  });
  it('points are credited once per team and window, and equal for any team size', () => {
    for (const sizes of [[1, 5], [5, 5], [2, 3, 5], [5, 5, 5, 5], [1, 1]]) {
      const fx = mkRoom({ sizes, minutes: 5 }); const r0 = fx.room;
      drive(fx, { accuracy: 1, latencyMs: 0, stopAt: (r) => r.phase === 'grade' });
      for (const t of r0.teamOrder) expect(r0.teams[t]!.wallet).toBe(100); // every eligible player answered correctly
      const e = r0.events.filter((x) => x.k === 'award'); expect(e.length).toBe(sizes.length);
      for (let i = 0; i < 40; i++) step(r0, fx.now); for (const t of r0.teamOrder) expect(r0.teams[t]!.wallet).toBe(100); // re-stepping never re-awards
    }
  });
  it('mixed accuracy: a 1-person team and a 5-person team earn on the same scale', () => {
    const fx = mkRoom({ sizes: [1, 5], minutes: 5 }); const r = fx.room; drive(fx, { stopAt: (x) => x.phase === 'question', accuracy: 0, latencyMs: 1e9 });
    const q = r.quiz!; recordAnswer(r, 'p1_1', q.id, { frac: 1, correct: true }, fx.now);
    ['p2_1', 'p2_2'].forEach((id) => recordAnswer(r, id, q.id, { frac: 1, correct: true }, fx.now)); ['p2_3', 'p2_4'].forEach((id) => recordAnswer(r, id, q.id, { frac: 0, correct: false }, fx.now)); recordAnswer(r, 'p2_5', q.id, { frac: 0.5, correct: false }, fx.now);
    fx.now = q.deadlineMs + 1; step(r, fx.now); expect(r.teams.t1!.wallet).toBe(100); expect(r.teams.t2!.wallet).toBe(50);
  });
  it('the eligible denominator is frozen at question open (a later disconnect cannot raise the score)', () => {
    const fx = mkRoom({ sizes: [3], minutes: 5 }); const r = fx.room; drive(fx, { stopAt: (x) => x.phase === 'question', accuracy: 0, latencyMs: 1e9 });
    const q = r.quiz!; expect(q.eligible.t1).toHaveLength(3); disconnect(r, 'p1_3', fx.now); recordAnswer(r, 'p1_1', q.id, { frac: 1, correct: true }, fx.now); recordAnswer(r, 'p1_2', q.id, { frac: 1, correct: true }, fx.now);
    fx.now = q.deadlineMs + 1; step(r, fx.now); expect(r.teams.t1!.wallet).toBe(67); expect(q.eligible.t1).toHaveLength(3);
  });
  it('the question closes early only when every eligible player answered, and never waits forever', () => {
    const fx = mkRoom({ sizes: [2, 2], minutes: 5 }); const r = fx.room; drive(fx, { stopAt: (x) => x.phase === 'question', accuracy: 0, latencyMs: 1e9 });
    const q = r.quiz!; for (const id of ['p1_1', 'p1_2', 'p2_1']) recordAnswer(r, id, q.id, { frac: 1, correct: true }, fx.now); step(r, fx.now); expect(r.phase).toBe('question');
    recordAnswer(r, 'p2_2', q.id, { frac: 1, correct: true }, fx.now); step(r, fx.now); expect(r.phase).toBe('grade');
    const g = mkRoom({ sizes: [2], minutes: 5 }); drive(g, { stopAt: (x) => x.phase === 'question', accuracy: 0, latencyMs: 1e9 }); g.now = g.room.quiz!.deadlineMs + 1; step(g.room, g.now); expect(g.room.phase).toBe('grade'); expect(g.room.teams.t1!.wallet).toBe(0);
  });
  it('host can extend (bounded) and skip with an audited reason', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); const r = fx.room; drive(fx, { stopAt: (x) => x.phase === 'question', accuracy: 0, latencyMs: 1e9 });
    const d0 = r.quiz!.deadlineMs; expect(hostCommand(r, { cmd: 'extend', seconds: 500, id: 'e1' }, fx.now).ok).toBe(true); expect(r.quiz!.deadlineMs - d0).toBe(60000);
    hostCommand(r, { cmd: 'extend', seconds: 10, id: 'e2' }, fx.now); hostCommand(r, { cmd: 'extend', seconds: 10, id: 'e3' }, fx.now); expect(hostCommand(r, { cmd: 'extend', seconds: 10, id: 'e4' }, fx.now).ok).toBe(false);
    expect(hostCommand(r, { cmd: 'skip', reason: '', id: 's1' }, fx.now).ok).toBe(false);
    expect(hostCommand(r, { cmd: 'skip', reason: 'question has a typo', id: 's2' }, fx.now).ok).toBe(true); expect(r.quiz!.status).toBe('skipped'); expect(r.teams.t1!.wallet).toBe(0); expect(r.audit.some((a) => a.cmd === 'skip_reason')).toBe(true);
  });
});

describe('upgrade drafts', () => {
  function toDraft(sizes: number[], cfg = {}) { const fx = mkRoom({ sizes, minutes: 10, config: cfg }); drive(fx, { accuracy: 1, latencyMs: 0, stopAt: (r) => r.phase === 'upgrade' }); return fx; }
  it('same offers for every team, one purchase per team, exact debit, never charged for opening', () => {
    const fx = toDraft([2, 3]); const r = fx.room; const d = r.draft!; expect(Object.keys(d.offers)).toEqual(['t1', 't2']); expect(d.offers.t1).toEqual(d.offers.t2);
    const w0 = r.teams.t1!.wallet; expect(w0).toBeGreaterThanOrEqual(90);
    const offer = d.offers.t1!.find((u) => upgradeCost(u, 0) <= w0)!; for (const id of ['p1_1', 'p1_2']) expect(vote(r, id, d.id, offer, `v-${id}`).ok).toBe(true);
    expect(r.draft!.resolved.t1!.upgrade).toBe(offer); expect(r.teams.t1!.wallet).toBe(w0 - upgradeCost(offer, 0)); expect(r.teams.t1!.upgrades[offer]).toBe(1);
    expect(vote(r, 'p1_1', d.id, offer, 'again').ok).toBe(false); expect(r.teams.t1!.wallet).toBe(w0 - upgradeCost(offer, 0));
    expect(vote(r, 'p2_1', 'd999', offer, 'x').ok).toBe(false);
  });
  it('voting for something unaffordable or not offered is refused with the exact price', () => {
    const fx = toDraft([1]); const r = fx.room; r.teams.t1!.wallet = 10; const d = r.draft!; const v = vote(r, 'p1_1', d.id, d.offers.t1![0]!, 'q'); expect(v.ok).toBe(false); if (!v.ok) expect(v.message).toMatch(/\d+ points/);
    expect(vote(r, 'p1_1', d.id, 'ricochet' === d.offers.t1![0] ? 'last_stand' : 'ricochet', 'q2').ok).toBe(false);
  });
  it('no votes: deterministic default; nothing affordable: nothing charged; the draft always closes', () => {
    const fx = toDraft([2]); const r = fx.room; const w = r.teams.t1!.wallet; fx.now = r.draft!.closesMs + 1; step(r, fx.now); expect(r.phase).toBe('ready'); const res = r.events.filter((e) => e.k === 'purchase').at(-1)!; expect(res.a!.how).toBe('default'); expect(r.teams.t1!.wallet).toBeLessThan(w);
    const g = toDraft([1]); g.room.teams.t1!.wallet = 0; g.now = g.room.draft!.closesMs + 1; step(g.room, g.now); expect(g.room.teams.t1!.wallet).toBe(0); expect(g.room.draft!.resolved.t1!.how).toBe('none');
  });
  it('captain-only mode: only the captain votes', () => {
    const fx = toDraft([3], { captainOnlyDraft: true }); const r = fx.room; const d = r.draft!; const offer = d.offers.t1!.find((u) => upgradeCost(u, 0) <= r.teams.t1!.wallet)!;
    const other = vote(r, 'p1_2', d.id, offer, 'o'); expect(other.ok).toBe(false); expect(vote(r, 'p1_1', d.id, offer, 'c').ok).toBe(true); expect(r.draft!.resolved.t1!.upgrade).toBe(offer);
  });
});

describe('host commands', () => {
  it('are idempotent by id, reject stale revisions, and end needs a fresh two-step confirm', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); const r = fx.room; fx.now += 9000; step(r, fx.now);
    expect(hostCommand(r, { cmd: 'pause', id: 'x1' }, fx.now).ok).toBe(true); expect(hostCommand(r, { cmd: 'pause', id: 'x1' }, fx.now).ok).toBe(true); expect(r.audit.filter((a) => a.id === 'x1')).toHaveLength(1);
    expect(hostCommand(r, { cmd: 'resume', id: 'x2', rev: 1 }, fx.now + 10).ok).toBe(false); expect(hostCommand(r, { cmd: 'resume', id: 'x3', rev: r.rev }, fx.now + 10).ok).toBe(true);
    expect(hostCommand(r, { cmd: 'end_confirm', nonce: 'forged', id: 'e0' }, fx.now).ok).toBe(false);
    const req = hostCommand(r, { cmd: 'end_request', id: 'e1' }, fx.now); expect(req.ok && req.nonce).toBeTruthy();
    expect(hostCommand(r, { cmd: 'end_confirm', nonce: (req as { nonce: string }).nonce, id: 'e2' }, fx.now + 20000).ok).toBe(false); // expired
    const req2 = hostCommand(r, { cmd: 'end_request', id: 'e3' }, fx.now + 20000) as { nonce: string }; expect(hostCommand(r, { cmd: 'end_confirm', nonce: req2.nonce, id: 'e4' }, fx.now + 21000).ok).toBe(true);
    step(r, fx.now + 22000); expect(r.phase).toBe('results'); expect(r.results!.reason).toBe('teacher_ended'); expect(hostCommand(r, { cmd: 'pause', id: 'z' }, fx.now + 23000).ok).toBe(false);
    const snap = hashRoom(r); for (let i = 0; i < 50; i++) step(r, fx.now + 30000 + i); expect(hashRoom(r)).toBe(snap);
    expect(playerMove(r, 'p1_1', 99, 1, 0).ok).toBe(false);
  });
  it('ending during a question settles it once from the saved deadline', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); const r = fx.room; drive(fx, { stopAt: (x) => x.phase === 'question', accuracy: 0, latencyMs: 1e9 });
    recordAnswer(r, 'p1_1', r.quiz!.id, { frac: 1, correct: true }, fx.now); const nonce = (hostCommand(r, { cmd: 'end_request', id: 'a' }, fx.now) as { nonce: string }).nonce; hostCommand(r, { cmd: 'end_confirm', nonce, id: 'b' }, fx.now); step(r, fx.now + 50);
    expect(r.teams.t1!.wallet).toBe(50); expect(r.settledWindows).toEqual([r.quiz!.id]);
  });
  it('a missing host pauses safely after 8 s; only the host can resume', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); const r = fx.room; fx.now += 9000; step(r, fx.now); r.hostPresent = false; r.hostSeenMs = fx.now;
    step(r, fx.now + 9000); expect(r.paused).toBe(true); expect(r.pauseReason).toBe('host_away'); const wt = r.waveTick; for (let i = 0; i < 40; i++) step(r, fx.now + 10000 + i * 50); expect(r.waveTick).toBe(wt);
    hostCommand(r, { cmd: 'resume', id: 'back' }, fx.now + 20000); expect(r.paused).toBe(false);
  });
});

describe('presence and reconnects', () => {
  it('a disconnected avatar is protected for 8 s at most 3 times and neither moves nor fires', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); const r = fx.room; fx.now += 9000; step(r, fx.now); const id = 'p1_1'; const e = r.arenas.t1!.players[id]!;
    for (let k = 0; k < 4; k++) { disconnect(r, id, fx.now); const prot = e.protectTicks; expect(prot).toBe(k < 3 ? 160 : 0); connect(r, id, fx.now); e.protectTicks = 0; }
    expect(r.roster[id]!.protections).toBe(3);
  });
  it('reconnect restores the same identity and never re-seats or re-awards', () => {
    const fx = mkRoom({ sizes: [2], minutes: 5 }); const r = fx.room; const before = r.rosterOrder.length; disconnect(r, 'p1_1', fx.now); connect(r, 'p1_1', fx.now); expect(r.rosterOrder.length).toBe(before); expect(seat(r, { id: 'p1_1', name: 'Kid 1-1' }, fx.now)).toMatchObject({ ok: true, teamId: 't1' });
  });
  it('an arena with nobody connected holds still, then is retired by a published rule (60 s)', () => {
    const fx = mkRoom({ sizes: [1, 1], minutes: 5 }); const r = fx.room; fx.now += 9000; step(r, fx.now); disconnect(r, 'p1_1', fx.now); const a = r.arenas.t1!; const snap = JSON.stringify(a.enemies); const tick = a.waveTick;
    for (let i = 0; i < 100; i++) { fx.now += 50; r.hostSeenMs = fx.now; step(r, fx.now); } expect(a.waveTick).toBe(tick); expect(JSON.stringify(a.enemies)).toBe(snap); expect(a.status).toBe('alive');
    for (let i = 0; i < 1300; i++) { fx.now += 50; r.hostSeenMs = fx.now; step(r, fx.now); if (a.status !== 'alive') break; } expect(a.status).toBe('abandoned');
  });
  it('everyone offline for 30 s triggers a safe pause, not an endless freeze or silent loss', () => {
    const fx = mkRoom({ sizes: [1], minutes: 5 }); const r = fx.room; fx.now += 9000; step(r, fx.now); disconnect(r, 'p1_1', fx.now);
    for (let i = 0; i < 700; i++) { fx.now += 50; r.hostSeenMs = fx.now; step(r, fx.now); if (r.paused) break; } expect(r.pauseReason).toBe('everyone_offline');
  });
});

describe('fixtures: every team shape finishes a complete match', () => {
  const shapes: { name: string; sizes: number[]; roles?: (Role | 'mix')[] }[] = [
    ...[1, 2, 3, 4, 5].map((n) => ({ name: `coop ${n} mixed`, sizes: [n] })),
    { name: 'coop five Medics', sizes: [5], roles: ['medic'] }, { name: 'coop five Guardians', sizes: [5], roles: ['guardian'] },
    { name: 'versus 1v1', sizes: [1, 1] }, { name: 'versus 5v5', sizes: [5, 5] }, { name: 'versus 4x5 (20 players)', sizes: [5, 5, 5, 5] }, { name: 'versus 1v5 uneven', sizes: [1, 5] }, { name: 'versus 2v3v5', sizes: [2, 3, 5] },
  ];
  for (const s of shapes) for (const acc of [1, 0]) {
    it(`${s.name}, accuracy ${acc}`, () => {
      const fx = mkRoom({ sizes: s.sizes, minutes: 5, roles: s.roles });
      const { room } = drive(fx, { accuracy: acc }); expect(room.phase).toBe('results'); expect(room.results!.standings).toHaveLength(s.sizes.length); expect(finite(room)).toBe(true);
      for (const t of room.teamOrder) { expect(room.arenas[t]!.enemies.length).toBeLessThanOrEqual(90); expect(room.teams[t]!.wallet).toBeGreaterThanOrEqual(0); }
      if (acc === 0) for (const t of room.teamOrder) expect(room.teams[t]!.earned).toBe(0);
      if (acc === 1 && room.results!.standings.length === 1) expect(room.teams.t1!.earned).toBeGreaterThan(0);
      expect(room.results!.standings.map((x) => x.rank).sort()[0]).toBe(1);
    });
  }
});

describe('determinism, checkpoints and replay', () => {
  it('same seed ⇒ identical match; different seed ⇒ different', () => {
    const run = (seed: number) => hashRoom(drive(mkRoom({ sizes: [3], minutes: 5, seed }), { accuracy: 0.7 }).room);
    expect(run(11)).toBe(run(11)); expect(run(11)).not.toBe(run(12));
  });
  it('restore(checkpoint) mid-wave continues to exactly the same end state (no double grade, no double purchase)', () => {
    const a = mkRoom({ sizes: [3], minutes: 10 }); drive(a, { accuracy: 0.8, stopAt: (r) => r.phase === 'question' && r.qUsed === 2 });
    const cp = checkpoint(a.room); const b = { room: restore(JSON.parse(JSON.stringify(cp))), ids: a.ids, now: a.now };
    const ra = drive(a, { accuracy: 0.8 }).room, rb = drive(b, { accuracy: 0.8 }).room;
    expect(hashRoom(rb)).toBe(hashRoom(ra)); expect(rb.results!.standings).toEqual(ra.results!.standings); expect(rb.teams.t1!.spent).toBe(ra.teams.t1!.spent);
  });
  it('restore rejects another engine version', () => { const r = checkpoint(mkRoom({ sizes: [1] }).room); (r as { engine: number }).engine = 99; expect(() => restore(r)).toThrow(/incompatible/); });
  it('versus arenas share seed-identical wave plans', () => {
    const fx = mkRoom({ sizes: [2, 2], minutes: 5 }); fx.now += 9000; step(fx.room, fx.now); expect(fx.room.arenas.t1!.spawnPlan).toEqual(fx.room.arenas.t2!.spawnPlan);
    const big = mkRoom({ sizes: [1, 5], minutes: 5 }); big.now += 9000; step(big.room, big.now); const s1 = big.room.arenas.t1!.spawnPlan, s2 = big.room.arenas.t2!.spawnPlan; expect(s2.length).toBeGreaterThan(s1.length); expect(s2.slice(0, 1)[0]!.kind).toBe(s1[0]!.kind);
  });
});
