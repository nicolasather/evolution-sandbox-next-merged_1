import { GUIDE_KEY, guidePrefs, isGuideActive, parseGuidePrefs } from '../prefs';

beforeEach(() => { window.localStorage.clear(); guidePrefs._reset(); });

describe('guide preferences', () => {
  it('never-touched: runs only for beginners', () => {
    const p = guidePrefs.get();
    expect(isGuideActive(p, 'civilization', true)).toBe(true);
    expect(isGuideActive(p, 'civilization', false)).toBe(false);
  });

  it('Guide off / Skip guide stops it and persists', () => {
    guidePrefs.skip('civilization');
    expect(isGuideActive(guidePrefs.get(), 'civilization', true)).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(GUIDE_KEY)!).modes.civilization).toBe('off');
    guidePrefs._reset();
    expect(isGuideActive(guidePrefs.get(), 'civilization', true)).toBe(false); // survives a reload
  });

  it('Guide on from Help re-enables it whatever the progress', () => {
    guidePrefs.complete('decipher');
    expect(isGuideActive(guidePrefs.get(), 'decipher', true)).toBe(false);
    guidePrefs.enable('decipher');
    expect(isGuideActive(guidePrefs.get(), 'decipher', false)).toBe(true);
  });

  it('modes are independent', () => {
    guidePrefs.skip('survival');
    expect(isGuideActive(guidePrefs.get(), 'archaeology', true)).toBe(true);
  });

  it('garbage in storage falls back safely', () => {
    expect(parseGuidePrefs('not json').modes).toEqual({});
    expect(parseGuidePrefs('{"modes":{"a":"weird","b":"on"}}').modes).toEqual({ b: 'on' });
  });

  it('notifies subscribers and keeps a stable snapshot until something changes', () => {
    const fn = jest.fn();
    const off = guidePrefs.subscribe(fn);
    const a = guidePrefs.get();
    expect(guidePrefs.get()).toBe(a);
    guidePrefs.skip('x');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(guidePrefs.get()).not.toBe(a);
    off();
  });
});
