import { play } from './audio';
import type { BurstOpts, FxApi, Palette, SoundId } from './types';

/* ============================================================================
   FX — particles, rings, camera shake, a soft flash. Canvas 2D, pooled and
   capped so a long session never grows. The Workbench owns one of these and
   steps it with the same clock as the physics.
   ========================================================================== */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  gravity: number; drag: number; streak: boolean;
}
interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string; width: number }

const MAX_PARTICLES = 420;

export class Fx implements FxApi {
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  shakeAmt = 0;
  flashAmt = 0;
  shakeX = 0;
  shakeY = 0;
  pal: Palette;
  reduced = false;
  private t = 0;

  constructor(pal: Palette) { this.pal = pal; }

  get alive() { return this.parts.length > 0 || this.rings.length > 0 || this.shakeAmt > 0.05 || this.flashAmt > 0.02; }

  private col(c: BurstOpts['color']): string {
    if (!c) return this.pal.bone;
    return (this.pal as unknown as Record<string, string>)[c as string] ?? (c as string);
  }

  burst(x: number, y: number, o: BurstOpts = {}) {
    if (this.reduced) return;
    const n = Math.min(o.n ?? 8, MAX_PARTICLES - this.parts.length);
    const color = this.col(o.color);
    const spread = o.spread ?? Math.PI * 2;
    const base = o.angle ?? 0;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const sp = (o.speed ?? 90) * (0.35 + Math.random() * 0.75);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: (o.life ?? 0.55) * (0.6 + Math.random() * 0.6),
        size: (o.size ?? 2.2) * (0.6 + Math.random() * 0.8), color,
        gravity: o.gravity ?? 0, drag: o.drag ?? 2.6, streak: false,
      });
    }
  }

  /** A few bright streaks: metal and stone on impact. */
  spark(x: number, y: number, o: BurstOpts = {}) {
    if (this.reduced) return;
    const n = Math.min(o.n ?? 6, MAX_PARTICLES - this.parts.length);
    const color = this.col(o.color ?? 'ochre');
    const spread = o.spread ?? Math.PI * 2;
    const base = o.angle ?? -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const sp = (o.speed ?? 220) * (0.4 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: (o.life ?? 0.35) * (0.6 + Math.random() * 0.6),
        size: (o.size ?? 1.4), color, gravity: o.gravity ?? 260, drag: o.drag ?? 1.2, streak: true,
      });
    }
  }

  ring(x: number, y: number, r: number, o: { color?: string; life?: number; width?: number } = {}) {
    if (this.reduced) return;
    if (this.rings.length > 24) this.rings.shift();
    this.rings.push({
      x, y, r0: r * 0.35, r1: r, life: 0, max: o.life ?? 0.55,
      color: this.col(o.color), width: o.width ?? 1.4,
    });
  }

  /** Drops flowing from one point to another: a pour. */
  stream(x0: number, y0: number, x1: number, y1: number, o: { color?: string; n?: number } = {}) {
    if (this.reduced) return;
    const n = Math.min(o.n ?? 2, MAX_PARTICLES - this.parts.length);
    const color = this.col(o.color ?? 'water');
    for (let i = 0; i < n; i++) {
      const t = 0.32 + Math.random() * 0.2;
      this.parts.push({
        x: x0 + (Math.random() - 0.5) * 3, y: y0,
        vx: (x1 - x0) / t + (Math.random() - 0.5) * 8, vy: (y1 - y0 - 0.5 * 420 * t * t) / t,
        life: 0, max: t + 0.05, size: 1.9 + Math.random() * 1.2, color, gravity: 420, drag: 0, streak: false,
      });
    }
  }

  shake(amount: number) { this.shakeAmt = Math.min(9, Math.max(this.shakeAmt, amount)); }
  flash(amount: number) { this.flashAmt = Math.min(1, Math.max(this.flashAmt, amount)); }
  sound(id: SoundId, o?: { vol?: number; rate?: number; pan?: number }) { play(id, o); }

  update(dt: number) {
    this.t += dt;
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    const rs = this.rings;
    for (let i = rs.length - 1; i >= 0; i--) {
      rs[i].life += dt;
      if (rs[i].life >= rs[i].max) rs.splice(i, 1);
    }
    this.shakeAmt *= Math.exp(-9 * dt);
    if (this.shakeAmt < 0.04) this.shakeAmt = 0;
    this.flashAmt *= Math.exp(-4.5 * dt);
    if (this.reduced) { this.shakeX = this.shakeY = 0; return; }
    this.shakeX = (Math.sin(this.t * 71) + Math.sin(this.t * 43.7)) * 0.5 * this.shakeAmt;
    this.shakeY = (Math.cos(this.t * 63) + Math.sin(this.t * 51.3)) * 0.5 * this.shakeAmt;
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number) {
    for (const r of this.rings) {
      const k = r.life / r.max;
      const e = 1 - (1 - k) * (1 - k);
      g.globalAlpha = (1 - k) * 0.85;
      g.strokeStyle = r.color;
      g.lineWidth = r.width;
      g.beginPath();
      g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of this.parts) {
      const k = p.life / p.max;
      g.globalAlpha = Math.max(0, 1 - k * k);
      if (p.streak) {
        g.strokeStyle = p.color;
        g.lineWidth = p.size;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        g.stroke();
      } else {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
        g.fill();
      }
    }
    if (this.flashAmt > 0.02) {
      const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, this.pal.bone);
      grad.addColorStop(1, 'transparent');
      g.globalAlpha = this.flashAmt * 0.22;
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 1;
  }

  clear() { this.parts.length = 0; this.rings.length = 0; this.shakeAmt = 0; this.flashAmt = 0; }
}

/** Resolve the design system's colours for canvas drawing, in whichever theme is live. */
export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  const light = document.documentElement.dataset.theme === 'light';
  return {
    bone: v('--bone', '#e9e5dd'),
    bone2: v('--bone-2', '#a6a199'),
    bone3: v('--bone-3', '#86817a'),
    line: v('--line-2', 'rgba(255,255,255,.2)'),
    line3: v('--line-3', 'rgba(255,255,255,.36)'),
    ochre: v('--ochre', '#c8763a'),
    ink: v('--ink-1', '#0f1011'),
    good: light ? '#4b7a48' : '#8fbf88',
    hot: light ? '#c0491c' : '#ff9a55',
    water: light ? '#2f6f9f' : '#7db8e0',
  };
}
