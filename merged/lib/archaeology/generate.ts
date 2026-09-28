import { createRng } from '../seed';
import { CATALOG } from './catalog';
import type { Context, Find, SiteFunction, SitePhase, SiteState, SiteTruth, Square } from './types';

/* ============================================================================
   SITE GENERATION — one small, bounded 4×4 grid (16 squares), same
   "never unwinnable" discipline as lib/survival/generate.ts: every square
   gets the same three fixed stratigraphic depths (late/peak/early
   occupation, shallow to deep — real law-of-superposition ordering, not
   randomised), so a thorough dig always has real evidence to read
   regardless of seed. What varies is where finds actually are, which
   phase is best represented, and which SiteFunction the evidence leans
   toward — the actual interpretive problem the mode is about.
   ========================================================================== */

const GRID_SIZE = 4;
const PHASE_ORDER: SitePhase[] = ['late-occupation', 'peak-occupation', 'early-occupation'];
const SOIL_BY_PHASE: Record<SitePhase, string> = {
  'late-occupation': 'disturbed topsoil, root-churned',
  'peak-occupation': 'dark, compact occupation layer',
  'early-occupation': 'pale subsoil with sparse early traces',
};
const FUNCTIONS: SiteFunction[] = ['seasonal-camp', 'permanent-settlement', 'workshop', 'ceremonial-site'];

const SETTINGS: Record<SiteFunction, string[]> = {
  'seasonal-camp': [
    'A low rise above a dried streambed, easy to reach and easy to leave.',
    'A sheltered bench of ground beside a spring, scattered with old ash.',
  ],
  'permanent-settlement': [
    'A terrace above a floodplain, still faintly ridged with old field lines.',
    'A low mound of accumulated debris, built up over many returning seasons.',
  ],
  workshop: [
    'A gravel outcrop where good stone breaks the surface in visible seams.',
    'A flat bench beside a raw-material source, thick with worked debris.',
  ],
  'ceremonial-site': [
    'A modest rise set apart from any obvious water or stone source.',
    'A cleared platform, deliberately levelled, facing an open horizon.',
  ],
};

function weightedTemplateIds(fn: SiteFunction): string[] {
  const pool: string[] = [];
  for (const t of CATALOG) {
    const affinity = t.affinity[fn] ?? 0.05;
    const weight = Math.max(1, Math.round(t.rarity * (0.4 + affinity) * 4));
    for (let i = 0; i < weight; i++) pool.push(t.id);
  }
  return pool;
}

export function generateSite(seed: string): SiteState {
  const rng = createRng(seed);
  const truth: SiteTruth = {
    function: rng.pick(FUNCTIONS),
    primaryPhase: rng.pick(PHASE_ORDER),
    setting: '',
  };
  truth.setting = rng.pick(SETTINGS[truth.function]);

  const pool = weightedTemplateIds(truth.function);
  const preservationPool: Array<'poor' | 'fair' | 'good'> = ['poor', 'fair', 'fair', 'good'];

  const finds: Find[] = [];
  const squares: Square[][] = [];
  let findSeq = 0;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Square[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const contexts: Context[] = PHASE_ORDER.map(phase => ({ soil: SOIL_BY_PHASE[phase], phase, findIds: [] }));
      contexts.forEach((ctx, contextIndex) => {
        const baseChance = ctx.phase === truth.primaryPhase ? 0.55 : 0.18;
        if (!rng.chance(baseChance)) return;
        const find: Find = {
          id: `find_${findSeq++}`,
          templateId: rng.pick(pool),
          squareX: x,
          squareY: y,
          contextIndex,
          phase: ctx.phase,
          preservation: rng.pick(preservationPool),
          analyzed: false,
        };
        finds.push(find);
        ctx.findIds.push(find.id);
      });
      row.push({ x, y, contexts, surveyHint: 'unsurveyed', dugContexts: 0 });
    }
    squares.push(row);
  }

  return {
    seed,
    gridSize: GRID_SIZE,
    squares,
    truth,
    budgets: { survey: 8, excavate: 10, analyze: 6 },
    spent: { survey: 0, excavate: 0, analyze: 0 },
    finds,
    hypotheses: {},
    ending: 'ongoing',
    log: [{ text: `A new site is staked out and gridded: ${truth.setting}` }],
  };
}
