import { buildGraph } from '@/lib/minpath/graph';
import { shortestPath } from '@/lib/minpath/pathfind';
import type { Db, Discovery } from '@/lib/types';

function d(id: string, rec: string[][]): Discovery {
  return {
    id, no: 1, n: id, era: 'origins', cat: 'material', date: '', ds: 0, rar: 'common',
    l1: '', l2: '', l3: '', ev: '', src: [], rec, tags: [], vis: '', depth: 0, need: 0, uses: [],
  } as Discovery;
}

// a — b — c — d, plus a shortcut e directly on a and d
const db: Pick<Db, 'nodes'> = {
  nodes: [
    d('b', [['a', 'a']]), // a-b edge (self-pair, degenerate but valid)
    d('c', [['b', 'x']]),
    d('d', [['c', 'y']]),
    d('e', [['a', 'd']]), // a-e and e-d
  ],
};

describe('shortestPath', () => {
  it('finds the trivial zero-hop path from a node to itself', () => {
    const g = buildGraph(db);
    expect(shortestPath(g, 'a', 'a')).toEqual(['a']);
  });

  it('finds a direct one-hop path', () => {
    const g = buildGraph(db);
    expect(shortestPath(g, 'a', 'b')).toEqual(['a', 'b']);
  });

  it('finds the shortest of several routes (through e, not through b-c-d)', () => {
    const g = buildGraph(db);
    const p = shortestPath(g, 'a', 'd');
    expect(p).toEqual(['a', 'e', 'd']);
  });

  it('returns null when no path connects two disconnected components', () => {
    // "lonely" and "buddy" form their own separate component, unreachable from a/b/c/d/e.
    const withIsland: Pick<Db, 'nodes'> = { nodes: [...db.nodes, d('lonely', [['buddy', 'buddy']])] };
    const g = buildGraph(withIsland);
    expect(g.neighbors.has('lonely')).toBe(true); // sanity: it IS in the graph
    expect(shortestPath(g, 'a', 'lonely')).toBeNull();
  });

  it('returns null for an id that never appears in the graph at all', () => {
    const g = buildGraph(db);
    expect(shortestPath(g, 'a', 'not-a-real-id')).toBeNull();
  });
});
