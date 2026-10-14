/* ============================================================================
   VISUAL LAB — spec → plate SVG compiler (development only).

   Pure function: a validated PlateSpec in, SVG *inner markup* out, written in
   exactly the vocabulary the existing art uses (<g data-z>, <path>, <circle>
   with currentColor, stroke-width / opacity attributes). The result can be fed to
   lib/plate3d.ts unchanged. No eval, no DOM, no network.
   ========================================================================== */

import { COMPONENT_MAP } from './components';
import {
  Frame, WEIGHT_PX, fmt, hashStr, mapElems, pathToD, rng, sample, type Elem, type Weight,
} from './geom';
import type { PlateSpec } from './schema';

export interface CompiledPlate {
  markup: string;
  /** after auto-centre / auto-fit, in the 100×100 plate box */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  pathCount: number;
  dotCount: number;
  segmentCount: number;
  layerCount: number;
  partCount: number;
  fitScale: number;
  /** 16x16 occupancy of sampled geometry over the plate box (row-major, 1 = ink) — used by metrics */
  grid: number[];
  warnings: string[];
}

const FIT_MIN = 52, FIT_MAX = 86, FIT_TARGET = 78, FIT_SCALE_CAP = 4;

function bboxOf(es: Elem[]): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const e of es) {
    if (e.path) for (const pl of sample(e.path, 6)) for (const [x, y] of pl) take(x, y);
    if (e.dot) take(e.dot[0], e.dot[1]);
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

function finite(es: Elem[]): boolean {
  for (const e of es) {
    if (e.path) for (const s of e.path) for (let i = 1; i < s.length; i++) if (!Number.isFinite(s[i] as number)) return false;
    if (e.dot && !e.dot.every(Number.isFinite)) return false;
  }
  return true;
}

export function compileSpec(spec: PlateSpec, seedKey = spec.title): CompiledPlate {
  const warnings: string[] = [];
  const baseSeed = hashStr(seedKey || 'plate');
  const layered: { z: number; els: Elem[] }[] = [];
  let partCount = 0;

  spec.layers.forEach((layer, li) => {
    const els: Elem[] = [];
    layer.parts.forEach((part, pi) => {
      const def = COMPONENT_MAP.get(part.c);
      if (!def) { warnings.push(`layers[${li}].parts[${pi}]: unknown component ${part.c}`); return; }
      let local: Elem[];
      try {
        local = def.draw(part.p, rng((baseSeed + li * 7919 + pi * 104729) >>> 0));
      } catch (e) {
        warnings.push(`${part.c}: draw failed (${(e as Error).message})`);
        return;
      }
      if (def.center) {
        const b = bboxOf(local);
        if (b) { const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; local = mapElems(local, (x, y) => [x - cx, y - cy]); }
      }
      const fr = new Frame(part.x, part.y, part.rot, part.s, part.flip);
      const placed = mapElems(local, (x, y) => fr.pt(x, y), part.s).map((e): Elem => ({
        ...e, w: part.w ?? e.w, o: part.o !== undefined ? (e.o ?? 1) * part.o : e.o,
      }));
      if (placed.length === 0) { warnings.push(`layers[${li}].parts[${pi}]: ${part.c} produced no geometry`); return; }
      if (!finite(placed)) { warnings.push(`${part.c}: produced non-finite numbers, part skipped`); return; }
      els.push(...placed);
      partCount++;
    });
    if (els.length) layered.push({ z: layer.z, els });
  });

  // auto-centre, and auto-fit when the drawing is far too small or too large for the plate box
  let fitScale = 1;
  const all = layered.flatMap(l => l.els);
  const b0 = bboxOf(all);
  if (b0) {
    const span = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0, 1);
    if (span >= 2 && (span > FIT_MAX || span < FIT_MIN)) fitScale = Math.min(FIT_SCALE_CAP, Math.max(0.1, FIT_TARGET / span));
    const cx = (b0.x0 + b0.x1) / 2, cy = (b0.y0 + b0.y1) / 2;
    for (const l of layered) l.els = mapElems(l.els, (x, y) => [50 + (x - cx) * fitScale, 50 + (y - cy) * fitScale], fitScale);
    if (fitScale !== 1) warnings.push(`auto-fit scale ${fmt(fitScale)} applied (span ${fmt(span)})`);
  }

  const parts: string[] = [];
  let pathCount = 0, dotCount = 0, segmentCount = 0;
  const sorted = [...layered].sort((a, b) => a.z - b.z);
  for (const l of sorted) {
    parts.push(`<g data-z="${fmt(l.z)}">`);
    for (const e of l.els) {
      const attrs: string[] = [];
      if (e.o !== undefined && e.o < 0.995) attrs.push(`opacity="${fmt(Math.round(e.o * 100) / 10 / 10)}"`);
      if (e.dz) attrs.unshift(`data-z="${fmt(e.dz)}"`);
      if (e.path && e.path.length > 1) {
        const w = WEIGHT_PX[(e.w ?? 'bold') as Weight];
        if (w !== 2) attrs.push(`stroke-width="${w}"`);
        parts.push(`<path d="${pathToD(e.path)}"${attrs.length ? ' ' + attrs.join(' ') : ''}/>`);
        pathCount++;
        segmentCount += e.path.filter(s => s[0] !== 'M').length;
      } else if (e.dot) {
        parts.push(`<circle cx="${fmt(e.dot[0])}" cy="${fmt(e.dot[1])}" r="${fmt(Math.max(0.3, e.dot[2]))}" ${attrs.join(' ')} fill="currentColor" stroke="none"/>`);
        dotCount++;
      }
    }
    parts.push('</g>');
  }

  const finalEls = sorted.flatMap(l => l.els);
  const bbox = bboxOf(finalEls) ?? { x0: 50, y0: 50, x1: 50, y1: 50 };
  const grid = new Array<number>(256).fill(0);
  const mark = (x: number, y: number) => {
    const gx = Math.floor(x / 6.25), gy = Math.floor(y / 6.25);
    if (gx >= 0 && gx < 16 && gy >= 0 && gy < 16) grid[gy * 16 + gx] = 1;
  };
  for (const e of finalEls) {
    if (e.path) for (const pl of sample(e.path, 8)) for (let i = 0; i < pl.length - 1; i++) {
      const steps = Math.max(1, Math.ceil(Math.hypot(pl[i + 1][0] - pl[i][0], pl[i + 1][1] - pl[i][1]) / 3));
      for (let k = 0; k <= steps; k++) mark(pl[i][0] + ((pl[i + 1][0] - pl[i][0]) * k) / steps, pl[i][1] + ((pl[i + 1][1] - pl[i][1]) * k) / steps);
    }
    if (e.dot) mark(e.dot[0], e.dot[1]);
  }
  return { markup: parts.join(''), bbox, pathCount, dotCount, segmentCount, layerCount: sorted.length, partCount, fitScale, grid, warnings };
}
