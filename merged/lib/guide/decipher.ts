import type { DecipherAttempt, DecipherPuzzle } from '@/lib/decipher/types';
import type { GuideStep } from './types';

/* DECIPHER GUIDE — only for the tutorial tablets (the mode's own beginner puzzle). The glow walks the
   mystery glyph rows in order, then the Check button. It never says which meaning is right. */

export const DECIPHER_MODE = 'decipher';
export const DEC_TARGET = { row: (glyphId: string) => `dec-row:${glyphId}`, check: 'dec-check' } as const;

export interface DecipherGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

export function decipherGuide(puzzle: DecipherPuzzle, attempt: DecipherAttempt, checkedWrong: boolean): DecipherGuide {
  const eligible = puzzle.kind === 'tutorial';
  if (attempt.solved || attempt.revealedAnswer) return { step: null, finished: true, eligible };
  const nouns = puzzle.glyphs.filter(g => g.role === 'noun');
  const next = nouns.find(g => !attempt.assignments[g.id]);
  const mk = (id: string, text: string, targets: string[], detail: string): DecipherGuide => ({ eligible, finished: false, step: { id, text, targets, detail } });
  if (next) {
    return mk(`assign:${next.id}`, 'GIVE THIS GLYPH A MEANING', [DEC_TARGET.row(next.id)],
      'Use the clue under "Known from context", and count how often each glyph appears on the tablets: the glyph that appears most often is usually a common word. A guess is only a guess until you press Check.');
  }
  if (checkedWrong) {
    return mk('adjust', 'CHANGE A GUESS, THEN CHECK AGAIN', [DEC_TARGET.check],
      'Check only tells you how many are right, not which ones. Change one guess at a time and check again.');
  }
  return mk('check', 'PRESS CHECK', [DEC_TARGET.check], 'Check tells you how many of your guesses are right. It does not end the puzzle unless every one is right.');
}
