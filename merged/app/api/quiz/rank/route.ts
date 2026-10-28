/**
 * Quiz & EdTech Rank API Route Handler
 * High-performance endpoint for retrieving global rankings, user stats, batch recalculation, and XP award.
 * Method guards, validation, metric param, cache-control, proper HTTP status codes.
 */

import { NextResponse } from 'next/server';
import { getGlobalLeaderboard, getUserRank, clearRankCache, recalculateAllRanks, awardXPBatch } from '@/lib/edtech/rankEngine';
import { clientKey, rankWriteLimiter, sanitizeNickname, sanitizeText, LIMITS } from '@/lib/quizSecurity';
import { checkUserText, generateSafeNickname } from '@/lib/legalCompliance';
import { trustedSummary } from '@/lib/quiz/remix/server';
import { board as leagueBoard, submit as submitToLeague, erase as eraseFromLeagues, has as hasSession, reportQuiz } from '@/lib/quiz/remix/leagues';

const ALLOWED_METRICS = ['xp', 'score', 'streak', 'performance', 'composite', 'overall'] as const;
type MetricType = 'xp' | 'score' | 'streak' | 'performance' | 'composite';

function validateMetric(m?: string | null): MetricType {
  if (!m) return 'composite';
  if (ALLOWED_METRICS.includes(m as any)) {
    return m === 'overall' ? 'composite' : (m as MetricType);
  }
  return 'composite';
}

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const metricParam = url.searchParams.get('metric');
    const metric = validateMetric(metricParam) ?? 'composite';

    // Remix leagues: `?league=official|community` returns the segregated, server-verified boards.
    const league = url.searchParams.get('league');
    if (league === 'official' || league === 'community') {
      const rows = leagueBoard(league, Math.min(100, Math.max(1, Number.isFinite(limit) ? limit : 50)));
      return NextResponse.json({ success: true, league, count: rows.length, data: rows }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    if (isNaN(limit) || limit < 1 || limit > 500) {
      return badRequest('Invalid limit (1-500)');
    }

    if (userId) {
      const rankEntry = await getUserRank(userId, { metric, limit, useCache: true });
      if (!rankEntry) {
        return badRequest('User rank not found');
      }
      return NextResponse.json({ success: true, data: rankEntry }, { status: 200, headers: { 'Cache-Control': 'max-age=30, stale-while-revalidate=60' } });
    }

    const leaderboard = await getGlobalLeaderboard({ metric, limit, useCache: true });
    return NextResponse.json({
      success: true,
      metric,
      count: leaderboard.length,
      timestamp: new Date().toISOString(),
      data: leaderboard
    }, { status: 200, headers: { 'Cache-Control': 'max-age=30, stale-while-revalidate=60' } });
  } catch (err: any) {
    console.error('GET /api/quiz/rank error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'recalculate';
    const body = await request.json().catch(() => ({}));

    // ── Remix league writes. Score is NEVER read from the body: only from the HMAC-signed session token. ──
    if (action === 'submit' || action === 'erase' || action === 'report_quiz') {
      if (!rankWriteLimiter.hit(clientKey(request))) return NextResponse.json({ success: false, error: 'Too many leaderboard writes. Try again in a minute.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'submit') {
      const t = trustedSummary(body?.token);
      if (!t.ok) return badRequest(`Submission rejected: ${t.reason}`);
      if (hasSession(t.summary.sid)) return badRequest('Submission rejected: already submitted');
      // Real names on a public board need explicit consent (Decree 13/2023 Art. 11); otherwise use a generated handle.
      const wanted = body?.consentToPublicName === true ? sanitizeNickname(body?.nickname) : '';
      const checked = wanted ? checkUserText(wanted) : null;
      const nickname = checked && checked.ok ? checked.value : generateSafeNickname();
      const playerKey = sanitizeText(body?.playerKey, 40) || t.summary.sid;
      const row = submitToLeague({ sid: t.summary.sid, playerKey, nickname, league: t.summary.league, score: t.summary.score, correct: t.session.answered.length - t.session.missed.length, total: t.summary.total, maxStreak: t.summary.maxStreak, xp: t.summary.xp });
      return NextResponse.json({ success: true, league: row.league, composite: row.composite, nickname }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'erase') {
      const playerKey = sanitizeText(body?.playerKey, 40);
      if (!playerKey) return badRequest('playerKey required');
      return NextResponse.json({ success: true, removed: eraseFromLeagues(playerKey) }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'report_quiz') {
      const quizId = sanitizeText(body?.quizId, 80);
      if (!quizId) return badRequest('quizId required');
      reportQuiz(quizId, sanitizeText(body?.reason, LIMITS.prompt) || 'unspecified');
      return NextResponse.json({ success: true, hidden: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    // The legacy actions below mutate XP/ranks from caller-supplied numbers (forgery vector), so they now require a server secret.
    if (action === 'recalculate' || action === 'recalculateAllRanks' || action === 'award_xp' || action === 'batch_award_xp_and_rank') {
      const secret = process.env.QUIZ_ADMIN_TOKEN;
      if (!secret || request.headers.get('x-admin-token') !== secret) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'recalculate' || action === 'recalculateAllRanks') {
      // Input validation
      const metricParam = body.metric || url.searchParams.get('metric');
      const metric = validateMetric(metricParam) ?? 'composite';
      const userId = body.userId || url.searchParams.get('userId');

      // Call engine batch operation
      const result = await recalculateAllRanks({ metric, userId: userId || undefined });
      clearRankCache();
      return NextResponse.json({ success: true, action, metric, result }, { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Cache-Invalidated': 'true' } });
    }

    if (action === 'award_xp' || action === 'batch_award_xp_and_rank') {
      const { userProfileId, xpAmount, source, roomId, questionId } = body || {};
      if (!userProfileId || typeof xpAmount !== 'number' || xpAmount <= 0) {
        return badRequest('userProfileId and positive xpAmount required');
      }
      const result = await awardXPBatch({ userProfileId, xpAmount, source: source || 'quiz', roomId: roomId || undefined, questionId: questionId || undefined });
      // If engine exposes direct DB call; here we return a confirmation and instruct caller to use DB function directly if needed
      clearRankCache();
      return NextResponse.json({ success: true, action: 'award_xp', userProfileId, xpAmount, result: result ?? null, note: 'DB batch_award_xp_and_rank is the authoritative atomic path.' }, { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Cache-Invalidated': 'true' } });
    }

    return badRequest('Unknown action. Use recalculate, award_xp, or batch_award_xp_and_rank.');
  } catch (err: any) {
    console.error('POST /api/quiz/rank error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE() {
  try {
    clearRankCache();
    return NextResponse.json({ success: true, message: 'Rank cache cleared' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to clear cache' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
