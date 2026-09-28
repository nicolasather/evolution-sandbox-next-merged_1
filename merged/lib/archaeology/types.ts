import type { Migratable } from '../save/types';

/* ============================================================================
   ARCHAEOLOGIST — "Recover". A third genuinely different interaction
   language: no crafting, no allocation sliders, no per-member task queue.
   The player spends three separate, scarce action budgets (survey,
   excavate, analyze) across a small fixed grid, then has to argue an
   interpretation from only the evidence they actually recovered — the
   loop the brief asks for (survey → trench → context → lab → hypothesis
   board → report → museum export), built as one coherent state machine
   rather than seven separate screens. See docs/ROADMAP-UNIVERSE.md's
   Phase 8 section for what this slice does and does not attempt.

   Every site is procedurally generated and entirely fictional — there is
   no claim here about a real place, culture or excavation. See
   lib/archaeology/memory.ts and lib/museum/types.ts's ExhibitProvenance.
   ========================================================================== */

/** The interpretation questions a finished dig argues for. Kept small and
 *  closed-form on purpose — this is about weighing real evidence, not a
 *  free-text guessing game. */
export type SiteFunction = 'seasonal-camp' | 'permanent-settlement' | 'workshop' | 'ceremonial-site';

/** A coarse relative-chronology phase, generated consistent with
 *  stratigraphy (deeper contexts are always earlier-phase or same-phase,
 *  never later). Deliberately not an absolute calendar date — the honest
 *  scope for this slice is relative dating from context, which is also
 *  the real methodological point being taught. */
export type SitePhase = 'early-occupation' | 'peak-occupation' | 'late-occupation';

/** How confidently a template's presence argues for each SiteFunction —
 *  0-1, real archaeological reasoning in miniature (knapping debris is
 *  strong workshop evidence; a hearth alone is weak evidence for anything
 *  in particular). See lib/archaeology/catalog.ts. Hidden from the player
 *  until a find is analyzed. */
export type FunctionAffinity = Partial<Record<SiteFunction, number>>;

export interface ArtifactTemplate {
  id: string;
  label: string;
  material: string;
  category: 'pottery' | 'lithic' | 'structural' | 'organic' | 'ornament' | 'ritual';
  /** One plain sentence a lab report can print once a find is analyzed. */
  commonFunction: string;
  affinity: FunctionAffinity;
  /** Relative placement weight during generation — never read after that. */
  rarity: number;
}

export interface FindAnalysis {
  material: string;
  likelyFunction: string;
  phaseEstimate: SitePhase;
  confidence: 'low' | 'medium' | 'high';
  affinity: FunctionAffinity;
}

export interface Find {
  id: string;
  templateId: string;
  squareX: number;
  squareY: number;
  /** 0 = shallowest/most recent context in this square's stratigraphy. */
  contextIndex: number;
  phase: SitePhase;
  preservation: 'poor' | 'fair' | 'good';
  analyzed: boolean;
  analysis?: FindAnalysis;
}

export interface Context {
  soil: string;
  phase: SitePhase;
  /** Ids into SiteState.finds embedded in this layer — empty for most
   *  contexts; a trench is mostly reading soil, not treasure hunting. */
  findIds: string[];
}

export type SurveyHint = 'unsurveyed' | 'none' | 'faint' | 'strong';

export interface Square {
  x: number;
  y: number;
  /** Top (index 0) to bottom, oldest last. Fixed at generation. */
  contexts: Context[];
  surveyHint: SurveyHint;
  /** How many contexts from the top have been excavated so far. */
  dugContexts: number;
}

export interface Budgets {
  survey: number;
  excavate: number;
  analyze: number;
}

export interface SiteTruth {
  function: SiteFunction;
  /** The phase best represented by the site's own densest evidence —
   *  what a thorough excavation would conclude, used only to grade the
   *  player's own period hypothesis at report time. */
  primaryPhase: SitePhase;
  /** One line of scene-setting flavour text, always fictional. */
  setting: string;
}

export type SiteEnding = 'ongoing' | 'reported';

export interface SiteEvent {
  text: string;
}

export interface Hypotheses {
  function?: SiteFunction;
  phase?: SitePhase;
}

export interface ReportVerdict {
  evidenceScore: number;
  verdict: 'well-supported' | 'plausible' | 'weak';
  functionMatchedTruth: boolean;
  phaseMatchedTruth: boolean;
  analyzedCount: number;
  reportText: string;
}

export interface SiteState {
  seed: string;
  gridSize: number;
  squares: Square[][];
  truth: SiteTruth;
  budgets: Budgets;
  spent: Budgets;
  finds: Find[];
  hypotheses: Hypotheses;
  ending: SiteEnding;
  report?: ReportVerdict;
  log: SiteEvent[];
}

export interface SiteMemory {
  id: string;
  seed: string;
  verdict: ReportVerdict['verdict'];
  functionLabel: SiteFunction;
  matchedTruth: boolean;
  headline: string;
  completedAt: number;
}

export interface ArchaeologySave extends Migratable {
  v: 1;
  active: SiteState | null;
  reports: SiteMemory[];
}
