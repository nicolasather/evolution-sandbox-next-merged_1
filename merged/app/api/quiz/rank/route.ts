/**
 * Quiz & EdTech Rank API Route Handler
 * High-performance endpoint for retrieving global rankings, user stats, and batch performance metrics.
 */

import { NextResponse } from 'next/server';
import { getGlobalLeaderboard, getUserRank } from '@/lib/edtech/rankEngine';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (userId) {
      const rankEntry = await getUserRank(userId, { limit });
      if (!rankEntry) {
        return NextResponse.json({ success: false, error: 'User rank not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: rankEntry });
    }

    const leaderboard = await getGlobalLeaderboard({ limit });
    return NextResponse.json({
      success: true,
      count: leaderboard.length,
      timestamp: new Date().toISOString(),
      data: leaderboard
    });
  } catch (err: any) {
    console.error('Error in rank API route:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
