import type { Palette } from '@/lib/craft/types';
import { fit, hitRegion, toScreen, type Hit, type Par, type Region, type RegionKind } from './regions';

/* ============================================================================
   SCENEFX ENGINE — the scenery answering a click.

   A click on visible water makes a small splash and rings that widen across
   the water's own plane (squashed, clipped to the shore); on grass, a few
   seeds and blades lift off; on dry ground, a puff of dust and grit. Effects
   are anchored in the scene's own coordinates, so they stay glued to the
   picture while its layers drift with the mouse.

   Pure canvas 2D, pooled and capped: at most MAX_ACTIVE effects live at once,
   at most PER_KIND of each sort, and at most MAX_VOICES sounds at a time.
   The engine decides *what* to show and *whether* to sound; it never plays
   anything itself — the caller does, so tests can run it without audio.
   ========================================================================== */

export const MAX_ACTIVE = 5;
export const PER_KIND = 3;
export const MAX_VOICES = 2;
/** The same sort of click within this many ms and this many px is one gesture, not two. */
export const REPEAT_MS = 70;
export const REPEAT_PX = 36;

interface Part { dx: number; dy: number; vx: number; vy: number; g: number; life: number; size: number; rot: number; len: number; sway: number }
interface Ripple { delay: number; dur: number; reach: number }
export interface Effect {
  kind: RegionKind; u: number; v: number; depth: number; poly: Region['poly'];
  t: number; life: number; k: number; parts: Part[]; ripples: Ripple[]; born: number; cx: number; cy: number;
}

export interface SoundCue { kind: RegionKind; vol: number; rate: number; pan: number }
export interface ClickResult { hit: Hit; effect: Effect; sound: SoundCue | null }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.4);

export class SceneFxEngine {
  effects: Effect[] = [];
  reduced = false;
  /** End times (ms) of sounds still ringing — the voice cap reads this. */
  private voices: number[] = [];
  private lastClick: { kind: RegionKind; x: number; y: number; at: number } | null = null;
  private rnd: () => number;

  constructor(rnd: () => number = Math.random) { this.rnd = rnd; }

  get alive() { return this.effects.length > 0; }
  clear() { this.effects.length = 0; this.voices.length = 0; this.lastClick = null; }

  private r(lo: number, hi: number) { return lo + (hi - lo) * this.rnd(); }

  /** A click at a viewport point. Null if it is not on water, grass or dry ground, or is a repeat. */
  click(sceneId: string, cx: number, cy: number, vw: number, vh: number, par: Par, now: number): ClickResult | null {
    const hit = hitRegion(sceneId, cx, cy, vw, vh, par);
    if (!hit) return null;
    const prev = this.lastClick;
    if (prev && prev.kind === hit.kind && now - prev.at < REPEAT_MS && Math.hypot(prev.x - cx, prev.y - cy) < REPEAT_PX) return null;
    this.lastClick = { kind: hit.kind, x: cx, y: cy, at: now };

    // accumulation: per sort, then overall — the oldest gives way
    const same = this.effects.filter(e => e.kind === hit.kind);
    if (same.length >= PER_KIND) this.effects.splice(this.effects.indexOf(same[0]), 1);
    while (this.effects.length >= MAX_ACTIVE) this.effects.shift();

    const effect = this.make(hit, cx, cy, vh, now);
    this.effects.push(effect);
    return { hit, effect, sound: this.voice(hit, cx, vw, now) };
  }

  /** Decide whether this click may be heard; at most MAX_VOICES at once. */
  private voice(hit: Hit, cx: number, vw: number, now: number): SoundCue | null {
    this.voices = this.voices.filter(end => end > now);
    if (this.voices.length >= MAX_VOICES) return null;
    const ring = { water: 380, grass: 240, dust: 260 }[hit.kind];
    this.voices.push(now + ring);
    // no two clicks sound alike: pitch, loudness and stereo position all vary
    const rate = hit.kind === 'water' ? this.r(0.78, 1.35) : this.r(0.85, 1.2);
    const vol = clamp((hit.kind === 'water' ? 0.62 : 0.5) * this.r(0.75, 1.1) * (this.voices.length > 1 ? 0.75 : 1), 0.1, 1);
    return { kind: hit.kind, vol, rate, pan: clamp((cx / Math.max(1, vw) - 0.5) * 1.2, -0.7, 0.7) };
  }

  private make(hit: Hit, cx: number, cy: number, vh: number, now: number): Effect {
    // things nearer the bottom of the picture are nearer the viewer, so they are bigger
    const k = 0.65 + 0.7 * clamp(hit.v / 900, 0, 1);
    const e: Effect = { kind: hit.kind, u: hit.u, v: hit.v, depth: hit.region.depth, poly: hit.region.poly, t: 0, life: 1, k, parts: [], ripples: [], born: now, cx, cy };
    void vh;
    const calm = this.reduced;
    if (hit.kind === 'water') {
      e.life = calm ? 0.7 : 1.5;
      if (calm) e.ripples.push({ delay: 0, dur: 0.7, reach: 26 * k });
      else {
        const n = 3;
        for (let i = 0; i < n; i++) e.ripples.push({ delay: i * this.r(0.11, 0.17), dur: this.r(1.0, 1.3), reach: this.r(62, 100) * k * (1 - i * 0.12) });
        const drops = Math.round(this.r(7, 11));
        for (let i = 0; i < drops; i++) {
          const a = this.r(-1.05, 1.05);             // fan around straight up
          const sp = this.r(110, 250) * k;
          e.parts.push({ dx: 0, dy: 0, vx: Math.sin(a) * sp * 0.6, vy: -Math.cos(a) * sp, g: 640 * k, life: this.r(0.45, 0.8), size: this.r(1.1, 2.3) * k, rot: 0, len: 0, sway: 0 });
        }
      }
    } else if (hit.kind === 'grass') {
      e.life = calm ? 0.5 : 1.5;
      if (!calm) {
        const n = Math.round(this.r(6, 10));
        for (let i = 0; i < n; i++) {
          e.parts.push({
            dx: this.r(-16, 16) * k, dy: this.r(-4, 4), vx: this.r(-40, 40) * k, vy: -this.r(28, 90) * k, g: -this.r(4, 16),
            life: this.r(0.8, 1.4), size: this.r(5, 11) * k, rot: this.r(-1.2, 1.2), len: this.r(0.7, 1.3), sway: this.r(0, Math.PI * 2),
          });
        }
      }
    } else {
      e.life = calm ? 0.6 : 1.4;
      if (!calm) {
        const puffs = Math.round(this.r(5, 8));
        for (let i = 0; i < puffs; i++) {
          e.parts.push({
            dx: this.r(-14, 14) * k, dy: this.r(-3, 3), vx: this.r(-34, 34) * k, vy: -this.r(6, 26) * k, g: 0,
            life: this.r(0.7, 1.3), size: this.r(12, 26) * k, rot: 0, len: 1, sway: 0,
          });
        }
        const grit = Math.round(this.r(5, 9));
        for (let i = 0; i < grit; i++) {
          e.parts.push({
            dx: this.r(-8, 8) * k, dy: 0, vx: this.r(-90, 90) * k, vy: -this.r(50, 130) * k, g: 520 * k,
            life: this.r(0.35, 0.65), size: this.r(0.9, 1.7), rot: 0, len: 0, sway: 0,
          });
        }
      }
    }
    return e;
  }

  update(dt: number) {
    for (const e of this.effects) {
      e.t += dt;
      for (const p of e.parts) {
        p.vy += p.g * dt;
        p.dx += p.vx * dt; p.dy += p.vy * dt;
        p.vx *= 1 - Math.min(1, dt * (e.kind === 'dust' ? 1.6 : 0.4));
        if (e.kind === 'grass') p.sway += dt * 5;
      }
    }
    this.effects = this.effects.filter(e => e.t < e.life);
  }

  draw(g: CanvasRenderingContext2D, vw: number, vh: number, par: Par, pal: Palette, offX = 0, offY = 0) {
    if (!this.effects.length) return;
    const { s } = fit(vw, vh);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const e of this.effects) {
      const o = toScreen(e.u, e.v, vw, vh, par, e.depth);
      const x = o.x - offX, y = o.y - offY;
      if (e.kind === 'water') this.drawWater(g, e, x, y, s, vw, vh, par, pal, offX, offY);
      else if (e.kind === 'grass') this.drawGrass(g, e, x, y, s, pal);
      else this.drawDust(g, e, x, y, s, pal);
    }
    g.restore();
  }

  private drawWater(g: CanvasRenderingContext2D, e: Effect, x: number, y: number, s: number, vw: number, vh: number, par: Par, pal: Palette, offX: number, offY: number) {
    // rings live on the water only: clip to the shore, in the region's own layer
    g.save();
    g.beginPath();
    e.poly.forEach(([u, v], i) => {
      const p = toScreen(u, v, vw, vh, par, e.depth);
      if (i) g.lineTo(p.x - offX, p.y - offY); else g.moveTo(p.x - offX, p.y - offY);
    });
    g.closePath();
    g.clip();
    g.strokeStyle = pal.water;
    for (const rp of e.ripples) {
      const k = clamp((e.t - rp.delay) / rp.dur, 0, 1);
      if (k <= 0 || k >= 1) continue;
      const r = (this.reduced ? 1 : easeOut(k)) * rp.reach * s;
      const a = Math.pow(1 - k, 1.6);
      g.globalAlpha = 0.75 * a;
      g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(x, y, r, r * 0.34, 0, 0, Math.PI * 2); g.stroke();
      if (!this.reduced && r > 10) {                     // a fainter twin, like an etched double line
        g.globalAlpha = 0.32 * a;
        g.beginPath(); g.ellipse(x, y, r * 0.82, r * 0.34 * 0.82, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    // the splash's own base: a small flattened flash that closes quickly
    if (!this.reduced && e.t < 0.3) {
      const k = e.t / 0.3;
      g.globalAlpha = 0.5 * (1 - k);
      g.fillStyle = pal.water;
      g.beginPath(); g.ellipse(x, y, (5 + 10 * k) * s * e.k, (2 + 3.5 * k) * s * e.k, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // droplets fly free of the shore line
    g.fillStyle = pal.bone; g.strokeStyle = pal.bone;
    for (const p of e.parts) {
      const k = e.t / p.life;
      if (k >= 1) continue;
      g.globalAlpha = 0.85 * (1 - k * k);
      const px = x + p.dx, py = y + p.dy;
      if (p.vy < 0 && Math.abs(p.vy) > 60) {           // rising fast: a short streak
        g.lineWidth = p.size * 0.9;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - p.vx * 0.022, py - p.vy * 0.022); g.stroke();
      } else { g.beginPath(); g.ellipse(px, py, p.size, p.size * 1.15, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
  }

  private drawGrass(g: CanvasRenderingContext2D, e: Effect, x: number, y: number, s: number, pal: Palette) {
    g.strokeStyle = pal.bone2;
    if (this.reduced) {
      const k = e.t / e.life;
      g.globalAlpha = 0.6 * (1 - k); g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(x - 8 * s, y); g.quadraticCurveTo(x, y - 12 * s * (1 - k * 0.4), x + 8 * s, y); g.stroke();
      g.globalAlpha = 1;
      return;
    }
    for (const p of e.parts) {
      const k = e.t / p.life;
      if (k >= 1) continue;
      g.globalAlpha = 0.85 * Math.sin(Math.PI * Math.min(1, k * 1.05));
      g.lineWidth = 1.2;
      const px = x + p.dx + Math.sin(p.sway) * 4, py = y + p.dy;
      const ang = p.rot + Math.sin(p.sway * 0.8) * 0.5, L = p.size * p.len;
      const dx = Math.sin(ang) * L, dy = -Math.cos(ang) * L;
      g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + dy * 0.35 + dx * 0.4, py + dy * 0.6 - dx * 0.25, px + dx, py + dy); g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawDust(g: CanvasRenderingContext2D, e: Effect, x: number, y: number, s: number, pal: Palette) {
    if (this.reduced) {
      const k = e.t / e.life;
      g.globalAlpha = 0.28 * (1 - k); g.fillStyle = pal.bone3;
      g.beginPath(); g.ellipse(x, y, 18 * s * e.k, 6 * s * e.k, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      return;
    }
    for (const p of e.parts) {
      const k = e.t / p.life;
      if (k >= 1) continue;
      const px = x + p.dx, py = y + p.dy;
      if (p.g > 0) {                                     // grit: a speck that falls back
        g.globalAlpha = 0.8 * (1 - k); g.fillStyle = pal.bone2;
        g.beginPath(); g.arc(px, py, p.size, 0, Math.PI * 2); g.fill();
        continue;
      }
      const r = p.size * s * (0.5 + 1.4 * easeOut(k));   // a puff swells and thins out
      const a = 0.34 * Math.sin(Math.PI * Math.min(1, k * 1.1));
      if (a <= 0.004) continue;
      const grd = g.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, pal.bone3); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a; g.fillStyle = grd;
      g.beginPath(); g.ellipse(px, py, r, r * 0.62, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }
}
