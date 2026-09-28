import type { MuseumExhibit } from '../museum/types';
import type { SettlementMemory, SettlementState } from './types';

/** A finished settlement's diorama — never a claim about real history, this
 *  is a simulation run. See lib/museum/types.ts's ExhibitProvenance. */
export function summarizeSettlement(state: SettlementState): SettlementMemory {
  const ending = state.ending === 'resilient' ? 'resilient' : 'collapsed';
  const had = state.milestones.irrigationComplete ? ' Irrigation reached the fields before the end.' : '';
  const headline = ending === 'resilient'
    ? `Grew from a handful of households to ${Math.round(state.population)} people over ${state.year} years.${had}`
    : `Declined to ${Math.round(state.population)} people after ${state.year} years.${had}`;
  return {
    id: `settlement-${state.seed}-${state.turn}`,
    seed: state.seed,
    ending,
    population: Math.round(state.population),
    years: state.year,
    headline,
    completedAt: Date.now(),
  };
}

export function dioramaExhibit(memory: SettlementMemory): MuseumExhibit {
  return {
    id: `civilization:${memory.id}`,
    title: memory.ending === 'resilient' ? 'Civilization Diorama — a settlement that held' : 'Civilization Diorama — a settlement that declined',
    provenance: { kind: 'procedural-fictional', note: memory.headline, seed: memory.seed },
    sourceMode: 'civilization',
    layout: 'diorama',
    createdAt: memory.completedAt,
    tags: [memory.ending, `${memory.population} people`, `${memory.years} years`],
  };
}
