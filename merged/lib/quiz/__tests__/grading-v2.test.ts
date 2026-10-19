/** @jest-environment node */
import { gradeDetailed, gradeQuestion, assertResponseIds, textAccepted } from '../grading';
import { normalizeText, parseNumber, parseQuantity } from '../text';
import { publicPayload, publicQuestionView, hintOf } from '../public';
import { questionSchema, saveQuizSchema } from '../validation';
import type { Question } from '../types';

const forge = (key: any, payload: any = {}): Question => ({ kind: 'answer_forge', prompt: 'p', basePoints: 100, payload: { placeholder: 'x', caseSensitive: false, ...payload }, answerKey: { accepted: ['x'], ...key } });
const say = (q: Question, text: string) => gradeQuestion(q, { kind: 'answer_forge', text });

describe('text normalisation (item 023)', () => {
  it('treats composed and decomposed Vietnamese letters as equal', () => {
    const composed = 'Hà Nội'.normalize('NFC'); const decomposed = 'Hà Nội'.normalize('NFD');
    expect(normalizeText(composed)).toBe(normalizeText(decomposed));
    expect(say(forge({ accepted: [composed] }), decomposed)).toBe(true);
  });
  it('keeps tone marks unless the creator relaxes them', () => {
    expect(say(forge({ accepted: ['Hà Nội'] }), 'Ha Noi')).toBe(false);
    expect(say(forge({ accepted: ['Hà Nội'] }, { diacritics: 'ignore' }), 'ha noi')).toBe(true);
    expect(say(forge({ accepted: ['Đà Nẵng'] }, { diacritics: 'ignore' }), 'da nang')).toBe(true);
  });
  it('ignores zero-width characters and odd spacing', () => expect(say(forge({ accepted: ['New York'] }), 'New​   York ')).toBe(true));
  it('punctuation tolerance is opt-in and keeps decimal points', () => {
    expect(say(forge({ accepted: ['U.S.A.'] }), 'USA')).toBe(false);
    expect(say(forge({ accepted: ['U.S.A.'] }, { punctuation: 'ignore' }), 'USA')).toBe(true);
    expect(normalizeText('3.14, ok!', { punctuation: 'ignore' })).toBe('3.14 ok');
  });
  it('has no fuzzy matching: a one-letter typo is wrong', () => {
    expect(say(forge({ accepted: ['photosynthesis'] }), 'photosynthesys')).toBe(false);
    expect(say(forge({ accepted: ['Paris'] }), 'Pariss')).toBe(false);
  });
  it('accepts every alias and respects case sensitivity', () => {
    const q = forge({ accepted: ['H2O', 'water'] }, { caseSensitive: true });
    expect(say(q, 'water')).toBe(true); expect(say(q, 'Water')).toBe(false); expect(say(q, 'H2O')).toBe(true);
  });
});

describe('numeric answers are judged on the server with units, rounding and tolerance (item 024)', () => {
  it('parses decimal comma, thousands separators and units', () => {
    expect(parseNumber('3,14')).toBe(3.14); expect(parseNumber('1,234.5')).toBe(1234.5); expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234')).toBe(1234); expect(parseNumber('abc')).toBeNull();
    expect(parseQuantity('12.5 cm')).toEqual({ value: 12.5, unit: 'cm' }); expect(parseQuantity('7')).toEqual({ value: 7, unit: '' });
  });
  it('honours absolute tolerance', () => {
    const q = forge({ accepted: ['3.14'], numericTolerance: 0.01 });
    expect(say(q, '3.145')).toBe(true); expect(say(q, '3,15')).toBe(true); expect(say(q, '3.2')).toBe(false);
  });
  it('honours percentage tolerance', () => {
    const q = forge({ accepted: ['200'], numericTolerancePct: 5 });
    expect(say(q, '209')).toBe(true); expect(say(q, '211')).toBe(false);
  });
  it('accepts only the units the creator defined', () => {
    const q = forge({ accepted: ['12'], units: ['cm', 'centimetres'], numericTolerance: 0 });
    expect(say(q, '12 cm')).toBe(true); expect(say(q, '12 Centimetres')).toBe(true); expect(say(q, '12 km')).toBe(false); expect(say(q, '12')).toBe(true);
    expect(say(forge({ accepted: ['12'], units: ['cm'], unitRequired: true, numericTolerance: 0 }), '12')).toBe(false);
  });
  it('rounds the learner’s answer to the instructed decimals first', () => {
    const q = forge({ accepted: ['3.14'], roundTo: 2, numericTolerance: 0 });
    expect(say(q, '3.14159')).toBe(true); expect(say(q, '3.15')).toBe(false);
  });
  it('is evaluated by the server grader, not a client pattern', () => expect(textAccepted('3.1', { accepted: ['3.14'], numericTolerance: 0.01 })).toBe(false));
});

describe('Multiple Choice identity is the option id (items 021, 022)', () => {
  const mc: Question = { kind: 'multiple_choice', prompt: 'p', basePoints: 100, payload: { options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id.toUpperCase() })) }, answerKey: { correctIds: ['c'] } };
  it('stays correct after every reshuffle', () => {
    for (let n = 0; n < 40; n++) {
      const shown = (publicPayload('multiple_choice', mc.payload, `seed-${n}`) as any).options as { id: string; text: string }[];
      expect(shown.map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd']);
      const picked = shown.find((o) => o.text === 'C')!;
      expect(gradeQuestion(mc, { kind: 'multiple_choice', selectedIds: [picked.id] })).toBe(true);
      expect(gradeQuestion(mc, { kind: 'multiple_choice', selectedIds: [shown[0]!.id === 'c' ? 'a' : shown[0]!.id] })).toBe(false);
    }
  });
  it('actually reorders, differently for different players, unless the creator keeps the order', () => {
    const orders = new Set(Array.from({ length: 12 }, (_, n) => (publicPayload('multiple_choice', mc.payload, `p${n}`) as any).options.map((o: any) => o.id).join('')));
    expect(orders.size).toBeGreaterThan(3);
    expect((publicPayload('multiple_choice', { ...mc.payload, shuffle: false }, 'x') as any).options.map((o: any) => o.id).join('')).toBe('abcd');
  });
  it('supports an explicit multi-answer variant graded as a set', () => {
    const multi: Question = { ...mc, payload: { ...mc.payload, multi: true }, answerKey: { correctIds: ['a', 'c'] } };
    expect(gradeQuestion(multi, { kind: 'multiple_choice', selectedIds: ['c', 'a'] })).toBe(true);
    expect(gradeQuestion(multi, { kind: 'multiple_choice', selectedIds: ['a'] })).toBe(false);
    expect(gradeQuestion(multi, { kind: 'multiple_choice', selectedIds: ['a', 'b', 'c'] })).toBe(false);
    expect(() => assertResponseIds(mc, { kind: 'multiple_choice', selectedIds: ['a', 'c'] })).toThrow();
    expect(questionSchema.safeParse({ ...multi, answerKey: { correctIds: ['a', 'b', 'c', 'd'] } }).success).toBe(false);
  });
  it('supports optional images on choices and enforces 2–8 options', () => {
    const img = { type: 'image', ref: 'quiz-media/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png', alt: 'A red apple' };
    expect(questionSchema.safeParse({ ...mc, payload: { options: [{ id: 'a', text: 'A', image: img }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['a'] } }).success).toBe(true);
    expect(questionSchema.safeParse({ ...mc, payload: { options: Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, text: 'x' })) }, answerKey: { correctIds: ['o0'] } }).success).toBe(false);
  });
});

describe('Connection Rush, Truth Hunt and Fill the Table partial credit (items 025, 026, 027)', () => {
  const rush = (partial: boolean): Question => ({ kind: 'connection_rush', prompt: 'p', basePoints: 90, payload: { left: [1, 2, 3].map((n) => ({ id: `l${n}`, label: `L${n}` })), right: [1, 2, 3].map((n) => ({ id: `r${n}`, label: `R${n}` })) }, answerKey: { pairs: [1, 2, 3].map((n) => ({ leftId: `l${n}`, rightId: `r${n}` })), ...(partial ? { partial: true } : {}) } });
  const resp = (a: string[]) => ({ kind: 'connection_rush', pairs: a.map((r, i) => ({ leftId: `l${i + 1}`, rightId: r })) });
  it('awards a fraction only when the creator enabled it', () => {
    expect(gradeDetailed(rush(true), resp(['r1', 'r2', 'r3'])).fraction).toBe(1);
    expect(gradeDetailed(rush(true), resp(['r1', 'r3', 'r2']))).toMatchObject({ correct: false, parts: { right: 1, total: 3 } });
    expect(gradeDetailed(rush(true), resp(['r1', 'r3', 'r2'])).fraction).toBeCloseTo(1 / 3);
    expect(gradeDetailed(rush(false), resp(['r1', 'r3', 'r2'])).fraction).toBe(0);
  });
  it('rejects a tile used twice', () => expect(() => assertResponseIds(rush(true), resp(['r1', 'r1', 'r3']))).toThrow());
  it('Truth Hunt grades each statement and can explain each one after reveal', () => {
    const t: Question = { kind: 'truth_hunt', prompt: 'p', basePoints: 100, payload: { statements: [{ id: 's1', text: 'a' }, { id: 's2', text: 'b' }] }, answerKey: { truth: { s1: true, s2: false }, statementNotes: { s2: 'Because …' }, partial: true } };
    expect(questionSchema.safeParse(t).success).toBe(true);
    expect(gradeDetailed(t, { kind: 'truth_hunt', truth: { s1: true, s2: true } }).fraction).toBe(0.5);
  });
  it('Fill the Table never carries blank answers in the player payload', () => {
    const t: Question = { kind: 'fill_table', prompt: 'p', basePoints: 100, payload: { columns: ['k', 'v'], rows: [[{ text: 'a', blank: false }, { text: 'SECRET', blank: true }]] }, answerKey: { cells: { '0:1': ['SECRET'] } } };
    const v = publicQuestionView({ id: 'x', position: 0, kind: t.kind, prompt: t.prompt, payload: (questionSchema.parse(t) as any).payload, answer_key: t.answerKey, base_points: 100 }, { reveal: false, seed: 's' });
    expect(JSON.stringify(v)).not.toContain('SECRET');
  });
});

describe('answer keys never leave early (items 028, 134)', () => {
  const rows = [
    { kind: 'multiple_choice', payload: { options: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }] }, answer_key: { correctIds: ['b'], explanation: 'EXPLAIN-MC', hint: 'HINT-MC', distractorNotes: { a: 'NOTE-MC' } } },
    { kind: 'answer_forge', payload: { placeholder: 'x', caseSensitive: false }, answer_key: { accepted: ['SECRET-FORGE'], explanation: 'EXPLAIN-F', hint: 'HINT-F' } },
    { kind: 'connection_rush', payload: { left: [{ id: 'l1', label: 'L' }, { id: 'l2', label: 'M' }], right: [{ id: 'r1', label: 'R' }, { id: 'r2', label: 'S' }] }, answer_key: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }], explanation: 'EXPLAIN-R', hint: 'HINT-R' } },
    { kind: 'truth_hunt', payload: { statements: [{ id: 's1', text: 'T' }] }, answer_key: { truth: { s1: true }, statementNotes: { s1: 'NOTE-T' }, explanation: 'EXPLAIN-T', hint: 'HINT-T' } },
    { kind: 'fill_table', payload: { columns: ['a'], rows: [[{ text: 'SECRET-CELL', blank: true }]] }, answer_key: { cells: { '0:0': ['SECRET-CELL'] }, explanation: 'EXPLAIN-X', hint: 'HINT-X' } },
  ];
  it.each(rows.map((r) => [r.kind, r] as const))('%s: the live payload contains no key, explanation, hint or notes', (_k, r) => {
    const payload = r.kind === 'fill_table' ? { columns: ['a'], rows: [[{ text: '', blank: true }]] } : r.payload;
    const v = publicQuestionView({ id: 'q', position: 0, kind: r.kind, prompt: 'p', payload, answer_key: r.answer_key, base_points: 10 }, { reveal: false, seed: 's' });
    const text = JSON.stringify(v);
    expect(v).not.toHaveProperty('answerKey');
    for (const secret of ['EXPLAIN', 'HINT-', 'NOTE-', 'SECRET', 'correctIds', 'accepted']) expect(text).not.toContain(secret);
    expect(v.hasHint).toBe(true);
  });
  it('the key and explanation appear after reveal, the hint only through its own call', () => {
    const r = rows[0]!;
    const v = publicQuestionView({ id: 'q', position: 0, kind: r.kind, prompt: 'p', payload: r.payload, answer_key: r.answer_key, base_points: 10 }, { reveal: true, seed: 's' });
    expect((v.answerKey as any).explanation).toBe('EXPLAIN-MC');
    expect(hintOf({ answer_key: r.answer_key })).toBe('HINT-MC');
    expect(hintOf({ answer_key: { correctIds: [] } })).toBeNull();
  });
});

describe('validation stays backward compatible (item 030)', () => {
  it('accepts questions saved before the new optional fields existed', () => {
    const old = { kind: 'answer_forge', prompt: 'Old', basePoints: 100, payload: { placeholder: 'x', caseSensitive: false }, answerKey: { accepted: ['a'], numericTolerance: 1 } };
    expect(questionSchema.safeParse(old).success).toBe(true);
    expect(saveQuizSchema.safeParse({ title: 'T', status: 'published', questions: [old] }).success).toBe(true);
  });
  it('rejects unknown keys, an image without alt text, and unsupported partial credit', () => {
    const mc = { kind: 'multiple_choice', prompt: 'p', basePoints: 10, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['a'] } };
    expect(questionSchema.safeParse({ ...mc, payload: { ...mc.payload, evil: 1 } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mc, payload: { ...mc.payload, media: { type: 'image', ref: 'quiz-media/x' } } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mc, payload: { ...mc.payload, media: { type: 'image', ref: 'quiz-media/x', decorative: true } } }).success).toBe(true);
    expect(questionSchema.safeParse({ ...mc, payload: { ...mc.payload, scoring: { mode: 'partial' } } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mc, payload: { ...mc.payload, media: { type: 'audio', ref: 'quiz-media/a' } } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mc, payload: { ...mc.payload, media: { type: 'audio', ref: 'quiz-media/a', transcript: 'Hello' } } }).success).toBe(true);
  });
  it('accepts explanation, hint and distractor notes only in the hidden key', () => {
    const mc = { kind: 'multiple_choice', prompt: 'p', basePoints: 10, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['a'], explanation: 'Because', hint: 'Think', distractorNotes: { b: 'B is wrong because' } } };
    expect(questionSchema.safeParse(mc).success).toBe(true);
    expect(questionSchema.safeParse({ ...mc, answerKey: { ...mc.answerKey, distractorNotes: { zzz: 'x' } } }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mc, payload: { ...mc.payload, explanation: 'leak' } }).success).toBe(false);
  });
});
