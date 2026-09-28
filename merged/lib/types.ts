/** Shapes of the discovery database. Mirrors data/sources.json + data/nodes/*.json. */
import type { EraGate, GeoId } from './world/types';

export type EraId =
  | 'origins' | 'fire' | 'settlement' | 'agriculture' | 'civilization' | 'trade'
  | 'metallurgy' | 'science' | 'industry' | 'electric' | 'computing'
  | 'network' | 'games' | 'simulation';

export type Category =
  | 'material' | 'technique' | 'technology' | 'biology' | 'culture' | 'society'
  | 'knowledge' | 'science' | 'engineering' | 'energy' | 'computing' | 'media' | 'economy';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'hidden';

export type StoneAgeTier = 'olduvai' | 'middle' | 'late';

/** An unordered set of 2–5 ingredient ids that yields a discovery. Repeats are allowed
 *  (two stones); order never matters. Base data authors pairs; the processing layer
 *  (data/processing.json, lib/processing/overlay.ts) can raise them to 3, 4 or 5. */
export type Recipe = string[];

/** The things a hand can do to one resource. Which of them the player knows is decided by
 *  lib/processing/techniques.ts; what each does to what is data (data/processing.json);
 *  how each is performed is lib/craft/kinds.ts. */
export type ActionId =
  | 'brush' | 'smash' | 'cut' | 'separate' | 'dig'
  | 'carve' | 'scrape' | 'grind' | 'pull' | 'twist' | 'tie' | 'stretch' | 'mix' | 'shape'
  | 'pour' | 'heat' | 'cool' | 'dry' | 'burn' | 'hammer' | 'split' | 'press' | 'saw'
  | 'chisel' | 'polish';

/** A discovery that is made by working ONE resource with an action (Stone → Smash → …). */
export interface ProcessRoute { from: string; action: ActionId }

export interface Discovery {
  id: string;
  /** Catalogue number, 1–322. Stable; used as the plate number in the exhibit. */
  no: number;
  /** Display name. */
  n: string;
  era: EraId;
  cat: Category;
  /** Human-readable date, uncertainty preserved (e.g. "≈ 3.3 million years ago"). */
  date: string;
  /** Signed year for sorting; negative is BCE. Deep time uses large negatives. */
  ds: number;
  rar: Rarity;
  /** Level 1 — what it is, one line. */
  l1: string;
  /** Level 2 — why it matters. */
  l2: string;
  /** Level 3 — how we know. */
  l3: string;
  /** Evidence type label. */
  ev: string;
  /** Source ids into `Db.sources`. The literal 'source_required' means no
   *  subject-level source has been verified yet — see `Source.scope`. */
  src: string[];
  /** Every combination that produces this. More than one means alternative paths. */
  rec: Recipe[];
  tags: string[];
  /** Key into the glyph shape grammar. */
  vis: string;
  /** Scientific nuance or an active dispute. Rendered as a caution block. */
  caution?: string;
  primitive?: true;
  hidden?: true;
  /** Derived at build time — minimum crafting depth from the primitives. */
  depth: number | null;
  /** Derived at build time — size of a minimal derivation set. */
  need: number;
  /** Derived at build time — ids this node is an ingredient for. */
  uses: string[];
  /** Stone Age tier classification (olduvai/middle/late). */
  stone_age_tier?: StoneAgeTier;
  /** Derived by the processing layer: ways to make this by working a single resource. */
  via?: ProcessRoute[];
  /** A worked state of a resource (Cracked Stone, Stick, Clay…): held and used like a
   *  discovery, but never counted, numbered or drawn in the archive, graph or timeline. */
  state?: true;

  /* ── Shared cross-mode architecture ──────────────────────────────────────
     Fully additive and optional: no existing data/nodes/*.json entry sets
     any of these, and none has to for the game to build or play exactly as
     before. They exist so a future mode (Archaeology, Civilization's trade
     layer, Reverse Evolution, …) can read richer context off the SAME
     canonical Discovery instead of maintaining its own duplicate item
     table. See docs/ROADMAP-UNIVERSE.md. */

  /** Broad, historically defensible geographic/cultural region ids this
   *  discovery is associated with (data/majors.json's `regions`, when it
   *  applies) — never modern political borders, and never asserted for a
   *  discovery whose origin is genuinely uncertain or plausibly
   *  independent in more than one region. */
  regions?: string[];
  /** How settled the date/account above is — separate from `caution`
   *  (prose) so a mode can filter or badge by it without parsing text. */
  confidence?: { level: 'established' | 'debated' | 'uncertain'; note?: string };
  /** For discoveries that are physical objects: a coarse artifact category
   *  (e.g. "container", "cutting-tool", "structure") a Museum exhibit or an
   *  Archaeologist assemblage template can key off. */
  artifactType?: string;
  /** Coarse, comparable-across-materials physical properties (0–1 scales
   *  or short labels) — the same vocabulary lib/processing/physics.ts
   *  already derives for crafting, exposed here for modes that reason
   *  about materials without running the crafting engine (reverse
   *  engineering, alien material analysis). */
  physicalProperties?: Record<string, number | string>;
  /** How much this discovery plausibly moved between regions before local
   *  production was possible — the seed for Main Evolution's Trade Routes
   *  layer; never set for anything whose reach was essentially universal
   *  once known. */
  tradeImportance?: 'low' | 'medium' | 'high';
  /** Component/prerequisite discovery ids one level down, for Reverse
   *  Evolution's decomposition view. Defaults to the graph's own upstream
   *  edges (`rec`) when absent — set this only where the honest
   *  decomposition differs from "whatever this was crafted from" (e.g. an
   *  enabling technology that is not a physical part). */
  decomposition?: string[];
  /** How the Museum should frame an exhibit of this discovery when one is
   *  auto-generated. Absent means "no automatic exhibit yet". */
  museum?: { reconstructionStatus: 'reference' | 'procedural-fictional'; label?: string };
  /** Free-form, per-mode extension bag, keyed by ModeId (lib/modes/types.ts).
   *  A mode may stash anything it needs here without this file, or any
   *  other mode, having to know its shape. Never read by Main Evolution. */
  modeMeta?: Record<string, Record<string, unknown>>;
}

export interface Source {
  /** Tier S = primary institutional / peer-reviewed, A = major data or public body, B = reference. */
  t: 'S' | 'A' | 'B';
  title: string;
  org: string;
  url: string;
  type: string;
  /** 'topic' = a page about the entry's subject or field; 'general' = a homepage,
   *  portal or collection search, kept as background, never counted as evidence. */
  scope: 'topic' | 'general';
  /** ISO date the URL was last fetched and confirmed. */
  checked: string;
}

export interface Era {
  id: EraId;
  name: string;
  blurb: string;
}

export interface StoneAgeTierInfo {
  name: string;
  description: string;
  total_recipes: number;
  unlock_percentage: number;
}

export interface Db {
  version: number;
  /** sha256 of the authored inputs; identical in the single-file build. */
  dataHash: string;
  /** Most recent ISO date on which a source URL was confirmed. */
  sourcesChecked: string | null;
  primitives: string[];
  eras: Era[];
  categories: Category[];
  sources: Record<string, Source>;
  sourceNote: string;
  nodes: Discovery[];
  counts: { total: number; core: number; hidden: number; sourceRequired: number };
  stone_age_tiers?: Record<StoneAgeTier, StoneAgeTierInfo>;
  /** Worked and offered forms of resources (Stick, Clay…). Held like discoveries, never counted. */
  states?: Discovery[];
  /** The processing layer's run-time tables. Absent in the bare database. */
  proc?: import('./processing/types').Processing;
}

/** What an item still has to give: something makeable now, something later, or nothing. */
export type Potential = 'ready' | 'later' | 'done';

export interface TierGate {
  tier: StoneAgeTier;
  name: string;
  open: boolean;
  /** Discoveries made in the previous tier, and how many open this one. */
  have: number;
  need: number;
  prevTier: StoneAgeTier | null;
  prevName: string;
}

/** Why a set of things on the bench made nothing — never a name, never a recipe. */
export type FailKind =
  | 'same'             // two of one thing
  | 'far'              // separated by most of history
  | 'wrong_state'      // the idea is right, the material is not ready
  | 'needs_processing' // this may work once one material is worked first
  | 'incomplete'       // on the right road, but more components are needed
  | 'irrelevant'       // all but one of these belong; one does not
  | 'related'          // these are related, just not like this
  | 'none';

export interface FailInfo {
  kind: FailKind;
  /** The short line shown on the bench. */
  message: string;
  /** For 'incomplete': how many more pieces the nearest recipe would take (0 when it may not be said). */
  missing: number;
  /** For 'irrelevant' / 'wrong_state' / 'needs_processing': the id of the piece on the bench the message is about. */
  about: string | null;
  /** For 'needs_processing': the family of action that may help (never a recipe). */
  action: ActionId | null;
}

/** Why a brand-new discovery is blocked until a trade route reaches where it
 *  is documented to have first appeared — see lib/trade/gate.ts, the only
 *  place that constructs one. Shaped like EraGate/TierGate on purpose so the
 *  UI renders it the same way. Never produced for a discovery already held —
 *  once found, always found, exactly as era/tier gates already behave. */
export interface RegionLockInfo {
  homeRegion: GeoId;
  originRegion: GeoId;
  originLabel: string;
  civ: string | null;
  message: string;
}

interface Made {
  node: Discovery;
  /** Everything that went into it (a single piece for a process). */
  items: Discovery[];
  /** First two, for callers that still speak in pairs. */
  a: Discovery; b: Discovery;
  /** Worked from ONE resource with an action rather than assembled. */
  process?: ProcessRoute;
  /** A result already held, reached by a way not used before. */
  newRoute: boolean;
  routes: { found: number; total: number };
  /** Tiers this discovery opened. */
  opened: StoneAgeTier[];
  /** The hint target was just found after at least one hint. */
  solvedHint: boolean;
  /** Ways the player got right while their tier was still closed, which now work. */
  reopened: string[][];
  /** New materials the world offered as a consequence (Soil after the first Stick). */
  unlocked: Discovery[];
  /** The first thing found in its era: the player has arrived somewhere new. */
  firstOfEra: boolean;
  /** Set when this is one of the world's major inventions (see lib/world): it has a place on Earth. */
  major?: { id: string; tier: 'A' | 'B'; /** The era this find just completed, if it did. */ eraCompleted: EraId | null };
}

export type CombineResult =
  | ({ status: 'new' | 'known' } & Made)
  | { status: 'fail'; message: string; nudge: string | null; repeat: boolean; a: Discovery; b: Discovery; items: Discovery[]; info: FailInfo }
  | { status: 'tier_locked'; message: string; a: Discovery; b: Discovery; items: Discovery[]; requiredTier: StoneAgeTier; gate: TierGate }
  /** Right idea, but its era is still closed: the world has to finish the era before it first. */
  | { status: 'era_locked'; message: string; a: Discovery; b: Discovery; items: Discovery[]; gate: EraGate }
  /** Right idea, but no trade route reaches where it's documented to have first
   *  appeared — only ever produced when a regionGate was passed to the Engine
   *  (lib/trade/, off by default). See RegionLockInfo. */
  | { status: 'region_locked'; message: string; a: Discovery; b: Discovery; items: Discovery[]; region: RegionLockInfo }
  | { status: 'error' };

/** The answer to working one resource with one action. */
export type ProcessResult =
  | {
      status: 'done';
      action: ActionId;
      from: Discovery;
      /** Everything the work yielded, discoveries and states alike, in order. */
      outputs: Discovery[];
      /** One combine-shaped result for each yield that is a discovery (new or already known). */
      discoveries: Extract<CombineResult, { status: 'new' | 'known' }>[];
      /** States the player did not hold before. */
      fresh: Discovery[];
      unlocked: Discovery[];
      message: string;
      /** A small thing noticed while working: what the material is like. Once per insight. */
      insight?: { id: string; text: string; property: string };
    }
  | {
      status: 'nothing';
      action: ActionId;
      from: Discovery;
      /** Why: `material` (wrong for this material), `tool` (something is missing), `spent` (worked out),
       *  `locked` (the technique is not known yet). */
      reason: 'material' | 'tool' | 'spent' | 'locked';
      /** How the player should read the refusal: `impossible` (this material never does that),
       *  `close` (right material, the wrong action or order), `tool` (something is missing). */
      kind?: 'impossible' | 'close' | 'wrong_action' | 'tool' | 'spent' | 'locked';
      message: string;
      /** A second, gentler line — for `tool`, what kind of thing is missing. */
      note: string | null;
      insight?: { id: string; text: string; property: string };
    }
  | { status: 'tier_locked'; action: ActionId; from: Discovery; message: string; gate: TierGate }
  | { status: 'era_locked'; action: ActionId; from: Discovery; message: string; gate: EraGate }
  | { status: 'region_locked'; action: ActionId; from: Discovery; message: string; region: RegionLockInfo }
  | { status: 'error' };

export interface Stats {
  core: number; hidden: number; rare: number;
  coreTotal: number; hiddenTotal: number;
  combos: number; failed: number;
  eras: number; eraTotal: number;
  percent: number;
  deepest: Discovery;
  routesFound: number; routesTotal: number;
}

export interface TierProgress {
  olduvai: { unlocked: number; total: number };
  middle: { unlocked: number; total: number };
  late: { unlocked: number; total: number };
}

/** 'hub' is the Mode Hub — the switcher between Main Evolution and any other
 *  mode; see components/ModeHub.tsx. It is a peer of the other three, not a
 *  child of 'work': switching to it never touches bench/slot state. */
export type ViewId = 'work' | 'graph' | 'arch' | 'time' | 'hub';

/** What the hint line shows. Five levels, and the last is the only one that names a piece (never both):
 *  1 vague · 2 material (what the pieces are like) · 3 the kind of work · 4 a ghost hand, or how many pieces · 5 direct. */
export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;
export interface HintView {
  targetId: string | null;
  level: HintLevel;
  text: string;
  /** Inventory item to mark (level 3 only). */
  highlightId: string | null;
  /** The next level is available now. */
  canEscalate: boolean;
  /** Tries left before the next level opens. */
  triesNeeded: number;
  /** The player picked this target from the archive. */
  custom: boolean;
  /** Enough misses in a row that the bench should offer a nudge. */
  stuck: boolean;
  /** Action the hint leans on at level 3+ (for the hand animation on the bench). */
  action: ActionId | null;
  /** Level 4+: a faint hand shows this gesture on this piece, if it is on the bench. */
  ghost: { action: ActionId; from: string } | null;
  /** A word on HOW the player is playing (never what to make), when they have been stuck and no hint is open. */
  coach: string | null;
}
