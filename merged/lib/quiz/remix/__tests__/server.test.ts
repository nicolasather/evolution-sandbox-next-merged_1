/** @jest-environment node */
jest.mock('server-only', () => ({}));
import { startSession, answer, trustedSummary, questionsFor, leagueFor } from '../server';
import { verifyToken, type QuizSession } from '../../../quizSecurity';
import { board, submit, erase, _resetForTests } from '../leagues';

type Ok = Exclude<ReturnType<typeof answer>, { error: string }>;
const sess = (t: string) => verifyToken<QuizSession>(t)!;
function play(token: string, t0: number, pick: (i: number, correctIdx: number, redemption: boolean) => number, wager: 'standard' | 'high' = 'standard', gap = 2500) {
  let now = t0; let r: Ok | null = null; let tok = token; let guard = 0;
  while (guard++ < 40) {
    const s = sess(tok); const qs = questionsFor(s);
    const idx = s.phase === 'redemption' ? s.redeemQueue[0]! : s.idx;
    now += gap;
    const res = answer({ token: tok, optionIndex: pick(idx, qs[idx]!.answerIndex, s.phase === 'redemption'), wager }, now);
    if ('error' in res) throw new Error(res.error);
    r = res; tok = res.token; if (res.phase === 'done') break;
  }
  return { r: r!, now };
}

describe('remix server engine', () => {
  const t0 = 1_700_000_000_000;
  beforeEach(() => _resetForTests());

  it('never exposes answers in the public question', () => {
    const s = startSession({ source: 'auto', count: 10, seed: 11 }, t0);
    if ('error' in s) throw new Error(s.error);
    expect(JSON.stringify(s)).not.toMatch(/answerIndex|correctIndex|why|evidence/);
    expect(s.question.options).toHaveLength(4);
  });

  it('a perfect run has 10/10 correct, shields and a verified summary', () => {
    const s = startSession({ source: 'auto', count: 10, seed: 5 }, t0);
    if ('error' in s) throw new Error(s.error);
    const { r, now } = play(s.token, t0, (_i, c) => c);
    expect(r.summary).toMatchObject({ total: 10, correct: 10, maxStreak: 10, redeemed: 0 });
    expect(r.summary!.score).toBe(10_000);
    expect(r.shields).toBe(2);
    const t = trustedSummary(r.token, now); expect(t.ok).toBe(true);
  });

  it('rejects a tampered token and a re-used step (cannot retry after seeing the answer)', () => {
    const s = startSession({ source: 'auto', count: 10, seed: 21 }, t0);
    if ('error' in s) throw new Error(s.error);
    const forged = s.token.split('.')[0] + '.AAAA';
    expect(answer({ token: forged, optionIndex: 0 }, t0 + 1000)).toMatchObject({ status: 400 });
    const q = questionsFor(sess(s.token))[0]!;
    const wrong = (q.answerIndex + 1) % 4;
    const first = answer({ token: s.token, optionIndex: wrong }, t0 + 4000);
    expect('error' in first).toBe(false);
    expect(answer({ token: s.token, optionIndex: q.answerIndex }, t0 + 5000)).toMatchObject({ error: 'Question already answered', status: 409 });
  });

  it('runs the 60 s Redemption Round for 1-3 misses at 50% recovery', () => {
    const s = startSession({ source: 'auto', count: 10, seed: 8 }, t0);
    if ('error' in s) throw new Error(s.error);
    const { r } = play(s.token, t0, (i, c, red) => (i === 2 && !red ? (c + 1) % 4 : c));
    expect(r.summary!.redeemed).toBe(500);
    expect(r.summary!.missedIds).toHaveLength(1);
    expect(r.summary!.score).toBe(9 * 1000 + 500);
  });

  it('skips redemption when more than 3 are missed', () => {
    const s = startSession({ source: 'auto', count: 10, seed: 9 }, t0);
    if ('error' in s) throw new Error(s.error);
    const { r } = play(s.token, t0, (i, c, red) => (i < 5 && !red ? (c + 1) % 4 : c));
    expect(r.summary!.redeemed).toBe(0);
    expect(r.summary!.correct).toBe(5);
  });

  it('refuses leaderboard submissions that are implausibly fast', () => {
    const s = startSession({ source: 'auto', count: 10, seed: 3 }, t0);
    if ('error' in s) throw new Error(s.error);
    const { r } = play(s.token, t0, (_i, c) => c, 'standard', 100);
    expect(trustedSummary(r.token, t0 + 1000)).toEqual({ ok: false, reason: 'implausibly-fast' });
  });

  it('sorts a 5-question run into the community league, 10 into official', () => {
    expect(leagueFor({ src: 'auto', n: 10 })).toBe('official');
    expect(leagueFor({ src: 'auto', n: 5 })).toBe('community');
    expect(leagueFor({ src: 'custom', n: 25 })).toBe('community');
  });

  it('builds a Boss Quiz only from the player’s unlocked discoveries', () => {
    const none = startSession({ source: 'mine', count: 10, unlocked: ['stone'] }, t0);
    expect(none).toHaveProperty('error');
  });

  it('keeps leagues segregated and supports erasure', () => {
    const base = { score: 8000, correct: 8, total: 10, maxStreak: 6, xp: 900 };
    submit({ sid: 'a', playerKey: 'p1', nickname: 'SolarTrilobite42', league: 'official', ...base });
    submit({ sid: 'b', playerKey: 'p2', nickname: 'AmberFern07', league: 'community', ...base, total: 1, correct: 1 });
    expect(board('official').map((r) => r.nickname)).toEqual(['SolarTrilobite42']);
    expect(board('community').map((r) => r.nickname)).toEqual(['AmberFern07']);
    expect(erase('p1')).toBe(1); expect(board('official')).toHaveLength(0);
  });
});
