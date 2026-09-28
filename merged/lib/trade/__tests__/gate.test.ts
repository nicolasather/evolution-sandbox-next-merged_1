import { reachableRegions, regionGateFor, routeKey } from '@/lib/trade/gate';
import { originOf } from '@/lib/trade/regions';
import type { TradeRoute } from '@/lib/trade/types';

describe('trade regions (data/majors.json join)', () => {
  it('sharp_stone has a firm African origin', () => {
    const o = originOf('sharp_stone');
    expect(o).not.toBeNull();
    expect(o?.region).toBe('africa');
    expect(o?.certainty).toBe('firm');
  });

  it('a discovery with no majors.json entry has no origin (never gated)', () => {
    expect(originOf('not-a-real-id')).toBeNull();
  });

  it('a "multiple"-certainty origin (e.g. independently invented fishing_hook) is never pinned to one region', () => {
    // fishing_hook is certainty: 'multiple' in data/majors.json (Okinawa + Timor) —
    // gating it to one region would misrepresent the record it comes from.
    expect(originOf('fishing_hook')).toBeNull();
  });
});

describe('regionGateFor', () => {
  const noRoutes: TradeRoute[] = [];

  it('never gates when no home region has been chosen', () => {
    expect(regionGateFor('sharp_stone', 'Sharp Stone', null, noRoutes)).toBeNull();
  });

  it('never gates a discovery with no documented single origin', () => {
    expect(regionGateFor('not-a-real-id', 'Something', 'europe', noRoutes)).toBeNull();
  });

  it('never gates when home region already is the origin', () => {
    expect(regionGateFor('sharp_stone', 'Sharp Stone', 'africa', noRoutes)).toBeNull();
  });

  it('gates a foreign-origin discovery with no route yet, with a real, sourced message', () => {
    const lock = regionGateFor('sharp_stone', 'Sharp Stone', 'europe', noRoutes);
    expect(lock).not.toBeNull();
    expect(lock?.originRegion).toBe('africa');
    expect(lock?.message).toMatch(/Sharp Stone/);
    expect(lock?.message).toMatch(/trade route/);
  });

  it('a direct established route to the origin lifts the gate', () => {
    const routes: TradeRoute[] = [{ id: 'r1', a: 'europe', b: 'west_central_asia', establishedAt: 1 }];
    // still blocked: europe->west_central_asia does not reach africa
    expect(regionGateFor('sharp_stone', 'Sharp Stone', 'europe', routes)).not.toBeNull();
    routes.push({ id: 'r2', a: 'west_central_asia', b: 'africa', establishedAt: 2 });
    // now reachable through two hops
    expect(regionGateFor('sharp_stone', 'Sharp Stone', 'europe', routes)).toBeNull();
  });
});

describe('reachableRegions', () => {
  it('always includes the home region itself', () => {
    expect(reachableRegions('africa', [])).toEqual(new Set(['africa']));
  });
});

describe('routeKey', () => {
  it('is order-independent', () => {
    expect(routeKey('africa', 'europe')).toBe(routeKey('europe', 'africa'));
  });
});
