import { DevOverrideStore, NO_OVERRIDES, BETA_DEFAULTS, DEV_OVERRIDES_KEY, parseOverrides, cleanSeed } from '../overrides';
import { clientDevToolsEnabled, serverDevToolsEnabled } from '../env';

const mem = () => {
  const m = new Map<string, string>();
  return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
};

describe('production: privileges never exist', () => {
  it('build flag off => NO_OVERRIDES even when storage holds a full override and the server "approved"', () => {
    const { m, s } = mem();
    m.set(DEV_OVERRIDES_KEY, JSON.stringify({ unlockAll: true, chronology: true, skipIntros: true, revealAll: true, speed: 10, seed: 'x' }));
    const st = new DevOverrideStore({ enabled: () => false, storage: () => s });
    st.setPhase('ok');
    expect(st.get()).toBe(NO_OVERRIDES);
    expect(st.isActive()).toBe(false);
    st.set({ unlockAll: true });
    expect(st.get()).toBe(NO_OVERRIDES);
    expect(m.get(DEV_OVERRIDES_KEY)).toContain('"speed":10'); // untouched, ignored
  });
  it('flag on but server has not said yes => still nothing', () => {
    const { s } = mem();
    const st = new DevOverrideStore({ enabled: () => true, storage: () => s });
    expect(st.get()).toBe(NO_OVERRIDES);
    st.setPhase('checking'); expect(st.get()).toBe(NO_OVERRIDES);
    st.setPhase('denied'); expect(st.get()).toBe(NO_OVERRIDES);
    st.setPhase('error'); expect(st.get()).toBe(NO_OVERRIDES);
  });
  it('env gates: production deploy always refuses', () => {
    expect(serverDevToolsEnabled({ ENABLE_DEV_TOOLS: 'true', VERCEL_ENV: 'production' })).toBe(false);
    expect(serverDevToolsEnabled({ ENABLE_DEV_TOOLS: 'true', VERCEL_ENV: 'preview' })).toBe(true);
    expect(serverDevToolsEnabled({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(serverDevToolsEnabled({})).toBe(false);
    expect(clientDevToolsEnabled()).toBe(false); // test env has no flag
  });
  it('the URL is never consulted', () => {
    window.history.replaceState({}, '', '/?dev=1&unlockAll=true&ENABLE_DEV_TOOLS=true');
    const st = new DevOverrideStore({ enabled: () => false, storage: () => null });
    st.setPhase('ok');
    expect(st.get()).toBe(NO_OVERRIDES);
    window.history.replaceState({}, '', '/');
  });
});

describe('beta: authorised overrides', () => {
  const make = () => { const x = mem(); const st = new DevOverrideStore({ enabled: () => true, storage: () => x.s }); return { ...x, st }; };
  it('apply after the server says ok, persist, and can be switched off', () => {
    const { st, m } = make();
    st.setPhase('ok');
    expect(st.get()).toMatchObject({ unlockAll: true, chronology: true });
    st.set({ chronology: false, speed: 4, seed: 'abc-1' });
    expect(st.get()).toMatchObject({ chronology: false, speed: 4, seed: 'abc-1', unlockAll: true });
    expect(JSON.parse(m.get(DEV_OVERRIDES_KEY)!)).toMatchObject({ speed: 4 });
    st.set({ unlockAll: false, chronology: false });
    expect(st.get().unlockAll).toBe(false);
  });
  it('snapshot is stable between changes', () => {
    const { st } = make(); st.setPhase('ok');
    expect(st.get()).toBe(st.get());
  });
  it('withChronology opens the gate only for the duration of the call', () => {
    const { st } = make(); st.setPhase('ok'); st.set({ chronology: false });
    expect(st.get().chronology).toBe(false);
    st.withChronology(() => expect(st.get().chronology).toBe(true));
    expect(st.get().chronology).toBe(false);
  });
  it('bad stored data and bad seeds fall back safely', () => {
    expect(parseOverrides('not json')).toEqual(BETA_DEFAULTS);
    expect(parseOverrides(JSON.stringify({ speed: 999, seed: '<script>' }))).toEqual(BETA_DEFAULTS);
    expect(cleanSeed('ok_seed-1')).toBe('ok_seed-1');
    expect(cleanSeed('a b')).toBe('');
  });
});
