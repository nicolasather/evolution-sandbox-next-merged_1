/* ============================================================================
   CIVILIZATION: LIFELINES — shared types.

   Two groups live here:
   1. CONTENT types — the shape of data/civilization/lifelines.v1.json. They are
      only ever produced by the validator in content.ts, never by a bare cast.
   2. RUNTIME types — the district-layer simulation state (engine.ts), its
      commands and domain events, and the persisted envelope (save.ts).

   Quantities in CONTENT are plain "abstract service units". Quantities in
   RUNTIME state are fixed-point MILLI-units (1 unit = 1000), always integers,
   so replays are bit-exact and a rendered "4" can never hide a stored 3.96.
   ========================================================================== */

export const RESOURCE_IDS = [
  'food', 'water', 'materials', 'energy', 'knowledge', 'health',
  'shelter', 'logistics', 'ecology', 'trust', 'culture', 'resilience',
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

/** Content-side quantities, in display units. */
export type Quantities = Partial<Record<ResourceId, number>>;
/** Runtime quantities, in integer milli-units. */
export type MilliQuantities = Partial<Record<ResourceId, number>>;
export type Stocks = Record<ResourceId, number>;

/* ------------------------------ content ---------------------------------- */

export interface Era { id: string; index: number; name: string; narration: string; dateRange: null }
export interface ResourceRow { id: ResourceId; name: string; unit: string; capacity: number; historicalClaim: false }
export interface Biome {
  id: string; name: string; multipliers: Quantities; pressure: string; palette: string; provenance: string;
}
export interface Project {
  id: string; name: string; sector: ResourceId; era: number; purpose: string; tradeoff: string;
  cost: Quantities; output: Quantities; upkeep: Quantities; requires: string[]; maxCopies: 1;
  visual: { family: ResourceId; stage: number; reveal: string; anchor: string };
  provenance: { kind: 'game-design'; historicalStatus: 'unverified-concept'; sourceIds: string[] };
  codex: string;
}
export interface Policy {
  id: string; name: string; sector: ResourceId; output: Quantities; upkeep: Quantities;
  tradeoff: string; exclusiveGroup: ResourceId; slots: number;
}
export interface EventChoice { id: string; label: string; cost: Quantities; delta: Quantities; consequence: string }
export interface PressureEvent {
  id: string; title: string; sector: ResourceId; body: string; minEra: number; cooldown: number;
  choices: EventChoice[]; provenance: string;
}
export interface Chapter {
  id: string; order: number; title: string; era: number; focus: ResourceId; recommendedBiome: string;
  brief: string; lesson: string; targetProjectId: string; objectiveIds: string[];
  previousChapterId: string | null; narration: { intro: string; success: string; warning: string };
  historicalClaim: false;
}
export interface Variant {
  id: string; chapterId: string; biomeId: string; seed: string; classification: 'generated-replay-variant';
  maxTurns: number; startingStock: Record<ResourceId, number>;
}
export type Objective =
  | { id: string; chapterId: string; kind: 'build'; projectId: string; target: number; text: string }
  | { id: string; chapterId: string; kind: 'stock'; resource: ResourceId; target: number; text: string }
  | { id: string; chapterId: string; kind: 'turn'; target: number; text: string };
export interface Hint { id: string; projectId: string; level: 1 | 2 | 3; text: string; classification: string }
export interface Rules {
  actionsPerTurn: number; policySlots: number; stockCap: number; eventEvery: number;
  baseOutput: Quantities; consumption: Quantities; shortageMode: 'warnings-only';
}
export interface ContentDatabase {
  schemaVersion: 1; contentVersion: string; balanceStatus: string; historicalStatus: string;
  eras: Era[]; resources: ResourceRow[]; biomes: Biome[]; projects: Project[]; policies: Policy[];
  events: PressureEvent[]; chapters: Chapter[]; objectives: Objective[]; hints: Hint[]; variants: Variant[];
  rules: Rules;
  manifest: {
    counts: Record<string, number>; authoredConceptRows: number; generatedRows: number;
    uniqueAuthoredChapters: number; replayVariantCount: number; note: string;
  };
}

/** Indexed, validated, deeply frozen content. Built once by content.ts. */
export interface ContentIndex {
  db: ContentDatabase;
  resources: ReadonlyMap<string, ResourceRow>;
  projects: ReadonlyMap<string, Project>;
  policies: ReadonlyMap<string, Policy>;
  events: ReadonlyMap<string, PressureEvent>;
  chapters: ReadonlyMap<string, Chapter>;
  biomes: ReadonlyMap<string, Biome>;
  variants: ReadonlyMap<string, Variant>;
  objectives: ReadonlyMap<string, Objective>;
  eras: ReadonlyMap<number, Era>;
  hintsByProject: ReadonlyMap<string, readonly Hint[]>;
  chaptersByOrder: readonly Chapter[];
}

/* ------------------------------ districts -------------------------------- */

export type LinkType = 'path' | 'channel' | 'power' | 'knowledge';
export type TerrainTag = 'flat' | 'fertile' | 'water' | 'upland' | 'wild';

export interface District {
  id: string;
  name: string;
  /** Position on the 1000×560 diorama canvas. A visual anchor only: the data layer never reads it. */
  anchor: { x: number; y: number };
  terrain: TerrainTag[];
  /** Exactly one district per layout is the shared store (reserve stocks sit there). */
  storage: boolean;
  /** Per service, this district's share of settlement demand, in milli (sums to 1000 across districts). */
  demandWeights: Record<ResourceId, number>;
  /** Per service, this district's share of baseline production, in milli (sums to 1000 across districts). */
  supplyWeights: Record<ResourceId, number>;
}
export interface Link {
  id: string;
  type: LinkType;
  /** Endpoint order only matters when `directed` is true (flow runs a→b). */
  a: string;
  b: string;
  directed: boolean;
  /** Milli-units of traffic per season at full condition. */
  capacity: number;
  /** 0–1000. Effective capacity is capacity × condition / 1000. */
  condition: number;
  supports: ResourceId[];
}
export interface PotentialLink {
  id: string; type: LinkType; a: string; b: string; capacity: number; supports: ResourceId[];
  cost: MilliQuantities;
}
export interface Layout {
  generator: { version: 1; attempt: number; fallbackUsed: boolean };
  districts: District[];
  links: Link[];
  potentialLinks: PotentialLink[];
  /** Ids chosen by the generator for teaching; null in the first chapters. */
  bottleneckLinkId: string | null;
  alternateLinkId: string | null;
}

/* ------------------------------ run state -------------------------------- */

export type QueueStatus = 'waiting' | 'active' | 'completed' | 'cancelled';
export interface QueueItem {
  queueId: string;
  projectId: string;
  districtId: string;
  /** Costs reserved once at confirmation, in milli. Refunds read THIS, never the catalogue. */
  committed: MilliQuantities;
  workRequired: number;
  workDone: number;
  startTurn: number;
  /** The season index in which this item first received work; null while no work has happened. */
  firstWorkTurn: number | null;
  status: QueueStatus;
}
export interface BuiltProgramme {
  instanceId: string;
  projectId: string;
  districtId: string;
  /** 400–1000. Output scales by condition/1000; falls only through explicit unmet upkeep. */
  condition: number;
  completedTurn: number;
  /** The queue item it came from, so its committed cost stays inspectable for repairs. */
  queueId: string;
  committedMaterials: number;
}
export interface PolicyChoice { id: string; districtId: string | null }

export interface LedgerRow {
  resource: ResourceId;
  start: number;
  /** Net of every command (costs, refunds, gathers, event responses) since the previous season. */
  transfers: number;
  /** Effect-family credits (loop returns). */
  effects: number;
  produced: number;
  stranded: number;
  overflow: number;
  demand: number;
  upkeep: number;
  unmetDemand: number;
  unmetUpkeep: number;
  /** Flow detail: used straight from production, drawn from reserve, added to reserve. */
  direct: number;
  fromStore: number;
  toStore: number;
  end: number;
}
export interface EffectLine { label: string; resource: ResourceId; amount: number }
export interface DistrictNeed { districtId: string; resource: ResourceId; unmet: number; upkeepUnmet: number }
export interface LinkFlow { linkId: string; service: ResourceId; from: string; to: string; amount: number }
export type WarningCause = 'network' | 'supply';
export interface Warning {
  resource: ResourceId;
  deficit: number;
  cause: WarningCause;
  districts: { districtId: string; unmet: number }[];
  /** For network warnings: the saturated link that explains the shortfall. */
  bottleneckLinkId: string | null;
}
export interface SeasonReport {
  turn: number;
  ledger: LedgerRow[];
  effectLines: EffectLine[];
  needs: DistrictNeed[];
  flows: LinkFlow[];
  warnings: Warning[];
  completed: { queueId: string; projectId: string; districtId: string }[];
  /** Per queue item, what happened this season (for the forecast's construction lines). */
  work: { queueId: string; effort: number; remaining: number }[];
}

export interface ResolvedEvent { eventId: string; choiceId: string; turn: number; revision: number; districtId: string }
export interface PlanningDecision { kind: 'policies' | 'routing'; turn: number; revision: number; ids: string[] }
export interface Flags { forecastViewed: boolean; firstProgrammeSeen: boolean; eventResolved: boolean }

export type RunMode = 'campaign' | 'sandbox';
export type RunStatus = 'active' | 'completed' | 'archived';

export interface LifelinesState {
  schemaVersion: 2;
  engine: 'district';
  contentVersion: string;
  rulesVersion: string;
  runId: string;
  revision: number;
  mode: RunMode;
  variantId: string;
  seed: string;
  chapterId: string;
  biomeId: string;
  era: number;
  turn: number;
  actionsLeft: number;
  /** milli-units */
  stocks: Stocks;
  /** Stocks at the end of the previous season (the ledger's `start`). */
  seasonStartStocks: Stocks;
  /** Net command movements since the previous season, per resource. */
  transfers: Stocks;
  layout: Layout;
  built: BuiltProgramme[];
  queue: QueueItem[];
  policies: PolicyChoice[];
  routingPriority: ResourceId | null;
  pendingEventId: string | null;
  pendingEventDistrictId: string | null;
  eventHistory: { id: string; turn: number }[];
  resolvedEvents: ResolvedEvent[];
  decisions: PlanningDecision[];
  report: SeasonReport | null;
  objectiveIds: string[];
  completion: { status: RunStatus; completedAtTurn: number | null; completionKey: string | null };
  horizonReached: boolean;
  flags: Flags;
  lastProgressTurn: number;
  hintsUsed: number;
  emergencyUsedTurn: number | null;
  emergencyCount: number;
  nextQueueNumber: number;
  /** Service groups of every policy that was active during a committed season (for mastery). */
  policyGroupsUsed: ResourceId[];
  alternateBuilt: boolean;
  masteryDeclared: string[];
  log: { turn: number; text: string }[];
}

/* ------------------------------ commands --------------------------------- */

export type Command =
  | { type: 'queue-programme'; projectId: string; districtId: string }
  | { type: 'cancel-queue'; queueId: string }
  | { type: 'set-policies'; policies: PolicyChoice[] }
  | { type: 'set-routing'; service: ResourceId | null }
  | { type: 'gather'; resource: 'materials' | 'knowledge' | 'food' | 'water' }
  | { type: 'repair-link'; linkId: string }
  | { type: 'build-link'; potentialLinkId: string }
  | { type: 'repair-programme'; instanceId: string }
  | { type: 'resolve-event'; choiceId: string }
  | { type: 'ack-forecast' }
  | { type: 'note-hint' }
  | { type: 'advance' }
  | { type: 'archive' };

export type CommandWithGuard = Command & { expectedRevision?: number };

export type DomainEvent =
  | { type: 'programme-queued'; queueId: string; projectId: string; districtId: string }
  | { type: 'programme-cancelled'; queueId: string; refunded: MilliQuantities }
  | { type: 'programme-completed'; queueId: string; projectId: string; districtId: string }
  | { type: 'link-repaired'; linkId: string }
  | { type: 'link-built'; linkId: string }
  | { type: 'pressure-new'; resource: ResourceId; cause: WarningCause }
  | { type: 'pressure-cleared'; resource: ResourceId }
  | { type: 'event-scheduled'; eventId: string; districtId: string }
  | { type: 'event-resolved'; eventId: string; choiceId: string }
  | { type: 'season-advanced'; turn: number }
  | { type: 'horizon-reached'; turn: number }
  | { type: 'chapter-completed'; chapterId: string; completionKey: string; turn: number; mode: RunMode }
  | { type: 'run-archived'; runId: string; chapterId: string; turn: number };

export interface ReduceResult { state: LifelinesState; events: DomainEvent[] }

/* ------------------------------- errors ---------------------------------- */

export class RuleError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'RuleError'; this.code = code; }
}
export function requireRule(ok: unknown, code: string): asserts ok {
  if (!ok) throw new RuleError(code);
}

/* ---------------------------- constants ---------------------------------- */

/** Fixed-point scale: 1 display unit = 1000 milli-units. */
export const MILLI = 1000;
export const RULES_VERSION = 'lifelines-rules-1';
export const SAVE_KEY = 'evo.civilization.lifelines.v2';
export const CAMPAIGN_KEY = 'evo.civilization.lifelines.campaign.v2';
