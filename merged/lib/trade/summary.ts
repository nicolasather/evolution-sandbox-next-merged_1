import { neighborsOf } from './adjacency';
import { reachableRegions, regionGateFor, routeKey } from './gate';
import type { Discovery } from '../types';
import type { GeoId, RegionLockInfo, TradeRoute } from './types';

export interface LockedEntry { discovery: Discovery; lock: RegionLockInfo }

/** Every not-yet-found discovery that is currently region-locked for this
 *  home region/route set — one pass over the database, cheap enough to call
 *  on every panel render. */
export function listLocked(
  nodes: readonly Discovery[],
  isFound: (id: string) => boolean,
  homeRegion: GeoId | null,
  routes: readonly TradeRoute[],
): LockedEntry[] {
  if (!homeRegion) return [];
  const out: LockedEntry[] = [];
  for (const n of nodes) {
    if (isFound(n.id)) continue;
    const lock = regionGateFor(n.id, n.n, homeRegion, routes);
    if (lock) out.push({ discovery: n, lock });
  }
  return out;
}

export interface FrontierEdge { from: GeoId; to: GeoId }

/** Every corridor that could be founded right now to extend the reachable
 *  network by exactly one region — the direct neighbours of everywhere
 *  already reachable that are not reachable yet. */
export function frontier(homeRegion: GeoId, routes: readonly TradeRoute[]): FrontierEdge[] {
  const reached = reachableRegions(homeRegion, routes);
  const seen = new Set<string>();
  const out: FrontierEdge[] = [];
  for (const r of reached) {
    for (const n of neighborsOf(r)) {
      if (reached.has(n)) continue;
      const key = routeKey(r, n);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from: r, to: n });
    }
  }
  return out;
}
