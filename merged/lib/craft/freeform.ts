import type { ActionId } from '../types';
import { TECH_ORDER } from '../processing/techniques';
import { Gesture, type Target } from './gesture';
import { kindOf } from './kinds';

/* ============================================================================
   FREEFORM — behaviour-based technique discovery (brief P1.2). While no
   technique is selected, the player can still take hold of a piece and work
   it in place; this watches that raw motion for the same geometry an
   already-tuned Gesture recognises, for whichever not-yet-known techniques
   the player already qualifies for by what they hold (Engine.unknownReady).

   Nothing here invents a second, looser copy of the rules: every candidate
   runs its own real Gesture, unchanged, with its own real tuning (need /
   reach / sweeps / turns — lib/craft/kinds.ts). A light rub can complete an
   easy one (Scrape) before a harder one needing more of the same motion
   (Grind) — the actual required intensity does the telling apart, not a
   guess at which one was "meant."

   'hold'-kind techniques (heat / cool / dry / burn / press) are left out:
   they read as holding something near a source, not a motion, and freeform
   contact here has no source to be near.
   ========================================================================== */

export class FreeformTrial {
  private readonly gestures = new Map<ActionId, Gesture>();

  constructor(candidates: readonly ActionId[], target: Target, x: number, y: number) {
    for (const id of candidates) {
      if (kindOf(id) === 'hold') continue;
      const g = new Gesture(id, target);
      g.down(x, y);
      this.gestures.set(id, g);
    }
  }

  /** Whether there is anything left worth tracking (a body with no eligible-but-unknown
   *  technique at all never gets a trial in the first place). */
  get active(): boolean { return this.gestures.size > 0; }

  move(x: number, y: number): void { for (const g of this.gestures.values()) g.move(x, y); }

  /** A repeat press on the same piece (e.g. a second strike, for a smash-kind candidate) —
   *  mirrors how the real hand keeps pressing the same in-progress gesture. */
  down(x: number, y: number): void { for (const g of this.gestures.values()) g.down(x, y); }

  /** Time passes; returns the technique whose motion just completed, first in catalogue
   *  order when more than one finishes on the same tick — deterministic, never a guess. */
  tick(dt: number): ActionId | null {
    for (const g of this.gestures.values()) g.tick(dt);
    for (const id of TECH_ORDER) { if (this.gestures.get(id)?.done) return id; }
    return null;
  }
}
