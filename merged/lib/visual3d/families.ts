import type { Archetype, Part, Visual3DSpec } from './types';

/* One builder per silhouette family. Knobs (0..1) change proportion, never the family.
   Each family is a different arrangement of different primitives — that is what makes
   a blade, a stone, a vessel and a wheel read as different objects. */

const L = (p: Visual3DSpec['params'], lo: number, hi: number) => lo + p.length * (hi - lo);
const W = (p: Visual3DSpec['params'], lo: number, hi: number) => lo + p.width * (hi - lo);
const K = (p: Visual3DSpec['params'], lo: number, hi: number) => lo + p.taper * (hi - lo);

type Builder = (p: Visual3DSpec['params']) => Part[];

export const FAMILIES: Record<Archetype, Builder> = {
  blade: p => [
    { shape: 'wedge', size: [W(p, 0.12, 0.3), L(p, 0.5, 0.9), 0.04], offset: [0, 0.05, 0] },
    { shape: 'box', size: [0.07, 0.18, 0.07], offset: [0, -L(p, 0.5, 0.9) - 0.1, 0], tint: 1 },
  ],
  hafted_tool: p => [
    { shape: 'cylinder', size: [0.06, L(p, 0.6, 0.95), 0.06], offset: [0, 0, 0], tint: 1 },
    { shape: 'wedge', size: [W(p, 0.14, 0.28), 0.22, 0.05], offset: [0, L(p, 0.6, 0.95) + 0.1, 0], tint: 0 },
    { shape: 'torus', size: [0.075, 0.018, 0.018], offset: [0, L(p, 0.6, 0.95) - 0.05, 0], rot: [Math.PI / 2, 0, 0], tint: 2 },
  ],
  axe: p => [
    { shape: 'cylinder', size: [0.06, L(p, 0.65, 0.95), 0.06], offset: [0, -0.05, 0], tint: 1 },
    { shape: 'wedge', size: [W(p, 0.2, 0.34), 0.2, 0.08], offset: [W(p, 0.2, 0.34) * 0.8, L(p, 0.65, 0.95) - 0.05, 0], rot: [0, 0, -Math.PI / 2], tint: 0 },
    { shape: 'box', size: [0.1, 0.1, 0.1], offset: [0, L(p, 0.65, 0.95) - 0.05, 0], tint: 2 },
  ],
  stone_fragment: p => [
    { shape: 'sphere', size: [W(p, 0.4, 0.7), K(p, 0.25, 0.5), 0.3], offset: [0, 0, 0], tint: 0 },
    { shape: 'wedge', size: [0.3, 0.22, 0.2], offset: [0.2, 0.1, 0.05], rot: [0, 0.7, 0.4], tint: 1 },
  ],
  polished_stone: p => [{ shape: 'sphere', size: [W(p, 0.4, 0.6), K(p, 0.3, 0.45), K(p, 0.28, 0.4)], offset: [0, 0, 0] }],
  wood_rod: p => [
    { shape: 'cylinder', size: [0.07, L(p, 0.7, 1.0), 0.07], offset: [0, 0, 0], rot: [0, 0, Math.PI / 2.4] },
    { shape: 'cone', size: [0.07, 0.12, 0.07], offset: [0.28 * L(p, 0.7, 1), 0.3 * L(p, 0.7, 1), 0], rot: [0, 0, -Math.PI / 2.4 - Math.PI], tint: 1 },
  ],
  woven_fibre: p => [
    { shape: 'torus', size: [W(p, 0.35, 0.55), 0.05, 0.05], offset: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    { shape: 'torus', size: [W(p, 0.35, 0.55) * 0.9, 0.04, 0.04], offset: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0.3], tint: 1 },
    { shape: 'torus', size: [W(p, 0.35, 0.55) * 0.8, 0.035, 0.035], offset: [0, 0.06, 0], rot: [Math.PI / 2, 0, 0.6], tint: 2 },
  ],
  vessel: p => [{
    // flared open bowl on a flat foot: a trapezoid silhouette, never a round blob
    shape: 'lathe', size: [W(p, 0.55, 0.85), 1, W(p, 0.55, 0.85)], offset: [0, 0, 0],
    profile: [[0.0, -L(p, 0.3, 0.45)], [0.42, -L(p, 0.3, 0.45)], [0.95, L(p, 0.3, 0.45)], [0.85, L(p, 0.3, 0.45)], [0.4, -L(p, 0.3, 0.45) + 0.06]],
  }],
  brick: p => [
    { shape: 'box', size: [W(p, 0.45, 0.7), 0.2, 0.28], offset: [0, 0, 0] },
    { shape: 'box', size: [W(p, 0.45, 0.7) * 0.9, 0.02, 0.26], offset: [0, 0.21, 0], tint: 1 },
  ],
  metal_ingot: p => [
    { shape: 'wedge', size: [W(p, 0.4, 0.65), 0.2, 0.28], offset: [0, 0, 0], tint: 0 },
    { shape: 'box', size: [W(p, 0.4, 0.65) * 0.5, 0.01, 0.16], offset: [0, 0.2, 0], tint: 2 },
  ],
  wheel: p => [
    { shape: 'torus', size: [W(p, 0.6, 0.85), 0.07, 0.07], offset: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    { shape: 'cylinder', size: [0.1, 0.09, 0.1], offset: [0, 0, 0], rot: [Math.PI / 2, 0, 0], tint: 1 },
    ...[0, 1, 2, 3].map<Part>(k => ({ shape: 'box', size: [W(p, 0.6, 0.85) * 0.5, 0.025, 0.025], offset: [0, 0, 0], rot: [0, 0, (k * Math.PI) / 4], tint: 2 })),
  ],
  bone_tool: p => [
    { shape: 'cylinder', size: [0.07, L(p, 0.6, 0.9), 0.06], offset: [0, 0, 0] },
    { shape: 'cone', size: [0.07, K(p, 0.2, 0.4), 0.06], offset: [0, L(p, 0.6, 0.9) + K(p, 0.2, 0.4), 0], tint: 1 },
    { shape: 'sphere', size: [0.1, 0.08, 0.09], offset: [0, -L(p, 0.6, 0.9), 0], tint: 2 },
  ],
  bead: p => [{
    shape: 'torus', size: [W(p, 0.18, 0.3), W(p, 0.16, 0.26), 0.2], offset: [0, 0, 0], rot: [Math.PI / 2, 0, 0],
  }],
  circuit: p => [
    { shape: 'box', size: [W(p, 0.5, 0.8), 0.035, 0.4], offset: [0, 0, 0], tint: 0 },
    ...[0, 1, 2].map<Part>(k => ({ shape: 'box', size: [0.1, 0.05, 0.1], offset: [-0.25 + k * 0.25, 0.07, 0.05 - k * 0.04], tint: 1 })),
    { shape: 'box', size: [0.2, 0.02, 0.01], offset: [0, 0.04, -0.22], tint: 2 },
  ],
  plant: p => [
    { shape: 'cylinder', size: [0.04, L(p, 0.5, 0.8), 0.04], offset: [0, 0, 0], tint: 1 },
    { shape: 'sphere', size: [0.18, 0.1, 0.1], offset: [0.16, L(p, 0.5, 0.8) * 0.5, 0], rot: [0, 0, 0.5], tint: 0 },
    { shape: 'sphere', size: [0.18, 0.1, 0.1], offset: [-0.16, L(p, 0.5, 0.8) * 0.2, 0], rot: [0, 0, -0.5], tint: 0 },
    { shape: 'sphere', size: [0.1, 0.1, 0.1], offset: [0, L(p, 0.5, 0.8) + 0.08, 0], tint: 2 },
  ],
  abstract_diagram: p => [
    { shape: 'sphere', size: [0.14, 0.14, 0.14], offset: [-W(p, 0.3, 0.5), 0.2, 0], tint: 0 },
    { shape: 'sphere', size: [0.14, 0.14, 0.14], offset: [W(p, 0.3, 0.5), 0.2, 0], tint: 1 },
    { shape: 'sphere', size: [0.14, 0.14, 0.14], offset: [0, -0.3, 0], tint: 2 },
    { shape: 'box', size: [W(p, 0.3, 0.5), 0.015, 0.015], offset: [0, 0.2, 0] },
  ],
};
