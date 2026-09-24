/* ============================================================================
   INTRO FX — the canvas behind the landing page and the time-tunnel.

   One canvas, one rAF loop, four moods:

     idle      irregular dust that drifts, leans away from the cursor and
               brightens near it; a very faint lens around the pointer
     collapse  the dust spirals into a single point that becomes a ring: the
               time hole (. ○ ◎ ◉)
     tunnel    three depth layers of streaks racing from the centre outward,
               slow → medium → fast → very fast, with historical objects
               flying through the camera
     slow/still everything decelerates to a stop

   Plain canvas 2D, transform-free per-particle maths, no DOM particles, no
   allocation in the frame loop. Particle counts follow the quality tier.
   ========================================================================== */

import { PARTICLE_SCALE, type Quality } from '../perf';
import type { Sprite, TunnelObject } from './objects';

export type FxMode = 'idle' | 'collapse' | 'tunnel' | 'slow' | 'still';

interface Dust { x: number; y: number; vx: number; vy: number; w: number; h: number; a: number; ph: number; d: number; ox: number; oy: number; glow: number; rot: number }
interface Warp { ang: number; cos: number; sin: number; r: number; layer: 0 | 1 | 2; warm: boolean }
interface Fly {
  sprite: HTMLCanvasElement | null; label: string; date: string; t0: number; life: number;
  ang: number; size: number; near: boolean; far: boolean; spin: number; base: number;
}

/** A soft out-of-focus light in the walls of the tunnel — the blurred environment. */
interface Bokeh { ang: number; cos: number; sin: number; r: number; size: number; a: number; warm: boolean; v: number }

export interface IntroFxOptions { quality: Quality; lite: boolean }

const BONE = '233,229,221';
const OCHRE = '196,100,44';
const LAYER_SPEED = [0.55, 1.1, 2.4] as const;
const LAYER_WIDTH = [0.8, 1.3, 2.1] as const;
const LAYER_ALPHA = [0.42, 0.62, 0.9] as const;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const easeIn3 = (t: number) => t * t * t;
const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);

export class IntroFx {
  private readonly cv: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly quality: Quality;
  private readonly lite: boolean;
  w = 0; h = 0; dpr = 1;
  mode: FxMode = 'idle';
  /** ms since the current mode began. */
  private t = 0;
  private clock = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  private dust: Dust[] = [];
  private warp: Warp[] = [];
  private bokeh: Bokeh[] = [];
  private disc: HTMLCanvasElement | null = null;
  private flies: Fly[] = [];
  private mx = 0; private my = 0; private sx = 0; private sy = 0;
  private hasPointer = false;
  private att: { x: number; y: number; s: number } | null = null;
  private attS = 0;
  private vignette: HTMLCanvasElement | null = null;
  private speed = 0;
  private modeMs = 0;
  private holeR = 0;
  private fade = 1;
  private frozenSpeed = 0;
  private rings: number[] = [0, 0.13, 0.27, 0.41, 0.55, 0.68, 0.82, 0.93];
  /** Fires when collapse, tunnel or slow finish on their own. */
  onModeEnd: ((m: FxMode) => void) | null = null;
  private sprites: Map<string, Sprite> | null = null;

  constructor(cv: HTMLCanvasElement, o: IntroFxOptions) {
    this.cv = cv;
    const g = cv.getContext('2d', { alpha: true });
    if (!g) throw new Error('2d canvas unavailable');
    this.g = g;
    this.quality = o.quality;
    this.lite = o.lite;
    this.resize();
  }

  /* ── setup ───────────────────────────────────────────────────────── */

  setSprites(s: Map<string, Sprite>) { this.sprites = s; }

  resize() {
    const cap = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
    this.dpr = Math.min(cap, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth || window.innerWidth;
    const h = this.cv.clientHeight || window.innerHeight;
    this.w = w; this.h = h;
    this.cv.width = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
    this.holeR = Math.min(w, h) * 0.05;
    this.buildVignette();
    const want = Math.round(clamp((w * h) / 9000, 36, 230) * PARTICLE_SCALE[this.quality]);
    if (this.dust.length !== want) this.seedDust(want);
  }

  private seedDust(n: number) {
    this.dust = [];
    for (let i = 0; i < n; i++) {
      const big = Math.random() < 0.08;
      const w = big ? 1.6 + Math.random() * 1.4 : 0.5 + Math.random() * 1.1;
      this.dust.push({
        x: Math.random() * this.w, y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.12 - 0.02,
        w, h: w * (0.55 + Math.random() * 0.9),
        a: 0.12 + Math.random() * 0.34, ph: 0.4 + Math.random() * 1.6,
        d: 0.25 + Math.random() * 0.75, ox: 0, oy: 0, glow: 0, rot: Math.random() * Math.PI,
      });
    }
  }

  private buildVignette() {
    const v = document.createElement('canvas');
    v.width = 256; v.height = 256;
    const g = v.getContext('2d');
    if (!g) { this.vignette = null; return; }
    const gr = g.createRadialGradient(128, 128, 30, 128, 128, 182);
    gr.addColorStop(0, 'rgba(6,6,7,0)');
    gr.addColorStop(0.55, 'rgba(6,6,7,0.35)');
    gr.addColorStop(1, 'rgba(6,6,7,0.96)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    this.vignette = v;
  }

  /* ── control ─────────────────────────────────────────────────────── */

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  destroy() { this.stop(); this.onModeEnd = null; this.sprites = null; }

  pointer(x: number, y: number) {
    if (!this.hasPointer) { this.sx = x; this.sy = y; }
    this.hasPointer = true; this.mx = x; this.my = y;
  }
  leave() { this.hasPointer = false; }
  attract(x: number, y: number, s: number) { this.att = { x, y, s }; }
  release() { this.att = null; }

  collapse(ms: number) { this.setMode('collapse', ms); this.att = null; }

  /** Begin the tunnel. `objects` are scheduled across `ms`; lifetimes scale with the length. */
  tunnel(ms: number, objects: TunnelObject[]) {
    this.setMode('tunnel', ms);
    const scale = ms / 3600;
    this.flies = [];
    // history passes beside the viewer: pieces alternate left and right of the
    // axis, at varied heights, so each one sweeps past rather than straight at the lens
    objects.forEach((o, i) => {
      const sp = this.sprites?.get(o.id);
      const side = i % 2 ? 0 : Math.PI;
      const lift = ((i * 37) % 5 - 2) * 0.16;
      const ang = side + (side === 0 ? -lift : lift) + (i % 3 - 1) * 0.12;
      this.flies.push({
        sprite: sp?.canvas ?? null, label: sp?.name.toUpperCase() ?? '', date: sp?.date ?? '',
        t0: o.at * ms, life: Math.max(160, o.life * scale), ang,
        size: o.size * (this.w < 700 ? 0.7 : 1), near: !!o.near, far: !!o.far,
        spin: (i % 2 ? 1 : -1) * (0.35 + (i % 4) * 0.25), base: (i * 0.7) % 0.6 - 0.3,
      });
    });
    const n = Math.round(clamp((this.w * this.h) / 2600, 160, 640) * PARTICLE_SCALE[this.quality]);
    this.warp = [];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const q = Math.random();
      this.warp.push({
        ang, cos: Math.cos(ang), sin: Math.sin(ang), r: Math.random() * 0.3,
        layer: q < 0.5 ? 0 : q < 0.82 ? 1 : 2, warm: Math.random() < 0.08,
      });
    }
    // out-of-focus lights racing past the walls: depth without detail
    const nb = this.lite || this.quality === 'low' ? 0 : Math.round(20 * PARTICLE_SCALE[this.quality] + 6);
    this.bokeh = [];
    this.ensureDisc();
    for (let i = 0; i < nb; i++) {
      const ang = Math.random() * Math.PI * 2;
      this.bokeh.push({
        ang, cos: Math.cos(ang), sin: Math.sin(ang), r: Math.random(),
        size: 28 + Math.random() * 90, a: 0.05 + Math.random() * 0.09, warm: Math.random() < 0.3, v: 0.6 + Math.random() * 0.9,
      });
    }
  }

  private ensureDisc() {
    if (this.disc) return;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    if (!g) return;
    const gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    this.disc = c;
  }

  slow(ms: number) { this.frozenSpeed = this.speed; this.setMode('slow', ms); }
  still() { this.setMode('still', 0); }
  /** Fade the whole canvas to nothing over `ms`. */
  fadeOut(ms: number) {
    const from = performance.now();
    const step = () => {
      const k = clamp((performance.now() - from) / ms, 0, 1);
      this.fade = 1 - k;
      if (k < 1 && this.running) requestAnimationFrame(step);
    };
    step();
  }
  reset() { this.fade = 1; this.flies = []; this.warp = []; this.bokeh = []; this.setMode('idle', 0); }

  private setMode(m: FxMode, ms: number) { this.mode = m; this.t = 0; this.modeMs = ms; }

  /* ── loop ────────────────────────────────────────────────────────── */

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) { this.last = now; return; }
    const dt = clamp(now - this.last, 0, 50);
    this.last = now;
    this.clock += dt;
    this.t += dt;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.globalAlpha = this.fade;
    if (this.hasPointer) { this.sx += (this.mx - this.sx) * 0.12; this.sy += (this.my - this.sy) * 0.12; }
    this.attS += ((this.att ? 1 : 0) - this.attS) * 0.08;

    switch (this.mode) {
      case 'idle': this.drawDust(dt, 0); break;
      case 'collapse': this.drawCollapse(dt); break;
      case 'tunnel': this.drawTunnel(dt); break;
      case 'slow': this.drawSlow(dt); break;
      case 'still': this.drawWarp(0, 0.6); this.drawHole(1); break;
    }
    g.globalAlpha = 1;
  };

  /* ── idle dust ───────────────────────────────────────────────────── */

  private drawDust(dt: number, collapseK: number) {
    const g = this.g, w = this.w, h = this.h;
    const px = (this.sx - w / 2) / w, py = (this.sy - h / 2) / h;
    const cx = w / 2, cy = h / 2;
    const T = this.clock;
    const step = dt * 0.06;
    const R = 150;
    const rot = collapseK > 0 ? easeIn3(collapseK) * 2.6 : 0;
    const shrink = collapseK > 0 ? 1 - easeIn3(collapseK) * 0.98 : 1;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);

    for (const d of this.dust) {
      if (collapseK === 0) {
        d.x += (d.vx + Math.sin(T * 0.00031 * d.ph + d.ph * 6) * 0.05) * step * 16;
        d.y += (d.vy + Math.cos(T * 0.00027 * d.ph + d.ph * 3) * 0.04) * step * 16;
        if (d.x < -4) d.x = w + 4; else if (d.x > w + 4) d.x = -4;
        if (d.y < -4) d.y = h + 4; else if (d.y > h + 4) d.y = -4;
        // a small, delayed lean with the cursor: nearer dust moves more
        d.ox += (-px * 26 * d.d - d.ox) * 0.04;
        d.oy += (-py * 18 * d.d - d.oy) * 0.04;
      }
      let x = d.x + d.ox, y = d.y + d.oy;
      let boost = 0;
      if (collapseK === 0) {
        if (this.hasPointer) {
          const dx = x - this.sx, dy = y - this.sy;
          const dist = Math.hypot(dx, dy) + 0.001;
          if (dist < R) {
            const k = 1 - dist / R;
            const push = k * k * 24;
            x += (dx / dist) * push; y += (dy / dist) * push;
            d.glow = Math.max(d.glow, k * 0.85);
          }
        }
        if (this.att && this.attS > 0.02) {
          const dx = this.att.x - x, dy = this.att.y - y;
          const dist = Math.hypot(dx, dy) + 0.001;
          if (dist < 320) {
            const k = 1 - dist / 320;
            x += (dx / dist) * k * 12 * this.attS; y += (dy / dist) * k * 12 * this.attS;
            d.glow = Math.max(d.glow, k * 0.55 * this.attS);
          }
        }
        d.glow *= 0.93;
        boost = d.glow;
      } else {
        const dx = x - cx, dy = y - cy;
        x = cx + (dx * cosR - dy * sinR) * shrink;
        y = cy + (dx * sinR + dy * cosR) * shrink;
        boost = collapseK * 0.5;
      }
      const tw = 0.62 + 0.38 * Math.sin(T * 0.0009 * d.ph + d.ph * 9);
      const a = clamp(d.a * tw + boost * 0.55, 0, 0.95) * (collapseK > 0 ? 1 - collapseK * 0.55 : 1);
      g.fillStyle = `rgba(${BONE},${a.toFixed(3)})`;
      g.fillRect(x, y, d.w, d.h);
    }

    // a lens: barely there, only while the pointer is over the page
    if (collapseK === 0 && this.hasPointer && this.quality !== 'low') {
      const gr = g.createRadialGradient(this.sx, this.sy, 0, this.sx, this.sy, R * 1.1);
      gr.addColorStop(0, `rgba(${BONE},0.045)`);
      gr.addColorStop(0.6, `rgba(${BONE},0.012)`);
      gr.addColorStop(1, `rgba(${BONE},0)`);
      g.fillStyle = gr;
      g.fillRect(this.sx - R * 1.1, this.sy - R * 1.1, R * 2.2, R * 2.2);
    }
  }

  /* ── collapse ────────────────────────────────────────────────────── */

  private drawCollapse(dt: number) {
    const k = clamp(this.t / this.modeMs, 0, 1);
    this.drawDust(dt, k);
    this.drawSymbol(k);
    if (this.vignette) {
      this.g.globalAlpha = this.fade * k * 0.8;
      this.g.drawImage(this.vignette, 0, 0, this.w, this.h);
      this.g.globalAlpha = this.fade;
    }
    if (k >= 1) this.onModeEnd?.('collapse');
  }

  /** . → ○ → ◎ → ◉ */
  private drawSymbol(k: number) {
    const g = this.g, cx = this.w / 2, cy = this.h / 2;
    const s = Math.min(this.w, this.h) / 900 + 0.55;
    const ring = (r: number, a: number, lw = 1) => {
      g.strokeStyle = `rgba(${BONE},${a})`; g.lineWidth = lw;
      g.beginPath(); g.arc(cx, cy, r * s, 0, Math.PI * 2); g.stroke();
    };
    if (k > 0.12 && k <= 0.32) {
      g.fillStyle = `rgba(${BONE},0.9)`;
      g.beginPath(); g.arc(cx, cy, 1.7 * s, 0, Math.PI * 2); g.fill();
    } else if (k > 0.32 && k <= 0.55) {
      ring(7, 0.85);
    } else if (k > 0.55 && k <= 0.78) {
      ring(6, 0.9); ring(13, 0.6);
    } else if (k > 0.78) {
      const p = clamp((k - 0.78) / 0.22, 0, 1);
      g.fillStyle = `rgba(${BONE},${0.95 - p * 0.1})`;
      g.beginPath(); g.arc(cx, cy, 9 * s, 0, Math.PI * 2); g.fill();
      ring(18, 0.7); ring(28 + p * 6, 0.35);
    }
  }

  /* ── tunnel ──────────────────────────────────────────────────────── */

  private drawTunnel(dt: number) {
    const u = clamp(this.t / this.modeMs, 0, 1);
    // slow → medium → fast → very fast: the camera accelerates all the way in
    this.speed = 0.08 + 0.92 * Math.pow(u, 2.2);
    this.holeR = Math.min(this.w, this.h) * (0.05 + 0.02 * u);
    const g = this.g;
    g.save();
    // the camera leans a little as it picks up speed
    g.translate(this.w / 2, this.h / 2);
    g.rotate(Math.sin(u * 5.2) * 0.022 * u);
    g.translate(-this.w / 2, -this.h / 2);
    this.drawRings(dt, 1);
    this.drawBokeh(dt, 1);
    this.drawWarp(dt, 1);
    this.drawFlies(u);
    this.drawWarpNear(dt, 1);
    g.restore();
    this.drawHole(1);
    if (this.vignette) {
      this.g.globalAlpha = this.fade * (0.6 + 0.3 * u);
      this.g.drawImage(this.vignette, 0, 0, this.w, this.h);
      this.g.globalAlpha = this.fade;
    }
    if (u >= 1) this.onModeEnd?.('tunnel');
  }

  /** Soft discs drifting outward from the vanishing point, growing as they come. */
  private drawBokeh(dt: number, gain: number) {
    if (!this.bokeh.length || !this.disc) return;
    const g = this.g, cx = this.w / 2, cy = this.h / 2;
    const R = Math.hypot(this.w, this.h) / 2;
    const sec = dt / 1000, v = this.speed;
    for (const b of this.bokeh) {
      if (dt > 0) {
        b.r += v * b.v * sec * (0.08 + b.r * 1.1);
        if (b.r > 1.1) { b.r = 0.02; b.ang = Math.random() * Math.PI * 2; b.cos = Math.cos(b.ang); b.sin = Math.sin(b.ang); }
      }
      const rr = b.r * R * 0.95;
      if (rr < this.holeR * 1.1) continue;
      const size = b.size * (0.25 + b.r * 1.7);
      const a = b.a * clamp(b.r * 4, 0, 1) * clamp((1.1 - b.r) * 6, 0, 1) * (0.35 + 0.65 * v) * gain;
      if (a < 0.004) continue;
      g.globalAlpha = a * this.fade;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.disc, cx + b.cos * rr - size / 2, cy + b.sin * rr - size / 2, size, size);
      if (b.warm) { g.globalAlpha = a * 0.5 * this.fade; g.drawImage(this.disc, cx + b.cos * rr - size * 0.3, cy + b.sin * rr - size * 0.3, size * 0.6, size * 0.6); }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = this.fade;
  }

  private drawSlow(dt: number) {
    const k = clamp(this.t / this.modeMs, 0, 1);
    this.speed = this.frozenSpeed * (1 - easeOut3(k));
    this.drawRings(dt, 1 - k);
    this.drawBokeh(dt, 1 - k);
    this.drawWarp(dt, 1 - k * 0.25);
    this.drawWarpNear(dt, 1 - k * 0.25);
    this.drawHole(1 - k * 0.4);
    // objects vanish at once: they are not part of the stopped world
    if (this.vignette) {
      this.g.globalAlpha = this.fade * 0.9;
      this.g.drawImage(this.vignette, 0, 0, this.w, this.h);
      this.g.globalAlpha = this.fade;
    }
    if (k >= 1) this.onModeEnd?.('slow');
  }

  /** Faint rings racing outward — the walls of the tunnel. */
  private drawRings(dt: number, gain: number) {
    const g = this.g, cx = this.w / 2, cy = this.h / 2;
    const R = Math.hypot(this.w, this.h) / 2;
    const v = this.speed;
    for (let i = 0; i < this.rings.length; i++) {
      let ph = this.rings[i] + v * (dt / 1000) * 0.5 * (0.35 + this.rings[i]);
      if (ph > 1) ph -= 1;
      this.rings[i] = ph;
      const rr = this.holeR + Math.pow(ph, 2.1) * (R - this.holeR);
      const a = Math.sin(Math.PI * ph) * 0.2 * (0.25 + v) * gain;
      if (a < 0.004) continue;
      g.strokeStyle = `rgba(${BONE},${a.toFixed(3)})`;
      g.lineWidth = 0.6 + ph * 2.2;
      g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
    }
  }

  /** Layers 0 and 1 (drawn behind the flying objects). */
  private drawWarp(dt: number, gain: number) { this.strokeWarp(dt, gain, 0, 1); }
  /** Layer 2, the close streaks (drawn in front of them). */
  private drawWarpNear(dt: number, gain: number) { this.strokeWarp(dt, gain, 2, 2); }

  private strokeWarp(dt: number, gain: number, from: number, to: number) {
    const g = this.g, cx = this.w / 2, cy = this.h / 2;
    const R = Math.hypot(this.w, this.h) / 2;
    const sec = dt / 1000;
    const v = this.speed;
    g.lineCap = 'round';
    for (const p of this.warp) {
      if (p.layer < from || p.layer > to) continue;
      if (dt > 0) {
        p.r += v * LAYER_SPEED[p.layer] * sec * (0.10 + p.r * 1.6);
        if (p.r > 1.15) {
          p.r = Math.random() * 0.02; p.ang = Math.random() * Math.PI * 2;
          p.cos = Math.cos(p.ang); p.sin = Math.sin(p.ang);
        }
      }
      const rr = p.r * R;
      if (rr < this.holeR * 0.9) continue;
      const len = Math.min(rr - this.holeR * 0.8, v * LAYER_SPEED[p.layer] * (0.012 + p.r * 0.16) * R);
      const hx = cx + p.cos * rr, hy = cy + p.sin * rr;
      const tx = hx - p.cos * Math.max(len, 0.6), ty = hy - p.sin * Math.max(len, 0.6);
      const a = clamp(p.r * 5, 0, 1) * LAYER_ALPHA[p.layer] * (0.4 + 0.6 * Math.max(v, 0.15)) * gain;
      g.strokeStyle = `rgba(${p.warm ? OCHRE : BONE},${a.toFixed(3)})`;
      g.lineWidth = LAYER_WIDTH[p.layer] * (0.7 + p.r);
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
    }
  }

  private drawFlies(u: number) {
    const g = this.g, cx = this.w / 2, cy = this.h / 2;
    const R = Math.hypot(this.w, this.h) / 2;
    const T = this.t;
    const ghosts = this.lite || this.quality === 'low' ? 0 : this.quality === 'medium' ? 1 : 3;
    for (const f of this.flies) {
      const p = (T - f.t0) / f.life;
      if (p <= 0 || p >= 1 || !f.sprite) continue;
      const passes = ghosts && this.speed > 0.25 ? ghosts : 0;
      for (let i = passes; i >= 0; i--) {
        const q = p - i * 0.02 * (0.5 + this.speed);
        if (q <= 0) continue;
        const r = Math.pow(q, 1.8) * 0.85 * (f.far ? 0.55 : 1) * R;
        const ang = f.ang + q * 0.16 * (f.spin > 0 ? 1 : -1);
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        const size = f.size * (0.05 + (f.near ? 3.4 : f.far ? 0.9 : 1.7) * Math.pow(q, 2));
        const env = clamp(q / 0.12, 0, 1) * clamp((1 - q) / 0.18, 0, 1);
        const alpha = env * (f.far ? 0.5 : 0.92) * (i === 0 ? 1 : 0.3 / i) * (0.6 + 0.4 * Math.min(1, u * 2));
        if (alpha < 0.01 || size < 3) continue;
        g.save();
        g.translate(x, y);
        g.rotate(f.base + f.spin * q * 0.9);
        g.globalAlpha = alpha * this.fade;
        g.drawImage(f.sprite, -size / 2, -size / 2, size, size);
        g.restore();
        if (i === 0 && f.label && f.life >= 300 && size > 46) {
          g.globalAlpha = alpha * 0.55 * this.fade;
          g.fillStyle = `rgb(${BONE})`;
          g.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          g.textAlign = 'center';
          g.fillText(f.label.split('').join(' '), x, y + size / 2 + 16);
        }
      }
    }
    g.globalAlpha = this.fade;
  }

  /** The vanishing point: a dark disc with a bright rim. */
  private drawHole(gain: number) {
    const g = this.g, cx = this.w / 2, cy = this.h / 2, r = this.holeR;
    const gr = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
    gr.addColorStop(0, 'rgba(6,6,7,1)');
    gr.addColorStop(0.42, 'rgba(6,6,7,0.92)');
    gr.addColorStop(1, 'rgba(6,6,7,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, r * 2.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(${BONE},${(0.55 * gain).toFixed(3)})`;
    g.lineWidth = 1.2;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = `rgba(${BONE},${(0.16 * gain).toFixed(3)})`;
    g.beginPath(); g.arc(cx, cy, r * 1.45, 0, Math.PI * 2); g.stroke();
  }
}
