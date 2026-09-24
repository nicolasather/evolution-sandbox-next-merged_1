import type { StepCtx, StepDef } from '../types';
import { Step, arcRing, beacon, clamp, hash, lerp, num, pickTool, pressing, smooth, str, TAU, dashedCircle } from './util';

/* ============================================================================
   CONTACT STEPS — the ones where two things meet.
     touch    the easiest: they come together on their own
     impact   lift one, hold to gather force, let go: it drops onto the other
     hold     press and keep pressing: pressure, tightening, blowing on a spark
     strike   a tool swings onto a target: hammer, knap, chop
   ========================================================================== */

/* ── touch ─────────────────────────────────────────────────────────────── */

class Touch extends Step {
  readonly kind = 'touch' as const;
  private t = 0;
  private dur: number;
  private fired = false;
  constructor(p: Record<string, unknown>) { super(); this.dur = num(p.t, 0.5); }
  update(dt: number, c: StepCtx) {
    this.t += dt;
    const k = smooth(clamp(this.t / this.dur));
    this.progress = k;
    const gap = lerp(0.9, 0.5, k);
    c.a.x = c.cx - (c.a.r + c.b.r) * gap * 0.5; c.b.x = c.cx + (c.a.r + c.b.r) * gap * 0.5;
    c.a.y = c.b.y = c.cy;
    if (k >= 1 && !this.fired) {
      this.fired = true;
      c.a.q = c.b.q = 0.18;
      c.fx.ring(c.cx, c.cy, c.a.r * 1.5, { color: 'ochre' });
      c.fx.burst(c.cx, c.cy, { n: 6, color: 'bone2', speed: 60, life: 0.4 });
      c.fx.sound(c.a.props.sound, { vol: 0.5 });
      this.finish();
    }
  }
  draw() {}
}

/* ── impact ────────────────────────────────────────────────────────────── */

class Impact extends Step {
  readonly kind = 'impact' as const;
  private need: number;
  private charge = 0;
  private charging = false;
  private dropping = false;
  private vz = 0;
  private power = 0;
  private ticked = false;
  private t = 0;
  private tries = 0;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.need = clamp(num(p.force, 0.55) * (0.85 + 0.3 * c.res) - c.assist * 0.25, 0.22, 0.9);
  }
  private begin() { if (!this.dropping && !this.charging) { this.charging = true; this.charge = 0; this.ticked = false; } }
  private release() {
    if (!this.charging) return;
    this.charging = false; this.dropping = true; this.power = this.charge;
    this.vz = -(400 + this.charge * 1600);
  }
  down() { this.begin(); }
  up() { this.release(); }
  key(k: 'primary' | 'interact' | 'rotate') {
    if (k === 'rotate') return;
    if (this.charging) this.release(); else this.begin();
  }
  update(dt: number, c: StepCtx) {
    this.t += dt;
    const { a, b } = c;
    this.need = clamp(this.need - c.assist * 0.0002, 0.2, 0.9);
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / 0.85);
      a.x += (b.x - a.x) * Math.min(1, dt * 10);
      a.y += (b.y - a.y - 2) * Math.min(1, dt * 10);
      // lifts as high as the bench allows: never out of sight above the top edge
      a.z = lerp(a.z, Math.min(10 + this.charge * 64, Math.max(14, a.y - a.r * 0.6)), Math.min(1, dt * 14));
      if (this.charge >= this.need && !this.ticked) { this.ticked = true; c.fx.sound('tick', { vol: 0.6, rate: 1.2 }); c.fx.ring(b.x, b.y, b.r * 1.8, { color: 'ochre', life: 0.4 }); }
    } else if (this.dropping) {
      this.vz -= 5600 * dt;
      a.z += this.vz * dt;
      if (a.z <= 0) this.land(c);
    } else {
      a.z = lerp(a.z, 0, Math.min(1, dt * 12));
      a.x += ((c.cx - (a.r + b.r) * 0.5) - a.x) * Math.min(1, dt * 6);
      a.y += (c.cy - a.y) * Math.min(1, dt * 6);
    }
    this.progress = this.done ? 1 : this.charging ? this.charge * 0.45 : 0;
  }
  private land(c: StepCtx) {
    const { a, b } = c;
    a.z = 0; this.dropping = false; this.tries++;
    a.q = 0.22; b.q = 0.3;
    const good = this.power >= this.need;
    const at = { x: b.x, y: b.y };
    c.fx.sound(good ? b.props.sound : 'tick', { vol: 0.5 + this.power * 0.7 });
    c.fx.sound('thud', { vol: 0.3 + this.power * 0.5 });
    c.fx.burst(at.x, at.y, { n: 5 + Math.round(this.power * 10), color: 'bone2', speed: 60 + this.power * 140, life: 0.5 });
    if (a.props.hard + b.props.hard > 1.0) c.fx.spark(at.x, at.y, { n: 4 + Math.round(this.power * 8), color: 'ochre' });
    c.fx.shake(this.power * 5);
    if (good) { this.finish(); return; }
    // a soft drop: nothing gives. Show how much more it needed, and ease the next try.
    c.fail(this.tries > 1 ? 0.6 : 0.3);
    a.vx = -60; b.vx = 30;
    this.charge = 0;
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const { b } = c;
    if (this.done) return;
    const R = b.r * 1.85;
    arcRing(g, b.x, b.y, R, this.charging || this.dropping ? (this.dropping ? this.power : this.charge) : 0,
      (this.charging ? this.charge : this.power) >= this.need ? c.pal.good : c.pal.ochre, 2.4, c.pal.line3);
    // the mark the force has to reach
    const ang = -Math.PI / 2 + TAU * this.need;
    g.strokeStyle = c.pal.ochre; g.lineWidth = 2; g.globalAlpha = 0.95;
    g.beginPath();
    g.moveTo(b.x + Math.cos(ang) * (R - 6), b.y + Math.sin(ang) * (R - 6));
    g.lineTo(b.x + Math.cos(ang) * (R + 6), b.y + Math.sin(ang) * (R + 6));
    g.stroke();
    if (!this.charging && !this.dropping) beacon(g, c.a.x, c.a.y, c.a.r * 1.15, c.t, c.pal.ochre);
    g.globalAlpha = 1;
  }
  cleanup(c: StepCtx) { c.a.z = 0; }
}

/* ── hold ──────────────────────────────────────────────────────────────── */

class Hold extends Step {
  readonly kind = 'hold' as const;
  private time: number;
  private p = 0;
  private variant: string;
  private fired = false;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.time = Math.max(0.35, num(p.time, 1) * (0.7 + 0.3 * c.res) * (1 - c.assist * 0.25));
    this.variant = str(p.variant, 'press');
  }
  update(dt: number, c: StepCtx) {
    const on = pressing(c);
    this.p = clamp(this.p + (on ? dt / this.time : -dt * 1.6 / this.time));
    this.progress = this.p;
    const { a, b } = c;
    // the two are squeezed together as pressure builds
    const squeeze = smooth(this.p);
    const gap = lerp(0.9, 0.42, squeeze) * (a.r + b.r) * 0.5;
    a.x += (c.cx - gap - a.x) * Math.min(1, dt * 14); b.x += (c.cx + gap - b.x) * Math.min(1, dt * 14);
    a.y += (c.cy - a.y) * Math.min(1, dt * 10); b.y += (c.cy - b.y) * Math.min(1, dt * 10);
    if (on && this.p > 0.05) { a.q = Math.max(a.q, 0.03 + squeeze * 0.1); b.q = Math.max(b.q, 0.03 + squeeze * 0.1); }
    if (on && !c.reduced && Math.random() < dt * (6 + this.p * 26)) {
      c.fx.burst(c.cx + (Math.random() - 0.5) * a.r, c.cy + (Math.random() - 0.5) * a.r * 0.6,
        { n: 1, color: this.variant === 'blow' ? 'hot' : 'bone3', speed: 24, life: 0.4, size: 1.6, angle: -Math.PI / 2, spread: 1.4 });
    }
    if (on) c.fx.sound('scrape', { vol: 0.14 + this.p * 0.2, rate: 0.7 + this.p * 0.5 });
    if (this.variant === 'blow') { a.glow = b.glow = this.p; a.heat = Math.max(a.heat, this.p * 0.7); }
    if (this.p >= 1 && !this.fired) {
      this.fired = true;
      c.fx.ring(c.cx, c.cy, a.r * 1.7, { color: 'ochre' });
      c.fx.sound('snap', { vol: 0.8 });
      c.fx.shake(1.5);
      this.finish();
    }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    if (this.done) return;
    const R = c.a.r * 1.7;
    arcRing(g, c.cx, c.cy, R, this.p, this.p > 0.92 ? c.pal.good : c.pal.ochre, 2.6, c.pal.line3);
    if (this.variant === 'press') {
      // a plate comes down on the pair
      const y = c.cy - R * 0.95 + this.p * R * 0.5;
      g.strokeStyle = c.pal.bone2; g.lineWidth = 2; g.globalAlpha = 0.6 + this.p * 0.3;
      g.beginPath(); g.moveTo(c.cx - R * 0.9, y); g.lineTo(c.cx + R * 0.9, y); g.stroke();
      g.globalAlpha = 0.35;
      g.beginPath(); g.moveTo(c.cx, y); g.lineTo(c.cx, y - R * 0.5); g.stroke();
      g.globalAlpha = 1;
    }
    if (this.p === 0) beacon(g, c.cx, c.cy, R * 0.75, c.t, c.pal.ochre);
  }
}

/* ── strike ────────────────────────────────────────────────────────────── */

class Strike extends Step {
  readonly kind = 'strike' as const;
  private need: number;
  private units = 0;
  private lastHit = -10;
  private swing = -1;          // -1 idle, else 0..1
  private swingValid = true;
  private beat = 0;
  private cracks: [number, number][][] = [];
  private tool: import('../types').Body;
  private target: import('../types').Body;
  private prepared = false;
  private tRest = { x: 0, y: 0 };
  private hitCount = 0;
  private endT = -1;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    const pick = pickTool(c, p.tool, p.on);
    this.tool = pick.tool; this.target = pick.target;
    this.need = Math.max(2, Math.round(num(p.hits, 3) * (0.8 + 0.2 * c.res) * (1 - c.assist * 0.25)));
    for (let i = 0; i < 9; i++) {
      const a0 = hash(i * 7.3 + this.need) * TAU;
      const pts: [number, number][] = [[0, 0]];
      let x = 0, y = 0;
      const segs = 3 + Math.floor(hash(i + 4) * 3);
      for (let s = 0; s < segs; s++) {
        const a = a0 + (hash(i * 13 + s) - 0.5) * 1.1;
        x += Math.cos(a) * (0.22 + hash(i + s * 3) * 0.18); y += Math.sin(a) * (0.22 + hash(i * 5 + s) * 0.18);
        pts.push([x, y]);
      }
      this.cracks.push(pts);
    }
    this.target.grabbable = false; this.tool.grabbable = false;
    this.target.angle = this.target.targetAngle = 0;
  }
  private trigger(c: StepCtx) {
    if (this.swing >= 0 || this.done) return;
    const near = c.ptr.type === 'mouse' && c.ptr.seen ? Math.hypot(c.ptr.x - this.target.x, c.ptr.y - this.target.y) < this.target.r * 2.1 : true;
    this.swingValid = near;
    this.swing = 0;
    this.tRest = { x: this.tool.x, y: this.tool.y };
  }
  down(c: StepCtx) { this.trigger(c); }
  key(k: 'primary' | 'interact' | 'rotate', c: StepCtx) { if (k !== 'rotate') { this.swingValid = true; this.swing = this.swing < 0 && !this.done ? 0 : this.swing; this.tRest = { x: this.tool.x, y: this.tool.y }; void c; } }
  private impact(c: StepCtx) {
    const { tool, target } = this;
    const now = c.t;
    const gap = now - this.lastHit;
    const beatOk = this.beat > 0.62;
    let q = 0.8;
    if (this.lastHit < 0) q = 0.85;
    else if (gap < 0.16) q = 0.35;                 // mashing is weak
    else if (beatOk && gap < 0.9) q = 1.2;         // on the beat is strong
    this.lastHit = now;
    this.hitCount++;
    this.units += q;
    target.q = 0.22 + q * 0.1; tool.q = 0.14;
    const hard = tool.props.hard * 0.6 + target.props.hard * 0.4;
    c.fx.sound(tool.props.sound, { vol: 0.55 + q * 0.4, rate: 0.9 + Math.random() * 0.2 });
    if (target.props.sound !== tool.props.sound) c.fx.sound(target.props.sound, { vol: 0.35 });
    c.fx.shake(1.2 + q * 2.2);
    c.fx.burst(target.x, target.y, { n: 4 + Math.round(q * 4), color: target.props.dust === 'ochre' ? 'ochre' : 'bone2', speed: 70 + q * 60, life: 0.5, size: 2 });
    if (hard > 0.5) c.fx.spark(target.x, target.y, { n: 3 + Math.round(q * 4), color: tool.props.dust === 'spark' ? 'hot' : 'ochre', speed: 200 + q * 80 });
    if (q > 1) c.fx.ring(target.x, target.y, target.r * 1.5, { color: 'ochre', life: 0.35 });
    target.ox += (Math.random() - 0.5) * 6; target.oy += (Math.random() - 0.5) * 3;
    if (this.units >= this.need && !this.prepared) {
      this.prepared = true;
      this.endT = c.t + 0.28;
      target.q = 0.34;
      c.fx.burst(target.x, target.y, { n: 16, color: 'bone2', speed: 150, life: 0.7, size: 2.4 });
      c.fx.ring(target.x, target.y, target.r * 2, { color: 'ochre', life: 0.5 });
      c.fx.shake(4);
    }
  }
  update(dt: number, c: StepCtx) {
    const { tool, target } = this;
    this.beat = (this.beat + dt * 2.3) % 1;
    // rest pose: to the upper right of the target; follows the pointer a little when there is one
    const rx = target.x + target.r * 1.7, ry = target.y - target.r * 1.35;
    let hx = rx, hy = ry;
    if (c.ptr.seen && c.ptr.type !== 'touch') {
      hx = lerp(rx, clamp(c.ptr.x, target.x - target.r * 2.6, target.x + target.r * 2.6), 0.6);
      hy = lerp(ry, clamp(c.ptr.y, target.y - target.r * 2.3, target.y + target.r * 0.2) - target.r * 0.5, 0.5);
    }
    if (this.swing < 0) {
      tool.x += (hx - tool.x) * Math.min(1, dt * 12);
      tool.y += (hy - tool.y) * Math.min(1, dt * 12);
      tool.z = lerp(tool.z, 12, Math.min(1, dt * 10));
      tool.angle += (-0.5 - tool.angle) * Math.min(1, dt * 12); tool.targetAngle = tool.angle;
    } else {
      const prev = this.swing;
      this.swing = Math.min(1, this.swing + dt / 0.3);
      const s = this.swing;
      const gx = this.swingValid ? target.x : tool.x, gy = this.swingValid ? target.y - target.r * 0.2 : tool.y + target.r;
      if (s < 0.35) {                                     // wind up
        const k = smooth(s / 0.35);
        tool.x = lerp(this.tRest.x, this.tRest.x + target.r * 0.35, k);
        tool.y = lerp(this.tRest.y, this.tRest.y - target.r * 0.5, k);
        tool.angle = lerp(-0.5, -1.05, k);
      } else if (s < 0.58) {                               // the strike
        const k = (s - 0.35) / 0.23; const e = k * k;
        tool.x = lerp(this.tRest.x + target.r * 0.35, gx, e);
        tool.y = lerp(this.tRest.y - target.r * 0.5, gy, e);
        tool.angle = lerp(-1.05, 0.4, e);
      } else {                                             // recoil
        const k = smooth((s - 0.58) / 0.42);
        tool.x = lerp(gx, hx, k); tool.y = lerp(gy, hy, k);
        tool.angle = lerp(0.4, -0.5, k);
      }
      tool.targetAngle = tool.angle;
      if (prev < 0.58 && this.swing >= 0.58) {
        if (this.swingValid) this.impact(c);
        else { c.fx.sound('whoosh', { vol: 0.4 }); c.fail(0.15); }
      }
      if (this.swing >= 1) this.swing = -1;
    }
    this.progress = clamp(this.units / this.need);
    if (this.endT > 0 && c.t >= this.endT) this.finish();
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const { target } = this;
    // cracks spread as force accumulates
    const frac = clamp(this.units / this.need);
    const shown = Math.ceil(frac * this.cracks.length);
    g.save();
    g.strokeStyle = c.pal.bone; g.lineWidth = 1.2; g.lineCap = 'round'; g.globalAlpha = 0.75;
    for (let i = 0; i < shown; i++) {
      const pts = this.cracks[i];
      const part = i === shown - 1 ? (frac * this.cracks.length) % 1 || 1 : 1;
      g.beginPath();
      const last = Math.max(1, Math.round(pts.length * part));
      for (let k = 0; k < last; k++) {
        const x = target.x + pts[k][0] * target.r * 1.3, y = target.y + pts[k][1] * target.r * 1.3;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    if (!this.done) {
      // the beat: a ring closes on the target; strike as it lands
      const R = target.r * (1.95 - this.beat * 0.9);
      g.strokeStyle = this.beat > 0.62 ? c.pal.good : c.pal.ochre; g.lineWidth = 1.6; g.globalAlpha = 0.25 + this.beat * 0.6;
      g.beginPath(); g.arc(target.x, target.y, R, 0, TAU); g.stroke();
      g.globalAlpha = 0.28; g.setLineDash([3, 5]);
      g.beginPath(); g.arc(target.x, target.y, target.r * 1.05, 0, TAU); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 1;
    }
    if (!this.hitCount && !this.done) dashedCircle(g, target.x, target.y, target.r * 1.35, c.pal.ochre, c.t, 0.5);
  }
  cleanup(c: StepCtx) {
    this.tool.z = 0; this.tool.grabbable = true; this.target.grabbable = true;
    void c;
  }
  get prepDone() { return this.prepared; }
  get targetBody() { return this.target; }
}

export const contactSteps: StepDef[] = [
  { kind: 'touch', verb: 'Bring together', estimate: p => num(p.t, 0.5) + 0.4, create: p => new Touch(p) },
  { kind: 'impact', verb: 'Drop', estimate: () => 1.4, create: (p, c) => new Impact(p, c) },
  { kind: 'hold', verb: 'Hold', estimate: p => num(p.time, 1) + 0.6, create: (p, c) => new Hold(p, c) },
  { kind: 'strike', verb: 'Strike', estimate: p => num(p.hits, 3) * 0.6 + 0.8, create: (p, c) => new Strike(p, c) },
];
