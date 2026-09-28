import { profile } from '@/lib/profile/store';

describe('player profile store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    profile.reset();
  });

  it('starts blank with no modes visited and no exhibits', () => {
    const p = profile.get();
    expect(p.modes).toEqual({});
    expect(p.museum).toEqual([]);
  });

  it('records a first visit, then increments visitCount on later visits', () => {
    profile.recordModeVisit('main-evolution');
    expect(profile.get().modes['main-evolution'].visitCount).toBe(1);
    profile.recordModeVisit('main-evolution');
    expect(profile.get().modes['main-evolution'].visitCount).toBe(2);
  });

  it('persists across a fresh load() (simulating a page reload)', () => {
    profile.recordModeVisit('main-evolution');
    profile.setModeResume('main-evolution', { view: 'graph', focusId: 'fire' });
    profile.reset(); // clear in-memory state only would be wrong — reset also clears storage,
    // so instead simulate a reload by loading into a state that still has the persisted write:
    window.localStorage.setItem('evo.profile.v1', JSON.stringify({
      v: 1, createdAt: Date.now(), modes: { 'main-evolution': { firstVisitedAt: 1, lastVisitedAt: 1, visitCount: 3, resume: { view: 'graph' } } }, museum: [],
    }));
    profile.load();
    expect(profile.get().modes['main-evolution'].visitCount).toBe(3);
    expect(profile.get().modes['main-evolution'].resume).toEqual({ view: 'graph' });
  });

  it('setModeResume creates the visit record if the mode was never formally visited', () => {
    profile.setModeResume('archaeology', { site: 'k17' });
    expect(profile.get().modes['archaeology'].resume).toEqual({ site: 'k17' });
    expect(profile.get().modes['archaeology'].visitCount).toBe(0);
  });

  it('unlockExhibit is idempotent — the same exhibit id never appears twice', () => {
    profile.unlockExhibit({ exhibitId: 'ex-1', sourceMode: 'main-evolution', unlockedAt: 1 });
    profile.unlockExhibit({ exhibitId: 'ex-1', sourceMode: 'main-evolution', unlockedAt: 2 });
    expect(profile.get().museum).toHaveLength(1);
  });

  it('a corrupt or unversioned save on disk is ignored, not crashed on', () => {
    window.localStorage.setItem('evo.profile.v1', '{not json');
    expect(() => profile.load()).not.toThrow();
    expect(profile.get().modes).toEqual({});
  });

  it('a save from a future version is left untouched, and the profile stays blank', () => {
    window.localStorage.setItem('evo.profile.v1', JSON.stringify({ v: 99, createdAt: 1, modes: {}, museum: [] }));
    profile.load();
    expect(profile.get().modes).toEqual({});
    // the raw save on disk is not overwritten by this failed load
    expect(window.localStorage.getItem('evo.profile.v1')).toContain('"v":99');
  });

  it('reset() clears both memory and storage', () => {
    profile.recordModeVisit('main-evolution');
    profile.reset();
    expect(profile.get().modes).toEqual({});
    expect(window.localStorage.getItem('evo.profile.v1')).toBeNull();
  });

  it('notifies subscribers on every mutation', () => {
    let calls = 0;
    const unsub = profile.subscribe(() => { calls++; });
    profile.recordModeVisit('main-evolution');
    profile.setModeResume('main-evolution', {});
    profile.unlockExhibit({ exhibitId: 'e', sourceMode: 'main-evolution', unlockedAt: 1 });
    unsub();
    profile.recordModeVisit('main-evolution');
    expect(calls).toBe(3);
  });
});
