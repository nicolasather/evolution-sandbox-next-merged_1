/** @jest-environment node */
import { applyResult, initGame, progress, rand, replay, summary, type EngineConfig, type Result } from '../games/engine';
import { defaultGameOptions } from '../settings';

const cfg = (mode: EngineConfig['mode'], total = 10, o = {}): EngineConfig => ({ mode, options: { ...defaultGameOptions(), ...o }, seed: 'seed-1', totalQuestions: total });
const R = (s: string): Result[] => [...s].map((c) => ({ correct: c === 'y', timedOut: c === 't' }));

describe('determinism', () => {
  it('seeded rand is stable and varies per step', () => {
    expect(rand('a', 3)).toBe(rand('a', 3));
    expect(rand('a', 3)).not.toBe(rand('a', 4));
    expect(rand('a', 3)).not.toBe(rand('b', 3));
  });
  it.each(['tower_defense', 'obstacle_survival', 'clue_racing'] as const)('%s: same log, same state', (m) => {
    const c = cfg(m, 12); const log = R('yynyyytyyyny');
    expect(replay(c, log)).toEqual(replay(c, log));
  });
  it('replaying a prefix equals stepping to that point', () => {
    const c = cfg('obstacle_survival', 12); const log = R('yynyy');
    const stepped = log.reduce((s, r) => applyResult(s, r, c), initGame(c));
    expect(replay(c, log)).toEqual(stepped);
  });
});

describe('Tower Defense', () => {
  it('builds a tower on every correct answer, then upgrades after 8', () => {
    const s: any = replay(cfg('tower_defense', 20, { lives: 9 }), R('y'.repeat(9)));
    expect(s.towers).toBe(8); expect(s.upgrades).toBe(1); expect(s.defeated).toBe(9); expect(s.lives).toBe(9);
  });
  it('a miss costs health and a timeout counts as a miss', () => {
    const a: any = replay(cfg('tower_defense', 10, { lives: 5 }), R('n'));
    const b: any = replay(cfg('tower_defense', 10, { lives: 5 }), R('t'));
    expect(a.lives).toBeLessThan(5); expect(b.lives).toBe(a.lives); expect(a.leaked).toBe(1);
  });
  it('towers absorb damage: the same miss hurts less after building defence', () => {
    const bare: any = replay(cfg('tower_defense', 30, { lives: 9 }), R('n'));
    const built: any = replay(cfg('tower_defense', 30, { lives: 9 }), R('yyyyyyyyn'));
    expect(9 - built.lives).toBeLessThanOrEqual(9 - bare.lives);
  });
  it('is lost at zero health and then ignores further answers; won after the last wave', () => {
    const lost: any = replay(cfg('tower_defense', 30, { lives: 1 }), R('nyyy'));
    expect(lost.outcome).toBe('lost'); expect(lost.defeated).toBe(0);
    const won: any = replay(cfg('tower_defense', 3, { lives: 9 }), R('yyy'));
    expect(won.outcome).toBe('won');
  });
});

describe('Obstacle Survival', () => {
  it('clears build a streak and speed; a hit resets them', () => {
    const s: any = replay(cfg('obstacle_survival', 20), R('yyyyy'));
    expect(s.cleared).toBe(5); expect(s.streak).toBe(5); expect(s.speed).toBeGreaterThan(1); expect(s.distance).toBe(5);
    const h: any = replay(cfg('obstacle_survival', 20), R('yyyn'));
    expect(h.streak).toBe(0); expect(h.speed).toBe(1); expect(h.hits).toBe(1); expect(h.best).toBe(3);
  });
  it('knocked out at zero hit points, survives to the finish otherwise', () => {
    const out: any = replay(cfg('obstacle_survival', 30, { lives: 1 }), R('n'));
    expect(out.outcome).toBe('lost'); expect(out.hp).toBe(0);
    const ok: any = replay(cfg('obstacle_survival', 4, { lives: 9 }), R('yyyy'));
    expect(ok.outcome).toBe('won');
  });
});

describe('Clue Racing', () => {
  it('each correct answer advances and reveals a tile; every third in a row boosts', () => {
    const s: any = replay(cfg('clue_racing', 20, { trackLength: 10 }), R('yyy'));
    expect(s.position).toBe(4); expect(s.revealed).toEqual([0, 1, 2, 3]);
  });
  it('a miss stalls and breaks the streak', () => {
    const s: any = replay(cfg('clue_racing', 20, { trackLength: 10 }), R('yyny'));
    expect(s.position).toBe(3); expect(s.stalls).toBe(1); expect(s.streak).toBe(1);
  });
  it('track is never longer than the number of questions, and crossing the line records when', () => {
    const c = cfg('clue_racing', 3, { trackLength: 30 });
    expect((initGame(c) as any).trackLength).toBe(3);
    const s: any = replay(c, R('yyy'));
    expect(s.outcome).toBe('won'); expect(s.finishedAt).not.toBeNull();
  });
  it('ranks a faster finisher above a slower one', () => {
    const c = cfg('clue_racing', 20, { trackLength: 10 });
    expect(progress(replay(c, R('yyyyy')))).toBeGreaterThan(progress(replay(c, R('ynyny'))));
    expect(summary(replay(c, R('yy')))).toContain('Checkpoint 2/10');
  });
});
