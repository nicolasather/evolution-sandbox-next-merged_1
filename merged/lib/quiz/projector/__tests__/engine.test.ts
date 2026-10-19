import { CAMPAIGNS, CAMPAIGN_IDS, validateCampaign } from '../content/escape-campaigns';
import { planFor, checkPool } from '../scale';
import { GAME_KEYS } from '../types';
import type { GameKey } from '../types';
import { reduce } from '../engine';
import '../games';
import { accuracy, always, cfgOf, createState, makePool, makeTeams, playToEnd, run, fakeProviders } from '../testkit';

const mk = (game: GameKey, minutes: number | null, teams: number, extra = {}, poolN = 220, synchronized = false) => {
  const pool = makePool(poolN);
  const { state } = createState(cfgOf(game, minutes, extra), makeTeams(teams), pool, { synchronized });
  return { state, pool };
};

describe('campaign graphs', () => {
  for (const id of CAMPAIGN_IDS) for (const tier of [1, 2, 3] as const) for (const rooms of [1, 2, 3, 4, 5]) {
    const c = CAMPAIGNS[id]; if (rooms > c.rooms.length) continue;
    it(`${id} rooms=${rooms} tier=${tier} is solvable with no overlaps`, () => {
      const r = validateCampaign(c, rooms, tier);
      expect(r.errors).toEqual([]);
    });
  }
});

describe('determinism and validation', () => {
  it('same seed + same commands gives identical state', async () => {
    const a = mk('empire_race', 15, 3); const b = mk('empire_race', 15, 3);
    const ra = await playToEnd(a.state, a.pool, accuracy(0.7, 'x'));
    const rb = await playToEnd(b.state, b.pool, accuracy(0.7, 'x'));
    expect(JSON.stringify(ra.state)).toEqual(JSON.stringify(rb.state));
  });
  it('rejects unknown actions', () => {
    const { state, pool } = mk('boss_battle', 15, 2);
    const r = reduce(state, { action: 'nope' }, { pool });
    expect(r.ok).toBe(false);
  });
  it('rejects grade when nothing is being asked', () => {
    const { state, pool } = mk('risk_ladder', 15, 2);
    const r = reduce(state, { action: 'grade', payload: { teamId: 't1' } }, { pool });
    expect(r.ok).toBe(false);
  });
  it('finish_now ends the game with an outcome', async () => {
    const { state, pool } = mk('treasure_vault', 15, 2);
    const r = await run(state, { action: 'finish_now' }, pool, fakeProviders(always('correct'), pool));
    expect(r.ok).toBe(true); if (r.ok) expect(r.state.core.phase).toBe('finished');
  });
  it('a verified answer is consumed once (replayed submission is not accepted twice)', async () => {
    const { state, pool } = mk('empire_race', 15, 2);
    const prov = fakeProviders(always('correct'), pool);
    const s1 = await run(state, { action: 'ask' }, pool, prov);
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    if (s1.state.core.phase !== 'asking') return;
    const g1 = await run(s1.state, { action: 'grade', payload: { teamId: s1.state.core.ask!.teamIds[0] } }, pool, prov);
    expect(g1.ok).toBe(true);
    if (!g1.ok) return;
    const again = await run(g1.state, { action: 'grade', payload: { teamId: s1.state.core.ask!.teamIds[0] } }, pool, prov);
    expect(again.ok).toBe(false);
    expect(new Set(g1.state.core.consumed).size).toBe(g1.state.core.consumed.length);
  });
});

describe('finishing at every scale', () => {
  const games = GAME_KEYS as readonly GameKey[];
  for (const game of games) for (const minutes of [10, 15, 45, 90]) for (const teams of [2, 8]) {
    it(`${game} ${minutes}min ${teams} teams finishes`, async () => {
      const plan = planFor(game, minutes, teams, 'balanced', ['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table']);
      const { state, pool } = mk(game, minutes, teams, {}, Math.max(260, plan.questionsNeeded * 3));
      const out = await playToEnd(state, pool, accuracy(0.7, `${game}${minutes}${teams}`), 6000);
      expect(out.state.core.phase).toBe('finished');
      expect(out.state.core.finished).toBeTruthy();
      expect(out.errors.filter((e) => !/:(notYourTurn|noEnergy|cooldown)/.test(e)).length).toBeLessThan(out.steps);
      // the match must not run away: no more asked questions than the plan budget with generous slack
      expect(out.asked).toBeLessThanOrEqual(plan.questionsNeeded * 2 + 10);
    }, 60000);
  }
});

describe('scale and pool checks', () => {
  it('turn budget grows with minutes and is a multiple of team count', () => {
    for (const game of GAME_KEYS as readonly GameKey[]) {
      let prev = 0;
      for (const m of [5, 10, 15, 20, 30, 45, 60, 90, 120, 180]) {
        const p = planFor(game, m, 4, 'balanced', ['multiple_choice']);
        expect(p.turnBudget % 4).toBe(0);
        expect(p.turnBudget).toBeGreaterThanOrEqual(prev); prev = p.turnBudget;
      }
    }
  });
  it('untimed play yields a plan', () => {
    expect(planFor('boss_battle', null, 3, 'game', ['multiple_choice']).turnBudget).toBeGreaterThan(0);
  });
  it('a too-small pool is reported', () => {
    const plan = planFor('escape_room', 90, 4, 'balanced', ['multiple_choice']);
    expect(checkPool(plan, makePool(3), 'balanced').ok).toBe(false);
  });
});

describe('boss battle plausibility', () => {
  it('skilled classes can win, weak ones usually cannot', async () => {
    let strong = 0, weak = 0; const N = 12;
    for (let i = 0; i < N; i++) {
      const a = mk('boss_battle', 30, 4, { seed: `s${i}` }); const ra = await playToEnd(a.state, a.pool, accuracy(0.92, `a${i}`), 6000);
      const b = mk('boss_battle', 30, 4, { seed: `w${i}` }); const rb = await playToEnd(b.state, b.pool, accuracy(0.3, `b${i}`), 6000);
      if (ra.state.core.finished?.outcome === 'victory') strong++;
      if (rb.state.core.finished?.outcome === 'victory') weak++;
    }
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThanOrEqual(N * 0.6);
    expect(weak).toBeLessThanOrEqual(2);
  }, 120000);
});
