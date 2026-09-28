import { frontier, listLocked } from '@/lib/trade/summary';
import type { Discovery } from '@/lib/types';
import type { TradeRoute } from '@/lib/trade/types';

const sharpStone = { id: 'sharp_stone', n: 'Sharp Stone' } as Discovery;
const stoneFlake = { id: 'stone_flake', n: 'Stone Flake' } as Discovery; // also firm, africa
const notAMajor = { id: 'stone', n: 'Stone' } as Discovery; // primitive, no majors.json entry

describe('listLocked', () => {
  it('is empty with no home region', () => {
    expect(listLocked([sharpStone], () => false, null, [])).toEqual([]);
  });

  it('lists only foreign-origin, not-yet-found discoveries', () => {
    const out = listLocked([sharpStone, stoneFlake, notAMajor], () => false, 'europe', []);
    expect(out.map(e => e.discovery.id).sort()).toEqual(['sharp_stone', 'stone_flake']);
  });

  it('never lists an already-found discovery', () => {
    const out = listLocked([sharpStone], id => id === 'sharp_stone', 'europe', []);
    expect(out).toEqual([]);
  });
});

describe('frontier', () => {
  it('with no routes, offers exactly the home region\'s direct neighbours', () => {
    const edges = frontier('africa', []);
    const targets = edges.map(e => e.to).sort();
    expect(targets).toEqual(['west_central_asia']);
  });

  it('growing the network exposes the next ring of neighbours, not the whole map at once', () => {
    const routes: TradeRoute[] = [{ id: 'r1', a: 'africa', b: 'west_central_asia', establishedAt: 1 }];
    const edges = frontier('africa', routes);
    const targets = new Set(edges.map(e => e.to));
    expect(targets.has('europe')).toBe(true);
    expect(targets.has('south_asia')).toBe(true);
    expect(targets.has('africa')).toBe(false); // already reached, never offered as a target
  });

  it('the americas never appear as a frontier target (no corridor exists yet)', () => {
    const edges = frontier('africa', []);
    expect(edges.some(e => e.to === 'americas')).toBe(false);
  });
});
