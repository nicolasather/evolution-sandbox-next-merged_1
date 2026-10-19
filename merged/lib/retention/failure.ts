/* ============================================================================
   FAILURE DIRECTOR (#11) — the bench is allowed a small joke, rarely.

   Most failed attempts are quiet (82 %). A few get a tiny gag (14 %), very few
   a notable one (3.5 %) and almost never a rare one (0.5 %). Each of the 32
   gags is its own drawn little scene — a different glyph, motion and sound —
   chosen to suit the materials on the bench. Rules that keep it kind:

     - only for a plain "that makes nothing" (never era / tier / region locks,
       never a message that carries information such as a near-hint);
     - never the same gag within the last 12; micro gags at least 8 s apart,
       noticeable ones capped at two per ten minutes, rare ones 20 min apart;
     - never while a discovery is being celebrated (shared arbiter);
     - cosmetic only: no fake-success particles, nothing changes in the game.
   ========================================================================== */
import type { Body, MaterialId } from '../craft/types';
import type { Fx } from '../craft/fx';
import { arbiter } from './bus';
import { G } from './glyphs';
import { billow, glyph, pieces, ripple, streaks, trace, TAU } from './vfx';
import catalogue from '../../data/retention/failure-effects.json';

export type Intensity = 'micro' | 'notable' | 'rare';
export interface GagDef { id: string; intensity: Intensity; appearance: string; context: string }
export const GAGS: readonly GagDef[] = (catalogue as Array<Record<string, string>>).map(e => ({
  id: e.id, intensity: e.intensity as Intensity, appearance: e.appearance, context: e.eligible_context,
}));

/** What the pieces on the bench make eligible. 'general' suits anything. */
export function contextsFor(materials: readonly MaterialId[]): Set<string> {
  const c = new Set<string>(['general']);
  for (const m of materials) {
    switch (m) {
      case 'stone': c.add('stone'); break;
      case 'wood': c.add('wood'); c.add('fishing'); break;
      case 'bone': c.add('bone'); c.add('organic'); break;
      case 'fibre': c.add('fibre'); c.add('paper'); break;
      case 'metal': c.add('metal'); break;
      case 'earth': c.add('clay'); c.add('ceramic'); break;
      case 'glass': c.add('glass'); break;
      case 'liquid': c.add('water'); c.add('ink'); break;
      case 'fire': c.add('fire'); c.add('heat'); break;
      case 'energy': c.add('heat'); c.add('fire'); break;
      case 'tool': c.add('tool'); break;
      case 'machine': c.add('wheel'); c.add('tool'); break;
      case 'structure': c.add('stone'); break;
      case 'signal': c.add('scribe'); c.add('ink'); c.add('paper'); break;
      case 'idea': c.add('scribe'); c.add('time'); break;
      case 'life': c.add('organic'); break;
    }
  }
  return c;
}

export interface FailHost {
  enabled(): boolean;
  reduced(): boolean;
  /** shiver every loose, un-held piece a little (cosmetic offsets only) */
  quake(bodies: readonly Body[]): void;
  /** nudge a piece's spin a few degrees (it springs back on its own) */
  shrug(b: Body): void;
}

const sfx = (fx: Fx, id: Parameters<Fx['sound']>[0], vol: number, rate = 1) => fx.sound(id, { vol, rate });

export class FailureDirector {
  private recent: string[] = [];
  private lastAt: Record<Intensity, number> = { micro: -1e9, notable: -1e9, rare: -1e9 };
  private noticeable: number[] = [];

  constructor(private fx: Fx, private host: FailHost, private random: () => number = Math.random) {}

  /**
   * Called once per plain failed attempt. Returns the gag played, or null (the common case).
   * `bodies` are the pieces that were put together; `all` is every piece on the bench.
   */
  attempt(bodies: readonly Body[], all: readonly Body[], now = performance.now()): string | null {
    if (!this.host.enabled() || this.host.reduced() || !bodies.length) return null;
    const roll = this.random() * 100;
    const intensity: Intensity | null = roll < 82 ? null : roll < 96 ? 'micro' : roll < 99.5 ? 'notable' : 'rare';
    if (!intensity) return null;
    const gap = intensity === 'micro' ? 8_000 : intensity === 'notable' ? 45_000 : 1_200_000;
    if (now - this.lastAt[intensity] < gap) return null;
    this.noticeable = this.noticeable.filter(t => now - t < 600_000);
    if (intensity !== 'micro' && this.noticeable.length >= 2) return null;
    if (!arbiter.canPlay('failure', now)) return null;
    const ctx = contextsFor(bodies.map(b => b.material));
    const pool = GAGS.filter(g => g.intensity === intensity && ctx.has(g.context) && !this.recent.includes(g.id));
    if (!pool.length) return null;
    const gag = pool[Math.floor(this.random() * pool.length)];
    if (!arbiter.request('failure', gag.intensity === 'micro' ? 1200 : 2400, now)) return null;
    this.lastAt[intensity] = now;
    if (intensity !== 'micro') this.noticeable.push(now);
    this.recent = [...this.recent, gag.id].slice(-12);
    const x = bodies.reduce((s, b) => s + b.x, 0) / bodies.length;
    const y = bodies.reduce((s, b) => s + b.y - b.z, 0) / bodies.length;
    const r = Math.max(18, bodies.reduce((s, b) => s + b.r, 0) / bodies.length);
    this.play(gag.id, x, y, r, bodies, all);
    return gag.id;
  }

  getRecent(): readonly string[] { return this.recent; }

  /** The explicit choreography of each gag: its own glyph, path, timing and sound. */
  play(id: string, x: number, y: number, r: number, bodies: readonly Body[], all: readonly Body[]) {
    const fx = this.fx;
    const b0 = bodies[0];
    switch (id) {
      /* ── micro ───────────────────────────────────────────────── */
      case 'dust-puff':
        billow(fx, x, y + r * 0.2, { color: 'bone3', r: r * 0.7, rise: 10, life: 0.9, n: 5 });
        pieces(fx, x, y, { shape: 'crumb', n: 5, speed: 22, spread: TAU, gravity: 60, life: 0.7, size: 2, color: 'bone3', drag: 2 });
        sfx(fx, 'puff', 0.22, 1.1); break;
      case 'woody-squeak':
        pieces(fx, x, y, { shape: 'splinter', n: 2, speed: 30, spread: 0.3, angle: Math.PI, life: 0.5, size: 3, color: 'ochre' });
        pieces(fx, x, y, { shape: 'splinter', n: 2, speed: 30, spread: 0.3, angle: 0, life: 0.5, size: 3, color: 'ochre' });
        ripple(fx, x, y, { rx: r * 1.1, ry: r * 0.5, color: 'ochre', life: 0.35, rings: 2, width: 0.7 });
        sfx(fx, 'click', 0.2, 2.6); window.setTimeout(() => sfx(fx, 'click', 0.16, 2.0), 110); break;
      case 'bone-rattle':
        for (let i = 0; i < 5; i++) pieces(fx, x - r + i * r * 0.5, y + (i % 2) * 4, { shape: 'tick', n: 1, speed: 14, spread: 0.4, angle: -Math.PI / 2, gravity: 240, life: 0.45, size: 5, color: 'bone', delay: i * 0.04, spin: 8 });
        for (let i = 0; i < 4; i++) window.setTimeout(() => sfx(fx, 'click', 0.12, 1.6 + (i % 2) * 0.4), i * 70); break;
      case 'fibre-knot': {
        const p: number[] = [];
        for (let i = 0; i <= 28; i++) { const t = i / 28 * TAU * 1.2; p.push(x + Math.cos(t) * r * 0.8 + Math.sin(t * 2) * r * 0.2, y + Math.sin(t * 1.5) * r * 0.55); }
        trace(fx, p, { color: 'ochre', life: 1.0, width: 1.1, hold: 0.45 });
        trace(fx, [x - r, y + r * 0.9, x - r * 0.3, y + r * 0.7, x + r, y + r * 0.95], { color: 'ochre', life: 0.8, width: 0.9, hold: 0.3 });
        sfx(fx, 'rustle', 0.18, 1); break;
      }
      case 'clay-face':
        glyph(fx, x, y - r * 0.2, { d: G.clay, size: 30, color: 'bone3', from: [0, 12], to: [0, 0], life: 0.9, hold: [0.25, 0.65] });
        sfx(fx, 'thud', 0.14, 0.8); break;
      case 'metal-ding':
        ripple(fx, x, y, { rx: r * 2.0, color: 'bone', life: 1.0, rings: 3, width: 0.9 });
        glyph(fx, x + r * 0.9, y - r * 0.9, { d: G.star, size: 9, color: 'bone', life: 0.5, rot0: 0, rot1: 1 });
        sfx(fx, 'ring', 0.22, 1.7); break;
      case 'water-plop':
        glyph(fx, x, y + r * 0.8, { d: G.bubble, size: 12, color: 'water', from: [0, 0], to: [0, -r * 0.9], life: 0.7, hold: [0.1, 0.8] });
        window.setTimeout(() => { pieces(fx, x, y - r * 0.1, { shape: 'drop', n: 4, speed: 40, spread: 1.8, angle: -Math.PI / 2, gravity: 300, life: 0.5, size: 2, color: 'water' }); ripple(fx, x, y + r * 0.8, { rx: r, ry: r * 0.3, color: 'water', life: 0.6 }); sfx(fx, 'plip', 0.22, 1.2); }, 560); break;
      case 'spark-sneeze':
        pieces(fx, x, y - r * 0.4, { shape: 'ember', n: 7, speed: 70, spread: 0.7, angle: -2.2, gravity: 90, life: 0.45, size: 2.4, color: 'hot', drag: 2 });
        streaks(fx, x, y - r * 0.4, { angle: -2.2, n: 3, len: 8, dist: 26, life: 0.3, color: 'ochre', width: 0.9 });
        sfx(fx, 'crackle', 0.2, 1.5); break;
      case 'tool-shrug':
        for (const b of bodies) if (b.material === 'tool' || b === b0) { this.host.shrug(b); break; }
        pieces(fx, x, y - r, { shape: 'arc', n: 2, speed: 0, life: 0.5, size: r * 0.7, color: 'bone', alpha: 0.6 });
        sfx(fx, 'click', 0.14, 0.9); break;
      case 'bench-blink':
        glyph(fx, x - r * 1.9, y + r * 1.1, { d: G.eye, size: 11, color: 'bone3', life: 0.6, hold: [0.15, 0.5] });
        glyph(fx, x + r * 1.9, y + r * 1.1, { d: G.eye, size: 11, color: 'bone3', life: 0.6, hold: [0.15, 0.5], delay: 0.05 });
        sfx(fx, 'tick', 0.1, 1.9); break;
      case 'scroll-nope':
        glyph(fx, x, y + r * 1.4, { d: G.scroll, size: 22, color: 'bone2', from: [0, 18], to: [0, -4], life: 1.2, hold: [0.25, 0.72] });
        trace(fx, [x - 7, y + r * 1.4 - 8, x + 7, y + r * 1.4 - 1, x - 7, y + r * 1.4 - 1, x + 7, y + r * 1.4 - 8], { color: 'ochre', life: 0.9, width: 1, hold: 0.5 });
        sfx(fx, 'rustle', 0.14, 1.3); break;
      case 'tiny-tumbleweed':
        glyph(fx, x - r * 2.6, y + r * 1.25, { d: G.tumbleweed, size: 10, color: 'ochre', to: [r * 5.2, 0], rot0: 0, rot1: 12, life: 1.8, hold: [0.1, 0.8] }); break;

      /* ── notable ─────────────────────────────────────────────── */
      case 'flint-bird':
        pieces(fx, x, y, { shape: 'ember', n: 6, speed: 50, spread: 1.0, angle: -Math.PI / 2, gravity: 160, life: 0.5, size: 2.2, color: 'hot' });
        glyph(fx, x, y - r * 0.4, { d: G.bird, size: 22, color: 'bone', from: [-r * 0.6, 4], to: [r * 0.2, -r * 1.2], life: 0.45, hold: [0.05, 0.9] });
        glyph(fx, x, y - r * 0.4, { d: G.bird, size: 22, color: 'bone', from: [r * 0.2, -r * 1.2], to: [r * 1.0, 6], life: 0.5, delay: 0.42, hold: [0.1, 0.6] });
        pieces(fx, x + r, y + 6, { shape: 'ember', n: 4, speed: 30, spread: TAU, life: 0.4, size: 2, color: 'ochre', delay: 0.85 });
        sfx(fx, 'clack', 0.2, 1.3); window.setTimeout(() => sfx(fx, 'tick', 0.14, 1.9), 880); break;
      case 'wooden-duck':
        glyph(fx, x, y, { d: G.duck, size: 34, color: 'ochre', s0: 0.2, s1: 1, rot0: 0, rot1: 0, wobble: 2, life: 1.3, hold: [0.2, 0.7] });
        ripple(fx, x, y + r * 0.6, { rx: r * 1.4, ry: r * 0.35, color: 'ochre', life: 0.9, rings: 2, width: 0.8 });
        sfx(fx, 'knock', 0.2, 1.5); window.setTimeout(() => sfx(fx, 'knock', 0.14, 1.9), 150); break;
      case 'clay-slump': {
        const lean: number[] = [x, y + r * 0.9, x + r * 0.05, y + r * 0.2, x + r * 0.3, y - r * 0.5, x + r * 0.7, y - r * 1.0];
        trace(fx, lean, { color: 'ochre', life: 0.8, width: 2.2, hold: 0.5 });
        pieces(fx, x + r * 0.7, y - r, { shape: 'crumb', n: 10, speed: 40, spread: 2.2, angle: Math.PI * 0.55, gravity: 320, life: 0.9, size: 3.2, color: 'ochre', delay: 0.5, drag: 1.4 });
        billow(fx, x + r * 0.3, y + r * 0.8, { color: 'ochre', r: r, rise: 6, life: 1.0, n: 5 });
        sfx(fx, 'thud', 0.22, 0.7); break;
      }
      case 'iron-magnet': {
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; trace(fx, [x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, x + Math.cos(a + 0.5) * r * 1.2, y + Math.sin(a + 0.5) * r * 1.2, x + Math.cos(a + 1.1) * r * 1.5, y + Math.sin(a + 1.1) * r * 1.5], { color: 'bone3', life: 0.9, width: 0.8, hold: 0.4 }); }
        glyph(fx, x, y, { d: G.filings, size: r * 2.6, color: 'bone', rot0: -0.6, rot1: 0.9, life: 1.1, hold: [0.15, 0.6] });
        sfx(fx, 'hum', 0.1, 1.2); break;
      }
      case 'missing-piece': {
        const s = r * 0.8, sx = x - s, sy = y - s;
        trace(fx, [sx, sy, sx + s * 2, sy, sx + s * 2, sy + s * 2, sx, sy + s * 2, sx, sy + s * 0.9], { color: 'bone2', life: 1.4, width: 1, hold: 0.55 });
        pieces(fx, x + s * 0.4, y + s * 0.4, { shape: 'cross', n: 1, speed: 0, life: 1.2, size: r * 0.5, color: 'ochre', delay: 0.5 });
        ripple(fx, x + s * 0.4, y + s * 0.4, { rx: r * 0.6, color: 'ochre', life: 0.8, rings: 2, delay: 0.5, width: 0.8 });
        sfx(fx, 'tick', 0.16, 0.9); break;
      }
      case 'paper-airplane':
        glyph(fx, x, y, { d: G.plane, size: 22, color: 'bone', from: [-r, r * 0.6], to: [r * 2.2, -r * 1.6], rot0: -0.2, rot1: -0.5, life: 0.9, hold: [0.08, 0.7] });
        glyph(fx, x, y, { d: G.plane, size: 22, color: 'bone', from: [r * 2.2, -r * 1.6], to: [-r * 0.2, r * 0.2], rot0: 2.6, rot1: 3.4, life: 0.9, delay: 0.85, hold: [0.1, 0.7] });
        streaks(fx, x, y, { angle: -0.5, n: 2, len: 10, dist: r * 2, life: 0.7, color: 'bone3', width: 0.7 });
        sfx(fx, 'whoosh', 0.14, 1.4); break;
      case 'whistling-pot':
        glyph(fx, x, y + r * 0.2, { d: G.pot, size: 28, color: 'ochre', life: 1.3, hold: [0.12, 0.75] });
        billow(fx, x, y - r * 0.7, { color: 'bone', r: 8, rise: 26, life: 1.1, n: 4, width: 0.8 });
        glyph(fx, x + r * 0.9, y - r * 1.1, { d: G.note, size: 12, color: 'ochre', to: [6, -10], life: 0.9, delay: 0.2 });
        sfx(fx, 'chime', 0.14, 2.2); break;
      case 'mini-earthquake':
        this.host.quake(all);
        ripple(fx, x, y + r * 0.9, { rx: r * 3.4, ry: r * 0.6, color: 'ochre', life: 0.9, rings: 3, width: 0.8 });
        sfx(fx, 'thud', 0.2, 0.55); break;
      case 'fish-flop':
        glyph(fx, x, y, { d: G.fish, size: 28, color: 'water', rot0: -0.5, rot1: 0.4, s0: 0.7, s1: 1, wobble: 1.5, life: 1.0, hold: [0.1, 0.7] });
        glyph(fx, x, y, { d: G.fish, size: 28, color: 'water', rot0: 0.4, rot1: -0.5, life: 0.6, delay: 0.5, hold: [0.1, 0.5], from: [0, -8], to: [0, 0] });
        ripple(fx, x, y + r * 0.7, { rx: r * 1.3, ry: r * 0.35, color: 'water', life: 0.8, rings: 2 });
        sfx(fx, 'splash', 0.2, 1.2); break;
      case 'misplaced-crown':
        glyph(fx, x, y - r * 1.2, { d: G.crown, size: 20, color: 'ochre', from: [0, -22], to: [0, 0], rot0: 0.2, rot1: -0.1, life: 0.5, hold: [0.05, 1] });
        glyph(fx, x, y - r * 1.2, { d: G.crown, size: 20, color: 'ochre', from: [0, 0], to: [r * 1.4, r * 0.9], rot0: -0.1, rot1: 0.9, life: 0.7, delay: 0.7, hold: [0.1, 0.45] });
        sfx(fx, 'chime', 0.12, 1.6); break;
      case 'microscope-eye':
        glyph(fx, x, y, { d: G.lens, size: 24, color: 'bone', s0: 0.3, s1: 1, life: 0.6, hold: [0.2, 0.9] });
        glyph(fx, x, y, { d: G.eye, size: 30, color: 'water', life: 0.9, delay: 0.55, hold: [0.2, 0.55] });
        ripple(fx, x, y, { rx: r * 1.5, color: 'water', life: 0.9, rings: 2, delay: 0.6, width: 0.7 });
        sfx(fx, 'tick', 0.14, 2.2); break;
      case 'stuck-wheel':
        glyph(fx, x, y + r * 0.1, { d: G.wheel, size: 30, color: 'bone', rot0: 0, rot1: -9, life: 1.3, hold: [0.1, 0.7], wobble: 0.6 });
        for (let i = 0; i < 3; i++) window.setTimeout(() => sfx(fx, 'tick', 0.12, 2.4 - i * 0.2), i * 260);
        pieces(fx, x + r * 0.9, y + r * 0.5, { shape: 'ember', n: 2, speed: 22, spread: 1, life: 0.3, size: 2, color: 'ochre', delay: 0.9 }); break;
      case 'hourglass-rewind':
        glyph(fx, x, y, { d: G.hourglass, size: 28, color: 'ochre', rot0: 0, rot1: Math.PI, life: 1.5, hold: [0.12, 0.8] });
        pieces(fx, x, y + 6, { shape: 'grain', n: 8, speed: 20, spread: 0.3, angle: -Math.PI / 2, gravity: -20, life: 0.9, size: 1.8, color: 'ochre', delay: 0.15 });
        sfx(fx, 'chime', 0.1, 0.8); break;
      case 'ant-parade':
        for (let i = 0; i < 3; i++) glyph(fx, x - r * 1.8, y + r * 1.1 + i * 3, { d: G.ant, size: 11 - i, color: 'bone2', to: [r * 3.6, i % 2 ? 2 : -2], wobble: 0.5, life: 2.0, delay: i * 0.35, hold: [0.1, 0.8] });
        break;
      case 'steam-shape':
        billow(fx, x, y - r * 0.4, { color: 'bone', r: 9, rise: 18, life: 1.2, n: 5, width: 0.8 });
        glyph(fx, x, y - r * 1.8, { d: G.qmark, size: 20, color: 'bone', s0: 0.5, s1: 1, life: 1.4, delay: 0.3, hold: [0.3, 0.6] });
        sfx(fx, 'hiss', 0.12, 1.2); break;
      case 'ink-oops':
        glyph(fx, x, y, { d: G.blot, size: 22, color: 'ink', to: [r * 2.4, r * 0.8], wobble: 0.8, life: 1.5, hold: [0.05, 0.7] });
        pieces(fx, x, y, { shape: 'drop', n: 5, speed: 12, spread: 0.6, angle: 0.3, gravity: 20, life: 1.1, size: 1.8, color: 'ink', delay: 0.1, drag: 1 });
        sfx(fx, 'plip', 0.14, 0.9); break;

      /* ── rare ────────────────────────────────────────────────── */
      case 'ancient-cat':
        glyph(fx, x + r * 1.1, y + r * 0.3, { d: G.paw, size: 20, color: 'bone', s0: 1.5, s1: 1, rot0: 0.3, rot1: 0.3, life: 1.4, hold: [0.12, 0.55] });
        ripple(fx, x + r * 1.1, y + r * 0.3, { rx: r * 0.9, color: 'bone3', life: 0.9, rings: 2, width: 0.7 });
        sfx(fx, 'puff', 0.14, 1.4); break;
      case 'stone-orchestra':
        for (let i = 0; i < 3; i++) {
          const px = x + (i - 1) * r * 1.6;
          for (let k = 0; k < 3; k++) ripple(fx, px, y + r * 0.7, { rx: r * 0.8, ry: r * 0.25, color: i === 1 ? 'ochre' : 'bone', life: 0.5, rings: 1, delay: 0.3 + k * 0.5 + i * 0.12, width: 0.9 });
        }
        trace(fx, [x - r * 0.7, y - r * 1.8, x - r * 0.1, y - r * 1.2, x + r * 0.1, y - r * 2.1, x + r * 0.7, y - r * 1.3, x - r * 0.4, y - r * 1.9, x + r * 0.3, y - r * 1.2], { color: 'ochre', life: 1.8, width: 1.1, hold: 0.3 }); break;
      case 'portal-socks':
        ripple(fx, x, y, { rx: r * 0.9, ry: r * 0.9, color: 'water', life: 1.2, rings: 3, width: 1.4 });
        glyph(fx, x, y, { d: G.sock, size: 22, color: 'bone', from: [0, -6], to: [r * 0.6, r * 1.3], rot0: 0.4, rot1: 1.2, life: 1.0, delay: 0.3, hold: [0.1, 0.6] });
        sfx(fx, 'whoosh', 0.12, 0.7); break;
      case 'cosmic-fish': {
        const pts: Array<[number, number]> = [[-1.8, 0], [-1, -0.7], [0.2, -0.9], [1.1, -0.4], [1.8, -0.9], [1.8, 0.9], [1.1, 0.4], [0.2, 0.9], [-1, 0.7]];
        const sc = r * 1.2;
        trace(fx, [...pts, pts[0]].flatMap(([a, b]) => [x + a * sc, y - r * 1.2 + b * sc * 0.6]), { color: 'water', life: 1.9, width: 0.7, hold: 0.35, dash: [2, 4] });
        pts.forEach(([a, b], i) => glyph(fx, x + a * sc, y - r * 1.2 + b * sc * 0.6, { d: G.star, size: 7, color: 'bone', life: 1.6, delay: i * 0.08, hold: [0.15, 0.7] }));
        break;
      }
    }
  }
}
