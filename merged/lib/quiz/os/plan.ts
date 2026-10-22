/** Match planner: turns the host's target length and the quiz's REAL question inventory into chapters (traverse → question → reveal → choice → count-in).
 *  It is a target, not a promise: the teacher sees these numbers before launch. */
import type { QuestionKind } from '../types';
export const READ_SECONDS: Record<string, number> = {
  multiple_choice: 15,
  answer_forge: 20,
  connection_rush: 18,
  truth_hunt: 12,
  fill_table: 25,
};
import { CHAPTERS_FOR, DURATION_MINUTES, TICK_MS } from './balance';
import type { CourseIndex } from './course';
import type { OSConfig, PlanRec, PoolEntry } from './domain';

export const MIN_CHAPTERS = 3;
export type OSPlan = PlanRec & { questionsNeeded: number; questionsAvailable: number; reviewCycle: boolean; notes: string[]; estimatedMinutes: number };
export const snapMinutes = (m: number) => (DURATION_MINUTES as readonly number[]).reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best), 10);

/** Seconds to read and answer one question of this kind (never counted as running-world time). */
export const barrierSecondsFor = (kind: string, readAloud: boolean, lowPressure: boolean) => {
  const base = (READ_SECONDS as Record<string, number>)[kind] ?? READ_SECONDS.multiple_choice;
  return Math.max(28, Math.min(100, Math.round(base * (lowPressure ? 1.25 : 1)) + (readAloud ? 10 : 0)));
};
export function planMatch(cfg: Pick<OSConfig, 'durationMinutes' | 'readAloud' | 'lowPressure' | 'allowReviewCycle'>, kinds: readonly QuestionKind[], idx: CourseIndex): OSPlan {
  const minutes = snapMinutes(cfg.durationMinutes); const wanted = CHAPTERS_FOR[minutes]; const available = kinds.length; const notes: string[] = [];
  let chapters = wanted; let reviewCycle = false;
  if (available < wanted) {
    if (cfg.allowReviewCycle && available * 2 >= wanted) { reviewCycle = true; notes.push('reviewCycle'); }
    else { chapters = Math.max(1, available); notes.push('shortQuiz'); }
  }
  if (chapters < MIN_CHAPTERS) notes.push('belowMinimum');
  const total = idx.totalDist;
  const perChapter = total / chapters;
  // enough time for the slowest role to cover its slice plus a little hazard waiting; more chapters ⇒ shorter slices
  const chapterTicks = Math.max(140, Math.min(320, Math.ceil(perChapter * 13 + 90)));
  const limitDist = Array.from({ length: chapters }, (_, k) => (k === chapters - 1 ? Number.MAX_SAFE_INTEGER : Math.round((total * (k + 1)) / chapters)));
  const avgRead = kinds.length ? kinds.reduce((n, k) => n + barrierSecondsFor(k, cfg.readAloud, cfg.lowPressure), 0) / kinds.length : 40;
  const revealSeconds = cfg.lowPressure || cfg.readAloud ? 10 : 7, buildSeconds = minutes <= 10 ? 20 : minutes <= 20 ? 24 : 30, countdownSeconds = 3, previewSeconds = 15;
  const per = (chapterTicks * TICK_MS) / 1000 + avgRead + revealSeconds + buildSeconds + countdownSeconds;
  return {
    chapters, chapterTicks, limitDist, totalDist: total, readSeconds: Math.round(avgRead), barrierSeconds: Math.round(avgRead), revealSeconds, buildSeconds, countdownSeconds, previewSeconds,
    positions: [], minutes, questionsNeeded: wanted, questionsAvailable: available, reviewCycle, notes, estimatedMinutes: Math.round(((chapters * per + previewSeconds + 30) / 60) * 10) / 10,
  };
}
/** One distinct question per chapter, in the quiz's own order (repeats of a review cycle come last). */
export function pickPositions(pool: readonly PoolEntry[], chapters: number): number[] {
  const firsts = pool.filter((p) => !p.repeat).sort((a, b) => a.position - b.position); const repeats = pool.filter((p) => p.repeat).sort((a, b) => a.position - b.position);
  return [...firsts, ...repeats].slice(0, chapters).map((p) => p.position);
}
