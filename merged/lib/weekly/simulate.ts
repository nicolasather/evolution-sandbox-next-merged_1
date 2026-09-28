import type { WeeklyProgress } from './types';

/* ============================================================================
   WEEKLY MEGA CHALLENGE — PROGRESSION. Three pure, order-guarded reducers —
   a stage can only ever be completed when it is exactly the next one, so
   "multi-stage" is a real sequencing constraint, not just three unrelated
   panels in one modal. Each is a no-op (returns the input unchanged) if
   called out of order, so a stray or replayed call can never corrupt
   progress or award a stage twice.
   ========================================================================== */

export function startProgress(week: string): WeeklyProgress {
  return { week, completedStages: 0, stageResults: {}, finishedAt: null };
}

export function completeTrace(progress: WeeklyProgress, clicks: number): WeeklyProgress {
  if (progress.completedStages !== 0) return progress;
  return { ...progress, completedStages: 1, stageResults: { ...progress.stageResults, trace: { clicks } } };
}

export function completeSudoku(progress: WeeklyProgress, checks: number): WeeklyProgress {
  if (progress.completedStages !== 1) return progress;
  return { ...progress, completedStages: 2, stageResults: { ...progress.stageResults, sudoku: { checks } } };
}

export function completeGauntlet(progress: WeeklyProgress, correct: number, now: number): WeeklyProgress {
  if (progress.completedStages !== 2) return progress;
  return { ...progress, completedStages: 3, stageResults: { ...progress.stageResults, gauntlet: { correct } }, finishedAt: now };
}

export const isWeekComplete = (progress: WeeklyProgress): boolean => progress.completedStages >= 3;
