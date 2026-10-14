import { fitPositions, mountMesh, liveContexts, MAX_LIVE_CONTEXTS } from '../renderer';
import { meshFor, planFor } from '../plan';
import { ARCHETYPES } from '../types';
import { MATERIAL_LOOK } from '../materials';

describe('renderer framing and limits', () => {
  it('fitPositions centres every archetype on the origin and fits a unit sphere', () => {
    for (const a of ARCHETYPES) {
      const src = meshFor(planFor({ itemId: 't_' + a, archetype: a, family: 'stone' }), 0).positions;
      const out = fitPositions(src);
      expect(out.length).toBe(src.length);
      let r = 0; const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < out.length; i += 3) {
        r = Math.max(r, Math.hypot(out[i], out[i + 1], out[i + 2]));
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], out[i + k]); hi[k] = Math.max(hi[k], out[i + k]); }
      }
      expect(r).toBeLessThanOrEqual(0.93);
      for (let k = 0; k < 3; k++) expect(Math.abs((lo[k] + hi[k]) / 2)).toBeLessThan(0.93); // bounding-box centre near 0
      expect(src).not.toBe(out); // the silhouette mesh is never mutated
    }
  });
  it('does not mutate the source mesh and tolerates an empty one', () => {
    const src = new Float32Array([5, 5, 5, 7, 5, 5]); const copy = Float32Array.from(src);
    fitPositions(src); expect(src).toEqual(copy);
    expect(fitPositions(new Float32Array(0)).length).toBe(0);
  });
  it('without WebGL (jsdom) mountMesh returns null and holds no context', async () => {
    const m = meshFor(planFor({ itemId: 'x', archetype: 'blade', family: 'stone' }), 0);
    expect(await mountMesh(document.createElement('canvas'), m, MATERIAL_LOOK.stone, { reducedMotion: true })).toBeNull();
    expect(liveContexts()).toBe(0);
    expect(MAX_LIVE_CONTEXTS).toBeLessThan(16);
  });
});
