import 'server-only';
import { NextRequest } from 'next/server';
import { success, failure, rateLimit } from '@/lib/quiz/api';
import rankEngine from '@/lib/edtech/rankEngine';

export async function GET(req: NextRequest) {
  try {
    // Rate limit
    await rateLimit(req, 'rank:get', 30, 10);

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric') || 'composite';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const userId = searchParams.get('userId');

    if (userId) {
      // Get single user rank
      const result = await rankEngine.getUserRank(userId, { metric: metric as any, limit, includeDetails: true });
      return success(result);
    }

    // Get leaderboard
    const leaderboard = await rankEngine.getLeaderboard({ metric: metric as any, limit });
    return success({ leaderboard, count: leaderboard.length, metric, generatedAt: new Date().toISOString() });

  } catch (error) {
    return failure(error);
  }
}