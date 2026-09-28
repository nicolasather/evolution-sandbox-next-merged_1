import type { MuseumExhibit } from '../museum/types';
import type { DecipherAttempt, DecipherMemory, DecipherPuzzle } from './types';

/* ============================================================================
   DECIPHER MEMORY — what a finished puzzle leaves behind, same honest
   procedural-fictional discipline as every other mode's Museum output.
   ========================================================================== */

export function summarizeAttempt(puzzle: DecipherPuzzle, attempt: DecipherAttempt): DecipherMemory {
  const outcome = attempt.revealedAnswer && !attempt.solved ? 'revealed' : 'solved';
  const headline = outcome === 'solved'
    ? `All six glyphs read correctly, in ${attempt.checksUsed} check${attempt.checksUsed === 1 ? '' : 's'}.`
    : 'The reading was revealed rather than fully worked out.';
  return {
    id: `dec-${puzzle.id}`,
    puzzleId: puzzle.id,
    seed: puzzle.seed,
    outcome,
    checksUsed: attempt.checksUsed,
    headline,
    completedAt: Date.now(),
  };
}

export function decipherExhibit(memory: DecipherMemory): MuseumExhibit {
  return {
    id: `decipher:${memory.id}`,
    title: memory.outcome === 'solved' ? 'Deciphered Tablet Set — fully read' : 'Deciphered Tablet Set — reading revealed',
    provenance: {
      kind: 'procedural-fictional',
      note: memory.headline,
      seed: memory.seed,
    },
    sourceMode: 'decipher',
    layout: 'wall-document',
    createdAt: memory.completedAt,
    tags: [memory.outcome, `${memory.checksUsed} checks`],
  };
}
