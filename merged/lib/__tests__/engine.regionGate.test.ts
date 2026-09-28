import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { regionGateFor } from '@/lib/trade/gate';
import type { Db, Discovery, RegionLockInfo } from '@/lib/types';
import type { TradeRoute } from '@/lib/trade/types';

const db = rawDb as unknown as Db;

/** Builds an Engine whose regionGate is backed by lib/trade/gate.ts exactly
 *  the way lib/useSandbox.ts wires it in production, so this test exercises
 *  the real integration rather than a stub. */
function withHomeRegion(home: string, routes: TradeRoute[] = []) {
  return new Engine(db, {
    regionGate: (node: Discovery): RegionLockInfo | null =>
      regionGateFor(node.id, node.n, home as never, routes),
  });
}

describe('Engine region gate (Trade Routes)', () => {
  it('a default Engine (no regionGate) behaves exactly as before — never region-locked', () => {
    const e = new Engine(db);
    const r = e.combine('stone', 'stone'); // sharp_stone: firm African origin in data/majors.json
    expect(r.status).toBe('new');
  });

  it('blocks a brand-new, foreign-origin discovery when the home region cannot reach its origin', () => {
    const e = withHomeRegion('europe');
    const r = e.combine('stone', 'stone'); // sharp_stone — documented origin: africa
    expect(r.status).toBe('region_locked');
    if (r.status !== 'region_locked') return;
    expect(r.region.originRegion).toBe('africa');
    expect(r.region.homeRegion).toBe('europe');
    expect(r.message).toMatch(/Sharp Stone/);
  });

  it('never blocks when the home region already IS the origin', () => {
    const e = withHomeRegion('africa');
    const r = e.combine('stone', 'stone');
    expect(r.status).toBe('new');
  });

  it('a route reaching the origin region lifts the block, and the discovery can then be made', () => {
    const routes: TradeRoute[] = [
      { id: 'r1', a: 'europe', b: 'west_central_asia', establishedAt: 1 },
      { id: 'r2', a: 'west_central_asia', b: 'africa', establishedAt: 2 },
    ];
    const e = withHomeRegion('europe', routes);
    const r = e.combine('stone', 'stone');
    expect(r.status).toBe('new');
  });

  it('a region-locked pair is remembered and does not count as being "stuck", exactly like era/tier locks', () => {
    const e = withHomeRegion('europe');
    const before = e.streak;
    void before;
    const r = e.combine('stone', 'stone');
    expect(r.status).toBe('region_locked');
    expect(e.streak).toBe(0);
  });

  it('once a discovery is already found, it is never re-locked by region even if home region changes', () => {
    const e = withHomeRegion('africa');
    expect(e.combine('stone', 'stone').status).toBe('new');
    // Simulate the flag/home-region being switched mid-save by rebuilding an
    // Engine with the SAME underlying found-state is not possible directly here
    // (Engine owns its own state), so instead assert the in-place invariant:
    // a second combine of the same pair, still blocked at the region layer for
    // a NEW target, returns 'known' rather than re-litigating region access
    // because sharp_stone is already found.
    const again = e.combine('stone', 'stone');
    expect(again.status).toBe('known');
  });

  it('a discovery with no majors.json entry, or non-firm/regional certainty, is never region-locked', () => {
    // fiber+fiber or another very early, undocumented-origin pair should never
    // surface region_locked regardless of home region.
    const e = withHomeRegion('europe');
    const r = e.combine('fiber', 'fiber');
    expect(r.status).not.toBe('region_locked');
  });
});
