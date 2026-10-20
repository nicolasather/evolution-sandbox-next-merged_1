/** Vector sprites, drawn with code. Animation is a pure function of `t` (seconds) and authoritative state; nothing here decides gameplay.
 *  Roles: round bodies told apart by crest + glyph + tool shape (never faces). Enemies: one silhouette family each. Bosses: scale + asymmetry.
 *  Poses follow the framebook: idle 4 poses, run 6, attack 3, hit 2, down 2, revive 4, ability 5 — selected from t and state flags. */
import type { Role, EnemyKind, BossKind } from '../domain';
import { ROLE_DEFS, ENEMY_DEFS, BOSS_DEFS } from '../balance';
import { PAPER_2, SAFE, WARN, GOLD, type Theme } from './palette';

const TAU = Math.PI * 2;
type C = CanvasRenderingContext2D;
const sin = Math.sin, cos = Math.cos;
function stroke(ctx: C, th: Theme, w = th.stroke) { ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = th.ink; ctx.stroke(); }
function fillStroke(ctx: C, th: Theme, fill: string, w?: number) { ctx.fillStyle = fill; ctx.fill(); stroke(ctx, th, w); }
function poly(ctx: C, pts: [number, number][]) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
function rot(x: number, y: number, a: number): [number, number] { return [x * cos(a) - y * sin(a), x * sin(a) + y * cos(a)]; }
const shade = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
export { shade };

// ── roles ────────────────────────────────────────────────────────────────────────────────────────────────────
export type RoleState = { t: number; face: number; moving: boolean; down: boolean; hit: number; firing: number; ability: number; shield: boolean; offline: boolean; protectedUntil: boolean; revive: number; downFrac: number; seed: number };
export const ROLE_SCALE = 1.28;
/** Pose index for the framebook: 4-pose idle at 6fps, 6-pose run at 8fps. */
export const idlePose = (t: number, seed: number) => Math.floor(((t + seed * 0.37) * 6) % 4);
export const runPose = (t: number, seed: number) => Math.floor(((t + seed * 0.21) * 8) % 6);

export function drawRole(ctx: C, th: Theme, role: Role, x: number, y: number, s: RoleState, scale = 1) {
  const def = ROLE_DEFS[role]; const R = 16 * ROLE_SCALE * scale; const reduced = th.reduced;
  const bob = reduced ? 0 : s.moving ? [0, -1.4, -2.2, -1.4, 0, 1][runPose(s.t, s.seed)]! : [0, -1, -2, -1][idlePose(s.t, s.seed)]!;
  const squash = reduced || !s.moving ? 1 : 1 + [0, 0.03, 0.05, 0.03, 0, -0.03][runPose(s.t, s.seed)]!;
  ctx.save(); ctx.translate(x, y + bob);
  // soft ground shadow keeps the body readable on any map
  ctx.save(); ctx.scale(1, 0.4); ctx.beginPath(); ctx.arc(0, R * 1.5, R * 0.95, 0, TAU); ctx.fillStyle = 'rgba(29,44,53,0.22)'; ctx.fill(); ctx.restore();
  if (s.down) { ctx.rotate(0.21); ctx.globalAlpha = 0.65 + 0.2 * (1 - s.downFrac); }
  if (s.offline) ctx.globalAlpha *= 0.55;
  if (s.protectedUntil && !reduced) { ctx.beginPath(); ctx.arc(0, 0, R + 6 + sin(s.t * 6) * 1.2, 0, TAU); ctx.strokeStyle = 'rgba(60,123,217,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]); }
  const recoil = s.firing > 0 && !reduced ? -3 * s.firing : 0; const fx = cos(s.face), fy = sin(s.face);
  ctx.translate(fx * recoil, fy * recoil);
  ctx.scale(squash, 2 - squash);
  // back props (drawn behind the body)
  const bx = -fx, by = -fy;
  if (role === 'engineer') { ctx.save(); ctx.translate(bx * R * 0.85, by * R * 0.85); ctx.rotate(s.face); ctx.beginPath(); ctx.roundRect(-R * 0.35, -R * 0.5, R * 0.7, R, 3); fillStroke(ctx, th, shade(def.color, 0.78)); ctx.restore(); }
  if (role === 'scout') { const sway = reduced ? 0 : sin(s.t * 9) * 0.25; ctx.save(); ctx.translate(bx * R * 0.7, by * R * 0.7); ctx.rotate(s.face + Math.PI + sway); poly(ctx, [[0, -R * 0.35], [-R * 1.05, 0], [0, R * 0.35]]); fillStroke(ctx, th, shade(def.color, 1.25), 2.5); ctx.restore(); }
  if (role === 'striker') { for (const sg of [-1, 1]) { ctx.save(); ctx.translate(bx * R * 0.55 - fy * sg * R * 0.85, by * R * 0.55 + fx * sg * R * 0.85); ctx.rotate(s.face + sg * 0.6); poly(ctx, [[R * 0.4, 0], [-R * 0.45, -R * 0.28], [-R * 0.45, R * 0.28]]); fillStroke(ctx, th, shade(def.color, 0.8), 2.5); ctx.restore(); } }
  // body
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); fillStroke(ctx, th, def.color);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.74, Math.PI * 1.05, Math.PI * 1.95); ctx.strokeStyle = 'rgba(255,251,241,0.55)'; ctx.lineWidth = 2.4; ctx.stroke(); // flat highlight arc, not a gradient
  // crest + glyph (the role is readable at 26 px from these two alone)
  ctx.save(); const g = def.accent;
  if (role === 'guardian') { ctx.beginPath(); ctx.arc(0, -R * 0.1, R * 0.98, Math.PI * 1.2, Math.PI * 1.8); ctx.lineWidth = 4.5; ctx.strokeStyle = shade(def.color, 0.7); ctx.stroke(); poly(ctx, [[-R * 0.32, -R * 0.36], [R * 0.32, -R * 0.36], [R * 0.32, R * 0.08], [0, R * 0.42], [-R * 0.32, R * 0.08]]); fillStroke(ctx, th, g, 2.2); ctx.beginPath(); ctx.moveTo(0, -R * 0.3); ctx.lineTo(0, R * 0.3); ctx.lineWidth = 2; ctx.strokeStyle = th.ink; ctx.stroke(); }
  if (role === 'striker') { ctx.rotate(0.35); poly(ctx, [[-R * 0.14, -R * 0.5], [R * 0.2, -R * 0.4], [R * 0.14, R * 0.46], [-R * 0.2, R * 0.38]]); fillStroke(ctx, th, g, 2.2); ctx.beginPath(); ctx.moveTo(-R * 0.02, -R * 0.4); ctx.lineTo(0, R * 0.3); ctx.lineWidth = 1.6; ctx.strokeStyle = th.ink; ctx.stroke(); }
  if (role === 'medic') { ctx.beginPath(); ctx.roundRect(-R * 0.16, -R * 0.52, R * 0.32, R * 1.04, 2); ctx.roundRect(-R * 0.52, -R * 0.16, R * 1.04, R * 0.32, 2); fillStroke(ctx, th, g, 2.2); ctx.save(); ctx.translate(-R * 0.72, -R * 0.72); ctx.rotate(-0.7); ctx.beginPath(); ctx.ellipse(0, 0, R * 0.34, R * 0.16, 0, 0, TAU); fillStroke(ctx, th, '#8BD7B9', 2); ctx.restore(); }
  if (role === 'engineer') { ctx.rotate(reduced ? 0 : s.t * 0.9); ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const r = i % 2 ? R * 0.34 : R * 0.5; ctx.lineTo(cos(a) * r, sin(a) * r); } ctx.closePath(); fillStroke(ctx, th, g, 2.2); ctx.beginPath(); ctx.arc(0, 0, R * 0.14, 0, TAU); ctx.fillStyle = th.ink; ctx.fill(); }
  if (role === 'scout') { poly(ctx, [[-R * 0.1, -R * 0.55], [R * 0.34, -R * 0.1], [R * 0.06, -R * 0.02], [R * 0.2, R * 0.5], [-R * 0.32, R * 0.04], [-R * 0.04, -R * 0.02]]); fillStroke(ctx, th, g, 2.2); }
  ctx.restore();
  // tool nub: points where the avatar aims (a prop, not a face)
  ctx.save(); ctx.rotate(s.face); ctx.beginPath(); ctx.roundRect(R * 0.62, -R * 0.2, R * 0.62, R * 0.4, 3); fillStroke(ctx, th, shade(def.color, 0.65), 2.4); ctx.restore();
  if (s.hit > 0 && !reduced) { ctx.beginPath(); ctx.arc(0, 0, R + 1.5, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.9 * s.hit})`; ctx.lineWidth = 3; ctx.stroke(); }
  if (s.shield) { ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, TAU); ctx.strokeStyle = 'rgba(180,215,255,0.95)'; ctx.lineWidth = 4; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, R + 11, 0, TAU); ctx.strokeStyle = th.ink; ctx.lineWidth = 1.6; ctx.stroke(); }
  ctx.restore();
  if (s.revive > 0) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.arc(0, 0, R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, s.revive)); ctx.strokeStyle = SAFE; ctx.lineWidth = 5; ctx.stroke(); ctx.restore(); }
}

// ── enemies ───────────────────────────────────────────────────────────────────────────────────────────────────
export type EnemyDraw = { t: number; face: number; state: number; hp: number; maxHp: number; hit: number; seed: number; dying: number };
const ST = { spawn: 0, seek: 1, pre_attack: 2, attack: 3, recover: 4, dead: 5 };
export function drawEnemy(ctx: C, th: Theme, kind: EnemyKind, x: number, y: number, r: number, e: EnemyDraw) {
  const def = ENEMY_DEFS[kind]; const reduced = th.reduced; const t = e.t + e.seed * 0.31; const wob = reduced ? 0 : sin(t * 7);
  ctx.save(); ctx.translate(x, y);
  const fly = def.fly; const lift = fly ? (reduced ? 0 : sin(t * (TAU / 0.95)) * 4) - 6 : 0;
  ctx.save(); ctx.scale(1, 0.38); ctx.beginPath(); ctx.arc(0, (r + 6 - lift * 0.4) / 0.38 * 0.9, r * 0.9, 0, TAU); ctx.fillStyle = 'rgba(29,44,53,0.2)'; ctx.fill(); ctx.restore();
  ctx.translate(0, lift);
  const sp = e.state === ST.spawn ? Math.min(1, e.dying) : 1; ctx.scale(sp, sp);
  if (e.dying > 0 && e.state === ST.dead) { const k = 1 - e.dying; ctx.scale(1 + 0.18 * k, 1 - 0.7 * k); ctx.globalAlpha = 1 - k; }
  const warn = e.state === ST.pre_attack; const c = def.color; ctx.rotate(0);
  const hitFlash = e.hit > 0 && !reduced;
  switch (def.shape) {
    case 'bean': { ctx.rotate(wob * 0.07); ctx.beginPath(); ctx.moveTo(-r, -r * 0.1); ctx.bezierCurveTo(-r, -r * 1.05, r * 0.2, -r * 1.2, r, -r * 0.5); ctx.bezierCurveTo(r * 1.15, r * 0.3, r * 0.5, r * 1.05, -r * 0.2, r * 0.95); ctx.bezierCurveTo(-r * 1.05, r * 0.9, -r * 1.1, r * 0.4, -r, -r * 0.1); fillStroke(ctx, th, c); ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.35, r * 0.2, 0, TAU); ctx.fillStyle = 'rgba(255,251,241,0.6)'; ctx.fill(); break; }
    case 'triangle': { ctx.rotate(e.face); const k = warn ? 0.82 : 1; poly(ctx, [[r * 1.25 * k, 0], [-r * 0.85, -r * 0.95], [-r * 0.85, r * 0.95]]); fillStroke(ctx, th, c); ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(-r * 0.2, r * 0.55); ctx.lineWidth = 3.4; ctx.strokeStyle = th.ink; ctx.stroke(); break; }
    case 'square': { ctx.rotate(e.face); ctx.beginPath(); ctx.roundRect(-r, -r, r * 2, r * 2, 5); fillStroke(ctx, th, c); ctx.beginPath(); ctx.roundRect(r * 0.55, -r * 1.02, r * 0.5, r * 2.04, 3); fillStroke(ctx, th, shade(c, 0.62)); ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.3, 0); ctx.lineWidth = 3; ctx.strokeStyle = th.ink; ctx.stroke(); break; }
    case 'diamond': { ctx.rotate(e.face * 0); poly(ctx, [[0, -r * 1.15], [r * 1.05, 0], [0, r * 1.15], [-r * 1.05, 0]]); fillStroke(ctx, th, c); ctx.beginPath(); ctx.moveTo(0, -r * 1.15); ctx.lineTo(r * 0.12, -r * 0.35); ctx.lineTo(-r * 0.12, -r * 0.35); ctx.closePath(); ctx.fillStyle = th.ink; ctx.fill(); break; }
    case 'spiky': { const tw = reduced ? 0 : sin(t * (TAU / 0.6)) * 0.12; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); fillStroke(ctx, th, c); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.95 + tw * (i - 1); ctx.beginPath(); ctx.moveTo(cos(a) * r * 0.6, sin(a) * r * 0.6); ctx.lineTo(cos(a) * r * 1.15, sin(a) * r * 1.15); ctx.lineWidth = 4; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.beginPath(); ctx.arc(cos(a) * r * 1.2, sin(a) * r * 1.2, r * 0.22, 0, TAU); fillStroke(ctx, th, shade(c, 1.25), 2.4); } break; }
    case 'hex': { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(cos(a) * r, sin(a) * r); } ctx.closePath(); fillStroke(ctx, th, c); ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); fillStroke(ctx, th, shade(c, 1.2), 2.6); ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fillStyle = th.ink; ctx.fill(); for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(sg * r * 0.95, 0, r * 0.18, 0, TAU); fillStroke(ctx, th, PAPER_2, 2.4); } break; }
    case 'rhombus': { const bl = !reduced && Math.floor(t * 5) % 7 === 0; poly(ctx, [[0, -r * 1.2], [r * 0.78, 0], [0, r * 1.2], [-r * 0.78, 0]]); fillStroke(ctx, th, c); ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(r * 0.5, bl ? -r * 0.4 : -r * 0.1); ctx.lineWidth = 3.6; ctx.strokeStyle = bl ? PAPER_2 : th.ink; ctx.stroke(); break; }
    case 'crescent': { ctx.rotate(e.face + wob * 0.12); ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.8); ctx.bezierCurveTo(r * 0.2, -r * 0.55, r * 0.2, r * 0.55, r * Math.cos(Math.PI * 0.2), r * Math.sin(Math.PI * 0.2)); fillStroke(ctx, th, c); ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 0.14, 0, TAU); ctx.fillStyle = GOLD; ctx.fill(); break; }
  }
  if (hitFlash) { ctx.globalAlpha = 0.9 * e.hit; ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; }
  if (warn) { const p = reduced ? 1 : 0.6 + 0.4 * sin(e.t * 22); ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.setLineDash([5, 4]); ctx.strokeStyle = WARN; ctx.lineWidth = 3.2 * p; ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  if (e.hp < e.maxHp && e.state !== ST.dead) { const w = Math.max(20, r * 1.7); const yy = y - r - 10 + lift; ctx.save(); ctx.fillStyle = 'rgba(29,44,53,0.85)'; ctx.fillRect(x - w / 2 - 1.5, yy - 1.5, w + 3, 7); ctx.fillStyle = e.hp / e.maxHp > 0.5 ? SAFE : e.hp / e.maxHp > 0.25 ? GOLD : WARN; ctx.fillRect(x - w / 2, yy, w * Math.max(0, e.hp / e.maxHp), 4); ctx.restore(); }
}

// ── bosses ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function drawBoss(ctx: C, th: Theme, kind: BossKind, x: number, y: number, r: number, o: { t: number; face: number; phase: number; hit: number; inhale: number }) {
  const def = BOSS_DEFS[kind]; const reduced = th.reduced; ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.scale(1, 0.34); ctx.beginPath(); ctx.arc(0, r * 2.6, r * 0.95, 0, TAU); ctx.fillStyle = 'rgba(29,44,53,0.25)'; ctx.fill(); ctx.restore();
  const seam = o.phase >= 1 ? '#F08A2C' : def.accent; const s = 1 + (reduced ? 0 : o.inhale * 0.07 + sin(o.t * 2.2) * 0.012); ctx.scale(s, s);
  if (kind === 'marrow_drum') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fillStroke(ctx, th, def.color, 4);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.moveTo(cos(a) * r * 0.78, sin(a) * r * 0.78); ctx.lineTo(cos(a) * r * 0.96, sin(a) * r * 0.96); ctx.lineWidth = 3.4; ctx.strokeStyle = seam; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.lineWidth = 3.4; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU); fillStroke(ctx, th, shade(def.color, 1.28), 3); ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); fillStroke(ctx, th, seam, 3);
    for (const sg of [-1, 1]) { ctx.save(); ctx.rotate(sg * (0.35 + (reduced ? 0 : sin(o.t * 1.4) * 0.12))); ctx.translate(0, -r * 1.02); ctx.beginPath(); ctx.roundRect(-r * 0.07, -r * 0.34, r * 0.14, r * 0.4, 4); fillStroke(ctx, th, '#C79A55', 3); ctx.beginPath(); ctx.arc(0, -r * 0.38, r * 0.14, 0, TAU); fillStroke(ctx, th, def.accent, 3); ctx.restore(); }
  } else if (kind === 'glass_heron') {
    const wing = reduced ? 0.5 : 0.5 + 0.5 * sin(o.t * 2.4); ctx.rotate(o.face);
    for (const sg of [-1, 1]) { ctx.save(); ctx.rotate(sg * (0.9 + wing * 0.3)); poly(ctx, [[0, 0], [-r * 0.2, r * 1.15 * sg], [r * 0.5, r * 0.8 * sg]]); fillStroke(ctx, th, shade(def.color, 0.9), 3.4); ctx.restore(); }
    poly(ctx, [[r * 1.1, 0], [0, -r * 0.62], [-r * 0.9, 0], [0, r * 0.62]]); fillStroke(ctx, th, def.color, 4);
    poly(ctx, [[r * 1.1, 0], [r * 1.75, 0], [r * 1.05, r * 0.1]]); fillStroke(ctx, th, def.accent, 3);
    ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.5, 0); ctx.lineWidth = 3; ctx.strokeStyle = seam === def.accent ? '#FFFBF1' : seam; ctx.stroke();
    poly(ctx, [[-r * 0.9, 0], [-r * 1.35, -r * 0.18], [-r * 1.2, 0], [-r * 1.35, r * 0.18]]); fillStroke(ctx, th, def.accent, 3);
  } else {
    ctx.rotate(reduced ? 0 : o.t * 0.35);
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; const [ax, ay] = rot(r * 0.5, -r * 0.5, a); const [bx, by] = rot(r * 1.12, -r * 0.34, a); const [cx, cy] = rot(r * 1.12, r * 0.34, a); const [dx, dy] = rot(r * 0.5, r * 0.5, a); ctx.lineTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); } ctx.closePath(); fillStroke(ctx, th, def.color, 4);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); fillStroke(ctx, th, shade(def.color, 1.3), 3.4); ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); fillStroke(ctx, th, seam, 3);
    for (let i = 0; i < 4; i++) { const [lx, ly] = rot(r * 0.9, 0, (i / 4) * TAU); ctx.beginPath(); ctx.arc(lx, ly, r * 0.1, 0, TAU); ctx.fillStyle = seam; ctx.fill(); }
  }
  if (o.hit > 0 && !reduced) { ctx.globalAlpha = o.hit; ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
}

// ── beacon, turret, drone, bullets ────────────────────────────────────────────────────────────────────────────
export function drawBeacon(ctx: C, th: Theme, x: number, y: number, hpFrac: number, shieldOn: boolean, t: number) {
  const R = 30; ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.scale(1, 0.4); ctx.beginPath(); ctx.arc(0, R * 2, R * 1.1, 0, TAU); ctx.fillStyle = 'rgba(29,44,53,0.22)'; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, R + 11, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.001, hpFrac)); ctx.lineWidth = 7; ctx.strokeStyle = hpFrac > 0.5 ? SAFE : hpFrac > 0.25 ? GOLD : WARN; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R + 11, 0, TAU); ctx.lineWidth = 1.6; ctx.strokeStyle = th.ink; ctx.stroke();
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(cos(a) * R, sin(a) * R); } ctx.closePath(); fillStroke(ctx, th, '#F4DDB0', 4);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.58, 0, TAU); fillStroke(ctx, th, '#FFE9A8', 3);
  const f = th.reduced ? 1 : 0.85 + 0.15 * sin(t * 5); ctx.beginPath(); ctx.moveTo(0, -R * 0.42 * f); ctx.bezierCurveTo(R * 0.34, -R * 0.1, R * 0.22, R * 0.34, 0, R * 0.34); ctx.bezierCurveTo(-R * 0.22, R * 0.34, -R * 0.34, -R * 0.1, 0, -R * 0.42 * f); fillStroke(ctx, th, '#F2A93B', 2.6);
  if (shieldOn) { ctx.beginPath(); ctx.arc(0, 0, R + 18, 0, TAU); ctx.strokeStyle = 'rgba(180,215,255,0.95)'; ctx.lineWidth = 4; ctx.stroke(); }
  ctx.restore();
}
export function drawTurret(ctx: C, th: Theme, x: number, y: number, ttlFrac: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 5); fillStroke(ctx, th, '#E2B13C'); ctx.rotate(th.reduced ? 0 : t * 1.5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.lineWidth = 6; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, TAU); fillStroke(ctx, th, PAPER_2, 2);
  ctx.rotate(th.reduced ? 0 : -t * 1.5); ctx.beginPath(); ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, ttlFrac))); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(29,44,53,0.65)'; ctx.stroke(); ctx.restore();
}
export function drawDrone(ctx: C, th: Theme, x: number, y: number, t: number) {
  ctx.save(); ctx.translate(x, y + (th.reduced ? 0 : sin(t * 5) * 1.5)); poly(ctx, [[0, -8], [8, 0], [0, 8], [-8, 0]]); fillStroke(ctx, th, '#4FC3D9', 2.6); ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fillStyle = th.ink; ctx.fill(); ctx.restore();
}
export function drawBullet(ctx: C, th: Theme, src: number, x: number, y: number, r: number, vx: number, vy: number) {
  const a = Math.atan2(vy, vx); ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  if (src === 3) { ctx.beginPath(); ctx.arc(0, 0, Math.max(5, r), 0, TAU); fillStroke(ctx, th, '#FF9B5C', 2.4); ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(r * 0.6, r * 0.6); ctx.lineWidth = 2; ctx.strokeStyle = th.ink; ctx.stroke(); }
  else { const col = src === 0 ? PAPER_2 : src === 1 ? '#FFD66E' : '#8EE4F2'; poly(ctx, [[r * 1.7, 0], [-r * 0.9, -r * 0.8], [-r * 0.5, 0], [-r * 0.9, r * 0.8]]); fillStroke(ctx, th, col, 2); }
  ctx.restore();
}
