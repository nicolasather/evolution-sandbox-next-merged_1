/** Learning-quality rules (items 061-070). Pure. */
import type { Loose } from './loose';
import type { Question } from './types';
import { seededShuffle } from './public';

export type Attempt = { questionKey: string; concept: string; correct: boolean; attemptNo: number; at: string; selfCheck?: SelfCheck };
export type SelfCheck = 'guessed' | 'misunderstood' | 'need_practice';
export const SELF_CHECK_LABEL: Record<SelfCheck, string> = { guessed: 'I guessed', misunderstood: 'I misunderstood', need_practice: 'I need practice' };

/** The concept a question teaches: its objective, else its topic, else the question itself. */
export function conceptOf(q: Question, index: number): string {
  const m = (q.payload as Loose).meta as { objective?: string; topic?: string } | undefined;
  return m?.objective?.trim() || m?.topic?.trim() || `q:${index}`;
}

/** First-attempt accuracy: only the first try at each question counts (item 063). */
export function firstAttemptAccuracy(attempts: Attempt[]): number {
  const first = new Map<string, Attempt>();
  [...attempts].sort((a, b) => a.at.localeCompare(b.at)).forEach((a) => { if (!first.has(a.questionKey)) first.set(a.questionKey, a); });
  return first.size ? [...first.values()].filter((a) => a.correct).length / first.size : 0;
}

/** Mastery (item 067): share of DISTINCT concepts answered correctly on the FIRST attempt. Raw points, modifiers and collectibles do not enter. */
export function mastery(attempts: Attempt[]): { concepts: number; mastered: number; percent: number; missed: string[] } {
  const byConcept = new Map<string, Attempt[]>();
  attempts.forEach((a) => (byConcept.get(a.concept) ?? byConcept.set(a.concept, []).get(a.concept)!).push(a));
  let mastered = 0; const missed: string[] = [];
  byConcept.forEach((list, concept) => {
    const first = [...list].sort((a, b) => a.at.localeCompare(b.at))[0]!;
    if (first.correct) mastered++; else missed.push(concept);
  });
  const concepts = byConcept.size;
  return { concepts, mastered, percent: concepts ? Math.round((mastered / concepts) * 100) : 0, missed };
}
/** Repeated mastery is reported separately: concepts missed first but later answered correctly. */
export function recovered(attempts: Attempt[]): string[] {
  const out = new Set<string>();
  const by = new Map<string, Attempt[]>();
  attempts.forEach((a) => (by.get(a.concept) ?? by.set(a.concept, []).get(a.concept)!).push(a));
  by.forEach((list, c) => { const s = [...list].sort((a, b) => a.at.localeCompare(b.at)); if (!s[0]!.correct && s.slice(1).some((a) => a.correct)) out.add(c); });
  return [...out];
}

export type MistakeReview = { index: number; prompt: string; kind: Question['kind']; yourAnswer: unknown; correctAnswer: unknown; explanation?: string; distractorNote?: string; concept: string };
/** Review Mistakes (062): original response next to the correct one and the creator's explanation. Only call after the quiz has ended or been revealed. */
export function reviewMistakes(qs: (Question & { revealed?: boolean })[], responses: Record<number, { response: unknown; correct: boolean }>): MistakeReview[] {
  const out: MistakeReview[] = [];
  qs.forEach((q, i) => {
    const r = responses[i]; if (!r || r.correct) return;
    const ak: Loose = q.answerKey;
    let note: string | undefined;
    if (q.kind === 'multiple_choice' && ak.distractorNotes) {
      const picked = (r.response as { selectedIds?: string[] })?.selectedIds?.[0];
      note = picked ? ak.distractorNotes[picked] : undefined;
    }
    out.push({ index: i, prompt: q.prompt, kind: q.kind, yourAnswer: r.response, correctAnswer: ak, explanation: ak.explanation, distractorNote: note, concept: conceptOf(q, i) });
  });
  return out;
}

/** Retry (063): the same concepts, with question and choice order changed. Deterministic per attempt number. */
export function retryDeck<T extends Question>(qs: T[], missedIndexes: number[], attemptNo: number, seed: string): T[] {
  const picked = missedIndexes.map((i) => qs[i]!).filter(Boolean);
  const shuffled = seededShuffle(picked, `${seed}:deck:${attemptNo}`);
  return shuffled.map((q) => {
    if (q.kind !== 'multiple_choice') return q;
    const pl: Loose = q.payload;
    return { ...q, payload: { ...pl, options: seededShuffle(pl.options, `${seed}:${attemptNo}:${q.prompt}`) } };
  });
}

/* ── Play settings (064, 065, 070) ─────────────────────────────────────────────────────────────────────────────────────── */
export type PlaySettings = {
  hideSpeedBonus: boolean;
  /** Low-pressure: no public rank, no podium, no points on screen, no competitive sounds. */
  lowPressure: boolean;
  /** Untimed practice on the Classic Quiz engine — a play setting, not a new game mode. */
  untimed: boolean;
  quietClassroom: boolean;
};
export const DEFAULT_SETTINGS: PlaySettings = { hideSpeedBonus: false, lowPressure: false, untimed: false, quietClassroom: false };
export function effectiveSettings(s: Partial<PlaySettings>): PlaySettings & { showRank: boolean; showPoints: boolean; showPodium: boolean; sounds: boolean; reactions: boolean; timerEnabled: boolean } {
  const base = { ...DEFAULT_SETTINGS, ...s };
  const calm = base.lowPressure || base.quietClassroom;
  return { ...base, hideSpeedBonus: base.hideSpeedBonus || base.lowPressure, showRank: !base.lowPressure, showPoints: !base.lowPressure, showPodium: !calm, sounds: !calm, reactions: !base.quietClassroom, timerEnabled: !base.untimed };
}

/** Quiet Classroom preset (087): theft-style modifiers, potluck, sounds and reactions off; the questions are untouched. */
export const THEFT_MODIFIERS = ['lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points', 'steal_question', 'potluck'] as const;
export function applyQuietClassroom<M extends string>(mods: M[]): M[] { return mods.filter((m) => !(THEFT_MODIFIERS as readonly string[]).includes(m)); }

/** Fair-play limits per destructive modifier (088). */
export type FairPlay = { maxUses: number; maxLoss: number; confirm: boolean };
export const DEFAULT_FAIR_PLAY: Record<string, FairPlay> = {
  lose_all: { maxUses: 1, maxLoss: 500, confirm: true }, steal_points: { maxUses: 3, maxLoss: 200, confirm: true },
  give_points: { maxUses: 3, maxLoss: 200, confirm: true }, swap_points: { maxUses: 1, maxLoss: 500, confirm: true },
  go_to_first: { maxUses: 1, maxLoss: 0, confirm: true }, potluck: { maxUses: 5, maxLoss: 200, confirm: false },
};
export function checkFairPlay(kind: string, used: number, lossBalance: number, limits: Record<string, FairPlay> = DEFAULT_FAIR_PLAY): { allowed: boolean; reason?: string; cappedLoss: number } {
  const l = limits[kind]; if (!l) return { allowed: true, cappedLoss: lossBalance };
  if (used >= l.maxUses) return { allowed: false, reason: `Fair-play limit: ${kind.replace(/_/g, ' ')} can be used ${l.maxUses} time${l.maxUses === 1 ? '' : 's'} per game.`, cappedLoss: 0 };
  return { allowed: true, cappedLoss: Math.min(lossBalance, l.maxLoss || lossBalance) };
}

/* ── Token farming guard and awards eligibility (069) ──────────────────────────────────────────────────────────────────── */
export type SessionFact = { sessionId: string; quizId: string; verified: boolean; answered: number; distinctQuestions: number; durationSeconds: number; at: string };
/** A session only counts toward cosmetic progress if the server verified it, it had real activity, and it is not a quick repeat of the same quiz. */
export function qualifyingSession(s: SessionFact, previous: SessionFact[]): { ok: boolean; reason?: string } {
  if (!s.verified) return { ok: false, reason: 'not verified by the server' };
  if (s.answered < 3 || s.distinctQuestions < 3) return { ok: false, reason: 'fewer than 3 distinct questions answered' };
  if (s.durationSeconds < s.answered * 2) return { ok: false, reason: 'answered faster than a person can read' };
  const repeats = previous.filter((p) => p.quizId === s.quizId && Date.parse(s.at) - Date.parse(p.at) < 24 * 3_600_000 && Date.parse(s.at) >= Date.parse(p.at));
  if (repeats.length >= 2) return { ok: false, reason: 'the same quiz already counted twice today' };
  return { ok: true };
}
