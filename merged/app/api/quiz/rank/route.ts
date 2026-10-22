/**
 * Quiz & EdTech Rank API Route Handler
 * High-performance endpoint for retrieving global rankings, user stats, batch recalculation, and XP award.
 * Method guards, validation, metric param, cache-control, proper HTTP status codes.
 */

import { NextResponse } from 'next/server';
import { getGlobalLeaderboard, getUserRank, clearRankCache, recalculateAllRanks, awardXPBatch } from '@/lib/edtech/rankEngine';

const ALLOWED_METRICS = ['xp', 'score', 'streak', 'performance', 'composite', 'overall'] as const;

function validateMetric(m?: string): string | null {
  if (!m) return null;
  if (!ALLOWED_METRICS.includes(m as any)) return null;
  return m;
}

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const metricParam = url.searchParams.get('metric');
    const metric = validateMetric(metricParam) ?? 'composite';

    if (isNaN(limit) || limit < 1 || limit > 500) {
      return NextResponse.json({ success: false, error: 'Invalid limit (1-500)' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    if (userId) {
      const rankEntry = await getUserRank(userId, { metric, limit, useCache: true });
      if (!rankEntry) {
        return NextResponse.json({ success: false, error: 'User rank not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
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
        return NextResponse.json({ success: false, error: 'userProfileId and positive xpAmount required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      const result = await awardXPBatch({ userProfileId, xpAmount, source: source || 'quiz', roomId: roomId || undefined, questionId: questionId || undefined });
      // If engine exposes direct DB call; here we return a confirmation and instruct caller to use DB function directly if needed
      clearRankCache();
      return NextResponse.json({ success: true, action: 'award_xp', userProfileId, xpAmount, result: result ?? null, note: 'DB batch_award_xp_and_rank is the authoritative atomic path.' }, { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Cache-Invalidated': 'true' } });
    }

    return NextResponse.json({ success: false, error: 'Unknown action. Use recalculate, award_xp, or batch_award_xp_and_rank.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('POST /api/quiz/rank error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function DELETE(request: Request) {
  try {
    clearRankCache();
    return NextResponse.json({ success: true, message: 'Rank cache cleared' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to clear cache' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
