import type { Allocation, Problem, SettlementEvent, SettlementState } from './types';

/* ============================================================================
   CIVILIZATION SIMULATION CORE — pure, deterministic (no Math.random; a
   future pass adding variation should use lib/seed.ts). One call to
   `advanceTurn` resolves one turn (5 years): production against a real land
   ceiling, consumption, growth or famine, construction/knowledge investment
   toward irrigation, and a fresh recomputation of which systemic pressures
   currently hold. The settlement's own structure generates every pressure —
   there is no scripted random event.
   ========================================================================== */

const YEARS_PER_TURN = 5;
const FOOD_RATE = 2.6;
const WATER_LABOR_EFFICIENCY = 0.75; // without irrigation, a share of food labor is lost fetching water
const CONSUMPTION_PER_POP = 1;
const MAX_GROWTH_RATE = 0.08;
const FAMINE_DECLINE = 0.15;
const KNOWLEDGE_RATE = 0.35;
const CONSTRUCTION_RATE = 0.35;
const IRRIGATION_FROM_KNOWLEDGE = 0.22;
const IRRIGATION_FROM_CONSTRUCTION = 0.14;
const IRRIGATION_LAND_BONUS = 90;
const COLLAPSE_POPULATION = 4;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function advanceTurn(input: SettlementState, allocation: Allocation): { state: SettlementState; events: SettlementEvent[] } {
  const state: SettlementState = JSON.parse(JSON.stringify(input));
  const events: SettlementEvent[] = [];
  const total = allocation.food + allocation.construction + allocation.knowledge;
  state.allocation = total > 0
    ? { food: allocation.food / total, construction: allocation.construction / total, knowledge: allocation.knowledge / total }
    : { food: 1, construction: 0, knowledge: 0 };

  const push = (text: string) => events.push({ year: state.year, text });

  // Production, against a real land ceiling regardless of labor invested.
  const irrigated = !!state.milestones.irrigationComplete;
  const efficiency = irrigated ? 1 : WATER_LABOR_EFFICIENCY;
  const laborFood = state.allocation.food * state.population;
  const capacity = state.farmland.base + state.farmland.irrigated;
  const produced = Math.min(laborFood * FOOD_RATE * efficiency, capacity);

  // Knowledge and construction investment, feeding irrigation and storage.
  state.knowledgeStock += state.allocation.knowledge * state.population * KNOWLEDGE_RATE;
  state.materialStock += state.allocation.construction * state.population * CONSTRUCTION_RATE;
  if (!irrigated) {
    state.irrigationProgress = clamp(
      state.irrigationProgress + state.allocation.knowledge * IRRIGATION_FROM_KNOWLEDGE + state.allocation.construction * IRRIGATION_FROM_CONSTRUCTION,
      0, 1,
    );
    if (state.irrigationProgress >= 1) {
      state.milestones.irrigationComplete = true;
      state.farmland.irrigated = IRRIGATION_LAND_BONUS;
      push('The irrigation channels reach the fields — land far from the river can be farmed now.');
    }
  }

  // Storage grows modestly from sustained construction investment — the
  // first time it crosses the starting capacity is a named milestone.
  const newStorageCapacity = 20 + Math.floor(state.materialStock / 6) * 8;
  if (newStorageCapacity > state.storageCapacity && !state.milestones.firstStorage) {
    state.milestones.firstStorage = true;
    push('The first granary is raised — surplus no longer has to be eaten at once.');
  }
  state.storageCapacity = newStorageCapacity;

  // Consumption, then growth or famine.
  const consumption = state.population * CONSUMPTION_PER_POP;
  const net = state.foodStock + produced - consumption;
  const spoiled = net > state.storageCapacity;
  if (net < 0) {
    const before = Math.round(state.population);
    state.population = Math.max(0, state.population * (1 - FAMINE_DECLINE));
    state.foodStock = 0;
    push(`The harvest falls short. ${before - Math.round(state.population)} people do not survive the shortage.`);
  } else {
    state.foodStock = Math.min(net, state.storageCapacity);
    // Growth responds to how much THIS turn's production cleared this turn's
    // need — not the carried-over stock, which only cushions a future
    // shortfall and shouldn't by itself drive the population up.
    const producedSurplus = produced - consumption;
    const surplusRatio = consumption > 0 ? producedSurplus / consumption : 0;
    const growth = clamp(surplusRatio * 0.4, 0, MAX_GROWTH_RATE);
    state.population = state.population * (1 + growth);
  }

  // Pressures are recomputed fresh from the current state, not accumulated
  // — a problem that is no longer true simply stops appearing.
  const problems: Problem[] = [];
  const carry = (kind: Problem['kind']) => state.problems.find(p => p.kind === kind)?.since ?? state.year;
  if (!state.milestones.irrigationComplete) problems.push({ kind: 'water-labor', since: carry('water-labor') });
  if (state.population > capacity * 0.9) problems.push({ kind: 'land-shortage', since: carry('land-shortage') });
  if (spoiled) problems.push({ kind: 'storage-shortage', since: carry('storage-shortage') });
  state.problems = problems;

  state.year += YEARS_PER_TURN;
  state.turn += 1;

  if (state.population < COLLAPSE_POPULATION) {
    state.ending = 'collapsed';
  } else if (state.turn >= state.maxTurns) {
    state.ending = 'resilient';
  }

  state.log = [...state.log, ...events].slice(-40);
  return { state, events };
}
