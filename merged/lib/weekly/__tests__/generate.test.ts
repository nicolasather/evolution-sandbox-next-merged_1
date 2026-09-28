import { buildGraph } from '@/lib/minpath/graph';
import { findCompletingPath } from '@/lib/minpath/modifiers';
import { generateWeeklyChallenge } from '@/lib/weekly/generate';
import { satisfiesClues } from '@/lib/techsudoku/generate';
import { playDb } from '@/lib/processing';
import { weeklyKey } from '@/lib/seed';

const graph = buildGraph(playDb);

function weekDate(offsetWeeks: number): Date {
  const d = new Date('2026-01-05T12:00:00Z'); // a Monday
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7);
  return d;
}

describe('generateWeeklyChallenge', () => {
  it('is deterministic for the same week: same scenario, same three stages', () => {
    const a = generateWeeklyChallenge(playDb, weekDate(3));
    const b = generateWeeklyChallenge(playDb, weekDate(3));
    expect(a).toEqual(b);
  });

  it('different weeks routinely produce different content', () => {
    const weeks = Array.from({ length: 10 }, (_, i) => generateWeeklyChallenge(playDb, weekDate(i)));
    expect(weeks.every(w => w !== null)).toBe(true);
    const scenarioIds = new Set(weeks.map(w => w!.scenario.id));
    const traceTargets = new Set(weeks.map(w => w!.stages[0].targetId));
    expect(scenarioIds.size).toBeGreaterThan(1);
    expect(traceTargets.size).toBeGreaterThan(1);
  });

  it('carries the real ISO week key', () => {
    const c = generateWeeklyChallenge(playDb, weekDate(5));
    expect(c!.week).toBe(weeklyKey(weekDate(5)));
  });

  it('the trace stage is a real, provably solvable variant challenge', () => {
    for (let i = 0; i < 12; i++) {
      const c = generateWeeklyChallenge(playDb, weekDate(i));
      expect(c).not.toBeNull();
      const trace = c!.stages[0];
      const found = findCompletingPath(playDb, graph, trace.startId, trace.targetId, trace.modifier, trace.optimalLength + 4);
      expect(found).not.toBeNull();
      expect(found!.length - 1).toBe(trace.optimalLength);
    }
  });

  it('the sudoku stage is a real, uniquely-clued puzzle', () => {
    for (let i = 0; i < 12; i++) {
      const c = generateWeeklyChallenge(playDb, weekDate(i));
      const puzzle = c!.stages[1].puzzle;
      expect(puzzle.clues.length).toBe(puzzle.solution.length - 1);
      expect(satisfiesClues(puzzle.solution.map(n => n.id), puzzle.clues)).toBe(true);
      expect([...puzzle.scrambled].sort()).toEqual(puzzle.solution.map(n => n.id).sort());
    }
  });

  it('the gauntlet stage has exactly three riddles, each with a real, findable answer among its options', () => {
    for (let i = 0; i < 12; i++) {
      const c = generateWeeklyChallenge(playDb, weekDate(i));
      const gauntlet = c!.stages[2];
      expect(gauntlet.clues).toHaveLength(3);
      const byId = new Map(playDb.nodes.map(n => [n.id, n]));
      for (const clue of gauntlet.clues) {
        expect(clue.optionIds).toContain(clue.targetId);
        expect(new Set(clue.optionIds).size).toBe(clue.optionIds.length); // no duplicate options
        expect(byId.get(clue.targetId)).toBeDefined();
        // the riddle text must not still contain the answer's own name
        const name = byId.get(clue.targetId)!.n;
        expect(clue.riddle.toLowerCase()).not.toContain(name.toLowerCase());
      }
    }
  });

  it('the three gauntlet targets within one week are always distinct', () => {
    for (let i = 0; i < 12; i++) {
      const c = generateWeeklyChallenge(playDb, weekDate(i));
      const targets = c!.stages[2].clues.map(cl => cl.targetId);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });
});
