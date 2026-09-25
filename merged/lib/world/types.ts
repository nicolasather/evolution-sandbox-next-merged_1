import type { EraId } from '../types';

/* ============================================================================
   WORLD — shapes for the Global Invention Progression system.

   A "major invention" is a discovery (a node of data/db.json) that also has a
   place on Earth. data/majors.json says which nodes those are, where they
   belong, how sure we are about it, and which ones an era needs before the
   next one opens. Everything else about a major — name, era, date, sources —
   is read from the node itself, so nothing is written down twice.
   ========================================================================== */

/** The continental groups the world map counts progress in. `global` = no single place. */
export type GeoId =
  | 'africa' | 'west_central_asia' | 'europe' | 'south_asia' | 'east_asia'
  | 'americas' | 'oceania_sea' | 'global';

/** How exactly the marker may be placed. Never claim more than the evidence does. */
export type Precision = 'site' | 'area' | 'region' | 'broad' | 'unlocated';

/** How sure the origin is. Drives the label on the reveal card, never the game logic. */
export type Certainty = 'firm' | 'regional' | 'debated' | 'multiple' | 'unknown';

/** A: the full cinematic. B: a shorter reveal. (Tier C — a repeat — is an event, not data.) */
export type MajorTier = 'A' | 'B';

export interface Place { lat: number; lon: number; label: string }

/** One entry of data/majors.json. */
export interface MajorDef {
  /** The db node this major belongs to. */
  id: string;
  tier: MajorTier;
  /** Needed for the era to be complete. Hidden nodes are never required. */
  required: boolean;
  lat: number;
  lon: number;
  precision: Precision;
  geo: GeoId;
  /** The place, as a person would say it. Region-level for contested origins. */
  region: string;
  /** Culture or people, when it is honest to name one. */
  civ: string | null;
  /** Historical period label for the card ("Bronze Age"). */
  period: string;
  certainty: Certainty;
  /** One short educational line. */
  fact: string;
  /** A longer note for the archive's inspect view. */
  more?: string;
  /** Other early centres, shown as quieter markers (multiple origins). */
  alsoAt?: Place[];
  /** Optional overrides — sensible defaults come from precision and tier. */
  marker?: 'pin' | 'ring' | 'halo';
  displayName?: string;
}

export interface MajorsFile {
  version: number;
  regions: { id: GeoId; name: string }[];
  majors: MajorDef[];
}

/** A major joined with what its node says. */
export interface Major extends MajorDef {
  name: string;
  era: EraId;
  hidden: boolean;
  /** The node's own human-readable date ("≈ 5,500 years ago onward"). */
  date: string;
  /** Signed year, for ordering. */
  ds: number;
  marker: 'pin' | 'ring' | 'halo';
}

/** One era's requirement, and where the player stands against it. */
export interface EraProgress {
  era: EraId;
  index: number;
  name: string;
  /** Required majors, and how many are found. */
  required: number;
  requiredDone: number;
  /** Optional majors that are not hidden. */
  optional: number;
  optionalDone: number;
  /** Optional majors that are hidden nodes — counted, never named, until found. */
  hidden: number;
  hiddenDone: number;
  /** 0–100 of the required set. An era with nothing required is 100. */
  percent: number;
  complete: boolean;
  /** Whether new discoveries of this era can be made yet. */
  open: boolean;
}

/** Why an era's recipes are closed, in numbers. `null` from the engine when nothing blocks. */
export interface EraGate {
  /** The era that is closed to the player. */
  era: EraId;
  eraName: string;
  /** The earlier era that has to be finished first (the first incomplete one). */
  blocker: EraId;
  blockerName: string;
  required: number;
  requiredDone: number;
  message: string;
}

export interface RegionProgress { id: GeoId; name: string; found: number; total: number }

export interface WorldSummary {
  found: number;
  total: number;
  requiredFound: number;
  requiredTotal: number;
  hiddenLeft: number;
  regions: RegionProgress[];
  /** How many of the continental groups have at least one major found. */
  regionsRepresented: number;
  regionsTotal: number;
}

/* ── what the engine tells the interface ─────────────────────────────── */

/** `A` full cinematic, `B` shorter, `C` a marker pulse only. */
export type MomentTier = 'A' | 'B' | 'C';

export type WorldEvent =
  | {
      kind: 'major';
      id: string;
      tier: MomentTier;
      /** The major found before this one, whose place the camera leaves from. */
      previousId: string | null;
      /** The first major ever found: the camera starts from a neutral view of the world. */
      first: boolean;
    }
  | { kind: 'era_complete'; era: EraId; next: EraId | null };

/** The slice of world state the engine keeps and saves. */
export interface WorldSave {
  /** Majors whose reveal has played (or been skipped, or was already in an older save). */
  seen: string[];
  /** Eras whose completion has been celebrated. */
  celebrated: EraId[];
  /** Eras up to this index are open regardless (older saves are never locked out of ground they already stand on). */
  floor: number;
}
