import type { CombineResult } from './types';

/* ============================================================================
   DISCOVERY TIERS — not every find deserves the same ceremony. Three weights:

     minor     an early, everyday find once the player has seen the full reveal:
               a quick card, a ring, no stage (about half a second)
     standard  a new find: the reveal as designed, shorter after the first time
     major     a hidden or rare find, the first of a new era, a Stone Age gate
               opening: the reveal, and the room answers

   Techniques and small observations (lib/processing/insights.ts) sit below all
   three: a banner and a line, never a stage.
   ========================================================================== */

export type DiscoveryTier = 'minor' | 'standard' | 'major';

type Found = Extract<CombineResult, { newRoute: boolean }>;

export function discoveryTier(r: Pick<Found, 'node' | 'firstOfEra' | 'opened'>, hasSeenReveal: boolean): DiscoveryTier {
  const n = r.node;
  if (n.hidden || n.rar === 'rare' || r.firstOfEra || r.opened.length > 0) return 'major';
  const humble = n.era === 'origins' && (n.cat === 'material' || n.cat === 'technique') && (n.depth ?? 0) <= 4;
  return humble && hasSeenReveal ? 'minor' : 'standard';
}
