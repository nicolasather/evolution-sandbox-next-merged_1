import type { Db } from '../types';
import type { MuseumExhibit } from '../museum/types';
import type { ReverseMemory, ReverseRunState } from './types';

/* ============================================================================
   RUN MEMORY — what a finished decomposition run leaves behind. Unlike
   every procedural mode's Museum output, this one is grounded entirely
   in the real database, so its exhibit is tagged `historical-fact` (the
   real dependency chain, not a generated one) even though the "run" of
   questions around it was this player's own particular session.
   ========================================================================== */

/** Every node the run actually touched contributes its own already-
 *  verified citations (lib/types.ts's Discovery.src) — the exhibit's
 *  sourceIds are never invented for this mode, only aggregated from
 *  what Main Evolution's own data already cites. Computed once here,
 *  while the full run state still exists — see ReverseMemory.sourceIds. */
function runSourceIds(db: Pick<Db, 'nodes'>, state: ReverseRunState): string[] {
  const ids = new Set<string>();
  for (const node of Object.values(state.nodes)) {
    const discovery = db.nodes.find(n => n.id === node.discoveryId);
    for (const s of discovery?.src ?? []) if (s !== 'source_required') ids.add(s);
  }
  return [...ids];
}

export function summarizeRun(db: Pick<Db, 'nodes'>, state: ReverseRunState): ReverseMemory {
  const target = db.nodes.find(n => n.id === state.targetId);
  const total = state.correctCount + state.revealedCount;
  const headline = total > 0
    ? `Traced ${target?.n ?? state.targetId} back through ${total} real steps — ${state.correctCount} correctly recalled, ${state.revealedCount} newly learned.`
    : `Opened a trace of ${target?.n ?? state.targetId} back toward its origins.`;
  return {
    id: `rev-${state.seed}`,
    seed: state.seed,
    targetId: state.targetId,
    correctCount: state.correctCount,
    revealedCount: state.revealedCount,
    headline,
    completedAt: Date.now(),
    sourceIds: runSourceIds(db, state),
  };
}

export function reverseExhibit(memory: ReverseMemory, targetName: string): MuseumExhibit {
  return {
    id: `reverseevolution:${memory.id}`,
    title: `Reverse Trace — ${targetName}`,
    provenance: {
      kind: 'historical-fact',
      note: memory.headline,
      sourceIds: memory.sourceIds,
    },
    sourceMode: 'reverse-evolution',
    layout: 'exploded-mechanism',
    createdAt: memory.completedAt,
    tags: [`${memory.correctCount} recalled`, `${memory.revealedCount} learned`],
  };
}
