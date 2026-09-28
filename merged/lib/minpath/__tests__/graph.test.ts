import { buildGraph, degreeOf } from '@/lib/minpath/graph';
import type { Db, Discovery } from '@/lib/types';

function d(id: string, rec: string[][]): Discovery {
  return {
    id, no: 1, n: id, era: 'origins', cat: 'material', date: '', ds: 0, rar: 'common',
    l1: '', l2: '', l3: '', ev: '', src: [], rec, tags: [], vis: '', depth: 0, need: 0, uses: [],
  } as Discovery;
}

describe('buildGraph', () => {
  it('connects a discovery to every ingredient of every one of its recipes', () => {
    const db: Pick<Db, 'nodes'> = { nodes: [d('cutting', [['stone', 'fiber']]), d('stone', []), d('fiber', [])] };
    const g = buildGraph(db);
    expect(g.neighbors.get('cutting')).toEqual(new Set(['stone', 'fiber']));
    expect(g.neighbors.get('stone')).toEqual(new Set(['cutting']));
  });

  it('is undirected — walking either way works', () => {
    const db: Pick<Db, 'nodes'> = { nodes: [d('x', [['a', 'b']])] };
    const g = buildGraph(db);
    expect(g.neighbors.get('a')?.has('x')).toBe(true);
    expect(g.neighbors.get('x')?.has('a')).toBe(true);
  });

  it('degreeOf counts distinct neighbours across multiple recipes without double-counting', () => {
    const db: Pick<Db, 'nodes'> = { nodes: [d('x', [['a', 'b'], ['a', 'c']])] };
    const g = buildGraph(db);
    expect(degreeOf(g, 'x')).toBe(3); // a, b, c
  });

  it('an id with no recipes and never used as an ingredient has degree 0', () => {
    const db: Pick<Db, 'nodes'> = { nodes: [d('isolated', [])] };
    const g = buildGraph(db);
    expect(degreeOf(g, 'isolated')).toBe(0);
  });
});
