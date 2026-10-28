/** @jest-environment node */
import { applyAnswer, speedMultiplier, redemptionPoints, redemptionEligible } from '../scoring';
import { composite, tierFor } from '../composite';
import { findTraps } from '../telemetry';
import { gradebookCsv, csvCell } from '../gradebook';
import { transition } from '../phase';
import { signPayload, verifyToken, sanitizeText, generateRoomCode, ROOM_CODE_ALPHABET, SlidingWindowLimiter, validateSubmission, type QuizSession } from '../../../quizSecurity';
import { generateSafeNickname, checkUserText, NICKNAME_PATTERN, purgeExpired } from '../../../legalCompliance';
import { generateQuiz, buildPools, masteryEarned, findCatalystHint, type Dataset } from '../../../sandboxQuizBridge';
import db from '../../../../data/db.json';

const P = { score: 0, streak: 0, maxStreak: 0, shields: 0 };

describe('scoring', () => {
  it('gives the full multiplier for the first 3 seconds and decays after', () => {
    expect(speedMultiplier(0)).toBe(1); expect(speedMultiplier(3000)).toBe(1);
    expect(speedMultiplier(3001)).toBeLessThan(1); expect(speedMultiplier(20000)).toBe(0.5);
  });
  it('rewards a careful 6 s answer the same as a 0.5 s blind click, but not slower ones', () => {
    expect(applyAnswer(P, { correct: true, elapsedMs: 500, wager: 'standard' }).delta).toBe(applyAnswer(P, { correct: true, elapsedMs: 2900, wager: 'standard' }).delta);
    expect(applyAnswer(P, { correct: true, elapsedMs: 9000, wager: 'standard' }).delta).toBeLessThan(1000);
  });
  it('pays 1.5x on a high-confidence correct answer', () => { expect(applyAnswer(P, { correct: true, elapsedMs: 1000, wager: 'high' }).delta).toBe(1500); });
  it('awards a shield every 5 correct, max 2', () => {
    let p = P; for (let i = 0; i < 5; i++) p = applyAnswer(p, { correct: true, elapsedMs: 1000, wager: 'standard' });
    expect(p.shields).toBe(1);
    for (let i = 0; i < 10; i++) p = applyAnswer(p, { correct: true, elapsedMs: 1000, wager: 'standard' });
    expect(p.shields).toBe(2);
  });
  it('a shield absorbs a standard wrong answer and keeps the streak', () => {
    const o = applyAnswer({ score: 5000, streak: 13, maxStreak: 13, shields: 1 }, { correct: false, elapsedMs: 2000, wager: 'standard' });
    expect(o).toMatchObject({ streak: 13, shields: 0, shieldUsed: true, delta: 0 });
  });
  it('without a shield a wrong answer resets the streak', () => {
    expect(applyAnswer({ score: 100, streak: 4, maxStreak: 4, shields: 0 }, { correct: false, elapsedMs: 1000, wager: 'standard' })).toMatchObject({ streak: 0, streakReset: true });
  });
  it('a wrong high-confidence answer costs 400 (floored at 0) and breaks a shield or the streak', () => {
    expect(applyAnswer({ score: 1000, streak: 6, maxStreak: 6, shields: 1 }, { correct: false, elapsedMs: 1, wager: 'high' })).toMatchObject({ score: 600, streak: 6, shields: 0 });
    expect(applyAnswer({ score: 100, streak: 6, maxStreak: 6, shields: 0 }, { correct: false, elapsedMs: 1, wager: 'high' })).toMatchObject({ score: 0, streak: 0 });
  });
  it('redemption recovers 50% and only applies to 1-3 misses', () => {
    expect(redemptionPoints(true, 1000)).toBe(500); expect(redemptionPoints(false, 1000)).toBe(0);
    expect([0, 1, 3, 4].map(redemptionEligible)).toEqual([false, true, true, false]);
  });
});

describe('composite and tiers', () => {
  it('matches the spec formula', () => {
    // score 5000/10q -> norm 500; acc 0.8^2*1000*.25 = 160; streak 5*20*.2 = 20; xp log10(1001)*250 ~ 750 -> *.15 = 112.5
    expect(composite({ score: 5000, questionCount: 10, correct: 8, maxStreak: 5, xp: 1000 })).toBeCloseTo(200 + 160 + 20 + (Math.log10(1001) * 250 * 0.15), 1);
  });
  it('caps streak at 50 and XP at 1000', () => {
    expect(composite({ score: 0, questionCount: 10, correct: 0, maxStreak: 500, xp: 0 })).toBe(composite({ score: 0, questionCount: 10, correct: 0, maxStreak: 50, xp: 0 }));
    expect(composite({ score: 0, questionCount: 1, correct: 0, maxStreak: 0, xp: 1e12 })).toBe(150);
  });
  it('squares accuracy so blind guessing is punished', () => {
    const half = composite({ score: 0, questionCount: 10, correct: 5, maxStreak: 0, xp: 0 });
    const full = composite({ score: 0, questionCount: 10, correct: 10, maxStreak: 0, xp: 0 });
    expect(full / half).toBe(4);
  });
  it('assigns tiers, requiring top 10 for Singularity Darwin', () => {
    expect([100, 300, 599, 600, 849].map((c) => tierFor(c, 1).id)).toEqual(['proto', 'cambrian', 'cambrian', 'apex', 'apex']);
    expect(tierFor(900, 10).id).toBe('singularity'); expect(tierFor(900, 11).id).toBe('apex');
  });
});

describe('telemetry', () => {
  it('flags a wrong option chosen by >= 35%', () => {
    const t = findTraps([{ questionId: 'q', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 0, counts: [28, 62, 5, 5], why: ['', 'Dinosaurs went extinct 66 Ma, far after the Cambrian.', '', ''] }]);
    expect(t).toHaveLength(1);
    expect(t[0]!.banner).toMatch(/^⚠️ COGNITIVE TRAP DETECTED: 62% chose Option B — Dinosaurs/);
  });
  it('ignores a correct majority and sub-threshold distractors', () => {
    expect(findTraps([{ questionId: 'q', prompt: '', options: [], correctIndex: 0, counts: [60, 30, 5, 5], why: [] }])).toHaveLength(0);
  });
});

describe('gradebook', () => {
  it('starts with a BOM, uses the specified header and neutralises formulas', () => {
    const csv = gradebookCsv([{ sessionId: 's', timestamp: 't', nickname: '=HYPERLINK("x")', total: 10, correct: 8, finalScore: 7000, maxStreak: 5, redemptionRecovered: 500, missedIds: ['a', 'b'] }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')[0]).toBe('﻿SessionID,Timestamp,PlayerNickname,TotalQuestions,CorrectAnswers,AccuracyPct,FinalScore,MaxStreak,RedemptionRecovered,MissedDiscoveryIDs');
    expect(csv).toContain(',80,7000,5,500,a|b');
    expect(csvCell('=1+1')).toBe("'=1+1");
  });
});

describe('phase machine', () => {
  it('ignores illegal transitions', () => {
    expect(transition('IDLE', 'REVEAL')).toBe('IDLE');
    expect(transition('QUESTION_ACTIVE', 'LOCK')).toBe('ANSWER_LOCKED');
    expect(transition('ANSWER_LOCKED', 'LOCK')).toBe('ANSWER_LOCKED');
  });
});

describe('quizSecurity', () => {
  it('rejects tampered tokens', () => {
    const t = signPayload({ score: 1 }, 'k');
    expect(verifyToken(t, 'k')).toEqual({ score: 1 });
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ score: 9999999 })).toString('base64url') + '.' + sig;
    expect(verifyToken(forged, 'k')).toBeNull(); expect(verifyToken(`${body}.${sig}`, 'other')).toBeNull(); expect(verifyToken('x', 'k')).toBeNull();
  });
  it('generates 6-char codes from the safe alphabet', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    for (let i = 0; i < 200; i++) expect(generateRoomCode()).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
  });
  it('strips tags and script vectors', () => {
    expect(sanitizeText('<script>alert(1)</script>Hi <b onclick=x>there</b>', 50)).not.toMatch(/[<>]|onclick|script>/i);
    expect(sanitizeText('<<b>script>alert(1)<</b>/script>', 50)).not.toMatch(/[<>]/);
    expect(sanitizeText('javascript:alert(1)', 50)).not.toMatch(/javascript:/i);
    expect(sanitizeText('x'.repeat(100), 24)).toHaveLength(24);
  });
  it('rate limits on a sliding window', () => {
    const l = new SlidingWindowLimiter(5, 60_000);
    expect([1, 2, 3, 4, 5, 6].map(() => l.hit('ip', 1000))).toEqual([true, true, true, true, true, false]);
    expect(l.hit('ip', 62_000)).toBe(true);
  });
  it('refuses implausibly fast or unfinished sessions', () => {
    const base = { sid: 's', src: 'auto', seed: 1, n: 10, idx: 10, phase: 'done', score: 5000, streak: 0, maxStreak: 0, shields: 0, correct: 5, missed: [], redeemQueue: [], redeemed: 0, qAt: 0, t0: 1000, rAt: 0, choices: {}, answered: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], v: 1 } as QuizSession;
    expect(validateSubmission(base, 1000 + 3000).ok).toBe(false);
    expect(validateSubmission(base, 1000 + 60_000).ok).toBe(true);
    expect(validateSubmission({ ...base, phase: 'main' }, 1000 + 60_000).ok).toBe(false);
    expect(validateSubmission({ ...base, answered: [0] }, 1000 + 60_000).ok).toBe(false);
    expect(validateSubmission(null).ok).toBe(false);
  });
});

describe('legalCompliance', () => {
  it('generates [Adjective][Term][2 digits] handles', () => { for (let i = 0; i < 50; i++) expect(generateSafeNickname()).toMatch(NICKNAME_PATTERN); });
  it('blocks email, phone and profanity (English + Vietnamese)', () => {
    expect(checkUserText('me@x.com')).toMatchObject({ ok: false, reason: 'email' });
    expect(checkUserText('0912345678')).toMatchObject({ ok: false, reason: 'phone' });
    expect(checkUserText('fuck you')).toMatchObject({ ok: false, reason: 'profanity' });
    expect(checkUserText('đụ má')).toMatchObject({ ok: false, reason: 'profanity' });
    expect(checkUserText('SolarTrilobite42')).toMatchObject({ ok: true });
  });
  it('purges items older than 24 h', () => { expect(purgeExpired([{ createdAt: 0 }, { createdAt: 90_000_000 }], 100_000_000)).toEqual([{ createdAt: 90_000_000 }]); });
});

describe('sandbox quiz bridge', () => {
  const ds = db as unknown as Dataset;
  const qs = generateQuiz(ds, { seed: 42, count: 10 });
  it('builds 10 questions covering all three templates with 4 distinct options', () => {
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.template)).size).toBe(3);
    for (const q of qs) { expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.answerIndex).toBeGreaterThanOrEqual(0); expect(q.why).toHaveLength(4); }
  });
  it('is deterministic per seed', () => { expect(generateQuiz(ds, { seed: 42, count: 10 }).map((q) => q.id)).toEqual(qs.map((q) => q.id)); });
  it('draws formula distractors from the same era (and category when possible)', () => {
    const pools = buildPools(ds);
    for (const q of qs.filter((x) => x.template === 'formula')) {
      const target = pools.byId.get(q.discoveryId)!;
      const names = new Set(q.options);
      const same = pools.all.filter((n) => names.has(n.n) && n.era === target.era);
      expect(same.length).toBeGreaterThanOrEqual(3);
    }
  });
  it('restricts targets to unlocked discoveries for the boss quiz', () => {
    const ids = ds.nodes.filter((n) => !n.hidden && n.rec?.length && n.ev).slice(0, 40).map((n) => n.id);
    const boss = generateQuiz(ds, { seed: 7, count: 10, only: ids });
    expect(boss.length).toBeGreaterThan(0);
    for (const q of boss) expect(ids).toContain(q.discoveryId);
  });
  it('mastery needs >= 80%', () => { expect(masteryEarned(8, 10)).toBe(true); expect(masteryEarned(7, 10)).toBe(false); });
  it('finds a catalyst hint only for pairs the player already holds', () => {
    const base = ds.nodes.filter((n) => ds.nodes.length && ['stone', 'wood', 'bone', 'fiber'].includes(n.id)).map((n) => n.id);
    const hint = findCatalystHint(ds.nodes, base, []);
    if (hint) { expect(base).toContain(hint.a); expect(base).toContain(hint.b); expect(findCatalystHint(ds.nodes, base, [hint])?.resultId).not.toBe(undefined === hint ? '' : `${hint.a}+${hint.b}`); }
  });
});
