import rawDb from '@/data/db.json';
import { generatePuzzle, satisfiesClues } from '@/lib/techsudoku/generate';
import { createRng } from '@/lib/seed';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

/** All permutations of a small array — fine for n ≤ 6 (≤ 720). */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) out.push([items[i], ...p]);
  }
  return out;
}

describe('generatePuzzle (real database)', () => {
  it('produces 5 distinct real discoveries in true chronological order', () => {
    const p = generatePuzzle(db, createRng('daily-2026-09-28'));
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.solution).toHaveLength(5);
    const ids = new Set(p.solution.map(n => n.id));
    expect(ids.size).toBe(5);
    for (let i = 1; i < p.solution.length; i++) expect(p.solution[i].ds).toBeGreaterThan(p.solution[i - 1].ds);
  });

  it('gives exactly n-1 clues', () => {
    const p = generatePuzzle(db, createRng('seed-a'));
    expect(p?.clues).toHaveLength(4);
  });

  it('every clue is directionally correct (before really predates after)', () => {
    const p = generatePuzzle(db, createRng('seed-b'));
    if (!p) return;
    const dsOf = new Map(p.solution.map(n => [n.id, n.ds]));
    for (const c of p.clues) expect(dsOf.get(c.beforeId)!).toBeLessThan(dsOf.get(c.afterId)!);
  });

  it('exactly one full ordering of the 5 items satisfies every clue (proves the uniqueness claim, not just asserts it)', () => {
    const p = generatePuzzle(db, createRng('uniqueness-check'));
    if (!p) return;
    const ids = p.solution.map(n => n.id);
    const satisfying = permutations(ids).filter(order => satisfiesClues(order, p.clues));
    expect(satisfying).toHaveLength(1);
    expect(satisfying[0]).toEqual(p.solution.map(n => n.id));
  });

  it('is deterministic for the same seed', () => {
    const a = generatePuzzle(db, createRng('same-seed'));
    const b = generatePuzzle(db, createRng('same-seed'));
    expect(a).toEqual(b);
  });

  it('scrambled is a permutation of the solution ids, not a fresh selection', () => {
    const p = generatePuzzle(db, createRng('scramble-check'));
    if (!p) return;
    expect([...p.scrambled].sort()).toEqual(p.solution.map(n => n.id).sort());
  });
});

describe('satisfiesClues', () => {
  it('rejects an order that violates even one clue', () => {
    const clues = [{ beforeId: 'a', afterId: 'b' }];
    expect(satisfiesClues(['a', 'b'], clues)).toBe(true);
    expect(satisfiesClues(['b', 'a'], clues)).toBe(false);
  });
});
