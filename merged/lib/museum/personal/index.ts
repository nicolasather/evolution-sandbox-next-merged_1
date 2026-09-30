import type { Engine } from '../../engine';
import type { Discovery } from '../../types';
import type { HistoricalExhibit, Year } from '../history/types';
import { engineTimeline, timelineAtDiscovery, type TimelineEngine } from '../history/timeline';

/* ============================================================================
   PERSONAL DISCOVERIES — the player's OWN history: what they actually
   crafted or discovered in Main Evolution, in the order they did it.

   Deliberately separate from the Humanity Museum. This layer:
   - is derived entirely from the engine's save (nothing extra is stored);
   - is NEVER consulted to decide what the Humanity Museum shows;
   - may only annotate a canonical exhibit ("here is how your path
     compared"), never replace it or unlock it.
   ========================================================================== */

export interface PersonalDiscovery {
  id: string;
  node: Discovery;
  /** 1-based position in the order the player found things (primitives excluded). */
  index: number;
  /** When it was found (epoch ms), if the save recorded it. */
  foundAt: number | null;
  isMajor: boolean;
  /** Canonical timeline year just before the player found it (approximate). */
  timelineYear: Year | null;
}

const cache = new WeakMap<Engine, { key: number; list: PersonalDiscovery[] }>();

/** Everything the player has found, in their own order. States and raw materials are left out. */
export function personalDiscoveries(engine: Engine): PersonalDiscovery[] {
  const key = engine.order.length;
  const hit = cache.get(engine);
  if (hit && hit.key === key) return hit.list;
  const prim = new Set(engine.db.primitives);
  const list: PersonalDiscovery[] = [];
  for (const id of engine.order) {
    const node = engine.get(id);
    if (!node || node.state || prim.has(id)) continue;
    list.push({
      id, node, index: list.length + 1,
      foundAt: engine.foundAt(id),
      isMajor: engine.isMajor(id),
      timelineYear: timelineAtDiscovery(engine as unknown as TimelineEngine, id),
    });
  }
  cache.set(engine, { key, list });
  return list;
}

/** How the player's sandbox timing compared with humanity's. Phrased with care in the UI:
 *  the game's simplified timeline does not map perfectly onto history. */
export type PathComparison = 'earlier' | 'around' | 'later';

export interface PersonalLink {
  discovery: PersonalDiscovery;
  comparison: PathComparison | null;
}

const bp = (y: Year, present: Year) => Math.max(1, present + 1 - y);

/**
 * Compare the timeline year at which the player made a discovery with the
 * exhibit's historical range. "Around" is generous (about ±30% in years
 * before present) because both clocks are approximate.
 */
export function comparePath(playerYear: Year, e: HistoricalExhibit, present = 2026): PathComparison {
  const from = e.when.from, to = e.when.to ?? e.when.from;
  const tol = 0.26;   // in log(years-before-present)
  const lp = Math.log(bp(playerYear, present));
  if (lp > Math.log(bp(from, present)) + tol) return 'earlier';
  if (lp < Math.log(bp(to, present)) - tol) return 'later';
  return 'around';
}

/** The player's own discoveries that correspond to a canonical exhibit (possibly none). */
export function personalLinksFor(engine: Engine, e: HistoricalExhibit): PersonalLink[] {
  if (!e.discoveryIds?.length) return [];
  const mine = personalDiscoveries(engine);
  return mine
    .filter(d => e.discoveryIds!.includes(d.id))
    .map(d => ({ discovery: d, comparison: d.timelineYear === null ? null : comparePath(d.timelineYear, e) }));
}

export function currentYear(engine: Engine): Year {
  return engineTimeline(engine as unknown as TimelineEngine).year;
}
