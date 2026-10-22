/** Match planner: turns the host's target length and the quiz's REAL question inventory into question windows and legs. A forecast, never a promise; it never invents questions. */
import type { QuestionKind } from '../types';
import { CHECKPOINT_SECONDS, COUNTDOWN_SECONDS, DURATION_MINUTES, MIN_WINDOWS, WINDOWS_FOR } from './balance';
import type { PlanRec, PoolEntry } from './domain';
import { stationPlan } from './maps';

export const BASE_SECONDS: Record<QuestionKind, number> = { multiple_choice: 40, truth_hunt: 35, answer_forge: 50, connection_rush: 65, fill_table: 80 };
/** Seconds one question window lasts (reading + answering). One function for the preflight AND the live server. */
export const questionSeconds = (kind: string, lowPressure: boolean, readAloud: boolean) => Math.max(28, Math.min(120, Math.round((BASE_SECONDS[kind as QuestionKind] ?? 40) * (lowPressure ? 1.25 : 1)) + (readAloud ? 10 : 0)));
export const snapMinutes = (m: number) => (DURATION_MINUTES as readonly number[]).reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best), 10);
export type CRPlan = PlanRec & { questionsAvailable: number; reviewCycle: boolean; notes: string[]; estimatedMinutes: number; wanted: number; quizShare: number };
const REVEAL = (low: boolean) => (low ? 12 : 8); const DECIDE = (low: boolean, split: boolean) => (low ? 22 : split ? 16 : 12);
/** Walking the whole course once takes ~150 s on every map at the shared speed; the planner reserves a margin on top so every team can finish every leg without hurrying. */
export const WALK_RESERVE_SECONDS = 200; export const LEG_EXPECTED_EXTRA = 4;
export const legCapSeconds = (legs: number) => Math.max(20, Math.min(150, Math.ceil((Math.ceil(27 / Math.max(1, legs)) * 800) / 140 * 1.7) + 10));
export function planMatch(cfg: { durationMinutes: number; readAloud: boolean; lowPressure: boolean; allowReviewCycle: boolean; format?: string }, kinds: readonly QuestionKind[]): CRPlan {
  const minutes = snapMinutes(cfg.durationMinutes); const total = minutes * 60; const notes: string[] = []; const wanted = WINDOWS_FOR[minutes]!;
  const order = [...kinds]; let reviewCycle = false;
  if (order.length < wanted && cfg.allowReviewCycle && order.length >= MIN_WINDOWS && order.length * 2 >= wanted) { reviewCycle = true; notes.push('reviewCycle'); while (order.length < wanted) order.push(kinds[order.length % kinds.length]!); }
  const split = cfg.format === 'split_route'; const rev = REVEAL(cfg.lowPressure); const dec = DECIDE(cfg.lowPressure, split);
  const fixed = COUNTDOWN_SECONDS + 20 + WALK_RESERVE_SECONDS * (cfg.lowPressure ? 1.15 : 1);
  let windows = Math.min(wanted, order.length);
  const cost = (w: number) => order.slice(0, w).reduce((n, k) => n + questionSeconds(k, cfg.lowPressure, cfg.readAloud) + rev + dec + CHECKPOINT_SECONDS, 0) + (w + 1) * LEG_EXPECTED_EXTRA;
  while (windows > 0 && fixed + cost(windows) > total + 20) windows--;
  if (windows < Math.min(wanted, order.length) && !notes.includes('timeLimited')) notes.push('timeLimited');
  if (order.length < wanted && !reviewCycle) notes.push('shortQuiz');
  if (windows < MIN_WINDOWS) notes.push('belowMinimum');
  const legs = windows + 1; const used = fixed + cost(windows); const legSeconds = legCapSeconds(legs) * (cfg.lowPressure ? 1.25 : 1);
  const qTime = order.slice(0, windows).reduce((n, k) => n + questionSeconds(k, cfg.lowPressure, cfg.readAloud) + rev, 0);
  return { windows, legs, legSeconds: Math.round(legSeconds), revealSeconds: rev, decisionSeconds: dec, countdownSeconds: COUNTDOWN_SECONDS, checkpointSeconds: CHECKPOINT_SECONDS, minutes, stations: stationPlan(windows), positions: [],
    questionsAvailable: kinds.length, reviewCycle, notes, estimatedMinutes: Math.round((used / 60) * 10) / 10, wanted, quizShare: used ? Math.round((qTime / used) * 100) / 100 : 0 };
}
export function pickPositions(pool: readonly PoolEntry[], windows: number): number[] {
  const firsts = pool.filter((p) => !p.repeat).sort((a, b) => a.position - b.position); const repeats = pool.filter((p) => p.repeat).sort((a, b) => a.position - b.position);
  return [...firsts, ...repeats].slice(0, windows).map((p) => p.position);
}
