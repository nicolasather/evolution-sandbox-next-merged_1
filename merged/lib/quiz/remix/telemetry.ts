/** Misconception Telemetry: option-choice distribution per question and the "cognitive trap" warning. */
export const TRAP_THRESHOLD = 0.35;
export type QuestionTelemetry = { questionId: string; prompt: string; options: string[]; correctIndex: number; counts: number[]; why: string[] };
export type Trap = { questionId: string; optionIndex: number; letter: string; pct: number; banner: string };
const LETTER = ['A', 'B', 'C', 'D', 'E', 'F'];

export function recordChoice(counts: number[], optionIndex: number, size = 4): number[] {
  const next = counts.length ? counts.slice() : new Array<number>(size).fill(0);
  if (optionIndex >= 0 && optionIndex < next.length) next[optionIndex] = (next[optionIndex] ?? 0) + 1;
  return next;
}
/** A trap needs a small minimum sample, otherwise one wrong click would read as "100% chose B". */
export const MIN_SAMPLES = 3;
export function findTraps(qs: readonly QuestionTelemetry[], threshold = TRAP_THRESHOLD, minSamples = MIN_SAMPLES): Trap[] {
  const out: Trap[] = [];
  for (const q of qs) {
    const total = q.counts.reduce((a, b) => a + b, 0);
    if (total < minSamples) continue;
    q.counts.forEach((c, i) => {
      if (i === q.correctIndex || c / total < threshold) return;
      const pct = Math.round((c / total) * 100);
      out.push({ questionId: q.questionId, optionIndex: i, letter: LETTER[i]!, pct, banner: `⚠️ COGNITIVE TRAP DETECTED: ${pct}% chose Option ${LETTER[i]} — ${q.why[i] ?? 'This distractor sounds plausible but does not match the evidence.'}` });
    });
  }
  return out.sort((a, b) => b.pct - a.pct);
}
