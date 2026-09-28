import type { Certainty, GeoId } from '../world/types';
import type { Migratable } from '../save/types';
import type { RegionLockInfo } from '../types';

export type { GeoId, Certainty, RegionLockInfo };

/** Where data/majors.json already documents a discovery's early centre —
 *  derived, never authored twice. See regions.ts: only `firm`/`regional`
 *  certainty entries produce an origin here. `multiple`/`debated`/`unknown`
 *  certainty means the historical record itself does not support pinning
 *  this to one region, so it is never region-gated — gating those would be
 *  the "silently mixing fiction into fact" the brief forbids, just in the
 *  other direction (asserting a single origin the evidence doesn't give). */
export interface DiscoveryOrigin {
  region: GeoId;
  certainty: Certainty;
  /** The place, as majors.json's `region` field says it ("Lomekwi, West Turkana, Kenya"). */
  label: string;
  civ: string | null;
  period: string;
  fact: string;
}

export interface TradeRoute {
  id: string;
  a: GeoId;
  b: GeoId;
  establishedAt: number;
}

export interface TradeSave extends Migratable {
  v: 1;
  homeRegion: GeoId | null;
  routes: TradeRoute[];
}
