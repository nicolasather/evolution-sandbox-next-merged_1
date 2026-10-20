/** Deterministic fixture quiz covering all five existing question kinds, with real answer keys. Used by dev mode, tests and the load generator.
 *  Every key carries a canary explanation so tests can prove it never appears in a pre-reveal view. */
import type { StoredQuestion } from '../../quiz/public';

export const CANARY = 'SWARM_SECRET_EXPLANATION_7Q2X';
const KINDS = ['multiple_choice', 'answer_forge', 'truth_hunt', 'connection_rush', 'fill_table'] as const;

export function fixtureQuestions(n: number, idPrefix = 'rq'): StoredQuestion[] {
  return Array.from({ length: n }, (_, i) => {
    const kind = KINDS[i % KINDS.length]!; const id = `${idPrefix}${i + 1}`; const base = { id, position: i, kind, base_points: 100 } as const;
    switch (kind) {
      case 'multiple_choice': return { ...base, prompt: `Which is the even number? (${i + 1})`, payload: { options: [{ id: 'a', text: '7' }, { id: 'b', text: '8' }, { id: 'c', text: '9' }] }, answer_key: { correctIds: ['b'], explanation: CANARY, hint: 'Divisible by two.' } };
      case 'answer_forge': return { ...base, prompt: `Type the capital of France. (${i + 1})`, payload: { placeholder: 'answer', caseSensitive: false }, answer_key: { accepted: ['Paris'], explanation: CANARY } };
      case 'truth_hunt': return { ...base, prompt: `Mark each statement. (${i + 1})`, payload: { statements: [{ id: 's1', text: 'Water is wet' }, { id: 's2', text: 'The sun is cold' }] }, answer_key: { truth: { s1: true, s2: false }, partial: true, explanation: CANARY } };
      case 'connection_rush': return { ...base, prompt: `Match each pair. (${i + 1})`, payload: { left: [{ id: 'l1', label: 'Cat' }, { id: 'l2', label: 'Dog' }], right: [{ id: 'r1', label: 'Meow' }, { id: 'r2', label: 'Woof' }] }, answer_key: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }], explanation: CANARY } };
      default: return { ...base, prompt: `Fill the table. (${i + 1})`, payload: { columns: ['n', 'double'], rows: [[{ text: '1', blank: false }, { text: '', blank: true }], [{ text: '2', blank: false }, { text: '', blank: true }]] }, answer_key: { cells: { '0:1': ['2'], '1:1': ['4'] }, explanation: CANARY } };
    }
  });
}
export function correctResponse(q: Pick<StoredQuestion, 'kind'>): unknown {
  switch (q.kind) {
    case 'multiple_choice': return { kind: q.kind, selectedIds: ['b'] };
    case 'answer_forge': return { kind: q.kind, text: 'paris' };
    case 'truth_hunt': return { kind: q.kind, truth: { s1: true, s2: false } };
    case 'connection_rush': return { kind: q.kind, pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }] };
    default: return { kind: q.kind, cells: { '0:1': '2', '1:1': '4' } };
  }
}
export function wrongResponse(q: Pick<StoredQuestion, 'kind'>): unknown {
  switch (q.kind) {
    case 'multiple_choice': return { kind: q.kind, selectedIds: ['a'] };
    case 'answer_forge': return { kind: q.kind, text: 'london' };
    case 'truth_hunt': return { kind: q.kind, truth: { s1: false, s2: true } };
    case 'connection_rush': return { kind: q.kind, pairs: [{ leftId: 'l1', rightId: 'r2' }, { leftId: 'l2', rightId: 'r1' }] };
    default: return { kind: q.kind, cells: { '0:1': '9', '1:1': '9' } };
  }
}
