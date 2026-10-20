/** @jest-environment node */
import { questionSchema } from '@/lib/quiz/validation';
import { gradeDetailed } from '@/lib/quiz/grading';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';

describe('Tower Defense practice bank', () => {
  it('covers all five question formats', () => {
    expect(new Set(PRACTICE.map((q) => q.kind))).toEqual(new Set(['multiple_choice', 'truth_hunt', 'answer_forge', 'connection_rush', 'fill_table']));
  });
  it.each(PRACTICE.map((q) => [q.id, q] as const))('%s passes the site question schema', (_id, q) => {
    const { id: _i, position: _p, ...rest } = q; void _i; void _p;
    const r = questionSchema.safeParse(rest);
    if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  });
  it('ids and positions are unique', () => {
    expect(new Set(PRACTICE.map((q) => q.id)).size).toBe(PRACTICE.length);
    expect(new Set(PRACTICE.map((q) => q.position)).size).toBe(PRACTICE.length);
  });
  // the key itself, turned into a response, must grade as fully correct: the practice can never mark a right answer wrong
  const keyAsResponse = (q: (typeof PRACTICE)[number]): unknown => {
    const k = q.answerKey as Record<string, unknown>;
    switch (q.kind) {
      case 'multiple_choice': return { kind: q.kind, selectedIds: k.correctIds };
      case 'answer_forge': return { kind: q.kind, text: (k.accepted as string[])[0] };
      case 'connection_rush': return { kind: q.kind, pairs: k.pairs };
      case 'truth_hunt': return { kind: q.kind, truth: k.truth };
      case 'fill_table': return { kind: q.kind, cells: Object.fromEntries(Object.entries(k.cells as Record<string, string[]>).map(([c, v]) => [c, v[0]!])) };
    }
  };
  it.each(PRACTICE.map((q) => [q.id, q] as const))('%s: its own key grades as correct, an empty answer does not', (_id, q) => {
    expect(typeof (q.answerKey as { explanation?: string }).explanation).toBe('string');
    expect(gradeDetailed(q, keyAsResponse(q)).correct).toBe(true);
    const wrong = q.kind === 'answer_forge' ? { kind: q.kind, text: 'zzz' } : q.kind === 'multiple_choice' ? { kind: q.kind, selectedIds: [(q.payload as { options: { id: string }[] }).options.find((o) => !(q.answerKey as { correctIds: string[] }).correctIds.includes(o.id))!.id] } : q.kind === 'connection_rush' ? { kind: q.kind, pairs: [] } : q.kind === 'truth_hunt' ? { kind: q.kind, truth: {} } : { kind: q.kind, cells: {} };
    expect(gradeDetailed(q, wrong).correct).toBe(false);
  });
});
