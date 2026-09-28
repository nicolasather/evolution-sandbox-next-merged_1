import { weeklyStore } from '@/lib/weekly/store';
import { completeGauntlet, completeSudoku, completeTrace, startProgress } from '@/lib/weekly/simulate';

describe('weekly store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    weeklyStore.reset();
  });

  it('starts with no current progress and no history', () => {
    expect(weeklyStore.get().current).toBeNull();
    expect(weeklyStore.get().history).toEqual([]);
  });

  it('setProgress persists the in-progress week for resume', () => {
    weeklyStore.setProgress(completeTrace(startProgress('2026-W12'), 5));
    expect(weeklyStore.get().current?.week).toBe('2026-W12');
    expect(weeklyStore.get().current?.completedStages).toBe(1);
  });

  it('reloads across a simulated reload (mid-week persistence)', () => {
    weeklyStore.setProgress(completeTrace(startProgress('2026-W12'), 5));
    weeklyStore.load();
    expect(weeklyStore.get().current?.completedStages).toBe(1);
    expect(weeklyStore.get().current?.stageResults.trace).toEqual({ clicks: 5 });
  });

  it('archiveIfComplete is a no-op until all three stages are done', () => {
    let p = startProgress('2026-W12');
    p = completeTrace(p, 5);
    weeklyStore.setProgress(p);
    weeklyStore.archiveIfComplete('long-road');
    expect(weeklyStore.get().history).toEqual([]);

    p = completeSudoku(p, 1);
    weeklyStore.setProgress(p);
    weeklyStore.archiveIfComplete('long-road');
    expect(weeklyStore.get().history).toEqual([]);
  });

  it('archiveIfComplete files the week once finished, and never duplicates it on a second call', () => {
    let p = startProgress('2026-W12');
    p = completeTrace(p, 5);
    p = completeSudoku(p, 1);
    p = completeGauntlet(p, 3, 1_700_000_000_000);
    weeklyStore.setProgress(p);

    weeklyStore.archiveIfComplete('long-road');
    weeklyStore.archiveIfComplete('long-road'); // stray second call — must not duplicate
    expect(weeklyStore.get().history).toHaveLength(1);
    expect(weeklyStore.get().history[0]).toEqual({ week: '2026-W12', scenarioId: 'long-road', finishedAt: 1_700_000_000_000 });
  });

  it('reset clears both current progress and history', () => {
    let p = startProgress('2026-W12');
    p = completeTrace(p, 5);
    p = completeSudoku(p, 1);
    p = completeGauntlet(p, 3, 1);
    weeklyStore.setProgress(p);
    weeklyStore.archiveIfComplete('long-road');

    weeklyStore.reset();
    expect(weeklyStore.get().current).toBeNull();
    expect(weeklyStore.get().history).toEqual([]);
  });
});
