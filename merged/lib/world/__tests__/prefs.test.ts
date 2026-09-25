import { playback, setWorldModePref, subscribeWorldMode, worldModePref } from '../prefs';

function reducedMotion(on: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (q: string) => ({
      matches: on && q.includes('prefers-reduced-motion'), media: q, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => { window.localStorage.clear(); reducedMotion(false); });

describe('world mode preference', () => {
  it('defaults to the full sequence', () => {
    expect(worldModePref()).toBe('full');
  });

  it('remembers a choice and ignores junk', () => {
    setWorldModePref('quick');
    expect(worldModePref()).toBe('quick');
    window.localStorage.setItem('evo.world.mode', 'sideways');
    expect(worldModePref()).toBe('full');
  });

  it('tells subscribers when it changes', () => {
    const fn = jest.fn();
    const off = subscribeWorldMode(fn);
    setWorldModePref('off');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    setWorldModePref('full');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('survives blocked storage', () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(worldModePref()).toBe('full');
    expect(() => setWorldModePref('off')).not.toThrow();
    get.mockRestore(); set.mockRestore();
  });
});

describe('playback', () => {
  it('full: the whole sequence', () => {
    expect(playback('full')).toEqual({ enabled: true, motion: 'full', shorten: false });
  });

  it('quick: the shorter reveal for every major', () => {
    expect(playback('quick')).toEqual({ enabled: true, motion: 'full', shorten: true });
  });

  it('off: no globe at all', () => {
    expect(playback('off').enabled).toBe(false);
  });

  it('reduced motion always wins over the visitor\'s choice — the globe stays, the motion goes', () => {
    reducedMotion(true);
    for (const m of ['full', 'quick'] as const) {
      const p = playback(m);
      expect(p.enabled).toBe(true);
      expect(p.motion).toBe('reduced');
    }
    expect(playback('off').enabled).toBe(false);
  });
});
