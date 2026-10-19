/** @jest-environment node */
import { joinSchema, questionSchema, roomCreateSchema, saveQuizSchema } from '../validation';
import { explainIssue } from '../explain';
import { publicPayload, seededShuffle } from '../public';

const goodMc = { kind: 'multiple_choice', prompt: 'Q', basePoints: 100, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['a'] } };

describe('question validation', () => {
  it('accepts a valid question', () => expect(questionSchema.safeParse(goodMc).success).toBe(true));
  it('rejects a correct id that is not an option', () => expect(questionSchema.safeParse({ ...goodMc, answerKey: { correctIds: ['zz'] } }).success).toBe(false));
  it('rejects duplicate option ids, <2 options, empty prompt, negative or huge points', () => {
    expect(questionSchema.safeParse({ ...goodMc, payload: { options: [{ id: 'a', text: 'A' }, { id: 'a', text: 'B' }] } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...goodMc, payload: { options: [{ id: 'a', text: 'A' }] } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...goodMc, prompt: '   ' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...goodMc, basePoints: -1 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...goodMc, basePoints: 10001 }).success).toBe(false);
  });
  it('strips unknown top-level keys, rejects unknown payload keys and oversized text', () => {
    expect((questionSchema.parse({ ...goodMc, extra: 1 }) as any).extra).toBeUndefined();
    expect(questionSchema.safeParse({ ...goodMc, payload: { options: goodMc.payload.options, hint: 'x' } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...goodMc, payload: { options: [{ id: 'a', text: 'x'.repeat(501) }, { id: 'b', text: 'B' }] } }).success).toBe(false);
  });
  it('rejects unsafe ids', () => expect(questionSchema.safeParse({ ...goodMc, payload: { options: [{ id: 'a b', text: 'A' }, { id: 'b', text: 'B' }] } }).success).toBe(false));
  it('Fill the Table needs a blank with an answer, and strips blank text from the visible payload', () => {
    const t = { kind: 'fill_table', prompt: 'Q', basePoints: 10, payload: { columns: ['a', 'b'], rows: [[{ text: 'SECRET', blank: true }, { text: 'x', blank: false }]] }, answerKey: { cells: { '0:0': ['SECRET'] } } };
    const r = questionSchema.parse(t) as any;
    expect(r.payload.rows[0][0]).toEqual({ text: '', blank: true });
    expect(questionSchema.safeParse({ ...t, answerKey: { cells: {} } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...t, payload: { ...t.payload, rows: [[{ text: '', blank: false }, { text: '', blank: false }]] } }).success).toBe(false);
  });
  it('Connection Rush must pair every item exactly once', () => {
    const base = { kind: 'connection_rush', prompt: 'Q', basePoints: 10, payload: { left: [{ id: 'l1', label: 'a' }, { id: 'l2', label: 'b' }], right: [{ id: 'r1', label: 'A' }, { id: 'r2', label: 'B' }] } };
    expect(questionSchema.safeParse({ ...base, answerKey: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }] } }).success).toBe(true);
    expect(questionSchema.safeParse({ ...base, answerKey: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r1' }] } }).success).toBe(false);
  });
  it('quizzes: drafts may be empty, published need questions, max 200', () => {
    expect(saveQuizSchema.safeParse({ title: 'T', status: 'draft', questions: [] }).success).toBe(true);
    expect(saveQuizSchema.safeParse({ title: 'T', status: 'published', questions: [] }).success).toBe(false);
    expect(saveQuizSchema.safeParse({ title: '  ', status: 'draft', questions: [] }).success).toBe(false);
    expect(saveQuizSchema.safeParse({ title: 'T', status: 'draft', questions: Array(201).fill(goodMc) }).success).toBe(false);
  });
  it('room + join inputs are bounded', () => {
    expect(roomCreateSchema.safeParse({ quizId: 'nope', mode: 'solo', flow: 'independent', durationSeconds: 300, questionSeconds: null, modifiers: [] }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ quizId: '11111111-1111-4111-8111-111111111111', mode: 'solo', flow: 'independent', durationSeconds: 5, questionSeconds: null, modifiers: [] }).success).toBe(false);
    expect(joinSchema.safeParse({ joinCode: 'ABC12', displayName: 'x' }).success).toBe(false);
    expect(joinSchema.safeParse({ joinCode: 'ABC123', displayName: 'x' }).success).toBe(true);
  });
  it('explains problems in plain language with the question number', () => {
    const r = saveQuizSchema.safeParse({ title: 'T', status: 'draft', questions: [goodMc, { ...goodMc, prompt: '' }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(explainIssue({ path: r.error.issues[0]!.path as any, message: r.error.issues[0]!.message, code: r.error.issues[0]!.code })).toMatch(/^Question 2:/);
  });
});

describe('public payloads never hand out answers', () => {
  it('shuffles Connection Rush right column differently from authored order', () => {
    const right = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }];
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      const out = (publicPayload('connection_rush', { left: [], right }, seed) as any).right;
      expect(out.map((x: any) => x.id).join()).not.toBe('r1,r2,r3,r4');
      expect(out).toHaveLength(4);
    }
    expect(seededShuffle([1, 2], 'x')).toEqual([2, 1]);
  });
  it('is deterministic per question so polling does not reshuffle', () => expect(seededShuffle([1, 2, 3, 4, 5], 'same')).toEqual(seededShuffle([1, 2, 3, 4, 5], 'same')));
  it('blanks the text of Fill the Table blanks', () => {
    const out = publicPayload('fill_table', { columns: ['a'], rows: [[{ text: 'LEAK', blank: true }]] }, 's') as any;
    expect(JSON.stringify(out)).not.toContain('LEAK');
  });
});
