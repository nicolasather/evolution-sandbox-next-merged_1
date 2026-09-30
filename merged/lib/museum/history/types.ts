import type { EraId } from '../../types';
import type { GeoId } from '../../world/types';

/* ============================================================================
   HUMANITY MUSEUM — the canonical, curated history layer.

   This is ONE of three deliberately separate kinds of player-facing knowledge
   (see lib/museum/README.md):

     1. PERSONAL DISCOVERIES  (lib/museum/personal/)  what THIS player crafted
        or discovered in Main Evolution. Derived from the engine's own save.
     2. HUMANITY MUSEUM       (this folder)            canonical real-world
        achievements, unlocked ONLY by the canonical timeline position —
        never by inventory contents.
     3. MODE ARCHIVES         (lib/museum/archive/)    records the player's
        activities in extra modes produced (expedition records, excavation
        reports, decoded tablets…).

   Nothing in this file knows about the crafting inventory. Exhibit content is
   structured data under data/museum/ — never hard-coded presentation text in
   a React component — so an entry can be reviewed, corrected or expanded
   without touching the rendering system.

   Honesty rules the schema is built to enforce:
   - dates are approximate by default: `when` carries a range, a precision,
     a basis ("earliest evidence" is not "invented in") and optional ±;
   - geography is plural: `regions` lists every region with a role, so an
     independent invention in two places is two `independent` links, never
     one civilisation credited with everything;
   - `uncertainty` records scholarly disagreement instead of hiding it;
   - `sources.status` is 'source_required' until a real, checked source id
     from data/sources.json underwrites the entry — no URL is ever invented.
   ========================================================================== */

/** Signed year: negative is BCE, 0 is treated as 1 BCE/1 CE boundary, deep time uses large negatives. */
export type Year = number;

/** How much of human history an exhibit weighs. Drives space, light and choreography. */
export type ExhibitImportance = 'supporting' | 'milestone' | 'breakthrough' | 'defining';

export const IMPORTANCE_ORDER: Record<ExhibitImportance, number> = {
  supporting: 0, milestone: 1, breakthrough: 2, defining: 3,
};

export type ExhibitCategory =
  | 'human-evolution' | 'survival' | 'agriculture' | 'materials' | 'architecture'
  | 'transportation' | 'communication' | 'writing' | 'mathematics' | 'medicine'
  | 'engineering' | 'navigation' | 'governance' | 'trade' | 'energy' | 'warfare'
  | 'manufacturing' | 'astronomy' | 'physics' | 'chemistry' | 'biology'
  | 'computing' | 'aviation' | 'space' | 'culture' | 'knowledge';

export const CATEGORIES: readonly ExhibitCategory[] = [
  'human-evolution', 'survival', 'agriculture', 'materials', 'architecture',
  'transportation', 'communication', 'writing', 'mathematics', 'medicine',
  'engineering', 'navigation', 'governance', 'trade', 'energy', 'warfare',
  'manufacturing', 'astronomy', 'physics', 'chemistry', 'biology',
  'computing', 'aviation', 'space', 'culture', 'knowledge',
];

/** Coarse resolution of a date. Deep prehistory is never shown to the year. */
export type DatePrecision = 'deep-time' | 'millennia' | 'centuries' | 'decades' | 'year';

/** What kind of claim the date is making. */
export type DateBasis =
  | 'earliest-evidence'   // the oldest surviving evidence; the thing may be older
  | 'range-of-emergence'  // emerged gradually across this range
  | 'dated-event'         // a documented event (a demonstration, a publication, a launch)
  | 'traditional'         // a traditional/received date that scholars treat with caution
  | 'estimate';           // a modelled or indirect estimate (genetics, dating models)

export interface HistoricalDate {
  /** Earliest accepted start of the range (signed year). */
  from: Year;
  /** End of the range, when it is one. Omitted for a point event. */
  to?: Year;
  /** Representative year for placing and ordering. Defaults to `from`. */
  anchor?: Year;
  /** Human wording with the uncertainty preserved, e.g. "c. 3350–3200 BCE". */
  display: string;
  precision: DatePrecision;
  basis: DateBasis;
  /** Symmetric uncertainty around the anchor, in years, when a single figure is honest. */
  plusMinus?: number;
}

/** Why a region is attached to an exhibit. */
export type RegionRole =
  | 'origin'        // the (single) place of origin, where the evidence supports one
  | 'independent'   // one of several independent origins
  | 'early-centre'  // an early centre of the practice, origin not claimed
  | 'spread'        // where it travelled to / was adopted
  | 'site';         // a key site or find-spot illustrating it

export interface RegionLink {
  /** Id in data/museum/regions.json. */
  region: string;
  role: RegionRole;
  /** A specific site, when the evidence genuinely points at one. */
  site?: { label: string; lat: number; lon: number };
  note?: string;
}

export interface MuseumRegion {
  id: string;
  label: string;
  /** The continental group the game's world map already counts in. */
  geo: GeoId;
  lat: number;
  lon: number;
}

/** How settled the account is. Separate from the prose so the UI can badge it. */
export interface ExhibitUncertainty {
  level: 'settled' | 'approximate' | 'debated' | 'contested';
  /** Plain statement of what is uncertain or disputed. */
  note?: string;
}

export interface ExhibitSources {
  /** Ids into data/sources.json — only real, checked sources. */
  ids?: string[];
  /** 'cited' only when `ids` really underwrite the entry. */
  status: 'cited' | 'source_required';
  /** Free-text pointer for reviewers (e.g. the find, the excavation, the standard reference). Never a URL. */
  note?: string;
}

/** Historical influence/context — NOT a recipe. "What knowledge made this thinkable/possible." */
export interface ExhibitRelations {
  /** Earlier exhibits whose knowledge or technique this built on. The inverse ("enabled") is derived. */
  enabledBy?: string[];
  /** Associated exhibits that are neither ancestor nor descendant (parallel developments, same story). */
  related?: string[];
}

/** The line-art object drawn for an exhibit (components/museum/MotifArt.tsx). */
export type Motif =
  | 'skull' | 'footprints' | 'pebble-tool' | 'handaxe' | 'flame' | 'spear' | 'hand-stencil' | 'bead'
  | 'figurine' | 'flute' | 'needle' | 'bow' | 'hook' | 'boat' | 'dog' | 'pot' | 'wheat' | 'rice'
  | 'maize' | 'animal' | 'house' | 'wall' | 'pillar' | 'furnace' | 'ingot' | 'wheel' | 'horse'
  | 'plough' | 'tablet' | 'glyph' | 'papyrus' | 'pyramid' | 'ziggurat' | 'grid-city' | 'stele'
  | 'scales' | 'coin' | 'alphabet' | 'sword' | 'column' | 'scroll' | 'book' | 'arch' | 'aqueduct'
  | 'road' | 'gear' | 'astrolabe' | 'numerals' | 'compass' | 'sail' | 'star-path' | 'lens'
  | 'clock' | 'press' | 'globe' | 'telescope' | 'orbit' | 'microscope' | 'flask' | 'engine'
  | 'loom' | 'rail' | 'bolt' | 'wire' | 'bulb' | 'wave' | 'car' | 'plane' | 'atom' | 'helix'
  | 'vial' | 'rocket' | 'satellite' | 'chip' | 'computer' | 'network' | 'phone' | 'dam' | 'bridge'
  | 'calendar' | 'map' | 'dome' | 'tower' | 'eye' | 'seed' | 'textile' | 'kiln' | 'abacus' | 'mask';

/** How a major exhibit performs when it comes into focus. Presentation hints, not separate apps. */
export type Choreography =
  | 'assemble'   // the reconstruction builds itself stroke by stroke / piece by piece
  | 'ignite'     // light grows from a point (fire, electricity, stars)
  | 'mechanism'  // internal parts move (engines, clocks, looms)
  | 'ascend'     // vertical scale and depth (flight, spaceflight)
  | 'network'    // the surrounding space turns into nodes and links (computing)
  | 'unfold'     // a surface opens (writing, printing, maps)
  | 'orbit'      // bodies circle (astronomy, physics)
  | 'scan'       // a line of light reads the object (science, medicine)
  | 'grow'       // rises from the ground (agriculture, cities)
  | 'wave'       // ripples travel outward (sound, radio, telephony)
  | 'stratum';   // emerges from sediment (deep prehistory)

/** Physical form of the display in the hall. */
export type DisplayForm =
  | 'vitrine'     // small case (supporting)
  | 'pedestal'    // object on a plinth (milestone)
  | 'suspended'   // hanging in the air, lit from above (breakthrough)
  | 'monument'    // large architectural installation (defining)
  | 'scene';      // environmental reconstruction

export interface ExhibitDisplay {
  motif: Motif;
  choreography?: Choreography;
  /** Defaults from importance (supporting→vitrine … defining→monument). */
  form?: DisplayForm;
}

/** One canonical, real-world achievement on display. */
export interface HistoricalExhibit {
  id: string;
  /** Very short display title (a plaque, not a sentence). */
  title: string;
  /** Gallery id in data/museum/galleries.json. */
  gallery: string;
  when: HistoricalDate;
  /** Timeline year at which this becomes historically available. Defaults to `when.from`. */
  unlockAt?: Year;
  regions: RegionLink[];
  /** Culture or civilisation, only when it is honest to name one. */
  culture?: string;
  /** First entry is the primary category. */
  categories: ExhibitCategory[];
  importance: ExhibitImportance;
  /** One line: what changed. */
  change: string;
  /** Expandable historical explanation. */
  context: string;
  /** Why it mattered. */
  significance: string;
  uncertainty?: ExhibitUncertainty;
  relations: ExhibitRelations;
  sources: ExhibitSources;
  display: ExhibitDisplay;
  /** Main Evolution discovery ids this corresponds to — used ONLY for the optional
   *  "your path" comparison annotation, never for unlocking. */
  discoveryIds?: string[];
}

/** Physical language of a gallery. The whole Museum stays one space; this only
 *  shifts materials, geometry and light as history advances. */
export type Architecture =
  | 'cave' | 'stone' | 'earth' | 'mudbrick' | 'bronze' | 'marble'
  | 'timber' | 'iron' | 'glass' | 'light' | 'grid';

export interface Gallery {
  id: string;
  title: string;
  /** Short epigraph shown once the gallery is open (never while sealed). */
  epigraph: string;
  /** Historical span the gallery covers. */
  span: { from: Year; to: Year };
  architecture: Architecture;
  /** Base hue (0–360) for the gallery's light. */
  hue: number;
}

/** How the game's era progression maps onto the historical axis. */
export interface CalendarEra {
  era: EraId;
  /** Timeline year when this era's progress begins. */
  from: Year;
  /** Timeline year reached when the era's required majors are complete. */
  to: Year;
  note?: string;
}

export interface MuseumCalendar {
  /** Where the canonical timeline stands on a brand-new game. */
  start: Year;
  /** The present day — the far end of the museum. */
  present: Year;
  /** How much within-era progress comes from required majors vs. every discovery of that era. */
  weights: { required: number; all: number };
  eras: CalendarEra[];
}

/** One step of the curated "Human Story" route. */
export interface StoryChapter {
  id: string;
  exhibit: string;
  /** A single cinematic line. */
  line: string;
}

export interface MuseumStory {
  title: string;
  chapters: StoryChapter[];
}

/* ── derived, per-save state ─────────────────────────────────────────────── */

/** The four states an exhibit moves through — deliberately NOT one boolean.
 *  An exhibit can be historically available (eligible) and still unseen. */
export interface ExhibitState {
  /** Timeline first passed its unlock point (epoch ms). */
  eligibleAt?: number;
  /** Timeline year at which it became eligible. */
  eligibleYear?: Year;
  /** It has been shown to the player in the Museum (lit in the hall or in a reveal). */
  revealedAt?: number;
  /** The player focused/visited the display. */
  visitedAt?: number;
  /** The player opened the deeper explanation. */
  detailOpenedAt?: number;
}

export interface GalleryState {
  openedAt?: number;
  /** The "new gallery" cinematic has played (or been skipped). */
  revealedAt?: number;
}

export interface MuseumMetrics {
  available: number;
  total: number;
  revealed: number;
  visited: number;
  detailOpened: number;
  majorAvailable: number;
  majorEncountered: number;
  galleriesOpen: number;
  galleriesTotal: number;
  /** Distinct geographic groups represented by available exhibits. */
  regionsRepresented: number;
}
