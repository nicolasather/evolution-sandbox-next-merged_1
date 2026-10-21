/** Clue Racing canvas renderer: a storybook "toy table" map drawn with the shared prop painter (components/quiz/art/props.ts) plus four hand-set biomes.
 *  Original flat shapes, ink outlines, no faces, no copied art. The world is 5200×3300 and is drawn per frame through a camera with culling (so a phone never holds a
 *  giant bitmap). Scenery is a deterministic function of the map id, so the same course always looks the same on every device. Everything drawn is a pure function of
 *  (public state, smoothed token positions, ambient time): the renderer can never change the game.
 *  Motion budget: ambient loops are quantised to 12 fps, at most 90 particles are alive at once, and `reduced` motion freezes every loop and every camera ease. */
import { drawProp, hash2, PAL, rr, type PropKind } from '../art/props';
import { ARRIVE_R, HUB_R, ROAD_R, SPUR_R, TICK_MS, WORLD_H, WORLD_W } from '@/lib/quiz/cr/balance';
import type { FxRec, OptionId, Role } from '@/lib/quiz/cr/domain';
import { dist, distToPoly, gateOpen, MAP_INFO, stationName, type Course, type LegGeo, type Pt } from '@/lib/quiz/cr/maps';
import type { CRPublic } from '@/lib/quiz/cr/public';
import { glyph, INK, PAPER, ROLE_GLYPH, ROLE_INFO, TEAM_COLORS, TEAM_DARK, TEAM_SHAPE, teamMark } from './art';

export type DrawDot = { id: string; x: number; y: number; vx: number; vy: number; role: Role; team: number; label: string; idle: boolean; mine: boolean; mate: boolean; flag: boolean };
export type CRFrame = { pub: CRPublic; course: Course; geo: LegGeo | null; dots: DrawDot[]; tick: number; teamIndex: (id: string | null | undefined) => number };
export type View = { cx: number; cy: number; scale: number };
export type DrawOpts = { width: number; height: number; view: View; time: number; reduced: boolean; lowFx: boolean; contrast: boolean; mini: boolean; showNames: boolean; focus: 'race' | 'overview' };
export const PARTICLE_CAP = 90;

// ── scenery ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Prop = { kind: PropKind; x: number; y: number; s: number; seed: number; tint: number };
type Patch = { x: number; y: number; rx: number; ry: number; kind: 'water' | 'soft' | 'cloud' };
type Scenery = { props: Prop[]; patches: Patch[]; roads: Pt[][] };
const KITS: Record<string, { near: readonly PropKind[]; far: readonly PropKind[] }> = {
  sunleaf_passage: { near: ['tree', 'bush', 'flowers', 'fence', 'haystack', 'mushroom', 'rock', 'lantern', 'cart', 'windmill', 'pond'], far: ['tree', 'tree', 'bush', 'flowers', 'haystack', 'windmill'] },
  tideglass_harbor: { near: ['lantern', 'barrel', 'crate', 'reeds', 'boat', 'rock', 'torch', 'tent', 'banner', 'cart', 'pond'], far: ['boat', 'reeds', 'boat', 'barrel', 'cloud', 'lantern'] },
  copperwind_borough: { near: ['gear', 'clock', 'crate', 'barrel', 'torch', 'banner', 'cart', 'fence', 'lantern', 'ruins', 'totem'], far: ['gear', 'clock', 'crate', 'torch', 'ruins', 'banner'] },
  starpetal_heights: { near: ['crystal', 'cloud', 'pine', 'rock', 'tent', 'torch', 'banner', 'flowers', 'totem', 'paperfold', 'lantern'], far: ['crystal', 'cloud', 'pine', 'paperfold', 'flowers', 'cloud'] },
};
const sceneryCache = new Map<string, Scenery>();
function sceneryFor(course: Course): Scenery {
  const hit = sceneryCache.get(course.mapId); if (hit) return hit;
  const roads: Pt[][] = []; for (const p of course.pairs) roads.push(p.main, p.short, p.scenic); for (const l of course.spurs) for (const sp of l) roads.push(sp.pts);
  const clear = (x: number, y: number) => { let d = Infinity; const p = { x, y }; for (const r of roads) { const q = distToPoly(p, r); if (q < d) d = q; if (d < 40) return d; } for (const s of course.stations) d = Math.min(d, dist(s, p) - HUB_R + ROAD_R); return d; };
  const kit = KITS[course.mapId]!; const props: Prop[] = []; const patches: Patch[] = []; const m = course.mapId;
  const salt = MAP_INFO[m].title.length * 31;
  for (let gy = 60; gy < WORLD_H; gy += 120) for (let gx = 60; gx < WORLD_W; gx += 120) {
    const jx = gx + (hash2(gx, gy, salt) - 0.5) * 100; const jy = gy + (hash2(gx, gy, salt + 1) - 0.5) * 100; const c = clear(jx, jy);
    if (c < ROAD_R + 70) continue; const r = hash2(gx, gy, salt + 2); if (r > (m === 'tideglass_harbor' ? 0.5 : 0.62)) continue;
    const far = c > 260; const list = far ? kit.far : kit.near; const kind = list[Math.floor(hash2(gx, gy, salt + 3) * list.length)]!;
    props.push({ kind, x: jx, y: jy, s: (far ? 96 : 84) + hash2(gx, gy, salt + 4) * 40, seed: hash2(gx, gy, salt + 5), tint: Math.floor(hash2(gx, gy, salt + 6) * 3) });
  }
  const step = m === 'tideglass_harbor' ? 260 : 340;
  for (let gy = 140; gy < WORLD_H; gy += step) for (let gx = 140; gx < WORLD_W; gx += step) {
    const x = gx + (hash2(gx, gy, salt + 7) - 0.5) * 180; const y = gy + (hash2(gx, gy, salt + 8) - 0.5) * 180; const c = clear(x, y); const k = hash2(gx, gy, salt + 9);
    if (m === 'tideglass_harbor' && c > 230 && k < 0.78) patches.push({ x, y, rx: Math.min(300, c * 0.95), ry: Math.min(210, c * 0.7), kind: 'water' });
    else if (m === 'sunleaf_passage' && c > 200 && k < 0.16) patches.push({ x, y, rx: Math.min(190, c * 0.6), ry: Math.min(120, c * 0.4), kind: 'water' });
    else if (m === 'starpetal_heights' && k < 0.55) patches.push({ x, y, rx: 150 + k * 260, ry: 70 + k * 120, kind: 'cloud' });
    else if (k < 0.5) patches.push({ x, y, rx: 160 + k * 180, ry: 90 + k * 90, kind: 'soft' });
  }
  const out = { props: props.sort((a, b) => a.y - b.y), patches, roads }; sceneryCache.set(m, out); return out;
}
/** Landmark forms: every map kind belongs to one of twelve drawn families, so each map shows at least three distinct silhouettes. */
const FAMILY: Record<string, string> = {
  bridge: 'span', glass: 'span', rivets: 'span', steps: 'span', petals: 'span', orchard: 'arch', arch: 'arch', kiosk: 'stall', market: 'stall', cart: 'stall', awnings: 'stall', pavilion: 'hall', roofs: 'hall', tiles: 'hall',
  pond: 'water', fountain: 'water', ford: 'water', buoys: 'water', willow: 'tree', blossom: 'tree', signpost: 'post', mast: 'post', bunting: 'post', ropes: 'post', banners: 'post', lamps: 'post',
  lighthouse: 'tower', spire: 'tower', lift: 'tower', dome: 'dome', clock: 'dome', bell: 'dome', gears: 'gear', pipes: 'gear', crane: 'crane', nets: 'crane', boats: 'boat', tram: 'boat', island: 'island', terrace: 'island',
};
function landmark(g: CanvasRenderingContext2D, kind: string, x: number, y: number, s: number, time: number, c: { a: string; d: string; w: string }, seed: number) {
  const fam = FAMILY[kind] ?? 'hall'; g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = 'rgba(23,37,58,.18)'; g.beginPath(); g.ellipse(0, 6, 54, 15, 0, 0, 7); g.fill();
  const box = (px: number, py: number, w: number, h: number, f: string, r = 4) => { rr(g, px, py, w, h, r); g.fillStyle = f; g.fill(); g.stroke(); };
  if (fam === 'tower') { box(-20, -86, 40, 92, PAPER, 6); box(-20, -86, 40, 22, c.a); box(-20, -42, 40, 22, c.a); box(-14, -104, 28, 20, c.d, 8); g.beginPath(); g.moveTo(-8, -104); g.lineTo(0, -122); g.lineTo(8, -104); g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); g.fillStyle = `rgba(255,236,140,${0.5 + 0.4 * Math.sin(time * 3 + seed * 6)})`; g.beginPath(); g.arc(0, -94, 6, 0, 7); g.fill(); }
  else if (fam === 'dome') { box(-44, -30, 88, 36, PAPER, 6); g.beginPath(); g.arc(0, -30, 40, Math.PI, 0); g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); g.beginPath(); g.moveTo(0, -70); g.lineTo(0, -92); g.stroke(); g.beginPath(); g.arc(0, -94, 5, 0, 7); g.fillStyle = c.d; g.fill(); g.stroke(); box(-8, -20, 16, 26, c.d, 6); }
  else if (fam === 'arch') { box(-52, -50, 22, 56, PAPER, 6); box(30, -50, 22, 56, PAPER, 6); g.beginPath(); g.arc(0, -48, 52, Math.PI, 0); g.lineTo(30, -48); g.arc(0, -48, 30, 0, Math.PI, true); g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); }
  else if (fam === 'span') { g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(0, -54, 60, 0); g.lineTo(60, 12); g.quadraticCurveTo(0, -38, -60, 12); g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 22, -20 + Math.abs(i) * 8); g.lineTo(i * 22, 6); g.stroke(); } }
  else if (fam === 'stall') { box(-40, -30, 80, 36, PAPER, 6); for (let i = 0; i < 5; i++) { g.beginPath(); g.rect(-40 + i * 16, -52, 16, 24); g.fillStyle = i % 2 ? PAPER : c.a; g.fill(); g.stroke(); } box(-10, -14, 20, 20, c.d, 4); }
  else if (fam === 'hall') { box(-46, -34, 92, 40, PAPER, 6); g.beginPath(); g.moveTo(-54, -34); g.lineTo(0, -78); g.lineTo(54, -34); g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); box(-10, -20, 20, 26, c.d, 5); }
  else if (fam === 'water') { g.beginPath(); g.ellipse(0, -4, 56, 24, 0, 0, 7); g.fillStyle = c.w; g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, -4, 34, 13, 0, 0, 7); g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke(); g.strokeStyle = INK; box(-5, -40, 10, 36, PAPER, 4); g.beginPath(); g.arc(0, -42 + Math.sin(time * 4) * 2, 9, 0, 7); g.fillStyle = c.w; g.fill(); g.stroke(); }
  else if (fam === 'tree') { box(-6, -40, 12, 46, '#9B6B43', 4); for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(i * 24, -50 + Math.abs(i) * 10, 28, 36, i * 0.2, 0, 7); g.fillStyle = i ? c.d : c.a; g.fill(); g.stroke(); } }
  else if (fam === 'post') { box(-5, -86, 10, 92, '#9B6B43', 3); g.beginPath(); g.moveTo(5, -82); g.lineTo(50 + Math.sin(time * 3 + seed * 5) * 4, -72); g.lineTo(5, -52); g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); box(-24, -36, 48, 16, PAPER, 4); }
  else if (fam === 'gear') { g.save(); g.translate(0, -44); g.rotate(time * 0.6); g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 34 : 44; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fillStyle = PAPER; g.fill(); g.stroke(); g.restore(); }
  else if (fam === 'crane') { box(-8, -70, 16, 76, c.d, 3); g.beginPath(); g.moveTo(-8, -70); g.lineTo(54, -76); g.stroke(); g.beginPath(); g.moveTo(48, -75); g.lineTo(48, -40 + Math.sin(time * 2) * 6); g.stroke(); box(38, -40 + Math.sin(time * 2) * 6, 20, 14, c.a, 3); box(-30, 0, 60, 8, PAPER, 3); }
  else if (fam === 'boat') { g.beginPath(); g.moveTo(-50, -10); g.lineTo(50, -10); g.lineTo(34, 12); g.lineTo(-34, 12); g.closePath(); g.fillStyle = c.a; g.fill(); g.stroke(); box(-3, -66, 6, 58, '#9B6B43', 2); g.beginPath(); g.moveTo(3, -64); g.lineTo(34, -20); g.lineTo(3, -20); g.closePath(); g.fillStyle = PAPER; g.fill(); g.stroke(); }
  else { g.beginPath(); g.ellipse(0, 0, 58, 20, 0, 0, 7); g.fillStyle = c.a; g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, -10, 50, 15, 0, 0, 7); g.fillStyle = c.d; g.fill(); g.stroke(); drawProp(g, 'flowers', 0, -14, 52, time, seed); }
  g.restore();
}
function ambient(g: CanvasRenderingContext2D, map: string, left: number, top: number, w: number, h: number, scale: number, tq: number, budget: { n: number }) {
  const n = Math.min(budget.n, 18); const col = map === 'sunleaf_passage' ? '#FFD36C' : map === 'tideglass_harbor' ? 'rgba(255,255,255,.85)' : map === 'copperwind_borough' ? '#F2C28B' : '#FFFFFF';
  for (let i = 0; i < n; i++) {
    const px = left + ((i * 197 + tq * 24 * (1 + (i % 3) * 0.3)) % w); const py = top + ((i * 331 + Math.sin(tq + i) * 40 + tq * (map === 'tideglass_harbor' ? -8 : 14)) % h + h) % h;
    g.fillStyle = col; g.globalAlpha = 0.5; g.beginPath();
    if (map === 'starpetal_heights') { g.arc(px, py, 3.5 / scale, 0, 7); } else if (map === 'tideglass_harbor') { g.arc(px, py, 4 / scale, 0, 7); } else { g.ellipse(px, py, 6 / scale, 3 / scale, i, 0, 7); }
    g.fill();
  }
  g.globalAlpha = 1; budget.n -= n;
}

// ── avatars ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A bean-shaped explorer with no face, a team-coloured coat with the team's shape on the chest, a role-coloured scarf and a role accessory carried on the back. */
function accessory(g: CanvasRenderingContext2D, kind: string, c: string) {
  g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 2.4;
  if (kind === 'compass') { g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke(); }
  else if (kind === 'spyglass') { rr(g, -11, -4, 22, 8, 3); g.fill(); g.stroke(); g.beginPath(); g.arc(11, 0, 5, 0, 7); g.fillStyle = PAPER; g.fill(); g.stroke(); }
  else if (kind === 'lantern') { rr(g, -6, -8, 12, 16, 3); g.fillStyle = '#FFE08A'; g.fill(); g.stroke(); g.beginPath(); g.arc(0, -9, 4, Math.PI, 0); g.stroke(); }
  else if (kind === 'scroll') { rr(g, -11, -5, 22, 10, 5); g.fillStyle = PAPER; g.fill(); g.stroke(); g.beginPath(); g.arc(-11, 0, 4, 0, 7); g.fillStyle = c; g.fill(); g.stroke(); }
  else if (kind === 'plank') { g.save(); g.rotate(-0.5); rr(g, -14, -4, 28, 8, 2); g.fillStyle = '#C79A64'; g.fill(); g.stroke(); g.beginPath(); g.moveTo(-6, -4); g.lineTo(-6, 4); g.moveTo(6, -4); g.lineTo(6, 4); g.stroke(); g.restore(); }
  else { rr(g, -9, -8, 18, 16, 5); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-9, -2); g.lineTo(9, -2); g.stroke(); }
}
function avatar(g: CanvasRenderingContext2D, d: DrawDot, time: number, reduced: boolean, contrast: boolean) {
  const t = d.team % 4; const info = ROLE_INFO[d.role]; const moving = Math.hypot(d.vx, d.vy) > 0.2; const bob = moving && !reduced ? Math.sin(time * 14 + d.x * 0.02) * 2.2 : 0;
  const face = moving ? Math.sign(d.vx || 1) : 1; g.save(); g.translate(d.x, d.y); g.globalAlpha = d.idle ? 0.5 : 1;
  g.fillStyle = 'rgba(23,37,58,.25)'; g.beginPath(); g.ellipse(0, 18, 20, 7, 0, 0, 7); g.fill();
  g.save(); g.translate(-face * 20, -6 + bob); accessory(g, info.accessory, info.color); g.restore();
  g.translate(0, bob); g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-18, 14); g.quadraticCurveTo(-24, -14, 0, -24); g.quadraticCurveTo(24, -14, 18, 14); g.quadraticCurveTo(0, 22, -18, 14); g.closePath(); g.fillStyle = TEAM_COLORS[t]!; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-17, -6); g.quadraticCurveTo(0, 2, 17, -6); g.lineWidth = 6; g.strokeStyle = info.color; g.stroke(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
  g.fillStyle = PAPER; g.strokeStyle = TEAM_DARK[t]!; g.lineWidth = 2; teamMark(g, TEAM_SHAPE[t]!, 0, 6, 6.5); g.fill(); g.stroke();
  if (d.flag) { g.save(); g.translate(face * 4, -26); g.lineWidth = 3; g.strokeStyle = INK; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke(); g.beginPath(); g.moveTo(0, -34); g.lineTo(26 + (reduced ? 0 : Math.sin(time * 6) * 3), -28); g.lineTo(0, -20); g.closePath(); g.fillStyle = '#FFD36C'; g.fill(); g.stroke(); g.restore(); }
  if (d.mine) { const p = reduced ? 0 : Math.sin(time * 5) * 3; g.strokeStyle = contrast ? '#000' : INK; g.lineWidth = 3; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -36 - p); g.lineTo(9, -50 - p); g.lineTo(-9, -50 - p); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
}

// ── effects ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function fxDraw(g: CanvasRenderingContext2D, f: FxRec, age: number, budget: { n: number }, time: number, reduced: boolean) {
  const k = Math.min(1, age / 40); const inv = 1 - k; g.save(); g.translate(f.x, f.y); g.lineWidth = 4; g.strokeStyle = INK; g.globalAlpha = Math.max(0, 1 - k * k);
  const ring = (r: number, col: string) => { g.beginPath(); g.arc(0, 0, r, 0, 7); g.strokeStyle = col; g.lineWidth = 6 * inv + 2; g.stroke(); };
  const bits = (n: number, spread: number, col: (i: number) => string, size = 7) => { const m = Math.min(n, budget.n); budget.n -= m; for (let i = 0; i < m; i++) { const a = (i / Math.max(1, m)) * Math.PI * 2 + f.tick; const r = spread * Math.sqrt(k); g.fillStyle = col(i); g.fillRect(Math.cos(a) * r - size / 2, Math.sin(a) * r - size / 2 - 30 * k * (1 - k) * 4, size, size); } };
  switch (f.kind) {
    case 'checkpoint': ring(60 + 220 * k, '#FFD36C'); bits(14, 190, (i) => TEAM_COLORS[i % 4]!); break;
    case 'arrive': ring(40 + 140 * k, '#8FD3EC'); bits(8, 130, (i) => ['#FFD36C', '#F59BB0', '#8FD3EC'][i % 3]!, 6); break;
    case 'stamp': { const s = 1.6 - 0.6 * Math.min(1, k * 5); g.scale(s, s); g.beginPath(); g.arc(0, -10, 34, 0, 7); g.strokeStyle = '#2F8F6B'; g.lineWidth = 6; g.stroke(); g.beginPath(); g.moveTo(-14, -10); g.lineTo(-4, 2); g.lineTo(16, -24); g.stroke(); break; }
    case 'wrong': { const sh = reduced ? 0 : Math.sin(age * 2.2) * 6 * inv; g.translate(sh, -20); g.strokeStyle = '#D9534F'; g.lineWidth = 7; g.beginPath(); g.moveTo(-18, -18); g.lineTo(18, 18); g.moveTo(18, -18); g.lineTo(-18, 18); g.stroke(); break; }
    case 'pass': { g.beginPath(); g.arc(0, -50 * Math.sin(k * Math.PI), 14, 0, 7); g.fillStyle = '#FFD36C'; g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); bits(6, 90, () => '#fff', 5); break; }
    case 'beacon': { const h = 220 * Math.min(1, age / 6); g.beginPath(); g.moveTo(-16, 0); g.lineTo(-44, -h); g.lineTo(44, -h); g.lineTo(16, 0); g.closePath(); g.fillStyle = 'rgba(255,224,138,.38)'; g.fill(); break; }
    case 'bridge': for (let i = 0; i < 6; i++) { if (age > i * 4) { g.fillStyle = '#C79A64'; g.fillRect(-60 + i * 22, -8, 18, 16); g.strokeRect(-60 + i * 22, -8, 18, 16); } } break;
    case 'pulse': ring(30 + 260 * k, '#F6A04D'); ring(10 + 160 * k, '#FFE08A'); break;
    case 'sight': { g.beginPath(); g.ellipse(0, -10, 80 * (0.4 + k), 40 * (0.4 + k), 0, 0, 7); g.strokeStyle = '#4AA8E0'; g.lineWidth = 5; g.stroke(); break; }
    case 'fold': { g.rotate(0.4); for (let i = 0; i < 3; i++) { g.strokeStyle = '#9B7BE0'; g.strokeRect(-70 + i * 14, -50 + i * 8, 140 - i * 28, 100 - i * 16); } break; }
    case 'finish': ring(80 + 360 * k, '#FFD36C'); bits(26, 320, (i) => TEAM_COLORS[i % 4]!, 9); break;
    case 'inspect': { const a = reduced ? 0.8 : age * 0.3; g.beginPath(); g.arc(Math.cos(a) * 14, Math.sin(a) * 14, 26, 0, 7); g.strokeStyle = '#4AA8E0'; g.lineWidth = 5; g.stroke(); g.beginPath(); g.moveTo(Math.cos(a) * 14 + 18, Math.sin(a) * 14 + 18); g.lineTo(Math.cos(a) * 14 + 40, Math.sin(a) * 14 + 40); g.stroke(); break; }
    default: ring(50 * k + 20, '#fff');
  }
  g.restore(); void time;
}

// ── frame ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const OPT_LABEL: Record<OptionId, string> = { a: 'Main Road', b: 'Short Cut', c: 'Scenic Loop' };
function strokePath(g: CanvasRenderingContext2D, pts: readonly Pt[]) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); }
export function fitView(width: number, height: number, box: { x0: number; y0: number; x1: number; y1: number }, pad = 140): View {
  const w = box.x1 - box.x0 + pad * 2; const h = box.y1 - box.y0 + pad * 2; return { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, scale: Math.max(0.12, Math.min(width / w, height / h)) };
}
export const WORLD_BOX = { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H };
export const legBox = (geo: LegGeo) => { const pts: Pt[] = [geo.hubA, geo.hubB, ...geo.options.flatMap((o) => o.path), ...geo.spurs.flatMap((s) => s.pts)]; return { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) }; };

export function drawCR(g: CanvasRenderingContext2D, f: CRFrame, o: DrawOpts) {
  const { width: W, height: H, view, reduced } = o; const pal = MAP_INFO[f.course.mapId].palette; const live = f.pub.live; const geo = f.geo; const sc = view.scale;
  const tq = reduced ? 0 : Math.floor(o.time * 12) / 12; const budget = { n: o.lowFx ? 36 : PARTICLE_CAP };
  const left = view.cx - W / 2 / sc; const top = view.cy - H / 2 / sc; const right = left + W / sc; const bottom = top + H / sc; const vis = (x: number, y: number, m = 160) => x > left - m && x < right + m && y > top - m && y < bottom + m;
  g.save(); g.fillStyle = o.contrast ? '#F7F3E6' : pal.ground; g.fillRect(0, 0, W, H); g.scale(sc, sc); g.translate(-left, -top);
  const S = sceneryFor(f.course);
  // ground decoration
  for (const p of S.patches) { if (!vis(p.x, p.y, p.rx)) continue; g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 7);
    if (p.kind === 'water') { g.fillStyle = pal.water; g.fill(); g.lineWidth = 4; g.strokeStyle = 'rgba(23,37,58,.55)'; g.stroke(); g.beginPath(); g.ellipse(p.x, p.y, p.rx * 0.7, p.ry * 0.62, 0, 0, 7); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.stroke(); }
    else if (p.kind === 'cloud') { g.fillStyle = 'rgba(255,255,255,.34)'; g.fill(); } else { g.fillStyle = pal.ground2; g.globalAlpha = 0.65; g.fill(); g.globalAlpha = 1; } }
  if (f.course.mapId === 'copperwind_borough' && sc > 0.25) { g.strokeStyle = 'rgba(122,74,51,.14)'; g.lineWidth = 3; for (let x = Math.floor(left / 160) * 160; x < right; x += 160) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke(); } for (let y = Math.floor(top / 160) * 160; y < bottom; y += 160) { g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke(); } }
  // roads: every authored road is faintly visible; the current leg's roads are bright
  const legIds = new Set<string>(); const inLeg = (i: number) => !!geo && i >= geo.a && i < geo.b; const chosen = live?.option ?? null; const host = f.pub.view !== 'student'; const overview = o.focus === 'overview';
  g.lineCap = 'round'; g.lineJoin = 'round';
  f.course.pairs.forEach((p) => {
    if (inLeg(p.i)) return; const a = p.main[0]!; const b = p.main[p.main.length - 1]!; if (!vis((a.x + b.x) / 2, (a.y + b.y) / 2, 520)) return;
    for (const pts of [p.scenic, p.short]) { strokePath(g, pts); g.lineWidth = 34; g.strokeStyle = 'rgba(23,37,58,.14)'; g.stroke(); }
    strokePath(g, p.main); g.lineWidth = ROAD_R * 1.5 + 8; g.strokeStyle = 'rgba(23,37,58,.35)'; g.stroke(); g.lineWidth = ROAD_R * 1.5; g.strokeStyle = pal.road; g.globalAlpha = 0.78; g.stroke(); g.globalAlpha = 1;
  });
  void legIds;
  if (geo) {
    const showAll = host || overview || !!live?.sight || f.pub.phase === 'route_choice' || f.pub.phase === 'checkpoint'; const near = (pts: readonly Pt[]) => showAll || pts.some((q) => dist(q, { x: view.cx, y: view.cy }) < 900);
    for (const opt of geo.options) {
      const offered = geo.offered.includes(opt.id); const mine = !chosen || opt.id === chosen || host || f.pub.format !== 'split_route'; const walk = opt.id === (chosen ?? 'a') || (host && offered) || (f.pub.format === 'split_route' && f.pub.phase === 'route_choice' && offered);
      const bright = walk && near(opt.path) && (offered || f.pub.format !== 'split_route'); strokePath(g, opt.path);
      g.lineWidth = bright ? ROAD_R * 2 + 10 : 36; g.strokeStyle = bright ? INK : 'rgba(23,37,58,.2)'; g.stroke();
      if (bright) { strokePath(g, opt.path); g.lineWidth = ROAD_R * 2; g.strokeStyle = opt.id === 'b' ? '#F0C27A' : opt.id === 'c' ? '#E9B6C8' : pal.road; g.globalAlpha = mine ? 1 : 0.7; g.stroke(); g.globalAlpha = 1; strokePath(g, opt.path); g.setLineDash([22, 26]); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke(); g.setLineDash([]); }
    }
    // gates on the short road: open/closed is visible to everyone; the countdown ring only with Sight / Scout Echo / Fast Map
    const sb = geo.options.find((x) => x.id === 'b')!; const gt = f.tick;
    for (const pairIdx of sb.gates) {
      const p = f.course.pairs[pairIdx]!; const a = p.short[1]!; const b = p.short[2]!; const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2; if (!vis(mx, my)) continue; const open = gateOpen(gt, pairIdx); const ang = Math.atan2(b.y - a.y, b.x - a.x);
      g.save(); g.translate(mx, my); g.rotate(ang); g.lineWidth = 4; g.strokeStyle = INK; g.fillStyle = '#9B6B43'; for (const sy of [-ROAD_R, ROAD_R]) { g.fillRect(-8, sy - 14, 16, 28); g.strokeRect(-8, sy - 14, 16, 28); }
      if (open) { g.fillStyle = '#3DBE8B'; g.fillRect(-6, -ROAD_R - 26, 12, 24); g.strokeRect(-6, -ROAD_R - 26, 12, 24); } else { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? PAPER : '#F56F59'; g.fillRect(-6, -ROAD_R + 10 + i * 22, 12, 22); g.strokeRect(-6, -ROAD_R + 10 + i * 22, 12, 22); } }
      g.restore();
      const gi = live?.gates?.find((x) => x.pair === pairIdx); if (gi) { const secs = Math.ceil((gi.flipInTicks * TICK_MS) / 1000); g.fillStyle = INK; g.font = '700 26px system-ui'; g.textAlign = 'center'; g.fillText(`${open ? 'closes' : 'opens'} in ${secs}s`, mx, my - ROAD_R - 38); }
    }
    if (live?.bridge) {
      const b = live.bridge; if (b.open) { g.lineCap = 'butt'; g.beginPath(); g.moveTo(geo.hubA.x, geo.hubA.y); g.lineTo(geo.hubB.x, geo.hubB.y); g.lineWidth = ROAD_R * 2; g.strokeStyle = '#C79A64'; g.stroke(); g.setLineDash([14, 18]); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.setLineDash([]); g.lineCap = 'round'; }
      else if (vis(b.socket.x, b.socket.y)) { g.beginPath(); g.arc(b.socket.x, b.socket.y, 34, 0, 7); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); g.setLineDash([8, 8]); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.setLineDash([]); glyph(g, 'M3 15h18M5 15v4M19 15v4M3 11h18', b.socket.x, b.socket.y, 30, INK, 2.4); }
    }
    // spurs of the destination hub
    for (const sp of geo.spurs) {
      if (!vis(sp.end.x, sp.end.y, 400)) continue; strokePath(g, sp.pts); g.lineWidth = SPUR_R * 2 + 8; g.strokeStyle = INK; g.stroke(); g.lineWidth = SPUR_R * 2; g.strokeStyle = pal.road; g.stroke();
      const doneIdx = f.pub.live?.objective?.stampIdx ?? 0; void doneIdx;
    }
  }
  // station plazas
  f.course.stations.forEach((st, i) => {
    if (!vis(st.x, st.y, 220)) return; const isLegHub = !!geo && (i === geo.a || i === geo.b);
    if (!isLegHub) { // a way-station on the road: a small signpost, never a plaza you could mistake for walkable ground
      g.fillStyle = 'rgba(23,37,58,.2)'; g.beginPath(); g.ellipse(st.x, st.y + 6, 30, 10, 0, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = '#9B6B43'; g.fillRect(st.x - 5, st.y - 52, 10, 56); g.strokeRect(st.x - 5, st.y - 52, 10, 56);
      g.fillStyle = PAPER; rr(g, st.x - 40, st.y - 76, 80, 28, 6); g.fill(); g.stroke();
      if (sc > 0.28) { g.fillStyle = INK; g.font = '700 15px system-ui'; g.textAlign = 'center'; g.fillText(stationName(f.course.mapId, i).replace(' Post', ''), st.x, st.y - 57); }
      return;
    }
    g.beginPath(); g.arc(st.x, st.y, HUB_R, 0, 7); g.fillStyle = 'rgba(23,37,58,.28)'; g.fill(); g.beginPath(); g.arc(st.x, st.y, HUB_R - 8, 0, 7); g.fillStyle = isLegHub ? pal.road : 'rgba(255,247,232,.55)'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    if (i === 0 || i === f.course.stations.length - 1) { g.save(); g.translate(st.x, st.y); g.fillStyle = INK; g.fillRect(-60, -10, 120, 20); for (let k = 0; k < 8; k++) for (let r = 0; r < 2; r++) { g.fillStyle = (k + r) % 2 ? PAPER : INK; g.fillRect(-60 + k * 15, -10 + r * 10, 15, 10); } g.restore(); }
    if (sc > 0.28 || isLegHub) { g.fillStyle = INK; g.font = `700 ${Math.round(26 / Math.max(0.5, sc))}px system-ui`; g.textAlign = 'center'; const label = stationName(f.course.mapId, i); g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(label, st.x, st.y - HUB_R - 14); g.fillText(label, st.x, st.y - HUB_R - 14); }
  });
  // y-sorted drawables: scenery, landmarks, spur sites, avatars
  type Item = { y: number; draw: () => void }; const items: Item[] = []; const lc = { a: pal.accent, d: pal.deep, w: pal.water };
  for (const p of S.props) { if (!vis(p.x, p.y, 120)) continue; items.push({ y: p.y, draw: () => drawProp(g, p.kind, p.x, p.y, p.s, tq, p.seed, p.tint) }); }
  for (const pg of f.course.pairs) { if (!vis(pg.landmark.x, pg.landmark.y, 160)) continue; items.push({ y: pg.landmark.y, draw: () => landmark(g, pg.landmark.kind, pg.landmark.x, pg.landmark.y, 116, tq, lc, hash2(pg.i, 3)) }); }
  if (geo) {
    const hubDist = (p: Pt) => dist(p, { x: view.cx, y: view.cy }); const stampIdx = live?.objective?.stampIdx ?? 0; const target = live?.objective?.target ?? null; void stampIdx;
    geo.spurs.forEach((sp) => {
      if (!vis(sp.end.x, sp.end.y, 200)) return;
      items.push({ y: sp.end.y, draw: () => {
        landmark(g, sp.kind, sp.end.x, sp.end.y - 6, 96, tq, lc, hash2(sp.idx, 7)); g.beginPath(); g.arc(sp.end.x, sp.end.y + 6, SPUR_R, 0, 7); g.strokeStyle = target === sp.idx ? '#FFD36C' : INK; g.lineWidth = target === sp.idx ? 8 : 4; g.setLineDash([10, 8]); g.stroke(); g.setLineDash([]);
        if (o.showNames || live?.names || hubDist(sp.end) < 720 || host) { g.font = `700 ${Math.round(24 / Math.max(0.55, sc))}px system-ui`; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = PAPER; g.strokeText(sp.name, sp.end.x, sp.end.y + SPUR_R + 34); g.fillStyle = INK; g.fillText(sp.name, sp.end.x, sp.end.y + SPUR_R + 34); }
      } });
    });
  }
  for (const d of f.dots) items.push({ y: d.y, draw: () => avatar(g, d, tq, reduced, o.contrast) });
  items.sort((a, b) => a.y - b.y); for (const it of items) it.draw();
  // route lamps, team cues, effects
  if (live?.lamp) { live.lamp.forEach((l, i) => { const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(tq * 6 + i); g.beginPath(); g.arc(l.x, l.y, 14 * pulse, 0, 7); g.fillStyle = '#FFE08A'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); }); budget.n -= live.lamp.length; }
  if (live) for (const c of live.cues) if (c.kind === 'beacon' && c.x !== undefined && c.y !== undefined) { g.beginPath(); g.moveTo(c.x - 14, c.y); g.lineTo(c.x - 40, c.y - 220); g.lineTo(c.x + 40, c.y - 220); g.lineTo(c.x + 14, c.y); g.closePath(); g.fillStyle = 'rgba(255,224,138,.32)'; g.fill(); g.beginPath(); g.arc(c.x, c.y - 6, 12, 0, 7); g.fillStyle = '#FFE08A'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); }
  if (live && !o.lowFx) for (const fx of live.fx) { const age = f.tick - fx.tick; if (age < 0 || age > 40) continue; if (reduced && age > 12) continue; fxDraw(g, fx, age, budget, tq, reduced); }
  if (!reduced && !o.lowFx && budget.n > 0) ambient(g, f.course.mapId, left, top, right - left, bottom - top, sc, o.time, budget);
  g.restore();
  // screen space: objective arrow (when the goal is off-screen) and the minimap
  if (geo && o.mini && f.pub.phase === 'race' && o.focus === 'race') {
    const me = f.dots.find((d) => d.mine); const goal = live?.objective && !live.objective.done ? (live.objective.target !== null && live.objective.target >= 0 ? geo.spurs[live.objective.target]?.end : geo.hubB) ?? geo.hubB : geo.hubB;
    const sx = (goal.x - left) * sc; const sy = (goal.y - top) * sc;
    if (me && (sx < 24 || sx > W - 24 || sy < 70 || sy > H - 24)) { const cx = W / 2, cy = H / 2; const a = Math.atan2(sy - cy, sx - cx); const r = Math.min(W, H) / 2 - 40; g.save(); g.translate(cx + Math.cos(a) * r * (W / Math.min(W, H)) * 0.82, cy + Math.sin(a) * r * 0.9); g.rotate(a); g.beginPath(); g.moveTo(16, 0); g.lineTo(-10, -12); g.lineTo(-10, 12); g.closePath(); g.fillStyle = '#FFD36C'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); g.restore(); }
  }
  if (o.mini && o.focus === 'race') {
    const mw = Math.min(150, W * 0.28); const mh = mw * (WORLD_H / WORLD_W); const mx = W - mw - 10; const my = 56; const k = mw / WORLD_W;
    g.save(); g.globalAlpha = 0.94; rr(g, mx - 3, my - 3, mw + 6, mh + 6, 10); g.fillStyle = PAPER; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
    g.fillStyle = pal.ground; g.fillRect(mx, my, mw, mh); g.lineWidth = 2; g.strokeStyle = INK; g.beginPath(); f.course.stations.forEach((s, i) => (i ? g.lineTo(mx + s.x * k, my + s.y * k) : g.moveTo(mx + s.x * k, my + s.y * k))); g.stroke();
    if (geo) { g.lineWidth = 4; g.strokeStyle = '#F6A04D'; g.beginPath(); g.moveTo(mx + geo.hubA.x * k, my + geo.hubA.y * k); g.lineTo(mx + geo.hubB.x * k, my + geo.hubB.y * k); g.stroke(); g.beginPath(); g.arc(mx + geo.hubB.x * k, my + geo.hubB.y * k, 4, 0, 7); g.fillStyle = '#FFD36C'; g.fill(); g.stroke(); }
    for (const d of f.dots) { if (!d.mate && !d.mine) continue; g.beginPath(); g.arc(mx + d.x * k, my + d.y * k, d.mine ? 3.6 : 2.6, 0, 7); g.fillStyle = TEAM_COLORS[d.team % 4]!; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke(); }
    g.restore();
  }
  void ARRIVE_R; void OPT_LABEL; void PAL; void glyph; void ROLE_GLYPH;
}
export const optionLabel = (id: OptionId) => OPT_LABEL[id];
