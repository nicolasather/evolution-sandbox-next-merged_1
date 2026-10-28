/** Remix scoring: 3 s reading grace, confidence wager, streak shields, redemption recovery. Pure; the server applies it. */
export const BASE_POINTS = 1000;
export const GRACE_MS = 3000;
export const QUESTION_MS = 20_000;
export const MAX_SHIELDS = 2;
export const SHIELD_EVERY = 5;
export const WAGER_PENALTY = 400;
export const REDEMPTION_FACTOR = 0.5;
export const REDEMPTION_MS = 60_000;
export type Wager = 'standard' | 'high';
export const WAGER_MULT: Record<Wager, number> = { standard: 1, high: 1.5 };

/** 1.0x for 0–3 s (reading time), then linear decay to 0.5x at the deadline. */
export function speedMultiplier(elapsedMs: number, limitMs = QUESTION_MS): number {
  if (elapsedMs <= GRACE_MS) return 1;
  const span = Math.max(1, limitMs - GRACE_MS);
  return Math.max(0.5, 1 - 0.5 * Math.min(1, (elapsedMs - GRACE_MS) / span));
}

export type Progress = { score: number; streak: number; maxStreak: number; shields: number };
export type AnswerOutcome = Progress & { delta: number; correct: boolean; shieldUsed: boolean; shieldGained: boolean; streakReset: boolean };

export function applyAnswer(p: Progress, a: { correct: boolean; elapsedMs: number; wager: Wager; limitMs?: number }): AnswerOutcome {
  if (a.correct) {
    const delta = Math.round(BASE_POINTS * speedMultiplier(a.elapsedMs, a.limitMs) * WAGER_MULT[a.wager]);
    const streak = p.streak + 1;
    const gained = streak % SHIELD_EVERY === 0 && p.shields < MAX_SHIELDS;
    return { score: p.score + delta, streak, maxStreak: Math.max(p.maxStreak, streak), shields: gained ? p.shields + 1 : p.shields, delta, correct: true, shieldUsed: false, shieldGained: gained, streakReset: false };
  }
  if (a.wager === 'high') {
    // Evidence All-In miss: -400 and one shield breaks (or the streak resets when none is left).
    const score = Math.max(0, p.score - WAGER_PENALTY);
    const hasShield = p.shields > 0;
    return { score, streak: hasShield ? p.streak : 0, maxStreak: p.maxStreak, shields: hasShield ? p.shields - 1 : 0, delta: score - p.score, correct: false, shieldUsed: hasShield, shieldGained: false, streakReset: !hasShield && p.streak > 0 };
  }
  if (p.shields > 0) return { ...p, shields: p.shields - 1, delta: 0, correct: false, shieldUsed: true, shieldGained: false, streakReset: false };
  return { ...p, streak: 0, delta: 0, correct: false, shieldUsed: false, shieldGained: false, streakReset: p.streak > 0 };
}

/** Redemption answers recover 50% of the points the question would have earned at standard wager; no streak effects. */
export function redemptionPoints(correct: boolean, elapsedMs: number): number {
  return correct ? Math.round(BASE_POINTS * speedMultiplier(elapsedMs, REDEMPTION_MS) * REDEMPTION_FACTOR) : 0;
}
export const redemptionEligible = (missed: number) => missed >= 1 && missed <= 3;
export const xpFor = (score: number, correct: number) => Math.max(0, Math.round(score / 10) + correct * 5);
