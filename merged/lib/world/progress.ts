import type { Engine } from '../engine';
import type { EraProgress } from './types';

/* ============================================================================
   PROGRESS — what the world panel and the top-bar chip say about where the
   player stands. Pure reads of the engine.
   ========================================================================== */

export interface WorldFocus {
  /** Every era's progress, in order. */
  eras: EraProgress[];
  /** The era the player is finishing right now. */
  current: EraProgress;
  /** The era after it, or null at the end. */
  next: EraProgress | null;
  /** The next era is closed until `current` is finished. */
  nextLocked: boolean;
  /** The line to show while it is locked. */
  lockMessage: string;
}

export const LOCK_MESSAGE = 'Complete all major world inventions from this era to advance.';

/**
 * The era in focus is the first one that is unfinished and is what the next
 * era is waiting on. When nothing is waiting (an older save that skipped
 * ahead, or every era done) it is the furthest era reached.
 */
export function worldFocus(engine: Engine): WorldFocus {
  const eras = engine.db.eras.map(e => engine.eraProgress(e.id));
  let at = eras.findIndex((p, i) => !p.complete && i + 1 < eras.length && !eras[i + 1].open);
  if (at < 0) {
    const reached = engine.currentEra().id;
    at = Math.max(0, eras.findIndex(p => p.era === reached));
  }
  const current = eras[at];
  const next = eras[at + 1] ?? null;
  return { eras, current, next, nextLocked: !!next && !next.open, lockMessage: LOCK_MESSAGE };
}
