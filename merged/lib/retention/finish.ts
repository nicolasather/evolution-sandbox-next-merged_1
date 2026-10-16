/* ============================================================================
   CRAFT FINISH (#13 + the "effect" shop category)

   48 success effects, six for each of eight material families. They are
   different drawings, not one ring in 48 colours: a crack web that breaks into
   shards, a braid of three strands, a woven weft, a gear pair, a prism fan, a
   droplet crown, a jittering arc, an ink flourish, pixel tracers on a circuit…
   One of them is chosen deterministically from the discovery's id, so the same
   thing always finishes the same way, and a new discovery is richer than a
   known one (known results play none — see Workbench.finishWith).

   On top of that, the player's equipped "effect" cosmetic (30 of them in the
   shop) adds its own small signature flourish. All of it is vector sprites on
   the Workbench's Fx canvas; it never changes what was made and never adds a
   second sound.
   ========================================================================== */
import type { MaterialId } from '../craft/types';
import type { Fx } from '../craft/fx';
import { G } from './glyphs';
import { TAU, billow, glyph, hash, mulberry, pieces, ripple, streaks, trace, easeOut, fade, palColor } from './vfx';
import presets from '../../data/retention/craft-fx-presets.json';

export type Family = 'stone' | 'wood' | 'metal' | 'earth' | 'glass' | 'liquid' | 'fire' | 'signal';
export interface SuccessFxDef { id: string; family: Family; name: string; description: string }
export const SUCCESS_FX: readonly SuccessFxDef[] = presets as unknown as SuccessFxDef[];

export function familyOf(m: MaterialId): Family {
  switch (m) {
    case 'stone': case 'bone': case 'structure': return 'stone';
    case 'wood': case 'fibre': case 'life': return 'wood';
    case 'metal': case 'tool': case 'machine': return 'metal';
    case 'earth': return 'earth';
    case 'glass': return 'glass';
    case 'liquid': return 'liquid';
    case 'fire': case 'energy': return 'fire';
    default: return 'signal';
  }
}

export function selectSuccess(nodeId: string, era: string, material: MaterialId): SuccessFxDef {
  const fam = familyOf(material);
  const list = SUCCESS_FX.filter(s => s.family === fam);
  return list[hash(`${nodeId}|${era}`) % list.length];
}

type PalKey = Parameters<typeof palColor>[1];
const custom = (fx: Fx, life: number, fn: (g: CanvasRenderingContext2D, k: number, pal: Parameters<typeof palColor>[0]) => void) => fx.addSprite(life, fn);
const C = (pal: Parameters<typeof palColor>[0], c: PalKey) => palColor(pal, c);

function poly(g: CanvasRenderingContext2D, pts: number[], close = false) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
  g.stroke();
}

/** Play one of the 48. `s` scales size and count (rarity); never louder than one soft tick. */
export function playSuccess(fx: Fx, id: string, x: number, y: number, s = 1) {
  if (fx.reduced) return;
  const R = 34 * s;
  const rnd = mulberry(hash(id) ^ ((x * 7 + y * 13) | 0));
  switch (id) {
    /* ── stone ───────────────────────────────────────────────── */
    case 'stone-fracture': {
      const arms: number[][] = [];
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + rnd() * 0.4; const m = R * (0.6 + rnd() * 0.5); arms.push([x, y, x + Math.cos(a) * m * 0.5 + (rnd() - 0.5) * 6, y + Math.sin(a) * m * 0.5 + (rnd() - 0.5) * 6, x + Math.cos(a + 0.12) * m, y + Math.sin(a + 0.12) * m]); }
      arms.forEach(p => trace(fx, p, { color: 'bone2', life: 0.9, width: 1, hold: 0.3 }));
      pieces(fx, x, y, { shape: 'shard', n: 10, speed: 110 * s, spread: TAU, gravity: 320, life: 0.8, size: 3.4, color: 'bone', delay: 0.28, spin: 8, drag: 1.2 }); break;
    }
    case 'stone-reassemble':
      pieces(fx, x, y, { shape: 'chip', n: 9, speed: -120 * s, spread: TAU, ring: R * 1.4, life: 0.5, size: 3.4, color: 'bone', drag: 2, spin: 4 });
      ripple(fx, x, y, { rx: R * 0.7, color: 'ochre', life: 0.5, delay: 0.42, rings: 1, width: 1.2 }); break;
    case 'stone-flake-strike':
      streaks(fx, x - R, y - R * 0.6, { angle: 0.55, n: 1, len: R * 0.9, dist: R * 2, life: 0.35, color: 'bone', width: 1.6 });
      pieces(fx, x, y, { shape: 'flake', n: 6, speed: 90 * s, spread: 0.9, angle: -0.9, gravity: 220, life: 0.65, size: 4, color: 'bone', delay: 0.18, spin: 10 }); break;
    case 'stone-chalk-halo':
      pieces(fx, x, y, { shape: 'crumb', n: 14, speed: 24, spread: TAU, ring: R * 0.9, gravity: -10, life: 1.1, size: 2, color: 'bone3', drag: 1, alpha: 0.7 });
      billow(fx, x, y, { color: 'bone3', r: R * 0.8, rise: 8, life: 1.1, n: 6 }); break;
    case 'stone-cairn': {
      const sizes = [11, 8, 5];
      sizes.forEach((sz, i) => custom(fx, 1.4, (g, k, pal) => {
        const t = Math.max(0, (k * 1.4 - i * 0.28) / 0.3); if (t <= 0) return;
        const drop = (1 - easeOut(Math.min(1, t))) * 26, yy = y + R * 0.5 - i * 9 - drop;
        g.globalAlpha = fade(k, 0.05, 0.7); g.strokeStyle = C(pal, 'bone'); g.lineWidth = 1.2;
        poly(g, [x - sz, yy, x - sz * 0.6, yy - 7, x + sz * 0.7, yy - 7.5, x + sz, yy], true);
      }));
      break;
    }
    case 'stone-strata':
      for (let i = 0; i < 6; i++) trace(fx, [x - R, y - R * 0.5 + i * R * 0.22, x - R * 0.2 + rnd() * 8, y - R * 0.5 + i * R * 0.22 + 2, x + R * (0.6 + rnd() * 0.4), y - R * 0.5 + i * R * 0.22], { color: i % 2 ? 'bone3' : 'bone2', life: 0.9 + i * 0.05, width: 1, hold: 0.45 });
      break;

    /* ── wood / fibre / bone / life ──────────────────────────── */
    case 'wood-growth-rings':
      ripple(fx, x, y, { rx: R * 1.2, ry: R * 0.9, color: 'ochre', life: 1.0, rings: 4, width: 0.9, rot: -0.3 });
      streaks(fx, x - R * 0.2, y, { angle: 0.0, n: 3, len: R * 0.8, gap: 6, dist: R, life: 0.8, color: 'bone3', width: 0.7 }); break;
    case 'wood-splinter-fan':
      pieces(fx, x, y, { shape: 'splinter', n: 9, speed: 100 * s, spread: 1.7, angle: -Math.PI / 2, gravity: 140, life: 0.7, size: 4, color: 'ochre', along: true, drag: 1.4 }); break;
    case 'fibre-braid': {
      for (let s2 = 0; s2 < 3; s2++) {
        const p: number[] = [];
        for (let i = 0; i <= 24; i++) { const t = i / 24; p.push(x - R + t * R * 2, y + Math.sin(t * TAU * 1.5 + s2 * TAU / 3) * R * 0.22 * (1 - t * 0.35)); }
        trace(fx, p, { color: s2 === 1 ? 'bone' : 'ochre', life: 1.1, width: 1.2, hold: 0.45 });
      }
      break;
    }
    case 'cloth-weave': {
      const n = 6, step = R * 0.3, x0 = x - step * n / 2, y0 = y - step * n / 2;
      custom(fx, 1.5, (g, k, pal) => {
        g.strokeStyle = C(pal, 'ochre'); g.lineWidth = 1; g.globalAlpha = fade(k, 0.05, 0.7);
        for (let i = 0; i <= n; i++) { const c = Math.min(1, Math.max(0, (k * 1.5 - i * 0.06) / 0.4)); g.beginPath(); g.moveTo(x0 + i * step, y0); g.lineTo(x0 + i * step, y0 + step * n * c); g.stroke(); }
        g.strokeStyle = C(pal, 'bone');
        for (let j = 0; j <= n; j++) { const c = Math.min(1, Math.max(0, (k * 1.5 - 0.5 - j * 0.07) / 0.35)); if (c <= 0) continue; g.beginPath(); for (let i = 0; i < n * c * 6; i++) { const px = x0 + i * step / 6, wv = Math.floor(i / 6 + j) % 2 ? 1.6 : -1.6; if (i === 0) g.moveTo(px, y0 + j * step + wv); else g.lineTo(px, y0 + j * step + (Math.floor(i / 6 + j) % 2 ? 1.6 : -1.6)); } g.stroke(); }
      });
      break;
    }
    case 'leaf-unfurl':
      glyph(fx, x, y, { d: G.sprout, size: R * 1.1, color: 'good', s0: 0.2, s1: 1, from: [0, 10], to: [0, -4], life: 1.3, hold: [0.2, 0.7] });
      pieces(fx, x, y - R * 0.3, { shape: 'leaf', n: 3, speed: 28, spread: 1.4, angle: -Math.PI / 2, gravity: 30, life: 1.0, size: 4, color: 'good', delay: 0.35, spin: 3, drag: 1.4 }); break;
    case 'bone-tally':
      for (let i = 0; i < 5; i++) {
        const tx = x - R * 0.7 + i * R * 0.34;
        trace(fx, [tx, y - R * 0.5, tx, y + R * 0.3], { color: 'bone', life: 0.9, width: 1.4, hold: 0.6 });
        if (i === 4) trace(fx, [x - R * 0.85, y + R * 0.1, x + R * 0.75, y - R * 0.3], { color: 'ochre', life: 0.9, width: 1.4, hold: 0.6 });
      }
      break;

    /* ── metal / tool / machine ──────────────────────────────── */
    case 'metal-spark-shower':
      pieces(fx, x, y, { shape: 'tick', n: 16, speed: 180 * s, spread: 2.4, angle: -Math.PI / 2, gravity: 360, life: 0.6, size: 4, color: 'ochre', along: true, drag: 0.8 });
      pieces(fx, x, y, { shape: 'star', n: 4, speed: 90, spread: TAU, life: 0.4, size: 3, color: 'bone', drag: 2 }); break;
    case 'metal-ring-chime':
      ripple(fx, x, y, { rx: R * 1.3, color: 'bone', life: 1.0, rings: 2, width: 1.3 });
      custom(fx, 1.0, (g, k, pal) => { const rr = R * 1.3 * easeOut(k), a = k * TAU * 1.5; g.strokeStyle = C(pal, 'ochre'); g.lineWidth = 2; g.globalAlpha = 1 - k; g.beginPath(); g.arc(x, y, Math.max(1, rr), a, a + 0.7); g.stroke(); }); break;
    case 'forge-glow-line':
      custom(fx, 1.1, (g, k, pal) => {
        const hx = x - R + k * R * 2; g.lineWidth = 1.6;
        g.strokeStyle = C(pal, 'hot'); g.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4; g.beginPath(); g.moveTo(hx, y - R * 0.5); g.lineTo(hx, y + R * 0.5); g.stroke();
        g.strokeStyle = C(pal, 'ochre'); g.lineWidth = 0.8; g.globalAlpha = (1 - k) * 0.7;
        for (let i = 0; i < 6; i++) { const lx = hx - (i + 1) * 5; g.beginPath(); g.moveTo(lx, y - R * 0.4 + i * 3); g.lineTo(lx + 2.5, y - R * 0.4 + i * 3 + 7 * k); g.stroke(); }
      }); break;
    case 'gear-mesh':
      glyph(fx, x - R * 0.42, y, { d: G.gearwheel, size: R * 0.9, color: 'bone', rot0: 0, rot1: 1.6, life: 1.2, hold: [0.12, 0.7] });
      glyph(fx, x + R * 0.42, y + 1, { d: G.gearwheel, size: R * 0.9, color: 'ochre', rot0: 0.2, rot1: -1.4, life: 1.2, hold: [0.12, 0.7] }); break;
    case 'anvil-strike':
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.9;
        streaks(fx, x, y, { angle: a, n: 3, len: R * 0.6, gap: 4, dist: R * 1.4, life: 0.3, color: i === 1 ? 'bone' : 'ochre', width: 1.3 });
      }
      ripple(fx, x, y, { rx: R * 1.1, color: 'bone', life: 0.5, rings: 1, width: 1.6, delay: 0.1 }); break;
    case 'bolt-tighten':
      custom(fx, 1.2, (g, k, pal) => {
        const rr = R * (0.9 - 0.35 * easeOut(Math.min(1, k * 1.6))), a = k * 3.2; g.strokeStyle = C(pal, 'bone'); g.lineWidth = 1.4; g.globalAlpha = fade(k, 0.05, 0.65);
        const pts: number[] = []; for (let i = 0; i < 6; i++) pts.push(x + Math.cos(a + i * TAU / 6) * rr, y + Math.sin(a + i * TAU / 6) * rr);
        poly(g, pts, true); g.beginPath(); g.arc(x, y, rr * 0.35, 0, TAU); g.stroke();
      }); break;

    /* ── earth ───────────────────────────────────────────────── */
    case 'soot-plume': {
      const p: number[] = []; for (let i = 0; i <= 20; i++) { const t = i / 20; p.push(x + Math.sin(t * 7) * R * 0.3 * t, y - t * R * 1.6); }
      trace(fx, p, { color: 'ink', life: 1.4, width: 2.4, hold: 0.35 });
      billow(fx, x, y - R * 0.8, { color: 'bone3', r: R * 0.6, rise: 20, life: 1.3, n: 5 }); break;
    }
    case 'kiln-glow':
      for (let i = 0; i < 4; i++) ripple(fx, x, y + R * 0.5, { rx: R * (0.5 + i * 0.28), ry: R * (0.8 + i * 0.3), color: i < 2 ? 'hot' : 'ochre', life: 1.0 + i * 0.05, rings: 1, width: 1.1, delay: i * 0.1 });
      for (let i = 0; i < 4; i++) streaks(fx, x - R * 0.5 + i * R * 0.33, y + R * 0.4, { angle: -Math.PI / 2, n: 1, len: 10, dist: 26, life: 0.9, color: 'bone3', width: 0.7 });
      break;
    case 'clay-wheel': {
      const prof = [0.35, 0.5, 0.6, 0.5, 0.4, 0.55, 0.7];
      prof.forEach((w, i) => ripple(fx, x, y + R * 0.6 - i * R * 0.2, { rx: R * w, ry: R * w * 0.28, color: 'ochre', life: 0.7, rings: 1, width: 1, delay: i * 0.11 }));
      break;
    }
    case 'dust-settle':
      pieces(fx, x, y - R * 1.0, { shape: 'crumb', n: 14, speed: 6, spread: 0.6, angle: Math.PI / 2, gravity: 40, life: 1.3, size: 1.8, color: 'bone3', alpha: 0.7, drag: 1.4 }); break;
    case 'brick-course': {
      for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) {
        const bx = x - R * 0.7 + i * R * 0.5 + (row % 2) * R * 0.25, by = y + R * 0.3 - row * R * 0.22;
        custom(fx, 1.3, (g, k, pal) => { const t = Math.max(0, (k * 1.3 - (row * 3 + i) * 0.1) / 0.25); if (t <= 0) return; const dy = (1 - easeOut(Math.min(1, t))) * 18; g.strokeStyle = C(pal, 'ochre'); g.lineWidth = 1.1; g.globalAlpha = fade(k, 0.05, 0.7); g.strokeRect(bx - R * 0.22, by - R * 0.09 - dy, R * 0.44, R * 0.18); });
      }
      break;
    }
    case 'ash-drift':
      pieces(fx, x - R * 0.6, y, { shape: 'flake', n: 10, speed: 40, spread: 0.7, angle: -0.3, gravity: 20, life: 1.2, size: 2.4, color: 'bone3', alpha: 0.7, drag: 0.7, spin: 3 }); break;

    /* ── glass ───────────────────────────────────────────────── */
    case 'glass-caustic':
      custom(fx, 1.4, (g, k, pal) => {
        g.strokeStyle = C(pal, 'water'); g.lineWidth = 0.8; g.globalAlpha = fade(k, 0.15, 0.55) * 0.9;
        for (let j = 0; j < 5; j++) { g.beginPath(); for (let i = 0; i <= 28; i++) { const t = i / 28, px = x - R + t * R * 2, py = y - R * 0.5 + j * R * 0.25 + Math.sin(t * 9 + k * 7 + j * 1.3) * 4 + Math.sin(t * 4 - k * 5 + j) * 3; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
      }); break;
    case 'prism-split':
      trace(fx, [x - R * 1.2, y - R * 0.3, x - R * 0.15, y - R * 0.05], { color: 'bone', life: 0.9, width: 1.3, hold: 0.7 });
      glyph(fx, x, y, { d: 'M0 -6L6 5L-6 5Z', size: R * 0.5, color: 'bone', life: 1.0, hold: [0.1, 0.8] });
      for (let i = 0; i < 5; i++) streaks(fx, x + 4, y + 1, { angle: -0.5 + i * 0.28, n: 1, len: R * 0.8, dist: R * 1.5, life: 0.8, color: i % 2 ? 'water' : 'bone', width: 1, owner: 0 });
      break;
    case 'glass-reform':
      pieces(fx, x, y, { shape: 'prism', n: 8, speed: 130 * s, spread: TAU, life: 0.55, size: 3, color: 'water', drag: 2.2, spin: 6 });
      ripple(fx, x, y, { rx: R * 0.9, color: 'bone', life: 0.7, delay: 0.4, rings: 1, width: 1.3 }); break;
    case 'lens-focus':
      for (let i = 0; i < 5; i++) { const a = -0.7 + i * 0.35; custom(fx, 0.9, (g, k, pal) => { g.strokeStyle = C(pal, 'water'); g.lineWidth = 0.8; g.globalAlpha = (1 - k) * 0.9; const e = easeOut(Math.min(1, k * 1.5)); g.beginPath(); g.moveTo(x - R * 1.2, y + Math.sin(a) * R * 0.9); g.lineTo(x - R * 1.2 + (R * 1.2) * e, y + Math.sin(a) * R * 0.9 * (1 - e)); g.stroke(); }); }
      glyph(fx, x, y, { d: G.star, size: R * 0.5, color: 'bone', s0: 0.2, s1: 1, life: 0.8, delay: 0.3, hold: [0.2, 0.5] }); break;
    case 'frost-bloom':
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const b1x = x + Math.cos(a) * R * 0.5, b1y = y + Math.sin(a) * R * 0.5; trace(fx, [x, y, b1x, b1y, x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.9], { color: 'water', life: 1.2, width: 1, hold: 0.4 }); trace(fx, [b1x, b1y, b1x + Math.cos(a + 0.8) * R * 0.3, b1y + Math.sin(a + 0.8) * R * 0.3], { color: 'bone', life: 1.2, width: 0.8, hold: 0.4 }); trace(fx, [b1x, b1y, b1x + Math.cos(a - 0.8) * R * 0.3, b1y + Math.sin(a - 0.8) * R * 0.3], { color: 'bone', life: 1.2, width: 0.8, hold: 0.4 }); }
      break;
    case 'bubble-rise':
      for (let i = 0; i < 4; i++) glyph(fx, x - R * 0.4 + i * R * 0.28, y + R * 0.4, { d: G.bubble, size: 6 + i * 3.5, color: 'water', to: [(i - 1.5) * 4, -R * (0.8 + i * 0.25)], life: 1.2, delay: i * 0.18, hold: [0.1, 0.65] });
      break;

    /* ── liquid ──────────────────────────────────────────────── */
    case 'ripple-trio':
      for (let i = 0; i < 3; i++) ripple(fx, x + (i - 1) * R * 0.7, y + (i % 2) * 5, { rx: R * 0.8, ry: R * 0.3, color: 'water', life: 0.8, rings: 2, width: 0.9, delay: i * 0.22 });
      break;
    case 'pour-arc':
      pieces(fx, x - R * 0.8, y - R * 0.8, { shape: 'drop', n: 14, speed: 120, spread: 0.12, angle: -0.2, gravity: 360, life: 0.9, size: 2, color: 'water', drag: 0.2 });
      ripple(fx, x + R * 0.4, y + R * 0.5, { rx: R, ry: R * 0.28, color: 'water', life: 0.9, rings: 3, delay: 0.45, width: 0.9 }); break;
    case 'wave-lines':
      custom(fx, 1.3, (g, k, pal) => {
        g.strokeStyle = C(pal, 'water'); g.lineWidth = 1; g.globalAlpha = fade(k, 0.1, 0.55);
        for (let j = 0; j < 4; j++) { g.beginPath(); const e = Math.min(1, k * 1.6); for (let i = 0; i <= 30; i++) { const t = i / 30; if (t > e) break; const px = x - R + t * R * 2, py = y - R * 0.4 + j * R * 0.28 + Math.sin(t * 8 + j * 1.5 - k * 4) * 4; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
      }); break;
    case 'droplet-crown':
      ripple(fx, x, y + R * 0.3, { rx: R * 0.9, ry: R * 0.25, color: 'water', life: 0.7, rings: 2, width: 1 });
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28; pieces(fx, x + Math.sin(a + Math.PI / 2) * R * 0.5, y + R * 0.2, { shape: 'drop', n: 1, speed: 100, spread: 0.1, angle: a, gravity: 330, life: 0.8, size: 2.4 - Math.abs(i - 4) * 0.15, color: 'water', drag: 0.4 }); }
      break;
    case 'eddy-swirl': {
      const p: number[] = []; for (let i = 0; i <= 34; i++) { const t = i / 34, a = t * TAU * 2.1, r = R * (1 - t * 0.85); p.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55); }
      trace(fx, p, { color: 'water', life: 1.2, width: 1.2, hold: 0.45 }); break;
    }
    case 'rain-curtain':
      for (let i = 0; i < 9; i++) { const rx = x - R * 0.9 + i * R * 0.22 + rnd() * 6; streaks(fx, rx, y - R * 1.4, { angle: Math.PI / 2 + 0.12, n: 1, len: 12, dist: R * 1.6, life: 0.5 + rnd() * 0.2, color: 'water', width: 0.8 }); ripple(fx, rx + 5, y + R * 0.3, { rx: 7, ry: 2.2, color: 'water', life: 0.4, rings: 1, width: 0.7, delay: 0.35 + rnd() * 0.25 }); }
      break;

    /* ── fire / energy ───────────────────────────────────────── */
    case 'ember-rise':
      pieces(fx, x, y + R * 0.3, { shape: 'ember', n: 12, speed: 55, spread: 0.7, angle: -Math.PI / 2, gravity: -50, life: 1.1, size: 2.6, color: 'hot', drag: 1, spin: 2 }); break;
    case 'flame-tongue':
      glyph(fx, x, y, { d: 'M0 8C-5 8 -7 3 -5 -1C-4 -3 -2 -4 -2 -7C1 -5 2 -3 2 -1C3 -2 4 -3 4 -5C7 -2 7 2 6 4C5 7 3 8 0 8ZM0 5C-2 5 -3 3 -2 1C-1 2 0 2 0 0C2 1 3 3 2 4C1 5 1 5 0 5Z', size: R * 0.9, color: 'hot', s0: 0.6, s1: 1.1, wobble: 0.8, life: 1.3, hold: [0.15, 0.6] }); break;
    case 'spark-arc': {
      const a: Array<[number, number]> = [[x - R * 0.9, y + R * 0.2], [x + R * 0.9, y - R * 0.2]];
      for (let f = 0; f < 4; f++) { const p: number[] = [a[0][0], a[0][1]]; for (let i = 1; i < 7; i++) { const t = i / 7; p.push(a[0][0] + (a[1][0] - a[0][0]) * t, a[0][1] + (a[1][1] - a[0][1]) * t + (rnd() - 0.5) * 16); } p.push(a[1][0], a[1][1]); custom(fx, 0.5, (g, k, pal) => { if (k < f * 0.2 || k > f * 0.2 + 0.2) return; g.strokeStyle = C(pal, 'ochre'); g.lineWidth = 1.3; poly(g, p); }); }
      break;
    }
    case 'coil-field':
      for (let i = 0; i < 3; i++) ripple(fx, x, y, { rx: R * (0.45 + i * 0.3), ry: R * (0.9 + i * 0.1), color: i === 0 ? 'ochre' : 'bone3', life: 1.1, rings: 1, width: 0.9, delay: i * 0.12, rot: 0 });
      ripple(fx, x, y, { rx: R * 0.3, ry: R * 0.3, color: 'ochre', life: 1.0, rings: 1, width: 1.4 }); break;
    case 'heat-shimmer':
      for (let i = 0; i < 5; i++) custom(fx, 1.2, (g, k, pal) => { g.strokeStyle = C(pal, 'bone3'); g.lineWidth = 0.8; g.globalAlpha = fade(k, 0.2, 0.5) * 0.8; g.beginPath(); for (let j = 0; j <= 14; j++) { const t = j / 14; const py = y + R * 0.4 - t * R * 1.1 - k * 8, px = x - R * 0.6 + i * R * 0.3 + Math.sin(t * 9 + k * 6 + i) * 2.6; if (j) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); });
      break;
    case 'smoke-curl': {
      const p: number[] = []; for (let i = 0; i <= 26; i++) { const t = i / 26; const a = t * TAU * 1.3; p.push(x + Math.sin(t * 5) * 4 + (t > 0.6 ? Math.cos(a) * R * 0.2 : 0), y + R * 0.5 - t * R * 1.4 + (t > 0.6 ? Math.sin(a) * R * 0.15 : 0)); }
      trace(fx, p, { color: 'bone3', life: 1.5, width: 1.1, hold: 0.4 }); break;
    }

    /* ── signal / idea ───────────────────────────────────────── */
    case 'ink-trail': {
      const p: number[] = []; for (let i = 0; i <= 34; i++) { const t = i / 34; p.push(x - R + t * R * 2, y + Math.sin(t * TAU * 1.6) * R * 0.3 + Math.sin(t * 19) * 2); }
      trace(fx, p, { color: 'ink', life: 1.3, width: 1.8, hold: 0.45 });
      pieces(fx, x + R, y, { shape: 'drop', n: 3, speed: 20, spread: 1, angle: Math.PI / 2, gravity: 100, life: 0.7, size: 2, color: 'ink', delay: 0.7 }); break;
    }
    case 'computational-tracers': {
      const paths = [[x - R, y - R * 0.3, x - R * 0.2, y - R * 0.3, x - R * 0.2, y + R * 0.2, x + R, y + R * 0.2], [x - R, y + R * 0.5, x + R * 0.3, y + R * 0.5, x + R * 0.3, y - R * 0.4, x + R, y - R * 0.4]];
      paths.forEach((p, i) => { trace(fx, p, { color: 'bone3', life: 1.2, width: 0.8, hold: 0.4, dash: [3, 3] }); custom(fx, 1.2, (g, k, pal) => { const seg = [0, 0, 0]; let tot = 0; for (let j = 2; j < p.length; j += 2) { seg.push(Math.hypot(p[j] - p[j - 2], p[j + 1] - p[j - 1])); tot += seg[seg.length - 1]; } let d = Math.min(1, k / 0.6) * tot, px = p[0], py = p[1]; for (let j = 2; j < p.length; j += 2) { const sl = Math.hypot(p[j] - p[j - 2], p[j + 1] - p[j - 1]); if (d <= sl) { px = p[j - 2] + (p[j] - p[j - 2]) * d / sl; py = p[j - 1] + (p[j + 1] - p[j - 1]) * d / sl; break; } d -= sl; px = p[j]; py = p[j + 1]; } g.strokeStyle = C(pal, i ? 'ochre' : 'water'); g.lineWidth = 1.2; g.globalAlpha = fade(k, 0.05, 0.6); g.strokeRect(px - 2.5, py - 2.5, 5, 5); }); });
      break;
    }
    case 'pulse-packets':
      ripple(fx, x, y, { rx: R * 1.3, color: 'water', life: 1.0, rings: 3, width: 0.9 });
      pieces(fx, x, y, { shape: 'pixel', n: 8, speed: 80 * s, spread: TAU, life: 0.9, size: 3, color: 'water', drag: 1.1, delay: 0.1 }); break;
    case 'constellation-link': {
      const pts: Array<[number, number]> = Array.from({ length: 6 }, (_, i) => [x - R + rnd() * R * 2, y - R * 0.7 + (i % 3) * R * 0.5 + (rnd() - 0.5) * 10]);
      pts.sort((a, b) => a[0] - b[0]);
      trace(fx, pts.flatMap(p => [p[0], p[1]]), { color: 'bone3', life: 1.5, width: 0.7, hold: 0.4, dash: [2, 3] });
      pts.forEach((p, i) => glyph(fx, p[0], p[1], { d: G.star, size: 7 + (i % 2) * 3, color: 'bone', life: 1.4, delay: i * 0.12, hold: [0.12, 0.6] })); break;
    }
    case 'thought-orbit':
      for (let i = 0; i < 4; i++) custom(fx, 1.5, (g, k, pal) => { const a = k * TAU * 1.1 + i * TAU / 4; g.strokeStyle = C(pal, 'ochre'); g.lineWidth = 1; g.globalAlpha = fade(k, 0.08, 0.5); g.beginPath(); g.arc(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.45 - k * 16, 3, 0, TAU); g.stroke(); });
      break;
    case 'binary-rain':
      for (let c = 0; c < 6; c++) custom(fx, 1.3, (g, k, pal) => { g.strokeStyle = C(pal, 'water'); g.lineWidth = 0.9; g.globalAlpha = fade(k, 0.1, 0.5) * 0.9; for (let j = 0; j < 5; j++) { const py = y - R * 1.0 + ((k * 1.4 + j * 0.2 + c * 0.13) % 1) * R * 1.9, px = x - R * 0.7 + c * R * 0.28; if ((c + j) % 2) { g.beginPath(); g.moveTo(px, py - 3); g.lineTo(px, py + 3); g.stroke(); } else { g.beginPath(); g.ellipse(px, py, 1.8, 3, 0, 0, TAU); g.stroke(); } } });
      break;
  }
}

/* ── the 30 equipped "effect" cosmetics: each adds its own signature ────── */

export type Signature = (fx: Fx, x: number, y: number, s: number) => void;

const wig = (fx: Fx, x: number, y: number, o: { color: PalKey; w: number; h: number; n: number; life: number; amp: number; up?: boolean }) => {
  for (let i = 0; i < o.n; i++) custom(fx, o.life, (g, k, pal) => { g.strokeStyle = C(pal, o.color); g.lineWidth = 0.8; g.globalAlpha = fade(k, 0.15, 0.5) * 0.8; g.beginPath(); for (let j = 0; j <= 12; j++) { const t = j / 12, px = x - o.w / 2 + (i + 0.5) * o.w / o.n + Math.sin(t * 8 + k * 5 + i) * o.amp, py = y + (o.up ? -1 : 1) * (t * o.h - k * 8); if (j) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); });
};

export const SIGNATURES: Record<string, Signature> = {
  'effect-sparks': (fx, x, y, s) => pieces(fx, x, y, { shape: 'tick', n: 10, speed: 150 * s, spread: TAU, gravity: 220, life: 0.5, size: 3.6, color: 'ochre', along: true, drag: 1.1 }),
  'effect-embers': (fx, x, y) => pieces(fx, x, y, { shape: 'ember', n: 8, speed: 40, spread: 1.2, angle: -Math.PI / 2, gravity: -40, life: 1.0, size: 2.4, color: 'hot', drag: 1 }),
  'effect-dust': (fx, x, y) => billow(fx, x, y, { color: 'bone3', r: 22, rise: 12, life: 1.0, n: 6 }),
  'effect-ash': (fx, x, y) => pieces(fx, x, y - 10, { shape: 'flake', n: 8, speed: 18, spread: 1.4, angle: Math.PI / 2, gravity: 26, life: 1.3, size: 2.2, color: 'bone3', alpha: 0.7, spin: 2, drag: 0.8 }),
  'effect-stone-shards': (fx, x, y, s) => pieces(fx, x, y, { shape: 'shard', n: 8, speed: 110 * s, spread: TAU, gravity: 300, life: 0.7, size: 3, color: 'bone', spin: 9, drag: 1.2 }),
  'effect-flint-rays': (fx, x, y) => { for (let i = 0; i < 8; i++) streaks(fx, x, y, { angle: i / 8 * TAU, n: 1, len: 10, dist: 36, life: 0.45, color: i % 2 ? 'ochre' : 'bone', width: 1.1 }); },
  'effect-wood-grain': (fx, x, y) => { ripple(fx, x, y, { rx: 34, ry: 22, color: 'ochre', life: 0.9, rings: 3, width: 0.8, rot: -0.3 }); },
  'effect-leaflets': (fx, x, y) => pieces(fx, x, y - 6, { shape: 'leaf', n: 6, speed: 50, spread: 2.4, angle: -Math.PI / 2, gravity: 50, life: 1.1, size: 3.4, color: 'good', spin: 4, drag: 1.3 }),
  'effect-pollen': (fx, x, y) => pieces(fx, x, y, { shape: 'bead', n: 12, speed: 16, spread: TAU, gravity: -6, life: 1.4, size: 1.8, color: 'ochre', alpha: 0.8, drag: 0.8 }),
  'effect-water-rings': (fx, x, y) => ripple(fx, x, y, { rx: 40, ry: 14, color: 'water', life: 1.0, rings: 3, width: 0.9 }),
  'effect-tiny-droplets': (fx, x, y) => pieces(fx, x, y, { shape: 'drop', n: 8, speed: 70, spread: 1.6, angle: -Math.PI / 2, gravity: 340, life: 0.8, size: 1.8, color: 'water', drag: 0.4 }),
  'effect-rain': (fx, x, y) => { for (let i = 0; i < 7; i++) streaks(fx, x - 30 + i * 10, y - 40, { angle: Math.PI / 2 + 0.1, n: 1, len: 10, dist: 56, life: 0.5 + (i % 3) * 0.08, color: 'water', width: 0.8 }); },
  'effect-snow': (fx, x, y) => pieces(fx, x, y - 24, { shape: 'cross', n: 9, speed: 8, spread: 1.6, angle: Math.PI / 2, gravity: 22, life: 1.5, size: 2.4, color: 'bone', alpha: 0.8, spin: 2, drag: 0.5 }),
  'effect-mist': (fx, x, y) => billow(fx, x, y + 6, { color: 'bone2', r: 28, rise: 4, life: 1.5, n: 7, width: 0.7 }),
  'effect-heat-shimmer': (fx, x, y) => wig(fx, x, y + 14, { color: 'bone3', w: 54, h: 40, n: 5, life: 1.1, amp: 2.4, up: true }),
  'effect-smoke': (fx, x, y) => trace(fx, [x, y + 12, x + 5, y, x - 4, y - 12, x + 3, y - 24, x - 2, y - 34], { color: 'bone3', life: 1.4, width: 1.4, hold: 0.4 }),
  'effect-copper-filings': (fx, x, y) => pieces(fx, x, y, { shape: 'tick', n: 14, speed: 60, spread: TAU, life: 0.9, size: 3, color: 'ochre', along: true, drag: 1.6, spin: 3 }),
  'effect-iron-shine': (fx, x, y) => { streaks(fx, x - 24, y - 12, { angle: 0.5, n: 2, len: 18, gap: 7, dist: 54, life: 0.5, color: 'bone', width: 1.6 }); glyph(fx, x + 20, y - 8, { d: G.star, size: 10, color: 'bone', life: 0.6, delay: 0.25 }); },
  'effect-glass-prisms': (fx, x, y) => pieces(fx, x, y, { shape: 'prism', n: 5, speed: 60, spread: TAU, life: 0.8, size: 3.4, color: 'water', drag: 1.4, spin: 3 }),
  'effect-shadow-ribbons': (fx, x, y) => { for (let i = 0; i < 3; i++) trace(fx, [x - 30, y + 14 - i * 9, x - 10, y + 4 - i * 9, x + 10, y + 20 - i * 9, x + 32, y + 8 - i * 9], { color: 'ink', life: 1.1, width: 2.2 - i * 0.5, hold: 0.4 }); },
  'effect-sun-motes': (fx, x, y) => pieces(fx, x, y, { shape: 'mote', n: 6, speed: 14, spread: TAU, gravity: -10, life: 1.4, size: 3, color: 'ochre', alpha: 0.8, drag: 0.8 }),
  'effect-moon-motes': (fx, x, y) => { glyph(fx, x + 14, y - 16, { d: G.moon, size: 12, color: 'bone', life: 1.2, hold: [0.2, 0.6] }); pieces(fx, x, y, { shape: 'mote', n: 5, speed: 12, spread: TAU, gravity: -8, life: 1.4, size: 2.4, color: 'water', alpha: 0.7, drag: 0.8 }); },
  'effect-ink-stream': (fx, x, y) => { trace(fx, [x - 30, y + 6, x - 14, y - 8, x + 2, y + 8, x + 18, y - 6, x + 32, y + 4], { color: 'ink', life: 1.2, width: 2, hold: 0.4 }); },
  'effect-paper-folds': (fx, x, y) => { trace(fx, [x - 16, y - 14, x + 16, y - 14, x + 16, y + 14, x - 16, y + 14, x - 16, y - 14], { color: 'bone', life: 1.0, width: 0.9, hold: 0.5 }); trace(fx, [x - 16, y - 14, x + 16, y + 14], { color: 'bone3', life: 1.0, width: 0.7, hold: 0.5 }); trace(fx, [x + 16, y - 14, x - 16, y + 14], { color: 'bone3', life: 1.0, width: 0.7, hold: 0.5 }); },
  'effect-gear-trails': (fx, x, y) => { glyph(fx, x - 14, y, { d: G.gearwheel, size: 16, color: 'bone', rot0: 0, rot1: 2, to: [-26, -4], life: 1.0 }); glyph(fx, x + 14, y, { d: G.gearwheel, size: 12, color: 'ochre', rot0: 0, rot1: -2.6, to: [26, 4], life: 1.0 }); },
  'effect-electric-arcs': (fx, x, y) => { const rnd = mulberry(7); for (let f = 0; f < 3; f++) { const p = [x - 26, y]; for (let i = 1; i < 6; i++) p.push(x - 26 + i * 10, y + (rnd() - 0.5) * 18); p.push(x + 26, y); custom(fx, 0.45, (g, k, pal) => { if (k < f * 0.22 || k > f * 0.22 + 0.2) return; g.strokeStyle = C(pal, 'ochre'); g.lineWidth = 1.2; poly(g, p); }); } },
  'effect-signal-waves': (fx, x, y) => { for (let i = 0; i < 3; i++) custom(fx, 1.0, (g, k, pal) => { const rr = 10 + easeOut(Math.max(0, k - i * 0.15)) * 34; g.strokeStyle = C(pal, 'water'); g.lineWidth = 0.9; g.globalAlpha = Math.max(0, 1 - k - i * 0.1); g.beginPath(); g.arc(x - 20, y, rr, -0.8, 0.8); g.stroke(); }); },
  'effect-pixel-drifts': (fx, x, y) => pieces(fx, x, y, { shape: 'pixel', n: 9, speed: 22, spread: 1.4, angle: -Math.PI / 2, gravity: -8, life: 1.2, size: 3, color: 'water', drag: 0.9, alpha: 0.85 }),
  'effect-star-map': (fx, x, y) => { const pts: number[] = [x - 26, y + 8, x - 10, y - 10, x + 6, y + 2, x + 20, y - 14, x + 30, y + 6]; trace(fx, pts, { color: 'bone3', life: 1.4, width: 0.7, hold: 0.4, dash: [2, 3] }); for (let i = 0; i < pts.length; i += 2) glyph(fx, pts[i], pts[i + 1], { d: G.star, size: 6, color: 'bone', life: 1.2, delay: i * 0.05, hold: [0.1, 0.6] }); },
  'effect-orbit-lines': (fx, x, y) => { ripple(fx, x, y, { rx: 36, ry: 14, color: 'bone3', life: 1.2, rings: 1, width: 0.8, rot: 0.4 }); ripple(fx, x, y, { rx: 26, ry: 26, color: 'ochre', life: 1.2, rings: 1, width: 0.8, delay: 0.1 }); custom(fx, 1.2, (g, k, pal) => { const a = k * TAU * 1.2; g.strokeStyle = C(pal, 'bone'); g.lineWidth = 1.4; g.globalAlpha = fade(k, 0.05, 0.7); g.beginPath(); g.arc(x + Math.cos(a) * 36 * Math.cos(0.4) - Math.sin(a) * 14 * Math.sin(0.4), y + Math.cos(a) * 36 * Math.sin(0.4) + Math.sin(a) * 14 * Math.cos(0.4), 2.2, 0, TAU); g.stroke(); }); },
};
