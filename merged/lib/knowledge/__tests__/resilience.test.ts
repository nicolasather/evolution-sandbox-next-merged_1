import { scoreResilience } from '@/lib/knowledge/resilience';
import type { Discovery } from '@/lib/types';
import type { TradeRoute } from '@/lib/trade/types';

const byId = (all: Discovery[]) => (id: string) => all.find(d => d.id === id);

function d(overrides: Partial<Discovery>): Discovery {
  return {
    id: 'x', no: 1, n: 'X', era: 'origins', cat: 'technology', date: '', ds: 0, rar: 'common',
    l1: '', l2: '', l3: '', ev: '', src: [], rec: [['stone', 'wood']], tags: [], vis: '', depth: 0, need: 0, uses: [],
    ...overrides,
  } as Discovery;
}

describe('scoreResilience', () => {
  it('a widely-corroborated, multi-route material is stable with no causes', () => {
    // "fiber" has no majors.json entry and a primitive base — treat as stable baseline
    const fiber = d({ id: 'fiber', n: 'Fibre', primitive: true, rec: [] });
    const score = scoreResilience(fiber, byId([fiber]));
    expect(score.state).toBe('stable');
    expect(score.factors).toEqual([]);
  });

  it('a firm single-origin discovery with only one recipe route is at least fragile', () => {
    const sharpStone = d({ id: 'sharp_stone', n: 'Sharp Stone', cat: 'technology', rec: [['stone', 'stone']] });
    const score = scoreResilience(sharpStone, byId([sharpStone]));
    expect(score.factors.map(f => f.cause)).toContain('single-region');
    expect(score.state).not.toBe('stable');
  });

  it('an oral/practice-only category discovery gets an "undocumented" cause', () => {
    const custom = d({ id: 'custom1', n: 'Some Practice', cat: 'culture', rec: [['a', 'b'], ['c', 'd']] });
    const score = scoreResilience(custom, byId([custom]));
    expect(score.factors.map(f => f.cause)).toContain('undocumented');
  });

  it('a discovery with several alternate recipes does not get "low-redundancy"', () => {
    const multi = d({ id: 'x', cat: 'material', rec: [['a', 'b'], ['c', 'd'], ['e', 'f']] });
    const score = scoreResilience(multi, byId([multi]));
    expect(score.factors.map(f => f.cause)).not.toContain('low-redundancy');
  });

  it('depending on a rare ingredient adds "isolated-dependency"', () => {
    const rareIng = d({ id: 'rareThing', rar: 'rare' });
    const dependent = d({ id: 'dep', rec: [['rareThing', 'wood']] });
    const score = scoreResilience(dependent, byId([rareIng, dependent]));
    expect(score.factors.map(f => f.cause)).toContain('isolated-dependency');
  });

  it('a route reaching the origin region removes the "single-region" cause', () => {
    const sharpStone = d({ id: 'sharp_stone', n: 'Sharp Stone', cat: 'technology', rec: [['stone', 'stone']] });
    const withoutRoute = scoreResilience(sharpStone, byId([sharpStone]), { homeRegion: 'europe', routes: [] });
    expect(withoutRoute.factors.map(f => f.cause)).toContain('single-region');

    const routes: TradeRoute[] = [
      { id: 'r1', a: 'europe', b: 'west_central_asia', establishedAt: 1 },
      { id: 'r2', a: 'west_central_asia', b: 'africa', establishedAt: 2 },
    ];
    const withRoute = scoreResilience(sharpStone, byId([sharpStone]), { homeRegion: 'europe', routes });
    expect(withRoute.factors.map(f => f.cause)).not.toContain('single-region');
    expect(withRoute.score).toBeGreaterThan(withoutRoute.score);
  });

  it('score is always clamped to [0, 1] and state thresholds are respected', () => {
    // sharp_stone: real firm/regional single-origin (single-region) + oral
    // category (undocumented) + one recipe (low-redundancy) + a rare
    // ingredient (isolated-dependency) — every cause at once.
    const rareDep = d({ id: 'dep2', rar: 'rare' });
    const worst = d({ id: 'sharp_stone', n: 'Sharp Stone', cat: 'culture', rec: [['dep2', 'wood']] });
    const score = scoreResilience(worst, byId([worst, rareDep]));
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
    expect(score.factors.length).toBe(4);
    expect(score.state).toBe('at-risk');
  });
});
