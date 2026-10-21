/** Eligibility rules for the daily learning reward, qualifying teaching sessions, teacher milestones and referrals. Every input is a SERVER-CONFIRMED fact; nothing here trusts a client timer. Pure. */
import { qualifyingSession, type SessionFact } from '../learning';
import { weekKey } from './coins';

export const DAILY_AMOUNT = 20;
export function dailyLearning(day: string, today: readonly SessionFact[], dayOfFact: (f: SessionFact) => string, alreadyGrantedDays: readonly string[]) {
  if (alreadyGrantedDays.includes(day)) return { eligible: false as const, reason: 'Today’s reward was already collected. A new one is available tomorrow after you learn something.' };
  const earlier: SessionFact[] = [];
  for (const f of [...today].sort((a, b) => a.at.localeCompare(b.at))) {
    if (dayOfFact(f) !== day) continue;
    const q = qualifyingSession(f, earlier); earlier.push(f); if (q.ok) return { eligible: true as const, amount: DAILY_AMOUNT, sessionId: f.sessionId };
  }
  return { eligible: false as const, reason: 'Finish a quiz with at least three questions to unlock today’s reward. Opening the app does not count.' };
}

export type TeachingFact = {
  sessionId: string; hostId: string; quizId: string; startedAt: string; endedAt: string; serverConfirmed: boolean;
  advances: number; distinctQuestions: number; adjudicated: number; activeSeconds: number; pausedSeconds: number; idleSeconds: number;
};
export const TEACHING = { minQuestions: 5, minActiveSeconds: 480, minSecondsPerQuestion: 10, maxPerDay: 3, repeatQuizMinutes: 60, milestones: [1, 5, 10, 25, 50, 100] } as const;
const ms = (s: string) => Date.parse(s);
/** A live class on one shared projector qualifies without any student account. A tab left open does not: it needs teacher-controlled advances, graded answers and real active time. */
export function qualifyTeaching(f: TeachingFact, history: readonly TeachingFact[], dayOf: (iso: string) => string): { ok: boolean; reason?: string } {
  if (!f.serverConfirmed) return { ok: false, reason: 'the server did not confirm this session' };
  const wall = (ms(f.endedAt) - ms(f.startedAt)) / 1000;
  if (!(wall > 0)) return { ok: false, reason: 'the session has no valid duration' };
  if (f.activeSeconds + f.pausedSeconds + f.idleSeconds > wall + 5 || f.activeSeconds > wall) return { ok: false, reason: 'the time claimed is longer than the session lasted' };
  if (f.distinctQuestions < TEACHING.minQuestions || f.advances < TEACHING.minQuestions) return { ok: false, reason: `fewer than ${TEACHING.minQuestions} questions were taught` };
  if (f.adjudicated < TEACHING.minQuestions) return { ok: false, reason: 'answers were not marked during the session' };
  if (f.activeSeconds < TEACHING.minActiveSeconds) return { ok: false, reason: 'less than 8 minutes of active teaching (idle time and pauses do not count)' };
  if (f.activeSeconds / f.advances < TEACHING.minSecondsPerQuestion) return { ok: false, reason: 'questions were advanced faster than a class could answer' };
  const mine = history.filter((h) => h.hostId === f.hostId && h.sessionId !== f.sessionId);
  if (mine.some((h) => ms(h.startedAt) < ms(f.endedAt) && ms(f.startedAt) < ms(h.endedAt))) return { ok: false, reason: 'it overlaps another session of yours' };
  if (mine.some((h) => h.quizId === f.quizId && Math.abs(ms(f.startedAt) - ms(h.endedAt)) < TEACHING.repeatQuizMinutes * 60_000)) return { ok: false, reason: 'the same quiz was just taught' };
  if (mine.filter((h) => dayOf(h.startedAt) === dayOf(f.startedAt)).length >= TEACHING.maxPerDay) return { ok: false, reason: `${TEACHING.maxPerDay} qualifying sessions already counted today` };
  return { ok: true };
}
/** Milestones reached when the qualified count moves from `before` to `after`. */
export const milestonesCrossed = (before: number, after: number) => TEACHING.milestones.filter((m) => before < m && after >= m);

export type ReferralFact = { referrerId: string; refereeId: string; refereeIsTeacher: boolean; refereeIsMinor: boolean; refereeQualifiedSessions: number; sameDevice: boolean; rewardedThisYear: number; alreadyRewarded: boolean };
export const REFERRAL = { maxPerYear: 10, needsQualifiedSessions: 1 } as const;
export function qualifyReferral(r: ReferralFact): { ok: boolean; reason?: string } {
  if (r.referrerId === r.refereeId) return { ok: false, reason: 'you cannot refer yourself' };
  if (r.refereeIsMinor || !r.refereeIsTeacher) return { ok: false, reason: 'referrals are for teachers only' };
  if (r.sameDevice) return { ok: false, reason: 'both accounts used the same device' };
  if (r.alreadyRewarded) return { ok: false, reason: 'this referral was already rewarded' };
  if (r.refereeQualifiedSessions < REFERRAL.needsQualifiedSessions) return { ok: false, reason: 'waiting for the new teacher to teach a qualifying session' };
  if (r.rewardedThisYear >= REFERRAL.maxPerYear) return { ok: false, reason: 'yearly referral limit reached' };
  return { ok: true };
}
export const sameWeek = (a: string, b: string) => weekKey(a) === weekKey(b);
