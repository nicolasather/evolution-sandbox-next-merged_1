/** Boss hazards drawn from the SAME numbers the server damages with (see `inHazard` in lib/swarm/bosses.ts): what is hatched is what hurts.
 *  Telegraph = hatched outline that fills as the warning runs out; active = solid. The safe gap of a ring is marked with chevrons so it never relies on colour alone. */
import type { Hazard } from '../domain';
import { beamAngle } from '../bosses';
import { SAFE, WARN, type Theme } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const hatch = (() => { let p: CanvasPattern | null = null; return (ctx: C, color: string): CanvasPattern | string => { if (typeof document === 'undefined') return color; if (!p) { const c = document.createElement('canvas'); c.width = c.height = 10; const g = c.getContext('2d')!; g.strokeStyle = color; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-2, 12); g.lineTo(12, -2); g.stroke(); p = ctx.createPattern(c, 'repeat'); } return p ?? color; }; })();

export function decodeHazard(a: number[], id: number): Hazard {
  return { id, kind: (['arc', 'ring', 'beam', 'root', 'orb'] as const)[a[0]!]!, x: a[1]!, y: a[2]!, a0: a[3]! / 1000, a1: a[4]! / 1000, w: a[5]! / 1000, r0: a[6]!, r1: a[7]!, gapA: a[8]! / 1000, gapW: a[9]! / 1000, telegraph: a[10]!, telegraphMax: a[11]!, active: a[12]!, activeMax: a[13]!, t: a[14]!, dmg: 0, hit: [], src: 0 };
}
export function drawHazard(ctx: C, th: Theme, h: Hazard, t: number) {
  const warning = h.telegraph > 0; const p = warning ? 1 - h.telegraph / Math.max(1, h.telegraphMax) : 1;
  const fillA = warning ? 0.12 + 0.22 * p : 0.58; const col = WARN;
  ctx.save(); ctx.lineJoin = 'round';
  const paint = (path: () => void) => {
    ctx.beginPath(); path(); ctx.globalAlpha = fillA; ctx.fillStyle = col; ctx.fill(); if (warning) { ctx.globalAlpha = 0.5; ctx.fillStyle = hatch(ctx, th.hc ? '#7A1C00' : col); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.setLineDash(warning ? [9, 6] : []); ctx.lineDashOffset = th.reduced ? 0 : -t * 30; ctx.lineWidth = warning ? 3 : 4; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.setLineDash([]);
  };
  if (h.kind === 'arc') paint(() => { ctx.arc(h.x, h.y, h.r1, h.a0 - h.w, h.a0 + h.w); ctx.arc(h.x, h.y, Math.max(0, h.r0), h.a0 + h.w, h.a0 - h.w, true); ctx.closePath(); });
  else if (h.kind === 'ring') {
    const a0 = h.gapA + h.gapW, a1 = h.gapA + TAU - h.gapW;
    paint(() => { ctx.arc(h.x, h.y, h.r1, a0, a1); ctx.arc(h.x, h.y, h.r0, a1, a0, true); ctx.closePath(); });
    const mid = (h.r0 + h.r1) / 2; ctx.fillStyle = SAFE; ctx.strokeStyle = th.ink; ctx.lineWidth = 2.4; // safe-gap chevrons
    for (const k of [-0.5, 0, 0.5]) { const a = h.gapA + k * h.gapW; const cx = h.x + Math.cos(a) * mid, cy = h.y + Math.sin(a) * mid; ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  } else if (h.kind === 'beam') {
    const ang = warning ? h.a0 : beamAngle(h); ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
    if (warning) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(h.r1, 0); ctx.lineWidth = 5; ctx.strokeStyle = th.hc ? '#fff' : '#EAF6FF'; ctx.stroke(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(h.r1, 0); ctx.lineWidth = 1.6; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.beginPath(); ctx.rect(0, -h.w, h.r1, h.w * 2); ctx.globalAlpha = 0.18 + 0.2 * p; ctx.fillStyle = hatch(ctx, col); ctx.fill(); ctx.globalAlpha = 1; ctx.setLineDash([8, 6]); ctx.lineWidth = 2.4; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.beginPath(); ctx.rect(0, -h.w, h.r1, h.w * 2); ctx.fillStyle = '#EAF6FF'; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.strokeStyle = th.ink; ctx.stroke(); }
    ctx.restore();
  } else if (h.kind === 'root') {
    paint(() => { ctx.arc(h.x, h.y, h.r1, 0, TAU); });
    ctx.lineWidth = 3; ctx.strokeStyle = th.ink; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * h.r1 * 0.3, h.y + Math.sin(a) * h.r1 * 0.3); ctx.lineTo(h.x + Math.cos(a) * h.r1 * 0.9, h.y + Math.sin(a) * h.r1 * 0.9); ctx.stroke(); }
  }
  ctx.restore();
}
