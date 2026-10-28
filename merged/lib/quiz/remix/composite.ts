/** Rank composite score and evolutionary tiers. Inputs come from server-validated sessions; formula verbatim from the product spec. */
export type CompositeInput = { score: number; questionCount: number; correct: number; maxStreak: number; xp: number };
export const MAX_SCORE_PER_QUESTION = 1000;

export function composite(i: CompositeInput): number {
  const n = Math.max(1, i.questionCount);
  const scoreNorm = Math.min(1000, Math.max(0, (i.score / (n * MAX_SCORE_PER_QUESTION)) * 1000));
  const accuracy = Math.min(1, Math.max(0, i.correct / n));
  const streakTerm = Math.min(Math.max(0, i.maxStreak), 50) * 20;
  const xpTerm = Math.min(1000, Math.log10(Math.max(0, i.xp) + 1) * 250);
  const c = scoreNorm * 0.4 + accuracy ** 2 * 1000 * 0.25 + streakTerm * 0.2 + xpTerm * 0.15;
  return Math.round(c * 100) / 100;
}

export type TierId = 'proto' | 'cambrian' | 'apex' | 'singularity';
export const TIERS: { id: TierId; label: string; min: number }[] = [
  { id: 'proto', label: '🧬 Proto-Cell', min: 0 },
  { id: 'cambrian', label: '🐚 Cambrian Explorer', min: 300 },
  { id: 'apex', label: '🦖 Apex Predator', min: 600 },
  { id: 'singularity', label: '👑 Singularity Darwin', min: 850 },
];
/** `position` is the 1-based place in the league; Singularity Darwin needs >= 850 AND a top-10 place. */
export function tierFor(compositeScore: number, position: number): (typeof TIERS)[number] {
  if (compositeScore >= 850 && position <= 10) return TIERS[3]!;
  if (compositeScore >= 600) return TIERS[2]!;
  if (compositeScore >= 300) return TIERS[1]!;
  return TIERS[0]!;
}
