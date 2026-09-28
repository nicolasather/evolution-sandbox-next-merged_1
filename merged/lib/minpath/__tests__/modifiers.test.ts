import { buildGraph } from '@/lib/minpath/graph';
import { findCompletingPath, isComplete, legalNeighbors } from '@/lib/minpath/modifiers';
import { shortestPath } from '@/lib/minpath/pathfind';
import { playDb } from '@/lib/processing';
import type { MinPathSession } from '@/lib/minpath/session';

const graph = buildGraph(playDb);
const byId = new Map(playDb.nodes.map(n => [n.id, n]));

function sessionAt(startId: string, targetId: string, path: string[]): MinPathSession {
  return { startId, targetId, path, done: false };
}

describe('legalNeighbors', () => {
  it('with no modifier, is identical to the base graph neighbours (the existing mode must never change)', () => {
    const s = sessionAt('smartphone', 'stone', ['smartphone']);
    const base = [...(graph.neighbors.get('smartphone') ?? [])];
    expect(legalNeighbors(playDb, graph, s).sort()).toEqual(base.sort());
  });

  it('no-backtracking excludes every already-visited node, nothing else', () => {
    const path = shortestPath(graph, 'smartphone', 'stone')!.slice(0, 3);
    const s = sessionAt('smartphone', 'stone', path);
    const base = new Set(graph.neighbors.get(path[path.length - 1]) ?? []);
    const legal = legalNeighbors(playDb, graph, s, { kind: 'no-backtracking' });
    for (const id of legal) expect(path).not.toContain(id);
    for (const id of base) if (!path.includes(id)) expect(legal).toContain(id);
  });

  it('chronological-only never allows a move to something dated earlier', () => {
    const s = sessionAt('smartphone', 'stone', ['smartphone']);
    const curDs = byId.get('smartphone')!.ds;
    const legal = legalNeighbors(playDb, graph, s, { kind: 'chronological-only' });
    for (const id of legal) expect(byId.get(id)!.ds).toBeGreaterThanOrEqual(curDs);
  });
});

describe('isComplete', () => {
  it('with no modifier, true exactly when the target is the current node', () => {
    expect(isComplete(playDb, sessionAt('a', 'b', ['a', 'b']))).toBe(true);
    expect(isComplete(playDb, sessionAt('a', 'b', ['a', 'c']))).toBe(false);
  });

  it('exactly-n-clicks requires the click count to match exactly, even at the target', () => {
    const s3 = sessionAt('a', 'b', ['a', 'x', 'y', 'b']); // 3 clicks
    expect(isComplete(playDb, s3, { kind: 'exactly-n-clicks', n: 3 })).toBe(true);
    expect(isComplete(playDb, s3, { kind: 'exactly-n-clicks', n: 4 })).toBe(false);
    expect(isComplete(playDb, sessionAt('a', 'b', ['a', 'x']), { kind: 'exactly-n-clicks', n: 3 })).toBe(false); // not at target
  });

  it('visit-an-era requires a node of that era to appear anywhere in the path so far', () => {
    const era = byId.get('fire')!.era;
    const pathWithEra = ['stone', 'fire', 'smartphone'];
    const pathWithoutEra = ['stone', 'smartphone'];
    expect(isComplete(playDb, sessionAt('stone', 'smartphone', pathWithEra), { kind: 'visit-an-era', era })).toBe(true);
    expect(isComplete(playDb, sessionAt('stone', 'smartphone', pathWithoutEra), { kind: 'visit-an-era', era })).toBe(false);
  });
});

describe('findCompletingPath', () => {
  it('finds a path matching the real unmodified shortest path when no modifier is given', () => {
    const real = shortestPath(graph, 'smartphone', 'stone')!;
    const found = findCompletingPath(playDb, graph, 'smartphone', 'stone', undefined, real.length + 4);
    expect(found).not.toBeNull();
    expect(found!.length - 1).toBe(real.length - 1);
  });

  it('respects no-backtracking: the found path never repeats a node', () => {
    const found = findCompletingPath(playDb, graph, 'smartphone', 'stone', { kind: 'no-backtracking' }, 12);
    expect(found).not.toBeNull();
    expect(new Set(found).size).toBe(found!.length);
  });

  it('finds an exactly-n-clicks path of precisely the requested length when one exists', () => {
    const real = shortestPath(graph, 'smartphone', 'personal_computer')!;
    const n = real.length - 1; // the trivial, always-achievable case
    const found = findCompletingPath(playDb, graph, 'smartphone', 'personal_computer', { kind: 'exactly-n-clicks', n }, n + 4);
    expect(found).not.toBeNull();
    expect(found!.length - 1).toBe(n);
  });

  it('returns null when the maxSteps bound is too small to ever reach the target', () => {
    const found = findCompletingPath(playDb, graph, 'smartphone', 'stone', undefined, 1);
    // smartphone and stone are known to be many hops apart in the real graph
    expect(found).toBeNull();
  });
});
