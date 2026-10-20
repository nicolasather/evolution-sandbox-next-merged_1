/** The three illustrated maps. Rich scenery lives on the outer ring; the combat floor stays clean. Obstacles are drawn exactly from MAPS.obstacles
 *  (the only solid things); props are decoration and never solid. The backdrop is drawn once per (map, size, contrast) into an offscreen canvas. */
import { MAPS, type MapDef } from '../maps';
import type { MapId } from '../domain';
import { WORLD } from '../balance';
import { Stream, seedFrom } from '../rng';
import { shade } from './sprites';
import { PAPER_2, type Theme } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function path(ctx: C, pts: [number, number][]) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
function outline(ctx: C, th: Theme, fill: string, w = th.stroke) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.strokeStyle = th.ink; ctx.stroke(); }

function bush(ctx: C, th: Theme, x: number, y: number, s: number, col: string) { for (const [dx, dy, r] of [[-12, 4, 13], [10, 5, 14], [0, -6, 15]] as const) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); outline(ctx, th, col, 2.6); } ctx.beginPath(); ctx.arc(x - 3 * s, y - 9 * s, 4 * s, 0, TAU); ctx.fillStyle = 'rgba(255,251,241,0.45)'; ctx.fill(); }
function tuft(ctx: C, th: Theme, x: number, y: number, col: string) { for (const d of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + d - 3, y); ctx.lineTo(x + d * 1.4, y - 14 - Math.abs(d)); ctx.lineTo(x + d + 3, y); ctx.closePath(); outline(ctx, th, col, 2); } }
function flower(ctx: C, th: Theme, x: number, y: number, col: string) { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 4.5, 0, TAU); outline(ctx, th, col, 2); } ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); outline(ctx, th, '#FFD66E', 2); }
function mushroom(ctx: C, th: Theme, x: number, y: number, s: number) { ctx.beginPath(); ctx.roundRect(x - 4 * s, y - 2 * s, 8 * s, 12 * s, 3); outline(ctx, th, PAPER_2, 2.4); ctx.beginPath(); ctx.ellipse(x, y - 3 * s, 13 * s, 9 * s, 0, Math.PI, TAU); outline(ctx, th, '#F77765', 2.6); ctx.beginPath(); ctx.arc(x - 4 * s, y - 8 * s, 2 * s, 0, TAU); ctx.fillStyle = PAPER_2; ctx.fill(); ctx.beginPath(); ctx.arc(x + 5 * s, y - 6 * s, 1.6 * s, 0, TAU); ctx.fill(); }
function fence(ctx: C, th: Theme, x: number, y: number) { for (const d of [-14, 0, 14]) { ctx.beginPath(); ctx.roundRect(x + d - 4, y - 16, 8, 28, 3); outline(ctx, th, '#E9CF9C', 2.4); } ctx.beginPath(); ctx.roundRect(x - 20, y - 6, 40, 6, 2); outline(ctx, th, '#D9B97C', 2.4); }
function lantern(ctx: C, th: Theme, x: number, y: number) { ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y - 8); ctx.lineWidth = 3; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.beginPath(); ctx.roundRect(x - 8, y - 22, 16, 16, 5); outline(ctx, th, '#FFC25C', 2.6); ctx.beginPath(); ctx.arc(x, y - 14, 3, 0, TAU); ctx.fillStyle = PAPER_2; ctx.fill(); }
function ridge(ctx: C, th: Theme, x: number, y: number, s: number, col: string) { path(ctx, [[x - 60 * s, y + 14], [x - 40 * s, y - 14], [x - 12 * s, y - 4], [x + 18 * s, y - 20], [x + 58 * s, y + 14]]); outline(ctx, th, col, 3); ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 2); ctx.lineTo(x + 6 * s, y + 10); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(29,44,53,0.5)'; ctx.stroke(); }
function slate(ctx: C, th: Theme, x: number, y: number, col: string) { path(ctx, [[x - 14, y + 10], [x - 9, y - 12], [x + 11, y - 10], [x + 15, y + 11]]); outline(ctx, th, col, 2.6); }
function chip(ctx: C, th: Theme, x: number, y: number, col: string) { path(ctx, [[x - 6, y + 3], [x - 2, y - 5], [x + 6, y - 2], [x + 4, y + 5]]); outline(ctx, th, col, 2); }
function planter(ctx: C, th: Theme, x: number, y: number) { ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); outline(ctx, th, '#8FC7D0', 3.4); ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); outline(ctx, th, '#5E9C7B', 2.6); for (const a of [0.4, 2.2, 4.1]) { ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 7, 3.4, a, 0, TAU); outline(ctx, th, '#7CCB9E', 2); } ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); outline(ctx, th, '#FF9FB5', 2); }
function snow(ctx: C, th: Theme, x: number, y: number) { for (const [dx, dy, r] of [[-8, 3, 11], [8, 4, 13]] as const) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, Math.PI, TAU); ctx.closePath(); outline(ctx, th, '#F4FBFC', 2.4); } }
function crystal(ctx: C, th: Theme, x: number, y: number, s: number) { path(ctx, [[x, y - 22 * s], [x + 10 * s, y], [x + 4 * s, y + 12 * s], [x - 8 * s, y + 10 * s], [x - 11 * s, y - 2 * s]]); outline(ctx, th, '#9BE0EE', 2.8); ctx.beginPath(); ctx.moveTo(x, y - 20 * s); ctx.lineTo(x - 1 * s, y + 8 * s); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(29,44,53,0.5)'; ctx.stroke(); }
function gearDeco(ctx: C, th: Theme, x: number, y: number, r: number, col: string) { ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; const rr = i % 2 ? r * 0.82 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); outline(ctx, th, col, 3); ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); outline(ctx, th, shade(col, 0.8), 2.4); }

function decorate(ctx: C, th: Theme, map: MapDef) {
  const r = new Stream(seedFrom(`swarm-map:${map.id}`)); const edge = (): [number, number] => { const side = r.int(4); const u = r.float(); const d = 8 + r.float() * 44; return side === 0 ? [u * WORLD.w, d] : side === 1 ? [WORLD.w - d, u * WORLD.h] : side === 2 ? [u * WORLD.w, WORLD.h - d] : [d, u * WORLD.h]; };
  if (map.id === 'meadow_circuit') {
    for (let i = 0; i < 26; i++) { const [x, y] = edge(); const k = r.int(5); if (k < 2) tuft(ctx, th, x, y, '#7DBB78'); else if (k === 2) flower(ctx, th, x, y, ['#FF9FB5', '#FFD66E', '#FFFFFF'][r.int(3)]!); else if (k === 3) mushroom(ctx, th, x, y, 0.9); else fence(ctx, th, x, y); }
    lantern(ctx, th, 70, 70); lantern(ctx, th, 890, 70); lantern(ctx, th, 70, 535); lantern(ctx, th, 890, 535);
  } else if (map.id === 'paper_quarry') {
    for (let i = 0; i < 24; i++) { const [x, y] = edge(); const k = r.int(4); if (k === 0) slate(ctx, th, x, y, '#BFAE8A'); else if (k === 1) chip(ctx, th, x, y, '#A8977A'); else if (k === 2) ridge(ctx, th, x, y, 0.55, '#B9A783'); else { ctx.beginPath(); ctx.moveTo(x - 10, y + 6); ctx.lineTo(x + 10, y - 6); ctx.lineWidth = 3; ctx.strokeStyle = th.ink; ctx.stroke(); } }
    for (const [x, y] of [[480, 20], [940, 300], [480, 580], [20, 300]] as const) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.roundRect(-26, -14, 52, 28, 5); outline(ctx, th, '#E6DAC0', 3); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineWidth = 3; ctx.strokeStyle = th.ink; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); } // the four spawn gates
  } else {
    for (let i = 0; i < 22; i++) { const [x, y] = edge(); const k = r.int(4); if (k < 2) crystal(ctx, th, x, y, 0.7 + r.float() * 0.5); else if (k === 2) snow(ctx, th, x, y); else gearDeco(ctx, th, x, y, 12, '#D9C27A'); }
    for (const [x, y] of [[60, 60], [900, 60], [60, 540], [900, 540]] as const) gearDeco(ctx, th, x, y, 22, '#D9C27A');
  }
}

export function renderBackdrop(ctx: C, th: Theme, mapId: MapId) {
  const map = MAPS[mapId]; const w = WORLD.w, h = WORLD.h;
  ctx.fillStyle = map.ground; ctx.fillRect(0, 0, w, h);
  // soft two-tone patches (large flat shapes, no gradients)
  const r = new Stream(seedFrom(`swarm-ground:${map.id}`)); ctx.fillStyle = th.hc ? map.ground : shade(map.ground, 0.94); for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.ellipse(r.float() * w, r.float() * h, 50 + r.float() * 90, 30 + r.float() * 60, r.float() * 3, 0, TAU); ctx.fill(); }
  // the ring path around the beacon
  ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 300, 180, 0, 0, TAU); ctx.lineWidth = 64; ctx.strokeStyle = th.hc ? map.lane : map.lane; ctx.globalAlpha = th.hc ? 0.4 : 0.75; ctx.stroke(); ctx.globalAlpha = 1;
  if (!th.hc) decorate(ctx, th, map);
  // authored props from the map file
  for (const p of map.props) { const s = p.s ?? 1; if (p.kind === 'bush') bush(ctx, th, p.x, p.y, s, shade(map.ground2, 0.92)); else if (p.kind === 'tuft') tuft(ctx, th, p.x, p.y, '#7DBB78'); else if (p.kind === 'flower') flower(ctx, th, p.x, p.y, '#FF9FB5'); else if (p.kind === 'slate') slate(ctx, th, p.x, p.y, '#BFAE8A'); else if (p.kind === 'chip') chip(ctx, th, p.x, p.y, '#A8977A'); else if (p.kind === 'snow') snow(ctx, th, p.x, p.y); }
  // the only solid things on the map: drawn from the very data the server collides with
  for (const o of map.obstacles) {
    if (o.kind === 'rect') { path(ctx, [[o.x, o.y + o.h], [o.x + 6, o.y], [o.x + o.w - 8, o.y - 4], [o.x + o.w, o.y + o.h]]); outline(ctx, th, '#BFAE8A', 3.4); ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 5); outline(ctx, th, '#CDBD98', 3.6); ctx.beginPath(); ctx.moveTo(o.x + 12, o.y + o.h * 0.6); ctx.lineTo(o.x + o.w - 14, o.y + o.h * 0.35); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(29,44,53,0.5)'; ctx.stroke(); }
    else planter(ctx, th, o.x, o.y);
  }
  // wind currents (they push enemies): arrows drawn faintly so the push is understandable
  for (const wd of map.wind) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(wd.x, wd.y, wd.w, wd.h, 24); ctx.fill(); ctx.globalAlpha = 0.75; ctx.strokeStyle = th.ink; ctx.lineWidth = 2.4; const dir = Math.sign(wd.vx || 1); for (let x = wd.x + 40; x < wd.x + wd.w - 30; x += 70) { ctx.beginPath(); ctx.moveTo(x, wd.y + wd.h / 2); ctx.lineTo(x + 26 * dir, wd.y + wd.h / 2); ctx.lineTo(x + 18 * dir, wd.y + wd.h / 2 - 7); ctx.moveTo(x + 26 * dir, wd.y + wd.h / 2); ctx.lineTo(x + 18 * dir, wd.y + wd.h / 2 + 7); ctx.stroke(); } ctx.restore(); }
  // frame
  ctx.lineWidth = 8; ctx.strokeStyle = th.ink; ctx.strokeRect(0, 0, w, h);
}
