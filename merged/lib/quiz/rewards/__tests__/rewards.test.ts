import { balance, emptyCoins, post, weekKey, history, type Entry } from '../coins';
import { describe as describeStreak, emptyStreak, recordLearningDay } from '../streak';
import { dailyLearning, milestonesCrossed, qualifyReferral, qualifyTeaching, type TeachingFact } from '../eligibility';
import { releaseQuiet, weeklyProgress, type MissionEvent } from '../missions';
import type { SessionFact } from '../../learning';

const e = (o: Partial<Entry> & Pick<Entry, 'id'>): Entry => ({ at: '2026-10-21T10:00:00Z', day: '2026-10-21', kind: 'earn', source: 'daily_learning', amount: 20, ...o });
const ok = (r: ReturnType<typeof post>) => { if (!r.ok) throw new Error(r.code); return r.ledger; };

describe('coin ledger', () => {
  it('a replayed request never grants twice', () => { const a = ok(post(emptyCoins(), e({ id: 'x' }))); const b = post(a, e({ id: 'x' })); expect(b).toMatchObject({ ok: true, duplicate: true }); expect(balance(ok(b))).toBe(20); });
  it('enforces the daily and weekly caps and rejects non-earn sources', () => {
    const a = ok(post(emptyCoins(), e({ id: '1' }))); expect(post(a, e({ id: '2' }))).toMatchObject({ ok: false, code: 'DAILY_LIMIT' });
    expect(post(a, e({ id: '3', day: '2026-10-22' })).ok).toBe(true);
    let m = emptyCoins(); for (const [i, d] of ['2026-10-19', '2026-10-20', '2026-10-21'].entries()) m = ok(post(m, e({ id: `m${i}`, source: 'weekly_mission', amount: 10, day: d })));
    expect(post(m, e({ id: 'm9', source: 'weekly_mission', amount: 10, day: '2026-10-25' }))).toMatchObject({ code: 'WEEKLY_LIMIT' });
    expect(post(m, e({ id: 'm10', source: 'weekly_mission', amount: 10, day: '2026-10-26' })).ok).toBe(true); // next ISO week
    expect(post(emptyCoins(), e({ id: 'p', source: 'purchase' }))).toMatchObject({ ok: false, code: 'NOT_AN_EARN_SOURCE' });
    expect(post(emptyCoins(), e({ id: 'big', amount: 21 }))).toMatchObject({ code: 'OVER_CAP' });
  });
  it('spending needs funds, is cosmetic-only, and never goes negative', () => {
    const a = ok(post(emptyCoins(), e({ id: '1' })));
    expect(post(a, e({ id: 's', kind: 'spend', source: 'purchase', amount: 25 }))).toMatchObject({ ok: false, code: 'INSUFFICIENT_COINS' });
    expect(post(a, e({ id: 's', kind: 'spend', source: 'achievement', amount: 5 }))).toMatchObject({ code: 'NOT_A_SPEND_SOURCE' });
    expect(balance(ok(post(a, e({ id: 's', kind: 'spend', source: 'purchase', amount: 15 }))))).toBe(5);
  });
  it('refunds restore a purchase once; corrections cannot overdraw; amounts are whole and bounded', () => {
    let l = ok(post(emptyCoins(), e({ id: '1' }))); l = ok(post(l, e({ id: 's', kind: 'spend', source: 'purchase', amount: 15 })));
    l = ok(post(l, e({ id: 'r', kind: 'reversal', source: 'refund', amount: 15, reverses: 's' }))); expect(balance(l)).toBe(20);
    expect(post(l, e({ id: 'r2', kind: 'reversal', source: 'refund', amount: 15, reverses: 's' }))).toMatchObject({ code: 'ALREADY_REVERSED' });
    expect(post(l, e({ id: 'r3', kind: 'reversal', source: 'correction', amount: 20, reverses: 'zzz' }))).toMatchObject({ code: 'UNKNOWN_ENTRY' });
    const spent = ok(post(l, e({ id: 's2', kind: 'spend', source: 'purchase', amount: 20 })));
    expect(post(spent, e({ id: 'c', kind: 'reversal', source: 'correction', amount: 20, reverses: '1' }))).toMatchObject({ code: 'WOULD_OVERDRAW' });
    for (const amount of [0, -3, 1.5, 9999]) expect(post(emptyCoins(), e({ id: `a${amount}`, amount })).ok).toBe(false);
    expect(history(l)[0]!.id).toBeDefined();
  });
  it('week keys run Monday to Sunday', () => { expect(weekKey('2026-10-25')).toBe('2026-10-19'); expect(weekKey('2026-10-26')).toBe('2026-10-26'); });
});

describe('flexible streak', () => {
  const run = (days: string[], breaks: { from: string; to: string }[] = []) => days.reduce((s, d) => recordLearningDay(s, d, breaks), emptyStreak());
  it('counts consecutive learning days and ignores repeats and late events', () => { expect(run(['2026-10-19', '2026-10-19', '2026-10-20', '2026-10-21']).current).toBe(3); const s = run(['2026-10-20', '2026-10-21']); expect(recordLearningDay(s, '2026-10-19')).toBe(s); });
  it('forgives one missed day a week but not two in a row', () => {
    expect(run(['2026-10-19', '2026-10-21']).current).toBe(2);
    expect(run(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-23']).current).toBe(4);
    expect(run(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-17', '2026-10-19']).current).toBe(Math.floor(5 / 2) + 1); // second miss within 7 days → gentle recovery
  });
  it('school breaks are skipped, and a lapse halves rather than erases', () => {
    expect(run(['2026-12-18', '2027-01-05'], [{ from: '2026-12-19', to: '2027-01-04' }]).current).toBe(2);
    const long = run(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-20']); expect(long.current).toBe(4); expect(long.best).toBe(6);
  });
  it('describes a lapse as resting and can be hidden', () => { const s = run(['2026-10-01']); expect(describeStreak(s, '2026-10-21')).toMatch(/Resting/); expect(describeStreak({ ...s, hidden: true }, '2026-10-21')).toBe(''); });
});

describe('daily learning reward', () => {
  const fact = (o: Partial<SessionFact> = {}): SessionFact => ({ sessionId: 's1', quizId: 'q1', verified: true, answered: 5, distinctQuestions: 5, durationSeconds: 60, at: '2026-10-21T09:00:00Z', ...o });
  const day = (f: SessionFact) => f.at.slice(0, 10);
  it('needs a real, server-verified learning session — not a login', () => {
    expect(dailyLearning('2026-10-21', [], day, [])).toMatchObject({ eligible: false });
    expect(dailyLearning('2026-10-21', [fact({ verified: false })], day, [])).toMatchObject({ eligible: false });
    expect(dailyLearning('2026-10-21', [fact({ answered: 2, distinctQuestions: 2 })], day, [])).toMatchObject({ eligible: false });
    expect(dailyLearning('2026-10-21', [fact({ durationSeconds: 3 })], day, [])).toMatchObject({ eligible: false });
    expect(dailyLearning('2026-10-21', [fact()], day, [])).toMatchObject({ eligible: true, amount: 20 });
  });
  it('is once per day and ignores other days', () => { expect(dailyLearning('2026-10-21', [fact()], day, ['2026-10-21'])).toMatchObject({ eligible: false }); expect(dailyLearning('2026-10-22', [fact()], day, [])).toMatchObject({ eligible: false }); });
});

describe('qualifying teaching sessions', () => {
  const day = (iso: string) => iso.slice(0, 10);
  const t = (o: Partial<TeachingFact> = {}): TeachingFact => ({ sessionId: 'a', hostId: 'h', quizId: 'q', startedAt: '2026-10-21T01:00:00Z', endedAt: '2026-10-21T01:30:00Z', serverConfirmed: true, advances: 10, distinctQuestions: 10, adjudicated: 10, activeSeconds: 1500, pausedSeconds: 200, idleSeconds: 60, ...o });
  it('accepts a genuine class on a shared projector', () => expect(qualifyTeaching(t(), [], day)).toEqual({ ok: true }));
  it.each([
    ['unconfirmed', { serverConfirmed: false }], ['too few questions', { distinctQuestions: 3 }], ['no marking', { adjudicated: 0 }], ['idle tab', { activeSeconds: 100 }],
    ['rapid-fire', { advances: 100, distinctQuestions: 100, adjudicated: 100, activeSeconds: 600 }], ['forged long time', { activeSeconds: 9999 }], ['backwards clock', { endedAt: '2026-10-21T00:00:00Z' }],
  ])('rejects %s', (_n, o) => expect(qualifyTeaching(t(o as Partial<TeachingFact>), [], day).ok).toBe(false));
  it('rejects overlap, a quick repeat of the same quiz, and a fourth session in a day', () => {
    expect(qualifyTeaching(t({ sessionId: 'b', quizId: 'other', startedAt: '2026-10-21T01:20:00Z', endedAt: '2026-10-21T01:50:00Z' }), [t()], day).ok).toBe(false);
    expect(qualifyTeaching(t({ sessionId: 'b', startedAt: '2026-10-21T01:40:00Z', endedAt: '2026-10-21T02:10:00Z' }), [t()], day).reason).toMatch(/same quiz/);
    const h = ['03', '06', '09'].map((x, i) => t({ sessionId: `h${i}`, quizId: `q${i}`, startedAt: `2026-10-21T${x}:00:00Z`, endedAt: `2026-10-21T${x}:30:00Z` }));
    expect(qualifyTeaching(t({ sessionId: 'z', quizId: 'qz', startedAt: '2026-10-21T12:00:00Z', endedAt: '2026-10-21T12:30:00Z' }), h, day).reason).toMatch(/already counted today/);
  });
  it('reports milestones crossed exactly once', () => { expect(milestonesCrossed(0, 1)).toEqual([1]); expect(milestonesCrossed(4, 5)).toEqual([5]); expect(milestonesCrossed(5, 5)).toEqual([]); expect(milestonesCrossed(0, 11)).toEqual([1, 5, 10]); });
});

describe('referrals and missions', () => {
  const r = { referrerId: 'a', refereeId: 'b', refereeIsTeacher: true, refereeIsMinor: false, refereeQualifiedSessions: 1, sameDevice: false, rewardedThisYear: 0, alreadyRewarded: false };
  it('blocks self, same-device, minors, duplicates, unqualified and over-cap referrals', () => {
    expect(qualifyReferral(r).ok).toBe(true);
    for (const o of [{ refereeId: 'a' }, { sameDevice: true }, { refereeIsMinor: true }, { refereeIsTeacher: false }, { alreadyRewarded: true }, { refereeQualifiedSessions: 0 }, { rewardedThisYear: 10 }]) expect(qualifyReferral({ ...r, ...o }).ok).toBe(false);
  });
  it('missions count each event once, stay in the week and never exceed the weekly coin cap', () => {
    const ev = [...'abc'].map((c) => ({ id: c, mission: 'finish_three_quizzes' as const, day: '2026-10-21' }));
    const p = weeklyProgress([...ev, ev[0]!, { id: 'old', mission: 'create_a_quiz', day: '2026-10-12' }], '2026-10-21', 'teacher');
    expect(p.find((x) => x.mission.id === 'finish_three_quizzes')).toMatchObject({ progress: 3, done: true, payable: 15 }); expect(p.find((x) => x.mission.id === 'create_a_quiz')!.done).toBe(false);
    expect(p.some((x) => x.mission.id === 'fix_three_mistakes')).toBe(false);
    const all = weeklyProgress([...'abc'].map((c): MissionEvent => ({ id: c, mission: 'finish_three_quizzes', day: '2026-10-21' })).concat([{ id: 'd', mission: 'try_new_format', day: '2026-10-21' }, { id: 'e', mission: 'create_a_quiz', day: '2026-10-21' }]), '2026-10-21', 'teacher');
    expect(all.reduce((n, x) => n + x.payable, 0)).toBeLessThanOrEqual(40);
  });
  it('quiet notifications wait for the question to end', () => { expect(releaseQuiet(['a', 'b'], { questionOpen: true })).toEqual({ show: [], keep: ['a', 'b'] }); expect(releaseQuiet([1, 2, 3, 4], { questionOpen: false })).toEqual({ show: [1, 2, 3], keep: [4] }); });
});
