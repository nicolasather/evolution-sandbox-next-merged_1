/** Pure helpers for the quiz editor: blank questions for each of the five formats, and tidying before validation. */
import type { Loose } from './loose';
import type { Question, QuestionKind } from './types';

let counter = 0;
export const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function blank(kind: QuestionKind): Question {
  const base = { kind, prompt: '', basePoints: 100 };
  switch (kind) {
    case 'multiple_choice': { const ids = [uid('o'), uid('o'), uid('o'), uid('o')]; return { ...base, payload: { options: ids.map((id) => ({ id, text: '' })) }, answerKey: { correctIds: [ids[0]] } }; }
    case 'answer_forge': return { ...base, payload: { placeholder: 'Type your answer', caseSensitive: false }, answerKey: { accepted: [''] } };
    case 'connection_rush': { const a = [uid('l'), uid('l')], b = [uid('r'), uid('r')]; return { ...base, payload: { left: a.map((id) => ({ id, label: '' })), right: b.map((id) => ({ id, label: '' })) }, answerKey: { pairs: a.map((l, i) => ({ leftId: l, rightId: b[i] })) } }; }
    case 'truth_hunt': { const a = [uid('s'), uid('s')]; return { ...base, payload: { statements: a.map((id) => ({ id, text: '' })) }, answerKey: { truth: { [a[0]!]: true, [a[1]!]: false } } }; }
    case 'fill_table': return { ...base, payload: { columns: ['Column 1', 'Column 2'], rows: [[{ text: '', blank: true }, { text: '', blank: false }]] }, answerKey: { cells: { '0:0': [''] } } };
  }
}

/** Tidy what the author typed before validation: drop empty accepted answers, never ship a blank cell's text. */
export function prepare(q: Question): Question {
  const pl: Loose = q.payload, ak: Loose = q.answerKey;
  if (q.kind === 'answer_forge') return { ...q, answerKey: { ...ak, accepted: (ak.accepted as string[]).map((s) => s.trim()).filter(Boolean) } };
  if (q.kind === 'fill_table') {
    return { ...q,
      payload: { ...pl, rows: pl.rows.map((r: Loose[]) => r.map((c) => (c.blank ? { text: '', blank: true } : c))) },
      answerKey: { cells: Object.fromEntries(Object.entries(ak.cells as Record<string, string[]>).map(([k, v]) => [k, v.map((s) => s.trim()).filter(Boolean)])) } };
  }
  return q;
}

