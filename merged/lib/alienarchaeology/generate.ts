import { createRng, type Rng } from '../seed';
import { CATALOG, LIMB_COUNTS, SITE_PURPOSES, SOCIAL_STRUCTURES } from './catalog';
import type { AlienSiteState, AxisId, Specimen, SpecimenTemplate, SiteTruth } from './types';

/* ============================================================================
   SITE GENERATION — picks a hidden truth per axis, then selects a fixed
   number of specimens weighted toward (never guaranteed to fully prove)
   that truth. Unlike lib/archaeology/generate.ts or lib/decipher/
   generate.ts, there is deliberately no solvability validator here —
   irreducible ambiguity between plausible readings is the honest point
   of this mode, not a bug to eliminate.
   ========================================================================== */

const SPECIMEN_COUNT = 8;

const SETTING_BY_PURPOSE: Record<string, string[]> = {
  habitation: ['A cluster of structures on a wind-scoured plateau, clearly lived in, for how long no one can say.'],
  gathering: ['A wide, worn common space at the heart of a settlement whose edges have long since eroded away.'],
  processing: ['A cluster of sealed chambers near what was once a mineral seam, thick with residue.'],
  ritual: ['A raised, deliberately isolated platform, facing a horizon with nothing else built upon it.'],
};

function relevance(t: SpecimenTemplate, truth: SiteTruth): number {
  let score = 0;
  if (t.evidence.limbCount) score += t.evidence.limbCount[truth.limbCount] ?? 0;
  if (t.evidence.social) score += t.evidence.social[truth.social] ?? 0;
  if (t.evidence.purpose) score += t.evidence.purpose[truth.purpose] ?? 0;
  return score;
}

function weightedSampleDistinct(rng: Rng, templates: SpecimenTemplate[], weightOf: (t: SpecimenTemplate) => number, n: number): SpecimenTemplate[] {
  const pool = templates.slice();
  const chosen: SpecimenTemplate[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const weights = pool.map(t => Math.max(0.05, weightOf(t)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    let idx = 0;
    for (; idx < weights.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
    idx = Math.min(idx, pool.length - 1);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen;
}

export function generateSite(seed: string): AlienSiteState {
  const rng = createRng(seed);
  const truth: SiteTruth = {
    limbCount: rng.pick(LIMB_COUNTS),
    social: rng.pick(SOCIAL_STRUCTURES),
    purpose: rng.pick(SITE_PURPOSES),
    setting: '',
  };
  truth.setting = rng.pick(SETTING_BY_PURPOSE[truth.purpose]);

  const chosenTemplates = weightedSampleDistinct(rng, CATALOG, t => 1 + relevance(t, truth) * 4, SPECIMEN_COUNT);
  const specimens: Specimen[] = chosenTemplates.map((t, i) => ({ id: `spec_${i}`, templateId: t.id, revealed: false }));

  return {
    seed,
    specimens,
    truth,
    hypotheses: {},
    confidences: {},
    ending: 'ongoing',
    log: [{ text: `A set of ${specimens.length} recovered specimens await study: ${truth.setting}` }],
  };
}

export const ALL_AXES: AxisId[] = ['limbCount', 'social', 'purpose'];
