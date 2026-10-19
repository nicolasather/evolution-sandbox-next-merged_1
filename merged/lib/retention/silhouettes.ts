/* ============================================================================
   NEXT-DISCOVERY SILHOUETTES (#18) — opt-in, spoiler-safe.

   Only entries the Engine says are within reach right now (a recipe the player holds every piece of), never hidden
   ones, are offered. A silhouette shows the outline of the mark and its era and field — never the name, the recipe,
   the ingredients or a count that reveals more. At most three are shown, ordered by the engine's own sense of what is
   nearest, so the same state always shows the same shadows.
   ========================================================================== */
import type { Engine } from '../engine';
import type { Discovery } from '../types';

export interface Shadow { id: string; node: Discovery; era: string; field: string }

export function nextSilhouettes(engine: Engine, max = 3): Shadow[] {
  const prim = new Set(engine.db.primitives);
  const ready = engine.withinReach(false).filter(n => !n.state && !prim.has(n.id));
  ready.sort((a, b) => (a.depth || 0) - (b.depth || 0) || a.no - b.no);
  return ready.slice(0, max).map(n => ({
    id: n.id, node: n, era: engine.db.eras.find(e => e.id === n.era)?.name ?? n.era, field: n.cat,
  }));
}
