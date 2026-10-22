/** Match planner: how many (question → planning → live episode) cycles fit the teacher's time, from the quiz's REAL question inventory. Never invents questions. */
import type { QuestionKind } from '../types';
import { barrierSecondsFor } from '../os/plan';
import { COUNTDOWN_SECONDS, DURATION_MINUTES, EPISODE_SECONDS, PLANNING_SECONDS, RESULT_SECONDS, REVEAL_SECONDS, ROTATION_SECONDS } from './balance';
import type { PlanRec, PoolEntry } from './domain';

export const MIN_CYCLES = 3;
export type ArenaPlan = PlanRec & { questionsAvailable: number; reviewCycle: boolean; notes: string[]; estimatedMinutes: number; wanted: number; quizShare: number };
export const snapMinutes = (m: number) => (DURATION_MINUTES as readonly number[]).reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best), 10);
export const cycleSeconds = (questionSeconds: number, episodeSeconds: number) => questionSeconds + REVEAL_SECONDS + PLANNING_SECONDS + episodeSeconds + RESULT_SECONDS;

export function planMatch(cfg: { durationMinutes: number; readAloud: boolean; lowPressure: boolean; allowReviewCycle: boolean }, kinds: readonly QuestionKind[]): ArenaPlan {
  const minutes = snapMinutes(cfg.durationMinutes); const total = minutes * 60; const episodeSeconds = EPISODE_SECONDS[minutes] ?? 70; const notes: string[] = [];
  const secs = (k: string) => barrierSecondsFor(k, cfg.readAloud, cfg.lowPressure);
  const avg = kinds.length ? kinds.reduce((n, k) => n + secs(k), 0) / kinds.length : 40;
  const wanted = Math.max(1, Math.floor((total - 45) / cycleSeconds(avg, episodeSeconds)));
  let cycles = 0; let used = 45; // 45 s of lobby slack and the final podium
  const order = [...kinds]; let reviewCycle = false;
  if (order.length < wanted && cfg.allowReviewCycle && order.length >= 3) { reviewCycle = true; notes.push('reviewCycle'); while (order.length < wanted) order.push(kinds[order.length % kinds.length]!); }
  for (const k of order) { const c = cycleSeconds(secs(k), episodeSeconds); if (used + c > total + 20) break; used += c; cycles++; }
  if (cycles < wanted && !reviewCycle) notes.push('shortQuiz');
  if (cycles < MIN_CYCLES) notes.push('belowMinimum');
  const qSeconds = order.slice(0, cycles).reduce((n, k) => n + secs(k) + REVEAL_SECONDS, 0);
  return {
    cycles, episodeSeconds, planningSeconds: PLANNING_SECONDS, revealSeconds: REVEAL_SECONDS, resultSeconds: RESULT_SECONDS, countdownSeconds: COUNTDOWN_SECONDS, positions: [], minutes,
    rotationSeconds: ROTATION_SECONDS, questionsAvailable: kinds.length, reviewCycle, notes, estimatedMinutes: Math.round((used / 60) * 10) / 10, wanted, quizShare: used ? Math.round((qSeconds / used) * 100) / 100 : 0,
  };
}
/** One distinct question per cycle, in the quiz's own order (repeats of a consented review cycle come last). */
export function pickPositions(pool: readonly PoolEntry[], cycles: number): number[] {
  const firsts = pool.filter((p) => !p.repeat).sort((a, b) => a.position - b.position); const repeats = pool.filter((p) => p.repeat).sort((a, b) => a.position - b.position);
  return [...firsts, ...repeats].slice(0, cycles).map((p) => p.position);
}
