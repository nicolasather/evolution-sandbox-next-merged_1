/** @jest-environment node */
import { computeAward, maxPoints, explainScoring, quizMaxPoints, estimateQuizSeconds, formatDuration } from '../scoring';
import { clockOffset, remainingMs, isNewer, resolveSlots, backoffMs, isAccepted, submissionKey } from '../sync';
import { createHistory, record, undo, redo, canUndo, canRedo, serialize, parseHistory, recordCoalesced } from '../history';
import { moveItem, removeMany, duplicateAt, reid, setSection, groupBySection, toClipboard, fromClipboard, fieldErrors } from '../editor-ops';
import { contrast, readableOn, plainError, correlationId } from '../a11y';
import type { Question } from '../types';

const q = (scoring?: any, base = 100): any => ({ basePoints: base, payload: scoring ? { scoring } : {} });

describe('per-question scoring (item 029)', () => {
  it('fixed and accuracy give full points only for a fully correct answer', () => {
    expect(computeAward(q(), { correct: true, fraction: 1 }).points).toBe(100);
    expect(computeAward(q({ mode: 'accuracy' }), { correct: false, fraction: 0.5 }).points).toBe(0);
  });
  it('partial credit scales by correct parts', () => expect(computeAward(q({ mode: 'partial' }), { correct: false, fraction: 1 / 3 }).points).toBe(33));
  it('time bonus is full at once, zero at the deadline, and can be hidden by the host', () => {
    const t = q({ mode: 'time_bonus', timeBonusMax: 50 });
    expect(computeAward(t, { correct: true, fraction: 1 }, { questionSeconds: 20, elapsedMs: 0 }).points).toBe(150);
    expect(computeAward(t, { correct: true, fraction: 1 }, { questionSeconds: 20, elapsedMs: 10000 }).points).toBe(125);
    expect(computeAward(t, { correct: true, fraction: 1 }, { questionSeconds: 20, elapsedMs: 20000 }).points).toBe(100);
    expect(computeAward(t, { correct: true, fraction: 1 }, { questionSeconds: 20, elapsedMs: 0, hideSpeedBonus: true }).points).toBe(100);
    expect(computeAward(t, { correct: false, fraction: 0 }, { questionSeconds: 20, elapsedMs: 0 }).points).toBe(0);
  });
  it('explains the rule and the maximum in plain language', () => {
    expect(explainScoring(q({ mode: 'time_bonus', timeBonusMax: 40 }), { questionSeconds: 30 })).toContain('Maximum 140');
    expect(explainScoring(q({ mode: 'time_bonus', timeBonusMax: 40 }), { hideSpeedBonus: true })).toContain('Maximum 100');
    expect(maxPoints(q({ mode: 'time_bonus', timeBonusMax: 40 }), {})).toBe(100);
    expect(quizMaxPoints([q(), q({ mode: 'time_bonus', timeBonusMax: 10 }, 50)], { questionSeconds: 10 })).toBe(160);
  });
  it('estimates duration', () => {
    const qs = [{ kind: 'multiple_choice', prompt: 'What is two plus two in base ten arithmetic?', payload: {} }] as any;
    expect(estimateQuizSeconds(qs)).toBeGreaterThan(12); expect(formatDuration(45)).toBe('45 s'); expect(formatDuration(600)).toBe('10 min');
  });
});

describe('timers and ordering (items 073, 093, 095, 096, 100)', () => {
  it('reconciles the device clock with the server clock (midpoint, so latency cancels)', () => {
    expect(clockOffset(1_000_500, 1_000_000, 1_001_000)).toBe(0);
    expect(clockOffset(2_000_000, 1_000_000, 1_000_400)).toBe(999_800);
  });
  it('computes remaining time from the server clock and freezes while paused', () => {
    const opened = new Date(1_000_000).toISOString();
    expect(remainingMs({ openedAt: opened, pausedAt: null, limitSeconds: 30 }, 1_010_000)).toBe(20_000);
    expect(remainingMs({ openedAt: opened, pausedAt: new Date(1_012_000).toISOString(), limitSeconds: 30 }, 1_500_000)).toBe(18_000);
    expect(remainingMs({ openedAt: opened, pausedAt: null, limitSeconds: 30 }, 2_000_000)).toBe(0);
    expect(remainingMs({ openedAt: opened, pausedAt: null, limitSeconds: null }, 1)).toBeNull();
  });
  it('never rolls the UI backwards on out-of-order snapshots', () => {
    const a = { seq: 5, serverNow: '2026-01-01T00:00:05Z' };
    expect(isNewer({ seq: 4 }, a)).toBe(false); expect(isNewer({ seq: 6 }, a)).toBe(true); expect(isNewer({ serverNow: '2026-01-01T00:00:01Z' }, { serverNow: '2026-01-01T00:00:05Z' })).toBe(false);
  });
  it('slot races: the first N valid submissions win, deterministically', () => {
    const subs = [{ id: 'c', at: 3 }, { id: 'a', at: 1 }, { id: 'b', at: 1 }, { id: 'd', at: 2 }];
    const r = resolveSlots(subs, 2);
    expect(r.accepted.map((s) => s.id)).toEqual(['a', 'b']); expect(r.rejected.map((s) => s.id)).toEqual(['d', 'c']);
    expect(resolveSlots([...subs].reverse(), 2).accepted.map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('retries share a key and "accepted" needs server confirmation', () => {
    expect(submissionKey('q1', 'p1')).toBe(submissionKey('q1', 'p1'));
    expect(isAccepted({ status: 'pending' })).toBe(false); expect(isAccepted({ status: 'confirmed', value: 1 })).toBe(true);
  });
  it('backs off with jitter and a cap during reconnect storms', () => {
    expect(backoffMs(0, 800, 15000, () => 0)).toBe(400); expect(backoffMs(20, 800, 15000, () => 1)).toBe(15000);
    const spread = new Set(Array.from({ length: 20 }, () => backoffMs(4))); expect(spread.size).toBeGreaterThan(5);
  });
});

describe('undo / redo (item 016)', () => {
  it('records, undoes and redoes; a new edit clears redo', () => {
    let h = createHistory<string[]>([]);
    h = record(h, ['a']); h = record(h, ['a', 'b']);
    expect(canUndo(h)).toBe(true); h = undo(h); expect(h.present).toEqual(['a']); expect(canRedo(h)).toBe(true);
    h = redo(h); expect(h.present).toEqual(['a', 'b']);
    h = undo(h); h = record(h, ['z']); expect(canRedo(h)).toBe(false);
  });
  it('ignores no-op edits, is bounded and survives serialisation', () => {
    let h = createHistory(0, 3); for (let i = 1; i <= 8; i++) h = record(h, i);
    expect(h.past.length).toBe(3); expect(record(h, 8)).toBe(h);
    const back = parseHistory<number>(serialize(h)); expect(back?.present).toBe(8); expect(back?.past).toEqual(h.past);
    expect(parseHistory('garbage')).toBeNull();
  });
  it('coalesces typing into one step', () => {
    let h = createHistory('a'); let key: string | null = null;
    ({ h, key } = recordCoalesced(h, 'ab', 'f', key, false) as any); ({ h, key } = recordCoalesced(h, 'abc', 'f', key, true) as any);
    expect(h.past).toEqual(['a']); expect(h.present).toBe('abc');
  });
});

const mc = (n: string): Question => ({ kind: 'multiple_choice', prompt: n, basePoints: 100, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['b'] } });
describe('editor operations (items 017, 018, 019, 048)', () => {
  it('moves, removes in batch and duplicates with fresh consistent ids', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]); expect(removeMany([1, 2, 3, 4], [1, 3])).toEqual([1, 3]);
    const out = duplicateAt([mc('x')], 0);
    expect(out).toHaveLength(2);
    const copy = out[1]!; const id = (copy.answerKey as any).correctIds[0];
    expect((copy.payload as any).options.map((o: any) => o.id)).toContain(id);
    expect(id).not.toBe('b'); expect((out[0]!.answerKey as any).correctIds[0]).toBe('b');
  });
  it('re-ids Connection Rush and Truth Hunt keys consistently', () => {
    const r = reid({ kind: 'connection_rush', prompt: 'p', basePoints: 1, payload: { left: [{ id: 'l1', label: 'a' }, { id: 'l2', label: 'b' }], right: [{ id: 'r1', label: 'A' }, { id: 'r2', label: 'B' }] }, answerKey: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }] } });
    const p: any = r.payload; const k: any = r.answerKey;
    expect(k.pairs.every((x: any) => p.left.some((l: any) => l.id === x.leftId) && p.right.some((l: any) => l.id === x.rightId))).toBe(true);
    const t = reid({ kind: 'truth_hunt', prompt: 'p', basePoints: 1, payload: { statements: [{ id: 's1', text: 'x' }] }, answerKey: { truth: { s1: true } } });
    expect(Object.keys((t.answerKey as any).truth)).toEqual([(t.payload as any).statements[0].id]);
  });
  it('sections group questions', () => {
    const qs = setSection([mc('1'), mc('2'), mc('3')], [0, 2], 'Fractions'); expect(groupBySection(qs).map((x) => x.prompt)).toEqual(['2', '1', '3']);
    expect(setSection(qs, [0], '')[0]!.payload).not.toHaveProperty('meta');
  });
  it('copy/paste keeps owned media, drops what is missing or not owned and reports it', () => {
    const owner = '11111111-1111-1111-1111-111111111111'; const other = '22222222-2222-2222-2222-222222222222';
    const withMedia = { ...mc('m'), payload: { ...mc('m').payload, media: { type: 'image', ref: `quiz-media/${owner}/33333333-3333-3333-3333-333333333333.png`, alt: 'ok' } } } as Question;
    const foreign = { ...mc('f'), payload: { ...mc('f').payload, media: { type: 'image', ref: `quiz-media/${other}/44444444-4444-4444-4444-444444444444.png`, alt: 'no' } } } as Question;
    const r = fromClipboard(toClipboard([withMedia, foreign], owner), owner, () => true);
    expect(r.ok && r.questions).toHaveLength(2);
    expect(r.ok && (r.questions[0]!.payload as any).media).toBeDefined(); expect(r.ok && (r.questions[1]!.payload as any).media).toBeUndefined();
    expect(r.ok && r.dropped).toEqual([(foreign.payload as any).media.ref]);
    expect(fromClipboard('hello', owner).ok).toBe(false);
    const gone = fromClipboard(toClipboard([withMedia], owner), owner, () => false); expect(gone.ok && gone.dropped).toHaveLength(1);
  });
  it('maps invalid fields to anchors without touching the other questions', () => {
    const bad = { ...mc('bad'), prompt: '' } as Question;
    const errs = fieldErrors([mc('ok'), bad]);
    expect(errs).toHaveLength(1); expect(errs[0]!.questionIndex).toBe(1); expect(errs[0]!.anchor).toBe('qf-1-prompt');
  });
});

describe('accessibility helpers (items 143, 150)', () => {
  it('computes WCAG contrast', () => { expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0); expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5); expect(readableOn('#1b1230')).toBe('#ffffff'); expect(readableOn('#ffd52f')).toBe('#1b1230'); });
  it('turns failures into plain language with a reference code and no stack trace', () => {
    const e = Object.assign(new Error('boom at /srv/app.js:10'), { status: 500 }); const p = plainError(e, 'ABCD1234');
    expect(p.retry).toBe(true); expect(p.id).toBe('ABCD1234'); expect(JSON.stringify(p)).not.toContain('/srv');
    expect(plainError(Object.assign(new Error('x'), { status: 403 })).retry).toBe(false);
    expect(correlationId(() => 0.5, 0)).toMatch(/^[0-9A-Z]{8}$/);
  });
});
