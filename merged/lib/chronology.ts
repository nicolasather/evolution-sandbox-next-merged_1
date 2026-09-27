import type { Discovery } from './types';
import type { TransformDef, UnlockDef } from './processing/types';

/* ============================================================================
   CHRONOLOGY — the one place that decides "what comes before what".

   Every screen that used to invent its own order (Timeline's per-era sort,
   Graph's era-column + depth sort, Archive's catalogue-number sort, the
   Action Rail's family grouping, the Tutor's ERA_ORDER.indexOf gate) reads
   this module instead. Nothing here changes what a discovery's `ds` MEANS —
   it stays the authored signed year, negative for BCE, preserved exactly as
   data/db.json gives it. This module only decides how to COMPARE and DERIVE
   from it.

   The comparator's three tie-break levels, in order:
     1. chronological position (`ds` — or a derived stand-in, see below);
     2. dependency order, when (1) is equal;
     3. a stable catalogue number / id, when (2) is also equal (or absent).

   For (2) this module deliberately does NOT walk the recipe graph itself.
   `Discovery.depth` (computed once in lib/processing/overlay.ts, by the same
   fixed-point rule computeDepths() already used for hints and the graph) is
   already a valid strict topological order: depth(ingredient) is always
   strictly less than depth(result), directly or transitively, because depth
   is defined as `max(ingredient depths) + 1`. Reusing it means "dependency
   order" is one extra comparison, not a second graph walk maintained in
   parallel with the one the engine already keeps correct.
   ========================================================================== */

/** How sure a chronological placement is. Mirrors the `source_required` idea
 *  already used for discoveries: this is about the PLACEMENT, not the prose. */
export type ChronologyConfidence = 'verified' | 'provisional' | 'source_required';

/** What kind of claim a technique's placement is making — never "invented in year X"
 *  unless `kind` is genuinely `dated`. */
export type ChronologyKind = 'foundational' | 'earliest_evidence' | 'approximate' | 'derived' | 'debated' | 'dated';

/** Chronology metadata for one technique. `sortDs` is a GAMEPLAY sorting anchor,
 *  not a claim of "invented in this year" — `kind` says which kind of claim is
 *  actually being made, and the UI must read `kind` before printing a year. */
export interface TechniqueChronology {
  /** Signed-year anchor used only to place the technique among the others. */
  sortDs: number;
  /** Short label for the rail band header / tooltip, e.g. "Foundational · ≈3.3M BP". */
  label: string;
  kind: ChronologyKind;
  confidence: ChronologyConfidence;
  /** One line on what grounds the placement (never a fabricated date). */
  basis: string;
  /** Ids into data/sources.json, when a real source underwrites the placement. */
  sourceIds?: string[];
  /** Free text, e.g. a preservation-bias caveat. */
  note?: string;
}

/** The minimal shape the central comparator needs. Discovery already has all
 *  four fields; anything else (a technique, a synthetic row) can be adapted
 *  into this shape without inventing a second data model. */
export interface Chronological {
  id: string;
  ds: number;
  /** Topological tiebreak. `null`/`undefined` sorts as "least constrained" (last). */
  depth?: number | null;
  /** Stable catalogue tiebreak. States and techniques may not have a real one. */
  no?: number;
}

const DEPTH_FALLBACK = Number.MAX_SAFE_INTEGER / 2;

/** THE comparator. Ascending: oldest first. Deterministic on every render,
 *  every device — no Math.random, no object identity, no insertion order. */
export function compareChronological(a: Chronological, b: Chronological): number {
  if (a.ds !== b.ds) return a.ds - b.ds;
  const da = a.depth ?? DEPTH_FALLBACK, db = b.depth ?? DEPTH_FALLBACK;
  if (da !== db) return da - db;
  const na = a.no ?? DEPTH_FALLBACK, nb = b.no ?? DEPTH_FALLBACK;
  if (na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Sort a copy of `items` by the central comparator. Never mutates. */
export function sortChronological<T extends Chronological>(items: readonly T[]): T[] {
  return items.slice().sort(compareChronological);
}

/** A discovery already carries everything `Chronological` needs. */
export const asChronological = (n: Pick<Discovery, 'id' | 'ds' | 'depth' | 'no'>): Chronological => n;

/** Discoveries only, oldest first — the shape Timeline/Graph/Archive all want,
 *  with hidden-until-found and state entries left to the caller to filter first. */
export function sortDiscoveries<T extends Pick<Discovery, 'id' | 'ds' | 'depth' | 'no'>>(nodes: readonly T[]): T[] {
  return sortChronological(nodes as readonly Chronological[]) as unknown as T[];
}

/** Whether a discovery's chronological placement should be shown with a caveat:
 *  no verified subject-level source yet. Placement-only — never hides the item,
 *  never fabricates a firmer date. */
export function discoveryConfidence(n: Pick<Discovery, 'src'>): ChronologyConfidence {
  return n.src?.includes('source_required') ? 'source_required' : 'verified';
}

/** The real, authored spread of each era's discoveries — NOT an assumed clean
 *  boundary. Two eras overlap in real history (Agriculture/Settlement/Trade
 *  all run concurrently in different regions), and this reads that overlap
 *  from the data instead of pretending eras are sequential time boxes.
 *  Returns, per era id, the earliest `ds` among its (non-state) discoveries. */
export function eraChronologyBounds(nodes: readonly Pick<Discovery, 'era' | 'ds' | 'state'>[]): Record<string, number> {
  const out: Record<string, number> = Object.create(null);
  for (const n of nodes) {
    if (n.state) continue;
    if (!(n.era in out) || n.ds < out[n.era]) out[n.era] = n.ds;
  }
  return out;
}

/* ── state chronology (Stick, Clay, Wet Clay…) ────────────────────────────
   States are transient material forms, not independent inventions: they must
   never look like a separate historical entry with its own date. They are
   never shown in Timeline/Graph/Archive (Discovery.state already keeps them
   out), but Inventory does order them, so they need SOME deterministic
   anchor — one inherited from whatever produced them, not fabricated. */

export interface StateChronologySource {
  states: readonly { id: string }[];
  transforms: readonly Pick<TransformDef, 'from' | 'out'>[];
  unlocks: readonly Pick<UnlockDef, 'when' | 'any' | 'give'>[];
  /** Resolved ds for anything that already has one (primitives + real discoveries). */
  dsOf: (id: string) => number | undefined;
}

/** For every state, the earliest `ds` among whatever can produce it — a
 *  transform's `from`, or an unlock's `when` set. Multiple ways in (multiple
 *  transforms/unlocks) mean the state can exist as soon as the EARLIEST of
 *  them can, so this takes the minimum, not the maximum. States that feed
 *  other states (Clay → Wet Clay → Shaped Clay) resolve by fixed point, the
 *  same technique lib/processing/overlay.ts already uses for depth. Anything
 *  left unresolved (should not happen with authored data) falls back to the
 *  earliest primitive and is flagged `source_required` by the caller. */
export function resolveStateChronology(src: StateChronologySource): Map<string, number> {
  const resolved = new Map<string, number>();
  const stateIds = new Set(src.states.map(s => s.id));
  const dsOf = (id: string): number | undefined => resolved.get(id) ?? src.dsOf(id);

  let changed = true;
  let guard = 0;
  while (changed && guard++ < stateIds.size + 5) {
    changed = false;
    for (const s of src.states) {
      if (resolved.has(s.id)) continue;
      const candidates: number[] = [];
      for (const t of src.transforms) {
        if (!t.out.includes(s.id)) continue;
        const d = dsOf(t.from);
        if (d !== undefined) candidates.push(d);
      }
      for (const u of src.unlocks) {
        if (u.give !== s.id) continue;
        const ds = u.when.map(dsOf);
        const ok = u.any ? ds.some(x => x !== undefined) : ds.every(x => x !== undefined);
        if (!ok) continue;
        const known = ds.filter((x): x is number => x !== undefined);
        candidates.push(u.any ? Math.min(...known) : Math.max(...known));
      }
      if (candidates.length) { resolved.set(s.id, Math.min(...candidates)); changed = true; }
    }
  }
  return resolved;
}

/* ── techniques ──────────────────────────────────────────────────────────── */

/** Chronological order for a list of techniques that already carry `chronology`.
 *  Ties (two techniques given the same `sortDs`, e.g. both "foundational") keep
 *  their original catalogue order — the array position they were authored in —
 *  so the order is still deterministic without inventing a fake sub-rank. */
export function sortTechniquesChronologically<T extends { id: string; chronology: TechniqueChronology }>(
  list: readonly T[],
): T[] {
  return list
    .map((t, i) => ({ t, i }))
    .sort((x, y) => (x.t.chronology.sortDs - y.t.chronology.sortDs) || (x.i - y.i))
    .map(({ t }) => t);
}

/** Honest, non-committal display text for a technique's origin, driven by
 *  `kind` — never prints a bare year for anything that isn't genuinely `dated`. */
export function describeTechniqueOrigin(c: TechniqueChronology): string {
  switch (c.kind) {
    case 'foundational': return 'Foundational behaviour — likely as old as tool use itself.';
    case 'earliest_evidence': return `Earliest surviving evidence: ${c.label}.`;
    case 'debated': return `Origin debated — ${c.label}.`;
    case 'derived': return `Follows from what it needs — ${c.label}.`;
    case 'approximate': return `Approximate — ${c.label}.`;
    case 'dated': return c.label;
    default: return c.label;
  }
}

/** Which chronological band a technique's `sortDs` falls into, for the Action
 *  Rail's grouping. Bands are display buckets over real anchors, not a second
 *  ordering system: moving the boundary never changes technique order, only
 *  which header a technique sits under. */
export interface ChronologyBand { id: string; label: string; from: number; to: number }

export const TECHNIQUE_BANDS: ChronologyBand[] = [
  { id: 'foundational', label: 'Foundational actions', from: -Infinity, to: -2_600_000 },
  { id: 'first_tools', label: 'First tools', from: -2_600_000, to: -700_000 },
  { id: 'fire_shaping', label: 'Fire & early shaping', from: -700_000, to: -60_000 },
  { id: 'fibre_grinding', label: 'Fibre & grinding', from: -60_000, to: -12_000 },
  { id: 'ceramics_binding', label: 'Ceramics & binding', from: -12_000, to: -6_700 },
  { id: 'metallurgy', label: 'Metallurgy & later processes', from: -6_700, to: Infinity },
];

export function bandOf(sortDs: number): ChronologyBand {
  return TECHNIQUE_BANDS.find(b => sortDs >= b.from && sortDs < b.to) ?? TECHNIQUE_BANDS[TECHNIQUE_BANDS.length - 1];
}
