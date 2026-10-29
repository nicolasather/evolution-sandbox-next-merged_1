import { CLASS_WIDE_REASON, OVERRIDE_START, adjustedScore, applyOverride, isValidDelta, undoOverride } from '../score-override';
import { avgSpeedMs, focusPct, isTrapFlag, jitterPx, strikeFor, visibleOnProjector, MODERATION_START } from '../anti-cheat';
import { wagerForTier, wagerMath, pulsePeriodMs } from '../../../components/quiz/WagerStreakArena';

describe('score override', () => {
  const entry = (id: string, studentIds: string[], delta: number) => ({ id, studentIds, delta, reason: 'Teamwork', at: 0 });

  it('accepts only whole, non-zero amounts within the cap', () => {
    expect(isValidDelta(250)).toBe(true);
    expect(isValidDelta(-50)).toBe(true);
    expect(isValidDelta(0)).toBe(false);
    expect(isValidDelta(1.5)).toBe(false);
    expect(isValidDelta(10_001)).toBe(false);
  });

  it('applies a bonus and logs it, newest first', () => {
    const s1 = applyOverride(OVERRIDE_START, entry('a', ['s1'], 250));
    const s2 = applyOverride(s1, entry('b', ['s1', 's2'], -100));
    expect(s2.adjust).toEqual({ s1: 150, s2: -100 });
    expect(s2.log.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('ignores invalid entries', () => {
    expect(applyOverride(OVERRIDE_START, entry('x', ['s1'], 0))).toBe(OVERRIDE_START);
    expect(applyOverride(OVERRIDE_START, entry('x', [], 50))).toBe(OVERRIDE_START);
  });

  it('undo reverses an entry once and marks it', () => {
    const s1 = applyOverride(OVERRIDE_START, entry('a', ['s1'], 250));
    const s2 = undoOverride(s1, 'a');
    expect(s2.adjust.s1).toBe(0);
    expect(s2.log[0]!.undone).toBe(true);
    expect(undoOverride(s2, 'a')).toBe(s2);
  });

  it('class-wide bonus touches every student and keeps its own reason', () => {
    const s = applyOverride(OVERRIDE_START, { id: 'c', studentIds: ['s1', 's2', 's3'], delta: 50, reason: CLASS_WIDE_REASON, at: 0 });
    expect(adjustedScore(100, s, 's2')).toBe(150);
    expect(s.log[0]!.reason).toBe(CLASS_WIDE_REASON);
  });
});

describe('anti-cheat rules', () => {
  it('maps tab-switch strikes to the spec labels', () => {
    expect(strikeFor(0).label).toBe('');
    expect(strikeFor(1).label).toBe('Strike 1/3');
    expect(strikeFor(2)).toMatchObject({ wagerLocked: true, roundZeroed: false });
    expect(strikeFor(3)).toMatchObject({ wagerLocked: true, roundZeroed: true, label: 'Strike 3/3 · Round Zeroed' });
  });

  it('flags only fast honeypot clicks', () => {
    expect(isTrapFlag(300)).toBe(true);
    expect(isTrapFlag(1200)).toBe(false);
    expect(isTrapFlag(-5)).toBe(false);
  });

  it('computes focus and average speed', () => {
    const t = { focusMs: 750, totalMs: 1000, tabSwitches: 1, answerTimesMs: [2000, 4000], trap: 'untested' as const };
    expect(focusPct(t)).toBe(75);
    expect(avgSpeedMs(t)).toBe(3000);
    expect(avgSpeedMs({ ...t, answerTimesMs: [] })).toBeNull();
  });

  it('keeps shadow-muted and kicked players off the projector list', () => {
    const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const mod = { b: { ...MODERATION_START, shadowMuted: true }, c: { ...MODERATION_START, kicked: true } };
    expect(visibleOnProjector(players, mod)).toEqual([{ id: 'a' }]);
  });

  it('keeps jitter within ±1.2px', () => {
    for (const r of [0, 0.25, 0.5, 0.999]) {
      const j = jitterPx(() => r);
      expect(Math.abs(j)).toBeLessThanOrEqual(1.2);
    }
  });
});

describe('wager preview', () => {
  it('matches the server arithmetic: base + wager on a right answer, minus wager on a wrong one', () => {
    expect(wagerMath(300, 2)).toEqual({ wager: 300, win: 600, loss: -300 });
    expect(wagerMath(300, 1)).toEqual({ wager: 0, win: 300, loss: 0 });
    expect(wagerForTier(300, 3)).toBe(600);
    expect(wagerForTier(300, 1.5)).toBe(150);
  });

  it('pulses faster at higher risk', () => {
    expect(pulsePeriodMs(1)).toBeGreaterThan(pulsePeriodMs(3));
  });
});
