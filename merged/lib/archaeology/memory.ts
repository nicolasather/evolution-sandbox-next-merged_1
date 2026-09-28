import type { MuseumExhibit } from '../museum/types';
import { FUNCTION_LABEL } from './read';
import type { SiteMemory, SiteState } from './types';

/* ============================================================================
   SITE MEMORY — what a filed report leaves behind: an honest summary (this
   is always a generated, fictional site — see lib/museum/types.ts's
   ExhibitProvenance) and a Museum exhibit alongside Survival's Camp
   Memories and Civilization's Dioramas.
   ========================================================================== */

export function summarizeSite(state: SiteState): SiteMemory {
  const report = state.report;
  if (!report || !state.hypotheses.function) throw new Error('summarizeSite: site has no filed report yet');
  const fn = state.hypotheses.function;
  const headline = report.verdict === 'well-supported'
    ? `A well-argued case for ${FUNCTION_LABEL[fn]}, built from ${report.analyzedCount} analyzed finds.`
    : report.verdict === 'plausible'
      ? `A plausible but thin case for ${FUNCTION_LABEL[fn]}, from ${report.analyzedCount} analyzed finds.`
      : `An inconclusive dig — too little was excavated and analyzed to really argue for ${FUNCTION_LABEL[fn]}.`;
  return {
    id: `site-${state.seed}`,
    seed: state.seed,
    verdict: report.verdict,
    functionLabel: fn,
    matchedTruth: report.functionMatchedTruth,
    headline,
    completedAt: Date.now(),
  };
}

export function siteExhibit(memory: SiteMemory): MuseumExhibit {
  return {
    id: `archaeology:${memory.id}`,
    title: `Excavation Report — ${FUNCTION_LABEL[memory.functionLabel]}`,
    provenance: {
      kind: 'procedural-fictional',
      note: memory.headline,
      seed: memory.seed,
    },
    sourceMode: 'archaeology',
    layout: 'context-case',
    createdAt: memory.completedAt,
    tags: [memory.verdict, memory.matchedTruth ? 'confirmed by ground truth' : 'contested by ground truth'],
  };
}
