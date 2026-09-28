import { isAdjacent, neighborsOf, reachable } from '@/lib/trade/adjacency';

describe('trade adjacency', () => {
  it('africa and west_central_asia are directly adjacent', () => {
    expect(isAdjacent('africa', 'west_central_asia')).toBe(true);
    expect(isAdjacent('west_central_asia', 'africa')).toBe(true);
  });

  it('africa and east_asia are not directly adjacent', () => {
    expect(isAdjacent('africa', 'east_asia')).toBe(false);
  });

  it('a region is never adjacent to itself', () => {
    expect(isAdjacent('africa', 'africa')).toBe(false);
  });

  it('the americas have no corridor to anywhere (deliberate simplification)', () => {
    expect(neighborsOf('americas')).toEqual([]);
  });

  it('reachable() finds a region through two hops of established routes', () => {
    const edges: [string, string][] = [['africa', 'west_central_asia'], ['west_central_asia', 'europe']];
    const set = reachable('africa' as never, edges as never);
    expect(set.has('africa' as never)).toBe(true);
    expect(set.has('europe' as never)).toBe(true);
    expect(set.has('east_asia' as never)).toBe(false);
  });

  it('reachable() with no edges only contains the start region', () => {
    const set = reachable('africa' as never, []);
    expect([...set]).toEqual(['africa']);
  });
});
