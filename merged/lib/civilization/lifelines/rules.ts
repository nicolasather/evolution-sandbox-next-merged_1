import {
  MILLI, RESOURCE_IDS, type ContentIndex, type LifelinesState, type LinkType, type MilliQuantities, type Project,
  type Quantities, type ResourceId, type TerrainTag,
} from './schema';

/* ============================================================================
   LIFELINES RULES TABLES — the small, reusable families of rules the full
   district adapter adds on top of the content rows. Everything here is data
   or a tiny pure function; nothing is a per-programme hard-coded algorithm.
   Numeric values are fictional game balance, not measurements.
   ========================================================================== */

export const toMilli = (units: number): number => Math.round(units * MILLI);
export const fromMilli = (m: number): number => m / MILLI;
export function quantitiesToMilli(q: Quantities): MilliQuantities {
  const out: MilliQuantities = {};
  for (const r of RESOURCE_IDS) { const n = q[r]; if (n !== undefined && n !== 0) out[r] = toMilli(n); }
  return out;
}
/** Display helper: milli → a short human string without hiding precision below one unit. */
export function formatUnits(m: number): string {
  const v = m / MILLI;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/* ----------------------------- construction ------------------------------ */

/** Work each active queue item receives per season at full capacity (milli work units). */
export const EFFORT_PER_SEASON = 4 * MILLI;
export const ACTIVE_PER_DISTRICT = 2;
export const WAITING_PER_DISTRICT = 3;
/** Share of UNSPENT materials returned when cancelling after work has started. Knowledge and labour are never refunded. */
export const REFUND_FRACTION_MILLI = 500;
/** A district with a knowledge programme in reach works this much faster (milli factor). */
export const KNOWLEDGE_SUPPORT_FACTOR = 1250;
/** Work factor while the district's materials are short (milli factor). */
export const MATERIAL_SHORT_FACTOR = 500;

/** Seasons of work. Introductory programme: one. Otherwise two to four by era (gameplay tier). */
export function durationSeasons(p: Project): number {
  if (p.id === 'gathering-rounds') return 1;
  return Math.min(4, 2 + (p.era >= 3 ? 1 : 0) + (p.era >= 5 ? 1 : 0));
}
export const workRequiredFor = (p: Project): number => durationSeasons(p) * EFFORT_PER_SEASON;

/* ------------------------------ maintenance ------------------------------ */

export const CONDITION_MAX = 1000;
/** The floor keeps essential service alive: a programme is never deleted by a shortage. */
export const CONDITION_FLOOR = 400;
export const CONDITION_DROP = 250;
export const CONDITION_RECOVER = 125;
/** Repairing a programme costs this share of the materials it was committed with (min 2 units). */
export const REPAIR_FRACTION_MILLI = 200;
export const REPAIR_MIN = 2 * MILLI;

/* ------------------------------- networks -------------------------------- */

/** Gameplay-tier boundary: before it every service travels along ordinary paths (footpaths, shared work). */
export const SPECIALISED_LINKS_FROM_ERA = 3;
export const LINK_CAPACITY: Record<LinkType, number> = {
  path: 20 * MILLI, channel: 16 * MILLI, power: 14 * MILLI, knowledge: 12 * MILLI,
};
export const MAX_LINK_CAPACITY = 100 * MILLI;
export const WORN_CONDITION = 450;
/** A programme of sector X adds this capacity to incident links that carry X. */
export const LINK_BOOST = 3 * MILLI;
export const REPAIR_LINK_COST: MilliQuantities = { materials: 6 * MILLI };
export const ALTERNATE_LINK_COST: MilliQuantities = { materials: 12 * MILLI, logistics: 4 * MILLI };
/** Chapter order from which each player-facing network remedy is taught. */
export const REPAIR_FROM_CHAPTER = 4;
export const ALTERNATE_FROM_CHAPTER = 4;
export const ROUTING_FROM_CHAPTER = 8;

export function linkSupports(type: LinkType, era: number): ResourceId[] {
  if (era < SPECIALISED_LINKS_FROM_ERA) return type === 'path' ? [...RESOURCE_IDS] : [];
  if (type === 'channel') return ['water'];
  if (type === 'power') return ['energy'];
  if (type === 'knowledge') return ['knowledge'];
  return RESOURCE_IDS.filter(r => r !== 'water' && r !== 'energy' && r !== 'knowledge');
}
/** The link type that carries a service in a given tier. */
export function serviceLinkType(service: ResourceId, era: number): LinkType {
  if (era < SPECIALISED_LINKS_FROM_ERA) return 'path';
  if (service === 'water') return 'channel';
  if (service === 'energy') return 'power';
  if (service === 'knowledge') return 'knowledge';
  return 'path';
}

/* -------------------------------- terrain -------------------------------- */

/** Where a sector's programmes may be established. Sectors not listed are legal anywhere. */
export const SECTOR_TERRAIN: Partial<Record<ResourceId, readonly TerrainTag[]>> = {
  food: ['fertile', 'water', 'flat'],
  water: ['water'],
  energy: ['flat', 'upland', 'water'],
  ecology: ['wild', 'water', 'upland', 'fertile'],
};
export const TERRAIN_LABEL: Record<TerrainTag, string> = {
  flat: 'level ground', fertile: 'fertile ground', water: 'a water source', upland: 'upland', wild: 'wild cover',
};
export function districtAllows(terrain: readonly TerrainTag[], sector: ResourceId): boolean {
  const need = SECTOR_TERRAIN[sector];
  return !need || need.some(t => terrain.includes(t));
}

/* --------------------------- effect families ----------------------------- */

/** Reusable effect families keyed by programme id — NOT a bespoke algorithm per row. */
export type EffectFamily =
  | { kind: 'repair'; savedShareMilli: number }
  | { kind: 'loop'; returnShareMilli: number };
export const EFFECT_FAMILIES: Readonly<Record<string, EffectFamily>> = {
  // Repair: recurring materials upkeep of OTHER programmes falls (producing less is not the same as wasting less).
  'repair-quarter': { kind: 'repair', savedShareMilli: 250 },
  'standard-parts-store': { kind: 'repair', savedShareMilli: 250 },
  'design-for-repair': { kind: 'repair', savedShareMilli: 300 },
  // Loop: a share (always below one) of materials consumed returns to the reserve; the programme's own energy upkeep is the processing cost.
  'recycling-network': { kind: 'loop', returnShareMilli: 400 },
  'circular-materials-exchange': { kind: 'loop', returnShareMilli: 500 },
};

/* --------------------------- emergency effort ---------------------------- */

export const GATHER_AMOUNT = 8 * MILLI;
export const GATHER_RESOURCES = ['materials', 'knowledge', 'food', 'water'] as const;

/* ----------------------------- pressure ranking -------------------------- */

/** Essential-service impact order used to rank simultaneous shortages. */
export const ESSENTIAL_ORDER: readonly ResourceId[] = [
  'food', 'water', 'shelter', 'health', 'energy', 'materials', 'logistics',
  'trust', 'resilience', 'ecology', 'knowledge', 'culture',
];
export const SERVICE_LABEL: Record<ResourceId, string> = {
  food: 'Food', water: 'Water', materials: 'Shared materials', energy: 'Energy', knowledge: 'Shared knowledge',
  health: 'Care coverage', shelter: 'Housing capacity', logistics: 'Movement of goods', ecology: 'Living systems',
  trust: 'Public cooperation', culture: 'Shared culture', resilience: 'Recovery capacity',
};
/** Stored goods collect in a reserve; the rest are service capacity that reaches an area. */
export const STORED_GOODS: ReadonlySet<ResourceId> = new Set<ResourceId>(['food', 'water', 'materials', 'energy', 'knowledge']);

/* --------------------------- event eligibility --------------------------- */

/** Eligibility is DATA (predicates), not scattered text searches. */
export type EventPredicate =
  | { kind: 'always' }
  | { kind: 'sector-built'; sector: ResourceId }
  | { kind: 'project-built'; projectId: string }
  | { kind: 'min-districts'; count: number }
  | { kind: 'has-link-type'; type: LinkType };

/** Predicates that must ALL hold. Events not listed use DEFAULT_EVENT_RULE for their sector. */
export const EVENT_RULES: Readonly<Record<string, readonly EventPredicate[]>> = {
  // Equipment and repair events need the relevant programme family to exist first.
  'worn-tools': [{ kind: 'sector-built', sector: 'materials' }],
  'repair-request': [{ kind: 'sector-built', sector: 'materials' }],
  'vehicle-repair': [{ kind: 'sector-built', sector: 'logistics' }],
  'worn-drive': [{ kind: 'sector-built', sector: 'energy' }],
  'leaking-line': [{ kind: 'sector-built', sector: 'water' }],
  // A public archive relocation needs an archive-like programme in the knowledge family.
  'archive-move': [{ kind: 'sector-built', sector: 'knowledge' }],
  'fragile-record': [{ kind: 'sector-built', sector: 'knowledge' }],
  'single-expert': [{ kind: 'sector-built', sector: 'knowledge' }],
  'spare-inspection': [{ kind: 'sector-built', sector: 'resilience' }],
  'backup-unready': [{ kind: 'sector-built', sector: 'resilience' }],
  'crossing-closed': [{ kind: 'min-districts', count: 3 }],
  'route-conflict': [{ kind: 'min-districts', count: 3 }],
  'district-dispute': [{ kind: 'min-districts', count: 3 }],
  'power-window': [{ kind: 'sector-built', sector: 'energy' }],
  'peak-demand': [{ kind: 'sector-built', sector: 'energy' }],
  'restoration-window': [{ kind: 'sector-built', sector: 'ecology' }],
  'stressed-cover': [{ kind: 'sector-built', sector: 'ecology' }],
  'staff-training': [{ kind: 'sector-built', sector: 'health' }],
  'service-outreach': [{ kind: 'sector-built', sector: 'health' }],
  'visiting-makers': [{ kind: 'sector-built', sector: 'culture' }],
  'new-link': [{ kind: 'min-districts', count: 3 }],
};
export const DEFAULT_EVENT_RULE: readonly EventPredicate[] = [{ kind: 'always' }];

function establishedSectorCount(state: LifelinesState, index: ContentIndex, sector: ResourceId): number {
  return state.built.filter(b => index.projects.get(b.projectId)?.sector === sector).length;
}
export function predicateHolds(p: EventPredicate, state: LifelinesState, index: ContentIndex): boolean {
  switch (p.kind) {
    case 'always': return true;
    case 'sector-built': return establishedSectorCount(state, index, p.sector) > 0;
    case 'project-built': return state.built.some(b => b.projectId === p.projectId);
    case 'min-districts': return state.layout.districts.length >= p.count;
    case 'has-link-type': return state.layout.links.some(l => l.type === p.type);
  }
}
export function eventEligible(eventId: string, state: LifelinesState, index: ContentIndex): boolean {
  const e = index.events.get(eventId);
  if (!e || e.minEra > state.era) return false;
  const rules = EVENT_RULES[eventId] ?? DEFAULT_EVENT_RULE;
  return rules.every(p => predicateHolds(p, state, index));
}

/* ------------------------------ mastery ---------------------------------- */

/** Optional mastery conditions. Declared BEFORE a run begins and only offered when feasible in that scenario. */
export type MasteryKind = 'no-emergency' | 'diverse-policies' | 'alternate-route' | 'no-hints';
export interface MasteryDef { id: MasteryKind; label: string; description: string }
export const MASTERY_DEFS: Readonly<Record<MasteryKind, MasteryDef>> = {
  'no-emergency': { id: 'no-emergency', label: 'No emergency effort', description: 'Complete the chapter without using emergency shared work.' },
  'diverse-policies': { id: 'diverse-policies', label: 'Diverse stewardship', description: 'Use policies from at least three different service groups before completing.' },
  'alternate-route': { id: 'alternate-route', label: 'A second route', description: 'Establish the alternate connection this scenario offers.' },
  'no-hints': { id: 'no-hints', label: 'Unaided', description: 'Complete the chapter without opening a hint.' },
};
