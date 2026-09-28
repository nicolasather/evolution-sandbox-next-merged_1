/* ============================================================================
   RESEARCH NOTEBOOK DATA MODEL — foundation only. No screen reads this yet.
   It exists so the Experimentation system planned for Main Evolution, and
   the hypothesis-board reasoning in Archaeologist/Decipher/Alien
   Archaeology, can share one evidence vocabulary instead of three bespoke
   note formats. A concrete UI is out of scope for this pass — see
   docs/ROADMAP-UNIVERSE.md, Phase 2.

   Organised by investigation, not by timestamp: an Investigation groups the
   Evidence/Observations/Hypotheses that belong to one line of inquiry (one
   crafting experiment thread, one archaeological trench, one deciphered
   archive), the way the design brief asks for.
   ========================================================================== */

export type EvidenceKind =
  | 'experiment' | 'observation' | 'artifact' | 'text' | 'context' | 'measurement';

/** One piece of evidence: something the player actually did or found, never
 *  something the data model merely "knows". Notebook inference (see
 *  Hypothesis) may only draw on Evidence that exists in this save. */
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  /** Short player-facing line, e.g. "Fired wet clay at high heat — cracked." */
  summary: string;
  /** Structured detail for later comparison/graphing (material ids, variable
   *  values, outcome tags) — free-form on purpose; each mode defines its own
   *  shape here and reads it back, this module only carries it. */
  data?: Record<string, unknown>;
  recordedAt: number;
  sourceMode: string;
}

export interface Observation {
  id: string;
  investigationId: string;
  summary: string;
  evidenceIds: string[];
  recordedAt: number;
}

/** A claim the player (or an authored puzzle's evaluator) is willing to make,
 *  with its support and its confidence explicit — the "OBSERVED / INFERRED /
 *  UNKNOWN" discipline the brief asks for applies here: a Hypothesis is
 *  always the INFERRED column, never presented as fact. */
export interface Hypothesis {
  id: string;
  investigationId: string;
  claim: string;
  /** 0–1. Calibration, not correctness — a well-hedged "uncertain" can score
   *  better than a confident wrong guess in modes that grade this. */
  confidence: number;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  createdAt: number;
  revisedAt?: number;
}

export interface Investigation {
  id: string;
  title: string;
  sourceMode: string;
  createdAt: number;
  evidenceIds: string[];
  observationIds: string[];
  hypothesisIds: string[];
}
