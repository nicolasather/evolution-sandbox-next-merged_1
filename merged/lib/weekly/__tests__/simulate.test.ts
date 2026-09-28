import {
  completeGauntlet, completeSudoku, completeTrace, isWeekComplete, startProgress,
} from '@/lib/weekly/simulate';

describe('weekly progression', () => {
  it('starts at stage 0, nothing complete', () => {
    const p = startProgress('2026-W10');
    expect(p.completedStages).toBe(0);
    expect(isWeekComplete(p)).toBe(false);
    expect(p.finishedAt).toBeNull();
  });

  it('advances trace → sudoku → gauntlet in order, recording each result', () => {
    let p = startProgress('2026-W10');
    p = completeTrace(p, 6);
    expect(p.completedStages).toBe(1);
    expect(p.stageResults.trace).toEqual({ clicks: 6 });

    p = completeSudoku(p, 2);
    expect(p.completedStages).toBe(2);
    expect(p.stageResults.sudoku).toEqual({ checks: 2 });

    p = completeGauntlet(p, 3, 1_700_000_000_000);
    expect(p.completedStages).toBe(3);
    expect(p.stageResults.gauntlet).toEqual({ correct: 3 });
    expect(p.finishedAt).toBe(1_700_000_000_000);
    expect(isWeekComplete(p)).toBe(true);
  });

  it('completing a stage out of order is a no-op', () => {
    const fresh = startProgress('2026-W10');
    expect(completeSudoku(fresh, 1)).toEqual(fresh); // trace not done yet
    expect(completeGauntlet(fresh, 1, 1)).toEqual(fresh); // neither trace nor sudoku done

    const afterTrace = completeTrace(fresh, 4);
    expect(completeGauntlet(afterTrace, 1, 1)).toEqual(afterTrace); // sudoku not done yet
  });

  it('completing an already-completed stage again is a no-op, never double-advances', () => {
    let p = startProgress('2026-W10');
    p = completeTrace(p, 5);
    const again = completeTrace(p, 999);
    expect(again).toEqual(p); // unchanged — still records the first completion's clicks
  });
});
