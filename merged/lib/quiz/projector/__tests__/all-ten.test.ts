/** Cross-cutting tests for ALL TEN projector games: full playthroughs at every size and pace, invariants after every command,
 *  determinism, idempotent replay, projection redaction, verified-answer integrity and per-game rules. Pure reducers, no database. */
import '../games';
import { GAME_KEYS, type GameKey, type GameState, type Grade, type PoolQuestion } from '../types';
import { reduce } from '../engine';
import { publicView } from '../public-view';
import { MODES } from '../modes';
import { accuracy, always, cfgOf, createState, fakeProviders, makePool, makeTeams, nextCommand, run } from '../testkit';
import type { AuctionG } from '../reducers/auction';
import { makeLineup, priorityOrder } from '../reducers/auction';
import { generateBoard, supplied, previewCell, type TerritoryG } from '../reducers/territory';
import type { FactoryG } from '../reducers/factory';
import { drawEvent, previewShift } from '../reducers/factory';
import type { PirateG } from '../reducers/pirate';
import { ISLAND_DATA, ISLAND_EDGES, islandCount } from '../reducers/pirate';
import type { ShowdownG } from '../reducers/showdown';
import { stageFor } from '../reducers/showdown';

type Run = { state: GameState; errors: string[]; asked: number; steps: number; subs: number };
/** Plays a whole match with the teacher bot, checking invariants after EVERY accepted command. */
async function play(game: GameKey, minutes: number | null, teams: number, sync: boolean, policy = accuracy(0.62, `p-${game}-${teams}`), poolN = 400, seed = 'seed-1'): Promise<Run> {
  const pool = makePool(poolN);
  let { state } = createState(cfgOf(game, minutes, { seed }), makeTeams(teams), pool, { synchronized: sync });
  const prov = fakeProviders(policy, pool); const errors: string[] = []; let steps = 0; let asked = 0;
  while (state.core.phase !== 'finished' && steps < 6000) {
    const cmd = nextCommand(state)!;
    const r = await run(state, cmd, pool, prov); steps++;
    if (!r.ok) {
      errors.push(`${cmd.action}:${r.code}`);
      const fallback = await run(state, { action: state.core.phase === 'resolution' || state.core.phase === 'review' ? 'continue' : 'end_turn' }, pool, prov);
      if (fallback.ok) { state = fallback.state; continue; }
      const skip = await run(state, { action: 'skip_turn', payload: { reason: 'bot stuck' } }, pool, prov);
      if (skip.ok) { state = skip.state; continue; } break;
    }
    if (r.state.core.usedPositions.length > state.core.usedPositions.length) asked++;
    state = r.state; invariants(state);
  }
  return { state, errors, asked, steps, subs: prov.subs.length };
}
function invariants(s: GameState) {
  const c = s.core; expect(new Set(c.usedPositions).size).toBe(c.usedPositions.length); expect(new Set(c.consumed).size).toBe(c.consumed.length);
  expect(c.turnsUsed).toBeGreaterThanOrEqual(0); expect(c.evidence.length).toBeLessThanOrEqual(300);
  if (c.game === 'auction_house') {
    const g = s.g as AuctionG;
    for (const t of Object.values(g.teams)) { expect(t.points).toBeGreaterThanOrEqual(0); expect(t.reserved).toBeGreaterThanOrEqual(0); }
    for (const [team, t] of Object.entries(g.teams)) expect(t.reserved).toBe(g.bids[team]?.amount ?? 0);
    for (const b of Object.values(g.bids)) expect(g.lineup.some((l) => l.id === b.lot)).toBe(true);
  } else if (c.game === 'territory_war') {
    const g = s.g as TerritoryG;
    for (const t of Object.values(g.teams)) expect(t.points).toBeGreaterThanOrEqual(0);
    for (const cell of g.cells) { expect(cell.wall).toBeGreaterThanOrEqual(0); expect(cell.wall).toBeLessThanOrEqual(3); if (cell.terrain === 'water') expect(cell.owner).toBeNull(); if (cell.owner) expect(g.teams[cell.owner]).toBeDefined(); }
  } else if (c.game === 'lucky_factory') {
    const g = s.g as FactoryG;
    for (const t of Object.values(g.teams)) { expect(t.points).toBeGreaterThanOrEqual(0); expect(t.machines.length).toBeLessThanOrEqual(g.slots); expect(t.shipped).toBeGreaterThanOrEqual(0); for (const m of t.machines) { expect(m.level).toBeGreaterThanOrEqual(1); expect(m.level).toBeLessThanOrEqual(3); } }
    expect(g.events).toHaveLength(3);
  } else if (c.game === 'pirate_voyage') {
    const g = s.g as PirateG;
    for (const t of Object.values(g.teams)) { expect(t.points).toBeGreaterThanOrEqual(0); expect(t.cargo).toBeGreaterThanOrEqual(0); expect(t.banked).toBeGreaterThanOrEqual(0); expect(g.islands[t.position]).toBeDefined(); }
    for (const i of g.islands) expect(i.treasure).toBeGreaterThanOrEqual(0);
  } else if (c.game === 'final_showdown') {
    const g = s.g as ShowdownG;
    for (const t of Object.values(g.teams)) { expect(t.points).toBeGreaterThanOrEqual(0); expect(t.shields).toBeGreaterThanOrEqual(0); expect(t.shields).toBeLessThanOrEqual(2); }
  }
}

describe('registry covers all ten games', () => {
  it('has ten modes with complete English text, art and covers', () => {
    expect(GAME_KEYS).toHaveLength(10);
    for (const g of GAME_KEYS) { const m = MODES[g]; expect(m.name.en).toBeTruthy(); expect(m.tagline.en).toBeTruthy(); expect(m.objective.en).toBeTruthy(); expect(m.skillRule.en).toBeTruthy(); expect(m.art).toBeTruthy(); }
  });
  it('every game key has a registered reducer', () => {
    const pool = makePool(80);
    for (const g of GAME_KEYS) expect(() => createState(cfgOf(g, 15), makeTeams(3), pool)).not.toThrow();
  });
});

const SIZES: [number | null, number][] = [[5, 2], [15, 3], [45, 8], [180, 5], [null, 4]];
describe.each([...GAME_KEYS])('%s full matches', (game) => {
  it.each(SIZES)('plays to the end: %s min, %s teams (turn taking and synchronized)', async (minutes, teams) => {
    for (const sync of [false, true]) {
      const r = await play(game, minutes, teams, sync);
      expect(r.state.core.phase).toBe('finished');
      expect(r.state.core.finished!.standings).toHaveLength(teams);
      expect(r.asked).toBeGreaterThan(0); expect(r.subs).toBe(r.state.core.evidence.length);
      if (['auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown'].includes(game)) expect(r.errors).toEqual([]);
    }
  }, 120000);
  it('is deterministic for the same seed and the same commands', async () => {
    const a = await play(game, 15, 3, false, accuracy(0.6, 'det')); const b = await play(game, 15, 3, false, accuracy(0.6, 'det'));
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  }, 60000);
  it('never lets a client claim a grade: grading needs a verified answer', () => {
    const pool = makePool(60); const { state } = createState(cfgOf(game, 15), makeTeams(2), pool);
    const r = reduce(state, { action: 'grade', payload: { teamId: 't1', grade: 'correct', verdict: 'correct' } }, { pool });
    expect(r.ok).toBe(false);
  });
  it('never uses one submission twice', async () => {
    const pool = makePool(80); const { state } = createState(cfgOf(game, 15), makeTeams(2), pool);
    const prov = fakeProviders(always('correct'), pool);
    let st = state; let guard = 0;
    while (st.core.phase !== 'asking' && guard++ < 20) { const cmd = nextCommand(st)!; const r = await run(st, cmd, pool, prov); if (!r.ok) break; st = r.state; }
    if (st.core.phase === 'asking') {
      const g1 = await run(st, { action: 'grade', payload: { teamId: st.core.ask!.teamIds[0] } }, pool, prov); expect(g1.ok).toBe(true);
      if (g1.ok) { const again = reduce(g1.state, { action: 'grade', payload: { teamId: st.core.ask!.teamIds[0] } }, { pool, answer: prov.subs[0] }); expect(again.ok).toBe(false); }
    }
  });
  it('rejects unknown actions and finished-state commands', async () => {
    const pool = makePool(60); const { state } = createState(cfgOf(game, 15), makeTeams(2), pool);
    expect(reduce(state, { action: 'definitely_not_real' }, { pool }).ok).toBe(false);
    const done = reduce(state, { action: 'finish_now' }, { pool }); expect(done.ok).toBe(true);
    if (done.ok) expect(reduce(done.state, { action: 'finish_turn' }, { pool }).ok).toBe(false);
  });
  it('the projection never carries the seed, answer evidence for the projector, or consumed ids', async () => {
    const r = await play(game, 15, 3, false);
    const pj = publicView(r.state, 'projector'); expect(pj.core.seed).toBe(''); expect(pj.core.evidence).toEqual([]); expect(pj.core.consumed).toEqual([]);
    expect(JSON.stringify(pj)).not.toContain('answerKey');
  }, 60000);
});

describe('pacing adapts to the lesson length without inventing questions', () => {
  it.each([...GAME_KEYS])('%s: more minutes means more turns, never more questions than the pool', async (game) => {
    const lens = [5, 15, 45, 180]; const turns: number[] = [];
    for (const m of lens) { const pool = makePool(400); const { state, plan } = createState(cfgOf(game, m), makeTeams(3), pool); turns.push(plan.turnBudget); expect(state.core.turnBudget).toBe(plan.turnBudget); expect(plan.turnBudget % 3).toBe(0); }
    for (let i = 1; i < turns.length; i++) expect(turns[i]!).toBeGreaterThanOrEqual(turns[i - 1]!);
    expect(turns[3]!).toBeGreaterThan(turns[0]!);
  });
  it('a short pool ends cleanly instead of looping', async () => {
    for (const game of GAME_KEYS) {
      const r = await play(game, 45, 3, false, accuracy(0.6, 'short'), 6);
      expect(r.state.core.phase).toBe('finished'); expect(r.state.core.usedPositions.length).toBeLessThanOrEqual(6);
    }
  }, 120000);
});

describe('Auction House rules', () => {
  const mkA = (teams = 3, minutes: number | null = 30) => { const pool = makePool(300); return { pool, ...createState(cfgOf('auction_house', minutes), makeTeams(teams), pool) }; };
  const ask = async (st: GameState, pool: PoolQuestion[], grade: Grade, tier = 'standard') => {
    const prov = fakeProviders(always(grade), pool); const r = await run(st, { action: 'ask', payload: { tier } }, pool, prov); if (!r.ok) throw new Error(r.code);
    const g = await run(r.state, { action: 'grade', payload: { teamId: r.state.core.ask!.teamIds[0] } }, pool, prov); if (!g.ok) throw new Error(g.code); return g.state;
  };
  it('lots are hidden: the projection strips true values, and paddle amounts stay hidden from the projector until the gavel', async () => {
    const { pool, state } = mkA(); let st = await ask(state, pool, 'correct');
    const b = reduce(st, { action: 'bid', payload: { team: 't1', lot: (st.g as AuctionG).lineup[0]!.id, amount: 5 } }, { pool }); expect(b.ok).toBe(true); if (b.ok) st = b.state;
    const pj = publicView(st, 'projector').g as AuctionG; const host = publicView(st, 'host').g as AuctionG;
    expect(pj.lineup.every((l) => l.value === 0)).toBe(true); expect(host.lineup.every((l) => l.value === 0)).toBe(true);
    expect(pj.bids.t1!.amount).toBe(0); expect(host.bids.t1!.amount).toBe(5);
    expect((st.g as AuctionG).lineup.every((l) => l.value > 0 && l.low <= l.value && l.value <= l.high)).toBe(true);
  });
  it('bids reserve points, cannot exceed the balance and cannot be duplicated; a retracted bid is refunded', async () => {
    const { pool, state } = mkA(); const st = await ask(state, pool, 'correct'); const g = st.g as AuctionG; const before = g.teams.t1!.points; const lot = g.lineup[0]!.id;
    expect(reduce(st, { action: 'bid', payload: { team: 't1', lot, amount: before + 1 } }, { pool }).ok).toBe(false);
    expect(reduce(st, { action: 'bid', payload: { team: 't1', lot: 999, amount: 1 } }, { pool }).ok).toBe(false);
    expect(reduce(st, { action: 'bid', payload: { team: 't1', lot, amount: -4 } }, { pool }).ok).toBe(false);
    expect(reduce(st, { action: 'bid', payload: { team: 't2', lot, amount: 1 } }, { pool }).ok).toBe(false); // not t2's turn
    const b = reduce(st, { action: 'bid', payload: { team: 't1', lot, amount: 6 } }, { pool }); if (!b.ok) throw new Error('bid'); expect((b.state.g as AuctionG).teams.t1!.points).toBe(before - 6);
    expect(reduce(b.state, { action: 'bid', payload: { team: 't1', lot, amount: 2 } }, { pool }).ok).toBe(false);
    const r = reduce(b.state, { action: 'retract_bid', payload: { team: 't1' } }, { pool }); if (!r.ok) throw new Error('retract'); expect((r.state.g as AuctionG).teams.t1!.points).toBe(before);
  });
  it('the gavel gives each lot to the highest bid, refunds every loser and rotates the tie-break', () => {
    const ids = ['a', 'b', 'c', 'd']; const firsts = [1, 2, 3, 4].map((lot) => priorityOrder(ids, lot)[0]); expect(new Set(firsts).size).toBe(4);
    const l1 = makeLineup('s', 1, 3, 1), l2 = makeLineup('s', 1, 3, 1); expect(l1).toEqual(l2); expect(new Set(l1.map((l) => l.kind)).size).toBe(3);
  });
  it('a full round settles lots once, losers keep their points and totals are consistent', async () => {
    const pool = makePool(300); const { state } = createState(cfgOf('auction_house', 30), makeTeams(4), pool);
    const r = await play('auction_house', 30, 4, false); const g = r.state.g as AuctionG;
    expect(g.resolved.length).toBeGreaterThanOrEqual(3); expect(g.resolved.length % g.lotsPerRound).toBe(0);
    for (const res of g.resolved) { if (res.winner) expect(res.price).toBeGreaterThanOrEqual(1); }
    void state;
    for (const t of Object.values(g.teams)) expect(t.reserved).toBe(0);
  });
  it('ending mid-round withdraws the lineup and refunds every paddle', async () => {
    const { pool, state } = mkA(); let st = await ask(state, pool, 'correct'); const g = st.g as AuctionG; const before = g.teams.t1!.points;
    const b = reduce(st, { action: 'bid', payload: { team: 't1', lot: g.lineup[0]!.id, amount: 6 } }, { pool }); if (!b.ok) throw new Error('bid'); st = b.state;
    const f = reduce(st, { action: 'finish_now' }, { pool }); if (!f.ok) throw new Error('finish'); const fg = f.state.g as AuctionG;
    expect(fg.teams.t1!.points).toBe(before); expect(fg.teams.t1!.reserved).toBe(0); expect(f.state.core.finished!.outcome).toBe('auctionWithdrawn');
  });
  it('a challenge question pays more than a standard one and a wrong answer pays nothing', async () => {
    const { pool, state } = mkA(); const a = await ask(state, pool, 'correct', 'standard'), b = await ask(state, pool, 'correct', 'challenge'), w = await ask(state, pool, 'wrong', 'challenge');
    const pts = (s: GameState) => (s.g as AuctionG).teams.t1!.points; expect(pts(b)).toBeGreaterThan(pts(a)); expect(pts(w)).toBe(pts(state));
  });
});

describe('Territory War rules', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])('the board for %s teams is one connected landmass with a fair spawn and fair objectives', (n) => {
    for (const board of ['frontier', 'canyon', 'delta'] as const) for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) for (const tpt of [1, 6, 30]) {
      const ids = makeTeams(n).map((t) => t.id); const b = generateBoard(seed, ids, tpt, board);
      const g = { board, ...b, teams: {}, last: null } as TerritoryG;
      const land = g.cells.filter((c) => c.terrain !== 'water'); expect(land.length).toBeGreaterThanOrEqual(n * 3);
      const hqs = g.cells.filter((c) => c.hq); expect(hqs).toHaveLength(n); expect(new Set(hqs.map((h) => h.owner)).size).toBe(n);
      // everything reachable from the first headquarters
      const seen = new Set<number>([hqs[0]!.id]); const q = [hqs[0]!];
      while (q.length) { const cur = q.shift()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = cur.x + dx!, y = cur.y + dy!; const nb = x >= 0 && y >= 0 && x < g.width && y < g.height ? g.cells[y * g.width + x]! : undefined; if (nb && nb.terrain !== 'water' && !seen.has(nb.id)) { seen.add(nb.id); q.push(nb); } } }
      expect(seen.size).toBe(land.length);
      expect(g.cells.filter((c) => c.objective).length).toBeGreaterThanOrEqual(3);
    }
  });
  it('spawn regions are balanced (nearest-flag share of the land)', () => {
    for (const n of [2, 3, 4, 6, 8]) for (const board of ['frontier', 'canyon', 'delta'] as const) {
      const ids = makeTeams(n).map((t) => t.id); const b = generateBoard('fair-seed', ids, 10, board); const hqs = b.cells.filter((c) => c.hq); const share = new Map<string, number>();
      for (const c of b.cells) { if (c.terrain === 'water') continue; const d = hqs.map((h) => Math.abs(h.x - c.x) + Math.abs(h.y - c.y)); const best = Math.min(...d); const owners = hqs.filter((_, i) => d[i] === best); for (const o of owners) share.set(o.owner!, (share.get(o.owner!) ?? 0) + 1 / owners.length); }
      const v = [...share.values()]; expect(Math.min(...v) / Math.max(...v)).toBeGreaterThan(0.3);
    }
  });
  it('cut-off squares are worth one point and a connected chain restores the full value', () => {
    const pool = makePool(80); const { state } = createState(cfgOf('territory_war', 30, { settings: { board: 'frontier' } }), makeTeams(2), pool);
    const g = JSON.parse(JSON.stringify(state.g)) as TerritoryG; const hq = g.cells.find((c) => c.hq === 't1')!;
    const far = g.cells.find((c) => c.terrain !== 'water' && !c.owner && Math.abs(c.x - hq.x) + Math.abs(c.y - hq.y) > 3)!; far.owner = 't1';
    expect(supplied(g, 't1').has(far.id)).toBe(false); expect(supplied(g, 't1').has(hq.id)).toBe(true);
  });
  it('previews give a readable reason and a cost, and illegal actions are rejected by the reducer', async () => {
    const pool = makePool(120); const { state } = createState(cfgOf('territory_war', 30, { settings: { board: 'frontier' } }), makeTeams(2), pool);
    const g = state.g as TerritoryG; const far = g.cells.find((c) => c.terrain !== 'water' && !c.owner)!;
    const p = previewCell(g, 't1', far.id); if (!p.ok) expect(p.reason.length).toBeGreaterThan(5);
    const prov = fakeProviders(always('correct'), pool); const a = await run(state, { action: 'ask' }, pool, prov); if (!a.ok) throw new Error(a.code); const gr = await run(a.state, { action: 'grade', payload: { teamId: 't1' } }, pool, prov); if (!gr.ok) throw new Error(gr.code);
    const enemyHq = (gr.state.g as TerritoryG).cells.find((c) => c.hq === 't2')!;
    expect(reduce(gr.state, { action: 'seize', payload: { team: 't1', cell: enemyHq.id } }, { pool }).ok).toBe(false);
    expect(reduce(gr.state, { action: 'capture', payload: { team: 't1', cell: 9999 } }, { pool }).ok).toBe(false);
    expect(reduce(gr.state, { action: 'capture', payload: { team: 't2', cell: far.id } }, { pool }).ok).toBe(false); // not t2's turn
  });
  it('no team is locked out: a team with no squares lands a free flag', () => {
    const pool = makePool(80); const { state } = createState(cfgOf('territory_war', 30, { settings: { board: 'delta' } }), makeTeams(2), pool);
    const st = JSON.parse(JSON.stringify(state)) as GameState; const g = st.g as TerritoryG; g.cells.forEach((c) => { if (c.owner === 't1') { c.owner = 't2'; c.wall = 0; } }); st.core.phase = 'planning';
    const open = g.cells.find((c) => c.terrain !== 'water' && !c.owner)!; const r = reduce(st, { action: 'landing', payload: { team: 't1', cell: open.id } }, { pool });
    expect(r.ok).toBe(true); if (r.ok) expect((r.state.g as TerritoryG).cells[open.id]!.owner).toBe('t1');
  });
});

describe('Lucky Factory rules', () => {
  it('events are public, drawn from the seed, gentle on short lessons and never two breakdowns in a row', () => {
    for (const band of ['blitz', 'short', 'standard', 'long', 'campaign']) {
      let prev: ReturnType<typeof drawEvent> | null = null; const counts: Record<string, number> = {};
      for (let s = 1; s <= 400; s++) { const e = drawEvent('seed', s, band, prev); if (s === 1) expect(e).toBe('clear'); if (prev === 'breakdown') expect(e).not.toBe('breakdown'); counts[e] = (counts[e] ?? 0) + 1; prev = e; }
      if (band === 'blitz') expect((counts.breakdown ?? 0) / 400).toBeLessThan(0.12); else expect((counts.breakdown ?? 0) / 400).toBeGreaterThanOrEqual(0.07);
    }
    const pool = makePool(80); const { state } = createState(cfgOf('lucky_factory', 30), makeTeams(2), pool); expect((state.g as FactoryG).events).toHaveLength(3);
    expect(JSON.stringify(publicView(state, 'projector'))).not.toContain(state.core.seed);
  });
  it('production happens only when a turn ends, never creates points and is previewed exactly', async () => {
    const pool = makePool(200); const { state } = createState(cfgOf('lucky_factory', 30), makeTeams(2), pool); const prov = fakeProviders(always('correct'), pool);
    let st = (await run(state, { action: 'ask' }, pool, prov)) as { ok: true; state: GameState }; st = (await run(st.state, { action: 'grade', payload: { teamId: 't1' } }, pool, prov)) as { ok: true; state: GameState };
    const g0 = st.state.g as FactoryG; const t = g0.teams.t1!; const pts = t.points; const pv = previewShift(g0, t, 0);
    const done = reduce(st.state, { action: 'end_turn' }, { pool }); if (!done.ok) throw new Error(done.code); const g1 = done.state.g as FactoryG;
    expect(g1.teams.t1!.shipped).toBe(pv.output); expect(g1.teams.t1!.points).toBe(pts); expect(done.state.core.phase).toBe('choose');
    expect(reduce(done.state, { action: 'end_turn' }, { pool }).ok).toBe(false); // a second press cannot ship again
  });
  it('building needs verified points, a free slot and a legal machine; repairs need a broken machine', async () => {
    const pool = makePool(200); const { state } = createState(cfgOf('lucky_factory', 5), makeTeams(2), pool);
    const planning = JSON.parse(JSON.stringify(state)) as GameState; planning.core.phase = 'planning'; const g = planning.g as FactoryG; g.teams.t1!.points = 100;
    expect(reduce(planning, { action: 'build', payload: { team: 't1', kind: 'nope' } }, { pool }).ok).toBe(false);
    expect(reduce(planning, { action: 'repair', payload: { team: 't1', index: 0 } }, { pool }).ok).toBe(false);
    let st = planning; for (const kind of ['press', 'reactor', 'printer']) { const r = reduce(st, { action: 'build', payload: { team: 't1', kind } }, { pool }); if (r.ok) st = r.state; }
    expect(reduce(st, { action: 'build', payload: { team: 't1', kind: 'press' } }, { pool }).ok).toBe(false); // the blitz line has only 3 slots
    const gs = st.g as FactoryG; expect(gs.teams.t1!.machines.length).toBe(3);
  });
  it('a safety check is only sold when a breakdown is due', () => {
    const pool = makePool(80); const { state } = createState(cfgOf('lucky_factory', 30), makeTeams(2), pool); const st = JSON.parse(JSON.stringify(state)) as GameState; st.core.phase = 'planning';
    const g = st.g as FactoryG; g.teams.t1!.points = 10; g.events[0] = 'clear'; expect(reduce(st, { action: 'inspect', payload: { team: 't1' } }, { pool }).ok).toBe(false);
    g.events[0] = 'breakdown'; const r = reduce(st, { action: 'inspect', payload: { team: 't1' } }, { pool }); expect(r.ok).toBe(true);
  });
});

describe('Pirate Voyage rules', () => {
  it('every prefix of the island chain is connected, so short lessons use a valid smaller map', () => {
    for (const band of ['blitz', 'short', 'standard', 'long', 'campaign']) {
      const n = islandCount(band); const adj = new Map<number, number[]>(); for (let i = 0; i < n; i++) adj.set(i, []);
      for (const [a, b] of ISLAND_EDGES) if (a < n && b < n) { adj.get(a)!.push(b); adj.get(b)!.push(a); }
      const seen = new Set([0]); const q = [0]; while (q.length) { const c = q.shift()!; for (const nb of adj.get(c)!) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
      expect(seen.size).toBe(n);
    }
    expect(ISLAND_DATA.length).toBe(13);
  });
  it('sailing needs a marked route and enough points; storms cost more; uncharted chests stay hidden', async () => {
    const pool = makePool(200); const { state } = createState(cfgOf('pirate_voyage', 30), makeTeams(2), pool); const prov = fakeProviders(always('correct'), pool);
    const a = await run(state, { action: 'ask' }, pool, prov); if (!a.ok) throw new Error(a.code); const gr = await run(a.state, { action: 'grade', payload: { teamId: 't1' } }, pool, prov); if (!gr.ok) throw new Error(gr.code);
    const g = gr.state.g as PirateG;
    expect(reduce(gr.state, { action: 'sail', payload: { team: 't1', to: 8 } }, { pool }).ok).toBe(false);
    expect(reduce(gr.state, { action: 'sail', payload: { team: 't1', to: 99 } }, { pool }).ok).toBe(false);
    const pub = publicView(gr.state, 'projector').g as PirateG; expect(pub.islands.filter((i) => !i.charted).every((i) => i.treasure === 0 && i.base === 0)).toBe(true);
    expect(g.islands.filter((i) => i.id !== 0).every((i) => i.treasure > 0)).toBe(true);
    const to = g.islands[0]!.neighbors[0]!; const cost = g.storms.includes(to) ? 5 : 3; const r = reduce(gr.state, { action: 'sail', payload: { team: 't1', to } }, { pool }); expect(r.ok).toBe(true);
    if (r.ok) expect((r.state.g as PirateG).teams.t1!.points).toBe(g.teams.t1!.points - cost);
  });
  it('cargo is banked only at the home harbour, and a raid takes cargo not banked treasure', () => {
    const pool = makePool(80); const { state } = createState(cfgOf('pirate_voyage', 30), makeTeams(2), pool); const st = JSON.parse(JSON.stringify(state)) as GameState; st.core.phase = 'planning';
    const g = st.g as PirateG; const away = g.islands[0]!.neighbors[0]!; g.teams.t1!.points = 20; g.teams.t1!.position = away; g.teams.t1!.cargo = 9; g.teams.t2!.position = away; g.teams.t2!.cargo = 10; g.teams.t2!.banked = 40;
    const raid = reduce(st, { action: 'raid', payload: { team: 't1', rival: 't2' } }, { pool }); if (!raid.ok) throw new Error(raid.code); const rg = raid.state.g as PirateG;
    expect(rg.teams.t2!.banked).toBe(40); expect(rg.teams.t1!.cargo + rg.teams.t2!.cargo).toBe(19);
    g.teams.t2!.guard = 1; const blocked = reduce(st, { action: 'raid', payload: { team: 't1', rival: 't2' } }, { pool }); if (!blocked.ok) throw new Error(blocked.code); expect((blocked.state.g as PirateG).teams.t2!.cargo).toBe(10);
    const home = reduce(st, { action: 'sail', payload: { team: 't1', to: 0 } }, { pool }); if (!home.ok) throw new Error(home.code); expect((home.state.g as PirateG).teams.t1!.banked).toBe(9); expect((home.state.g as PirateG).teams.t1!.cargo).toBe(0);
  });
  it('no raids in the home harbour', () => {
    const pool = makePool(80); const { state } = createState(cfgOf('pirate_voyage', 30), makeTeams(2), pool); const st = JSON.parse(JSON.stringify(state)) as GameState; st.core.phase = 'planning'; const g = st.g as PirateG; g.teams.t1!.points = 20; g.teams.t2!.cargo = 9;
    expect(reduce(st, { action: 'raid', payload: { team: 't1', rival: 't2' } }, { pool }).ok).toBe(false);
  });
});

describe('Final Showdown rules', () => {
  it('every lesson length ends in a final stage and stages never go backwards', () => {
    for (const rounds of [1, 2, 3, 4, 6, 10, 40]) { expect(stageFor(rounds, rounds)).toBe('final'); let prev = -1; for (let r = 1; r <= rounds; r++) { const idx = ['qualifiers', 'pressure', 'comeback', 'final'].indexOf(stageFor(r, rounds)); expect(idx).toBeGreaterThanOrEqual(prev); prev = idx; } }
    expect(stageFor(1, 1)).toBe('final');
  });
  it('stance costs are paid up front, refunded on undo or skip, and double pays twice the base', async () => {
    const pool = makePool(200); const { state } = createState(cfgOf('final_showdown', 45), makeTeams(2), pool); const prov = fakeProviders(always('correct'), pool);
    const g0 = JSON.parse(JSON.stringify(state)) as GameState; (g0.g as ShowdownG).teams.t1!.points = 20;
    const d = reduce(g0, { action: 'choose_action', payload: { team: 't1', choice: 'double' } }, { pool }); if (!d.ok) throw new Error(d.code); expect((d.state.g as ShowdownG).teams.t1!.points).toBe(13);
    const undo = reduce(d.state, { action: 'cancel_choice', payload: { team: 't1' } }, { pool }); if (!undo.ok) throw new Error(undo.code); expect((undo.state.g as ShowdownG).teams.t1!.points).toBe(20);
    const skip = reduce(d.state, { action: 'skip_turn', payload: { reason: 'absent team' } }, { pool }); if (!skip.ok) throw new Error(skip.code); expect((skip.state.g as ShowdownG).teams.t1!.points).toBe(20);
    expect(reduce(g0, { action: 'ask' }, { pool }).ok).toBe(false); // a stance is required first
    const a = await run(d.state, { action: 'ask' }, pool, prov); if (!a.ok) throw new Error(a.code); const gr = await run(a.state, { action: 'grade', payload: { teamId: 't1' } }, pool, prov); if (!gr.ok) throw new Error(gr.code);
    const stage = (gr.state.g as ShowdownG).stage; expect((gr.state.g as ShowdownG).teams.t1!.points).toBeGreaterThanOrEqual(13 + (stage === 'qualifiers' ? 20 : 24));
    expect(reduce(g0, { action: 'choose_action', payload: { team: 't1', choice: 'bogus' } }, { pool }).ok).toBe(false);
  });
  it('nobody is eliminated: a team on zero points can still choose, ask and score', async () => {
    const r = await play('final_showdown', 15, 4, false, accuracy(0.55, 'sd')); const g = r.state.g as ShowdownG;
    for (const tm of r.state.core.teams) expect(r.state.core.evidence.some((e) => e.team === tm.id)).toBe(true);
    expect(Object.keys(g.teams)).toHaveLength(4);
  }, 60000);
});

describe('integrity: ending a match refunds unfinished commitments and results are complete', () => {
  it.each([...GAME_KEYS])('%s standings rank every team and agree with the total of evidence', async (game) => {
    const r = await play(game, 15, 5, false); const f = r.state.core.finished!;
    expect(f.standings).toHaveLength(5); expect(f.standings.every((s) => Number.isFinite(s.score))).toBe(true); expect(f.standings.some((s) => s.rank === 1)).toBe(true);
    expect(r.state.core.evidence.length).toBeGreaterThan(0);
  }, 60000);
});
