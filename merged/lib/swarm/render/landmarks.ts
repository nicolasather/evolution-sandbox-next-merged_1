/** Live (animated) landmarks and ambient motion for the large arena. Drawing only: nothing here is solid or changes game state.
 *  Flat fills, chunky ink outlines, no faces, no gradients; every shape is built from primitives. `t` is frozen to 0 for reduced motion. */
import type { Landmark, MapDef } from '../maps';
import { WORLD } from '../balance';
import { PAPER_2, GOLD, type Theme } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const fill = (c: C, th: Theme, col: string, w = th.stroke) => { c.fillStyle = col; c.fill(); c.lineWidth = w; c.lineJoin = 'round'; c.strokeStyle = th.ink; c.stroke(); };
const poly = (c: C, pts: [number, number][]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

export function drawLandmark(c: C, th: Theme, lm: Landmark, t: number) {
  const s = lm.s ?? 1; c.save(); c.translate(lm.x, lm.y); c.scale(s, s);
  switch (lm.kind) {
    case 'windmill': {
      c.beginPath(); c.ellipse(0, 38, 46, 10, 0, 0, TAU); c.fillStyle = 'rgba(29,44,53,0.18)'; c.fill();
      poly(c, [[-26, 36], [-16, -26], [16, -26], [26, 36]]); fill(c, th, '#F3DDB0');
      poly(c, [[-22, -24], [0, -52], [22, -24]]); fill(c, th, '#F77765');
      c.beginPath(); c.roundRect(-7, 14, 14, 22, 4); fill(c, th, '#9A6B3A', 2.6);
      c.save(); c.translate(0, -22); c.rotate(t * 0.9); for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.beginPath(); c.roundRect(-4, -46, 8, 44, 2); fill(c, th, '#FFFBF1', 2.6); } c.beginPath(); c.arc(0, 0, 6, 0, TAU); fill(c, th, GOLD, 2.6); c.restore();
      break;
    }
    case 'pond': {
      c.beginPath(); c.ellipse(0, 0, 120, 70, 0, 0, TAU); fill(c, th, '#9ED8DC', 4);
      c.beginPath(); c.ellipse(0, 0, 96, 52, 0, 0, TAU); c.fillStyle = '#7FC4C8'; c.fill();
      for (let i = 0; i < 3; i++) { const ph = (t * 0.35 + i / 3) % 1; c.beginPath(); c.ellipse(-20 + i * 30, 4 - i * 6, 14 + ph * 30, 7 + ph * 15, 0, 0, TAU); c.globalAlpha = (1 - ph) * 0.7; c.lineWidth = 2.4; c.strokeStyle = PAPER_2; c.stroke(); c.globalAlpha = 1; }
      for (const [x, y] of [[-50, -14], [40, 16], [8, -26]] as const) { c.beginPath(); c.ellipse(x, y + Math.sin(t * 1.2 + x) * 1.2, 16, 9, 0, 0, TAU); fill(c, th, '#5E9C7B', 2.6); }
      c.beginPath(); c.arc(40, 12, 5, 0, TAU); fill(c, th, '#FF9FB5', 2.2);
      break;
    }
    case 'tower': {
      c.beginPath(); c.ellipse(0, 40, 40, 9, 0, 0, TAU); c.fillStyle = 'rgba(29,44,53,0.18)'; c.fill();
      c.beginPath(); c.roundRect(-16, -30, 32, 70, 4); fill(c, th, '#CDBD98');
      c.beginPath(); c.moveTo(-34, -30); c.lineTo(62, -30); c.lineWidth = 8; c.lineCap = 'round'; c.strokeStyle = th.ink; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#F2B84B'; c.stroke();
      const sw = Math.sin(t * 0.8) * 10; c.beginPath(); c.moveTo(48, -30); c.lineTo(48 + sw, 4); c.lineWidth = 2.6; c.strokeStyle = th.ink; c.stroke(); c.beginPath(); c.roundRect(48 + sw - 8, 4, 16, 12, 3); fill(c, th, '#F77765', 2.6);
      break;
    }
    case 'pylon': {
      poly(c, [[-22, 40], [-6, -40], [6, -40], [22, 40]]); fill(c, th, '#B9A783');
      for (const y of [-14, 8, 26]) { c.beginPath(); c.moveTo(-14, y); c.lineTo(14, y); c.lineWidth = 3; c.strokeStyle = th.ink; c.stroke(); }
      const p = 0.5 + 0.5 * Math.sin(t * 2.2); c.beginPath(); c.arc(0, -46, 9 + p * 3, 0, TAU); fill(c, th, '#FFC25C', 2.8);
      break;
    }
    case 'arch': {
      c.beginPath(); c.roundRect(-52, -8, 20, 52, 4); fill(c, th, '#E9CF9C'); c.beginPath(); c.roundRect(32, -8, 20, 52, 4); fill(c, th, '#E9CF9C');
      c.beginPath(); c.arc(0, -8, 52, Math.PI, 0); c.lineTo(32, -8); c.arc(0, -8, 32, 0, Math.PI, true); c.closePath(); fill(c, th, '#F3DDB0');
      for (const x of [-34, 0, 34]) { c.beginPath(); c.arc(x, -50 + Math.abs(x) * 0.25, 5, 0, TAU); fill(c, th, '#FF9FB5', 2); }
      break;
    }
    case 'statue': {
      c.beginPath(); c.roundRect(-22, 14, 44, 26, 4); fill(c, th, '#C9CCCB');
      c.beginPath(); c.roundRect(-9, -22, 18, 38, 8); fill(c, th, '#E2E5E3'); c.beginPath(); c.arc(0, -30, 10, 0, TAU); fill(c, th, '#E2E5E3');
      c.beginPath(); c.arc(0, -46, 5, 0, TAU); c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2); fill(c, th, GOLD, 2); c.globalAlpha = 1;
      break;
    }
    case 'lamp': {
      for (const x of [-60, 0, 60]) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x, -14); c.lineWidth = 4; c.strokeStyle = th.ink; c.stroke(); c.beginPath(); c.roundRect(x - 9, -34, 18, 20, 6); c.globalAlpha = 0.8 + 0.2 * Math.sin(t * 3 + x); fill(c, th, '#FFC25C', 2.8); c.globalAlpha = 1; }
      break;
    }
    case 'dome': {
      c.beginPath(); c.ellipse(0, 30, 70, 14, 0, 0, TAU); c.fillStyle = 'rgba(29,44,53,0.16)'; c.fill();
      c.beginPath(); c.arc(0, 28, 64, Math.PI, 0); c.closePath(); c.fillStyle = 'rgba(215,238,240,0.8)'; c.fill(); c.lineWidth = th.stroke + 0.6; c.strokeStyle = th.ink; c.stroke();
      for (const a of [0.5, 1.0, 1.5, 2.1]) { c.beginPath(); c.moveTo(0, -36); c.quadraticCurveTo(Math.cos(Math.PI * a) * 70, 0, Math.cos(Math.PI * a) * 64, 28); c.lineWidth = 2.4; c.strokeStyle = th.ink; c.stroke(); }
      c.beginPath(); c.arc(0, -38, 6, 0, TAU); fill(c, th, GOLD, 2.4);
      break;
    }
  }
  c.restore();
}

/** soft drifting scenery above the ground and below actors: petals / dust / snow, plus the ambient wind-gust streaks. Deterministic from t. */
export function drawAmbient(c: C, th: Theme, map: MapDef, t: number, view: { x0: number; y0: number; x1: number; y1: number }) {
  if (th.reduced) return;
  const kind = map.id === 'meadow_circuit' ? 'petal' : map.id === 'paper_quarry' ? 'dust' : 'snow';
  const col = kind === 'petal' ? '#FFB5C7' : kind === 'dust' ? '#E6DAC0' : '#FFFFFF';
  c.save(); c.globalAlpha = 0.85;
  const N = 46;
  for (let i = 0; i < N; i++) {
    const sx = (i * 977) % WORLD.w, sy = (i * 613) % WORLD.h; const sp = 12 + (i % 5) * 5, ph = i * 1.7;
    const x = (((sx + t * sp * (kind === 'snow' ? 0.3 : 1) + Math.sin(t * 0.7 + ph) * 18) % WORLD.w) + WORLD.w) % WORLD.w;
    const y = (((sy + t * (kind === 'snow' ? 18 + (i % 3) * 6 : 6) + Math.cos(t * 0.5 + ph) * 12) % WORLD.h) + WORLD.h) % WORLD.h;
    if (x < view.x0 - 20 || x > view.x1 + 20 || y < view.y0 - 20 || y > view.y1 + 20) continue;
    c.save(); c.translate(x, y); c.rotate(t * 0.8 + ph); c.beginPath();
    if (kind === 'petal') c.ellipse(0, 0, 5, 2.6, 0, 0, TAU); else if (kind === 'dust') c.rect(-2, -2, 4, 3); else c.arc(0, 0, 2.6, 0, TAU);
    c.fillStyle = col; c.fill(); c.lineWidth = 1.2; c.strokeStyle = th.ink; c.globalAlpha = 0.5; c.stroke(); c.restore();
  }
  c.restore();
  // shadows of slow clouds crossing the floor
  c.save(); c.fillStyle = 'rgba(29,44,53,0.07)';
  for (let i = 0; i < 4; i++) { const x = ((t * 14 + i * 520) % (WORLD.w + 600)) - 300, y = 180 + i * 290; c.beginPath(); c.ellipse(x, y, 190, 70, 0, 0, TAU); c.fill(); }
  c.restore();
}
