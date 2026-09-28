import { buildGraph } from '@/lib/minpath/graph';
import { hubIds, pathLeansOnHub } from '@/lib/minpath/validate';
import type { Discovery } from '@/lib/types';

function d(id: string, rec: string[][]): Discovery {
  return {
    id, no: 1, n: id, era: 'origins', cat: 'material', date: '', ds: 0, rar: 'common',
    l1: '', l2: '', l3: '', ev: '', src: [], rec, tags: [], vis: '', depth: 0, need: 0, uses: [],
  } as Discovery;
}

describe('hubIds / pathLeansOnHub', () => {
  it('flags a node used as an ingredient across many otherwise-unrelated recipes', () => {
    const nodes: Discovery[] = [
      d('hub', []),
      ...Array.from({ length: 12 }, (_, i) => d(`r${i}`, [['hub', `x${i}`]])),
    ];
    const g = buildGraph({ nodes });
    const hubs = hubIds(g);
    expect(hubs.has('hub')).toBe(true);
  });

  it('a low-degree node is never flagged', () => {
    const nodes: Discovery[] = [d('a', [['b', 'c']]), d('b', []), d('c', [])];
    const g = buildGraph({ nodes });
    expect(hubIds(g).has('a')).toBe(false);
  });

  it('pathLeansOnHub only flags a hub strictly between the endpoints', () => {
    const hubs = new Set(['h']);
    expect(pathLeansOnHub(['a', 'h', 'b'], hubs)).toBe(true);
    expect(pathLeansOnHub(['h', 'a', 'b'], hubs)).toBe(false); // hub is the start, not a shortcut
    expect(pathLeansOnHub(['a', 'b', 'h'], hubs)).toBe(false); // hub is the target
    expect(pathLeansOnHub(['a', 'b'], hubs)).toBe(false);
  });
});
