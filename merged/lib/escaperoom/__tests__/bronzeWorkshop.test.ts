import { BRONZE_WORKSHOP } from '@/lib/escaperoom/episodes/bronzeWorkshop';
import type { CodePuzzle } from '@/lib/escaperoom/types';

/* ============================================================================
   Content sanity: the episode's own data must be internally consistent
   — the final code really is the concatenation of what the other
   stations promise to reveal, every referenced id exists, and every
   puzzle's own "correct" answer is actually reachable from its data.
   ========================================================================== */

describe('BRONZE_WORKSHOP episode data', () => {
  it('the exit code is exactly the concatenation of the other stations\' unlock fragments, in requires order', () => {
    const exit = BRONZE_WORKSHOP.puzzles.find(p => p.id === BRONZE_WORKSHOP.finalPuzzleId) as CodePuzzle;
    const fragments = exit.requires.map(id => {
      const p = BRONZE_WORKSHOP.puzzles.find(x => x.id === id)!;
      return 'unlockFragment' in p ? p.unlockFragment : '';
    });
    expect(exit.correctCode).toBe(fragments.join('-'));
  });

  it('every requires id references a real, non-code puzzle in the episode', () => {
    const exit = BRONZE_WORKSHOP.puzzles.find(p => p.id === BRONZE_WORKSHOP.finalPuzzleId) as CodePuzzle;
    for (const id of exit.requires) {
      const p = BRONZE_WORKSHOP.puzzles.find(x => x.id === id);
      expect(p).toBeDefined();
      expect(p!.kind).not.toBe('code');
    }
  });

  it('the sequence puzzle\'s correctOrder is a permutation of its own step ids', () => {
    const seq = BRONZE_WORKSHOP.puzzles.find(p => p.kind === 'sequence')!;
    if (seq.kind !== 'sequence') throw new Error('expected sequence');
    expect([...seq.correctOrder].sort()).toEqual(seq.steps.map(s => s.id).sort());
  });

  it('the sequence puzzle\'s authored step order is NOT already the solution — the station shows steps in their own array order by default, so an already-correct array would make the puzzle trivial', () => {
    const seq = BRONZE_WORKSHOP.puzzles.find(p => p.kind === 'sequence')!;
    if (seq.kind !== 'sequence') throw new Error('expected sequence');
    expect(seq.steps.map(s => s.id)).not.toEqual(seq.correctOrder);
  });

  it('the match puzzle\'s correctMatch covers every item with a real target id', () => {
    const match = BRONZE_WORKSHOP.puzzles.find(p => p.kind === 'match')!;
    if (match.kind !== 'match') throw new Error('expected match');
    const targetIds = new Set(match.targets.map(t => t.id));
    for (const item of match.items) {
      expect(match.correctMatch[item.id]).toBeDefined();
      expect(targetIds.has(match.correctMatch[item.id])).toBe(true);
    }
    // every target used exactly once — a fair one-to-one matching puzzle
    const usedTargets = Object.values(match.correctMatch);
    expect(new Set(usedTargets).size).toBe(match.targets.length);
  });

  it('the ratio puzzle\'s correct value is a plausible historical bronze tin percentage', () => {
    const ratio = BRONZE_WORKSHOP.puzzles.find(p => p.kind === 'ratio')!;
    if (ratio.kind !== 'ratio') throw new Error('expected ratio');
    expect(ratio.correctValue).toBeGreaterThan(0);
    expect(ratio.correctValue).toBeLessThan(50);
  });

  it('finalPuzzleId points at a real code puzzle in the episode', () => {
    const p = BRONZE_WORKSHOP.puzzles.find(x => x.id === BRONZE_WORKSHOP.finalPuzzleId);
    expect(p?.kind).toBe('code');
  });
});
