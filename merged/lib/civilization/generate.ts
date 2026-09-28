import { createRng } from '../seed';
import type { SettlementState } from './types';

/** Deterministic starting state — one scenario (a small settlement beside a
 *  river) with the seed jittering starting population/farmland modestly, so
 *  runs vary without needing multiple authored scenario types yet (a real,
 *  scoped follow-up — see docs/ROADMAP-UNIVERSE.md). */
export function generateSettlement(seed: string): SettlementState {
  const rng = createRng(seed);
  const population = 28 + rng.int(0, 4);
  const farmlandBase = 55 + rng.int(0, 10);
  return {
    seed,
    year: 0,
    turn: 0,
    maxTurns: 14,
    population,
    targetPopulation: 150,
    allocation: { food: 0.5, construction: 0.3, knowledge: 0.2 },
    farmland: { base: farmlandBase, irrigated: 0 },
    storageCapacity: 20,
    foodStock: 15,
    materialStock: 0,
    knowledgeStock: 0,
    irrigationProgress: 0,
    problems: [{ kind: 'water-labor', since: 0 }],
    milestones: {},
    ending: 'ongoing',
    log: [{ year: 0, text: 'A handful of households settle beside the river.' }],
  };
}
