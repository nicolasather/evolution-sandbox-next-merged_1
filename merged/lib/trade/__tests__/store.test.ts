import { tradeStore } from '@/lib/trade/store';

describe('trade store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    tradeStore.reset();
  });

  it('starts with no home region and no routes', () => {
    expect(tradeStore.get().homeRegion).toBeNull();
    expect(tradeStore.get().routes).toEqual([]);
  });

  it('setHomeRegion persists and is idempotent', () => {
    let calls = 0;
    const unsub = tradeStore.subscribe(() => { calls++; });
    tradeStore.setHomeRegion('africa');
    tradeStore.setHomeRegion('africa');
    unsub();
    expect(tradeStore.get().homeRegion).toBe('africa');
    expect(calls).toBe(1);
  });

  it('establishRoute refuses without a home region first', () => {
    expect(tradeStore.establishRoute('africa', 'west_central_asia')).toBe('no-home-region');
  });

  it('establishRoute refuses a non-adjacent pair', () => {
    tradeStore.setHomeRegion('africa');
    expect(tradeStore.establishRoute('africa', 'east_asia')).toBe('not-adjacent');
  });

  it('establishRoute succeeds between adjacent regions and is idempotent', () => {
    tradeStore.setHomeRegion('africa');
    expect(tradeStore.establishRoute('africa', 'west_central_asia')).toBe('ok');
    expect(tradeStore.hasRoute('africa', 'west_central_asia')).toBe(true);
    expect(tradeStore.hasRoute('west_central_asia', 'africa')).toBe(true);
    expect(tradeStore.establishRoute('west_central_asia', 'africa')).toBe('already-connected');
    expect(tradeStore.get().routes).toHaveLength(1);
  });

  it('reloads from storage across a simulated reload', () => {
    tradeStore.setHomeRegion('europe');
    tradeStore.establishRoute('europe', 'west_central_asia');
    tradeStore.reset(); // simulate a fresh in-memory instance, storage already cleared by reset — re-seed it:
    window.localStorage.setItem('evo.trade.v1', JSON.stringify({
      v: 1, homeRegion: 'europe', routes: [{ id: 'x', a: 'europe', b: 'west_central_asia', establishedAt: 1 }],
    }));
    tradeStore.load();
    expect(tradeStore.get().homeRegion).toBe('europe');
    expect(tradeStore.hasRoute('europe', 'west_central_asia')).toBe(true);
  });
});
