/** Shapes of the discovery database. Mirrors data/sources.json + data/nodes/*.json. */
import type { EraGate } from './world/types';

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

export type ViewId = 'work' | 'graph' | 'arch' | 'time';

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
