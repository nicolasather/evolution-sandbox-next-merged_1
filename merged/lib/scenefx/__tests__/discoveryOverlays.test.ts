import regionsJson from '@/data/scene-regions.json';
import { CAMPFIRE_DISCOVERY_ID, overlaysFor, shiftPath } from '../discoveryOverlays';

describe('discovery overlays', () => {
  it('shiftPath moves only the absolute anchor of each subpath, not the strokes after it', () => {
    const d = 'M10 20l5-5M30 40q6-16 10-8';
    expect(shiftPath(d, 100, -5)).toBe('M110 15l5-5M130 35q6-16 10-8');
  });

  it('nothing is drawn before the discovery is made', () => {
    expect(overlaysFor('ancientcity', new Set())).toBe('');
    expect(overlaysFor('ancientcity', new Set(['fire']))).toBe(''); // 'fire' alone, not the tamed one
  });

  it('a scene with no dry ground gets no mark, discovery or not', () => {
    const found = new Set([CAMPFIRE_DISCOVERY_ID]);
    expect(overlaysFor('digital', found)).toBe('');
    expect(overlaysFor('nightcity', found)).toBe('');
  });

  it('the campfire mark appears once Controlled Fire is found, in the scene it started in', () => {
    const found = new Set([CAMPFIRE_DISCOVERY_ID]);
    const out = overlaysFor('firecamp', found);
    expect(out).toContain('data-depth="1"');
    expect(out).toContain('class="flicker"');
    expect(out).toContain('class="rise"');
  });

  it('the world remembers: the mark still appears in a much later scene', () => {
    // the player is deep in the Ancient City; Controlled Fire is Stone Age history by now
    const out = overlaysFor('ancientcity', new Set([CAMPFIRE_DISCOVERY_ID]));
    expect(out).toContain('class="flicker"');
  });

  it('every mark stays inside the 1600×900 picture', () => {
    const found = new Set([CAMPFIRE_DISCOVERY_ID]);
    for (const id of Object.keys(regionsJson as Record<string, unknown>)) {
      const out = overlaysFor(id, found);
      if (!out) continue;
      for (const [, x, y] of out.matchAll(/M(-?\d+) (-?\d+)/g)) {
        expect(Number(x)).toBeGreaterThanOrEqual(-100);
        expect(Number(x)).toBeLessThanOrEqual(1700);
        expect(Number(y)).toBeGreaterThanOrEqual(-200);
        expect(Number(y)).toBeLessThanOrEqual(1000);
      }
    }
  });

  it('is deterministic — same inputs, same markup, every time', () => {
    const found = new Set([CAMPFIRE_DISCOVERY_ID]);
    expect(overlaysFor('savanna', found)).toBe(overlaysFor('savanna', found));
  });
});
