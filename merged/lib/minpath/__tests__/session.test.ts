import { buildGraph } from '@/lib/minpath/graph';
import { clicksOf, neighborsOf, startSession, step } from '@/lib/minpath/session';
import type { Db, Discovery } from '@/lib/types';

function d(id: string, rec: string[][]): Discovery {
  return {
    id, no: 1, n: id, era: 'origins', cat: 'material', date: '', ds: 0, rar: 'common',
    l1: '', l2: '', l3: '', ev: '', src: [], rec, tags: [], vis: '', depth: 0, need: 0, uses: [],
  } as Discovery;
}

// a - b - c
const db: Pick<Db, 'nodes'> = { nodes: [d('b', [['a', 'a']]), d('c', [['b', 'x']])] };

describe('minimum-path session', () => {
  it('starts with zero clicks and is not done (unless start === target)', () => {
    const s = startSession('a', 'c');
    expect(clicksOf(s)).toBe(0);
    expect(s.done).toBe(false);
  });

  it('starting on the target itself is immediately done', () => {
    const s = startSession('a', 'a');
    expect(s.done).toBe(true);
  });

  it('neighborsOf only offers real graph neighbours of the current node', () => {
    const g = buildGraph(db);
    const s = startSession('a', 'c');
    expect(neighborsOf(g, s)).toEqual(['b']);
  });

  it('step() refuses a non-adjacent node — no teleporting', () => {
    const g = buildGraph(db);
    const s = startSession('a', 'c');
    const r = step(g, s, 'c'); // c is not adjacent to a
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-adjacent');
  });

  it('step() through valid neighbours reaches the target and counts clicks correctly', () => {
    const g = buildGraph(db);
    let s = startSession('a', 'c');
    const r1 = step(g, s, 'b');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.session;
    expect(clicksOf(s)).toBe(1);
    expect(s.done).toBe(false);

    const r2 = step(g, s, 'c');
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    s = r2.session;
    expect(clicksOf(s)).toBe(2);
    expect(s.done).toBe(true);
  });

  it('step() refuses once the session is already done', () => {
    const g = buildGraph(db);
    const s = startSession('a', 'a');
    const r = step(g, s, 'b');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('already-done');
  });
});
