import type { CampaignManifest, RewardRecord } from './campaign';

/* ============================================================================
   REWARDS — idempotent museum hand-off.
   A chapter only produces a museum card when a VERIFIED exhibit is mapped to it.
   The mapping is intentionally empty: Lifelines chapters are procedural-fiction
   scenarios, and the database carries no verified historical exhibit for them.
   Until one is reviewed and added here, the honest status is 'none'.
   ========================================================================== */

/** chapterId -> verified exhibitId. Empty on purpose; never invent entries. */
export const VERIFIED_CHAPTER_EXHIBITS: Readonly<Record<string, string>> = Object.freeze({});

export interface ProfileLike {
  unlockExhibit(unlock: { exhibitId: string; sourceMode: string; unlockedAt: number }): void;
}

export const SOURCE_MODE = 'civilization';

/** Deliver (or retry) the reward for a completion key. Safe to call repeatedly; never throws. */
export function deliverReward(
  m: CampaignManifest, key: string, chapterId: string, profile: ProfileLike | null, now: number,
  mapping: Readonly<Record<string, string>> = VERIFIED_CHAPTER_EXHIBITS,
): CampaignManifest {
  const prev = m.rewards[key];
  if (prev?.status === 'delivered' || prev?.status === 'none') return m;
  const exhibitId = mapping[chapterId] ?? null;
  let next: RewardRecord;
  if (!exhibitId) {
    next = { status: 'none', exhibitId: null, updatedAt: now };
  } else if (!profile) {
    next = { status: 'pending', exhibitId, updatedAt: now };
  } else {
    try {
      profile.unlockExhibit({ exhibitId, sourceMode: SOURCE_MODE, unlockedAt: now });
      next = { status: 'delivered', exhibitId, updatedAt: now };
    } catch {
      next = { status: 'pending', exhibitId, updatedAt: now };
    }
  }
  return { ...m, rewards: { ...m.rewards, [key]: next } };
}

/** Retry every pending reward (e.g. after an interrupted hand-off). */
export function retryPendingRewards(m: CampaignManifest, profile: ProfileLike | null, now: number): CampaignManifest {
  let out = m;
  for (const [key, r] of Object.entries(m.rewards)) {
    if (r.status !== 'pending') continue;
    const chapterId = m.completions[key]?.chapterId;
    if (!chapterId) continue;
    const reset: CampaignManifest = { ...out, rewards: { ...out.rewards } };
    delete reset.rewards[key];
    out = deliverReward(reset, key, chapterId, profile, now);
  }
  return out;
}
