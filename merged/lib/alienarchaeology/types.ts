import type { Migratable } from '../save/types';

/* ============================================================================
   ALIEN ARCHAEOLOGY — "Unknown Worlds". A sixth genuinely different
   interaction language, and the one mode gated behind Phases 8-10's
   evidence architecture per docs/ROADMAP-UNIVERSE.md, which it reuses in
   spirit (recover specimens, weigh evidence, write a hypothesis) while
   changing what "done" means: human Archaeologist (Phase 8) and Decipher
   (Phase 9) both have a single hidden ground truth a thorough player CAN
   fully prove. Here the deliberate epistemic point is that a nonhuman
   civilization's biology, social structure and purpose may never be
   fully knowable from ruins alone — so this mode is never graded
   right/wrong. It is graded on calibration: how well the player's
   stated CONFIDENCE matched how right they actually were, the same
   "OBSERVED / INFERRED / UNKNOWN, never presented as fact" discipline
   lib/notebook/types.ts's Hypothesis.confidence already codifies. This
   is that field's first real numeric consumer.
   ========================================================================== */

export type LimbCount = '2' | '3' | '4' | '6';
export type SocialStructure = 'solitary' | 'paired' | 'collective';
export type SitePurpose = 'habitation' | 'gathering' | 'processing' | 'ritual';

export type AxisId = 'limbCount' | 'social' | 'purpose';
export type AxisValue = LimbCount | SocialStructure | SitePurpose;

export interface AxisEvidence {
  limbCount?: Partial<Record<LimbCount, number>>;
  social?: Partial<Record<SocialStructure, number>>;
  purpose?: Partial<Record<SitePurpose, number>>;
}

export interface SpecimenTemplate {
  id: string;
  description: string;
  /** Deliberately imperfect: real specimens rarely point at only one
   *  answer per axis, and not every specimen is informative on every
   *  axis — unlike lib/archaeology/catalog.ts's templates, these
   *  weights are authored to never fully resolve on their own. */
  evidence: AxisEvidence;
}

export interface Specimen {
  id: string;
  templateId: string;
  revealed: boolean;
}

export interface SiteTruth {
  limbCount: LimbCount;
  social: SocialStructure;
  purpose: SitePurpose;
  /** One line of scene-setting flavour text, always fictional. */
  setting: string;
}

export interface Hypotheses {
  limbCount?: LimbCount;
  social?: SocialStructure;
  purpose?: SitePurpose;
}

/** 0–1, same scale and meaning as lib/notebook's Hypothesis.confidence. */
export type Confidences = Partial<Record<AxisId, number>>;

export interface AxisResult {
  axis: AxisId;
  hypothesis: AxisValue;
  confidence: number;
  truth: AxisValue;
  matched: boolean;
  /** The calibration credit for this axis: `matched ? confidence : (1 - confidence)`. */
  calibrationScore: number;
}

export interface FieldReport {
  axisResults: AxisResult[];
  overallCalibration: number;
  reportText: string;
}

export type SiteEnding = 'ongoing' | 'reported';

export interface SiteEvent { text: string }

export interface AlienSiteState {
  seed: string;
  specimens: Specimen[];
  truth: SiteTruth;
  hypotheses: Hypotheses;
  confidences: Confidences;
  ending: SiteEnding;
  report?: FieldReport;
  log: SiteEvent[];
}

export interface AlienMemory {
  id: string;
  seed: string;
  overallCalibration: number;
  headline: string;
  completedAt: number;
}

export interface AlienArchaeologySave extends Migratable {
  v: 1;
  active: AlienSiteState | null;
  reports: AlienMemory[];
}
