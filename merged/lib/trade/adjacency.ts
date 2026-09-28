import type { GeoId } from './types';

/* ============================================================================
   ADJACENCY — which of the 7 broad regions (data/majors.json's own regions;
   see lib/world/types.ts's GeoId) share a direct, historically plausible land
   or short-sea corridor a new trade route can be founded along. This is a
   deliberately coarse abstraction (the brief explicitly allows "broad
   historically defensible geographic/cultural regions when precision is
   uncertain") — it is a gameplay corridor map, not a claim about any specific
   route, date or volume of real trade.

   A route between two NON-adjacent regions still becomes possible — through
   one or more already-established routes in between (see reachable() below)
   — the same way real long-distance exchange moved in relays rather than in
   one continuous voyage.

   Known, deliberate simplification: `americas` has no corridor to anywhere
   else. Sustained trans-oceanic contact with the Americas is a much later,
   specific historical event this pass does not attempt to model; treat any
   Americas-origin discovery as regionally isolated until a future pass adds
   that event on purpose. Do not "fix" this by adding a corridor here.
   ========================================================================== */
const EDGES: [GeoId, GeoId][] = [
  ['africa', 'west_central_asia'],       // the Sinai/Red Sea corridor
  ['west_central_asia', 'europe'],       // Anatolia/the Aegean
  ['west_central_asia', 'south_asia'],   // the Iranian plateau
  ['west_central_asia', 'east_asia'],    // the central Asian steppe/silk-road corridor
  ['south_asia', 'east_asia'],           // the Himalayan/Yunnan routes
  ['south_asia', 'oceania_sea'],         // the Bay of Bengal
  ['east_asia', 'oceania_sea'],          // the South China Sea
];

const neighborMap = new Map<GeoId, Set<GeoId>>();
for (const [a, b] of EDGES) {
  if (!neighborMap.has(a)) neighborMap.set(a, new Set());
  if (!neighborMap.has(b)) neighborMap.set(b, new Set());
  neighborMap.get(a)!.add(b);
  neighborMap.get(b)!.add(a);
}

export function neighborsOf(region: GeoId): GeoId[] {
  return [...(neighborMap.get(region) ?? [])];
}

export function isAdjacent(a: GeoId, b: GeoId): boolean {
  return a !== b && (neighborMap.get(a)?.has(b) ?? false);
}

/** Breadth-first reachability over an arbitrary undirected edge set (the
 *  player's currently-established routes, typically) — every region
 *  connected to `from` by zero or more hops, `from` itself included. */
export function reachable(from: GeoId, edges: Iterable<readonly [GeoId, GeoId]>): Set<GeoId> {
  const adj = new Map<GeoId, Set<GeoId>>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const seen = new Set<GeoId>([from]);
  const queue: GeoId[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}
