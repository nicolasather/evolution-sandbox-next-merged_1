import type { Engine } from '../engine';
import { physicsOf, PROPERTY_WORDS, type Physics, type PropertyId } from './physics';
import { INSIGHTS } from './insights';
import type { Discovery } from '../types';

/* ============================================================================
   REVEAL — what the player has actually LEARNED about a thing's physical
   properties, as opposed to what physics.ts can compute about it. physicsOf()
   always knows the whole truth (it has to, to drive sound, drift and hints);
   this decides which of that truth is shown, and which stays "???" until an
   insight about this exact item has been noticed.

   Rule, kept deliberately simple: the single most obvious property (the one
   coach.ts would lead with) is free the moment the item is held — you can see
   a stone is hard without being told. Every other property waits for an
   Insight (lib/processing/insights.ts) whose `from` is this item and whose
   `property` matches, already surfaced once as a toast and remembered in
   engine.insightsSeen(). Nothing new is asked of the data; this only reads it.
   ========================================================================== */

const BY_FROM = new Map<string, Set<PropertyId>>();
for (const ins of INSIGHTS) {
  let set = BY_FROM.get(ins.from);
  if (!set) { set = new Set(); BY_FROM.set(ins.from, set); }
  set.add(ins.property);
}

export interface PropertyReveal {
  id: PropertyId;
  word: string;
  known: boolean;
}

export interface RevealedPhysics {
  ph: Physics;
  reveals: PropertyReveal[];
  unknownCount: number;
}

/** What the player has learned about `node`'s physical properties. */
export function revealedPhysics(engine: Engine, node: Discovery): RevealedPhysics {
  const ph = physicsOf(engine.proc, node);
  const seenIds = new Set(engine.insightsSeen());
  const candidates = BY_FROM.get(node.id);
  const seenHere = candidates
    ? new Set(INSIGHTS.filter(i => i.from === node.id && seenIds.has(i.id)).map(i => i.property))
    : null;
  const reveals: PropertyReveal[] = ph.properties.map((p, i) => ({
    id: p, word: PROPERTY_WORDS[p], known: i === 0 || !!seenHere?.has(p),
  }));
  return { ph, reveals, unknownCount: reveals.filter(r => !r.known).length };
}
