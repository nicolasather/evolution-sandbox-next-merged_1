import scenes from '@/data/scenes.json';
import regionsJson from '@/data/scene-regions.json';
import { fit, hitRegion, pointInPoly, regionsFor, toScene, toScreen } from '../regions';

const VW = 1440, VH = 900;

describe('scene regions', () => {
  it('pointInPoly handles convex and concave shapes', () => {
    const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPoly(5, 5, sq)).toBe(true);
    expect(pointInPoly(11, 5, sq)).toBe(false);
    const L: [number, number][] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
    expect(pointInPoly(2, 8, L)).toBe(true);
    expect(pointInPoly(8, 8, L)).toBe(false);
  });

  it('every region belongs to a real scene and stays inside the 1600×900 picture', () => {
    const ids = new Set((scenes as { id: string }[]).map(s => s.id));
    for (const [id, list] of Object.entries(regionsJson as Record<string, { kind: string; depth: number; poly: number[][] }[]>)) {
      expect(ids.has(id)).toBe(true);
      for (const r of list) {
        expect(['water', 'grass', 'dust']).toContain(r.kind);
        expect(r.poly.length).toBeGreaterThanOrEqual(3);
        for (const [x, y] of r.poly) {
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1600);
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(900);
        }
      }
    }
  });

  it('a scene with nothing to splash in has no regions', () => {
    expect(regionsFor('digital')).toEqual([]);
    expect(regionsFor('no-such-scene')).toEqual([]);
  });

  it('finds water in the ancient city and ground below it, but nothing in the sky', () => {
    const par = { x: 0, y: 0 };
    const at = (u: number, v: number) => {
      const { s, ox, oy } = fit(VW, VH);
      return hitRegion('ancientcity', ox + u * s, oy + v * s, VW, VH, par);
    };
    expect(at(800, 700)?.kind).toBe('water');
    expect(at(800, 850)?.kind).toBe('dust');
    expect(at(800, 200)).toBeNull();
  });

  it('parallax drift moves the hit area with the picture', () => {
    // a point just above the water's top edge is water once the layer has drifted up to meet it
    const { s, ox, oy } = fit(VW, VH);
    const cy = oy + 640 * s;                           // scene v = 640, two units above the shore (642)
    expect(hitRegion('ancientcity', ox + 800 * s, cy, VW, VH, { x: 0, y: 0 })).toBeNull();
    const drifted = hitRegion('ancientcity', ox + 800 * s, cy, VW, VH, { x: 0, y: 1 });
    expect(drifted?.kind).toBe('water');               // 1 × 0.6 × 12 = 7.2 scene units of drift
  });

  it('toScene and toScreen are inverses', () => {
    const par = { x: 0.4, y: -0.3 };
    const p = toScene(500, 400, VW, VH, par, 0.65);
    const back = toScreen(p.u, p.v, VW, VH, par, 0.65);
    expect(back.x).toBeCloseTo(500, 6);
    expect(back.y).toBeCloseTo(400, 6);
  });
});
