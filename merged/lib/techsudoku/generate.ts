import type { Db, Discovery } from '../types';
import type { Rng } from '../seed';

/* ============================================================================
   TECH SUDOKU — a small, optional, 2–8 minute logic puzzle: reconstruct the
   true chronological order of a handful of real discoveries from a minimal
   set of "X predates Y" clues, generated from their real dates
   (data/db.json's `ds`), never invented.

   Solvability by construction, not by a general solver: for a strict total
   order over n items, the transitive reduction of the "before" relation is
   exactly the chain of adjacent-in-order pairs (n − 1 edges) — no smaller
   edge set's transitive closure can cover every pair, and that chain's
   closure always does. So generating exactly those n − 1 "adjacent" facts
   guarantees a unique solution with no separate solver pass required; the
   puzzle is in figuring out how the (shuffled-order, shuffled-item) clues
   chain together, not in searching a solution space.
   ========================================================================== */

export interface OrderClue { beforeId: string; afterId: string }

export interface TechSudokuPuzzle {
  /** True chronological order, oldest first — never sent to the player's
   *  screen pre-solve; components/techsudoku/ only ever reveals it after
   *  a correct submission. */
  solution: Discovery[];
  /** n − 1 facts, each strictly "beforeId predates afterId" — sufficient
   *  (see module doc) and presented in a shuffled, non-chain order. */
  clues: OrderClue[];
  /** The item ids in the order first shown to the player. */
  scrambled: string[];
}

export function generatePuzzle(db: Pick<Db, 'nodes'>, rng: Rng, size = 5): TechSudokuPuzzle | null {
  const eligible = db.nodes.filter(n => !n.primitive && !n.hidden && n.l1 && typeof n.ds === 'number');
  const pool = rng.shuffle(eligible);
  const seenYears = new Set<number>();
  const chosen: Discovery[] = [];
  for (const n of pool) {
    if (seenYears.has(n.ds)) continue; // distinct dates only — no tie to break
    seenYears.add(n.ds);
    chosen.push(n);
    if (chosen.length === size) break;
  }
  if (chosen.length < size) return null;

  const solution = [...chosen].sort((a, b) => a.ds - b.ds);
  const clues: OrderClue[] = [];
  for (let i = 0; i < solution.length - 1; i++) {
    clues.push({ beforeId: solution[i].id, afterId: solution[i + 1].id });
  }

  return {
    solution,
    clues: rng.shuffle(clues),
    scrambled: rng.shuffle(solution.map(n => n.id)),
  };
}

/** True iff `order` (a full permutation of the puzzle's item ids) satisfies
 *  every clue — used by the UI to check a submission, and by tests to prove
 *  the generator's uniqueness claim rather than merely asserting it. */
export function satisfiesClues(order: readonly string[], clues: readonly OrderClue[]): boolean {
  const index = new Map(order.map((id, i) => [id, i]));
  return clues.every(c => (index.get(c.beforeId) ?? -1) < (index.get(c.afterId) ?? -1));
}
