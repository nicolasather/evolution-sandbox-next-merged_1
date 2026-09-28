import type { DecipherAttempt, DecipherPuzzle, NounConceptId } from './types';

/* ============================================================================
   ATTEMPT LOGIC — pure, deterministic, same discipline as every other
   mode's simulation core. A cryptogram-style bijection: assigning a
   concept to a glyph clears that concept from wherever else it was
   assigned, so the player is always looking at a currently-consistent
   guess, never two glyphs both claiming to mean "grain".
   ========================================================================== */

export function blankAttempt(puzzle: DecipherPuzzle): DecipherAttempt {
  const assignments: Record<string, NounConceptId | null> = {};
  for (const g of puzzle.glyphs) if (g.role === 'noun') assignments[g.id] = null;
  return { puzzleId: puzzle.id, assignments, checksUsed: 0, solved: false, revealedAnswer: false };
}

function clone(a: DecipherAttempt): DecipherAttempt { return JSON.parse(JSON.stringify(a)); }

export function assignGlyph(attempt: DecipherAttempt, glyphId: string, conceptId: NounConceptId | null): DecipherAttempt {
  const next = clone(attempt);
  if (conceptId !== null) {
    for (const gid of Object.keys(next.assignments)) {
      if (gid !== glyphId && next.assignments[gid] === conceptId) next.assignments[gid] = null;
    }
  }
  next.assignments[glyphId] = conceptId;
  return next;
}

export interface CheckResult { correctCount: number; total: number; allCorrect: boolean }

export function checkAttempt(puzzle: DecipherPuzzle, attempt: DecipherAttempt): { attempt: DecipherAttempt; result: CheckResult } {
  const nounGlyphs = puzzle.glyphs.filter(g => g.role === 'noun');
  let correctCount = 0;
  for (const g of nounGlyphs) if (attempt.assignments[g.id] === g.conceptId) correctCount++;
  const allCorrect = correctCount === nounGlyphs.length;
  const next = clone(attempt);
  next.checksUsed += 1;
  if (allCorrect) next.solved = true;
  return { attempt: next, result: { correctCount, total: nounGlyphs.length, allCorrect } };
}

export function revealAnswer(puzzle: DecipherPuzzle, attempt: DecipherAttempt): DecipherAttempt {
  const next = clone(attempt);
  for (const g of puzzle.glyphs) if (g.role === 'noun') next.assignments[g.id] = g.conceptId as NounConceptId;
  next.revealedAnswer = true;
  return next;
}
