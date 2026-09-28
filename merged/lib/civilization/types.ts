import type { Migratable } from '../save/types';

/* ============================================================================
   CIVILIZATION — "Build". A genuinely different interaction language from
   both Main Evolution (crafting) and Survival (per-member spatial tasks):
   the player sets population-wide allocation policy each turn and watches
   the settlement's own growth generate the next pressure — never places or
   directly controls an individual. See docs/ROADMAP-UNIVERSE.md's Phase 7
   section for what this slice does and does not attempt.
   ========================================================================== */

/** Fractions of population effort, always summing to 1. */
export interface Allocation {
  food: number;
  construction: number;
  knowledge: number;
}

/** Standing pressures the settlement's own structure creates — recomputed
 *  fresh from current state every turn, never a scripted one-off popup. A
 *  famine is an acute shock, not a standing condition, so it is a log entry
 *  (see SettlementEvent) rather than a Problem. */
export type ProblemKind = 'water-labor' | 'land-shortage' | 'storage-shortage';

export interface Problem {
  kind: ProblemKind;
  /** The year this pressure first appeared — a problem is never a one-off
   *  popup; it stays visible for as long as the condition holds. */
  since: number;
}

export interface Milestones {
  firstStorage?: true;
  irrigationComplete?: true;
}

export type SettlementEnding = 'ongoing' | 'resilient' | 'collapsed';

export interface SettlementEvent {
  year: number;
  text: string;
}

export interface SettlementState {
  seed: string;
  year: number;
  turn: number;
  maxTurns: number;
  population: number;
  targetPopulation: number;
  allocation: Allocation;
  /** Capacity units of farmable land — `irrigated` only counts once the
   *  irrigation project completes. Both are a hard ceiling on food
   *  production regardless of labor, standing in for real land limits. */
  farmland: { base: number; irrigated: number };
  storageCapacity: number;
  foodStock: number;
  materialStock: number;
  knowledgeStock: number;
  /** 0–1: combined knowledge + construction investment toward irrigation. */
  irrigationProgress: number;
  problems: Problem[];
  milestones: Milestones;
  ending: SettlementEnding;
  log: SettlementEvent[];
}

export interface SettlementMemory {
  id: string;
  seed: string;
  ending: 'resilient' | 'collapsed';
  population: number;
  years: number;
  headline: string;
  completedAt: number;
}

export interface CivilizationSave extends Migratable {
  v: 1;
  active: SettlementState | null;
  dioramas: SettlementMemory[];
}
