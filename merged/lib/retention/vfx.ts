/* ============================================================================
   RETENTION VFX — a small vocabulary of engraved-line vector pieces that the
   tactile, failure, success and easter-egg layers all draw with. Everything
   lands on the Workbench's own Fx canvas (Fx.addSprite): no second canvas, no
   physics, no DOM. Every piece is stroke-only, in palette colours, and ends
   on its own; a body being grabbed cuts its owner's pieces short at once.
   ========================================================================== */
import type { Fx } from '../craft/fx';
import type { Palette } from '../craft/types';

export type ShapeId =
  | 'shard' | 'splinter' | 'flake' | 'tick' | 'thread' | 'crumb' | 'prism' | 'drop' | 'ember'
  | 'tooth' | 'bolt' | 'pixel' | 'mote' | 'leaf' | 'grain' | 'star' | 'cross' | 'arc' | 'chip' | 'bead';

export type ColorKey = keyof Palette;
export const TAU = Math.PI * 2;

export const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const easeOutBack = (k: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const fade = (k: number, inEnd = 0.12, outStart = 0.55) => (k < inEnd ? k / inEnd : k > outStart ? Math.max(0, 1 - (k - outStart) / (1 - outStart)) : 1);

/** Tiny deterministic PRNG so an effect reads the same each time it is played from one seed. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const col = (pal: Palette, c: ColorKey | string): string => (pal as unknown as Record<string, string>)[c as string] ?? (c as string);

/* ── shapes: drawn around (0,0), length/size `s`, stroke already styled ── */

type Draw = (g: CanvasRenderingContext2D, s: number) => void;
const poly = (g: CanvasRenderingContext2D, pts: number[]) => {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
};

export const SHAPES: Record<ShapeId, Draw> = {
  /* angular fracture chip of a hard thing */
  shard: (g, s) => { poly(g, [-s, s * 0.2, -s * 0.1, -s * 0.8, s, 0, s * 0.2, s * 0.7]); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(s * 0.4, -s * 0.1); g.stroke(); },
  /* long thin sliver of wood */
  splinter: (g, s) => { poly(g, [-s * 1.4, 0, s * 0.4, -s * 0.18, s * 1.5, 0, s * 0.4, s * 0.16]); g.closePath(); g.stroke(); },
  /* thin curled flake */
  flake: (g, s) => { g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.9, s, -s * 0.1); g.quadraticCurveTo(0, -s * 0.3, -s, 0); g.stroke(); },
  /* a short dash: bone clicks, grit */
  tick: (g, s) => { g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(s * 0.6, 0); g.stroke(); },
  /* wavy filament of fibre */
  thread: (g, s) => { g.beginPath(); g.moveTo(-s * 1.6, 0); g.bezierCurveTo(-s * 0.8, -s * 1.1, -s * 0.2, s * 1.1, s * 0.5, 0.1 * s); g.bezierCurveTo(s * 0.9, -s * 0.4, s * 1.2, s * 0.2, s * 1.7, -s * 0.2); g.stroke(); },
  /* lumpy crumb of earth */
  crumb: (g, s) => { poly(g, [-s, 0, -s * 0.6, -s * 0.7, s * 0.2, -s * 0.9, s, -s * 0.2, s * 0.8, s * 0.6, -s * 0.2, s * 0.8]); g.closePath(); g.stroke(); },
  /* a thin triangle with a ray: glass catching light */
  prism: (g, s) => { poly(g, [0, -s, s * 0.9, s * 0.7, -s * 0.9, s * 0.7]); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-s * 0.4, s * 0.1); g.lineTo(s * 1.9, -s * 0.4); g.stroke(); },
  /* teardrop */
  drop: (g, s) => { g.beginPath(); g.moveTo(0, -s * 1.1); g.bezierCurveTo(s * 0.9, -s * 0.1, s * 0.8, s * 0.9, 0, s * 0.9); g.bezierCurveTo(-s * 0.8, s * 0.9, -s * 0.9, -s * 0.1, 0, -s * 1.1); g.stroke(); },
  /* a diamond of heat */
  ember: (g, s) => { poly(g, [0, -s, s * 0.6, 0, 0, s, -s * 0.6, 0]); g.closePath(); g.stroke(); },
  /* a gear tooth with a pin */
  tooth: (g, s) => { poly(g, [-s, s * 0.7, -s * 0.6, -s * 0.7, s * 0.6, -s * 0.7, s, s * 0.7]); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.stroke(); },
  /* a small zigzag of current */
  bolt: (g, s) => { poly(g, [-s * 1.2, -s * 0.5, -s * 0.3, s * 0.1, -s * 0.5, s * 0.2, s * 0.4, -s * 0.2, s * 0.2, -s * 0.3, s * 1.2, s * 0.5]); g.stroke(); },
  /* a square of data */
  pixel: (g, s) => { g.strokeRect(-s * 0.5, -s * 0.5, s, s); g.beginPath(); g.moveTo(-s * 0.5, -s * 0.5); g.lineTo(s * 0.5, s * 0.5); g.stroke(); },
  /* a ring of thought */
  mote: (g, s) => { g.beginPath(); g.arc(0, 0, s * 0.7, 0, TAU); g.stroke(); g.beginPath(); g.arc(s * 0.2, -s * 0.2, s * 0.18, 0, TAU); g.stroke(); },
  /* a leaf with a vein */
  leaf: (g, s) => { g.beginPath(); g.moveTo(-s, s * 0.3); g.quadraticCurveTo(-s * 0.2, -s * 1.2, s, -s * 0.6); g.quadraticCurveTo(s * 0.3, s * 0.9, -s, s * 0.3); g.stroke(); g.beginPath(); g.moveTo(-s * 0.9, s * 0.25); g.lineTo(s * 0.5, -s * 0.4); g.stroke(); },
  /* two crossed grain lines */
  grain: (g, s) => { g.beginPath(); g.moveTo(-s, -s * 0.2); g.lineTo(s, s * 0.1); g.moveTo(-s * 0.8, s * 0.2); g.lineTo(s * 0.9, s * 0.45); g.stroke(); },
  /* four point star */
  star: (g, s) => { poly(g, [0, -s, s * 0.2, -s * 0.2, s, 0, s * 0.2, s * 0.2, 0, s, -s * 0.2, s * 0.2, -s, 0, -s * 0.2, -s * 0.2]); g.closePath(); g.stroke(); },
  cross: (g, s) => { g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(s * 0.7, 0); g.moveTo(0, -s * 0.7); g.lineTo(0, s * 0.7); g.stroke(); },
  /* a quarter arc: a ripple fragment */
  arc: (g, s) => { g.beginPath(); g.arc(0, 0, s, -0.9, 0.9); g.stroke(); },
  /* a notched chip of hard stone */
  chip: (g, s) => { poly(g, [-s, s * 0.5, -s * 0.5, -s * 0.6, s * 0.1, -s * 0.2, s * 0.6, -s * 0.8, s, s * 0.4]); g.closePath(); g.stroke(); },
  /* a bead: ring with a dot */
  bead: (g, s) => { g.beginPath(); g.arc(0, 0, s * 0.6, 0, TAU); g.stroke(); g.beginPath(); g.arc(-s * 0.2, -s * 0.2, s * 0.12, 0, TAU); g.stroke(); },
};

/* ── pieces: many shapes flung out together ─────────────────────────── */

export interface PieceOpts {
  shape: ShapeId;
  n?: number;
  /** px/s */ speed?: number;
  /** radians of fan around `angle`; TAU = all round */ spread?: number;
  angle?: number;
  /** px/s² downward (negative rises) */ gravity?: number;
  life?: number;
  size?: number;
  color?: ColorKey | string;
  width?: number;
  /** 0–1 exponential speed loss */ drag?: number;
  /** rotation speed rad/s (random sign) */ spin?: number;
  /** align the shape's long axis with its travel direction */ along?: boolean;
  owner?: number;
  seed?: number;
  /** start-offset ring radius */ ring?: number;
  alpha?: number;
  /** delay before the first piece appears, seconds */ delay?: number;
}

export function pieces(fx: Fx, x: number, y: number, o: PieceOpts) {
  if (fx.reduced) return;
  const n = Math.max(1, Math.min(o.n ?? 6, 28));
  const rnd = mulberry(o.seed ?? ((x * 31 + y * 17) | 0) + n);
  const life = o.life ?? 0.7;
  for (let i = 0; i < n; i++) {
    const a = (o.angle ?? 0) + (rnd() - 0.5) * (o.spread ?? TAU);
    const sp = (o.speed ?? 80) * (0.4 + rnd() * 0.8);
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
    const r0 = o.ring ?? 0;
    const sx = x + Math.cos(a) * r0, sy = y + Math.sin(a) * r0;
    const rot0 = o.along ? a : rnd() * TAU;
    const spin = (o.spin ?? 0) * (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd());
    const size = (o.size ?? 3) * (0.65 + rnd() * 0.7);
    const gravity = o.gravity ?? 0;
    const drag = o.drag ?? 1.4;
    const delay = (o.delay ?? 0) + rnd() * 0.05;
    const lf = life * (0.7 + rnd() * 0.5);
    const shape = SHAPES[o.shape];
    const color = o.color ?? 'bone';
    const width = o.width ?? 1;
    const alpha = o.alpha ?? 0.9;
    fx.addSprite(lf + delay, (g, k, pal) => {
      const t = k * (lf + delay) - delay;
      if (t < 0) return;
      const kk = t / lf;
      // closed-form drag motion: x = x0 + v/d (1 - e^-dt)
      const f = drag > 0 ? (1 - Math.exp(-drag * t)) / drag : t;
      const px = sx + vx * f, py = sy + vy * f + 0.5 * gravity * t * t;
      g.translate(px, py);
      g.rotate(rot0 + spin * t);
      g.globalAlpha = alpha * fade(kk, 0.08, 0.5);
      g.strokeStyle = col(pal, color);
      g.lineWidth = width;
      shape(g, size * (1 - kk * 0.25));
    }, o.owner ?? 0);
  }
}

/* ── single drawn gestures: rings, hatch fans, traces ───────────────── */

export interface RippleOpts { color?: ColorKey | string; life?: number; rx: number; ry?: number; rings?: number; width?: number; owner?: number; delay?: number; rot?: number }
/** Concentric ellipses growing outward: a ripple on a surface (flat ry) or a pulse (round). */
export function ripple(fx: Fx, x: number, y: number, o: RippleOpts) {
  const life = o.life ?? 0.9, rings = o.rings ?? 2, d = o.delay ?? 0;
  fx.addSprite(life + d, (g, k, pal) => {
    const t = (k * (life + d) - d) / life; if (t < 0) return;
    g.strokeStyle = col(pal, o.color ?? 'water'); g.lineWidth = o.width ?? 1;
    for (let i = 0; i < rings; i++) {
      const tt = t - i * 0.18; if (tt <= 0 || tt >= 1) continue;
      g.globalAlpha = (1 - tt) * 0.8;
      g.beginPath();
      g.ellipse(x, y, Math.max(0.5, o.rx * easeOut(tt)), Math.max(0.5, (o.ry ?? o.rx) * easeOut(tt)), o.rot ?? 0, 0, TAU);
      g.stroke();
    }
  }, o.owner ?? 0);
}

export interface HatchOpts { color?: ColorKey | string; life?: number; len?: number; n?: number; angle?: number; spread?: number; inner?: number; width?: number; owner?: number }
/** A fan of short radial hatch strokes that grows then fades: an engraved burst. */
export function hatchFan(fx: Fx, x: number, y: number, o: HatchOpts) {
  const life = o.life ?? 0.55, n = o.n ?? 9;
  fx.addSprite(life, (g, k, pal) => {
    g.strokeStyle = col(pal, o.color ?? 'bone'); g.lineWidth = o.width ?? 1;
    const e = easeOut(k);
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + ((i / Math.max(1, n - 1)) - 0.5) * (o.spread ?? TAU);
      const r0 = (o.inner ?? 8) + e * 6, r1 = r0 + (o.len ?? 12) * e;
      g.globalAlpha = (1 - k) * 0.85;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
    }
  }, o.owner ?? 0);
}

/** A polyline drawn progressively then faded (a trace of ink, a route, a circuit). */
export function trace(fx: Fx, pts: number[], o: { color?: ColorKey | string; life?: number; width?: number; owner?: number; dash?: number[]; hold?: number } = {}) {
  const life = o.life ?? 0.9;
  const segs: number[] = []; let total = 0;
  for (let i = 2; i < pts.length; i += 2) { const d = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); segs.push(d); total += d; }
  fx.addSprite(life, (g, k, pal) => {
    const draw = Math.min(1, k / (1 - (o.hold ?? 0.45))) * total;
    g.strokeStyle = col(pal, o.color ?? 'ochre'); g.lineWidth = o.width ?? 1.2;
    if (o.dash) g.setLineDash(o.dash);
    g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    let left = draw;
    for (let i = 0; i < segs.length && left > 0; i++) {
      const f = Math.min(1, left / (segs[i] || 1));
      g.lineTo(pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * f, pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * f);
      left -= segs[i];
    }
    g.stroke();
  }, o.owner ?? 0);
}

const pathCache = new Map<string, Path2D>();
/** A hand-authored SVG path (viewBox −10..10) drawn as a moving, scaling, rotating glyph; `size` is its full width in px. */
export interface GlyphOpts {
  d: string; life?: number; size?: number; color?: ColorKey | string; width?: number;
  from?: [number, number]; to?: [number, number]; rot0?: number; rot1?: number; s0?: number; s1?: number;
  wobble?: number; owner?: number; delay?: number; alpha?: number; flipX?: boolean; hold?: [number, number];
}
export function glyph(fx: Fx, x: number, y: number, o: GlyphOpts) {
  let p = pathCache.get(o.d);
  if (!p) { p = new Path2D(o.d); pathCache.set(o.d, p); }
  const life = o.life ?? 1.1, d = o.delay ?? 0;
  const [h0, h1] = o.hold ?? [0.18, 0.7];
  fx.addSprite(life + d, (g, k, pal) => {
    const t = (k * (life + d) - d) / life; if (t < 0) return;
    const e = easeInOut(t);
    const fx0 = o.from?.[0] ?? 0, fy0 = o.from?.[1] ?? 0, fx1 = o.to?.[0] ?? fx0, fy1 = o.to?.[1] ?? fy0;
    const px = x + fx0 + (fx1 - fx0) * e + (o.wobble ? Math.sin(t * 22) * o.wobble : 0);
    const py = y + fy0 + (fy1 - fy0) * e;
    const sc = ((o.s0 ?? 1) + ((o.s1 ?? o.s0 ?? 1) - (o.s0 ?? 1)) * e) * (o.size ?? 24) / 20;
    g.translate(px, py);
    g.rotate((o.rot0 ?? 0) + ((o.rot1 ?? o.rot0 ?? 0) - (o.rot0 ?? 0)) * e);
    g.scale(o.flipX ? -sc : sc, sc);
    g.globalAlpha = (o.alpha ?? 0.92) * fade(t, h0, h1);
    g.strokeStyle = col(pal, o.color ?? 'bone');
    g.lineWidth = (o.width ?? 1.1) / Math.max(0.05, sc);
    g.stroke(p!);
  }, o.owner ?? 0);
}

/** A little cloud of hatch lines that billows and drifts: dust, steam, ink. */
export function billow(fx: Fx, x: number, y: number, o: { color?: ColorKey | string; r?: number; rise?: number; life?: number; n?: number; owner?: number; seed?: number; width?: number } = {}) {
  const life = o.life ?? 0.9, n = o.n ?? 5, r = o.r ?? 10, rnd = mulberry(o.seed ?? ((x + y) | 0));
  const blobs = Array.from({ length: n }, () => ({ a: rnd() * TAU, d: rnd() * r, s: r * (0.35 + rnd() * 0.4), ph: rnd() * TAU }));
  fx.addSprite(life, (g, k, pal) => {
    g.strokeStyle = col(pal, o.color ?? 'bone3'); g.lineWidth = o.width ?? 0.9;
    const e = easeOut(k);
    for (const b of blobs) {
      const bx = x + Math.cos(b.a) * b.d * (0.4 + e), by = y + Math.sin(b.a) * b.d * 0.6 * (0.4 + e) - (o.rise ?? 14) * e;
      g.globalAlpha = (1 - k) * 0.7;
      g.beginPath(); g.arc(bx, by, b.s * (0.5 + e * 0.7), b.ph, b.ph + 4.2); g.stroke();
    }
  }, o.owner ?? 0);
}

/** Straight bright streaks along one direction: sweeps, glints, speed lines. */
export function streaks(fx: Fx, x: number, y: number, o: { angle: number; n?: number; len?: number; gap?: number; dist?: number; life?: number; color?: ColorKey | string; width?: number; owner?: number }) {
  const life = o.life ?? 0.4, n = o.n ?? 4;
  fx.addSprite(life, (g, k, pal) => {
    g.strokeStyle = col(pal, o.color ?? 'bone'); g.lineWidth = o.width ?? 1;
    const c = Math.cos(o.angle), s = Math.sin(o.angle);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * (o.gap ?? 5);
      const head = easeOut(k) * (o.dist ?? 24), tail = Math.max(0, head - (o.len ?? 12));
      g.globalAlpha = (1 - k) * 0.9;
      g.beginPath();
      g.moveTo(x - s * off + c * tail, y + c * off + s * tail);
      g.lineTo(x - s * off + c * head, y + c * off + s * head);
      g.stroke();
    }
  }, o.owner ?? 0);
}

/** Resolve a ColorKey to the live palette (for callers that need the string). */
export const palColor = col;
