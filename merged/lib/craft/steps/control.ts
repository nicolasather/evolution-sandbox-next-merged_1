import type { Body, StepCtx, StepDef } from '../types';
import { Step, TAU, angDiff, arcRing, beacon, chevrons, clamp, dist, gauge, lerp, noise1, num, pressing, smooth, str } from './util';

/* ============================================================================
   CONTROL STEPS — steer a process rather than trigger it.
     heat     feed a fire, hold the temperature in its band, then take it out
     pour     tilt a container and stop at the line
     keep     keep something inside a moving target, or balanced on a beam
     timing   press when the needle crosses the sweet spot
   None of them punishes: a miss eases the next attempt (c.fail) and the
   windows widen, so nobody is ever stuck.
   ========================================================================== */

/* ── heat ──────────────────────────────────────────────────────────────── */

class Heat extends Step {
  readonly kind = 'heat' as const;
  private T = 0.06;
  private dwell = 0;
  private need: number;
  private lo: number; private hi: number;
  private quench: boolean;
  private phase: 'heat' | 'ready' | 'out' = 'heat';
  private target: Body;
  private other: Body;
  private endT = -1;
  private over = 0;
  private fed = false;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    const band = Array.isArray(p.band) ? (p.band as number[]) : [0.45, 0.75];
    const widen = 0.05 * c.assist + (1 - Math.min(1.3, c.res)) * 0.05;
    this.lo = clamp((band[0] ?? 0.45) - widen, 0.15, 0.85); this.hi = clamp((band[1] ?? 0.75) + widen, 0.3, 0.97);
    this.need = Math.max(0.6, num(p.hold, 1.5) * (0.75 + 0.25 * c.res) * (1 - c.assist * 0.25));
    this.quench = p.quench === true;
    const t = p.target;
    this.target = t === 'a' ? c.a : t === 'b' ? c.b : c.a.material === 'metal' ? c.a : c.b.material === 'metal' ? c.b : c.b;
    this.other = this.target === c.a ? c.b : c.a;
    c.a.grabbable = c.b.grabbable = false;
    c.setZoneLit('hearth');
  }
  private take(c: StepCtx) {
    if (this.phase !== 'ready' || !this.quench) return;
    this.phase = 'out';
    this.endT = c.t + 0.55;
    c.fx.sound('hiss', { vol: 0.9 }); c.fx.sound('splash', { vol: 0.4 });
    c.fx.burst(this.target.x, this.target.y - this.target.r * 0.3, { n: 22, color: 'bone2', speed: 60, life: 1, size: 3, angle: -Math.PI / 2, spread: 1.4, gravity: -40, drag: 1.4 });
    c.fx.shake(1.5);
    c.setZoneLit('basin');
  }
  down(c: StepCtx) { this.take(c); }
  key(k: 'primary' | 'interact' | 'rotate', c: StepCtx) { if (k === 'interact') this.take(c); }
  update(dt: number, c: StepCtx) {
    const { target, other } = this;
    const feeding = pressing(c) && this.phase === 'heat';
    if (this.phase === 'heat') {
      if (feeding) {
        this.T += dt * 0.5 * (1 - this.T * 0.3);
        if (!this.fed || c.ptr.pressed) { c.fx.sound('whoosh', { vol: 0.35 }); this.fed = true; }
        if (!c.reduced && Math.random() < dt * 30) c.fx.burst(target.x + (Math.random() - 0.5) * target.r * 1.6, target.y + target.r * 1.1, { n: 1, color: 'hot', speed: 40, life: 0.6, size: 1.6, angle: -Math.PI / 2, spread: 0.7, gravity: -60 });
      }
      this.T = clamp(this.T - (0.09 + 0.16 * this.T) * dt, 0, 1);
      const inBand = this.T >= this.lo && this.T <= this.hi;
      if (inBand) this.dwell += dt;
      else if (this.T > this.hi) {
        this.dwell = Math.max(0, this.dwell - dt * 0.6);
        this.over += dt;
        if (this.over > 1.1) { this.over = 0; c.fail(0.25); }
        if (!c.reduced && Math.random() < dt * 14) c.fx.spark(target.x, target.y, { n: 2, color: 'hot', speed: 140 });
      } else this.dwell = Math.max(0, this.dwell - dt * 0.15);
      this.progress = clamp(this.dwell / this.need) * 0.92;
      if (this.dwell >= this.need) {
        this.phase = 'ready';
        c.fx.sound('chime', { vol: 0.6 }); c.fx.ring(target.x, target.y, target.r * 2, { color: 'hot', life: 0.7 });
        if (!this.quench) this.endT = c.t + 0.45;
      }
    } else if (this.phase === 'ready') {
      this.T = clamp(this.T, this.lo + 0.02, this.hi - 0.02);
      this.progress = 0.92;
      if (this.endT > 0 && c.t >= this.endT) this.finish();
    } else {
      this.T = Math.max(0, this.T - dt * 2.4);
      this.progress = 0.97;
      if (c.t >= this.endT) { c.setZoneLit(null); this.finish(); }
    }
    target.heat = this.T; other.heat = this.T * 0.55; target.glow = this.T; other.glow = this.T * 0.4;
    target.x += (c.cx - target.x) * Math.min(1, dt * 8); target.y += (c.cy - target.y) * Math.min(1, dt * 8);
    other.x += (c.cx + other.r * 1.25 - other.x) * Math.min(1, dt * 8); other.y += (c.cy - other.y) * Math.min(1, dt * 8);
    if (!c.reduced && this.T > 0.12 && Math.random() < dt * (10 + this.T * 40)) {
      c.fx.burst(target.x + (Math.random() - 0.5) * target.r * 2.2, target.y + target.r * 1.15, { n: 1, color: this.T > 0.75 ? 'bone' : 'hot', speed: 26 + this.T * 40, life: 0.7, size: 2 + this.T * 2, angle: -Math.PI / 2, spread: 0.6, gravity: -70 });
    }
    if (this.T > 0.3 && Math.random() < dt * 4) c.fx.sound('crackle', { vol: 0.15 + this.T * 0.3 });
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const { target } = this;
    const gx = c.cx + target.r * 3.1, gy = c.cy - target.r * 2.3, gh = target.r * 4.6;
    // a warm pool of light under the piece, growing with the heat
    const grad = g.createRadialGradient(target.x, target.y + target.r, 4, target.x, target.y + target.r, target.r * (1.4 + this.T * 1.8));
    grad.addColorStop(0, c.pal.hot); grad.addColorStop(1, 'transparent');
    g.save(); g.globalAlpha = 0.12 + this.T * 0.42; g.fillStyle = grad;
    g.fillRect(target.x - target.r * 3.4, target.y - target.r * 2, target.r * 6.8, target.r * 4.6); g.restore();
    gauge(g, gx, gy, 11, gh, this.T, [this.lo, this.hi], c, this.T > this.hi ? c.pal.bone : this.T >= this.lo ? c.pal.hot : c.pal.bone3);
    if (this.phase === 'heat') {
      arcRing(g, target.x, target.y, target.r * 1.75, this.dwell / this.need, c.pal.ochre, 2.4, c.pal.line3);
      if (this.T < 0.12) { beacon(g, target.x, target.y + target.r * 1.1, target.r * 0.8, c.t, c.pal.hot); }
    } else if (this.phase === 'ready' && this.quench) {
      beacon(g, target.x, target.y, target.r * 1.5, c.t * 1.8, c.pal.water, 0.9);
      arcRing(g, target.x, target.y, target.r * 1.75, 1, c.pal.good, 2.6);
    }
  }
  cleanup(c: StepCtx) { c.a.grabbable = c.b.grabbable = true; c.setZoneLit(null); c.a.glow = c.b.glow = 0; }
}

/* ── pour ──────────────────────────────────────────────────────────────── */

const LIQUID: Record<string, 'water' | 'good' | 'hot' | 'bone2' | 'ochre'> = {
  water: 'water', acid: 'good', medicine: 'good', metal: 'hot', ink: 'bone2', lime: 'ochre',
};

class Pour extends Step {
  readonly kind = 'pour' as const;
  private fill = 0;
  private lo: number; private hi: number;
  private tilt = 0;
  private x0 = NaN;
  private okT = 0;
  private spillT = 0;
  private liquid: keyof typeof LIQUID | string;
  private ready = false;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.liquid = str(p.liquid, 'water');
    const w = 0.09 + 0.05 * c.assist;
    this.lo = 0.66 - w * 0.3; this.hi = 0.88 + w * 0.5;
    c.a.grabbable = c.b.grabbable = false;
    c.b.x = c.cx + c.b.r * 1.15; c.b.y = c.cy + c.b.r * 0.4;
    c.a.x = c.cx - c.a.r * 1.3; c.a.y = c.cy - c.a.r * 0.9;
  }
  down(c: StepCtx) { this.x0 = c.ptr.x; }
  update(dt: number, c: StepCtx) {
    const { a, b } = c;
    if (c.ptr.down && Number.isNaN(this.x0)) this.x0 = c.ptr.x;
    if (!c.ptr.down && !c.keys.has(' ')) this.x0 = NaN;
    const want = c.keys.has(' ') ? 0.85 : c.ptr.down && !Number.isNaN(this.x0) ? clamp((c.ptr.x - this.x0) / (c.w * 0.2)) : 0;
    this.tilt = lerp(this.tilt, want, Math.min(1, dt * 9));
    const th = this.tilt * 1.5;
    a.angle = th; a.targetAngle = th;
    a.x = c.cx - a.r * 1.3 + this.tilt * a.r * 0.5; a.y = c.cy - a.r * 0.9 - this.tilt * a.r * 0.35;
    // the spout: front upper edge of the container, turned with it
    const sx = a.x + Math.cos(th) * a.r * 0.7 - Math.sin(th) * -a.r * 0.5;
    const sy = a.y + Math.sin(th) * a.r * 0.7 + Math.cos(th) * -a.r * 0.5;
    const flow = clamp((this.tilt - 0.4) / 0.5);
    if (flow > 0.02) {
      this.fill += flow * dt * (0.34 / Math.max(0.7, c.res * 0.9));
      c.fx.stream(sx, sy, b.x, b.y - b.r * 0.6, { n: 1 + Math.round(flow * 2), color: LIQUID[this.liquid] ?? 'water' });
      c.fx.sound('splash', { vol: 0.12 + flow * 0.25 });
    }
    if (this.fill > this.hi + 0.02) {
      // overfull: it slops over the side and the level drops back
      this.fill = this.hi - 0.16; this.spillT = 0.5;
      c.fx.burst(b.x + b.r * 1.2, b.y, { n: 12, color: LIQUID[this.liquid] ?? 'water', speed: 90, life: 0.6, angle: 0.3, spread: 1.2, gravity: 300 });
      c.fx.sound('splash', { vol: 0.6 }); c.fail(0.35); b.q = 0.12;
    }
    this.spillT = Math.max(0, this.spillT - dt);
    const inBand = this.fill >= this.lo && this.fill <= this.hi + 0.03 && this.tilt < 0.16;
    if (inBand) this.okT += dt; else this.okT = Math.max(0, this.okT - dt * 2);
    this.ready = this.fill >= this.lo;
    this.progress = clamp(Math.min(this.fill / this.lo, 1) * 0.85 + (this.okT / 0.4) * 0.15);
    if (this.okT >= 0.4 && !this.done) {
      c.fx.ring(b.x, b.y, b.r * 1.8, { color: 'ochre' });
      c.fx.sound('chime', { vol: 0.5 });
      this.finish();
    }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const { b } = c;
    const vx0 = b.x - b.r * 1.25, vx1 = b.x + b.r * 1.25, vy0 = b.y - b.r * 1.15, vy1 = b.y + b.r * 1.1;
    const h = vy1 - vy0;
    const col = (c.pal as unknown as Record<string, string>)[LIQUID[this.liquid] ?? 'water'] ?? c.pal.water;
    g.save();
    // the level
    g.globalAlpha = 0.38; g.fillStyle = col;
    g.fillRect(vx0 + 2, vy1 - h * clamp(this.fill) - 1, vx1 - vx0 - 4, h * clamp(this.fill));
    g.globalAlpha = 0.9; g.strokeStyle = c.pal.bone2; g.lineWidth = 1.8; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(vx0, vy0); g.lineTo(vx0 + 4, vy1); g.lineTo(vx1 - 4, vy1); g.lineTo(vx1, vy0); g.stroke();
    // the line to pour up to
    g.strokeStyle = this.ready ? c.pal.good : c.pal.ochre; g.lineWidth = 1.4; g.setLineDash([5, 4]);
    g.beginPath();
    g.moveTo(vx0 - 8, vy1 - h * this.lo); g.lineTo(vx1 + 8, vy1 - h * this.lo);
    g.moveTo(vx0 - 8, vy1 - h * this.hi); g.lineTo(vx1 + 8, vy1 - h * this.hi);
    g.stroke();
    g.restore();
    if (this.tilt < 0.05 && this.fill < 0.05) chevrons(g, c.a.x - c.a.r * 0.3, c.a.y + c.a.r * 1.6, c.a.x + c.a.r * 1.8, c.a.y + c.a.r * 1.6, c.t, c.pal.ochre, 0.7);
    arcRing(g, c.cx, c.cy - c.a.r * 2.4, c.a.r * 0.5, this.okT / 0.4, c.pal.good, 2, c.pal.line3);
  }
  cleanup(c: StepCtx) { c.a.grabbable = c.b.grabbable = true; c.a.angle = c.a.targetAngle = 0; }
}

/* ── keep ──────────────────────────────────────────────────────────────── */

class Keep extends Step {
  readonly kind = 'keep' as const;
  private mode: 'zone' | 'balance';
  private time: number;
  private dwell = 0;
  private ph = Math.random() * 6;
  private px = 0; private py = 0; private vx = 0; private vy = 0;
  private m = 0.5;
  private zx = 0; private zy = 0; private zr = 0;
  private inside = false;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.mode = p.mode === 'balance' ? 'balance' : 'zone';
    this.time = Math.max(0.8, num(p.time, 1.6) * (0.75 + 0.25 * c.res) * (1 - c.assist * 0.2));
    this.px = c.a.x; this.py = c.a.y;
    c.a.grabbable = false; c.b.grabbable = false;
    c.b.x = c.cx + c.b.r * 0.4; c.b.y = c.cy;
    this.zr = c.a.r * 1.5 * (1 + c.assist * 0.4);
    this.zx = c.cx; this.zy = c.cy;
  }
  update(dt: number, c: StepCtx) {
    const { a } = c;
    const speed = 0.7 + 0.25 * c.res;
    const on = c.ptr.down || c.keys.has(' ');
    if (this.mode === 'zone') {
      this.ph += dt * speed;
      const ax = Math.min(c.w * 0.26, a.r * 4.2), ay = Math.min(c.h * 0.22, a.r * 1.7);
      this.zx = c.cx + Math.sin(this.ph * 1.0) * ax; this.zy = c.cy + Math.sin(this.ph * 1.55 + 1) * ay;
      // the piece follows the hand with some weight
      // the pointer drags the piece; Space alone lets it follow the ring with the same lag
      const kb = c.keys.has(' ') && !c.ptr.down;
      const tx = c.ptr.down ? c.ptr.x : kb ? this.zx : this.px, ty = c.ptr.down ? c.ptr.y : kb ? this.zy : this.py;
      const w0 = 20 / (0.7 + 0.32 * a.mass);
      this.vx += (w0 * w0 * (tx - this.px) - 2 * w0 * this.vx) * dt; this.vy += (w0 * w0 * (ty - this.py) - 2 * w0 * this.vy) * dt;
      this.px += this.vx * dt; this.py += this.vy * dt;
      this.px = clamp(this.px, c.x0 + a.r, c.x0 + c.w - a.r); this.py = clamp(this.py, c.y0 + a.r, c.y0 + c.h - a.r);
      a.x = this.px; a.y = this.py; a.z = lerp(a.z, on ? 8 : 0, Math.min(1, dt * 10));
      this.inside = dist(this.px, this.py, this.zx, this.zy) < this.zr;
    } else {
      // a beam and a weight that drifts off it: lean against the drift
      const L = Math.min(c.w * 0.34, a.r * 4.6);
      const drift = (noise1(this.ph * 0.9 + c.t * 0.9) * 0.9 + Math.sin(c.t * 1.7) * 0.3) * (0.7 + 0.25 * c.res);
      const ctl = on ? clamp((c.ptr.x - c.cx) / (c.w * 0.22), -1, 1) : c.keys.has(' ') ? clamp(-(this.m - 0.5) * 5 - this.vx * 0.8, -1, 1) : 0;
      // m runs 0..1 across the beam; the hand pushes it, the drift pulls it
      this.vx += (drift * 0.9 + ctl * 1.4 - this.vx * 2.2) * dt;
      this.m = clamp(this.m + this.vx * dt * 0.7, 0.02, 0.98);
      if (this.m <= 0.02 || this.m >= 0.98) this.vx = 0;
      const tilt = (this.m - 0.5) * 0.5;
      a.x = c.cx + (this.m - 0.5) * 2 * L; a.y = c.cy + a.r * 0.6 + (this.m - 0.5) * L * 0.5 - a.r * 0.9;
      a.angle = tilt; a.targetAngle = tilt;
      this.inside = Math.abs(this.m - 0.5) < 0.17 * (1 + c.assist * 0.5);
      this.zx = c.cx; this.zy = c.cy;
    }
    if (this.inside) this.dwell = Math.min(this.time, this.dwell + dt);
    else this.dwell = Math.max(0, this.dwell - dt * 0.5);
    this.progress = clamp(this.dwell / this.time);
    if (this.inside && !c.reduced && Math.random() < dt * 8) c.fx.burst(a.x, a.y, { n: 1, color: 'ochre', speed: 20, life: 0.5, size: 1.5 });
    if (this.dwell >= this.time && !this.done) {
      c.fx.ring(a.x, a.y, a.r * 1.8, { color: 'ochre' }); c.fx.sound('chime', { vol: 0.6 });
      this.finish();
    }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    if (this.done) return;
    const { a } = c;
    if (this.mode === 'zone') {
      g.save();
      g.globalAlpha = this.inside ? 0.16 : 0.07; g.fillStyle = c.pal.ochre;
      g.beginPath(); g.arc(this.zx, this.zy, this.zr, 0, TAU); g.fill();
      g.restore();
      arcRing(g, this.zx, this.zy, this.zr, this.progress, this.inside ? c.pal.good : c.pal.ochre, 2.4, c.pal.line3);
      if (!c.ptr.down && this.dwell === 0) beacon(g, this.px, this.py, a.r * 1.1, c.t, c.pal.ochre, 0.6);
    } else {
      const L = Math.min(c.w * 0.34, a.r * 4.6);
      const tilt = (this.m - 0.5) * 0.5;
      g.save();
      g.translate(c.cx, c.cy + a.r * 0.6);
      g.rotate(tilt);
      g.strokeStyle = c.pal.bone2; g.lineWidth = 2.2; g.lineCap = 'round'; g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(-L * 1.05, 0); g.lineTo(L * 1.05, 0); g.stroke();
      // the middle band the weight has to stay in
      g.strokeStyle = this.inside ? c.pal.good : c.pal.ochre; g.lineWidth = 5; g.globalAlpha = 0.5;
      const bw = L * 0.34 * (1 + c.assist * 0.5);
      g.beginPath(); g.moveTo(-bw, 0); g.lineTo(bw, 0); g.stroke();
      g.restore();
      // the fulcrum
      g.strokeStyle = c.pal.bone3; g.lineWidth = 2; g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(c.cx, c.cy + a.r * 0.6); g.lineTo(c.cx - 9, c.cy + a.r * 1.25); g.lineTo(c.cx + 9, c.cy + a.r * 1.25); g.closePath(); g.stroke();
      g.globalAlpha = 1;
      arcRing(g, c.cx, c.cy - a.r * 2.1, a.r * 0.5, this.progress, c.pal.good, 2, c.pal.line3);
    }
  }
  cleanup(c: StepCtx) { c.a.grabbable = c.b.grabbable = true; c.a.z = 0; c.a.angle = c.a.targetAngle = 0; }
}

/* ── timing ────────────────────────────────────────────────────────────── */

class Timing extends Step {
  readonly kind = 'timing' as const;
  private hits = 0;
  private need: number;
  private ang = -Math.PI / 2;
  private spot = 0;
  private half: number;
  private speed: number;
  private cool = 0;
  private flash = 0;
  private flashOk = true;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.need = Math.max(1, Math.round(num(p.hits, 2) * (0.8 + 0.2 * c.res)));
    this.half = clamp(0.36 * (1 + c.assist * 0.6) / Math.pow(c.res, 0.35), 0.2, 0.6);
    this.speed = 2.3 * num(p.speed, 1) * Math.pow(c.res, 0.3);
    this.spot = this.ang + 2.2;
  }
  private press(c: StepCtx) {
    if (this.cool > 0 || this.done) return;
    const d = Math.abs(angDiff(this.ang, this.spot));
    if (d <= this.half + 0.05) {
      this.hits++;
      this.flash = 1; this.flashOk = true;
      c.fx.ring(c.cx, c.cy, c.a.r * 2.6, { color: 'good', life: 0.45 });
      c.fx.sound('chime', { vol: 0.5, rate: 0.9 + this.hits * 0.12 });
      c.a.q = c.b.q = 0.1;
      this.spot = this.ang + (1.6 + Math.random() * 2.2) * (Math.random() < 0.5 ? 1 : -1);
      this.speed *= 1.06;
      if (this.hits >= this.need) this.finish();
    } else {
      this.flash = 1; this.flashOk = false; this.cool = 0.28;
      c.fx.sound('tick', { vol: 0.5, rate: 0.6 }); c.fx.shake(1);
      c.a.ox = 4; c.b.ox = -4;
      c.fail(0.45);
    }
  }
  down(c: StepCtx) { this.press(c); }
  key(k: 'primary' | 'interact' | 'rotate', c: StepCtx) { if (k !== 'rotate') this.press(c); }
  update(dt: number, c: StepCtx) {
    this.ang += this.speed * dt;
    this.cool = Math.max(0, this.cool - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.half = clamp(this.half + c.assist * 0.0001, 0.2, 0.6);
    this.progress = clamp(this.hits / this.need);
    c.a.x += (c.cx - c.a.r * 0.5 - c.a.x) * Math.min(1, dt * 10); c.b.x += (c.cx + c.b.r * 0.5 - c.b.x) * Math.min(1, dt * 10);
    c.a.y += (c.cy - c.a.y) * Math.min(1, dt * 10); c.b.y += (c.cy - c.b.y) * Math.min(1, dt * 10);
    if (this.done) { /* finished on the last hit */ }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const R = c.a.r * 2.5;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = c.pal.line3; g.lineWidth = 2; g.globalAlpha = 0.8;
    g.beginPath(); g.arc(c.cx, c.cy, R, 0, TAU); g.stroke();
    if (!this.done) {
      // the sweet spot
      g.strokeStyle = this.flash > 0 && this.flashOk ? c.pal.good : c.pal.ochre; g.lineWidth = 7; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(c.cx, c.cy, R, this.spot - this.half, this.spot + this.half); g.stroke();
      // the needle
      const nx = c.cx + Math.cos(this.ang) * R, ny = c.cy + Math.sin(this.ang) * R;
      g.strokeStyle = this.flash > 0 && !this.flashOk ? c.pal.hot : c.pal.bone; g.lineWidth = 2.2; g.globalAlpha = 1;
      g.beginPath(); g.moveTo(c.cx + Math.cos(this.ang) * (R - 13), c.cy + Math.sin(this.ang) * (R - 13)); g.lineTo(nx + Math.cos(this.ang) * 7, ny + Math.sin(this.ang) * 7); g.stroke();
      g.fillStyle = c.pal.bone;
      g.beginPath(); g.arc(nx, ny, 3.2, 0, TAU); g.fill();
    }
    // hits so far, as pips under the dial
    for (let i = 0; i < this.need; i++) {
      g.globalAlpha = 1; g.fillStyle = i < this.hits ? c.pal.good : c.pal.line3;
      g.beginPath(); g.arc(c.cx + (i - (this.need - 1) / 2) * 12, c.cy + R + 16, 3, 0, TAU); g.fill();
    }
    g.restore();
  }
}

export const controlSteps: StepDef[] = [
  { kind: 'heat', verb: 'Feed the fire', estimate: p => num(p.hold, 1.5) + 2.2 + (p.quench ? 0.8 : 0), create: (p, c) => new Heat(p, c) },
  { kind: 'pour', verb: 'Pour', estimate: () => 3, create: (p, c) => new Pour(p, c) },
  { kind: 'keep', verb: 'Keep steady', estimate: p => num(p.time, 1.6) + 1.2, create: (p, c) => new Keep(p, c) },
  { kind: 'timing', verb: 'Time it', estimate: p => num(p.hits, 2) * 0.9 + 0.6, create: (p, c) => new Timing(p, c) },
];

void smooth;
