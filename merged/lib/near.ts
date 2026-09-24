/* ============================================================================
   NEAR — what the game may say after a pair that makes nothing.

   A presentation layer over the engine, reading only what the engine already
   exposes. It never names a discovery, an ingredient or a count, and hidden
   entries count the same as any other, so a hidden find cannot be told apart
   by its message. Three levels, from warm to quiet:

     forming   — the two pieces are each part of a recipe for the SAME
                 undiscovered thing, just not with each other.
     uses      — one of them still has an unexplored use.
     (nothing) — say nothing rather than guess.
   ========================================================================== */

import type { Engine } from './engine';

export type NearLevel = 'forming' | 'uses';

const TEXT: Record<NearLevel, string> = {
  forming: 'Something is forming.',
  uses: 'This material has more uses than you think.',
};

/** Which vague line, if any, fits a failed pair. */
export function nearLine(engine: Engine, aId: string, bId: string): { level: NearLevel; text: string } | null {
  const openUses = (id: string) => engine.usesOf(id).filter(u => !engine.has(u));
  const ua = openUses(aId), ub = openUses(bId);
  const shared = ua.some(x => ub.includes(x));
  if (shared) return { level: 'forming', text: TEXT.forming };
  if (ua.length || ub.length) return { level: 'uses', text: TEXT.uses };
  return null;
}
