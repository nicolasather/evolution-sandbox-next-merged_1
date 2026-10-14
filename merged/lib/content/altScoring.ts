import type { AltOutcome, ProposalResult, RejectCode } from './altValidation';

/* Three-way triage of alternative-route proposals (package 033). Deterministic; no probability anywhere.
   - hard_reject : the validator rejected it (never rescued by anything)
   - needs_review: schema-valid but only plausibly reconstructed or gameplay-only → a human decides
   - feasible    : schema-valid AND documented with real sources → still only a DRAFT for owner review
   A model's confidence is deliberately NOT an input: this module has no parameter that could carry it.
   When in doubt the answer is none (no route), never "probably". */

export type Triage = 'hard_reject' | 'needs_review' | 'feasible';

export interface TriagedProposal { index: number; triage: Triage; reasons: RejectCode[]; recipeKey?: string }

export interface TriageReport {
  targetId: string;
  /** 'none' is the normal answer; nothing is published from this module */
  verdict: 'none' | 'review';
  proposals: TriagedProposal[];
}

export function triage(r: ProposalResult): TriagedProposal {
  if (r.status === 'rejected') return { index: r.index, triage: 'hard_reject', reasons: r.reasons };
  const ev = r.proposal?.evidenceClass;
  const sourced = (r.proposal?.sourceSupportIds?.length ?? 0) > 0;
  const triage: Triage = ev === 'documented' && sourced ? 'feasible' : 'needs_review';
  return { index: r.index, triage, reasons: [], recipeKey: r.recipeKey };
}

export function triageOutcome(o: AltOutcome): TriageReport {
  const proposals = o.results.map(triage);
  const live = proposals.some(p => p.triage !== 'hard_reject');
  return { targetId: o.targetId, verdict: live ? 'review' : 'none', proposals };
}
