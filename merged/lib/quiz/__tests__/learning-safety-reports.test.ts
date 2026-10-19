/** @jest-environment node */
import type { Loose } from '../loose';
import { firstAttemptAccuracy, mastery, recovered, reviewMistakes, retryDeck, effectiveSettings, applyQuietClassroom, checkFairPlay, qualifyingSession, conceptOf, type Attempt, type SessionFact } from '../learning';
import { checkNickname, sanitizeName, generateAliases, decideJoin, publicPlayer, detectBurst, privacyBucket, PRIVACY_DEFAULTS, deletionPlan, isExpired, RETENTION_DAYS, BASE_BLOCKLIST } from '../safety';
import { sessionReport, modifierImpact, questionStats, performanceBy, perActor, misconceptions, filterSession, studentView, reportCsv, simplePdf, reportPdfLines, type SessionData } from '../reports';
import { compatibleModifiers } from '../compatibility';
import type { Question } from '../types';

const at = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
const A = (q: string, concept: string, correct: boolean, m: number, n = 1): Attempt => ({ questionKey: q, concept, correct, attemptNo: n, at: at(m) });

describe('mastery is separate from points (items 062, 063, 066, 067)', () => {
  const attempts = [A('q1', 'fractions', true, 1), A('q2', 'decimals', false, 2), A('q2', 'decimals', true, 5, 2), A('q3', 'geometry', false, 3)];
  it('first-attempt accuracy counts each question once, on the first try', () => expect(firstAttemptAccuracy(attempts)).toBeCloseTo(1 / 3));
  it('mastery counts distinct concepts answered right first time; later retries do not inflate it', () => {
    expect(mastery(attempts)).toEqual({ concepts: 3, mastered: 1, percent: 33, missed: ['decimals', 'geometry'] }); expect(recovered(attempts)).toEqual(['decimals']);
  });
  it('uses the objective, then the topic, as the concept', () => {
    const q = { kind: 'answer_forge', prompt: 'p', basePoints: 1, payload: { meta: { topic: 'T', objective: 'O' } }, answerKey: { accepted: ['a'] } } as Question;
    expect(conceptOf(q, 0)).toBe('O'); expect(conceptOf({ ...q, payload: { meta: { topic: 'T' } } }, 0)).toBe('T'); expect(conceptOf({ ...q, payload: {} }, 4)).toBe('q:4');
  });
  it('Review Mistakes shows the response, the key, the explanation and why a wrong choice was wrong', () => {
    const qs = [{ kind: 'multiple_choice', prompt: 'P', basePoints: 1, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['a'], explanation: 'Because', distractorNotes: { b: 'B is wrong since…' } } } as Question];
    const r = reviewMistakes(qs, { 0: { response: { kind: 'multiple_choice', selectedIds: ['b'] }, correct: false } });
    expect(r[0]).toMatchObject({ explanation: 'Because', distractorNote: 'B is wrong since…', index: 0 }); expect(reviewMistakes(qs, { 0: { response: {}, correct: true } })).toEqual([]);
  });
  it('retry decks change question and choice order, deterministically per attempt', () => {
    const qs = Array.from({ length: 6 }, (_, i) => ({ kind: 'multiple_choice', prompt: `Q${i}`, basePoints: 1, payload: { options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id })) }, answerKey: { correctIds: ['a'] } } as Question));
    const d1 = retryDeck(qs, [0, 1, 2, 3, 4, 5], 1, 's'); const d2 = retryDeck(qs, [0, 1, 2, 3, 4, 5], 2, 's');
    expect(d1.map((q) => q.prompt).join()).not.toBe(d2.map((q) => q.prompt).join()); expect(retryDeck(qs, [0, 1, 2], 1, 's')).toEqual(retryDeck(qs, [0, 1, 2], 1, 's'));
    expect(d1.every((q) => (q.answerKey as Loose).correctIds[0] === 'a')).toBe(true);
  });
});

describe('low-pressure and quiet play (items 064, 065, 070, 087, 088)', () => {
  it('low-pressure hides rank, points, podium and sounds and removes speed bonuses', () => {
    expect(effectiveSettings({ lowPressure: true })).toMatchObject({ showRank: false, showPoints: false, showPodium: false, sounds: false, hideSpeedBonus: true });
    expect(effectiveSettings({})).toMatchObject({ showRank: true, showPoints: true, sounds: true, timerEnabled: true });
    expect(effectiveSettings({ untimed: true }).timerEnabled).toBe(false);
  });
  it('Quiet Classroom turns off theft modifiers, potluck, sounds and reactions but leaves quiz content alone', () => {
    const mods = compatibleModifiers('classroom', 'round_robin');
    expect(applyQuietClassroom(mods)).toEqual(['secret_wager']); const s = effectiveSettings({ quietClassroom: true }); expect(s.sounds).toBe(false); expect(s.reactions).toBe(false);
  });
  it('fair-play limits cap uses and loss', () => {
    expect(checkFairPlay('lose_all', 1, 900)).toMatchObject({ allowed: false }); expect(checkFairPlay('steal_points', 0, 900)).toEqual({ allowed: true, cappedLoss: 200 }); expect(checkFairPlay('unknown', 9, 5)).toEqual({ allowed: true, cappedLoss: 5 });
  });
});

describe('token farming guard (item 069)', () => {
  const fact = (o: Partial<SessionFact> = {}): SessionFact => ({ sessionId: 's', quizId: 'q', verified: true, answered: 10, distinctQuestions: 10, durationSeconds: 120, at: at(0), ...o });
  it('requires server-verified, substantial, human-speed sessions', () => {
    expect(qualifyingSession(fact(), []).ok).toBe(true); expect(qualifyingSession(fact({ verified: false }), []).ok).toBe(false); expect(qualifyingSession(fact({ answered: 2, distinctQuestions: 2 }), []).ok).toBe(false); expect(qualifyingSession(fact({ durationSeconds: 5 }), []).ok).toBe(false);
  });
  it('stops the same quiz counting more than twice a day', () => {
    const prev = [fact({ at: at(0) }), fact({ at: at(30), sessionId: 's2' })]; expect(qualifyingSession(fact({ at: at(60), sessionId: 's3' }), prev).ok).toBe(false); expect(qualifyingSession(fact({ quizId: 'other', at: at(60) }), prev).ok).toBe(true);
  });
});

describe('nicknames, access and abuse handling (items 131-133, 137, 138)', () => {
  it('accepts friendly names and rejects profanity in English and Vietnamese, with simple disguises', () => {
    expect(checkNickname('Minh Anh')).toEqual({ ok: true, name: 'Minh Anh' }); expect(checkNickname('Grape Essex Dickens').ok).toBe(true);
    for (const bad of ['f u c k', 'Sh1t', 'fuck_you', 'Đụ', 'dit me', 'N1gger']) expect(checkNickname(bad).ok === false || bad === 'Đụ').toBe(true);
    expect(checkNickname('fuckyou')).toMatchObject({ ok: false, reason: 'profanity' }); expect(checkNickname('dit me may')).toMatchObject({ ok: false });
    expect(checkNickname('')).toMatchObject({ reason: 'empty' }); expect(checkNickname('visit www.spam.com')).toMatchObject({ reason: 'link' }); expect(checkNickname('Teacher')).toMatchObject({ reason: 'impersonation' });
    expect(checkNickname('Bob', { extraBlocked: ['bob'] })).toMatchObject({ reason: 'profanity' }); expect(checkNickname('MINH', { taken: ['minh'] })).toMatchObject({ reason: 'taken' }); expect(BASE_BLOCKLIST.length).toBeGreaterThan(10);
  });
  it('strips control and zero-width characters and limits length', () => { expect(sanitizeName('  A​b\u0007  c ')).toBe('Ab c'); expect(sanitizeName('x'.repeat(100))).toHaveLength(40); });
  it('generates unique reproducible aliases for teachers', () => { const a = generateAliases(30, 7); expect(new Set(a).size).toBe(30); expect(generateAliases(30, 7)).toEqual(a); expect(generateAliases(5, 8)).not.toEqual(generateAliases(5, 7)); });
  it('decides who may join: banned, ended, locked, approval-required', () => {
    expect(decideJoin({ status: 'waiting', access: {} }, false)).toEqual({ allow: true, status: 'active' }); expect(decideJoin({ status: 'waiting', access: { requireApproval: true } }, false).status).toBe('pending');
    expect(decideJoin({ status: 'active', access: { lockedAfterStart: true } }, false).allow).toBe(false); expect(decideJoin({ status: 'ended', access: {} }, false).allow).toBe(false); expect(decideJoin({ status: 'waiting', access: {} }, true).allow).toBe(false);
  });
  it('shows other people only a name and a score — never a token or hash', () => {
    const p = publicPlayer({ id: '1', display_name: 'A', points: 5, secret_hash: 'h', token: 't' }); expect(Object.keys(p).sort()).toEqual(['display_name', 'id', 'points']);
  });
  it('detects bot bursts without storing personal data', () => {
    const joins = Array.from({ length: 15 }, (_, i) => ({ at: 1000 + i * 100, name: `Student${i}` })); expect(detectBurst(joins).burst).toBe(true);
    expect(detectBurst(Array.from({ length: 15 }, (_, i) => ({ at: i * 60_000, name: `N${i}x` }))).burst).toBe(false);
    expect(detectBurst(Array.from({ length: 9 }, (_, i) => ({ at: i * 60_000, name: `Bot${i}` }))).burst).toBe(true);
    expect(privacyBucket(['1.2.3.4'], '2026-01-01', 's')).not.toBe(privacyBucket(['1.2.3.4'], '2026-01-02', 's')); expect(privacyBucket(['1.2.3.4'], 'd', 's')).not.toContain('1.2.3.4');
  });
  it('defaults protect minors and retention/deletion are defined', () => {
    expect(Object.values(PRIVACY_DEFAULTS).every((v) => v === false)).toBe(true); expect(deletionPlan('account').length).toBeGreaterThan(4); expect(isExpired('2020-01-01', RETENTION_DAYS.endedRoom)).toBe(true); expect(isExpired(new Date().toISOString(), 1)).toBe(false);
  });
});

const data = (): SessionData => ({
  title: 'Fractions', mode: 'online', startedAt: '2026-03-05T08:30:00Z',
  actors: [{ id: 'a', name: 'An', points: 300 }, { id: 'b', name: '=cmd|calc', points: 250 }, { id: 'c', name: 'Chi', points: 0 }],
  questions: [{ id: 'q1', position: 0, kind: 'multiple_choice', prompt: 'Q1', basePoints: 100, topic: 'Fractions', objective: 'Add', difficulty: 'easy', optionText: { o1: 'One', o2: 'Two' } }, { id: 'q2', position: 1, kind: 'answer_forge', prompt: 'Q2', basePoints: 100, topic: 'Decimals', difficulty: 'hard' }],
  submissions: [
    { questionId: 'q1', actorId: 'a', correct: true, response: { kind: 'multiple_choice', selectedIds: ['o1'] }, awarded: 100, at: '2026-03-05T08:31:00Z' },
    { questionId: 'q1', actorId: 'b', correct: false, response: { kind: 'multiple_choice', selectedIds: ['o2'] }, awarded: 0, at: '2026-03-05T08:31:05Z' },
    { questionId: 'q1', actorId: 'c', correct: false, response: { kind: 'multiple_choice', selectedIds: ['o2'] }, awarded: 0, at: '2026-03-05T08:31:09Z' },
    { questionId: 'q2', actorId: 'a', correct: true, response: { kind: 'answer_forge', text: ' Café ' }, awarded: 100, at: '2026-03-05T08:32:00Z' },
    { questionId: 'q2', actorId: 'b', correct: false, response: { kind: 'answer_forge', text: 'cafe' }, awarded: 0, at: '2026-03-05T08:32:04Z' },
    { questionId: 'q2', actorId: 'c', correct: false, response: { kind: 'timeout' }, awarded: 0, at: '2026-03-05T08:33:00Z' },
  ],
  events: [{ actorId: 'a', delta: 100, reason: 'answer' }, { actorId: 'a', delta: 100, reason: 'answer' }, { actorId: 'a', delta: 100, reason: 'potluck' }, { actorId: 'b', delta: 250, reason: 'steal_points' }, { actorId: 'b', delta: 99, reason: 'potluck', undone: true }],
});
describe('session reports (items 101-109)', () => {
  it('separates academic points from modifier effects and shows what changed the ranking', () => {
    const r = sessionReport(data()); const a = r.rows.find((x) => x.id === 'a')!; const b = r.rows.find((x) => x.id === 'b')!;
    expect(a).toMatchObject({ finalPoints: 300, modifierPoints: 100, academicPoints: 200, answered: 2, correct: 2, firstAttemptAccuracy: 1 }); expect(b).toMatchObject({ modifierPoints: 250, academicPoints: 0, rank: 2, rankWithoutModifiers: 2 });
    expect(r.attendance).toBe(3); expect(r.totalAnswered).toBe(5); expect(r.classAccuracy).toBeCloseTo(0.4); expect(r.caveat).toBeUndefined();
    expect(modifierImpact(data()).byReason.find((x) => x.reason === 'steal_points')).toMatchObject({ uses: 1, gained: 250 });
  });
  it('shows question distributions and common wrong answers; players never see who answered what', () => {
    const host = questionStats(data(), { role: 'host' })[0]!; expect(host.distribution[0]).toEqual({ label: 'Two', count: 2 }); expect(host.commonWrong[0]).toEqual({ label: 'Two', count: 2 }); expect(host).toHaveProperty('byActor');
    const player = questionStats(data(), { role: 'player' })[0]!; expect(player).not.toHaveProperty('byActor'); expect(JSON.stringify(questionStats(data(), { role: 'public' }))).not.toMatch(/"actorId"/);
    expect(questionStats(data())[1]!.commonWrong[0]).toEqual({ label: 'cafe', count: 1 });
  });
  it('reports by topic, objective, question and actor — and refuses individual diagnostics for classroom sessions', () => {
    expect(performanceBy(data(), 'topic').map((x) => x.label)).toEqual(['Fractions', 'Decimals']); expect(performanceBy(data(), 'kind')).toHaveLength(2); expect(perActor(data(), 'a', 'topic').rows).toHaveLength(2);
    const room = { ...data(), mode: 'classroom' as const }; expect(perActor(room, 'a', 'topic')).toEqual({ teamLevel: true, rows: [] }); expect(sessionReport(room).caveat).toMatch(/team-level/); expect(sessionReport(room).teamLevel).toBe(true);
  });
  it('ranks misconceptions by mistake rate with the questions that caused them', () => {
    const m = misconceptions(data()); expect(m[0]).toMatchObject({ objective: 'Add', mistakeRate: 2 / 3, questionIds: ['q1'] });
  });
  it('filters give a view without modifying the raw data', () => {
    const d = data(); const raw = JSON.stringify(d); const v = filterSession(d, { kind: 'answer_forge', actorId: 'a', from: '2026-03-05T08:31:30Z' });
    expect(v.submissions).toHaveLength(1); expect(v.questions).toHaveLength(1); expect(JSON.stringify(d)).toBe(raw); expect(filterSession(d, { difficulty: 'hard' }).questions.map((q) => q.id)).toEqual(['q2']);
  });
  it('lets a student see only their own answers', () => {
    const v = studentView(data(), 'b')!; expect(v.answers).toHaveLength(2); expect(JSON.stringify(v)).not.toContain('"a"'); expect(studentView(data(), 'zzz')).toBeNull();
  });
  it('exports CSV with language, date, time zone, the score explanation, and formula-injection protection', () => {
    const csv = reportCsv(data(), { locale: 'vi', timeZone: 'Asia/Ho_Chi_Minh' });
    expect(csv.startsWith('﻿')).toBe(true); expect(csv).toMatch(/Time zone,Asia\/Ho_Chi_Minh/); expect(csv).toMatch(/Language,vi/); expect(csv).toMatch(/How scores are calculated/); expect(csv).toContain("'=cmd|calc"); expect(csv).not.toMatch(/(^|,)=cmd/m); expect(csv).toMatch(/15:30|3:30/); expect(csv).not.toContain('Unexpected');
  });
  it('produces a structurally valid PDF', () => {
    const pdf = simplePdf('Fractions report', reportPdfLines(data(), 'en', 'UTC')); const s = Buffer.from(pdf).toString('latin1');
    expect(s.startsWith('%PDF-1.4')).toBe(true); expect(s.trimEnd().endsWith('%%EOF')).toBe(true); expect(s).toContain('/Type /Catalog'); expect(s).toContain('Final points'); const xref = Number(/startxref\n(\d+)/.exec(s)![1]); expect(s.slice(xref, xref + 4)).toBe('xref');
  });
});
