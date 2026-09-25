import type { ActionId } from '../types';
import { handKindOf, type HandKind } from './kinds';

/* ============================================================================
   HAND — the cursor becomes a white line-art hand while a gesture is being
   performed. Engraved-plate look: every part is a closed outline filled with
   the backdrop and stroked with ink, painted back-to-front, so nearer parts
   hide the lines of farther ones.

   The hand is a small 3D rig seen from above: a flat palm plus five digits,
   each a chain of three capsules posed by yaw + flex angles (forward
   kinematics). The rig is tilted (pitch/roll), projected orthographically,
   depth-sorted, then placed so the action's working point (brush tip, fist
   face, blade tip, pinch, scoop) lands on (x, y). The wrist trails off to the
   lower right. No allocation per frame beyond a few locals.
   ========================================================================== */

export interface HandState {
  action: ActionId;
  /** Where the working point is, in canvas CSS px: brush tip / fist impact point / blade edge / pinch point / scoop point. */
  x: number; y: number;
  /** Seconds, monotonically increasing; drives idle loops and small secondary motion. */
  t: number;
  /** 0..1 how far the gesture has got. 0 while only hovering. */
  progress: number;
  /** Pointer is down and the player is actively performing the gesture. */
  press: boolean;
  /** Pointer velocity in px/s (x,y) — the hand leans/tilts a little into motion. */
  vx: number; vy: number;
  /** 1 = the size for a bench body of radius ~34px; the caller scales for small screens. */
  scale: number;
  /** 0..1 overall opacity (fade in/out). */
  alpha: number;
}

/** How far (px at scale 1) from (x, y) anything this module draws can reach. */
export const HAND_REACH = 150;
/** Radius (px at scale 1) of the layer the hand body is painted into, around the placed working point. */
const BODY_REACH = 110;

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
/** Rig units → CSS px at scale 1. */
const UNIT = 1.1;
/** Screen yaw of the rig: fingers point up-left, the wrist trails to the lower right. */
const BASE_YAW = -0.64;
const LINE = 1.4;

/* ---- rig -------------------------------------------------------------------
   Local frame: x → little-finger side, y → wrist, z → towards the viewer.
   Digits: 0 thumb, 1 index, 2 middle, 3 ring, 4 little. */
const ROOT: readonly number[] = [-10.2, 2.5, -2.5, -8.4, -13, 0, -2.8, -14.3, 0, 2.9, -13.5, 0, 8.2, -11.4, 0];
const LEN: readonly number[] = [9.5, 7.8, 6.6, 11, 7, 5.6, 12, 7.8, 6, 11, 7.4, 5.6, 8.6, 5.6, 4.7];
const RAD: readonly number[] = [3.4, 2.95, 3.1, 2.9, 2.5];
/** Back of the hand, z = 0, going round from the index knuckle. */
const PALM: readonly number[] = [-11.4, -12.2, -3, -15.4, 4, -15, 10.4, -12.3, 11.6, -2, 9.8, 9.5, 6.2, 14.6, -5.8, 14.6, -10.4, 9, -13.4, -1];

/** Per digit (thumb..little): base yaw, flex at each of the three joints, extra yaw per joint (deg).
 *  Flex curls towards the palm; yaw > 0 turns towards the little finger. */
interface Pose { d: readonly number[]; pitch: number; roll: number; yaw: number }

/* Each action has a rest pose and an alternate that the motion blends towards. */
const POSES: Record<HandKind, readonly [Pose, Pose]> = {
  brush: [
    { d: [-20, 17, 6, 5, 18, -15, 37, 37, 16, 0, 2, 52, 60, 36, 0, 6, 72, 72, 42, 0, 10, 78, 72, 42, 0], pitch: 8, roll: 22, yaw: 4 },
    { d: [-20, 17, 6, 5, 18, -15, 37, 37, 16, 0, 2, 52, 60, 36, 0, 6, 72, 72, 42, 0, 10, 78, 72, 42, 0], pitch: 8, roll: 22, yaw: 4 },
  ],
  smash: [
    { d: [-30, 14, 20, 12, 44, -3, 92, 100, 58, 0, 0, 95, 100, 58, 0, 3, 97, 100, 58, 0, 7, 98, 96, 58, 0], pitch: 36, roll: 10, yaw: 0 },
    { d: [-30, 14, 20, 12, 44, -3, 92, 100, 58, 0, 0, 95, 100, 58, 0, 3, 97, 100, 58, 0, 7, 98, 96, 58, 0], pitch: 36, roll: 10, yaw: 0 },
  ],
  cut: [
    { d: [-4, 42, 26, 18, 44, 3, 2, 4, 3, 0, -2, 2, 4, 3, 0, 5, 92, 100, 58, 0, 9, 94, 98, 58, 0], pitch: 4, roll: 28, yaw: 0 },
    { d: [-4, 42, 26, 18, 44, 3, 6, 8, 5, 0, -2, 6, 8, 5, 0, 5, 92, 100, 58, 0, 9, 94, 98, 58, 0], pitch: 8, roll: 32, yaw: 0 },
  ],
  separate: [
    { d: [-28, 22, 15, 16, 25, -15, 35, 60, 42, 0, 1, 62, 70, 44, 0, 5, 72, 72, 44, 0, 9, 78, 72, 44, 0], pitch: 10, roll: 18, yaw: 0 },
    { d: [-49, 13, 5, 5, 20, -20, 16, 28, 18, 0, 0, 55, 62, 40, 0, 5, 66, 66, 42, 0, 9, 72, 68, 42, 0], pitch: 10, roll: 18, yaw: 0 },
  ],
  dig: [
    { d: [-4, 16, 12, 10, 6, -3, 12, 36, 36, 0, -1, 12, 36, 36, 0, 1, 14, 36, 36, 0, 3, 16, 36, 36, 0], pitch: 2, roll: 46, yaw: 6 },
    { d: [-2, 22, 16, 14, 8, -2, 24, 50, 46, 0, -1, 24, 50, 46, 0, 1, 26, 50, 46, 0, 2, 28, 50, 46, 0], pitch: 12, roll: 50, yaw: 6 },
  ],
};

/* ---- scratch (reused every frame) ---------------------------------------- */
const Q = new Float32Array(28);       // blended pose: 25 digit values + pitch, roll, yaw
const LJ = new Float32Array(60);      // joints in the local (unrotated) frame
const PJ = new Float32Array(60);      // joints tilted: x, y projected, z depth
const PP = new Float32Array(20);      // palm outline projected
const TMP = new Float32Array(3);
const BR = new Float32Array(15);      // brush: handle tail, grip, ferrule start, ferrule end, bristle centre (x, y, z)
/** Brush stations along the handle from the grip, in rig units. */
const BRUSH_AT = [-20, 0, 9, 14, 27] as const;
const KEY = new Float32Array(19);
const ORD = new Uint8Array(19);
let cp = 1; let sp = 0; let cr = 1; let sr = 0;

/** Motion output, rewritten by each frame's action. */
const M = { w: 0, pitch: 0, roll: 0, yaw: 0, ox: 0, oy: 0, s: 1, sqx: 1, sqy: 1, bend: 0, splay: 0.4 };

/* ---- module state (one hand on screen) ------------------------------------ */
let lastT = -1;
let pk = 0;               // eased press 0..1
let phase = 0;            // accumulated cycles for brush / dig
let cutYaw = BASE_YAW;
let lastAction: ActionId | null = null;
/** The pose family of the action being drawn this frame (the other actions borrow one of five poses). */
let HK: HandKind = 'brush';
const TRAIL = new Float32Array(3 * 24);
let trailHead = 0;
let trailN = 0;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: number, b: number, k: number): number => a + (b - a) * k;
const hash = (i: number): number => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function tilt(x: number, y: number, z: number): void {
  const x1 = x * cr + z * sr; const z1 = -x * sr + z * cr;
  TMP[0] = x1; TMP[1] = y * cp + z1 * sp; TMP[2] = -y * sp + z1 * cp;
}

function blendPose(action: HandKind, w: number): void {
  const pair = POSES[action]; const a = pair[0]; const b = pair[1];
  for (let i = 0; i < 25; i++) Q[i] = mix(a.d[i] ?? 0, b.d[i] ?? 0, w);
  Q[25] = mix(a.pitch, b.pitch, w); Q[26] = mix(a.roll, b.roll, w); Q[27] = mix(a.yaw, b.yaw, w);
}

/** Forward kinematics for the five digits, then tilt into PJ. */
function solve(pitch: number, roll: number): void {
  cp = Math.cos(pitch); sp = Math.sin(pitch); cr = Math.cos(roll); sr = Math.sin(roll);
  for (let f = 0; f < 5; f++) {
    let x = ROOT[f * 3]; let y = ROOT[f * 3 + 1]; let z = ROOT[f * 3 + 2];
    let yaw = Q[f * 5] * DEG; let flex = 0;
    const twist = Q[f * 5 + 4] * DEG;
    for (let j = 0; j < 4; j++) {
      if (j > 0) {
        flex += Q[f * 5 + j] * DEG;
        if (j > 1) yaw += twist;
        const L = LEN[f * 3 + j - 1]; const c = Math.cos(flex);
        x += L * Math.sin(yaw) * c; y -= L * Math.cos(yaw) * c; z -= L * Math.sin(flex);
      }
      const o = (f * 4 + j) * 3;
      LJ[o] = x; LJ[o + 1] = y; LJ[o + 2] = z;
      tilt(x, y, z); PJ[o] = TMP[0]; PJ[o + 1] = TMP[1]; PJ[o + 2] = TMP[2];
    }
  }
  for (let i = 0; i < 10; i++) { tilt(PALM[i * 2], PALM[i * 2 + 1], 0); PP[i * 2] = TMP[0]; PP[i * 2 + 1] = TMP[1]; }
}

/* ---- primitives ----------------------------------------------------------- */
/** A tapered capsule outline: backdrop fill, ink stroke. */
function capsule(g: CanvasRenderingContext2D, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): void {
  const dx = x1 - x0; const dy = y1 - y0; const d = Math.hypot(dx, dy);
  g.beginPath();
  if (d <= Math.abs(r0 - r1) + 0.01) {
    g.arc(x0, y0, Math.max(r0, r1), 0, TAU);
  } else {
    const a = Math.atan2(dy, dx); const b = Math.acos((r0 - r1) / d);
    g.arc(x1, y1, r1, a - b, a + b);
    g.arc(x0, y0, r0, a + b, a + TAU - b);
    g.closePath();
  }
  g.fill(); g.stroke();
}

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}

/* ---- per-action motion ---------------------------------------------------- */
function motion(s: HandState, dt: number): void {
  const t = s.t; const p = clamp01(s.progress);
  M.w = 0; M.pitch = 0; M.roll = 0; M.yaw = 0; M.ox = 0; M.oy = 0; M.s = 1; M.sqx = 1; M.sqy = 1; M.bend = 0; M.splay = 0.4;
  switch (HK) {
    case 'brush': {
      phase += dt * mix(1 / 1.1, 1 / 0.55, pk);
      const a = TAU * phase; const sn = Math.sin(a); const cs = Math.cos(a);
      const amp = mix(10, 17, pk);
      M.yaw = sn * mix(0.1, 0.16, pk);
      sweep(amp * sn, -0.3 * amp * sn * sn);
      M.bend = -cs * mix(0.12, 0.38, pk) + pk * Math.pow(sn, 7) * 0.45;
      M.splay = mix(0.62, 0.85, pk) + pk * Math.pow(Math.abs(sn), 6) * 0.35;
      M.roll = sn * 4 * DEG;
      break;
    }
    case 'smash': {
      const hover = 26 + 2.5 * Math.sin(TAU * t / 2.4);
      const c = (t / 0.7) % 1;
      let lift: number; let sq = 0;
      if (c < 0.5) { const u = c / 0.5; lift = 16 + 26 * (1 - (1 - u) ** 3); }
      else if (c < 0.68) { const u = (c - 0.5) / 0.18; lift = 42 * (1 - u * u * u); }
      else if (c < 0.795) { lift = 0; sq = Math.sin(Math.PI * (c - 0.68) / 0.115); }
      else { const u = (c - 0.795) / 0.205; lift = 16 * (1 - (1 - u) * (1 - u)); }
      const L = mix(hover, lift, pk);
      M.oy = -L; M.s = 1 + L * 0.0045;
      M.pitch = (L - 26) * 0.25 * DEG;
      M.sqy = 1 - 0.08 * sq * pk; M.sqx = 1 + 0.045 * sq * pk;
      break;
    }
    case 'cut': {
      const dip = Math.sin(TAU * t / 2.2);
      M.w = pk * 0.6 + (1 - pk) * (0.5 + 0.5 * dip) * 0.35;
      M.yaw = dip * 0.06 * (1 - pk);
      const nudge = 3 * Math.sin(TAU * t / 2.2 + 1.2) * (1 - pk);
      sweep(0, nudge);
      const sp2 = Math.hypot(s.vx, s.vy);
      let target = cutYaw;
      if (!s.press) target = BASE_YAW; else if (sp2 > 40) target = Math.atan2(s.vy, s.vx) + Math.PI / 2;
      let d = target - cutYaw; d -= TAU * Math.round(d / TAU);
      cutYaw += d * (1 - Math.exp(-dt * 10));
      break;
    }
    case 'separate': {
      const open = (0.5 - 0.5 * Math.cos(TAU * t / 1.4)) * 0.75;
      M.w = open * (1 - pk);
      const pull = 24 * p * pk;
      M.ox = -Math.sin(BASE_YAW) * pull; M.oy = Math.cos(BASE_YAW) * pull;
      M.pitch = -8 * p * pk * DEG;
      break;
    }
    case 'dig': {
      phase += dt * mix(1 / 1.6, 1 / 0.9, pk);
      const a = TAU * (phase % 1);
      const h = -Math.sin(a); const fwd = -Math.cos(a);
      const A = mix(4, 6, pk); const B = mix(2.5, 4, pk);
      sweep(0, fwd * A);
      M.oy += -h * B + 6 * p * pk;
      M.s = (1 + h * 0.05) * (1 - 0.05 * p * pk);
      M.w = mix(0.2, 0.55, pk) * (0.5 - 0.5 * Math.cos(a)) + 0.15 * pk;
      M.pitch = (-h * 8 - 4) * DEG;
      break;
    }
  }
  // Lean a little into the motion.
  M.yaw += Math.tanh(s.vx / 700) * 0.12;
  M.pitch += Math.tanh(-s.vy / 700) * 5 * DEG;
}

/** Offset the working point across (u) and along (v, + = forwards) the resting hand axis. */
function sweep(u: number, v: number): void {
  const c = Math.cos(BASE_YAW); const n = Math.sin(BASE_YAW);
  M.ox += c * u + n * v; M.oy += n * u - c * v;
}

/* ---- drawing -------------------------------------------------------------- */
export function drawHand(g: CanvasRenderingContext2D, s: HandState, ink: string, backdrop: string): void {
  const dt = lastT < 0 || s.t < lastT ? 0 : Math.min(0.1, s.t - lastT);
  lastT = s.t;
  HK = handKindOf(s.action);
  if (s.action !== lastAction) { lastAction = s.action; trailN = 0; if (HK === 'cut') cutYaw = BASE_YAW; }
  pk += ((s.press ? 1 : 0) - pk) * (1 - Math.exp(-dt * 12));
  const alpha = clamp01(s.alpha) * 0.96;
  if (alpha <= 0.002) return;

  motion(s, dt);
  blendPose(HK, M.w);
  solve(Q[25] * DEG + M.pitch, Q[26] * DEG + M.roll);

  // Brush geometry (local), from the grip between thumb pad and index pad.
  const brush = HK === 'brush';
  if (brush) {
    // Pen grip: the handle lies under the index's last phalanx and against the thumb pad.
    const gx = (LJ[9] + LJ[18]) / 2; const gy = (LJ[10] + LJ[19]) / 2; const gz = (LJ[11] + LJ[20]) / 2 - 1;
    const dx = -0.12; const dy = -1; const dz = -0.4; const n = Math.hypot(dx, dy, dz);
    const at = BRUSH_AT;
    for (let i = 0; i < 5; i++) {
      const k = (at[i] ?? 0) / n;
      tilt(gx + dx * k, gy + dy * k, gz + dz * k);
      BR[i * 3] = TMP[0]; BR[i * 3 + 1] = TMP[1]; BR[i * 3 + 2] = TMP[2];
    }
  }

  // Working point in the projected rig.
  let ax: number; let ay: number;
  switch (HK) {
    case 'brush': ax = BR[12]; ay = BR[13]; break;
    case 'smash': ax = (PJ[15] + PJ[27] + PJ[39] + PJ[51]) / 4; ay = (PJ[16] + PJ[28] + PJ[40] + PJ[52]) / 4 - 3.5; break;
    case 'cut': ax = (PJ[21] + PJ[33]) / 2; ay = (PJ[22] + PJ[34]) / 2; tipOut(ax, ay, 21, 3); ax = TX; ay = TY; break;
    case 'separate': ax = (PJ[9] + PJ[21]) / 2; ay = (PJ[10] + PJ[22]) / 2; break;
    case 'dig': ax = (PJ[21] + PJ[33] + PJ[45]) / 3; ay = (PJ[22] + PJ[34] + PJ[46]) / 3; tipOut(ax, ay, 33, 3); ax = TX; ay = TY; break;
  }

  const yaw = (HK === 'cut' ? cutYaw : BASE_YAW) + Q[27] * DEG + M.yaw;
  const X = s.x + M.ox * s.scale; const Y = s.y + M.oy * s.scale;
  const S = UNIT * s.scale * M.s;

  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = ink;
  g.lineCap = 'round'; g.lineJoin = 'round';
  underFx(g, s, X, Y, yaw);
  g.restore();

  // The body is painted opaque into a reused layer, then composited once at `alpha`, so hidden
  // lines stay hidden at any opacity. Without a DOM (tests) it draws straight onto g.
  const R = BODY_REACH * s.scale;
  const m = g.getTransform(); const dpr = Math.hypot(m.a, m.b) || 1;
  const px = Math.ceil(2 * R * dpr);
  const L = layer(px);
  const c = L ?? g;
  c.save();
  if (L) {
    L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, px + 4, px + 4); // margin: filtering samples just past the copied rect
    L.setTransform(dpr, 0, 0, dpr, (R - X) * dpr, (R - Y) * dpr);
  } else c.globalAlpha = alpha;
  c.strokeStyle = ink; c.fillStyle = backdrop;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.translate(X, Y); c.scale(M.sqx, M.sqy); c.rotate(yaw); c.scale(S, S); c.translate(-ax, -ay);
  body(c, brush, L ? 1 : alpha, LINE / (UNIT * M.s));
  c.restore();
  if (L) {
    g.save(); g.globalAlpha = alpha;
    g.drawImage(L.canvas, 0, 0, px, px, X - R, Y - R, 2 * R, 2 * R);
    g.restore();
  }

  g.save();
  g.lineCap = 'round'; g.strokeStyle = ink;
  overFx(g, s, alpha, X, Y, yaw);
  g.restore();
}

/** Palm, digits and brush, depth-sorted: segments tucked under the palm go behind it, the rest in front by depth. */
function body(g: CanvasRenderingContext2D, brush: boolean, alpha: number, lw: number): void {
  g.lineWidth = lw;
  wrist(g, alpha, lw);
  let n = 0;
  for (let f = 0; f < 5; f++) for (let j = 0; j < 3; j++) {
    const o = (f * 4 + j) * 3;
    const mx = (LJ[o] + LJ[o + 3]) / 2; const my = (LJ[o + 1] + LJ[o + 4]) / 2; const mz = (LJ[o + 2] + LJ[o + 5]) / 2;
    const under = mz < -1.5 && my > -12.5 && mx > -12 && mx < 12;
    KEY[n] = (under ? -100 : 100) + (PJ[o + 2] + PJ[o + 5]) / 2 + (f === 0 ? 0.5 : 0); ORD[n] = n; n++;
  }
  KEY[n] = 0; ORD[n] = 15; n++;
  if (brush) {
    KEY[n] = 100 + (BR[2] + BR[5]) / 2; ORD[n] = 16; n++;
    KEY[n] = 100 + (BR[5] + BR[8]) / 2 - 2; ORD[n] = 17; n++;
    KEY[n] = 100 + BR[11]; ORD[n] = 18; n++;
  }
  for (let i = 1; i < n; i++) {
    const v = ORD[i]; const k = KEY[v]; let j = i - 1;
    while (j >= 0 && KEY[ORD[j]] > k) { ORD[j + 1] = ORD[j]; j--; }
    ORD[j + 1] = v;
  }
  for (let i = 0; i < n; i++) {
    const id = ORD[i];
    if (id === 15) palm(g, alpha, lw);
    else if (id === 16) capsule(g, BR[0], BR[1], 1.35, BR[3], BR[4], 1.5);
    else if (id === 17) capsule(g, BR[3], BR[4], 1.5, BR[6], BR[7], 1.6);
    else if (id === 18) bristles(g, alpha, lw);
    else segment(g, (id / 3) | 0, id % 3, alpha, lw);
  }
}

let layerCanvas: HTMLCanvasElement | null = null;
let layerCtx: CanvasRenderingContext2D | null = null;
/** One offscreen canvas for the whole module; grows, never shrinks. */
function layer(px: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!layerCanvas) { layerCanvas = document.createElement('canvas'); layerCtx = layerCanvas.getContext('2d'); }
  if (layerCanvas.width < px || layerCanvas.height < px) { layerCanvas.width = px; layerCanvas.height = px; }
  return layerCtx;
}

/** Push a projected point out past a fingertip (joint offset o) by r, along its last segment; result in TX, TY. */
let TX = 0; let TY = 0;
function tipOut(x: number, y: number, o: number, r: number): void {
  const dx = PJ[o] - PJ[o - 3]; const dy = PJ[o + 1] - PJ[o - 2]; const d = Math.hypot(dx, dy) || 1;
  TX = x + (dx / d) * r; TY = y + (dy / d) * r;
}

function segment(g: CanvasRenderingContext2D, f: number, j: number, alpha: number, lw: number): void {
  const o = (f * 4 + j) * 3; const R = RAD[f];
  const r0 = R * (1 - 0.07 * j); const r1 = R * (1 - 0.07 * (j + 1));
  capsule(g, PJ[o], PJ[o + 1], r0, PJ[o + 3], PJ[o + 4], r1);
  if (j !== 2) return;
  // Nail: only when the last phalanx lies nearly flat, back up.
  const dx = PJ[o + 3] - PJ[o]; const dy = PJ[o + 4] - PJ[o + 1]; const d = Math.hypot(dx, dy);
  if (d < LEN[f * 3 + 2] * 0.8) return;
  const ux = dx / d; const uy = dy / d; const a = Math.atan2(dy, dx);
  const cx = PJ[o + 3] - ux * r1 * 0.35; const cy = PJ[o + 4] - uy * r1 * 0.35; const rn = r1 * 0.5;
  g.globalAlpha = alpha * 0.55; g.lineWidth = lw * 0.6;
  g.beginPath();
  g.moveTo(cx - ux * rn * 1.3 + Math.cos(a - Math.PI / 2) * rn, cy - uy * rn * 1.3 + Math.sin(a - Math.PI / 2) * rn);
  g.arc(cx, cy, rn, a - Math.PI / 2, a + Math.PI / 2);
  g.lineTo(cx - ux * rn * 1.3 + Math.cos(a + Math.PI / 2) * rn, cy - uy * rn * 1.3 + Math.sin(a + Math.PI / 2) * rn);
  g.stroke();
  g.globalAlpha = alpha; g.lineWidth = lw;
}

function palm(g: CanvasRenderingContext2D, alpha: number, lw: number): void {
  g.beginPath();
  let px = PP[18]; let py = PP[19];
  g.moveTo((px + PP[0]) / 2, (py + PP[1]) / 2);
  for (let i = 0; i < 10; i++) {
    px = PP[i * 2]; py = PP[i * 2 + 1];
    const k = ((i + 1) % 10) * 2;
    g.quadraticCurveTo(px, py, (px + PP[k]) / 2, (py + PP[k + 1]) / 2);
  }
  g.closePath(); g.fill(); g.stroke();
  // Engraver's shading: a few short strokes along the little-finger edge, and the tendon of the index.
  g.globalAlpha = alpha * 0.45; g.lineWidth = lw * 0.65;
  for (let i = 0; i < 4; i++) {
    tilt(7.4, -5 + i * 4.2, 0); const x0 = TMP[0]; const y0 = TMP[1];
    tilt(9.6, -6.4 + i * 4.2, 0); line(g, x0, y0, TMP[0], TMP[1]);
  }
  g.globalAlpha = alpha; g.lineWidth = lw;
}

/** Two sides of the forearm that thin out, with a few hatch strokes; drawn first, never filled. */
function wrist(g: CanvasRenderingContext2D, alpha: number, lw: number): void {
  for (let side = 0; side < 2; side++) {
    const x0 = side ? 8.2 : -8.6; const x1 = side ? 10.2 : -9.6;
    for (let k = 0; k < 4; k++) {
      g.globalAlpha = alpha * (1 - k * 0.27);
      const a = k / 4; const b = (k + 1) / 4;
      tilt(mix(x0, x1, a), mix(12, 38, a), 0); const px = TMP[0]; const py = TMP[1];
      tilt(mix(x0, x1, b), mix(12, 38, b), 0);
      line(g, px, py, TMP[0], TMP[1]);
    }
  }
  g.lineWidth = lw * 0.65;
  for (let k = 0; k < 4; k++) {
    g.globalAlpha = alpha * (0.5 - k * 0.11);
    tilt(3.2 + k * 0.4, 19 + k * 4.5, 0); const px = TMP[0]; const py = TMP[1];
    tilt(8.6 + k * 0.4, 16.5 + k * 4.5, 0);
    line(g, px, py, TMP[0], TMP[1]);
  }
  g.globalAlpha = alpha; g.lineWidth = lw;
}

function bristles(g: CanvasRenderingContext2D, alpha: number, lw: number): void {
  // Ferrule: a short fatter capsule with two bands.
  capsule(g, BR[6], BR[7], 1.9, BR[9], BR[10], 2.1);
  const fx = BR[9]; const fy = BR[10]; const dx = BR[12] - fx; const dy = BR[13] - fy;
  const L = Math.hypot(dx, dy) || 1; const ux = dx / L; const uy = dy / L; const lx = -uy; const ly = ux;
  g.lineWidth = lw * 0.7;
  for (let b = 0; b < 2; b++) {
    const bx = mix(BR[6], fx, 0.35 + b * 0.3); const by = mix(BR[7], fy, 0.35 + b * 0.3);
    line(g, bx - lx * 1.9, by - ly * 1.9, bx + lx * 1.9, by + ly * 1.9);
  }
  g.lineWidth = lw * 0.7;
  for (let i = 0; i < 6; i++) {
    const u = i / 2.5 - 1;
    const sx = fx + lx * u * 1.8; const sy = fy + ly * u * 1.8;
    const off = u * M.splay * L * 0.45 + M.bend * L * 0.5; const back = u * u * L * 0.14;
    const tx = BR[12] + lx * off - ux * back; const ty = BR[13] + ly * off - uy * back;
    const cx = (sx + tx) / 2 - lx * M.bend * L * 0.18; const cy = (sy + ty) / 2 - ly * M.bend * L * 0.18;
    g.globalAlpha = alpha * (0.75 + 0.25 * (1 - Math.abs(u)));
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
  }
  g.globalAlpha = alpha; g.lineWidth = lw;
}

/* ---- effects (screen space) ------------------------------------------------ */
function underFx(g: CanvasRenderingContext2D, s: HandState, X: number, Y: number, yaw: number): void {
  const sc = s.scale; const p = clamp01(s.progress); const a0 = g.globalAlpha;
  const fx = Math.sin(yaw); const fy = -Math.cos(yaw); // forwards along the fingers
  switch (HK) {
    case 'smash': {
      if (p > 0) {
        g.lineWidth = 1 * sc; g.globalAlpha = a0 * 0.8;
        crack(g, s.x, s.y, sc, p, 1); crack(g, s.x, s.y, sc, p * 0.8, -1);
      }
      const tc = (((s.t / 0.7) % 1) - 0.68) * 0.7;
      if (pk > 0.5 && tc >= 0 && tc < 0.25) {
        const e = tc / 0.25; g.lineWidth = 1.2 * sc; g.globalAlpha = a0 * (1 - e) * pk;
        for (let i = 0; i < 6; i++) {
          const a = i * (TAU / 6) + 0.35 + (hash(i) - 0.5) * 0.4;
          const r0 = (7 + 15 * e) * sc; const r1 = r0 + (8 * (1 - e) + 2) * sc;
          line(g, s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0 * 0.8, s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1 * 0.8);
        }
      }
      break;
    }
    case 'cut': {
      if (p > 0) {
        const ang = cutYaw; const cx = Math.sin(ang); const cy = -Math.cos(ang);
        const L = 64 * p * sc; g.lineWidth = 0.7 * sc; g.globalAlpha = a0 * 0.85;
        line(g, s.x - cx * L * 0.6, s.y - cy * L * 0.6, s.x + cx * L * 0.4, s.y + cy * L * 0.4);
        g.globalAlpha = a0 * 0.5;
        line(g, s.x + cx * L * 0.4 - cy * 2.5 * sc, s.y + cy * L * 0.4 + cx * 2.5 * sc, s.x + cx * L * 0.4 + cy * 2.5 * sc, s.y + cy * L * 0.4 - cx * 2.5 * sc);
      }
      // Trail of recent tip positions while pressed.
      if (s.press) {
        const last = (trailHead + 23) % 24;
        if (trailN === 0 || s.t - TRAIL[last * 3 + 2] > 0.012) {
          TRAIL[trailHead * 3] = X; TRAIL[trailHead * 3 + 1] = Y; TRAIL[trailHead * 3 + 2] = s.t;
          trailHead = (trailHead + 1) % 24; trailN = Math.min(24, trailN + 1);
        }
      }
      // The tip's own path runs under the blade, so its wake is two fading hairlines either side of it.
      g.lineWidth = 0.9 * sc;
      for (let i = 1; i < trailN; i++) {
        const a = (trailHead - i + 24) % 24; const b = (trailHead - i - 1 + 24) % 24;
        const age = s.t - TRAIL[a * 3 + 2]; if (age > 0.3) break;
        const x0 = TRAIL[a * 3]; const y0 = TRAIL[a * 3 + 1]; const x1 = TRAIL[b * 3]; const y1 = TRAIL[b * 3 + 1];
        const d = Math.hypot(x1 - x0, y1 - y0); if (d < 0.5) continue;
        const nx = ((y0 - y1) / d) * 8 * sc; const ny = ((x1 - x0) / d) * 8 * sc;
        const k = 1 - age / 0.3;
        g.globalAlpha = a0 * k * 0.75; line(g, x0 + nx, y0 + ny, x1 + nx, y1 + ny);
        g.globalAlpha = a0 * k * 0.4; line(g, x0 - nx, y0 - ny, x1 - nx, y1 - ny);
      }
      break;
    }
    case 'separate': {
      const k = pk * clamp01(p * 3);
      if (k > 0.01) {
        const bx = -fx; const by = -fy; // pull axis
        const gap = (2 + 7 * p) * sc; const half = 7 * sc; const bow = (2 + 4 * p) * sc;
        g.lineWidth = 1 * sc; g.globalAlpha = a0 * k;
        for (let side = -1; side <= 1; side += 2) {
          const mx = s.x + bx * gap * side * 0.5; const my = s.y + by * gap * side * 0.5;
          g.beginPath();
          g.moveTo(mx - by * half, my + bx * half);
          g.quadraticCurveTo(mx + bx * bow * side, my + by * bow * side, mx + by * half, my - bx * half);
          g.stroke();
        }
      }
      break;
    }
    case 'brush': case 'dig': break;
  }
  g.globalAlpha = a0;
}

function overFx(g: CanvasRenderingContext2D, s: HandState, alpha: number, X: number, Y: number, yaw: number): void {
  const sc = s.scale; const p = clamp01(s.progress);
  if (HK === 'brush' && pk > 0.05) {
    const rate = mix(1 / 1.1, 1 / 0.55, pk); const amp = mix(10, 17, pk);
    const c = Math.cos(BASE_YAW); const n = Math.sin(BASE_YAW);
    g.lineWidth = 0.9 * sc;
    for (let k = 1; k <= 5; k++) {
      const ph = TAU * (phase - k * 0.05 * rate);
      const u = amp * Math.sin(ph); const v = -0.3 * amp * Math.sin(ph) ** 2;
      const vel = Math.cos(ph) >= 0 ? 1 : -1;
      const j = Math.floor(phase * 2) * 7 + k;
      const off = (hash(j) - 0.5) * 7;
      const x = s.x + (c * u + n * v + n * off) * sc; const y = s.y + (n * u - c * v - c * off) * sc;
      g.globalAlpha = alpha * pk * (0.35 + 0.65 * p) * (1 - k / 6);
      line(g, x, y, x - c * vel * 3 * sc, y - n * vel * 3 * sc);
    }
  } else if (HK === 'dig' && pk > 0.05) {
    const rate = mix(1 / 1.6, 1 / 0.9, pk); const u = phase % 1;
    if (u > 0.5) {
      const tau = (u - 0.5) / rate;
      if (tau < 0.45) {
        const e = tau / 0.45; const fx = Math.sin(yaw); const fy = -Math.cos(yaw);
        const cyc = Math.floor(phase);
        g.lineWidth = 1.1 * sc;
        for (let i = 0; i < 5; i++) {
          const h = hash(cyc * 5 + i);
          const a = (i - 2) * 0.45 + (h - 0.5) * 0.4;
          const dx = fx * Math.cos(a) - fy * Math.sin(a); const dy = fx * Math.sin(a) + fy * Math.cos(a);
          const sp = 50 + 45 * h; const d = 9 + sp * tau;
          const x = X + dx * d * sc; const y = Y + (dy * d - 40 * tau + 70 * tau * tau) * sc;
          const vx = dx * sp; const vy = dy * sp - 40 + 140 * tau; const vl = Math.hypot(vx, vy) || 1;
          const len = (1 + (1.5 + 2.5 * hash(cyc * 5 + i + 9)) * (1 - e)) * sc;
          g.globalAlpha = alpha * pk * (1 - e) * (0.6 + 0.4 * p);
          line(g, x, y, x - (vx / vl) * len, y - (vy / vl) * len);
        }
      }
    }
  }
}

/** A hairline fracture from the impact point, revealed up to p; a short branch forks off halfway. */
function crack(g: CanvasRenderingContext2D, x: number, y: number, sc: number, p: number, dir: number): void {
  const n = 6; const reach = n * p;
  let px = x; let py = y; let bx = x; let by = y;
  g.beginPath(); g.moveTo(x, y);
  for (let i = 1; i <= n && i - 1 < reach; i++) {
    const h = hash(i * 5 + dir * 17);
    const nx = px + dir * (3 + 3.5 * h) * sc; const ny = py + ((i % 2 ? 1 : -1) * (1 + 2.2 * hash(i + dir * 3)) + 0.5 * dir) * sc;
    const k = Math.min(1, reach - (i - 1));
    g.lineTo(mix(px, nx, k), mix(py, ny, k));
    px = nx; py = ny;
    if (i === 3) { bx = px; by = py; }
  }
  if (reach > 3.5) {
    const k = Math.min(1, (reach - 3.5) / 2);
    g.moveTo(bx, by); g.lineTo(bx + dir * 3 * sc * k, by + 4 * sc * k); g.lineTo(bx + dir * 4.5 * sc * k, by + 7 * sc * k);
  }
  g.stroke();
}

/* ---- icons ---------------------------------------------------------------- */
/** A small static glyph of the pose for the action buttons (fits size×size centred at cx, cy). */
export function drawHandIcon(g: CanvasRenderingContext2D, action: ActionId, cx: number, cy: number, size: number, ink: string): void {
  const k = size / 30;
  g.save();
  g.translate(cx, cy); g.scale(k, k); g.rotate(BASE_YAW * 0.7); g.translate(2, 1.5);
  g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = Math.max(1, 1.25 * Math.min(1.6, size / 24)) / k;
  // Designed fingers-up in a 24 box; rotated so the wrist trails to the lower right.
  const hand = (top: number): void => { // palm outline open at the wrist
    g.beginPath(); g.moveTo(-5.5, 11); g.lineTo(-6, top + 3); g.quadraticCurveTo(-6, top, -3, top); g.lineTo(3, top);
    g.quadraticCurveTo(6, top, 6, top + 3); g.lineTo(5.5, 11); g.stroke();
  };
  const knuckles = (x0: number, n: number, y: number): void => {
    g.beginPath(); for (let i = 0; i < n; i++) g.arc(x0 + i * 3 + 1.5, y, 1.5, Math.PI, 0); g.stroke();
  };
  switch (handKindOf(action)) {
    case 'brush':
      hand(2); knuckles(-0.5, 2, 2);
      g.beginPath(); g.moveTo(3.5, 6); g.lineTo(-3.4, -3.6); g.stroke();                  // handle, held in the web
      g.beginPath(); g.moveTo(-3.4, -3.6); g.lineTo(-4.6, -5.4);                          // ferrule + bristle fan
      for (let i = -1; i <= 1; i++) { g.moveTo(-4.6, -5.4); g.lineTo(-7.4 + i * 2.4, -11 + i * 1.4); }
      g.stroke();
      break;
    case 'smash':
      hand(-3); knuckles(-6, 4, -3);
      g.beginPath(); g.moveTo(-6, 3); g.quadraticCurveTo(-3, 0, 1.5, 0.5); g.stroke();  // thumb over
      g.beginPath(); g.moveTo(-5, -8); g.lineTo(-6, -10); g.moveTo(0, -8.5); g.lineTo(0, -11); g.moveTo(5, -8); g.lineTo(6, -10); g.stroke();
      break;
    case 'cut':
      hand(0); knuckles(0, 2, 0);
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(-6, -8); g.arc(-3, -8, 3, Math.PI, 0); g.lineTo(0, 0); g.stroke(); // blade
      g.beginPath(); g.moveTo(-3, -1); g.lineTo(-3, -8); g.stroke();
      g.beginPath(); g.moveTo(-3, -13.5); g.lineTo(-3, -12.2); g.stroke();
      break;
    case 'separate':
      hand(0); knuckles(0, 2, 0);
      g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(-3, -8, -7.4, -7.4); g.stroke();   // index
      g.beginPath(); g.moveTo(-6, 5); g.quadraticCurveTo(-10, 1.5, -8, -5.8); g.stroke();   // thumb
      g.beginPath(); g.moveTo(-9.6, -8.4); g.quadraticCurveTo(-11.2, -9.2, -11.4, -11.6);   // the two halves peeling apart
      g.moveTo(-8.2, -9.6); g.quadraticCurveTo(-8.4, -11.6, -9.8, -12.8); g.stroke();
      break;
    case 'dig':
      hand(1);
      g.beginPath(); g.moveTo(-5.5, 1); g.lineTo(-5.5, -5); g.quadraticCurveTo(-5.5, -10.5, 0.5, -10.5); // fingers curled forward
      g.quadraticCurveTo(5.5, -10.5, 5.5, -6); g.quadraticCurveTo(5.5, -3.5, 3, -3.5); g.stroke();       // hooked tips
      g.beginPath(); g.moveTo(-7.5, -9); g.lineTo(-9, -10.4); g.moveTo(-6.4, -12.6); g.lineTo(-7.2, -14.4); g.moveTo(-3, -13.6); g.lineTo(-3, -15.2); g.stroke(); // soil
      break;
  }
  g.restore();
}
