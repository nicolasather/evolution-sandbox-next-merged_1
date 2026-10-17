import { answerSchema, parseQuestion } from './validation';
import type { Question } from './types';

function norm(value: string, caseSensitive = false) {
  const v = value.trim().normalize('NFKC').replace(/\s+/g, ' ');
  return caseSensitive ? v : v.toLocaleLowerCase('en');
}
function accepted(value: string, answers: string[], sensitive = false, tolerance?: number) {
  const v = norm(value, sensitive);
  if (v === '') return false;
  return answers.some((a) => {
    const n = norm(a, sensitive);
    if (v === n) return true;
    if (tolerance === undefined || n === '') return false;
    const x = Number(v);
    const y = Number(n);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tolerance;
  });
}

/** Deterministic grading against the hidden answer key. Never called on the client. */
export function gradeQuestion(rawQuestion: Question, rawResponse: unknown): boolean {
  const q = parseQuestion(rawQuestion);
  const response = answerSchema.parse(rawResponse);
  if (q.kind !== response.kind) throw new Error('Answer does not match the question type');
  switch (q.kind) {
    case 'multiple_choice': {
      if (response.kind !== 'multiple_choice') return false;
      const ids = q.payload.options.map((x) => x.id);
      if (response.selectedIds.some((x) => !ids.includes(x))) throw new Error('Unknown option');
      return response.selectedIds[0] === q.answerKey.correctIds[0];
    }
    case 'answer_forge':
      return response.kind === 'answer_forge' && accepted(response.text, q.answerKey.accepted, q.payload.caseSensitive, q.answerKey.numericTolerance);
    case 'connection_rush': {
      if (response.kind !== 'connection_rush') return false;
      const expected = new Map(q.answerKey.pairs.map((p) => [p.leftId, p.rightId]));
      const got = new Map(response.pairs.map((p) => [p.leftId, p.rightId]));
      if (got.size !== response.pairs.length) return false; // duplicate left ids
      if (got.size !== expected.size || new Set(response.pairs.map((p) => p.rightId)).size !== got.size) return false;
      return [...expected].every(([a, b]) => got.get(a) === b);
    }
    case 'truth_hunt': {
      if (response.kind !== 'truth_hunt') return false;
      const keys = Object.keys(q.answerKey.truth);
      return Object.keys(response.truth).length === keys.length && keys.every((k) => response.truth[k] === q.answerKey.truth[k]);
    }
    case 'fill_table': {
      if (response.kind !== 'fill_table') return false;
      const keys = Object.keys(q.answerKey.cells);
      return Object.keys(response.cells).length === keys.length && keys.every((k) => accepted(response.cells[k] ?? '', q.answerKey.cells[k]!));
    }
  }
}

/** Step 3 of the verification pipeline: the response must match the question's exact structure and ids. */
export function assertResponseIds(rawQuestion: Question, rawResponse: unknown) {
  const q = parseQuestion(rawQuestion);
  const a = answerSchema.parse(rawResponse);
  if (a.kind !== q.kind) throw new Error('Wrong response type for this question');
  if (a.kind === 'multiple_choice' && q.kind === 'multiple_choice') {
    if (!q.payload.options.some((o) => o.id === a.selectedIds[0])) throw new Error('Unknown option');
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
