import { majorsFile } from '../world/registry';
import type { DiscoveryOrigin, GeoId } from './types';

const byId = new Map(majorsFile.majors.map(m => [m.id, m]));

export const REGIONS: { id: GeoId; name: string }[] = majorsFile.regions;

/** The single region a discovery is documented to have first appeared in —
 *  or null when there either isn't a majors.json entry for it, the entry is
 *  `geo: 'global'` (no single place, per MajorDef's own doc comment), or its
 *  `certainty` is anything other than `firm`/`regional` (i.e. the record
 *  itself says there were several early centres, or the origin is genuinely
 *  unclear). A discovery with no origin here is never region-gated — it is
 *  treated as available everywhere once its era/tier allow it, same as
 *  before this system existed. */
export function originOf(discoveryId: string): DiscoveryOrigin | null {
  const m = byId.get(discoveryId);
  if (!m || m.geo === 'global') return null;
  if (m.certainty !== 'firm' && m.certainty !== 'regional') return null;
  return { region: m.geo, certainty: m.certainty, label: m.region, civ: m.civ, period: m.period, fact: m.fact };
}
