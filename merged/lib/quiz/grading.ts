import { answerSchema, parseQuestion } from './validation';
import { normalizeText, parseQuantity, roundTo } from './text';
import type { Question } from './types';

type ForgeKey = {
  accepted: string[];
  numericTolerance?: number;
  numericTolerancePct?: number;
  units?: string[];
  unitRequired?: boolean;
  roundTo?: number;
};
type ForgeRules = { caseSensitive?: boolean; punctuation?: 'strict' | 'ignore'; diacritics?: 'strict' | 'ignore' };

const EPS = 1e-9;

/** Exact comparison after normalisation, plus (only when the creator asked for numeric handling) a numeric comparison with units,
 *  rounding and an explicit tolerance. There is deliberately no edit-distance or similarity match. */
export function textAccepted(value: string, key: ForgeKey, rules: ForgeRules = {}): boolean {
  const v = normalizeText(value, rules);
  if (v === '') return false;
  const numeric = key.numericTolerance !== undefined || key.numericTolerancePct !== undefined || key.units !== undefined || key.roundTo !== undefined;
  const units = (key.units ?? []).map((u) => normalizeText(u, { diacritics: 'strict' }));
  const got = numeric ? parseQuantity(value) : null;
  if (key.unitRequired && units.length && got && !got.unit) return false; // a number with no unit when the creator requires one
  return key.accepted.some((a) => {
    const n = normalizeText(a, rules);
    if (n === '') return false;
    if (v === n) return true;
    if (!numeric || !got) return false;
    const want = parseQuantity(a);
    if (!want) return false;
    // units: a unit the creator did not list is never accepted; a missing unit is fine unless required
    if (got.unit) { if (!units.includes(got.unit)) return false; }
    else if (key.unitRequired && units.length) return false;
    const x = key.roundTo !== undefined ? roundTo(got.value, key.roundTo) : got.value;
    const abs = key.numericTolerance ?? 0;
    const rel = key.numericTolerancePct !== undefined ? (Math.abs(want.value) * key.numericTolerancePct) / 100 : 0;
    return Math.abs(x - want.value) <= Math.max(abs, rel) + EPS;
  });
}

export type Grade = { correct: boolean; /** 0..1, only fractional when the creator enabled partial credit */ fraction: number; parts?: { right: number; total: number } };

const wholeOrNothing = (ok: boolean): Grade => ({ correct: ok, fraction: ok ? 1 : 0 });
function partial(right: number, total: number, enabled: boolean): Grade {
  const correct = right === total;
  return { correct, fraction: correct ? 1 : enabled ? right / total : 0, parts: { right, total } };
}

/** Deterministic grading against the hidden answer key. Never called on the client with a real key. */
export function gradeDetailed(rawQuestion: Question, rawResponse: unknown): Grade {
  const q = parseQuestion(rawQuestion);
  const response = answerSchema.parse(rawResponse);
  if (q.kind !== response.kind) throw new Error('Answer does not match the question type');
  const scoring = (q.payload as { scoring?: { mode: string } }).scoring;
  const partialOn = (key: { partial?: boolean }) => key.partial === true || scoring?.mode === 'partial';
  switch (q.kind) {
    case 'multiple_choice': {
      if (response.kind !== 'multiple_choice') return wholeOrNothing(false);
      const ids = q.payload.options.map((x) => x.id);
      if (response.selectedIds.some((x) => !ids.includes(x))) throw new Error('Unknown option');
      if (new Set(response.selectedIds).size !== response.selectedIds.length) throw new Error('Each option can be chosen only once');
      if (!q.payload.multi && response.selectedIds.length !== 1) throw new Error('Choose exactly one option');
      // identity is the stable option id, never the displayed position (item 022)
      const want = new Set(q.answerKey.correctIds);
      return wholeOrNothing(response.selectedIds.length === want.size && response.selectedIds.every((x) => want.has(x)));
    }
    case 'answer_forge':
      return wholeOrNothing(response.kind === 'answer_forge' && textAccepted(response.text, q.answerKey, q.payload));
    case 'connection_rush': {
      if (response.kind !== 'connection_rush') return wholeOrNothing(false);
      const expected = new Map(q.answerKey.pairs.map((p) => [p.leftId, p.rightId]));
      const got = new Map(response.pairs.map((p) => [p.leftId, p.rightId]));
      if (got.size !== response.pairs.length) return wholeOrNothing(false); // duplicate left ids
      if (new Set(response.pairs.map((p) => p.rightId)).size !== got.size) return wholeOrNothing(false); // a right tile used twice
      const right = [...expected].filter(([a, b]) => got.get(a) === b).length;
      return partial(right, expected.size, partialOn(q.answerKey));
    }
    case 'truth_hunt': {
      if (response.kind !== 'truth_hunt') return wholeOrNothing(false);
      const keys = Object.keys(q.answerKey.truth);
      if (Object.keys(response.truth).some((k) => !(k in q.answerKey.truth))) return wholeOrNothing(false);
      return partial(keys.filter((k) => response.truth[k] === q.answerKey.truth[k]).length, keys.length, partialOn(q.answerKey));
    }
    case 'fill_table': {
      if (response.kind !== 'fill_table') return wholeOrNothing(false);
      const keys = Object.keys(q.answerKey.cells);
      if (Object.keys(response.cells).some((k) => !(k in q.answerKey.cells))) return wholeOrNothing(false);
      const rules = { caseSensitive: false };
      return partial(keys.filter((k) => textAccepted(response.cells[k] ?? '', { accepted: q.answerKey.cells[k]! }, rules)).length, keys.length, partialOn(q.answerKey));
    }
  }
}

export function gradeQuestion(rawQuestion: Question, rawResponse: unknown): boolean {
  return gradeDetailed(rawQuestion, rawResponse).correct;
}

/** Step 3 of the verification pipeline: the response must match the question's exact structure and ids. */
export function assertResponseIds(rawQuestion: Question, rawResponse: unknown) {
  const q = parseQuestion(rawQuestion);
  const a = answerSchema.parse(rawResponse);
  if (a.kind !== q.kind) throw new Error('Wrong response type for this question');
  if (a.kind === 'multiple_choice' && q.kind === 'multiple_choice') {
    if (a.selectedIds.some((id) => !q.payload.options.some((o) => o.id === id))) throw new Error('Unknown option');
    if (new Set(a.selectedIds).size !== a.selectedIds.length) throw new Error('Each option can be chosen only once');
    if (!q.payload.multi && a.selectedIds.length !== 1) throw new Error('Choose exactly one option');
  }
  if (a.kind === 'connection_rush' && q.kind === 'connection_rush') {
    const left = new Set(q.payload.left.map((x) => x.id));
    const right = new Set(q.payload.right.map((x) => x.id));
    if (a.pairs.some((p) => !left.has(p.leftId) || !right.has(p.rightId))) throw new Error('Unknown matching item');
    if (new Set(a.pairs.map((p) => p.leftId)).size !== a.pairs.length || new Set(a.pairs.map((p) => p.rightId)).size !== a.pairs.length) throw new Error('Each item can be matched only once');
  }
  if (a.kind === 'truth_hunt' && q.kind === 'truth_hunt') {
    const valid = new Set(q.payload.statements.map((s) => s.id));
    if (Object.keys(a.truth).some((k) => !valid.has(k))) throw new Error('Unknown statement');
  }
  if (a.kind === 'fill_table' && q.kind === 'fill_table') {
    const valid = new Set(Object.keys(q.answerKey.cells));
    if (Object.keys(a.cells).some((k) => !valid.has(k))) throw new Error('Unexpected table cell');
  }
  return a;
}
