/**
 * POST /api/quiz/grade — server-side grading for the Remix quiz.
 *   { action: 'start',  source: 'auto' | 'mine', count?, unlocked?, seed? } -> first question (answers never included)
 *   { action: 'answer', token, optionIndex, wager?, pausedMs? }              -> grading, next question, re-signed token
 *   { action: 'resume', token }                                              -> current question after a page refresh
 * The browser never receives answerIndex before it has answered, and cannot alter score/streak/shields (HMAC token).
 */
import { NextResponse } from 'next/server';
import { clientKey, gradeLimiter, verifyToken, type QuizSession } from '@/lib/quizSecurity';
import { answer, questionsFor, startSession } from '@/lib/quiz/remix/server';
import { toPublic } from '@/lib/sandboxQuizBridge';

export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: H });

export async function POST(req: Request) {
  if (!gradeLimiter.hit(clientKey(req))) return bad('Too many requests. Slow down a little.', 429);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return bad('Invalid JSON body');

  if (b.action === 'start') {
    const unlocked = Array.isArray(b.unlocked) ? b.unlocked.filter((x): x is string => typeof x === 'string').slice(0, 4000) : undefined;
    const r = startSession({ source: b.source as 'auto' | 'mine', count: Number(b.count) || 10, unlocked, seed: typeof b.seed === 'number' ? b.seed : undefined });
    return 'error' in r ? bad(r.error) : NextResponse.json({ success: true, ...r }, { headers: H });
  }
  if (b.action === 'answer') {
    const r = answer({ token: String(b.token ?? ''), optionIndex: Number(b.optionIndex), wager: b.wager === 'high' ? 'high' : 'standard', pausedMs: Number(b.pausedMs) || 0 });
    return 'error' in r ? bad(r.error, r.status) : NextResponse.json({ success: true, ...r }, { headers: H });
  }
  if (b.action === 'resume') {
    const s = verifyToken<QuizSession>(b.token);
    if (!s || s.phase === 'done') return bad('Session cannot be resumed', 409);
    const qs = questionsFor(s);
    const i = s.phase === 'redemption' ? s.redeemQueue[0] : s.idx;
    const q = i === undefined ? undefined : qs[i];
    if (!q || i === undefined) return bad('Session cannot be resumed', 409);
    return NextResponse.json({ success: true, token: b.token, total: s.n, phase: s.phase, question: toPublic(q, i), score: s.score, streak: s.streak, maxStreak: s.maxStreak, shields: s.shields, correct: s.correct, qAt: s.qAt, rAt: s.rAt, serverNow: Date.now() }, { headers: H });
  }
  return bad('Unknown action');
}
