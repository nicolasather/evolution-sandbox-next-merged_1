/** Session planner: turns a target length, a focus and the REAL question kinds of the quiz into a number of rounds (question → build → wave),
 *  the boss checkpoints and every phase length. It is a target, not a promise (the teacher sees the numbers before launch). */
import type { QuestionKind } from '../types';
import { READ_SECONDS } from './balance';
import type { TDConfig, TDFocus, TDPlan } from './domain';

const FOCUS_READ: Record<TDFocus, number> = { study: 1.2, balanced: 1, game: 0.85 };
const REVEAL: Record<TDFocus, number> = { study: 12, balanced: 7, game: 4 };
const AVG_WAVE = 30, AVG_BOSS_WAVE = 48, RESULT = 4, TRANSITIONS = 2, SETUP_AND_RESULTS = 75;

export function waveBand(minutes: number): [number, number] {
  return minutes <= 10 ? [4, 5] : minutes <= 20 ? [5, 8] : minutes <= 30 ? [8, 13] : [11, 18];
}
export function buildSecondsFor(minutes: number, independent: boolean): number {
  const b = minutes <= 10 ? 20 : minutes <= 15 ? 24 : minutes <= 20 ? 26 : minutes <= 30 ? 30 : 34;
  return independent ? b + 20 : b;
}
/** Weighted by how often each kind occurs (one entry per question). */
export function questionSecondsFor(kinds: readonly QuestionKind[], focus: TDFocus, readAloud: boolean): number {
  const avg = kinds.length ? kinds.reduce((n, k) => n + READ_SECONDS[k], 0) / kinds.length : READ_SECONDS.multiple_choice;
  return Math.max(30, Math.min(100, Math.round(avg * FOCUS_READ[focus] + (readAloud ? 10 : 0))));
}

export function bossSchedule(minutes: number, waves: number): { boss: number[]; mini: number[] } {
  if (minutes <= 10) return { boss: [], mini: [waves] };
  if (minutes <= 20) return { boss: [waves], mini: [] };
  if (minutes <= 30) return { boss: [Math.ceil(waves / 2), waves], mini: [] };
  return { boss: [Math.round(waves / 3), Math.round((2 * waves) / 3), waves], mini: [] };
}

export function planMatch(cfg: Pick<TDConfig, 'durationMinutes' | 'focus' | 'readAloud' | 'questionFlow' | 'allowReviewCycle'>, kinds: readonly QuestionKind[], available: number): TDPlan {
  const minutes = Math.max(10, Math.min(45, Math.round(cfg.durationMinutes)));
  const independent = cfg.questionFlow === 'independent';
  const q = questionSecondsFor(kinds, cfg.focus, cfg.readAloud);
  const reveal = REVEAL[cfg.focus]; const build = buildSecondsFor(minutes, independent);
  const quizBlock = independent ? 0 : q + reveal;
  const perRound = quizBlock + build + AVG_WAVE + RESULT + TRANSITIONS;
  const [lo, hi] = waveBand(minutes);
  let waves = Math.max(lo, Math.min(hi, Math.floor((minutes * 60 - SETUP_AND_RESULTS) / perRound)));
  const notes: string[] = [];
  const personalCap = 2;
  const needed = independent ? waves * personalCap : waves;
  let reviewCycle = false;
  if (available < needed) {
    if (cfg.allowReviewCycle && available * 2 >= needed) { reviewCycle = true; notes.push('reviewCycle'); }
    else if (!independent) { waves = Math.max(1, available); notes.push('shortQuiz'); }
    else notes.push('fewPersonalQuestions');
  }
  if (waves < lo) notes.push('belowTarget');
  const { boss, mini } = bossSchedule(minutes, waves);
  const bossTime = boss.length * (AVG_BOSS_WAVE - AVG_WAVE);
  const total = waves * perRound + bossTime + SETUP_AND_RESULTS;
  return {
    minutes, waves, bossWaves: boss, miniBossWaves: mini, questionSeconds: q, revealSeconds: reveal, buildSeconds: build, resultSeconds: RESULT,
    questionsNeeded: needed, questionsAvailable: available, reviewCycle, quizShare: Math.round(((waves * quizBlock) / Math.max(1, total)) * 100) / 100, notes,
    secondsPerRound: perRound, personalCap,
  };
}
