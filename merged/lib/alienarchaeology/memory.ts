import type { MuseumExhibit } from '../museum/types';
import type { AlienMemory, AlienSiteState } from './types';

/* ============================================================================
   ALIEN SITE MEMORY — what a filed field report leaves behind. Always
   procedural-fictional (a wholly invented nonhuman culture) — but
   unlike every other mode's memory, the headline foregrounds calibration
   over correctness, matching this mode's own epistemic point.
   ========================================================================== */

export function summarizeSite(state: AlienSiteState): AlienMemory {
  const report = state.report;
  if (!report) throw new Error('summarizeSite: site has no filed report yet');
  const pct = Math.round(report.overallCalibration * 100);
  const headline = `Filed with ${pct}% calibration — confidence matched evidence ${pct >= 75 ? 'well' : pct >= 50 ? 'unevenly' : 'poorly'} across the three questions.`;
  return {
    id: `alien-${state.seed}`,
    seed: state.seed,
    overallCalibration: report.overallCalibration,
    headline,
    completedAt: Date.now(),
  };
}

export function alienExhibit(memory: AlienMemory): MuseumExhibit {
  return {
    id: `alienarchaeology:${memory.id}`,
    title: 'Nonhuman Site — field report filed',
    provenance: {
      kind: 'procedural-fictional',
      note: memory.headline,
      seed: memory.seed,
    },
    sourceMode: 'alien-archaeology',
    layout: 'context-case',
    createdAt: memory.completedAt,
    tags: [`${Math.round(memory.overallCalibration * 100)}% calibration`],
  };
}
