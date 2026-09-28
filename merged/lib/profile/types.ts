import type { Migratable } from '../save/types';

/** One mode's visit record inside the shared profile. Every mode owns its
 *  own save (Main Evolution's stays exactly `evo.sandbox.v1`, untouched by
 *  this file); this is only "has the player been here, and where were they" —
 *  enough to resume without duplicating a mode's real state. */
export interface ModeVisit {
  firstVisitedAt: number;
  lastVisitedAt: number;
  visitCount: number;
  /** Mode-owned pointer to exactly where to resume (a screen id, a run id, a
   *  step index) — this module stores it but never interprets it. */
  resume?: Record<string, unknown>;
}

export interface MuseumUnlock {
  exhibitId: string;
  sourceMode: string;
  unlockedAt: number;
}

export interface ProfileSave extends Migratable {
  v: 1;
  createdAt: number;
  modes: Record<string, ModeVisit>;
  museum: MuseumUnlock[];
}
