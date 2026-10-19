/** Per-question scoring (item 029) and the explainable "maximum achievable points" preview.
 *  Pure: the server calls computeAward() with its own clock; the editor calls explainScoring() to show the creator the rule. */
import type { Grade } from './grading';
import type { Question } from './types';

export type ScoringMode = 'fixed' | 'accuracy' | 'time_bonus' | 'partial';
export type ScoringConfig = { mode: ScoringMode; timeBonusMax?: number };
export type RoomScoringOptions = {
  /** Host switch (item 064): hide speed bonuses entirely and score correctness only. */
  hideSpeedBonus?: boolean;
  /** Seconds allowed for the question, or null/0 for untimed play. */
  questionSeconds?: number | null;
};

export const SCORING_MODES: { mode: ScoringMode; label: string; help: string }[] = [
  { mode: 'fixed', label: 'Fixed points', help: 'The full points for a fully correct answer, nothing otherwise.' },
  { mode: 'accuracy', label: 'Accuracy only', help: 'Like fixed points, but speed never matters — even if the game has a speed bonus.' },
  { mode: 'time_bonus', label: 'Time bonus', help: 'Full points plus a bonus that shrinks as the timer runs down. Needs a question timer.' },
  { mode: 'partial', label: 'Partial credit', help: 'Points for each correct part of Connection Rush, Truth Hunt and Fill the Table.' },
];

export function scoringOf(q: Pick<Question, 'payload'>): ScoringConfig {
  const s = (q.payload as { scoring?: ScoringConfig }).scoring;
  return s ?? { mode: 'fixed' };
}

/** Points a player earns for one answer. `elapsedMs` must come from the server clock. */
export function computeAward(q: Pick<Question, 'basePoints' | 'payload'>, grade: Pick<Grade, 'correct' | 'fraction'>, opts: RoomScoringOptions & { elapsedMs?: number } = {}): { points: number; base: number; bonus: number } {
  const cfg = scoringOf(q);
  const base = grade.correct ? q.basePoints : cfg.mode === 'partial' ? Math.floor(q.basePoints * grade.fraction) : 0;
  let bonus = 0;
  if (grade.correct && cfg.mode === 'time_bonus' && !opts.hideSpeedBonus && opts.questionSeconds && opts.questionSeconds > 0 && cfg.timeBonusMax) {
    const used = Math.min(1, Math.max(0, (opts.elapsedMs ?? opts.questionSeconds * 1000) / (opts.questionSeconds * 1000)));
    bonus = Math.round(cfg.timeBonusMax * (1 - used));
  }
  return { points: base + bonus, base, bonus };
}

export function maxPoints(q: Pick<Question, 'basePoints' | 'payload'>, opts: RoomScoringOptions = {}): number {
  const cfg = scoringOf(q);
  const bonus = cfg.mode === 'time_bonus' && !opts.hideSpeedBonus && opts.questionSeconds ? cfg.timeBonusMax ?? 0 : 0;
  return q.basePoints + bonus;
}

export function explainScoring(q: Pick<Question, 'basePoints' | 'payload'>, opts: RoomScoringOptions = {}): string {
  const cfg = scoringOf(q);
  const b = q.basePoints;
  switch (cfg.mode) {
    case 'fixed': return `${b} points for a fully correct answer, 0 otherwise. Maximum ${b}.`;
    case 'accuracy': return `${b} points for a fully correct answer, 0 otherwise. Speed never changes this. Maximum ${b}.`;
    case 'partial': return `Up to ${b} points, shared equally between the parts. Each correct part earns its share. Maximum ${b}.`;
    case 'time_bonus': {
      const m = cfg.timeBonusMax ?? 0;
      if (opts.hideSpeedBonus) return `${b} points for a correct answer. The host switched speed bonuses off, so the ${m} bonus points are not used. Maximum ${b}.`;
      if (!opts.questionSeconds) return `${b} points for a correct answer. The ${m} bonus points need a question timer; with no timer they are not awarded. Maximum ${b}.`;
      return `${b} points for a correct answer plus up to ${m} bonus points for answering quickly (full bonus at once, none at the deadline). Maximum ${b + m}.`;
    }
  }
}

export function quizMaxPoints(questions: Pick<Question, 'basePoints' | 'payload'>[], opts: RoomScoringOptions = {}): number {
  return questions.reduce((n, q) => n + maxPoints(q, opts), 0);
}

/** Rough play time so the creator sees an estimate on every wizard screen (item 014). */
export function estimateSeconds(q: Pick<Question, 'kind' | 'prompt' | 'payload'>): number {
  const words = q.prompt.trim().split(/\s+/).filter(Boolean).length;
  const reading = Math.ceil(words / 3.3); // ≈200 wpm
  const work = { multiple_choice: 12, answer_forge: 20, connection_rush: 30, truth_hunt: 25, fill_table: 40 }[q.kind];
  return reading + work;
}
export function estimateQuizSeconds(qs: Pick<Question, 'kind' | 'prompt' | 'payload'>[]): number {
  return qs.reduce((n, q) => n + estimateSeconds(q), 0);
}
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
