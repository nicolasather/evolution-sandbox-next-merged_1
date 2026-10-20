/** Canvas renderer for the course. Everything dynamic (hazards, players, camera) is drawn here; the HUD is DOM. A pure function of its scene:
 *  the same scene always draws the same picture, so screenshots and tests are repeatable. No faces, no gradients, 3 px ink outlines. */
import type { Cell, Hazard, Pulse, Role } from '@/lib/quiz/os/domain';
import { TILE } from '@/lib/quiz/os/balance';
import { ck, hazardPhase, unck, type CourseIndex } from '@/lib/quiz/os/course';
import { C, TEAM_COLORS } from './art';
import { BIOME_KITS, drawProp, hash2 } from '../art/props';

export type Dot = { id: string; x: number; y: number; role: Role; team: number; stunned: boolean; goal: boolean; mine: boolean; mate: boolean; invincible?: boolean; hop?: boolean; label?: string };
export type Scene = {
  idx: CourseIndex; tick: number; dots: Dot[]; width: number; height: number; mode: 'follow' | 'overview';
  center: { x: number; y: number } | null; gate: number; pulses: readonly Pulse[]; peek: boolean; frozen: boolean; reduced: boolean; lowFx: boolean;
  ghosts?: Cell[]; sockets: boolean; label?: string;
  /** seconds of ambient animation (sway, flicker). Visual only — never read by gameplay. 0 when motion is reduced. */
  time?: number;
};
const inkW = 3;

function layout(sc: Scene) {
  const [cw, ch] = sc.idx.course.size;
  if (sc.mode === 'overview') {
    const t = Math.max(6, Math.min(sc.width / (cw + 1), sc.height / (ch + 1))); const ox = (sc.width - cw * t) / 2; const oy = (sc.height - ch * t) / 2;
    return { t, ox, oy };
  }
  const t = Math.max(30, Math.min(66, Math.min(sc.width / 11, sc.height / 7.5)));
  const c = sc.center ?? { x: (sc.idx.course.start[0] + 0.5) * TILE, y: (sc.idx.course.start[1] + 0.5) * TILE };
  return { t, ox: sc.width / 2 - (c.x / TILE) * t, oy: sc.height / 2 - (c.y / TILE) * t };
}
export function drawWorld(g: CanvasRenderingContext2D, sc: Scene) {
  const { idx } = sc; const course = idx.course; const { t, ox, oy } = layout(sc);
  g.save(); g.clearRect(0, 0, sc.width, sc.height);
  const X = (tx: number) => ox + tx * t; const Y = (ty: number) => oy + ty * t;
  const vis = (tx: number, ty: number) => X(tx) > -t && X(tx) < sc.width && Y(ty) > -t && Y(ty) < sc.height;
  const time = sc.reduced ? 0 : sc.time ?? 0; const kit = BIOME_KITS[course.biomeIndex % 4] ?? BIOME_KITS[0];
  // ground: two soft tones in a slow checker, then grass tufts / sparkles; the lane itself stays quiet so hazards read first
  g.fillStyle = kit.ground; g.fillRect(0, 0, sc.width, sc.height);
  const x0 = Math.floor(-ox / t) - 1; const x1 = Math.ceil((sc.width - ox) / t) + 1; const y0 = Math.floor(-oy / t) - 1; const y1 = Math.ceil((sc.height - oy) / t) + 1;
  const isLane = (x: number, y: number) => idx.cells.has(ck(x, y)) || idx.sockets.has(ck(x, y));
  if (!sc.lowFx) {
    g.fillStyle = kit.groundDark; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 2 === 0 && !isLane(x, y)) g.fillRect(X(x), Y(y), t + 0.5, t + 0.5);
    g.strokeStyle = kit.accent; g.lineWidth = 2; g.lineCap = 'round';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (isLane(x, y) || hash2(x, y, 3) > 0.34) continue; const bx = X(x) + hash2(x, y, 4) * t; const by = Y(y) + hash2(x, y, 5) * t; const sw = Math.sin(time * 1.8 + x) * t * 0.04; g.beginPath(); g.moveTo(bx - t * 0.06, by); g.lineTo(bx - t * 0.08 + sw, by - t * 0.16); g.moveTo(bx, by); g.lineTo(bx + sw, by - t * 0.2); g.moveTo(bx + t * 0.06, by); g.lineTo(bx + t * 0.08 + sw, by - t * 0.15); g.stroke(); }
  }
  // lane: a lifted paper strip (offset shadow first, then the paper with a faint tile checker)
  g.fillStyle = 'rgba(23,37,58,.2)'; for (const k of idx.cells) { const [x, y] = unck(k); if (vis(x, y)) g.fillRect(X(x) + t * 0.07, Y(y) + t * 0.1, t, t); }
  g.fillStyle = C.paper; for (const k of idx.cells) { const [x, y] = unck(k); if (vis(x, y)) g.fillRect(X(x) - 0.5, Y(y) - 0.5, t + 1, t + 1); }
  if (!sc.lowFx) { g.fillStyle = 'rgba(234,185,121,.2)'; for (const k of idx.cells) { const [x, y] = unck(k); if (vis(x, y) && (x + y) % 2 === 0) g.fillRect(X(x), Y(y), t, t); } }
  // lane edge: a 3 px ink line wherever a neighbour is not walkable
  g.strokeStyle = C.ink; g.lineWidth = inkW; g.lineCap = 'round'; g.beginPath();
  for (const k of idx.cells) { const [x, y] = unck(k); if (!vis(x, y)) continue; const open = (a: number, b: number) => idx.cells.has(ck(a, b)) || (sc.sockets && idx.sockets.has(ck(a, b)));
    if (!open(x, y - 1)) { g.moveTo(X(x), Y(y)); g.lineTo(X(x + 1), Y(y)); } if (!open(x, y + 1)) { g.moveTo(X(x), Y(y + 1)); g.lineTo(X(x + 1), Y(y + 1)); }
    if (!open(x - 1, y)) { g.moveTo(X(x), Y(y)); g.lineTo(X(x), Y(y + 1)); } if (!open(x + 1, y)) { g.moveTo(X(x + 1), Y(y)); g.lineTo(X(x + 1), Y(y + 1)); } }
  g.stroke();
  // scenery: deterministic props around the lane (never on it, never covering the tiles north of it), drawn back to front
  if (!sc.lowFx) {
    const props: { x: number; y: number; kind: (typeof kit.edge)[number]; k: number }[] = [];
    const nearLane = (x: number, y: number) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (idx.cells.has(ck(x + dx, y + dy))) return true; return false; };
    for (let y = y0; y <= y1 + 1; y++) for (let x = x0; x <= x1; x++) {
      if (isLane(x, y) || isLane(x, y - 1) || isLane(x, y - 2) || isLane(x, y + 0)) continue; const r = hash2(x, y, 11); const near = nearLane(x, y);
      if (near ? r > 0.2 : r > 0.1) continue; const pool = near ? kit.edge : [...kit.edge, ...kit.far]; const kind = pool[Math.floor(hash2(x, y, 12) * pool.length)];
      props.push({ x: x + 0.2 + hash2(x, y, 13) * 0.6, y: y + 0.6 + hash2(x, y, 14) * 0.35, kind, k: hash2(x, y, 15) });
    }
    props.sort((a, b) => a.y - b.y);
    for (const p of props) { const px = X(p.x); const py = Y(p.y); if (px < -t || px > sc.width + t || py < -t * 0.5 || py > sc.height + t * 1.6) continue; drawProp(g, p.kind, px, py, t * (0.95 + p.k * 0.35), time, p.k, Math.floor(p.k * 8)); }
  }
  // route peek / survey pulse: a dotted lemon line along the safest lane
  const survey = sc.pulses.some((p) => p.kind === 'survey' && sc.tick >= p.from && sc.tick < p.to);
  if (sc.peek || survey) { g.strokeStyle = C.lemon; g.lineWidth = 6; g.setLineDash([2, 10]); g.beginPath(); course.expandedSafePath.forEach(([x, y], i) => { const px = X(x + 0.5), py = Y(y + 0.5); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke(); g.setLineDash([]); }
  // bridge sockets (open to squads that bought the socket)
  if (sc.sockets) for (const k of idx.sockets) { const [x, y] = unck(k); g.fillStyle = 'rgba(247,217,107,.7)'; g.fillRect(X(x), Y(y), t, t); g.strokeStyle = C.ink; g.lineWidth = 2; g.setLineDash([6, 5]); g.strokeRect(X(x) + 1, Y(y) + 1, t - 2, t - 2); g.setLineDash([]); }
  // start, checkpoints and goal
  const tag = (c: Cell, text: string, fill: string) => { const px = X(c[0]) + t / 2, py = Y(c[1]) + t / 2; if (!vis(c[0], c[1])) return; g.fillStyle = fill; g.strokeStyle = C.ink; g.lineWidth = inkW; const w = Math.max(t * 0.9, 30); roundRect(g, px - w / 2, py - t * 0.22, w, t * 0.44, 7); g.fill(); g.stroke(); g.fillStyle = C.ink; g.font = `800 ${Math.max(9, t * 0.2)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, px, py + 1); };
  tag(course.start, 'START', C.mint); course.checkpoints.forEach((c, i) => { g.fillStyle = 'rgba(109,215,176,.45)'; g.fillRect(X(c[0]), Y(c[1]), t, t); flag(g, X(c[0]) + t / 2, Y(c[1]) + t / 2, t, i + 1, time); }); tag(course.goal, 'GOAL', C.lemon);
  // gates (a closed chapter limit is a wall): a striped ink bar on the first tile beyond the limit
  if (Number.isFinite(sc.gate) && sc.gate < idx.totalDist) for (const [k, d] of idx.dist) if (d === sc.gate + 1) { const [x, y] = unck(k); if (!vis(x, y)) continue; g.fillStyle = C.lemon; g.fillRect(X(x), Y(y), t, t); g.strokeStyle = C.ink; g.lineWidth = inkW; g.beginPath(); for (let i = -t; i < t * 2; i += t / 3) { g.moveTo(X(x) + i, Y(y) + t); g.lineTo(X(x) + i + t, Y(y)); } g.save(); g.beginPath(); g.rect(X(x), Y(y), t, t); g.clip(); g.stroke(); g.restore(); g.strokeRect(X(x), Y(y), t, t); }
  // hazards
  const safeOn = sc.pulses.some((p) => p.kind === 'safe' && sc.tick >= p.from && sc.tick < p.to);
  course.hazards.forEach((h) => { const [x, y] = h.tile; if (!vis(x, y)) return; const suppressed = safeOn || sc.pulses.some((p) => p.kind === 'plank' && p.at && sc.tick >= p.from && sc.tick < p.to && Math.abs(p.at[0] - x) <= 3 && Math.abs(p.at[1] - y) <= 3);
    drawHazard(g, h, suppressed ? 0 : hazardPhase(h, Math.floor(sc.tick)), X(x), Y(y), t, sc.tick, suppressed, sc.reduced); });
  // players: rivals first, then squadmates, then you
  const order = [...sc.dots].sort((a, b) => Number(a.mine) - Number(b.mine) || Number(a.mate) - Number(b.mate));
  for (const d of order) drawDot(g, d, X(d.x / TILE), Y(d.y / TILE), t, sc);
  if (sc.frozen) { g.fillStyle = 'rgba(25,46,70,.12)'; g.fillRect(0, 0, sc.width, sc.height); }
  g.restore();
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function flag(g: CanvasRenderingContext2D, cx: number, cy: number, t: number, n: number, time = 0) {
  const w = Math.sin(time * 4 + n) * t * 0.05;
  g.strokeStyle = C.ink; g.lineWidth = inkW; g.beginPath(); g.moveTo(cx - t * 0.15, cy + t * 0.3); g.lineTo(cx - t * 0.15, cy - t * 0.32); g.stroke();
  g.fillStyle = C.mint; g.beginPath(); g.moveTo(cx - t * 0.15, cy - t * 0.32); g.quadraticCurveTo(cx + t * 0.1, cy - t * 0.3 + w, cx + t * 0.25 + w, cy - t * 0.18); g.quadraticCurveTo(cx + t * 0.1, cy - t * 0.06 - w, cx - t * 0.15, cy - t * 0.04); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = C.ink; g.font = `800 ${Math.max(9, t * 0.22)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), cx + t * 0.12, cy + t * 0.28);
}
/** state 0 idle, 1 warning (dashed outline + "!"), 2 active (solid, filled). The picture itself differs per kind, so state is readable without colour. */
function drawHazard(g: CanvasRenderingContext2D, h: Hazard, state: 0 | 1 | 2, px: number, py: number, t: number, tick: number, off: boolean, reduced: boolean) {
  const pad = t * 0.1; const w = t - pad * 2; const x = px + pad; const y = py + pad; const cx = px + t / 2; const cy = py + t / 2;
  g.save(); g.strokeStyle = C.ink; g.lineWidth = inkW; g.lineJoin = 'round';
  if (state === 1) g.setLineDash([6, 4]);
  if (off) g.globalAlpha = 0.35; else if (state === 0) g.globalAlpha = 0.75;
  const wob = reduced ? 0 : Math.sin(tick / 3) * t * 0.03;
  switch (h.kind) {
    case 'swipe_bar': { g.fillStyle = C.coral; const bw = state === 2 ? w : state === 1 ? w * 0.55 : w * 0.28; roundRect(g, x, cy - t * 0.14, bw, t * 0.28, 5); g.fill(); g.stroke(); g.setLineDash([]); g.lineWidth = 2; g.beginPath(); for (let i = 0.2; i < bw / t * 3; i += 0.45) { g.moveTo(x + i * t * 0.4, cy - t * 0.14); g.lineTo(x + i * t * 0.4 + t * 0.12, cy + t * 0.14); } g.stroke(); break; }
    case 'falling_block': { if (state >= 1) { g.fillStyle = 'rgba(23,37,58,.28)'; g.beginPath(); g.ellipse(cx, cy + t * 0.28, w * (state === 2 ? 0.45 : 0.32), t * 0.1, 0, 0, 7); g.fill(); } g.fillStyle = C.lemon; const off2 = state === 2 ? 0 : state === 1 ? -t * 0.28 : -t * 0.6; roundRect(g, x + t * 0.1, y + t * 0.1 + off2, w - t * 0.2, w - t * 0.3, 5); g.fill(); g.stroke(); break; }
    case 'rolling_drum': { g.fillStyle = C.sky; const r = (state === 2 ? 0.36 : 0.26) * t; const dx = state === 2 && !reduced ? Math.sin(tick / 2) * t * 0.1 : 0; g.beginPath(); g.arc(cx + dx, cy, r, 0, 7); g.fill(); g.stroke(); g.setLineDash([]); g.beginPath(); const a = reduced ? 0 : tick / 3; g.moveTo(cx + dx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + dx - Math.cos(a) * r, cy - Math.sin(a) * r); g.moveTo(cx + dx - Math.sin(a) * r, cy + Math.cos(a) * r); g.lineTo(cx + dx + Math.sin(a) * r, cy - Math.cos(a) * r); g.stroke(); break; }
    case 'spikes': { g.fillStyle = C.coral; const hgt = state === 2 ? 0.7 : state === 1 ? 0.4 : 0.12; for (let i = 0; i < 3; i++) { const bx = x + (i * w) / 3; g.beginPath(); g.moveTo(bx, y + w); g.lineTo(bx + w / 6, y + w - hgt * w); g.lineTo(bx + w / 3, y + w); g.closePath(); g.fill(); g.stroke(); } break; }
    case 'laser_grid': { g.fillStyle = C.plum; roundRect(g, x, y, w, w, 5); g.fill(); g.stroke(); g.setLineDash([]); g.strokeStyle = state === 2 ? C.paper : 'rgba(255,247,232,.5)'; g.lineWidth = state === 2 ? 4 : 2; g.beginPath(); g.moveTo(x + w * 0.15, y + w * 0.85); g.lineTo(x + w * 0.85, y + w * 0.15); if (state === 2) { g.moveTo(x + w * 0.15, y + w * 0.15); g.lineTo(x + w * 0.85, y + w * 0.85); } g.stroke(); break; }
    case 'pulse_gate': { g.fillStyle = state === 2 ? C.lemon : C.paper; g.beginPath(); g.arc(cx, cy, t * (state === 2 ? 0.38 : 0.3), 0, 7); g.fill(); g.stroke(); g.setLineDash([]); g.fillStyle = C.ink; g.beginPath(); g.moveTo(cx - t * 0.12, cy - t * 0.06); g.lineTo(cx + t * 0.12, cy - t * 0.06); g.lineTo(cx, cy + t * 0.14); g.closePath(); g.fill(); break; }
    case 'crumble_tile': { g.fillStyle = state === 2 ? C.navy : C.wheat; roundRect(g, x, y, w, w, 4); g.fill(); g.stroke(); g.setLineDash([]); g.strokeStyle = state === 2 ? C.paper : C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + w * 0.35); g.lineTo(x + w * 0.4, y + w * 0.5); g.lineTo(x + w * 0.3, y + w * 0.8); g.lineTo(x + w * 0.7, y + w); g.moveTo(x + w, y + w * 0.25); g.lineTo(x + w * 0.62, y + w * 0.5); g.stroke(); break; }
    case 'conveyor': case 'wind_fan': { g.fillStyle = h.kind === 'conveyor' ? 'rgba(109,215,176,.8)' : 'rgba(107,191,232,.8)'; g.fillRect(x, y, w, w); g.setLineDash([]); g.strokeRect(x, y, w, w); g.lineWidth = 3; const n = reduced ? 0 : (tick / 4) % 1; const up = h.kind === 'wind_fan'; for (let i = 0; i < 2; i++) { const o = ((i + n) / 2) * w; const ax = up ? cx : x + o; const ay = up ? y + w - o : cy; g.beginPath(); if (up) { g.moveTo(ax - t * 0.14, ay + t * 0.1); g.lineTo(ax, ay - t * 0.06); g.lineTo(ax + t * 0.14, ay + t * 0.1); } else { g.moveTo(ax - t * 0.06, ay - t * 0.14); g.lineTo(ax + t * 0.1, ay); g.lineTo(ax - t * 0.06, ay + t * 0.14); } g.stroke(); } break; }
    case 'bounce_pad': { g.fillStyle = C.mint; g.beginPath(); g.arc(cx, cy, t * 0.34 + wob, 0, 7); g.fill(); g.stroke(); g.setLineDash([]); g.beginPath(); g.moveTo(cx - t * 0.14, cy + t * 0.06); g.lineTo(cx, cy - t * 0.12); g.lineTo(cx + t * 0.14, cy + t * 0.06); g.stroke(); break; }
    case 'slime': case 'mud_chute': { g.fillStyle = h.kind === 'slime' ? C.mint : C.wheat; g.beginPath(); g.moveTo(x + w * 0.1, y + w * 0.35); g.quadraticCurveTo(cx, y - w * 0.05 + wob, x + w * 0.9, y + w * 0.3); g.lineTo(x + w * 0.95, y + w * 0.75); g.quadraticCurveTo(cx, y + w * 1.05, x + w * 0.05, y + w * 0.7); g.closePath(); g.fill(); g.stroke(); g.setLineDash([]); g.fillStyle = C.paper; g.beginPath(); g.arc(cx + t * 0.1, cy, t * 0.07, 0, 7); g.fill(); g.stroke(); break; }
  }
  g.setLineDash([]); g.globalAlpha = 1;
  if (state === 1 && !off) { g.fillStyle = C.ink; g.font = `900 ${Math.max(11, t * 0.3)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', px + t * 0.86, py + t * 0.16); }
  g.restore();
}
function drawDot(g: CanvasRenderingContext2D, d: Dot, px: number, py: number, t: number, sc: Scene) {
  const r = t * 0.3; const phase = (d.x + d.y) / 900; const bob = sc.reduced || d.stunned ? 0 : Math.abs(Math.sin(sc.tick / 2.2 + phase)) * t * 0.05; const lift = (d.hop ? t * 0.18 : 0) + bob; const blink = d.invincible && !sc.reduced && Math.floor(sc.tick / 2) % 2 === 0;
  g.save(); g.globalAlpha = blink ? 0.45 : d.mine || d.mate ? 1 : 0.8;
  g.fillStyle = 'rgba(23,37,58,.22)'; g.beginPath(); g.ellipse(px, py + r * 0.9, r * 0.9, r * 0.32, 0, 0, 7); g.fill();
  g.translate(px, py - lift); if (d.hop && !sc.reduced) g.scale(0.92, 1.1); else if (!d.stunned && !sc.reduced) g.scale(1 + bob / t, 1 - bob / t); g.lineJoin = 'round'; g.strokeStyle = C.ink; g.lineWidth = d.mine ? 4 : inkW;
  const fill = d.stunned ? '#B8C0CB' : d.goal ? C.lemon : roleColor(d.role);
  g.fillStyle = fill;
  switch (d.role) {
    case 'trailblazer': poly(g, 5, r, -Math.PI / 2); break;
    case 'shieldbearer': g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.95, -r * 0.7); g.lineTo(r * 0.8, r * 0.2); g.quadraticCurveTo(r * 0.5, r * 0.85, 0, r); g.quadraticCurveTo(-r * 0.5, r * 0.85, -r * 0.8, r * 0.2); g.lineTo(-r * 0.95, -r * 0.7); g.closePath(); g.fill(); g.stroke(); break;
    case 'bridgewright': roundRect(g, -r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.35); g.fill(); g.stroke(); g.fillStyle = C.paper; g.lineWidth = 2; roundRect(g, -r * 0.5, -r * 0.2, r, r * 0.55, 3); g.fill(); g.stroke(); break;
    case 'pathfinder': g.beginPath(); g.moveTo(0, -r * 1.1); g.lineTo(r * 1.1, 0); g.lineTo(0, r * 1.1); g.lineTo(-r * 1.1, 0); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(0, -r * 0.5); g.lineTo(0, r * 0.5); g.moveTo(-r * 0.5, 0); g.lineTo(r * 0.5, 0); g.stroke(); break;
    case 'medic': g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = C.paper; g.lineWidth = 2; g.fillRect(-r * 0.2, -r * 0.62, r * 0.4, r * 1.24); g.fillRect(-r * 0.62, -r * 0.2, r * 1.24, r * 0.4); break;
  }
  // squad ring (colour + a different dash per squad so squads differ without colour)
  g.lineWidth = 3; g.strokeStyle = TEAM_COLORS[d.team % TEAM_COLORS.length]; g.setLineDash(d.team % 2 ? [4, 3] : []); g.beginPath(); g.arc(0, 0, r * 1.32, 0, 7); g.stroke(); g.setLineDash([]);
  if (d.stunned && !sc.reduced) { g.fillStyle = C.ink; g.font = `900 ${Math.max(10, t * 0.24)}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText('✦', Math.sin(sc.tick / 2) * r, -r * 1.4); }
  if (d.mine) { g.fillStyle = C.ink; g.beginPath(); g.moveTo(0, -r * 1.95); g.lineTo(-r * 0.4, -r * 1.5); g.lineTo(r * 0.4, -r * 1.5); g.closePath(); g.fill(); }
  if (d.label) { g.fillStyle = C.ink; g.font = `700 ${Math.max(10, t * 0.22)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(d.label, 0, r * 1.5); }
  g.restore();
}
function poly(g: CanvasRenderingContext2D, n: number, r: number, a0: number) { g.beginPath(); for (let i = 0; i < n; i++) { const a = a0 + (i * 2 * Math.PI) / n; const px = Math.cos(a) * r; const py = Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); g.fill(); g.stroke(); }
const roleColor = (r: Role) => ({ trailblazer: C.coral, shieldbearer: C.mint, bridgewright: C.sky, pathfinder: C.lemon, medic: C.plum })[r];
