/* The crew's border: one loop round the screen, measured in FEET. A creature stands with its feet on the loop (the point under
   its feet) and its body turned to face into the screen, pivoting about its middle. Each run of the loop keeps the body's middle
   a half-body from the wall, so the whole body stays on screen. At each corner the middle stays put and the feet swing round it
   on a quarter circle: the creature turns a quarter where it stands, and never leaves the screen. The tilt is a pure function of
   place, so a route to a place always ends at the same tilt. Pure maths, no DOM, so it can be tested.
   Coordinates are viewport px. `s` is the distance along the loop; it wraps every lap (P px). */

export type Edge = 'bottom' | 'right' | 'top' | 'left';

/** a straight run (cx undefined) or a quarter turn about (cx, cy) */
interface Seg { len: number; x0: number; y0: number; x1: number; y1: number; r0: number; r1: number; edge: Edge; cx?: number; cy?: number }

export interface Geo {
  W: number;
  H: number;
  /** a margin kept clear of the screen edge, so a limb or a tail that reaches past its box still stays on screen */
  ins: number;
  /** creature size (the box is S x S) and half of it */
  S: number;
  h: number;
  /** length of the floor run and of each side run */
  A: number;
  V: number;
  /** whole loop */
  P: number;
  segs: Seg[];
  /** distance along the loop at which each segment starts */
  starts: number[];
}

export const makeGeo = (W: number, H: number, S: number, ins = 0): Geo => {
  // the loop is drawn inside a screen shrunk by `ins` on every side; feetOn() moves it back out to the real screen
  const w = W - 2 * ins, hh = H - 2 * ins;
  const h = S / 2;
  const A = Math.max(1, w - S), V = Math.max(1, hh - S), Q = (h * Math.PI) / 2;
  const segs: Seg[] = [
    { len: A, x0: h, y0: hh, x1: w - h, y1: hh, r0: 0, r1: 0, edge: 'bottom' },
    { len: Q, x0: w, y0: hh - h, x1: w, y1: hh - h, r0: 0, r1: -90, edge: 'right', cx: w - h, cy: hh - h },
    { len: V, x0: w, y0: hh - h, x1: w, y1: h, r0: -90, r1: -90, edge: 'right' },
    { len: Q, x0: w, y0: h, x1: w - h, y1: 0, r0: -90, r1: -180, edge: 'top', cx: w - h, cy: h },
    { len: A, x0: w - h, y0: 0, x1: h, y1: 0, r0: -180, r1: -180, edge: 'top' },
    { len: Q, x0: h, y0: 0, x1: 0, y1: h, r0: -180, r1: -270, edge: 'left', cx: h, cy: h },
    { len: V, x0: 0, y0: h, x1: 0, y1: hh - h, r0: -270, r1: -270, edge: 'left' },
    { len: Q, x0: 0, y0: hh - h, x1: h, y1: hh, r0: -270, r1: -360, edge: 'bottom', cx: h, cy: hh - h },
  ];
  const starts: number[] = [];
  let acc = 0;
  for (const sg of segs) { starts.push(acc); acc += sg.len; }
  return { W, H, ins, S, h, A, V, P: acc, segs, starts };
};

const mod = (v: number, m: number) => ((v % m) + m) % m;

/** the segment holding `u` (0 <= u < P) and how far along it, 0..1 */
function locate(g: Geo, u: number): { i: number; f: number } {
  for (let i = g.segs.length - 1; i >= 0; i--) {
    if (u >= g.starts[i]) return { i, f: Math.min(1, (u - g.starts[i]) / g.segs[i].len) };
  }
  return { i: 0, f: 0 };
}

/** where the feet are on a segment, `f` of the way along it (0..1) */
function feetOn(g: Geo, sg: Seg, f: number): { x: number; y: number } {
  if (sg.cx === undefined || sg.cy === undefined) return { x: g.ins + sg.x0 + (sg.x1 - sg.x0) * f, y: g.ins + sg.y0 + (sg.y1 - sg.y0) * f };
  const r = ((sg.r0 + (sg.r1 - sg.r0) * f) * Math.PI) / 180;
  return { x: g.ins + sg.cx - g.h * Math.sin(r), y: g.ins + sg.cy + g.h * Math.cos(r) };
}

/** the feet's place on the loop for `s`, and the edge it is on */
export function pointAt(g: Geo, s: number): { x: number; y: number; edge: Edge } {
  const { i, f } = locate(g, mod(s, g.P));
  const sg = g.segs[i];
  return { ...feetOn(g, sg, f), edge: sg.edge };
}

/** the body's tilt (deg, CSS clockwise) at `s`. Unwrapped: it goes on turning a full turn per lap, so a glide never spins back. */
export function rotAt(g: Geo, s: number): number {
  const lap = Math.floor(s / g.P);
  const { i, f } = locate(g, s - lap * g.P);
  const sg = g.segs[i];
  return sg.r0 + (sg.r1 - sg.r0) * f - 360 * lap;
}

/** Fold a position back into one lap and the tilt into (-180, 180], without changing where or how it appears. */
export function normalise(g: Geo, s: number, rot: number): { s: number; rot: number } {
  return { s: mod(s, g.P), rot: rot - 360 * Math.round(rot / 360) };
}

/** the top-left of a creature's box when its feet are at (fx, fy) and it is tilted `rot` degrees about its middle */
export function boxAt(g: Geo, fx: number, fy: number, rot: number): { x: number; y: number } {
  const r = (rot * Math.PI) / 180;
  const cx = fx + g.h * Math.sin(r), cy = fy - g.h * Math.cos(r);
  return { x: cx - g.h, y: cy - g.h };
}

export interface Key { offset: number; x: number; y: number; rot: number; s?: number }

/** Keyframes for gliding along the loop from s0 to s1: a key at each end, at every corner and quarter-steps round each corner,
 *  so the feet run straight along each run and swing smoothly round each corner. */
export function glidePath(g: Geo, s0: number, s1: number): Key[] {
  const span = s1 - s0;
  const at = (s: number): Key => {
    const p = pointAt(g, s);
    return { offset: Math.max(0, Math.min(1, (s - s0) / span)), x: p.x, y: p.y, rot: rotAt(g, s), s };
  };
  if (Math.abs(span) < 0.5) { const k = at(s0); return [{ ...k, offset: 0 }, { ...k, offset: 1 }]; }
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  const marks = new Set<number>([s0, s1]);
  const q0 = Math.floor(lo / g.P) - 1, q1 = Math.ceil(hi / g.P) + 1;
  for (let q = q0; q <= q1; q++) {
    g.segs.forEach((sg, i) => {
      const base = q * g.P + g.starts[i];
      const fracs = sg.cx !== undefined ? [0, 0.25, 0.5, 0.75] : [0];
      for (const f of fracs) { const m = base + sg.len * f; if (m > lo && m < hi) marks.add(m); }
    });
  }
  return [...marks].sort((a, b) => (span > 0 ? a - b : b - a)).map(at);
}

/** Straight-line keys between two places off the loop (an excursion into the room): the feet and the tilt both move evenly. */
export function freePath(a: { x: number; y: number; rot: number }, b: { x: number; y: number; rot: number }, steps = 4): Key[] {
  const out: Key[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    out.push({ offset: f, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, rot: a.rot + (b.rot - a.rot) * f });
  }
  return out;
}

/** The point on the loop nearest to the feet at (x, y), as the `s` closest to `near` (so it never jumps a lap). */
export function nearestS(g: Geo, x: number, y: number, near: number): number {
  let best = { d: Infinity, s: 0 };
  g.segs.forEach((sg, i) => {
    if (sg.cx === undefined) {
      // a straight run: the exact foot of the perpendicular, held to the run's ends
      const vx = sg.x1 - sg.x0, vy = sg.y1 - sg.y0;
      const len2 = vx * vx + vy * vy || 1;
      const f = Math.max(0, Math.min(1, ((x - g.ins - sg.x0) * vx + (y - g.ins - sg.y0) * vy) / len2));
      const p = feetOn(g, sg, f);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < best.d) best = { d, s: g.starts[i] + f * sg.len };
      return;
    }
    for (let k = 0; k <= 64; k++) {
      const f = k / 64, p = feetOn(g, sg, f);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < best.d) best = { d, s: g.starts[i] + f * sg.len };
    }
  });
  return best.s + g.P * Math.round((near - best.s) / g.P);
}

/** The closest `s` to `near` that puts the feet on the floor at horizontal position x (for walking to a thing on the ground). */
export function bottomS(g: Geo, x: number, near: number): number {
  const u = Math.max(0, Math.min(g.A, x - g.ins - g.h));
  return u + g.P * Math.round((near - u) / g.P);
}
