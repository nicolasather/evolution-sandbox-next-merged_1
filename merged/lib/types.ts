/** Shapes of the discovery database. Mirrors data/sources.json + data/nodes/*.json. */

export type EraId =
  | 'origins' | 'fire' | 'settlement' | 'agriculture' | 'civilization' | 'trade'
  | 'metallurgy' | 'science' | 'industry' | 'electric' | 'computing'
  | 'network' | 'games' | 'simulation';

export type Category =
  | 'material' | 'technique' | 'technology' | 'biology' | 'culture' | 'society'
  | 'knowledge' | 'science' | 'engineering' | 'energy' | 'computing' | 'media' | 'economy';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'hidden';

export type StoneAgeTier = 'olduvai' | 'middle' | 'late';

/** An unordered pair of ingredient ids that yields a discovery. */
export type Recipe = [string, string];

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

export type CombineResult =
  | {
      status: 'new' | 'known'; node: Discovery; a: Discovery; b: Discovery;
      /** A result already held, reached by a pair not used before. */
      newRoute: boolean;
      routes: { found: number; total: number };
      /** Tiers this discovery opened. */
      opened: StoneAgeTier[];
      /** The hint target was just found after at least one hint. */
      solvedHint: boolean;
      /** Pairs the player got right while their tier was still closed, which now work. */
      reopened: [string, string][];
    }
  | { status: 'fail'; message: string; nudge: string | null; repeat: boolean; a: Discovery; b: Discovery }
  | { status: 'tier_locked'; message: string; a: Discovery; b: Discovery; requiredTier: StoneAgeTier; gate: TierGate }
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

/** What the hint line shows. Level 1 is a direction, 2 the idea, 3 one ingredient — never both. */
export interface HintView {
  targetId: string | null;
  level: 0 | 1 | 2 | 3;
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
}
