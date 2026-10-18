/** Deterministic clarity and difficulty warnings. These are rules of thumb, not judgments of what students know:
 *  they point at things a human should look at, and say so. */
import type { Question } from './types';

export type Warning = { level: 'info' | 'warn'; code: string; message: string };

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
/** Seconds a typical reader needs: ~3 words per second, plus a floor for thinking. */
export function readingSeconds(q: Question): number {
  const p: any = q.payload;
  let w = words(q.prompt);
  if (q.kind === 'multiple_choice') w += (p.options as { text: string }[]).reduce((a, o) => a + words(o.text), 0);
  else if (q.kind === 'truth_hunt') w += (p.statements as { text: string }[]).reduce((a, o) => a + words(o.text), 0);
  else if (q.kind === 'connection_rush') w += [...p.left, ...p.right].reduce((a: number, o: { label: string }) => a + words(o.label), 0);
  else if (q.kind === 'fill_table') w += (p.rows as { text: string }[][]).flat().reduce((a, c) => a + words(c.text), 0);
  const media = p.media ? (p.media.kind === 'video' ? 15 : 5) : 0;
  return Math.round(w / 3 + media + 5);
}

export function questionWarnings(q: Question, questionSeconds: number | null): Warning[] {
  const out: Warning[] = [];
  const p: any = q.payload; const ak: any = q.answerKey;
  const w = (code: string, message: string, level: Warning['level'] = 'warn') => out.push({ level, code, message });
  const promptWords = words(q.prompt);
  if (q.prompt.trim() && q.prompt.trim().length < 10) w('short', 'The question is very short. Check it makes sense on its own.', 'info');
  if (q.prompt.length > 300) w('long', 'This prompt is long. Consider shortening it or moving detail into a picture.', 'info');
  if (q.basePoints === 0) w('zero', 'This question is worth 0 points.');
  if (q.kind === 'multiple_choice') {
    const opts = p.options as { id: string; text: string }[];
    const texts = opts.map((o) => o.text.trim().toLowerCase()).filter(Boolean);
    if (new Set(texts).size !== texts.length) w('dup-options', 'Two options have the same text.');
    if (opts.length === 2) w('two-options', 'With only two options, a guess is right half the time.', 'info');
    if (texts.some((t) => /^(all|none) of the above$/.test(t))) w('all-above', '“All/None of the above” options are easy to guess and hard to grade fairly.', 'info');
    const correct = opts.find((o) => o.id === ak.correctIds?.[0]);
    const lens = opts.map((o) => o.text.trim().length);
    const others = opts.filter((o) => o !== correct).map((o) => o.text.trim().length);
    if (correct && others.length >= 2 && correct.text.trim().length > 25 && correct.text.trim().length > 2 * (others.reduce((a, b) => a + b, 0) / others.length)) w('longest-correct', 'The correct option is much longer than the others, which can give it away.');
    if (lens.every((l) => l === 0)) w('no-text', 'No option has text. Make sure the pictures have clear descriptions.', 'info');
  }
  if (q.kind === 'answer_forge') {
    const acc = ak.accepted as string[];
    if (acc.length === 1 && /[\s,.-]/.test(acc[0]!.trim()) && acc[0]!.trim().length > 3) w('single-accepted', 'Only one accepted answer. Players may phrase it differently — add alternatives.', 'info');
    if (p.caseSensitive) w('case', 'Case-sensitive answers can mark a correct answer wrong.', 'info');
  }
  if (q.kind === 'truth_hunt') {
    const v = Object.values(ak.truth as Record<string, boolean>);
    if (v.length >= 3 && (v.every(Boolean) || v.every((x) => !x))) w('all-same', 'Every statement has the same answer, which makes this easy to guess.');
  }
  if (q.kind === 'fill_table') {
    const cells = (p.rows as { blank: boolean }[][]).flat();
    const blanks = cells.filter((c) => c.blank).length;
    if (cells.length && blanks / cells.length > 0.5) w('many-blanks', 'More than half the cells are blanks. Give enough visible context.', 'info');
  }
  const limit = (p.timeSeconds as number | undefined) ?? questionSeconds;
  const need = readingSeconds(q);
  if (limit && need > limit) w('time', `Reading this takes about ${need}s but the time limit is ${limit}s. Raise the timer or turn on adaptive timing.`);
  if (promptWords > 0 && promptWords <= 2 && !p.media) w('no-context', 'One or two words may not be enough context without a picture.', 'info');
  return out;
}

export type QuizBalance = { byKind: Record<string, number>; totalReadingSeconds: number; avgReadingSeconds: number; textHeavy: number; withMedia: number; notes: string[] };
/** An overview for the creator. It describes the quiz; it does not predict how hard players will find it. */
export function quizBalance(qs: Question[]): QuizBalance {
  const byKind: Record<string, number> = {};
  let total = 0, heavy = 0, media = 0;
  for (const q of qs) {
    byKind[q.kind] = (byKind[q.kind] ?? 0) + 1;
    const r = readingSeconds(q); total += r; if (r > 25) heavy++; if ((q.payload as any).media) media++;
  }
  const notes: string[] = [];
  if (qs.length >= 5 && Object.keys(byKind).length === 1) notes.push('Every question uses the same format. Mixing formats keeps rounds varied.');
  if (qs.length && heavy / qs.length > 0.4) notes.push(`${heavy} of ${qs.length} questions need more than 25 seconds of reading.`);
  if (qs.length >= 8 && media === 0) notes.push('No question has a picture, GIF or video.');
  if (qs.length > 0 && qs.length < 5) notes.push('Fewer than 5 questions: scores will be decided by very few answers.');
  return { byKind, totalReadingSeconds: total, avgReadingSeconds: qs.length ? Math.round(total / qs.length) : 0, textHeavy: heavy, withMedia: media, notes };
}
