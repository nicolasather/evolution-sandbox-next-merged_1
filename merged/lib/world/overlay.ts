import type { Frame } from './choreography';
import {
  arcPoints, discRadiusPx, project, projectVec, clamp, type Camera, type LatLon, type Viewport,
} from './geo';
import type { Place, Precision } from './types';

/* ============================================================================
   OVERLAY — the crisp layer over the globe: markers, pulses, the travel arc,
   small labels. Canvas 2D, drawn with the same camera maths as the shader so
   everything sits exactly on the surface. Also holds the dotted globe used
   when WebGL is not available.
   ========================================================================== */

export interface OverlayScene {
  mode: 'major' | 'era';
  /** The new place (major mode). */
  to: (LatLon & { precision: Precision; marker: 'pin' | 'ring' | 'halo'; name: string }) | null;
  /** The previous place, where the camera came from. */
  prev: (LatLon & { name: string }) | null;
  alsoAt: readonly Place[];
  /** Quiet dots for every major already found. */
  dots: readonly LatLon[];
  /** Era mode: the era's own markers, in the order they light. */
  eraPoints: readonly LatLon[];
}

export interface OverlayStyle {
  amber: string;   // the new place
  cool: string;    // the previous place, the arc's tail
  ink: string;     // text and quiet marks
  font: string;
  quality: 'high' | 'medium' | 'low';
}

export const DEFAULT_STYLE: OverlayStyle = {
  amber: '226,163,94', cool: '150,188,206', ink: '233,229,221',
  font: "11px 'JetBrains Mono', ui-monospace, Menlo, monospace", quality: 'high',
};

/** How wide a place is, in km, by how exactly it is known — the size of its halo. */
export const PRECISION_KM: Record<Precision, number> = { site: 70, area: 260, region: 900, broad: 2200, unlocated: 0 };

const rgba = (rgb: string, a: number) => `rgba(${rgb},${clamp(a, 0, 1).toFixed(3)})`;

function radiusPx(km: number, cam: Camera, vp: Viewport): number {
  return discRadiusPx(cam, vp) * (km / 6371);
}

/** The whole overlay for one frame. */
export function drawOverlay(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Camera, f: Frame, scene: OverlayScene, st: OverlayStyle, clear = true): void {
  if (clear) ctx.clearRect(0, 0, vp.w, vp.h);
  if (f.veil <= 0.01) return;
  const lowQ = st.quality === 'low';

  // every place already found, as small quiet dots
  const dotA = 0.5 * f.dots;
  if (dotA > 0.02) {
    ctx.fillStyle = rgba(st.ink, dotA * 0.6);
    for (const d of scene.dots) {
      const p = project(d.lat, d.lon, cam, vp);
      if (!p.visible) continue;
      ctx.globalAlpha = clamp(p.facing * 2.2, 0, 1);
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (scene.mode === 'era') { drawEra(ctx, vp, cam, f, scene, st); return; }

  // the place the camera came from
  if (scene.prev && f.prev > 0.02) {
    const p = project(scene.prev.lat, scene.prev.lon, cam, vp);
    if (p.visible) {
      const a = f.prev * clamp(p.facing * 2.5, 0, 1);
      ctx.strokeStyle = rgba(st.cool, 0.85 * a);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(st.cool, 0.9 * a);
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      if (a > 0.3) label(ctx, scene.prev.name, p.x + 9, p.y + 3, rgba(st.cool, 0.8 * a), st.font);
    }
  }

  // the arc: a thin line lifted off the surface, brightest at its head
  if (f.arc > 0 && f.arcAlpha > 0.02 && scene.prev && scene.to) {
    const pts = arcPoints(scene.prev, scene.to, lowQ ? 28 : 56);
    const upto = Math.max(1, Math.floor(f.arc * (pts.length - 1)));
    let last: { x: number; y: number; ok: boolean } | null = null;
    ctx.lineCap = 'round';
    for (let i = 0; i <= upto; i++) {
      const p = projectVec(pts[i], cam, vp);
      const cur = { x: p.x, y: p.y, ok: p.visible };
      if (last && last.ok && cur.ok) {
        const k = i / Math.max(1, upto);                     // 0 at the tail, 1 at the head
        ctx.strokeStyle = rgba(st.amber, f.arcAlpha * (0.08 + 0.85 * k * k));
        ctx.lineWidth = 0.8 + 1.6 * k;
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(cur.x, cur.y); ctx.stroke();
      }
      last = cur;
    }
    if (f.arc < 1 && last && last.ok) {
      const g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 12);
      g.addColorStop(0, rgba(st.amber, 0.95 * f.arcAlpha)); g.addColorStop(1, rgba(st.amber, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(last.x, last.y, 12, 0, Math.PI * 2); ctx.fill();
    }
  }

  // the other early centres: hollow dots that arrive after the main marker
  if (f.extras > 0.02) {
    for (const e of scene.alsoAt) {
      const p = project(e.lat, e.lon, cam, vp);
      if (!p.visible) continue;
      const a = f.extras * clamp(p.facing * 2.5, 0, 1);
      ctx.strokeStyle = rgba(st.amber, 0.75 * a);
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(st.amber, 0.35 * a);
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
      if (a > 0.4) label(ctx, e.label, p.x + 8, p.y + 3, rgba(st.ink, 0.62 * a), st.font);
    }
  }

  // the new place itself
  if (scene.to && f.pulse >= 0) drawTarget(ctx, vp, cam, f, scene.to, st);
  else if (scene.to && scene.to.precision === 'unlocated') drawUnlocated(ctx, vp, cam, f, st);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, font: string) {
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function drawTarget(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Camera, f: Frame, to: NonNullable<OverlayScene['to']>, st: OverlayStyle) {
  if (to.precision === 'unlocated') { drawUnlocated(ctx, vp, cam, f, st); return; }
  const p = project(to.lat, to.lon, cam, vp);
  if (!p.visible) return;
  const t = f.pulse;
  const appear = clamp(t / 0.35, 0, 1);
  const halo = Math.max(6, radiusPx(PRECISION_KM[to.precision], cam, vp));
  // a wide, soft halo for a region: the honest size of what is known
  if (to.marker !== 'pin') {
    const g = ctx.createRadialGradient(p.x, p.y, halo * 0.15, p.x, p.y, halo);
    g.addColorStop(0, rgba(st.amber, 0.22 * appear)); g.addColorStop(0.75, rgba(st.amber, 0.10 * appear)); g.addColorStop(1, rgba(st.amber, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, halo, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash(to.marker === 'halo' ? [3, 5] : [2, 3]);
    ctx.strokeStyle = rgba(st.amber, 0.55 * appear); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, halo * 0.92, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  // expanding rings, three in a row, repeating
  const rings = st.quality === 'low' ? 1 : 3;
  const maxR = Math.max(28, halo * 1.15);
  for (let i = 0; i < rings; i++) {
    const k = ((t * 0.72 - i * 0.26) % 1 + 1) % 1;
    if (t * 0.72 - i * 0.26 < 0) continue;
    const r = 5 + (maxR - 5) * (1 - Math.pow(1 - k, 2.2));
    ctx.strokeStyle = rgba(st.amber, (1 - k) * 0.7 * appear); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  }
  // the marker: a bright core with a glow
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
  g.addColorStop(0, rgba(st.amber, 0.95 * appear)); g.addColorStop(0.35, rgba(st.amber, 0.35 * appear)); g.addColorStop(1, rgba(st.amber, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba('255,240,214', appear); ctx.beginPath(); ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2); ctx.fill();
}

/** A place with no single location: the whole limb breathes, no pin. */
function drawUnlocated(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Camera, f: Frame, st: OverlayStyle) {
  const t = Math.max(0, f.pulse);
  const cx = vp.w / 2, cy = vp.h * (0.5 - (cam.shift ?? 0));
  const r = discRadiusPx(cam, vp);
  const a = clamp(t / 0.5, 0, 1);
  for (let i = 0; i < 2; i++) {
    const k = ((t * 0.5 - i * 0.5) % 1 + 1) % 1;
    ctx.strokeStyle = rgba(st.amber, (1 - k) * 0.55 * a); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, r * (1.0 + 0.10 * k), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.setLineDash([2, 7]);
  ctx.strokeStyle = rgba(st.amber, 0.5 * a); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.015, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

function drawEra(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Camera, f: Frame, scene: OverlayScene, st: OverlayStyle) {
  const n = scene.eraPoints.length;
  for (let i = 0; i < n; i++) {
    const lit = clamp(f.light - i, 0, 1);
    if (lit <= 0) continue;
    const q = scene.eraPoints[i];
    const p = project(q.lat, q.lon, cam, vp);
    if (!p.visible) continue;
    const a = lit * clamp(p.facing * 2.5, 0, 1);
    const age = clamp(f.light - i, 0, 3);
    // a bright flash that settles into a steady glow
    const flash = Math.max(0, 1 - age / 1.2);
    const r = 5 + 26 * (1 - flash) * (1 - flash) + 4;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, rgba(st.amber, (0.55 + 0.4 * flash) * a)); g.addColorStop(1, rgba(st.amber, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba('255,240,214', a); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
    if (flash > 0.02) {
      ctx.strokeStyle = rgba(st.amber, flash * 0.6 * a); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 + 30 * (1 - flash), 0, Math.PI * 2); ctx.stroke();
    }
  }
}

/* ── the dotted globe (no WebGL) ───────────────────────────────────── */

/**
 * The fallback backdrop and globe on a plain canvas: a dark room, the atmosphere's glow, and the Earth
 * as drawn by SoftGlobe (lib/world/soft.ts). With no globe image it is a plain disc.
 */
export function drawFallbackGlobe(
  ctx: CanvasRenderingContext2D, vp: Viewport, cam: Camera, veil: number, globe: HTMLCanvasElement | null,
): void {
  const cx = vp.w / 2, cy = vp.h * (0.5 - (cam.shift ?? 0));
  const R = discRadiusPx(cam, vp);
  ctx.clearRect(0, 0, vp.w, vp.h);
  if (veil <= 0.01) return;
  ctx.globalAlpha = veil;
  // backdrop
  const bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(vp.w, vp.h) * 0.75);
  bg.addColorStop(0, 'rgba(10,13,20,0.96)'); bg.addColorStop(1, 'rgba(2,3,6,0.98)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, vp.w, vp.h);
  // the glow beyond the limb
  const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
  glow.addColorStop(0, 'rgba(90,150,240,0.34)'); glow.addColorStop(1, 'rgba(90,150,240,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2); ctx.fill();
  if (globe) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(globe, 0, 0, vp.w, vp.h);
  } else {
    ctx.fillStyle = 'rgba(8,16,30,0.98)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
