import rawDb from '@/data/db.json';
import { dailyChallenge, pickChallenge } from '@/lib/minpath/daily';
import { buildGraph } from '@/lib/minpath/graph';
import { shortestPath } from '@/lib/minpath/pathfind';
import { hubIds, pathLeansOnHub } from '@/lib/minpath/validate';
import { createRng } from '@/lib/seed';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

describe('minimum-path daily challenge (real database)', () => {
  it('produces a real, connected, non-trivial pair', () => {
    const c = dailyChallenge(db, new Date('2026-09-28T00:00:00Z'));
    expect(c).not.toBeNull();
    if (!c) return;
    expect(db.nodes.some(n => n.id === c.startId)).toBe(true);
    expect(db.nodes.some(n => n.id === c.targetId)).toBe(true);
    expect(c.startId).not.toBe(c.targetId);
    const graph = buildGraph(db);
    const path = shortestPath(graph, c.startId, c.targetId);
    expect(path).not.toBeNull();
    expect((path?.length ?? 0) - 1).toBe(c.optimalLength);
    expect(c.optimalLength).toBeGreaterThanOrEqual(3);
  });

  it('does not lean on a hub node for its apparent difficulty', () => {
    const c = dailyChallenge(db, new Date('2026-09-28T00:00:00Z'));
    if (!c) return;
    const graph = buildGraph(db);
    const hubs = hubIds(graph);
    const path = shortestPath(graph, c.startId, c.targetId)!;
    expect(pathLeansOnHub(path, hubs)).toBe(false);
  });

  it('is deterministic — the same UTC day always produces the same pair', () => {
    const a = dailyChallenge(db, new Date('2026-09-28T02:00:00Z'));
    const b = dailyChallenge(db, new Date('2026-09-28T22:00:00Z'));
    expect(a).toEqual(b);
  });

  it('changes on the next calendar day', () => {
    const day1 = dailyChallenge(db, new Date('2026-09-28T00:00:00Z'));
    const day2 = dailyChallenge(db, new Date('2026-09-29T00:00:00Z'));
    expect(day1).not.toBeNull();
    expect(day2).not.toBeNull();
    expect(`${day1?.startId}|${day1?.targetId}`).not.toBe(`${day2?.startId}|${day2?.targetId}`);
  });

  it('pickChallenge terminates and returns null gracefully on an impossible constraint, never throwing', () => {
    const rng = createRng('bounds-test');
    expect(() => pickChallenge(db, rng, { minHops: 999, maxHops: 1000 })).not.toThrow();
    expect(pickChallenge(db, rng, { minHops: 999, maxHops: 1000 })).toBeNull();
  });
});
