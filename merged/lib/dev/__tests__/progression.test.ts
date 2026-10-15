import { Engine } from '@/lib/engine';
import { playDb } from '@/lib/processing';
import { ALL_UNLOCKED, FEATURES, featureOfMode, unlockedFor } from '@/lib/unlocks/registry';
import { MODES } from '@/lib/modes/registry';
import { blankManifest, chapterStatuses, isChapterUnlocked, sandboxTiers } from '@/lib/civilization/lifelines/campaign';
import { ix } from '@/lib/civilization/lifelines/__testing__/helpers';
import { DevOverrideStore } from '../overrides';
import { SCENARIOS, fastForward } from '../scenarios';

const memStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const betaStore = (on: boolean) => { const s = new DevOverrideStore({ enabled: () => on, storage: () => memStore() }); s.setPhase('ok'); return s; };

describe('production progression is unchanged', () => {
  it('a fresh player has no features and every non-main mode is locked', () => {
    const open = unlockedFor({ made: 0, eraIndex: 0 });
    expect(open.size).toBe(0);
    for (const m of MODES.filter(x => x.status === 'available')) {
      const f = featureOfMode(m.id);
      if (f) expect(open.has(f)).toBe(false);
    }
  });
  it('an Engine without hooks ignores the dev methods completely', () => {
    const e = new Engine(playDb);
    const before = e.found.size;
    expect(e.devGrant(playDb.nodes.slice(-5).map(n => n.id))).toBe(0);
    expect(e.devGrantTechnique('cut' as never)).toBe(false);
    e.devSettle();
    expect(e.found.size).toBe(before);
  });
  it('an Engine whose hooks say "not enabled" behaves like production', () => {
    const e = new Engine(playDb, { dev: { enabled: () => false, chronology: () => true } } as never);
    expect(e.devGrant(playDb.nodes.slice(-5).map(n => n.id))).toBe(0);
  });
  it('Civilization chapters keep their order: only chapter 1 is open for a new player', () => {
    const m = blankManifest('t');
    const st = chapterStatuses(ix, m);
    expect(st[0].unlocked).toBe(true);
    expect(st.slice(1).every(s => !s.unlocked)).toBe(true);
    expect(st.some(s => s.viaOverride)).toBe(false);
  });
});

describe('beta override opens things without recording progress', () => {
  it('every registry mode is reachable through unlockAll (and maps to a feature id or Main Evolution)', () => {
    for (const m of MODES.filter(x => x.status === 'available')) {
      const f = featureOfMode(m.id);
      if (f) { expect(FEATURES.some(x => x.id === f)).toBe(true); expect(ALL_UNLOCKED.has(f)).toBe(true); }
      else expect(['main-evolution']).toContain(m.id);
    }
  });
  it('the late Civilization chapter is enterable with zero completions, and the manifest stays empty', () => {
    const m = blankManifest('t');
    const last = ix.chaptersByOrder[ix.chaptersByOrder.length - 1];
    expect(isChapterUnlocked(ix, m, last)).toBe(false);
    const st = chapterStatuses(ix, m, { openAll: true });
    expect(st.every(s => s.unlocked)).toBe(true);
    expect(st[st.length - 1].viaOverride).toBe(true);
    expect(st.every(s => !s.completed)).toBe(true);
    expect(Object.keys(m.completions)).toHaveLength(0);
    expect(sandboxTiers(ix, m, { openAll: true }).every(t => !t.firstChapter || t.unlocked)).toBe(true);
  });
  it('turning the override off restores the real state; the manifest was never touched', () => {
    const m = blankManifest('t'); const snap = JSON.stringify(m);
    chapterStatuses(ix, m, { openAll: true });
    const off = chapterStatuses(ix, m);
    expect(off.slice(1).every(s => !s.unlocked)).toBe(true);
    expect(JSON.stringify(m)).toBe(snap);
  });
  it('the three scenarios make growing amounts of progress under an active beta', () => {
    const store = betaStore(true);
    const sizes = SCENARIOS.map(sc => {
      const e = new Engine(playDb, { dev: { enabled: () => store.isActive(), chronology: () => store.get().chronology } } as never);
      return fastForward(e, sc.untilEra, sc.maxMade).made;
    });
    expect(sizes[0]).toBeGreaterThan(0);
    expect(sizes[1]).toBeGreaterThan(sizes[0]);
    expect(sizes[2]).toBeGreaterThan(sizes[1]);
  }, 120000);
});
