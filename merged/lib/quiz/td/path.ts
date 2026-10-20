/** Path geometry in fixed-point "milli-tiles" (1000 = one tile). Pure integer output so the server and every browser walk the same path.
 *  A designer authors a few control points; `densify` turns them into a smooth Catmull-Rom polyline ONCE (rounded to integers), and that
 *  polyline is the only thing movement, range checks and drawing use. */
export const FIX = 1000;
export type Pt = readonly [number, number];
export type PathData = { pts: Pt[]; cum: number[]; length: number };

/** Catmull-Rom through the control points, sampled every ~step milli-tiles, rounded to integers. Deterministic. */
export function densify(ctrl: readonly Pt[], step = 200): Pt[] {
  const P = ctrl.map(([x, y]) => [x, y] as [number, number]);
  const out: Pt[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[Math.min(P.length - 1, i + 2)]!;
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(segLen / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([Math.round(x), Math.round(y)]);
    }
  }
  const last = P[P.length - 1]!; out.push([Math.round(last[0]), Math.round(last[1])]);
  return out;
}

export function buildPath(pts: Pt[]): PathData {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.round(Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1])));
  return { pts, cum, length: cum[cum.length - 1]! };
}

/** Position at a distance along the path (milli-tiles), integer, clamped to the ends. Binary search keeps it O(log n). */
export function pointAt(path: PathData, d: number): Pt {
  if (d <= 0) return path.pts[0]!;
  if (d >= path.length) return path.pts[path.pts.length - 1]!;
  let lo = 0, hi = path.cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path.cum[mid]! <= d) lo = mid; else hi = mid; }
  const a = path.pts[lo]!, b = path.pts[hi]!; const span = path.cum[hi]! - path.cum[lo]!;
  const t = span === 0 ? 0 : (d - path.cum[lo]!) / span;
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)];
}

/** Integer squared distance: range checks never use floating point square roots. */
export const dist2 = (a: Pt, b: Pt) => { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; };

/** Smallest distance from a point to the polyline (used by map validation only). */
export function distToPath(path: PathData, p: Pt): number {
  let best = Infinity;
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1]!, b = path.pts[i]!; const vx = b[0] - a[0], vy = b[1] - a[1]; const L = vx * vx + vy * vy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L));
    best = Math.min(best, Math.hypot(a[0] + t * vx - p[0], a[1] + t * vy - p[1]));
  }
  return best;
}
