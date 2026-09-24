import raw from '@/data/scene-regions.json';
import { PARALLAX_X, PARALLAX_Y } from './state';

/* ============================================================================
   REGIONS — where, in each illustrated scene, there is water, grass or dry
   ground. Polygons in the scene's own 1600×900 space (data/scene-regions.json,
   traced against the artwork), listed in priority order: the first region that
   contains the point wins, so foreground grass beats the ground behind it.
   ========================================================================== */

export type RegionKind = 'water' | 'grass' | 'dust';
export interface Region { kind: RegionKind; depth: number; poly: [number, number][] }

export const VIEW_W = 1600;
export const VIEW_H = 900;

const TABLE = raw as unknown as Record<string, Region[]>;

export const regionsFor = (sceneId: string): Region[] => TABLE[sceneId] ?? [];

/** Ray-casting point-in-polygon. */
export function pointInPoly(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** How the 1600×900 scene is fitted to a w×h viewport: `xMidYMax slice`. */
export function fit(w: number, h: number) {
  const s = Math.max(w / VIEW_W, h / VIEW_H);
  return { s, ox: (w - VIEW_W * s) / 2, oy: h - VIEW_H * s };
}

export interface Par { x: number; y: number }

/** Viewport point → scene point on a layer of the given depth, undoing its parallax drift. */
export function toScene(cx: number, cy: number, w: number, h: number, par: Par, depth: number) {
  const { s, ox, oy } = fit(w, h);
  return { u: (cx - ox) / s + par.x * depth * PARALLAX_X, v: (cy - oy) / s + par.y * depth * PARALLAX_Y };
}

/** Scene point on a layer of the given depth → viewport point (the inverse of toScene). */
export function toScreen(u: number, v: number, w: number, h: number, par: Par, depth: number) {
  const { s, ox, oy } = fit(w, h);
  return { x: ox + (u - par.x * depth * PARALLAX_X) * s, y: oy + (v - par.y * depth * PARALLAX_Y) * s };
}

export interface Hit { region: Region; kind: RegionKind; u: number; v: number }

/** What is under this viewport point in the given scene? Null when it is neither water, grass nor dry ground. */
export function hitRegion(sceneId: string, cx: number, cy: number, w: number, h: number, par: Par): Hit | null {
  for (const region of regionsFor(sceneId)) {
    const { u, v } = toScene(cx, cy, w, h, par, region.depth);
    if (pointInPoly(u, v, region.poly)) return { region, kind: region.kind, u, v };
  }
  return null;
}
