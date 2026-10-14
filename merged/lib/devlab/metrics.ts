/* ============================================================================
   VISUAL LAB — automated measurements (development only).

   EVERYTHING in this file is measured by code. None of it is a judgement of
   recognisability or beauty — those are manual review scores (types.Review).
   "style.distance" is a statistical proxy against the hand-authored art, not a
   verdict that the picture looks right.
   ========================================================================== */

import type { CompiledPlate } from './compile';
import type { PlateSpec } from './schema';
import type { AutoMetrics } from './types';

export interface StyleRef {
  entries: number;
  thinPathFraction: number;
  opacityPathFraction: number;
  dotEntryFraction: number;
  layeredEntryFraction: number;
  medianPaths: number;
  p90Paths: number;
}

const countRe = (s: string, re: RegExp) => (s.match(re) ?? []).length;

/** Descriptor of the existing hand-drawn art (data/art.json), computed from the file itself. */
export function referenceStyle(art: Record<string, string>): StyleRef {
  let paths = 0, thin = 0, op = 0, dotE = 0, layered = 0;
  const pcs: number[] = [];
  const vals = Object.values(art);
  for (const m of vals) {
    const tags = m.match(/<(path|circle|ellipse|line|polyline|polygon|rect)\b[^>]*>/g) ?? [];
    let pc = 0;
    for (const t of tags) {
      if (/fill="currentColor"/.test(t) && /<circle/.test(t)) continue;
      pc++; paths++;
      const sw = /stroke-width="([\d.]+)"/.exec(t);
      if (sw && Number(sw[1]) < 2) thin++;
      if (/\sopacity="/.test(t)) op++;
    }
    pcs.push(pc);
    if (/<circle[^>]*fill="currentColor"/.test(m)) dotE++;
    if (countRe(m, /data-z=/g) >= 2) layered++;
  }
  pcs.sort((a, b) => a - b);
  return {
    entries: vals.length,
    thinPathFraction: thin / Math.max(1, paths),
    opacityPathFraction: op / Math.max(1, paths),
    dotEntryFraction: dotE / Math.max(1, vals.length),
    layeredEntryFraction: layered / Math.max(1, vals.length),
    medianPaths: pcs[Math.floor(pcs.length / 2)] ?? 0,
    p90Paths: pcs[Math.floor(pcs.length * 0.9)] ?? 0,
  };
}

export function styleDistance(c: CompiledPlate, ref: StyleRef): { distance: number; notes: string[] } {
  const paths = (c.markup.match(/<path\b/g) ?? []).length || 1;
  const thin = (c.markup.match(/<path\b[^>]*stroke-width="/g) ?? []).length / paths;
  const op = (c.markup.match(/<path\b[^>]*opacity="/g) ?? []).length / paths;
  const hasDots = c.dotCount > 0 ? 1 : 0;
  const layered = c.layerCount >= 2 ? 1 : 0;
  // Intricacy is wanted: only a drawing sparser than the typical hand plate, or far denser than the densest ones, is penalised.
  const hi = Math.max(1, ref.p90Paths) * 3;
  const pathRatio = paths < ref.medianPaths ? Math.log((ref.medianPaths + 1) / (paths + 1)) / Math.log(8) : paths > hi ? Math.log(paths / hi) / Math.log(8) : 0;
  const notes: string[] = [];
  const d = [
    Math.abs(thin - ref.thinPathFraction),
    Math.abs(op - ref.opacityPathFraction),
    Math.abs(hasDots - ref.dotEntryFraction),
    Math.abs(layered - ref.layeredEntryFraction),
    Math.min(1, pathRatio),
  ];
  if (!layered) notes.push('single depth layer (hand art uses several)');
  if (!hasDots) notes.push('no particle dots');
  if (pathRatio > 0.3) notes.push(`path count ${paths} outside the range of the hand art (median ${ref.medianPaths}, 90th percentile ${ref.p90Paths})`);
  return { distance: Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 1000) / 1000, notes };
}

/** Jaccard similarity of two occupancy grids. */
export function gridSimilarity(a: readonly number[], b: readonly number[]): number {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] || b[i]) uni++; if (a[i] && b[i]) inter++; }
  return uni ? inter / uni : 0;
}

export function measure(
  spec: PlateSpec, c: CompiledPlate, compileMs: number, ref: StyleRef,
  others: ReadonlyArray<{ id: string; grid: readonly number[] }> = [], selfId = '',
): AutoMetrics {
  const kinds = new Set(spec.layers.flatMap(l => l.parts.map(p => p.c)));
  const weights = new Set([...c.markup.matchAll(/stroke-width="([\d.]+)"/g)].map(m => m[1]));
  if (/<path\b(?![^>]*stroke-width=)/.test(c.markup)) weights.add('2');
  const w = c.bbox.x1 - c.bbox.x0, h = c.bbox.y1 - c.bbox.y0;
  const fill = c.grid.reduce((a, b) => a + b, 0) / c.grid.length;
  const nums = [...c.markup.matchAll(/(?:d|cx|cy|r)="([^"]*)"/g)].flatMap(m => m[1].match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out = nums.filter(n => n < -5 || n > 105).length;
  let nearestId: string | null = null, nearest: number | null = null;
  for (const o of others) {
    if (o.id === selfId) continue;
    const s = gridSimilarity(c.grid, o.grid);
    if (nearest === null || s > nearest) { nearest = s; nearestId = o.id; }
  }
  const st = styleDistance(c, ref);
  return {
    detail: {
      parts: c.partCount, layers: c.layerCount, paths: c.pathCount, segments: c.segmentCount, dots: c.dotCount,
      componentKinds: kinds.size, weightsUsed: weights.size,
    },
    composition: {
      width: Math.round(w * 10) / 10, height: Math.round(h * 10) / 10,
      centreOffset: Math.round(Math.hypot((c.bbox.x0 + c.bbox.x1) / 2 - 50, (c.bbox.y0 + c.bbox.y1) / 2 - 50) * 10) / 10,
      fill: Math.round(fill * 1000) / 1000,
      margin: Math.round(Math.min(c.bbox.x0, c.bbox.y0, 100 - c.bbox.x1, 100 - c.bbox.y1) * 10) / 10,
      fitScale: Math.round(c.fitScale * 100) / 100,
    },
    rendering: {
      finite: nums.every(Number.isFinite), outOfBoxFraction: nums.length ? Math.round((out / nums.length) * 1000) / 1000 : 0,
      markupBytes: c.markup.length, warnings: c.warnings.length,
      markupSafe: !/<script|on\w+=|javascript:|<foreignObject|<image|href=/i.test(c.markup),
    },
    uniqueness: { nearestId, nearestSimilarity: nearest === null ? null : Math.round(nearest * 1000) / 1000 },
    style: st,
    performance: { compileMs: Math.round(compileMs * 100) / 100 },
  };
}

/** Automated pass/fail gates. A failure here means the output is recorded as failed, not shown as success. */
export function qualityGate(m: AutoMetrics, complexity: number): string[] {
  const issues: string[] = [];
  const minPaths = 6 + complexity * 3;
  if (m.detail.paths < minPaths) issues.push(`too few paths for complexity ${complexity}: ${m.detail.paths} < ${minPaths}`);
  if (m.detail.parts < 2) issues.push('fewer than 2 parts');
  if (!m.rendering.finite) issues.push('non-finite numbers in output');
  if (!m.rendering.markupSafe) issues.push('markup contains disallowed content');
  if (m.rendering.outOfBoxFraction > 0.1) issues.push(`geometry leaves the plate box (${Math.round(m.rendering.outOfBoxFraction * 100)}% of coordinates)`);
  if (m.composition.fill < 0.06) issues.push(`drawing is nearly empty (fill ${m.composition.fill})`);
  if (m.composition.width < 20 && m.composition.height < 20) issues.push('drawing is tiny');
  if (m.detail.paths > 600) issues.push(`too many paths (${m.detail.paths}) for real-time wireframe`);
  return issues;
}
