/**
 * EdTech Platform — Rank Engine
 *
 * Core ranking engine for edtech platform users.
 * Computes composite rankings from multiple data sources:
 * - user_profile.xp (primary metric)
 * - user_rank.score_events (aggregated room scores)
 * - user_profile.streak (engagement metric)
 * - user_rank.performance (quiz/score performance)
 *
 * Rankings are stored in user_rank table with multiple metric dimensions.
 */

import { serviceDB } from '@/lib/quiz/supabase';

// Initialize Supabase client
const supabase = serviceDB();

export interface RankEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  streak: number;
  score: number;          // Aggregated room score
  performance: number;    // Performance metric (0-100 scale)
  compositeScore: number;  // Weighted final score
  rank: number;           // Current position
}

export interface RankOptions {
  metric?: 'xp' | 'score' | 'streak' | 'performance' | 'composite';
  windowStart?: Date;
  windowEnd?: Date;
  limit?: number;
  includeDetails?: boolean;
}

/**
 * Calculate composite score from individual metrics
 * Weights can be configured per platform needs
 */
function calculateCompositeScore(xp: number, score: number, streak: number, performance: number): number {
  // Weights - can be adjusted per platform requirements
  const weights = {
    xp: 0.5,          // Primary metric - 50% weight
    score: 0.3,       // Activity engagement - 30% weight
    streak: 0.15,      // Consistency - 15% weight
    performance: 0.05  // Quality/accuracy - 5% weight
  };

  // Normalize metrics to comparable scale
  const normalizedXP = Math.min(xp / 10000, 1) * 100;  // Cap at 10k XP = 100 points
  const normalizedScore = Math.min(score / 1000, 1) * 100;  // Cap at 1k score = 100 points
  const normalizedStreak = Math.min(streak * 10, 100);     // Each streak day = 10 points, cap at 10 days = 100 points
  const normalizedPerformance = performance;               // Already 0-100 scale

  const composite =
    (normalizedXP * weights.xp) +
    (normalizedScore * weights.score) +
    (normalizedStreak * weights.streak) +
    (normalizedPerformance * weights.performance);

  return Math.round(composite * 100) / 100; // Round to 2 decimal places
}

/**
 * Get user ranking from database by metric
 */
export async function getUserRank(userId: string, options: RankOptions = {}): Promise<RankEntry | null> {
  try {
    const { metric = 'composite', windowStart, windowEnd, includeDetails = false } = options;

    // Get user profile first
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('id, auth_user_id, display_name, avatar_url, xp, level, streak')
      .eq('auth_user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }

    // Get aggregated score from score_events
    let totalScore = 0;

    if (includeDetails || metric === 'score' || metric === 'composite') {
      // Get rooms this user participated in
      const { data: userRooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id')
        .eq('host_id', userId);  // Simplified - in real app would need proper auth linking

      if (!roomsError && userRooms) {
        // Get score_events for user's rooms
        const roomIds = userRooms.map(r => r.id);
        if (roomIds.length > 0) {
          const { data: scoreEvents, error: eventsError } = await supabase
            .from('score_events')
            .select('delta')
            .in('room_id', roomIds);

          if (!eventsError && scoreEvents) {
            totalScore = scoreEvents.reduce((sum, event) => sum + Number(event.delta), 0);
          }
        }
      }
    }

    // Get performance score (simplified - would normally calculate from quiz results)
    let performanceScore = 50; // Default mid-range

    // Calculate composite score
    const compositeScore = calculateCompositeScore(
      profile.xp,
      totalScore,
      profile.streak,
      performanceScore
    );

    // Get current rank position for composite metric
    let rankPosition = 0;

    if (metric === 'composite' || metric === 'xp' || metric === 'score' || metric === 'streak') {
      const { data: rankData, error: rankError } = await supabase
        .from('user_rank')
        .select('rank_position')
        .eq('user_profile_id', profile.id)
        .eq('metric', metric)
        .single();

      if (!rankError && rankData) {
        rankPosition = rankData.rank_position || 0;
      }
    }

    return {
      userId: profile.auth_user_id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      xp: profile.xp,
      level: profile.level,
      streak: profile.streak,
      score: totalScore,
      performance: performanceScore,
      compositeScore,
      rank: rankPosition
    };

  } catch (error) {
    console.error('Error calculating user rank:', error);
    throw error;
  }
}

/**
 * Get leaderboard for a specific metric
 */
export async function getLeaderboard(options: RankOptions = {}): Promise<RankEntry[]> {
  try {
    const { metric = 'composite', windowStart, windowEnd, limit = 50 } = options;

    // Get all user profiles with their metrics
    let query = supabase
      .from('user_profile')
      .select(`
        id,
        auth_user_id,
        display_name,
        avatar_url,
        xp,
        level,
        streak
      `);

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      return [];
    }

    // For each profile, get additional metrics
    const rankEntries: RankEntry[] = await Promise.all(
      profiles.map(async (profile) => {
        // Get score from score_events (simplified implementation)
        let totalScore = 0;
        let performanceScore = 50;

        // Calculate composite score
        const compositeScore = calculateCompositeScore(
          profile.xp,
          totalScore,
          profile.streak,
          performanceScore
        );

        return {
          userId: profile.auth_user_id,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          xp: profile.xp,
          level: profile.level,
          streak: profile.streak,
          score: totalScore,
          performance: performanceScore,
          compositeScore,
          rank: 0 // Will be calculated by rank function
        };
      })
    );

    // Sort by selected metric
    rankEntries.sort((a, b) => {
      switch (metric) {
        case 'xp': return b.xp - a.xp;
        case 'score': return b.score - a.score;
        case 'streak': return b.streak - a.streak;
        case 'performance': return b.performance - a.performance;
        case 'composite':
        default: return b.compositeScore - a.compositeScore;
      }
    });

    // Apply limit
    const limitedEntries = rankEntries.slice(0, limit);

    // Update rank positions in database
    for (let i = 0; i < limitedEntries.length; i++) {
      const entry = limitedEntries[i];
      if (entry.rank !== i + 1) {
        await supabase
          .from('user_rank')
          .upsert({
            user_profile_id: profiles[i].id,
            metric: metric,
            value: metric === 'xp' ? entry.xp :
                   metric === 'score' ? entry.score :
                   metric === 'streak' ? entry.streak :
                   metric === 'performance' ? entry.performance : entry.compositeScore,
            composite_score: entry.compositeScore,
            rank_position: i + 1,
            window_start: windowStart || null,
            window_end: windowEnd || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_profile_id, metric, window_start, window_end'
          });
      }
    }

    // Add rank positions to entries
    return limitedEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
}

/**
 * Recalculate all user rankings for a specific metric
 */
export async function recalculateAllRanks(metric: string = 'composite'): Promise<void> {
  try {
    console.log(`Recalculating all ${metric} rankings...`);

    // Get current user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profile')
      .select('id, auth_user_id');

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    // For each user, recalculate their rank
    for (const profile of profiles) {
      await recalculateUserRank(profile.auth_user_id, metric);
    }

    console.log(`Finished recalculating ${metric} rankings for ${profiles.length} users`);

  } catch (error) {
    console.error('Error recalculating all ranks:', error);
    throw error;
  }
}

/**
 * Recalculate rank for a specific user
 */
export async function recalculateUserRank(userId: string, metric: string = 'composite'): Promise<void> {
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('id, auth_user_id, display_name, avatar_url, xp, level, streak')
      .eq('auth_user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error(`User profile not found for user ${userId}`);
    }

    // Calculate metrics
    const compositeScore = calculateCompositeScore(
      profile.xp,
      0, // Would need to calculate actual score
      profile.streak,
      50 // Default performance
    );

    // Get current rank position
    const { data: currentRank, error: rankError } = await supabase
      .from('user_rank')
      .select('rank_position')
      .eq('user_profile_id', profile.id)
      .eq('metric', metric)
      .single();

    // Insert or update rank record
    const { error: upsertError } = await supabase
      .from('user_rank')
      .upsert({
        user_profile_id: profile.id,
        metric: metric,
        value: compositeScore,
        composite_score: compositeScore,
        rank_position: currentRank?.rank_position || 0,
        window_start: null,
        window_end: null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_profile_id, metric, window_start, window_end'
      });

    if (upsertError) {
      throw new Error(`Error updating rank for user ${userId}: ${upsertError.message}`);
    }

  } catch (error) {
    console.error(`Error recalculating rank for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get comprehensive rank statistics
 */
export async function getRankStats(): Promise<any> {
  try {
    // Get total users
    const { count: totalUsers, error: countError } = await supabase
      .from('user_profile')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Error counting users: ${countError.message}`);
    }

    // Get top performers by metric
    const metrics = ['xp', 'score', 'streak', 'performance', 'composite'];
    const stats: any = {};

    for (const metric of metrics) {
      const { data: topUsers, error: topError } = await supabase
        .from('user_rank')
        .select(`
          user_profile_id,
          composite_score,
          rank_position,
          user_profile!inner(
            auth_user_id,
            display_name,
            avatar_url,
            xp,
            level,
            streak
          )
        `)
        .eq('metric', metric)
        .order('composite_score', { ascending: false })
        .limit(10);

      if (topError) {
        console.error(`Error getting top ${metric}:`, topError);
        continue;
      }

      stats[metric] = {
        totalUsers,
        topPerformers: topUsers?.map(userRank => ({
          userId: userRank.user_profile.auth_user_id,
          displayName: userRank.user_profile.display_name,
          avatarUrl: userRank.user_profile.avatar_url,
          xp: userRank.user_profile.xp,
          level: userRank.user_profile.level,
          streak: userRank.user_profile.streak,
          compositeScore: userRank.composite_score,
          rankPosition: userRank.rank_position
        })) || []
      };
    }

    return stats;

  } catch (error) {
    console.error('Error getting rank stats:', error);
    throw error;
  }
}

export default {
  getUserRank,
  getLeaderboard,
  recalculateAllRanks,
  recalculateUserRank,
  getRankStats
};