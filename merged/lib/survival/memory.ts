import type { MuseumExhibit } from '../museum/types';
import type { CampMemory, CampState } from './types';

/* ============================================================================
   CAMP MEMORY — what a finished Survival run leaves behind: a short, honest
   summary (never a claim about real history — this is a simulation run) and
   a Museum exhibit so it shows up alongside Main Evolution's own finds. See
   lib/museum/types.ts's ExhibitProvenance: this is always
   'procedural-fictional', tagged with the run's own seed.
   ========================================================================== */

export function summarizeCamp(state: CampState): CampMemory {
  const ending = state.ending === 'success' ? 'success' : 'failed';
  const days = state.day - 1;
  const had = [
    state.milestones.fire && 'a fire kept alight',
    state.milestones.shelter && 'a shelter raised',
  ].filter((x): x is string => !!x);
  const headline = ending === 'success'
    ? `The group held on for ${days} days${had.length ? `, with ${had.join(' and ')}.` : '.'}`
    : `The group could not hold on past day ${days}${had.length ? `, despite ${had.join(' and ')}.` : '.'}`;
  return {
    id: `camp-${state.seed}-${state.day}`,
    seed: state.seed,
    ending,
    days,
    headline,
    completedAt: Date.now(),
  };
}

export function memoryExhibit(memory: CampMemory): MuseumExhibit {
  return {
    id: `survival:${memory.id}`,
    title: memory.ending === 'success' ? 'Camp Memory — a run that held' : 'Camp Memory — a run that did not',
    provenance: {
      kind: 'procedural-fictional',
      note: memory.headline,
      seed: memory.seed,
    },
    sourceMode: 'survival',
    layout: 'diorama',
    createdAt: memory.completedAt,
    tags: [memory.ending, `${memory.days} days`],
  };
}
