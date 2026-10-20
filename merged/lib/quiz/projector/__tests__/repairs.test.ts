/** Part A repairs: question-kind-aware timing, the modifier allow-list run through the reducers, team-name normalisation and secrecy. */
import '../games';
import { moduleFor, reduce } from '../engine';
import { createState } from '../session';
import { run } from '../orchestrate';
import { planFor, poolKinds, secondsPerTurn, checkPool } from '../scale';
import { allowedModifiers, assertProjectorModifiers, modifierRule, WALLET_GAMES } from '../compat';
import { checkTeamNames, normalizeTeamName } from '../team-names';
import { publicView } from '../public-view';
import { cfgOf, makePool, makeTeams, fakeProviders, always } from '../testkit';
import { GAME_KEYS, type GameState, type PoolQuestion, type VerifiedAnswer } from '../types';
import { MODIFIERS } from '../../types';

const kindPool = (spec: [PoolQuestion['kind'], number][]): PoolQuestion[] => {
  const out: PoolQuestion[] = []; for (const [kind, n] of spec) for (let i = 0; i < n; i++) out.push({ position: out.length, id: `q${out.length}`, kind, topic: null, difficulty: 1, difficultySource: 'format', hasExplanation: true, repeatOf: null });
  return out;
};

describe('PATCH A — timing follows the real question kinds', () => {
  it('39 Fill the Table + 1 Multiple Choice is planned as a Fill-the-Table lesson, not as a half-and-half average', () => {
    const pool = kindPool([['fill_table', 39], ['multiple_choice', 1]]);
    const weighted = secondsPerTurn('balanced', poolKinds(pool));
    const distinct = secondsPerTurn('balanced', ['fill_table', 'multiple_choice']);
    expect(weighted).toBe(Math.round((39 * 80 + 40) / 40 + 30 + 15));
    expect(weighted).toBeGreaterThan(distinct);
    // the plan for that quiz holds fewer turns than an all-Multiple-Choice guess would promise
    expect(planFor('boss_battle', 30, 2, 'balanced', poolKinds(pool)).turnBudget).toBeLessThan(planFor('boss_battle', 30, 2, 'balanced', ['multiple_choice']).turnBudget);
  });
  it('labelled repeats never count as extra kinds', () => {
    const pool = kindPool([['multiple_choice', 4]]); pool.push({ ...pool[0]!, position: 4, id: 'r', repeatOf: 0 });
    expect(poolKinds(pool)).toHaveLength(4);
  });
  it('the shorter lesson suggested for a short quiz is computed with the same kinds', () => {
    const pool = kindPool([['connection_rush', 6]]);
    const plan = planFor('treasure_vault', 45, 2, 'balanced', poolKinds(pool));
    const chk = checkPool(plan, pool, 'balanced');
    expect(chk.ok).toBe(false); expect(chk.fitMinutes).not.toBeNull();
    expect(plan.secondsPerTurn).toBe(secondsPerTurn('balanced', ['connection_rush']));
  });
});

describe('PATCH B — modifier allow-list', () => {
  it('the allow-list matches the reducers: exactly the games with a native wallet', () => {
    for (const g of GAME_KEYS) expect(!!moduleFor(g).wallet).toBe(WALLET_GAMES.includes(g));
  });
  it('flow and pressure refine the list, and the server assertion uses the same rules', () => {
    expect(allowedModifiers('auction_house', { flow: 'synchronized' })).toEqual(['secret_wager']);
    expect(allowedModifiers('auction_house', { flow: 'round_robin', lowPressure: true })).toEqual(['steal_question']);
    expect(() => assertProjectorModifiers('auction_house', ['steal_question'], { flow: 'synchronized' })).toThrow(/round robin/);
    expect(() => assertProjectorModifiers('pirate_voyage', ['secret_wager'], { lowPressure: true })).toThrow(/Low pressure/);
    expect(() => assertProjectorModifiers('boss_battle', ['secret_wager'])).toThrow();
    expect(() => assertProjectorModifiers('auction_house', ['secret_wager', 'secret_wager'])).toThrow(/duplicate/);
    expect(assertProjectorModifiers('territory_war', ['secret_wager', 'steal_question'], { flow: 'round_robin' })).toEqual(['secret_wager', 'steal_question']);
    for (const g of GAME_KEYS) for (const m of ['lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points', 'potluck', 'limited_slots'] as const) expect(modifierRule(g, m).allowed).toBe(false);
    expect(MODIFIERS.length).toBe(9);
  });
});

type W = { teams: Record<string, { points: number }> };
const pts = (s: GameState, t: string) => (s.g as W).teams[t]!.points;
function setup(game: 'auction_house' | 'territory_war' | 'lucky_factory' | 'pirate_voyage', mods: ('secret_wager' | 'steal_question')[], synchronized = false) {
  const pool = makePool(60);
  const { state } = createState(cfgOf(game, 30, { mods }), makeTeams(3), pool, { synchronized });
  return { state, pool };
}
const verified = (s: GameState, teamId: string, grade: VerifiedAnswer['grade'], sub: string): VerifiedAnswer => ({ submissionId: sub, teamId, roomQuestionId: s.core.ask!.roomQuestionId, position: s.core.ask!.position, grade, fraction: grade === 'correct' ? 1 : grade === 'partial' ? 0.5 : 0, kind: 'multiple_choice', topic: null, difficulty: 1, teacherOverride: true });

describe('Secret Wager runs through the game wallet', () => {
  for (const game of ['auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage'] as const) {
    it(`${game}: correct wins, wrong loses (capped), partial returns; settled exactly once`, async () => {
      const { state, pool } = setup(game, ['secret_wager']);
      const wallet = moduleFor(game).wallet!;
      const t1 = state.core.teams[0]!.id;
      const start = pts(state, t1);
      const cap = Math.min(wallet.wagerCap, start);
      expect(reduce(state, { action: 'wager', payload: { team: t1, amount: cap + 1 } }, { pool }).ok).toBe(false);
      let s = (reduce(state, { action: 'wager', payload: { team: t1, amount: cap } }, { pool }) as { state: GameState }).state;
      expect(s.core.wagers![t1]).toBe(cap);
      // projector view hides the amount, host view shows it
      expect(publicView(s, 'projector').core.wagers![t1]).toBe(-1); expect(publicView(s, 'host').core.wagers![t1]).toBe(cap);
      const r = await run(s, { action: 'ask', payload: {} }, pool, fakeProviders(always('correct'), pool)); if (!r.ok) throw new Error(r.code); s = r.state;
      expect(reduce(s, { action: 'wager', payload: { team: t1, amount: 1 } }, { pool }).ok).toBe(false); // no stake once the question is out
      const before = pts(s, t1);
      const g1 = reduce(s, { action: 'grade', payload: { teamId: t1 } }, { pool, answer: verified(s, t1, 'wrong', 'sub-w') });
      if (!g1.ok) throw new Error(g1.code);
      expect(pts(g1.state, t1)).toBe(Math.max(0, before - cap)); // lost the stake, never below zero
      expect(g1.state.core.wagers![t1]).toBeUndefined();
      // the same submission cannot be settled again
      expect(reduce(g1.state, { action: 'grade', payload: { teamId: t1 } }, { pool, answer: verified(s, t1, 'wrong', 'sub-w') }).ok).toBe(false);
    });
  }
  it('a correct answer adds the stake on top of the native reward; partial returns it', () => {
    const { state, pool } = setup('auction_house', ['secret_wager']);
    const t1 = state.core.teams[0]!.id;
    const staked = (reduce(state, { action: 'wager', payload: { team: t1, amount: 4 } }, { pool }) as { state: GameState }).state;
    const asked = (reduce(staked, { action: 'ask' }, { pool, question: { position: 0, roomQuestionId: 'rq-0', topic: null, difficulty: null, kind: 'multiple_choice', topicFallback: false, repeat: false } }) as { state: GameState }).state;
    const before = pts(asked, t1);
    const ok = reduce(asked, { action: 'grade', payload: { teamId: t1 } }, { pool, answer: verified(asked, t1, 'correct', 's1') }) as { state: GameState };
    expect(pts(ok.state, t1)).toBe(before + 6 + 4); // EARN.standard + stake
    const part = reduce(asked, { action: 'grade', payload: { teamId: t1 } }, { pool, answer: verified(asked, t1, 'partial', 's2') }) as { state: GameState };
    expect(pts(part.state, t1)).toBe(before + Math.max(1, Math.round(6 * 0.5)));
    expect(part.state.core.log.some((e) => e.k === 'wagerReturned')).toBe(true);
  });
  it('a wager is refused when the modifier is off, for another team’s turn, and voided by a skip', () => {
    const off = setup('auction_house', []);
    expect(reduce(off.state, { action: 'wager', payload: { team: off.state.core.teams[0]!.id, amount: 1 } }, { pool: off.pool })).toMatchObject({ ok: false, code: 'modifierOff' });
    const on = setup('auction_house', ['secret_wager']);
    expect(reduce(on.state, { action: 'wager', payload: { team: on.state.core.teams[1]!.id, amount: 1 } }, { pool: on.pool })).toMatchObject({ ok: false, code: 'notYourTurn' });
    const t1 = on.state.core.teams[0]!.id;
    const w = (reduce(on.state, { action: 'wager', payload: { team: t1, amount: 3 } }, { pool: on.pool }) as { state: GameState }).state;
    const skipped = (reduce(w, { action: 'skip_turn', payload: { reason: 'absent' } }, { pool: on.pool }) as { state: GameState }).state;
    expect(skipped.core.wagers![t1]).toBeUndefined(); expect(pts(skipped, t1)).toBe(pts(w, t1));
  });
  it('a non-wallet game never runs a wager even if the state were forged', () => {
    const pool = makePool(40); const { state } = createState(cfgOf('boss_battle', 30, { mods: ['secret_wager'] }), makeTeams(2), pool);
    expect(reduce(state, { action: 'wager', payload: { team: 't1', amount: 1 } }, { pool })).toMatchObject({ ok: false, code: 'modifierOff' });
  });
});

describe('Steal the Question runs through the game wallet', () => {
  it('opens after a verified wrong answer, credits a correct steal once, closes on reveal or pass', async () => {
    const { state, pool } = setup('territory_war', ['steal_question']);
    const [t1, t2] = [state.core.teams[0]!.id, state.core.teams[1]!.id];
    let s = state;
    const r = await run(s, { action: 'ask' }, pool, fakeProviders(always('wrong'), pool)); if (!r.ok) throw new Error(r.code); s = r.state;
    const g = await run(s, { action: 'grade', payload: { teamId: t1 } }, pool, fakeProviders(always('wrong'), pool)); if (!g.ok) throw new Error(g.code); s = g.state;
    expect(s.core.rebound).toMatchObject({ from: t1, used: false });
    expect(reduce(s, { action: 'rebound', payload: { team: t1 } }, { pool })).toMatchObject({ ok: false, code: 'reboundSameTeam' });
    const need = reduce(s, { action: 'rebound', payload: { team: t2 } }, { pool });
    expect(need.ok && need.need).toEqual({ type: 'rebound', teamId: t2 });
    const before = pts(s, t2);
    const ans: VerifiedAnswer = { submissionId: 'steal-1', teamId: t2, roomQuestionId: s.core.rebound!.roomQuestionId, position: s.core.rebound!.position, grade: 'correct', fraction: 1, kind: 'multiple_choice', topic: null, difficulty: 1, teacherOverride: true };
    const done = reduce(s, { action: 'rebound', payload: { team: t2 } }, { pool, answer: ans }) as { ok: true; state: GameState };
    expect(pts(done.state, t2)).toBe(before + moduleFor('territory_war').wallet!.earn(1));
    expect(done.state.core.rebound!.used).toBe(true);
    expect(reduce(done.state, { action: 'rebound', payload: { team: state.core.teams[2]!.id } }, { pool })).toMatchObject({ ok: false, code: 'noRebound' });
    // reveal closes an unused steal; a pass closes it too
    const revealed = reduce(s, { action: 'reveal' }, { pool, revealed: true }) as { state: GameState };
    expect(revealed.state.core.rebound).toBeNull();
    const passed = reduce(s, { action: 'rebound_pass' }, { pool }) as { state: GameState };
    expect(passed.state.core.rebound).toBeNull();
  });
  it('never opens in synchronized play (every team already answered)', async () => {
    const { state } = setup('pirate_voyage', ['steal_question'], true);
    expect(state.core.mods!.rebound).toBe(false);
  });
  it('end of turn clears any open steal', async () => {
    const { state, pool } = setup('lucky_factory', ['steal_question']);
    let s = state; const t1 = s.core.teams[0]!.id;
    const r = await run(s, { action: 'ask' }, pool, fakeProviders(always('wrong'), pool)); if (!r.ok) throw new Error(r.code); s = r.state;
    const g = await run(s, { action: 'grade', payload: { teamId: t1 } }, pool, fakeProviders(always('wrong'), pool)); if (!g.ok) throw new Error(g.code); s = g.state;
    expect(s.core.rebound).not.toBeNull();
    const e = reduce(s, { action: 'end_turn' }, { pool }); if (!e.ok) throw new Error(e.code);
    expect(e.state.core.rebound).toBeNull();
  });
  it('sessions stored before modifiers existed still load and play (mods absent = off)', async () => {
    const { state, pool } = setup('auction_house', []);
    const legacy = JSON.parse(JSON.stringify(state)) as GameState; delete legacy.core.mods; delete legacy.core.wagers; delete legacy.core.rebound;
    const r = await run(legacy, { action: 'ask' }, pool, fakeProviders(always('wrong'), pool));
    expect(r.ok).toBe(true);
    expect(reduce(legacy, { action: 'wager', payload: { team: 't1', amount: 1 } }, { pool })).toMatchObject({ ok: false, code: 'modifierOff' });
  });
});

describe('team names', () => {
  it('normalises case, spacing and Unicode width before comparing', () => {
    expect(normalizeTeamName('  Red   Fox ')).toBe('Red Fox');
    const c = checkTeamNames(['Red', ' red ', 'ＲＥＤ', '', 'Blue']);
    expect(c.ok).toBe(false);
    expect(c.errors).toEqual([null, 'Team 2 has the same name as team 1.', 'Team 3 has the same name as team 1.', 'Team 4 needs a name.', null]);
    expect(checkTeamNames(['Team 1', 'Team 2']).ok).toBe(true);
  });
});

describe('PATCH D — projector projection secrecy (pure layer)', () => {
  it('the public view never carries the seed, consumed ids or evidence', () => {
    for (const g of GAME_KEYS) {
      const pool = makePool(60);
      const { state } = createState(cfgOf(g, 30, { seed: 'SECRET_SEED_7E09' }), makeTeams(3), pool);
      const pub = JSON.stringify(publicView(state, 'projector'));
      expect(pub).not.toContain('SECRET_SEED_7E09');
    }
  });
});
