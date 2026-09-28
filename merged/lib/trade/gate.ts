import { reachable } from './adjacency';
import { originOf } from './regions';
import type { GeoId, RegionLockInfo, TradeRoute } from './types';

export function routeKey(a: GeoId, b: GeoId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Every region the home region can reach through the established route
 *  network (home region itself always included — nothing needs a route to
 *  be available where it already is). */
export function reachableRegions(homeRegion: GeoId, routes: readonly TradeRoute[]): Set<GeoId> {
  return reachable(homeRegion, routes.map(r => [r.a, r.b] as const));
}

/**
 * Whether a brand-new discovery is blocked right now. Returns null (never
 * blocked) when:
 *   - no home region has been chosen yet (the system is effectively off), or
 *   - the discovery has no single documented origin (see regions.ts), or
 *   - its origin already IS the home region, or
 *   - an established route network already reaches its origin region.
 * Only ever consulted for discoveries the player has not already made —
 * see lib/engine.ts's combineMany/process, which never re-locks a found id.
 */
export function regionGateFor(
  discoveryId: string,
  discoveryName: string,
  homeRegion: GeoId | null,
  routes: readonly TradeRoute[],
): RegionLockInfo | null {
  if (!homeRegion) return null;
  const origin = originOf(discoveryId);
  if (!origin) return null;
  if (origin.region === homeRegion) return null;
  if (reachableRegions(homeRegion, routes).has(origin.region)) return null;
  return {
    homeRegion,
    originRegion: origin.region,
    originLabel: origin.label,
    civ: origin.civ,
    message: `${discoveryName} is first documented in ${origin.label}` +
      `${origin.civ ? ` (${origin.civ})` : ''}. Establish a trade route there to bring it home.`,
  };
}
