import type { Body, StepCtx, StepDef } from '../types';
import { Step, TAU, arcRing, beacon, chevrons, clamp, dist, lerp, num, pickTool, str } from './util';

/* ============================================================================
   PATH STEPS — drawn or followed with the pointer.
     trace    follow a shape with the pointer (a stitch, a circle, a symbol)
     route    drag an object down a channel to where it is going
     connect  join matching terminals with wire
     cut      swipe a blade across the piece, along the line
   ========================================================================== */

type Pt = [number, number];

/** Resample a polyline to roughly even spacing. */
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      d += step;
    }
    carry = seg - (d - step);
  }
  const last = pts[pts.length - 1];
  if (Math.hypot(out[out.length - 1][0] - last[0], out[out.length - 1][1] - last[1]) > step * 0.4) out.push(last);
  return out;
}

const poly = (pts: [number, number][], S: number, cx: number, cy: number): Pt[] => pts.map(([x, y]) => [cx + x * S, cy + y * S]);

export function shapePoints(shape: string, S: number, cx: number, cy: number, laps = 1): Pt[] {
  const raw: Pt[] = [];
  switch (shape) {
    case 'circle':
      for (let i = 0; i <= 48 * laps; i++) { const a = -Math.PI / 2 + (i / 48) * TAU; raw.push([cx + Math.cos(a) * S, cy + Math.sin(a) * S]); }
      return resample(raw, 7);
    case 'wave':
      for (let i = 0; i <= 60; i++) { const x = -1.9 + (i / 60) * 3.8; raw.push([cx + x * S, cy + Math.sin(x * 2.1) * S * 0.55]); }
      return resample(raw, 7);
    case 'arc':
      for (let i = 0; i <= 40; i++) { const a = Math.PI + (i / 40) * Math.PI; raw.push([cx + Math.cos(a) * S * 1.5, cy + Math.sin(a) * S * 1.1 + S * 0.5]); }
      return resample(raw, 7);
    case 'zigzag':
      return resample(poly([[-1.9, 0.6], [-0.95, -0.6], [0, 0.6], [0.95, -0.6], [1.9, 0.6]], S, cx, cy), 7);
    case 'cross':
      return resample(poly([[0, -1], [0, 1], [0, 0], [-1, 0], [1, 0]], S, cx, cy), 7);
    case 'symbol':
      for (let i = 0; i <= 90; i++) { const t = i / 90; const a = -Math.PI / 2 + t * 3.1 * Math.PI; const r = S * (0.18 + 0.82 * t); raw.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      return resample(raw, 7);
    case 'script':
      for (let i = 0; i <= 120; i++) { const t = i / 120; const th = t * 5 * TAU; raw.push([cx + (-1.75 + t * 3.5) * S + Math.sin(th) * S * 0.3, cy - Math.cos(th) * S * 0.3 + Math.sin(t * TAU) * S * 0.25]); }
      return resample(raw, 7);
    case 'circuit':
      return resample(poly([[-1.9, 0.7], [-1, 0.7], [-1, 0], [-0.2, 0], [-0.2, -0.7], [0.6, -0.7], [0.6, 0.1], [1.4, 0.1], [1.4, -0.6], [1.9, -0.6]], S, cx, cy), 7);
    case 'stitch':
    default: {
      const zz: Pt[] = [];
      for (let i = 0; i <= 9; i++) zz.push([-1.9 + (i / 9) * 3.8, i % 2 ? 0.32 : -0.32]);
      return resample(poly(zz, S, cx, cy), 7);
    }
  }
}

/* ── trace ─────────────────────────────────────────────────────────────── */

class Trace extends Step {
  readonly kind = 'trace' as const;
  private pts: Pt[];
  private idx = 0;
  private started = false;
  private tol: number;
  private shape: string;
  private penDown = false;
  private glow = 0;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.shape = str(p.shape, 'circle');
    const S = Math.max(46, Math.min(c.h * 0.3, c.w * 0.17, 120));
    this.pts = shapePoints(this.shape, S, c.cx, c.cy, Math.max(1, Math.round(num(p.laps, 1))));
    this.tol = clamp(c.world.unit * 0.8, 20, 32) * (1 + c.assist * 0.7);
    // the pair lies under the drawing, out of the way
    c.a.grabbable = c.b.grabbable = false;
    c.a.x = c.cx - c.a.r * 0.4; c.b.x = c.cx + c.b.r * 0.4; c.a.y = c.b.y = c.cy;
  }
  private follow(c: StepCtx) {
    const x = c.ptr.x, y = c.ptr.y;
    if (!this.started) {
      if (dist(x, y, this.pts[0][0], this.pts[0][1]) < this.tol * 1.7) this.started = true; else return;
    }
    // look a little way ahead of the head; only forward counts
    const end = Math.min(this.pts.length - 1, Math.floor(this.idx) + 9);
    let best = -1, bd = Infinity;
    for (let i = Math.max(0, Math.floor(this.idx) - 1); i <= end; i++) {
      const d = dist(x, y, this.pts[i][0], this.pts[i][1]);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && bd < this.tol && best > this.idx) {
      this.idx = best;
      this.glow = 1;
      c.fx.sound('scrape', { vol: 0.16, rate: 1.2 });
      if (!c.reduced && Math.random() < 0.4) c.fx.burst(x, y, { n: 1, color: 'ochre', speed: 18, life: 0.5, size: 1.5 });
    }
  }
  down(c: StepCtx) { this.penDown = true; this.follow(c); }
  move(c: StepCtx) { if (c.ptr.down) this.follow(c); }
  up() { this.penDown = false; }
  key(k: 'primary' | 'interact' | 'rotate') { if (k !== 'rotate') { this.started = true; this.idx = Math.min(this.pts.length - 1, this.idx + this.pts.length * 0.08); this.glow = 1; } }
  update(dt: number, c: StepCtx) {
    this.glow = Math.max(0, this.glow - dt * 3);
    if (c.keys.has(' ')) { this.started = true; this.idx = Math.min(this.pts.length - 1, this.idx + this.pts.length * 0.3 * dt); }
    this.progress = clamp(this.idx / (this.pts.length - 1));
    if (this.progress >= 0.985 && !this.done) {
      const e = this.pts[this.pts.length - 1];
      c.fx.ring(e[0], e[1], 26, { color: 'ochre' }); c.fx.sound('chime', { vol: 0.6 }); c.fx.flash(0.4);
      this.finish();
    }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const pts = this.pts, n = pts.length;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    // what is to be drawn
    g.strokeStyle = c.pal.bone3; g.lineWidth = this.shape === 'stitch' ? 2 : 2.2; g.globalAlpha = 0.55;
    g.setLineDash(this.shape === 'stitch' ? [5, 7] : [3, 6]); g.lineDashOffset = -c.t * 8;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.setLineDash([]);
    // what has been
    const upto = Math.floor(this.idx);
    if (upto > 0) {
      g.strokeStyle = c.pal.ochre; g.lineWidth = 3.2; g.globalAlpha = 0.95;
      g.beginPath(); for (let i = 0; i <= upto; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]); } g.stroke();
      if (this.glow > 0) { g.globalAlpha = this.glow * 0.4; g.lineWidth = 8; g.stroke(); }
    }
    g.restore();
    if (this.done) return;
    const head = pts[Math.min(n - 1, Math.floor(this.idx))];
    if (!this.started) beacon(g, pts[0][0], pts[0][1], this.tol * 0.9, c.t, c.pal.ochre, 0.9);
    else if (!this.penDown && !c.ptr.down) beacon(g, head[0], head[1], this.tol * 0.7, c.t, c.pal.ochre, 0.8);
    g.fillStyle = c.pal.ochre; g.globalAlpha = 1;
    g.beginPath(); g.arc(head[0], head[1], 4, 0, TAU); g.fill();
  }
  cleanup(c: StepCtx) { c.a.grabbable = c.b.grabbable = true; }
}

/* ── route ─────────────────────────────────────────────────────────────── */

function routePoints(kind: string, S: number, cx: number, cy: number): Pt[] {
  const raw: Pt[] = [];
  switch (kind) {
    case 'zigzag':
      return resample(poly([[-2, 0.5], [-1, -0.55], [0, 0.5], [1, -0.55], [2, 0.5]], S, cx, cy), 6);
    case 'loop':
      for (let i = 0; i <= 60; i++) { const a = Math.PI * 0.5 + (i / 60) * TAU * 0.98; raw.push([cx + Math.cos(a) * S * 1.05, cy + Math.sin(a) * S * 0.9]); }
      return resample(raw, 6);
    case 's':
    case 'channel':
      for (let i = 0; i <= 50; i++) { const x = -2 + (i / 50) * 4; raw.push([cx + x * S, cy + Math.sin((x + 2) / 4 * TAU) * S * 0.6]); }
      return resample(raw, 6);
    case 'wave':
    default:
      for (let i = 0; i <= 60; i++) { const x = -2.1 + (i / 60) * 4.2; raw.push([cx + x * S, cy + Math.sin(x * 1.7) * S * 0.6]); }
      return resample(raw, 6);
  }
}

class Route extends Step {
  readonly kind = 'route' as const;
  private pts: Pt[];
  private idx = 0;
  private dragging = false;
  private W: number;
  private off = 0;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    const S = Math.max(46, Math.min(c.h * 0.26, c.w * 0.16, 105));
    this.pts = routePoints(str(p.path, 'wave'), S, c.cx, c.cy);
    this.W = c.a.r * 0.62 * (1 + c.assist * 0.5);
    const s = this.pts[0], e = this.pts[this.pts.length - 1];
    c.a.x = s[0]; c.a.y = s[1]; c.b.x = e[0]; c.b.y = e[1];
    c.b.grabbable = false;
    c.a.grabbable = true;
    this.grabs = true;
  }
  down(c: StepCtx) {
    const a = c.a;
    if (dist(c.ptr.x, c.ptr.y, a.x, a.y) < a.r * 1.7) this.dragging = true;
  }
  up() { this.dragging = false; }
  private advance(c: StepCtx, x: number, y: number) {
    const end = Math.min(this.pts.length - 1, Math.floor(this.idx) + 40);
    let best = -1, bd = Infinity;
    for (let i = Math.max(0, Math.floor(this.idx) - 6); i <= end; i++) {
      const d = dist(x, y, this.pts[i][0], this.pts[i][1]);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && bd < this.W * 3) {
      this.idx = Math.max(this.idx, Math.min(best, this.idx + 14));
      const p = this.pts[Math.floor(this.idx)];
      this.off = clamp(dist(x, y, p[0], p[1]), 0, this.W * 0.5) * (y > p[1] ? 1 : -1);
    }
    void c;
  }
  key(k: 'primary' | 'interact' | 'rotate') { if (k !== 'rotate') this.idx = Math.min(this.pts.length - 1, this.idx + this.pts.length * 0.05); }
  update(dt: number, c: StepCtx) {
    if (c.keys.has(' ')) this.idx = Math.min(this.pts.length - 1, this.idx + this.pts.length * 0.4 * dt);
    if (this.dragging && c.ptr.down) this.advance(c, c.ptr.x, c.ptr.y);
    const p = this.pts[Math.floor(this.idx)];
    const a = c.a;
    a.x += (p[0] - a.x) * Math.min(1, dt * 18); a.y += (p[1] + this.off * 0.5 - a.y) * Math.min(1, dt * 18);
    const q = this.pts[Math.min(this.pts.length - 1, Math.floor(this.idx) + 3)];
    a.angle = Math.atan2(q[1] - p[1], q[0] - p[0]) * 0.6; a.targetAngle = a.angle;
    a.z = lerp(a.z, this.dragging ? 7 : 0, Math.min(1, dt * 10));
    this.progress = clamp(this.idx / (this.pts.length - 1));
    if (this.dragging && this.progress > 0 && this.progress < 1 && !c.reduced && Math.random() < dt * 14) c.fx.burst(a.x, a.y, { n: 1, color: 'water', speed: 12, life: 0.5, size: 1.5 });
    if (this.progress >= 0.975 && !this.done) {
      c.fx.ring(c.b.x, c.b.y, c.b.r * 1.8, { color: 'ochre' }); c.fx.sound('chime', { vol: 0.6 }); c.b.q = 0.16;
      this.finish();
    }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const pts = this.pts;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    // the channel: two rails and a flow
    for (const sgn of [-1, 1]) {
      g.strokeStyle = c.pal.bone3; g.lineWidth = 1.6; g.globalAlpha = 0.7;
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const q = pts[Math.min(pts.length - 1, i + 1)], p0 = pts[Math.max(0, i - 1)];
        const dx = q[0] - p0[0], dy = q[1] - p0[1], d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d;
        if (i) g.lineTo(x + nx * this.W * sgn, y + ny * this.W * sgn); else g.moveTo(x + nx * this.W * sgn, y + ny * this.W * sgn);
      });
      g.stroke();
    }
    g.strokeStyle = c.pal.ochre; g.globalAlpha = 0.5; g.lineWidth = 1.4; g.setLineDash([2, 9]); g.lineDashOffset = -c.t * 30;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.restore();
    if (!this.done && this.progress < 0.02) {
      beacon(g, c.a.x, c.a.y, c.a.r * 1.1, c.t, c.pal.ochre, 0.8);
      const q = pts[Math.min(pts.length - 1, 12)];
      chevrons(g, c.a.x, c.a.y, q[0], q[1], c.t, c.pal.ochre, 0.8);
    }
    arcRing(g, c.b.x, c.b.y, c.b.r * 1.5, this.progress, c.pal.ochre, 2.2, c.pal.line3);
  }
  cleanup(c: StepCtx) { c.a.grabbable = c.b.grabbable = true; c.a.z = 0; c.a.angle = c.a.targetAngle = 0; }
}

/* ── connect ───────────────────────────────────────────────────────────── */

interface Term { x: number; y: number; side: 'l' | 'r'; pair: number; done: boolean }

const drawMark = (g: CanvasRenderingContext2D, x: number, y: number, r: number, k: number) => {
  g.beginPath();
  if (k === 0) g.arc(x, y, r, 0, TAU);
  else if (k === 1) g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else { g.moveTo(x, y - r); g.lineTo(x + r * 0.95, y + r * 0.75); g.lineTo(x - r * 0.95, y + r * 0.75); g.closePath(); }
};

class Connect extends Step {
  readonly kind = 'connect' as const;
  private terms: Term[] = [];
  private n: number;
  private tr: number;
  private from: Term | null = null;
  private done_ = 0;
  private auto: { t: Term; u: Term; k: number } | null = null;
  private pulses = 0;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.n = clamp(Math.round(num(p.links, 2) * (0.75 + 0.25 * c.res) + 0.3), 1, 3);
    this.tr = c.a.r * 0.42;
    const dx = Math.min(c.w * 0.3, c.a.r * 4.4);
    const ys = this.n === 1 ? [0] : this.n === 2 ? [-1.05, 1.05] : [-1.6, 0, 1.6];
    const perm = [...Array(this.n).keys()];
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(c.rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const cy0 = c.cy + c.a.r * 0.5;
    for (let i = 0; i < this.n; i++) {
      this.terms.push({ x: c.cx - dx, y: cy0 + ys[i] * c.a.r, side: 'l', pair: i, done: false });
      this.terms.push({ x: c.cx + dx, y: cy0 + ys[perm[i]] * c.a.r, side: 'r', pair: i, done: false });
    }
    c.a.grabbable = c.b.grabbable = false;
    c.a.x = c.cx - c.a.r * 0.55; c.b.x = c.cx + c.b.r * 0.55; c.a.y = c.b.y = c.cy - c.a.r * 1.9;
  }
  private hit(x: number, y: number, side?: 'l' | 'r', pair?: number): Term | null {
    for (const t of this.terms) {
      if ((side && t.side !== side) || (pair !== undefined && t.pair !== pair)) continue;
      if (dist(x, y, t.x, t.y) < this.tr * 1.9) return t;
    }
    return null;
  }
  down(c: StepCtx) {
    const t = this.hit(c.ptr.x, c.ptr.y);
    if (t && !t.done) { this.from = t; c.fx.sound('tick', { vol: 0.4 }); }
  }
  up(c: StepCtx) {
    const f = this.from;
    this.from = null;
    if (!f) return;
    const other = this.hit(c.ptr.x, c.ptr.y, f.side === 'l' ? 'r' : 'l');
    if (other && other.pair === f.pair) this.link(f, other, c);
    else if (other) { c.fx.sound('tick', { vol: 0.4, rate: 0.6 }); c.fail(0.2); }
  }
  private link(t: Term, u: Term, c: StepCtx) {
    if (t.done) return;
    t.done = u.done = true; this.done_++;
    c.fx.ring(t.x, t.y, this.tr * 2.4, { color: 'ochre', life: 0.4 }); c.fx.ring(u.x, u.y, this.tr * 2.4, { color: 'ochre', life: 0.4 });
    c.fx.sound('snap', { vol: 0.8, rate: 0.9 + this.done_ * 0.15 });
    c.fx.spark((t.x + u.x) / 2, (t.y + u.y) / 2, { n: 6, color: 'ochre', speed: 120 });
    this.pulses = 1;
  }
  key(k: 'primary' | 'interact' | 'rotate') {
    if (k === 'rotate' || this.auto) return;
    const t = this.terms.find(q => q.side === 'l' && !q.done);
    const u = t && this.terms.find(q => q.side === 'r' && q.pair === t.pair);
    if (t && u) this.auto = { t, u, k: 0 };
  }
  update(dt: number, c: StepCtx) {
    if (this.auto) {
      this.auto.k += dt / 0.35;
      if (this.auto.k >= 1) { this.link(this.auto.t, this.auto.u, c); this.auto = null; }
    }
    this.progress = this.done_ / this.n;
    this.pulses = Math.max(0, this.pulses - dt * 2);
    if (this.done_ >= this.n && !this.done) {
      c.fx.ring(c.cx, c.cy, c.a.r * 3, { color: 'ochre', life: 0.7 }); c.fx.sound('chime', { vol: 0.7 }); c.fx.flash(0.5);
      this.finish();
    }
  }
  private wire(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0) * 0.45;
    g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + Math.sign(x1 - x0 || 1) * dx, y0, x1 - Math.sign(x1 - x0 || 1) * dx, y1, x1, y1);
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    g.save();
    g.lineCap = 'round';
    // joined pairs
    for (const t of this.terms) {
      if (t.side !== 'l' || !t.done) continue;
      const u = this.terms.find(q => q.side === 'r' && q.pair === t.pair)!;
      g.strokeStyle = c.pal.ochre; g.lineWidth = 3; g.globalAlpha = 0.95; this.wire(g, t.x, t.y, u.x, u.y); g.stroke();
      g.strokeStyle = c.pal.bone; g.lineWidth = 1.4; g.globalAlpha = 0.7; g.setLineDash([2, 12]); g.lineDashOffset = -c.t * 60;
      this.wire(g, t.x, t.y, u.x, u.y); g.stroke(); g.setLineDash([]);
    }
    // the wire being drawn, or the automatic one
    if (this.from) {
      g.strokeStyle = c.pal.ochre; g.lineWidth = 2.4; g.globalAlpha = 0.9;
      this.wire(g, this.from.x, this.from.y, c.ptr.x, c.ptr.y); g.stroke();
    }
    if (this.auto) {
      const { t, u, k } = this.auto;
      g.strokeStyle = c.pal.ochre; g.lineWidth = 2.4; g.globalAlpha = 0.9;
      this.wire(g, t.x, t.y, lerp(t.x, u.x, k), lerp(t.y, u.y, k)); g.stroke();
    }
    // the terminals: the same mark on both ends of a pair
    for (const t of this.terms) {
      const active = this.from === t;
      g.globalAlpha = 1;
      g.fillStyle = t.done ? c.pal.ochre : 'transparent';
      g.strokeStyle = t.done ? c.pal.ochre : active ? c.pal.bone : c.pal.bone2; g.lineWidth = 2;
      g.beginPath(); g.arc(t.x, t.y, this.tr, 0, TAU); if (t.done) g.fill(); g.stroke();
      g.strokeStyle = t.done ? c.pal.ink : c.pal.bone; g.lineWidth = 1.6; g.globalAlpha = 0.9;
      drawMark(g, t.x, t.y, this.tr * 0.5, t.pair % 3); g.stroke();
      if (!t.done && !this.from) beacon(g, t.x, t.y, this.tr * 1.1, c.t + t.pair * 0.2, c.pal.ochre, t.side === 'l' ? 0.7 : 0.25);
    }
    g.restore();
  }
  cleanup(c: StepCtx) { c.a.grabbable = c.b.grabbable = true; }
}

/* ── cut ───────────────────────────────────────────────────────────────── */

class Cut extends Step {
  readonly kind = 'cut' as const;
  private target: Body;
  private tool: Body;
  private cuts: number;
  private made = 0;
  private ang = 0;
  private sx = 0; private sy = 0; private ex = 0; private ey = 0;
  private swiping = false;
  private slash: { x0: number; y0: number; x1: number; y1: number; life: number } | null = null;
  private prepared = false;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    const pick = pickTool(c, p.tool, p.on ?? (c.a.props.hard >= c.b.props.hard ? 'b' : 'a'));
    this.tool = pick.tool; this.target = pick.target;
    this.cuts = Math.max(1, Math.round(num(p.cuts, 1) * (0.8 + 0.2 * c.res)));
    this.nextLine(c);
    this.target.grabbable = false; this.tool.grabbable = false;
    this.target.angle = this.target.targetAngle = 0;
    this.target.x += (c.cx - this.target.x) * 0.6; this.target.y = c.cy;
  }
  private nextLine(c: StepCtx) { this.ang = (0.5 + c.rnd() * 0.9) * (c.rnd() < 0.5 ? 1 : -1) + Math.PI / 2; }
  down(c: StepCtx) { this.swiping = true; this.sx = this.ex = c.ptr.x; this.sy = this.ey = c.ptr.y; }
  move(c: StepCtx) { if (this.swiping) { this.ex = c.ptr.x; this.ey = c.ptr.y; } }
  up(c: StepCtx) {
    if (!this.swiping) return;
    this.swiping = false;
    this.ex = c.ptr.x; this.ey = c.ptr.y;
    const t = this.target;
    const len = Math.hypot(this.ex - this.sx, this.ey - this.sy);
    if (len < t.r * 1.3 * (1 - c.assist * 0.2)) return;   // a tap, not a cut
    const mx = (this.sx + this.ex) / 2, my = (this.sy + this.ey) / 2;
    const cross = dist(mx, my, t.x, t.y) < t.r * 0.95 * (1 + c.assist * 0.5);
    const a = Math.atan2(this.ey - this.sy, this.ex - this.sx);
    let d = Math.abs(((a - this.ang) % Math.PI + Math.PI) % Math.PI); if (d > Math.PI / 2) d = Math.PI - d;
    const straight = d < 0.7 * (1 + c.assist * 0.6);
    if (cross && straight) this.make(c, this.sx, this.sy, this.ex, this.ey);
    else { c.fx.sound('whoosh', { vol: 0.4 }); c.fail(0.25); this.slash = { x0: this.sx, y0: this.sy, x1: this.ex, y1: this.ey, life: 0.25 }; }
  }
  key(k: 'primary' | 'interact' | 'rotate', c: StepCtx) {
    if (k === 'rotate' || this.done) return;
    const t = this.target, u = { x: Math.cos(this.ang), y: Math.sin(this.ang) };
    this.make(c, t.x - u.x * t.r * 1.6, t.y - u.y * t.r * 1.6, t.x + u.x * t.r * 1.6, t.y + u.y * t.r * 1.6);
  }
  private make(c: StepCtx, x0: number, y0: number, x1: number, y1: number) {
    this.made++;
    this.slash = { x0, y0, x1, y1, life: 0.32 };
    const t = this.target;
    c.fx.sound('whoosh', { vol: 0.6 }); c.fx.sound(this.tool.props.sound, { vol: 0.5 });
    c.fx.spark(t.x, t.y, { n: 6, color: 'ochre', speed: 170 });
    c.fx.burst(t.x, t.y, { n: 8, color: t.props.dust === 'ochre' ? 'ochre' : 'bone2', speed: 100, life: 0.5 });
    c.fx.shake(2);
    this.halves(t, this.ang);
    this.nextLine(c);
    if (this.made >= this.cuts) { this.prepared = true; this.finishAt = c.t + 0.4; }
  }
  private finishAt = -1;
  /** The piece parts along the line: two clones of its element, clipped and drifting apart. */
  private halves(t: Body, ang: number) {
    const host = t.el.parentElement;
    if (!host) return;
    const R = t.r * 2.4, r = t.r;
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const mk = (s: number) => {
      const el = t.el.cloneNode(true) as HTMLElement;
      el.classList.add('wb-half');
      const pts = [
        [r + ux * R, r + uy * R], [r - ux * R, r - uy * R],
        [r - ux * R + nx * R * s, r - uy * R + ny * R * s], [r + ux * R + nx * R * s, r + uy * R + ny * R * s],
      ].map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',');
      el.style.clipPath = `polygon(${pts})`;
      el.style.zIndex = '60';
      host.appendChild(el);
      const base = t.el.style.transform;
      void el.offsetWidth;
      el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1), opacity .35s .3s';
      el.style.transform = `${base} translate(${nx * s * r * 0.55}px, ${ny * s * r * 0.55}px) rotate(${0.14 * s}rad)`;
      el.style.opacity = '0';
      window.setTimeout(() => el.remove(), 800);
    };
    mk(1); mk(-1);
    t.el.style.transition = 'opacity .25s .35s'; t.el.style.opacity = '0';
    window.setTimeout(() => { t.el.style.opacity = ''; }, 500);
    t.q = 0.16; t.ox += 3;
  }
  update(dt: number, c: StepCtx) {
    const { tool, target } = this;
    if (this.slash) { this.slash.life -= dt; if (this.slash.life <= 0) this.slash = null; }
    // the blade rides the pointer while it is down; otherwise it waits beside the piece
    const hx = this.swiping ? c.ptr.x : target.x + target.r * 1.9, hy = this.swiping ? c.ptr.y : target.y - target.r * 0.9;
    tool.x += (hx - tool.x) * Math.min(1, dt * 16); tool.y += (hy - tool.y) * Math.min(1, dt * 16);
    tool.z = lerp(tool.z, this.swiping ? 10 : 6, Math.min(1, dt * 10));
    tool.angle += ((this.swiping ? Math.atan2(this.ey - this.sy, this.ex - this.sx) : -0.4) - tool.angle) * Math.min(1, dt * 12); tool.targetAngle = tool.angle;
    this.progress = clamp((this.made + (this.swiping ? 0.25 : 0)) / this.cuts);
    if (this.finishAt > 0 && c.t >= this.finishAt) this.finish();
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const t = this.target;
    if (!this.done && this.made < this.cuts) {
      const R = t.r * 1.75, ux = Math.cos(this.ang), uy = Math.sin(this.ang);
      g.save();
      g.strokeStyle = c.pal.ochre; g.lineWidth = 1.6; g.globalAlpha = 0.8; g.setLineDash([6, 6]); g.lineDashOffset = -c.t * 10;
      g.beginPath(); g.moveTo(t.x - ux * R, t.y - uy * R); g.lineTo(t.x + ux * R, t.y + uy * R); g.stroke();
      g.restore();
      if (!this.swiping && !this.made) chevrons(g, t.x - ux * R, t.y - uy * R, t.x + ux * R, t.y + uy * R, c.t, c.pal.ochre, 0.8);
    }
    if (this.swiping) {
      g.save(); g.strokeStyle = c.pal.bone; g.lineWidth = 2; g.lineCap = 'round'; g.globalAlpha = 0.7;
      g.beginPath(); g.moveTo(this.sx, this.sy); g.lineTo(this.ex, this.ey); g.stroke(); g.restore();
    }
    if (this.slash) {
      g.save(); g.strokeStyle = c.pal.bone; g.lineWidth = 3; g.lineCap = 'round'; g.globalAlpha = this.slash.life * 2.4;
      g.beginPath(); g.moveTo(this.slash.x0, this.slash.y0); g.lineTo(this.slash.x1, this.slash.y1); g.stroke(); g.restore();
    }
  }
  cleanup(c: StepCtx) { this.tool.z = 0; this.tool.grabbable = true; this.target.grabbable = true; void c; }
  get prepDone() { return this.prepared; }
  get targetBody() { return this.target; }
}

export const pathSteps: StepDef[] = [
  { kind: 'trace', verb: 'Trace', estimate: p => (p.shape === 'circle' ? 2.2 : 2.8) * num(p.laps, 1) + 0.4, create: (p, c) => new Trace(p, c) },
  { kind: 'route', verb: 'Drag through', estimate: () => 2.4, create: (p, c) => new Route(p, c) },
  { kind: 'connect', verb: 'Connect', estimate: p => num(p.links, 2) * 1.3 + 0.6, create: (p, c) => new Connect(p, c) },
  { kind: 'cut', verb: 'Cut', estimate: p => num(p.cuts, 1) * 1.2 + 0.4, create: (p, c) => new Cut(p, c) },
];
