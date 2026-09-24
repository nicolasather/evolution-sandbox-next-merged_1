import type { StepCtx, StepDef } from '../types';
import { Step, TAU, angDiff, arcRing, beacon, chevrons, clamp, dist, lerp, num, smooth, str } from './util';

/* ============================================================================
   MOTION STEPS — done with the hand's movement.
     grind    rub back and forth: dust, warmth, a fibre twisting
     shake    shake the pair hard
     stretch  pull one end away, hold it taut  (separate: pull until it parts)
     wrap     wind a cord round the joint
   Every one has a keyboard equivalent (Space) so none needs a pointer.
   ========================================================================== */

/* ── grind ─────────────────────────────────────────────────────────────── */

class Grind extends Step {
  readonly kind = 'grind' as const;
  private need: number;
  private dist = 0;
  private reversals = 0;
  private needRev: number;
  private lx = 0; private ly = 0;
  private dir = 0;
  private seg = 0;
  private variant: string;
  private heat: boolean;
  private moved = false;
  private slide = 0;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.need = num(p.amount, 300) * (0.75 + 0.25 * c.res) * (1 - c.assist * 0.3);
    this.needRev = Math.max(2, Math.round(this.need / 100));
    this.variant = str(p.variant, 'grind');
    this.heat = p.heat === true || this.variant === 'ember';
    c.a.x = c.cx - c.a.r * 0.15; c.b.x = c.cx + c.b.r * 0.15;
  }
  private add(d: number, dx: number, c: StepCtx) {
    this.dist += d; this.seg += d;
    const s = Math.sign(dx);
    if (s !== 0 && this.dir !== 0 && s !== this.dir && this.seg > 16) { this.reversals++; this.seg = 0; }
    if (s !== 0) this.dir = s;
    this.moved = true;
    if (!c.reduced && Math.random() < Math.min(1, d / 14)) {
      c.fx.burst(c.cx + (Math.random() - 0.5) * c.a.r, c.cy + c.a.r * 0.3, {
        n: 1, color: this.heat ? 'hot' : c.a.props.dust === 'ochre' ? 'ochre' : 'bone2', speed: 34, life: 0.5, size: 1.6, angle: -Math.PI / 2, spread: 2.2, gravity: 30,
      });
    }
  }
  move(c: StepCtx) {
    if (!c.ptr.down) return;
    if (dist(c.ptr.x, c.ptr.y, c.cx, c.cy) > c.a.r * 3.4) { this.lx = c.ptr.x; this.ly = c.ptr.y; return; }
    const dx = c.ptr.x - this.lx, dy = c.ptr.y - this.ly;
    const d = Math.hypot(dx, dy);
    if (d > 2) { this.add(d, this.variant === 'twist' ? dy : dx, c); this.lx = c.ptr.x; this.ly = c.ptr.y; }
  }
  down(c: StepCtx) { this.lx = c.ptr.x; this.ly = c.ptr.y; }
  key(k: 'primary' | 'interact' | 'rotate', c: StepCtx) {
    if (k === 'rotate') return;
    // each press is one stroke, alternating direction, so the reversals count too
    this.seg = 20; this.add(46, this.dir === 1 ? -1 : 1, c);
  }
  update(dt: number, c: StepCtx) {
    const { a, b } = c;
    const rev = (this.reversals + 1) / (this.needRev + 1);
    this.progress = Math.min(this.dist / this.need, rev) * (this.done ? 1 : 0.999);
    // the top piece slides with the hand; the other stays put
    const want = c.ptr.down ? clamp(c.ptr.x - c.cx, -a.r * 0.9, a.r * 0.9) : 0;
    this.slide += (want - this.slide) * Math.min(1, dt * 18);
    if (this.variant === 'twist') {
      a.angle += (c.ptr.down ? c.ptr.vy * 0.004 * dt * 60 : 0) * 0.3;
      a.targetAngle = a.angle; b.angle -= (c.ptr.down ? c.ptr.vy * 0.004 * dt * 60 : 0) * 0.3; b.targetAngle = b.angle;
      a.x += (c.cx - a.r * 0.35 - a.x) * Math.min(1, dt * 10); b.x += (c.cx + b.r * 0.35 - b.x) * Math.min(1, dt * 10);
    } else {
      a.x += (c.cx + this.slide - a.x) * Math.min(1, dt * 22);
      a.y += (c.cy - a.r * 0.35 - a.y) * Math.min(1, dt * 10);
      b.x += (c.cx - b.x) * Math.min(1, dt * 10); b.y += (c.cy + b.r * 0.2 - b.y) * Math.min(1, dt * 10);
    }
    if (c.ptr.down && c.ptr.speed > 60) c.fx.sound('scrape', { vol: 0.25, rate: 0.7 + Math.min(0.8, c.ptr.speed / 900) });
    if (this.heat) {
      const h = this.progress;
      a.heat = Math.max(a.heat, h * 0.85); b.heat = Math.max(b.heat, h * 0.85); a.glow = b.glow = h;
      if (!c.reduced && h > 0.25 && Math.random() < dt * (3 + h * 22)) {
        c.fx.burst(c.cx, c.cy + a.r * 0.2, { n: 1, color: 'hot', speed: 30 + h * 40, life: 0.8, size: 1.5 + h * 1.5, angle: -Math.PI / 2, spread: 0.8, gravity: -30 });
      }
    }
    if (this.dist >= this.need && this.reversals >= this.needRev && !this.done) {
      c.fx.ring(c.cx, c.cy, a.r * 1.8, { color: this.heat ? 'hot' : 'ochre' });
      c.fx.sound(this.heat ? 'crackle' : 'snap', { vol: 0.8 });
      c.fx.shake(1.5);
      this.finish();
    }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    if (this.done) return;
    const R = c.a.r * 1.9;
    arcRing(g, c.cx, c.cy, R, this.progress, this.heat ? c.pal.hot : c.pal.ochre, 2.4, c.pal.line3);
    if (!this.moved) {
      // an idle hint: the motion itself, drawn as travelling chevrons both ways
      const y = c.cy + (this.variant === 'twist' ? 0 : c.a.r * 1.5);
      const x0 = this.variant === 'twist' ? c.cx : c.cx - R, x1 = this.variant === 'twist' ? c.cx : c.cx + R;
      const yy0 = this.variant === 'twist' ? c.cy - R : y, yy1 = this.variant === 'twist' ? c.cy + R : y;
      chevrons(g, x0, yy0, x1, yy1, c.t, c.pal.ochre, 0.7);
      chevrons(g, x1, yy1, x0, yy0, c.t + 0.5, c.pal.ochre, 0.45);
      beacon(g, c.cx, c.cy, c.a.r * 1.1, c.t, c.pal.ochre, 0.4);
    }
  }
}

/* ── shake ─────────────────────────────────────────────────────────────── */

class Shake extends Step {
  readonly kind = 'shake' as const;
  private need: number;
  private energy = 0;
  private lx = 0; private ly = 0;
  private motes: { a: number; r: number; s: number }[] = [];
  private intensity = 0;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.need = 2600 * num(p.energy, 0.6) * (0.75 + 0.25 * c.res) * (1 - c.assist * 0.3);
    for (let i = 0; i < 9; i++) this.motes.push({ a: Math.random() * TAU, r: 0.3 + Math.random() * 0.8, s: 1 + Math.random() * 2 });
  }
  down(c: StepCtx) { this.lx = c.ptr.x; this.ly = c.ptr.y; }
  move(c: StepCtx) {
    if (!c.ptr.down) return;
    const d = Math.hypot(c.ptr.x - this.lx, c.ptr.y - this.ly);
    this.lx = c.ptr.x; this.ly = c.ptr.y;
    // only vigorous movement counts: a slow drag does not shake anything
    if (c.ptr.speed > 240) this.energy += d;
  }
  key(k: 'primary' | 'interact' | 'rotate') { if (k !== 'rotate') this.energy += this.need * 0.08; }
  update(dt: number, c: StepCtx) {
    const { a, b } = c;
    if (!c.ptr.down) this.energy = Math.max(0, this.energy - this.need * 0.03 * dt);
    this.progress = clamp(this.energy / this.need);
    this.intensity = lerp(this.intensity, c.ptr.down ? clamp(c.ptr.speed / 900) : 0, Math.min(1, dt * 10));
    const jx = (Math.random() - 0.5) * 14 * this.intensity, jy = (Math.random() - 0.5) * 9 * this.intensity;
    const follow = c.ptr.down ? clamp((c.ptr.x - c.cx) * 0.35, -a.r, a.r) : 0;
    a.x += (c.cx - a.r * 0.45 + follow - a.x) * Math.min(1, dt * 16); b.x += (c.cx + b.r * 0.45 + follow - b.x) * Math.min(1, dt * 16);
    a.y = c.cy; b.y = c.cy;
    a.ox = jx; a.oy = jy; b.ox = -jx; b.oy = -jy;
    a.angle += (Math.random() - 0.5) * 0.3 * this.intensity; a.targetAngle = a.angle;
    if (this.intensity > 0.3) c.fx.sound(a.props.sound === 'splash' || b.props.sound === 'splash' ? 'splash' : 'rustle', { vol: 0.2 + this.intensity * 0.3 });
    if (this.energy >= this.need && !this.done) {
      c.fx.ring(c.cx, c.cy, a.r * 1.8, { color: 'ochre' });
      c.fx.burst(c.cx, c.cy, { n: 12, color: 'bone2', speed: 130, life: 0.6 });
      c.fx.sound('chime', { vol: 0.6 });
      this.finish();
    }
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    if (this.done) return;
    const R = c.a.r * 1.9;
    arcRing(g, c.cx, c.cy, R, this.progress, c.pal.ochre, 2.4, c.pal.line3);
    // motes stirred up by the motion
    g.save();
    g.fillStyle = c.pal.bone2;
    for (const m of this.motes) {
      m.a += (0.6 + this.intensity * 9) * m.s * 0.016;
      const rr = R * m.r * (0.6 + this.intensity * 0.5);
      g.globalAlpha = 0.25 + this.intensity * 0.5;
      g.beginPath(); g.arc(c.cx + Math.cos(m.a) * rr, c.cy + Math.sin(m.a) * rr * 0.7, 1.6 + this.intensity * 1.2, 0, TAU); g.fill();
    }
    g.restore();
    if (this.energy < 1) chevrons(g, c.cx - R * 0.8, c.cy - R * 1.05, c.cx + R * 0.8, c.cy - R * 1.05, c.t * 2, c.pal.ochre, 0.7);
  }
  cleanup(c: StepCtx) { c.a.ox = c.a.oy = c.b.ox = c.b.oy = 0; }
}

/* ── stretch / separate ───────────────────────────────────────────────── */

class Stretch extends Step {
  readonly kind: 'stretch' | 'separate';
  private rest = 0;
  private max = 0;
  private cur = 0;
  private holdT = 0;
  private holdNeed: number;
  private dragging = false;
  private snapped = false;
  private lenP: number;
  constructor(kind: 'stretch' | 'separate', p: Record<string, unknown>, c: StepCtx) {
    super();
    this.kind = kind;
    this.lenP = num(p.len, 0.9);
    this.holdNeed = kind === 'stretch' ? 0.45 * (0.7 + 0.3 * c.res) : 0;
    this.rest = (c.a.r + c.b.r) * 0.9;
    this.max = this.rest + c.a.r * (2.2 + 2 * this.lenP) * (0.9 + 0.1 * c.res) * (1 - c.assist * 0.2);
    this.cur = this.rest;
    c.a.grabbable = false; c.b.grabbable = false;
  }
  down(c: StepCtx) {
    if (dist(c.ptr.x, c.ptr.y, c.a.x, c.a.y) < c.a.r * 1.6 || c.ptr.type === 'touch') this.dragging = true;
  }
  up() { this.dragging = false; }
  key(k: 'primary' | 'interact' | 'rotate') { if (k !== 'rotate') this.cur = Math.min(this.max, this.cur + (this.max - this.rest) * 0.12); }
  update(dt: number, c: StepCtx) {
    const { a, b } = c;
    const hold = c.ptr.down && this.dragging;
    if (this.snapped) { this.stepApart(dt, c); return; }
    if (hold) {
      const d = dist(c.ptr.x, c.ptr.y, b.x, b.y);
      // rubber-band: the further you pull the more it resists
      const over = Math.max(0, d - this.rest);
      const range = this.max - this.rest;
      const eff = this.rest + range * (1 - Math.exp(-over / (range * 0.75)));
      this.cur = lerp(this.cur, eff, Math.min(1, dt * 16));
    } else if (!c.keys.has(' ')) {
      this.cur = lerp(this.cur, this.rest, Math.min(1, dt * 7));    // springs back
    } else {
      this.cur = Math.min(this.max, this.cur + (this.max - this.rest) * dt * 0.9);
    }
    const tension = clamp((this.cur - this.rest) / (this.max - this.rest));
    // b is anchored at the centre of the work area; a is drawn out along the pull direction
    let ux = -1, uy = 0;
    if (hold) { const dx = c.ptr.x - b.x, dy = c.ptr.y - b.y, d = Math.hypot(dx, dy) || 1; ux = dx / d; uy = dy / d; }
    else { const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1; ux = dx / d; uy = dy / d; }
    const bx = c.cx + (this.max - this.rest) * 0.35 * -ux * 0 + b.r * 0.6;
    b.x += (bx - b.x) * Math.min(1, dt * 10); b.y += (c.cy - b.y) * Math.min(1, dt * 10);
    a.x = b.x + ux * this.cur; a.y = b.y + uy * this.cur;
    a.q = Math.max(a.q, tension * 0.08);
    // a stretched thing thins
    a.angle = Math.atan2(uy, ux) * 0; b.angle = 0;
    a.ox = (Math.random() - 0.5) * tension * tension * 3; b.ox = -a.ox;
    if (tension > 0.94) this.holdT += dt; else this.holdT = Math.max(0, this.holdT - dt * 2);
    this.progress = this.kind === 'stretch' ? clamp(Math.max(tension * 0.8, this.holdNeed ? this.holdT / this.holdNeed : 0)) : clamp(tension);
    if (tension > 0.3 && c.ptr.down) c.fx.sound('rustle', { vol: 0.12 + tension * 0.3, rate: 0.6 + tension * 0.8 });
    if (this.kind === 'stretch' && this.holdT >= this.holdNeed && !this.done) {
      c.fx.ring(a.x, a.y, a.r * 1.4, { color: 'ochre' });
      c.fx.sound('snap', { vol: 0.8 }); c.fx.shake(1);
      this.finish();
    } else if (this.kind === 'separate' && tension >= 0.985 && !this.snapped) {
      this.snapped = true;
      const s = 260;
      a.vx = ux * s; a.vy = uy * s; b.vx = -ux * s * 0.5; b.vy = -uy * s * 0.5;
      c.fx.burst((a.x + b.x) / 2, (a.y + b.y) / 2, { n: 12, color: 'bone2', speed: 120 });
      c.fx.sound('snap', { vol: 1 }); c.fx.shake(3);
      this.holdT = 0;
    }
  }
  private stepApart(dt: number, c: StepCtx) {
    const { a, b } = c;
    a.x += a.vx * dt; a.y += a.vy * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    a.vx *= 0.9; a.vy *= 0.9; b.vx *= 0.9; b.vy *= 0.9;
    this.holdT += dt;
    if (this.holdT > 0.35) this.finish();
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    if (this.done) return;
    const { a, b } = c;
    const tension = clamp((this.cur - this.rest) / (this.max - this.rest));
    g.save();
    g.strokeStyle = tension > 0.9 ? c.pal.good : tension > 0.5 ? c.pal.ochre : c.pal.bone2;
    g.lineCap = 'round';
    g.lineWidth = Math.max(1.2, 4 - tension * 2.8);
    g.globalAlpha = 0.9;
    const midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2;
    g.beginPath(); g.moveTo(b.x, b.y);
    const sag = (1 - tension) * 10;
    g.quadraticCurveTo(midx, midy + sag, a.x, a.y);
    g.stroke();
    // the far limit
    g.globalAlpha = 0.45; g.setLineDash([3, 6]); g.strokeStyle = c.pal.ochre; g.lineWidth = 1.2;
    const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
    const ex = b.x + (dx / d) * this.max, ey = b.y + (dy / d) * this.max;
    g.beginPath(); g.arc(ex, ey, a.r * 0.5, 0, TAU); g.stroke();
    g.restore();
    if (tension < 0.05) { chevrons(g, b.x + b.r, b.y, b.x + this.max * 0.9, b.y, c.t, c.pal.ochre, 0.7); beacon(g, a.x, a.y, a.r * 1.1, c.t, c.pal.ochre); }
    arcRing(g, b.x, b.y - b.r * 1.5, b.r * 0.55, this.kind === 'stretch' ? clamp(this.holdT / Math.max(0.01, this.holdNeed)) : 0, c.pal.good, 2.2, this.kind === 'stretch' ? c.pal.line3 : undefined);
  }
  cleanup(c: StepCtx) { c.a.grabbable = true; c.b.grabbable = true; c.a.ox = c.b.ox = 0; }
}

/* ── wrap ──────────────────────────────────────────────────────────────── */

class Wrap extends Step {
  readonly kind = 'wrap' as const;
  private turns: number;
  private acc = 0;
  private last = NaN;
  private started = false;
  private endAng = -Math.PI / 2;
  private axis = 0;
  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.turns = Math.max(1, Math.round(num(p.turns, 2) * (0.8 + 0.2 * c.res) * (1 - c.assist * 0.2)));
    // the joint: wherever the two now lie, they are laid across each other at the middle
    c.a.x += (c.cx - c.a.x) * 0.5; c.b.x += (c.cx - c.b.x) * 0.5;
    this.axis = Math.atan2(c.a.y - c.b.y, c.a.x - c.b.x);
    c.a.grabbable = false; c.b.grabbable = false;
  }
  down(c: StepCtx) { this.last = Math.atan2(c.ptr.y - c.cy, c.ptr.x - c.cx); }
  move(c: StepCtx) {
    if (!c.ptr.down) return;
    const r = dist(c.ptr.x, c.ptr.y, c.cx, c.cy);
    const inner = c.a.r * 0.35, outer = c.a.r * 3.2;
    if (r < inner || r > outer) { this.last = NaN; return; }
    const ang = Math.atan2(c.ptr.y - c.cy, c.ptr.x - c.cx);
    if (!Number.isNaN(this.last)) {
      const d = angDiff(ang, this.last);
      if (Math.abs(d) < 1.3) {
        this.acc += Math.abs(d);
        if (!this.started) this.started = true;
        c.fx.sound('rustle', { vol: 0.14 + Math.min(0.2, Math.abs(d) * 2), rate: 0.9 });
      }
    }
    this.last = ang; this.endAng = ang;
  }
  key(k: 'primary' | 'interact' | 'rotate') { if (k !== 'rotate') { this.acc += 0.9; this.started = true; this.endAng += 0.9; } }
  update(dt: number, c: StepCtx) {
    this.progress = clamp(this.acc / (TAU * this.turns));
    c.a.q = Math.max(c.a.q, this.progress * 0.05);
    if (this.progress >= 1 && !this.done) {
      c.fx.ring(c.cx, c.cy, c.a.r * 1.6, { color: 'ochre' });
      c.fx.sound('snap', { vol: 0.7 });
      this.finish();
    }
    void dt;
  }
  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const R = c.a.r;
    const p = this.progress;
    // the coil: bands laid across the joint, one for each slice of progress
    const n = Math.round(p * 13);
    g.save();
    g.translate(c.cx, c.cy);
    g.rotate(this.axis + Math.PI / 2);
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const y = (i - 6) * 3.1;
      g.strokeStyle = i % 2 ? c.pal.bone2 : c.pal.bone;
      g.globalAlpha = 0.95;
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(-R * 0.62, y - 1.5);
      g.quadraticCurveTo(0, y + 3, R * 0.62, y - 1.5);
      g.stroke();
    }
    g.restore();
    if (this.done) return;
    // the free end follows the hand round the joint
    if (this.started || c.ptr.down) {
      const ex = c.cx + Math.cos(this.endAng) * R * 1.55, ey = c.cy + Math.sin(this.endAng) * R * 1.55;
      g.strokeStyle = c.pal.bone; g.lineWidth = 2; g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(c.cx + Math.cos(this.endAng) * R * 0.4, c.cy + Math.sin(this.endAng) * R * 0.4); g.lineTo(ex, ey); g.stroke();
    }
    arcRing(g, c.cx, c.cy, R * 1.85, p, c.pal.ochre, 2.4, c.pal.line3);
    if (!this.started) {
      // the way round: a dashed orbit with a moving mark
      const a = c.t * 2.2;
      g.strokeStyle = c.pal.ochre; g.globalAlpha = 0.5; g.lineWidth = 1.3; g.setLineDash([4, 7]); g.lineDashOffset = -c.t * 20;
      g.beginPath(); g.arc(c.cx, c.cy, R * 1.55, 0, TAU); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1; g.fillStyle = c.pal.ochre;
      g.beginPath(); g.arc(c.cx + Math.cos(a) * R * 1.55, c.cy + Math.sin(a) * R * 1.55, 4, 0, TAU); g.fill();
    }
  }
  cleanup(c: StepCtx) { c.a.grabbable = true; c.b.grabbable = true; }
}

export const motionSteps: StepDef[] = [
  { kind: 'grind', verb: 'Rub', estimate: p => Math.min(3.6, num(p.amount, 300) / 150 + 0.8), create: (p, c) => new Grind(p, c) },
  { kind: 'shake', verb: 'Shake', estimate: p => 1.2 + num(p.energy, 0.6) * 2, create: (p, c) => new Shake(p, c) },
  { kind: 'stretch', verb: 'Pull', estimate: p => 1.6 + num(p.len, 0.9) * 0.6, create: (p, c) => new Stretch('stretch', p, c) },
  { kind: 'separate', verb: 'Pull apart', estimate: () => 1.4, create: (p, c) => new Stretch('separate', p, c) },
  { kind: 'wrap', verb: 'Wrap', estimate: p => num(p.turns, 2) * 0.9 + 0.8, create: (p, c) => new Wrap(p, c) },
];

void smooth;
