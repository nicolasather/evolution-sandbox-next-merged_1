/* ============================================================================
   VISUAL LAB — pure geometry helpers (development only).

   Everything here is deterministic numeric code: no DOM, no network, no eval.
   Components build paths in LOCAL coordinates (origin at the part's centre);
   a Frame then places them in the 100x100 plate box. The output vocabulary is
   exactly what lib/plate3d.ts already understands: <path>, dots, data-z layers.
   ========================================================================== */

export type Pt = readonly [number, number];

export type Seg =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z'];
export type Path = Seg[];

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export type Weight = 'bold' | 'main' | 'fine' | 'hair';
/** Stroke widths copied from the existing hand art (1.2 detail / 1.6 body / 2 default). */
export const WEIGHT_PX: Record<Weight, number> = { bold: 2, main: 1.6, fine: 1.2, hair: 0.8 };

/** One drawable unit. `dz` pushes it forward/back inside its layer (the plate pipeline sums data-z). */
export interface Elem {
  path?: Path;
  dot?: readonly [number, number, number];
  w?: Weight;
  o?: number;
  dz?: number;
}

export const E = (path: Path, w?: Weight, o?: number, dz?: number): Elem => ({ path, w, o, dz });
export const D = (x: number, y: number, r: number, o?: number): Elem => ({ dot: [x, y, r], o });

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Same xorshift as lib/glyphs.ts so seeded shapes behave like the existing grammar. */
export function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* ── frames ───────────────────────────────────────────────────────────── */

export class Frame {
  private c: number;
  private s: number;
  constructor(public x = 50, public y = 50, public rotDeg = 0, public scale = 1, public flip = false) {
    this.c = Math.cos(rotDeg * DEG);
    this.s = Math.sin(rotDeg * DEG);
  }
  pt(px: number, py: number): [number, number] {
    const lx = (this.flip ? -px : px) * this.scale;
    const ly = py * this.scale;
    return [this.x + lx * this.c - ly * this.s, this.y + lx * this.s + ly * this.c];
  }
}

export function mapPath(p: Path, f: (x: number, y: number) => [number, number]): Path {
  return p.map((s): Seg => {
    if (s[0] === 'Z') return s;
    if (s[0] === 'C') {
      const a = f(s[1], s[2]), b = f(s[3], s[4]), c = f(s[5], s[6]);
      return ['C', a[0], a[1], b[0], b[1], c[0], c[1]];
    }
    const q = f(s[1], s[2]);
    return [s[0], q[0], q[1]];
  });
}

export function mapElems(es: Elem[], f: (x: number, y: number) => [number, number], rScale = 1): Elem[] {
  return es.map(e => ({
    ...e,
    path: e.path ? mapPath(e.path, f) : undefined,
    dot: e.dot ? ((): [number, number, number] => { const q = f(e.dot![0], e.dot![1]); return [q[0], q[1], e.dot![2] * rScale]; })() : undefined,
  }));
}

/* ── path builders (all return LOCAL-coordinate paths) ────────────────── */

export const poly = (pts: readonly Pt[], closed = false): Path => {
  if (pts.length < 2) return [];
  const out: Path = [['M', pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) out.push(['L', pts[i][0], pts[i][1]]);
  if (closed) out.push(['Z']);
  return out;
};

export const line = (x1: number, y1: number, x2: number, y2: number): Path => [['M', x1, y1], ['L', x2, y2]];

/** Catmull-Rom through the points, emitted as cubic Béziers (the same curve language as the hand art). */
export function smooth(pts: readonly Pt[], closed = false, k = 1): Path {
  const n = pts.length;
  if (n < 2) return [];
  if (n === 2) return poly(pts, false);
  const at = (i: number): Pt => closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)];
  const out: Path = [['M', pts[0][0], pts[0][1]]];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    out.push(['C',
      p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k,
      p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k,
      p2[0], p2[1]]);
  }
  if (closed) out.push(['Z']);
  return out;
}

/** Elliptical arc (degrees, y-down: 0° = +x, 90° = +y). A full turn closes. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rotDeg = 0): Path {
  const sweep = clamp(a1 - a0, -360, 360);
  if (Math.abs(sweep) < 0.01 || rx <= 0 || ry <= 0) return [];
  const full = Math.abs(sweep) >= 359.99;
  const nSeg = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
  const step = (sweep * DEG) / nSeg;
  const cr = Math.cos(rotDeg * DEG), sr = Math.sin(rotDeg * DEG);
  const P = (x: number, y: number): [number, number] => [cx + x * cr - y * sr, cy + x * sr + y * cr];
  const h = (4 / 3) * Math.tan(step / 4);
  const out: Path = [];
  for (let i = 0; i < nSeg; i++) {
    const t1 = a0 * DEG + i * step, t2 = t1 + step;
    const x1 = Math.cos(t1) * rx, y1 = Math.sin(t1) * ry, x2 = Math.cos(t2) * rx, y2 = Math.sin(t2) * ry;
    const c1 = P(x1 - Math.sin(t1) * rx * h, y1 + Math.cos(t1) * ry * h);
    const c2 = P(x2 + Math.sin(t2) * rx * h, y2 - Math.cos(t2) * ry * h);
    if (i === 0) { const s = P(x1, y1); out.push(['M', s[0], s[1]]); }
    const e = P(x2, y2);
    out.push(['C', c1[0], c1[1], c2[0], c2[1], e[0], e[1]]);
  }
  if (full) out.push(['Z']);
  return out;
}

export function rectPath(x0: number, y0: number, x1: number, y1: number, r = 0): Path {
  const l = Math.min(x0, x1), rr = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
  const k = clamp(r, 0, Math.min(rr - l, b - t) / 2);
  if (k < 0.2) return [['M', l, t], ['L', rr, t], ['L', rr, b], ['L', l, b], ['Z']];
  const c = k * 0.5523;
  return [
    ['M', l + k, t], ['L', rr - k, t], ['C', rr - k + c, t, rr, t + k - c, rr, t + k],
    ['L', rr, b - k], ['C', rr, b - k + c, rr - k + c, b, rr - k, b],
    ['L', l + k, b], ['C', l + k - c, b, l, b - k + c, l, b - k],
    ['L', l, t + k], ['C', l, t + k - c, l + k - c, t, l + k, t], ['Z'],
  ];
}

export const concat = (...ps: Path[]): Path => ps.flat() as Path;

/* ── sampling & clipping ──────────────────────────────────────────────── */

/** Polyline approximation of a path (for metrics and clipping). Curves are sampled `n` times. */
export function sample(p: Path, n = 10): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const s of p) {
    if (s[0] === 'M') { if (cur.length > 1) out.push(cur); cur = [[s[1], s[2]]]; x = sx = s[1]; y = sy = s[2]; }
    else if (s[0] === 'L') { cur.push([s[1], s[2]]); x = s[1]; y = s[2]; }
    else if (s[0] === 'C') {
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        cur.push([
          u * u * u * x + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5],
          u * u * u * y + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6],
        ]);
      }
      x = s[5]; y = s[6];
    } else { cur.push([sx, sy]); x = sx; y = sy; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Clip the infinite line  p0 + s·d  against an axis-aligned box centred on the origin → [s0, s1] or null. */
export function clipLineRect(p0x: number, p0y: number, dx: number, dy: number, hw: number, hh: number): [number, number] | null {
  let t0 = -1e9, t1 = 1e9;
  const test = (p: number, d: number, lo: number, hi: number): boolean => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!test(p0x, dx, -hw, hw) || !test(p0y, dy, -hh, hh)) return null;
  return t0 < t1 ? [t0, t1] : null;
}

/** Clip a line against an origin-centred ellipse with semi-axes (a, b). */
export function clipLineEllipse(p0x: number, p0y: number, dx: number, dy: number, a: number, b: number): [number, number] | null {
  const A = (dx * dx) / (a * a) + (dy * dy) / (b * b);
  const B = 2 * ((p0x * dx) / (a * a) + (p0y * dy) / (b * b));
  const C = (p0x * p0x) / (a * a) + (p0y * p0y) / (b * b) - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0 || A < 1e-12) return null;
  const q = Math.sqrt(disc);
  return [(-B - q) / (2 * A), (-B + q) / (2 * A)];
}

export type ClipShape = 'rect' | 'ellipse';

/** `n` parallel segments (angle in degrees from +x) filling a w×h box or ellipse. */
export function hatchSegments(w: number, h: number, angleDeg: number, n: number, shape: ClipShape): Path {
  const a = angleDeg * DEG;
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const hw = w / 2, hh = h / 2;
  const ext = shape === 'ellipse' ? Math.hypot(hw * nx, hh * ny) : Math.abs(hw * nx) + Math.abs(hh * ny);
  const out: Path = [];
  for (let i = 0; i < n; i++) {
    const o = -ext + ((i + 0.5) * 2 * ext) / n;
    const px = nx * o, py = ny * o;
    const r = shape === 'ellipse' ? clipLineEllipse(px, py, dx, dy, hw, hh) : clipLineRect(px, py, dx, dy, hw, hh);
    if (!r) continue;
    out.push(['M', px + dx * r[0], py + dy * r[0]], ['L', px + dx * r[1], py + dy * r[1]]);
  }
  return out;
}

/* ── serialisation ────────────────────────────────────────────────────── */

export const fmt = (v: number): string => {
  const r = Math.round(v * 10) / 10;
  return String(Object.is(r, -0) ? 0 : r);
};

export function pathToD(p: Path): string {
  let d = '';
  for (const s of p) {
    if (s[0] === 'Z') d += 'Z';
    else if (s[0] === 'C') d += `C${fmt(s[1])} ${fmt(s[2])} ${fmt(s[3])} ${fmt(s[4])} ${fmt(s[5])} ${fmt(s[6])}`;
    else d += `${s[0]}${fmt(s[1])} ${fmt(s[2])}`;
  }
  return d;
}

/** Evenly spaced values lo..hi inclusive. */
export const linspace = (lo: number, hi: number, n: number): number[] =>
  n <= 1 ? [lo] : Array.from({ length: n }, (_, i) => lerp(lo, hi, i / (n - 1)));
