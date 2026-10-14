/* ============================================================================
   HAND-AUTHORED reference plates (development only).

   These are NOT model output. They exist to (1) prove the component library, compiler
   and renderer can express recognisable plates, (2) drive the automated tests, and
   (3) act as fake model replies for the Ollama-adapter tests. Anything stored from
   these is tagged source:"fixture" and is never counted as AI-generated.
   ========================================================================== */

import type { PlateSpec } from './schema';

type P = PlateSpec['layers'][number]['parts'][number];
const part = (c: string, p: Record<string, unknown>, o: Partial<Omit<P, 'c' | 'p'>> = {}): P => ({ c, x: 50, y: 50, rot: 0, s: 1, flip: false, p, ...o });

export const FIXTURES: Record<string, PlateSpec> = {
  vl_amphora: {
    title: 'Amphora',
    layers: [
      { z: -6, parts: [
        part('polyline', { pts: [[-6, -26], [-16, -31], [-21, -20], [-17, -8]], smooth: true }, { x: 50, y: 48, w: 'main' }),
        part('polyline', { pts: [[-6, -26], [-16, -31], [-21, -20], [-17, -8]], smooth: true }, { x: 50, y: 48, flip: true, w: 'main' }),
        part('polyline', { pts: [[-4, -27], [-13, -30], [-17, -20], [-14, -10]], smooth: true }, { x: 50, y: 48, w: 'fine', o: 0.6 }),
        part('polyline', { pts: [[-4, -27], [-13, -30], [-17, -20], [-14, -10]], smooth: true }, { x: 50, y: 48, flip: true, w: 'fine', o: 0.6 }),
      ] },
      { z: 0, parts: [
        part('lathe', { profile: [[8, -36], [10, -33], [5.5, -28], [5.5, -22], [17, -12], [22, 2], [18, 17], [9, 29], [3.5, 36]], bands: [-6, 6, 14], inner: true }, { x: 50, y: 50, w: 'main' }),
        part('hatch', { w: 30, h: 38, angle: 62, n: 9, shape: 'ellipse' }, { x: 50, y: 56, w: 'hair', o: 0.4 }),
        part('ring_set', { r: 8, n: 2, gap: 2, squash: 0.28 }, { x: 50, y: 14, w: 'fine' }),
      ] },
      { z: 6, parts: [
        part('dots', { n: 14, spread: 18, r: 0.9, seed: 5 }, { x: 50, y: 56, o: 0.7 }),
        part('stick', { x1: -3, y1: 0, x2: 3, y2: 0, t: 0 }, { x: 50, y: 88, w: 'fine' }),
      ] },
    ],
  },
  vl_roman_arch: {
    title: 'Roman Arch',
    layers: [
      { z: -5, parts: [part('courses', { w: 70, h: 56, rows: 8, brick: 15, bond: 'running' }, { x: 50, y: 52, w: 'hair', o: 0.5 })] },
      { z: 0, parts: [
        part('arch', { span: 38, rise: 19, thick: 7, voussoirs: 13, pier: 22, pw: 11, count: 1, keystone: true }, { x: 50, y: 52, w: 'main' }),
        part('rect', { w: 74, h: 6 }, { x: 50, y: 82, w: 'fine' }),
        part('rect', { w: 74, h: 5 }, { x: 50, y: 21, w: 'fine' }),
      ] },
      { z: 6, parts: [part('dots', { n: 10, spread: 30, r: 0.9, seed: 9, shape: 'box' }, { x: 50, y: 52, o: 0.6 })] },
    ],
  },
  vl_aqueduct: {
    title: 'Roman Aqueduct',
    layers: [
      { z: -6, parts: [part('arch', { span: 17, rise: 8.5, thick: 4, voussoirs: 9, pier: 20, pw: 6, count: 4, deck: true }, { x: 50, y: 38, w: 'fine', o: 0.7, s: 0.9 })] },
      { z: 0, parts: [
        part('arch', { span: 19, rise: 9.5, thick: 4.5, voussoirs: 9, pier: 26, pw: 7, count: 4, deck: true }, { x: 50, y: 72, w: 'main' }),
        part('courses', { w: 82, h: 6, rows: 2, brick: 9, bond: 'running' }, { x: 50, y: 22, w: 'fine' }),
      ] },
      { z: 6, parts: [part('dots', { n: 8, spread: 36, r: 0.8, seed: 2, shape: 'box' }, { x: 50, y: 52, o: 0.6 })] },
    ],
  },
  vl_post_windmill: {
    title: 'Post Windmill',
    layers: [
      { z: -6, parts: [part('sails', { n: 4, len: 40, w: 11, lattice: 6, hub: 3.5, start: 22 }, { x: 52, y: 38, w: 'fine' })] },
      { z: 0, parts: [
        part('portal', { w: 26, h: 30, bays: 1, depth: 6, t: 3, brace: true }, { x: 56, y: 40 }),
        part('stick', { x1: 0, y1: 0, x2: 0, y2: 28, t: 4 }, { x: 56, y: 56, w: 'main' }),
        part('stick', { x1: -14, y1: 26, x2: 0, y2: 8, t: 2.4 }, { x: 56, y: 56, w: 'fine' }),
        part('stick', { x1: 14, y1: 26, x2: 0, y2: 8, t: 2.4 }, { x: 56, y: 56, w: 'fine' }),
        part('stick', { x1: -20, y1: 33, x2: 20, y2: 33, t: 0 }, { x: 56, y: 56, w: 'main' }),
        part('stick', { x1: 0, y1: 0, x2: 26, y2: 22, t: 2 }, { x: 70, y: 52, w: 'fine' }),
      ] },
      { z: 6, parts: [part('dots', { n: 9, spread: 30, r: 0.9, seed: 7 }, { x: 50, y: 50, o: 0.6 })] },
    ],
  },
  vl_astrolabe: {
    title: 'Astrolabe',
    layers: [
      { z: -6, parts: [
        part('dial', { r: 36, ticks: 72, major: 6, tickLen: 2.4, majorLen: 4.5, rings: 3, hands: [], hub: 0 }, { x: 50, y: 56 }),
        part('ring_set', { r: 6, n: 2, gap: 2 }, { x: 50, y: 13, w: 'main' }),
      ] },
      { z: 0, parts: [
        part('ring_set', { r: 22, n: 3, gap: 7, squash: 0.62 }, { x: 50, y: 62, w: 'fine' }),
        part('ellipse', { rx: 22, ry: 22 }, { x: 50, y: 56, w: 'fine', o: 0.7 }),
        part('polyline', { pts: [[-36, 0], [36, 0]] }, { x: 50, y: 56, w: 'fine' }),
        part('polyline', { pts: [[0, -36], [0, 36]] }, { x: 50, y: 56, w: 'fine' }),
      ] },
      { z: 7, parts: [
        part('rose', { points: 8, r: 30, inner: 0.22, ring: false, ordinal: 0.55 }, { x: 50, y: 56, rot: 18, w: 'main', o: 0.9 }),
        part('stick', { x1: -34, y1: 28, x2: 34, y2: -28, t: 4, caps: 'point' }, { x: 50, y: 56, w: 'main' }),
        part('dots', { n: 12, spread: 28, r: 1, seed: 11 }, { x: 50, y: 56 }),
      ] },
    ],
  },
  vl_bronze_sword: {
    title: 'Bronze Sword',
    layers: [
      { z: -4, parts: [part('blade', { len: 64, w: 17, curve: 0, tip: 'point', base: 'flat', midrib: true, bevel: true, belly: 0.45 }, { x: 50, y: 50, rot: -90, w: 'fine', o: 0.5, s: 1.04 })] },
      { z: 0, parts: [
        part('blade', { len: 64, w: 15, curve: 0, tip: 'point', base: 'flat', midrib: true, bevel: true, belly: 0.45 }, { x: 50, y: 49, rot: -90, w: 'main' }),
        part('stick', { x1: -9, y1: 0, x2: 9, y2: 0, t: 3 }, { x: 50, y: 76, w: 'main' }),
        part('stick', { x1: 0, y1: 0, x2: 0, y2: 12, t: 4.2, caps: 'round' }, { x: 50, y: 77, w: 'main' }),
        part('ellipse', { rx: 4.5, ry: 3 }, { x: 50, y: 92, w: 'main' }),
        part('rivets', { x1: -6, y1: 0, x2: 6, y2: 0, n: 4, r: 0.9 }, { x: 50, y: 76 }),
      ] },
      { z: 6, parts: [part('dots', { n: 9, spread: 14, r: 0.8, seed: 3, shape: 'box' }, { x: 50, y: 40, o: 0.7 })] },
    ],
  },
  vl_armillary_sphere: {
    title: 'Armillary Sphere',
    layers: [
      { z: -7, parts: [part('ring_set', { r: 34, n: 1, squash: 1 }, { x: 50, y: 46, w: 'main' })] },
      { z: 0, parts: [
        part('ellipse', { rx: 34, ry: 10 }, { x: 50, y: 46, rot: -22, w: 'main' }),
        part('ellipse', { rx: 34, ry: 12 }, { x: 50, y: 46, rot: 22, w: 'fine' }),
        part('ellipse', { rx: 34, ry: 34 }, { x: 50, y: 46, rot: 0, w: 'fine', o: 0.6 }),
        part('ellipse', { rx: 14, ry: 34 }, { x: 50, y: 46, w: 'fine', o: 0.7 }),
        part('stick', { x1: 0, y1: -42, x2: 0, y2: 42, t: 0 }, { x: 50, y: 46, w: 'main', rot: 22 }),
      ] },
      { z: 7, parts: [
        part('facets', { rx: 6, ry: 6, verts: 8, smooth: true, scars: 0 }, { x: 50, y: 46, w: 'main' }),
        part('polyline', { pts: [[-18, 0], [-12, -6], [12, -6], [18, 0], [10, 7], [-10, 7]], closed: true, smooth: true }, { x: 50, y: 84, w: 'main' }),
        part('stick', { x1: 0, y1: 0, x2: 0, y2: 12, t: 3 }, { x: 50, y: 73, w: 'main' }),
        part('dots', { n: 14, spread: 32, r: 1, seed: 21, shape: 'disc' }, { x: 50, y: 46 }),
      ] },
    ],
  },
  vl_solar_panel: {
    title: 'Solar Panel',
    layers: [
      { z: -5, parts: [
        part('stick', { x1: -20, y1: 0, x2: -26, y2: 26, t: 3 }, { x: 50, y: 66, w: 'fine' }),
        part('stick', { x1: 20, y1: 0, x2: 26, y2: 26, t: 3 }, { x: 50, y: 66, w: 'fine' }),
        part('stick', { x1: -30, y1: 26, x2: 30, y2: 26, t: 0 }, { x: 50, y: 66, w: 'main' }),
      ] },
      { z: 0, parts: [
        part('cells', { w: 74, h: 44, cols: 8, rows: 5, persp: 0.78, skew: 0.15, bus: 2 }, { x: 50, y: 44, w: 'fine' }),
        part('rivets', { x1: -34, y1: 0, x2: 34, y2: 0, n: 7, r: 0.9 }, { x: 50, y: 69 }),
      ] },
      { z: 6, parts: [
        part('ray_fan', { x0: -30, y0: -30, x1: -10, y1: -4, n: 4, s0: 18, s1: 4 }, { x: 70, y: 22, w: 'hair', o: 0.6 }),
        part('dots', { n: 10, spread: 34, r: 0.9, seed: 4 }, { x: 50, y: 44, o: 0.7 }),
      ] },
    ],
  },
};
