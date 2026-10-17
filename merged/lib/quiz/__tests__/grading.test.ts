/** @jest-environment node */
import { assertResponseIds, gradeQuestion } from '../grading';
import type { Question } from '../types';

const mc: Question = { kind: 'multiple_choice', prompt: 'Pick', basePoints: 100, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] }, answerKey: { correctIds: ['b'] } };
const forge: Question = { kind: 'answer_forge', prompt: 'Type', basePoints: 50, payload: { placeholder: 'x', caseSensitive: false }, answerKey: { accepted: ['Paris', 'City of Light'] } };
const forgeNum: Question = { kind: 'answer_forge', prompt: 'Pi', basePoints: 50, payload: { placeholder: 'x', caseSensitive: false }, answerKey: { accepted: ['3.14'], numericTolerance: 0.01 } };
const rush: Question = { kind: 'connection_rush', prompt: 'Match', basePoints: 200, payload: { left: [{ id: 'l1', label: 'x' }, { id: 'l2', label: 'y' }], right: [{ id: 'r1', label: 'X' }, { id: 'r2', label: 'Y' }] }, answerKey: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }] } };
const truth: Question = { kind: 'truth_hunt', prompt: 'T/F', basePoints: 100, payload: { statements: [{ id: 's1', text: 'one' }, { id: 's2', text: 'two' }] }, answerKey: { truth: { s1: true, s2: false } } };
const table: Question = { kind: 'fill_table', prompt: 'Fill', basePoints: 100, payload: { columns: ['k', 'v'], rows: [[{ text: 'a', blank: false }, { text: '', blank: true }], [{ text: 'b', blank: false }, { text: '', blank: true }]] }, answerKey: { cells: { '0:1': ['one', '1'], '1:1': ['two'] } } };

describe('grading — Multiple Choice', () => {
  it('accepts the correct option', () => expect(gradeQuestion(mc, { kind: 'multiple_choice', selectedIds: ['b'] })).toBe(true));
  it('rejects a wrong option', () => expect(gradeQuestion(mc, { kind: 'multiple_choice', selectedIds: ['a'] })).toBe(false));
  it('rejects unknown ids and multi-select', () => {
    expect(() => assertResponseIds(mc, { kind: 'multiple_choice', selectedIds: ['zzz'] })).toThrow();
    expect(() => assertResponseIds(mc, { kind: 'multiple_choice', selectedIds: ['a', 'b'] })).toThrow();
  });
});
describe('grading — Answer Forge', () => {
  it('accepts any accepted alias, ignoring case and spacing', () => {
    expect(gradeQuestion(forge, { kind: 'answer_forge', text: '  paris ' })).toBe(true);
    expect(gradeQuestion(forge, { kind: 'answer_forge', text: 'city   of LIGHT' })).toBe(true);
  });
  it('rejects wrong and empty strings', () => {
    expect(gradeQuestion(forge, { kind: 'answer_forge', text: 'Rome' })).toBe(false);
    expect(gradeQuestion(forge, { kind: 'answer_forge', text: '   ' })).toBe(false);
  });
  it('honours numeric tolerance', () => {
    expect(gradeQuestion(forgeNum, { kind: 'answer_forge', text: '3.145' })).toBe(true);
    expect(gradeQuestion(forgeNum, { kind: 'answer_forge', text: '3.2' })).toBe(false);
  });
  it('case sensitivity can be required', () => {
    const q = { ...forge, payload: { ...forge.payload, caseSensitive: true } };
    expect(gradeQuestion(q, { kind: 'answer_forge', text: 'paris' })).toBe(false);
    expect(gradeQuestion(q, { kind: 'answer_forge', text: 'Paris' })).toBe(true);
  });
  it('rejects oversized input', () => expect(() => gradeQuestion(forge, { kind: 'answer_forge', text: 'x'.repeat(501) })).toThrow());
});
describe('grading — Connection Rush', () => {
  it('accepts the exact one-to-one matching', () => expect(gradeQuestion(rush, { kind: 'connection_rush', pairs: [{ leftId: 'l2', rightId: 'r2' }, { leftId: 'l1', rightId: 'r1' }] })).toBe(true));
  it('rejects swapped, partial and duplicated matches', () => {
    expect(gradeQuestion(rush, { kind: 'connection_rush', pairs: [{ leftId: 'l1', rightId: 'r2' }, { leftId: 'l2', rightId: 'r1' }] })).toBe(false);
    expect(gradeQuestion(rush, { kind: 'connection_rush', pairs: [{ leftId: 'l1', rightId: 'r1' }] })).toBe(false);
    expect(() => assertResponseIds(rush, { kind: 'connection_rush', pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r1' }] })).toThrow();
    expect(() => assertResponseIds(rush, { kind: 'connection_rush', pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l1', rightId: 'r2' }] })).toThrow();
    expect(() => assertResponseIds(rush, { kind: 'connection_rush', pairs: [{ leftId: 'nope', rightId: 'r1' }] })).toThrow();
  });
});
describe('grading — Truth Hunt', () => {
  it('requires every statement correct', () => {
    expect(gradeQuestion(truth, { kind: 'truth_hunt', truth: { s1: true, s2: false } })).toBe(true);
    expect(gradeQuestion(truth, { kind: 'truth_hunt', truth: { s1: true, s2: true } })).toBe(false);
    expect(gradeQuestion(truth, { kind: 'truth_hunt', truth: { s1: true } })).toBe(false);
  });
  it('rejects unknown statement ids', () => expect(() => assertResponseIds(truth, { kind: 'truth_hunt', truth: { s1: true, s9: false } })).toThrow());
});
describe('grading — Fill the Table', () => {
  it('accepts every blank filled with an accepted answer', () => expect(gradeQuestion(table, { kind: 'fill_table', cells: { '0:1': '1', '1:1': 'TWO' } })).toBe(true));
  it('rejects wrong, missing and empty cells', () => {
    expect(gradeQuestion(table, { kind: 'fill_table', cells: { '0:1': 'one', '1:1': 'three' } })).toBe(false);
    expect(gradeQuestion(table, { kind: 'fill_table', cells: { '0:1': 'one' } })).toBe(false);
    expect(gradeQuestion(table, { kind: 'fill_table', cells: { '0:1': 'one', '1:1': '' } })).toBe(false);
  });
  it('rejects extra cells (the visible cell 0:0 is not a blank)', () => expect(() => assertResponseIds(table, { kind: 'fill_table', cells: { '0:1': 'one', '1:1': 'two', '0:0': 'a' } })).toThrow());
});
describe('grading — format mismatches', () => {
  it('throws when the response kind differs from the question kind', () => {
    expect(() => gradeQuestion(mc, { kind: 'answer_forge', text: 'b' })).toThrow();
    expect(() => assertResponseIds(truth, { kind: 'multiple_choice', selectedIds: ['a'] })).toThrow();
  });
  it('rejects extra properties (strict schemas)', () => expect(() => gradeQuestion(mc, { kind: 'multiple_choice', selectedIds: ['b'], correct: true })).toThrow());
});
