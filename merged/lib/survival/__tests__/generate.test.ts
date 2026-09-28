import { generateCamp } from '@/lib/survival/generate';

describe('generateCamp', () => {
  it('is deterministic for the same seed', () => {
    const a = generateCamp('day-1');
    const b = generateCamp('day-1');
    expect(a).toEqual(b);
  });

  it('different seeds produce different terrain', () => {
    const a = generateCamp('seed-a');
    const b = generateCamp('seed-b');
    expect(a.terrain.tiles).not.toEqual(b.terrain.tiles);
  });

  it('always has at least one water tile and two woodland tiles reachable', () => {
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const c = generateCamp(seed);
      const flat = c.terrain.tiles.flat();
      expect(flat.filter(t => t === 'water').length).toBeGreaterThanOrEqual(1);
      expect(flat.filter(t => t === 'woodland').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('the camp tile is marked and matches campX/campY', () => {
    const c = generateCamp('camp-check');
    expect(c.terrain.tiles[c.terrain.campY][c.terrain.campX]).toBe('camp');
  });

  it('starts with 3 distinct-trait members and a sane initial state', () => {
    const c = generateCamp('members-check');
    expect(c.members).toHaveLength(3);
    expect(new Set(c.members.map(m => m.trait)).size).toBe(3);
    expect(c.day).toBe(1);
    expect(c.ending).toBe('ongoing');
    expect(c.fire.lit).toBe(false);
    expect(c.shelter.level).toBe(0);
  });
});
