/** @jest-environment node */
import { parseCsv, parseQuestionCsv, parseSmartPaste } from '../import';
import { quizBalance, questionWarnings, readingSeconds } from '../quality';
import { blank } from '../editor-model';
import { questionSchema } from '../validation';

describe('smart paste', () => {
  const text = `1. Which planet has rings?
A) Mars
B) Saturn
C) Venus
Answer: B

Q: Capital of France?
Answer: Paris | paris

What is 2+2?
- 3
- 4
Answer: 5`;
  const r = parseSmartPaste(text);
  it('reads multiple choice with a letter answer', () => {
    expect(r[0]!.issues).toEqual([]);
    const q: any = r[0]!.question; expect(q.prompt).toBe('Which planet has rings?');
    expect(q.payload.options.map((o: any) => o.text)).toEqual(['Mars', 'Saturn', 'Venus']);
    expect(q.answerKey.correctIds[0]).toBe(q.payload.options[1].id);
    expect(questionSchema.safeParse(q).success).toBe(true);
  });
  it('reads a free-text answer with alternatives', () => { expect((r[1]!.question.answerKey as any).accepted).toEqual(['Paris', 'paris']); });
  it('flags an answer that matches no option instead of guessing', () => { expect(r[2]!.issues.join(' ')).toMatch(/does not match any option/); });
  it('flags a question with no answer at all', () => { expect(parseSmartPaste('Lonely question')[0]!.issues.length).toBe(1); });
});

describe('csv import', () => {
  it('parses quoted fields, escaped quotes and embedded newlines', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n"l1\nl2",z')).toEqual([['a', 'b'], ['x, y', 'he said "hi"'], ['l1\nl2', 'z']]);
  });
  it('imports the sample file and validates', () => {
    const { staged, error } = parseQuestionCsv('kind,prompt,option_a,option_b,option_c,option_d,correct,points\nmultiple_choice,Which planet is known for its rings?,Mars,Saturn,Venus,Mercury,B,100\nmultiple_choice,How many minutes?,30,45,60,90,C,50');
    expect(error).toBeUndefined(); expect(staged).toHaveLength(2);
    expect(staged.every((s) => s.issues.length === 0 && questionSchema.safeParse(s.question).success)).toBe(true);
    expect(staged[1]!.question.basePoints).toBe(50);
  });
  it('flags a bad key and unsupported kinds; rejects a file without a prompt column', () => {
    const r = parseQuestionCsv('kind,prompt,option_a,option_b,correct\nmultiple_choice,Q,A,B,Z\nfill_table,T,,,');
    expect(r.staged[0]!.issues.length).toBe(1); expect(r.staged[1]!.issues[0]).toMatch(/cannot be imported/);
    expect(parseQuestionCsv('x,y\n1,2').error).toMatch(/prompt/);
  });
});

describe('quality warnings', () => {
  it('flags duplicate options, giveaway length and short time', () => {
    const q: any = blank('multiple_choice'); q.prompt = 'Which describes the process of photosynthesis in detail for the whole plant kingdom?';
    q.payload.options = [{ id: 'a', text: 'Plants converting light energy into chemical energy stored in sugar' }, { id: 'b', text: 'Salt' }, { id: 'c', text: 'Salt' }, { id: 'd', text: 'Iron' }]; q.answerKey = { correctIds: ['a'] };
    const codes = questionWarnings(q, 5).map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['dup-options', 'longest-correct', 'time']));
    expect(readingSeconds(q)).toBeGreaterThan(5);
  });
  it('is quiet about a decent question', () => {
    const q: any = blank('multiple_choice'); q.prompt = 'Which planet is closest to the Sun?';
    q.payload.options = [{ id: 'a', text: 'Mercury' }, { id: 'b', text: 'Venus' }, { id: 'c', text: 'Mars' }]; q.answerKey = { correctIds: ['a'] };
    expect(questionWarnings(q, 30)).toEqual([]);
  });
  it('describes balance without predicting difficulty', () => {
    const qs = Array.from({ length: 6 }, () => blank('multiple_choice'));
    const b = quizBalance(qs); expect(b.byKind.multiple_choice).toBe(6); expect(b.notes.join(' ')).toMatch(/same format/);
  });
});
