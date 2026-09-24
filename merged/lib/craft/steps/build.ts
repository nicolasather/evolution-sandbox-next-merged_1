import type { Body, StepCtx, StepDef, ZoneId } from '../types';
import { Step, angDiff, beacon, arcRing, chevrons, clamp, dashedCircle, dist, num, pickTool, str, TAU } from './util';

/* ============================================================================
   BUILD STEPS — putting things where they belong.
     align     drag one piece to a ghost pose, turn it to match, hold it there
     assemble  several pieces, each to its own socket; snaps softly when close
     stack     the same, but bottom-up: the next level opens when one is set
     place     carry the piece to a station (hearth, anvil, basin)

   Nothing here decides what a recipe makes. It only asks the hands to do the
   part that a person would do: pick up, turn, set down.
   ========================================================================== */

const HALF_PI = Math.PI / 2;

/** The piece a recipe works on: the metal for stations, else the second item. */
function workpiece(c: StepCtx, want: unknown): { piece: Body; other: Body } {
  const piece = want === 'a' ? c.a : want === 'b' ? c.b
    : c.a.material === 'metal' ? c.a : c.b.material === 'metal' ? c.b : c.b;
  return { piece, other: piece === c.a ? c.b : c.a };
}

/** Signed angle error folded to (−π/2, π/2]: pieces are symmetric end to end. */
function foldedErr(rel: number, goal: number): number {
  let s = angDiff(rel, goal);
  if (s > HALF_PI) s -= Math.PI;
  else if (s < -HALF_PI) s += Math.PI;
  return s;
}

/* ── align ─────────────────────────────────────────────────────────────── */

class Align extends Step {
  readonly kind = 'align' as const;
  private piece: Body;
  private anchor: Body;
  private tx: number; private ty: number;
  private goalRel: number | null;
  private anchorAngle: number;
  private tolP: number; private tolA: number;
  private dwell = 0;
  private snapped = false;
  private snapT = 0;
  private stuck = 0;
  private touched = false;

  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.grabs = true;
    const { tool, target } = pickTool(c, p.piece, undefined);
    this.piece = tool; this.anchor = target;
    const R = this.anchor.r;
    const hasD = p.dx !== undefined || p.dy !== undefined;
    const dx = hasD ? num(p.dx, 0) : -1.1, dy = num(p.dy, 0);
    this.tx = c.cx + dx * R; this.ty = c.cy + dy * R;
    this.anchorAngle = (num(p.anchorAngle, 0) * Math.PI) / 180;
    this.goalRel = p.angle === undefined ? null : (num(p.angle, 0) * Math.PI) / 180;
    // windows: a hidden resistance narrows them, failures widen them
    const soft = (1 + c.assist * 0.9) / (0.85 + 0.15 * c.res);
    this.tolP = 0.46 * soft;
    this.tolA = 0.34 * soft;

    // the anchor is set down in the middle and stays put
    const a = this.anchor;
    // pieces are set against each other: no collisions while placing
    a.solid = false; this.piece.solid = false;
    a.locked = true; a.grabbable = false; a.held = false;
    a.x = c.cx; a.y = c.cy; a.vx = a.vy = 0; a.angle = a.targetAngle = this.anchorAngle;

    // the piece starts off to the side, and turned the wrong way if turning matters
    const pc = this.piece;
    const side = c.rnd() < 0.5 ? -1 : 1;
    pc.x = c.cx + side * Math.min(c.w * 0.3, 190);
    pc.y = c.cy + c.h * 0.1;
    if (Math.hypot(pc.x - this.tx, pc.y - this.ty) < R * 2.4) pc.x = c.cx - side * Math.min(c.w * 0.3, 190);
    pc.vx = pc.vy = 0; pc.tx = pc.x; pc.ty = pc.y;
    if (this.goalRel !== null) {
      pc.angle = pc.targetAngle = this.anchorAngle + this.goalRel + side * (1 + c.rnd() * 0.5);
    }
  }

  private err() {
    const pc = this.piece;
    const d = dist(pc.x, pc.y, this.tx, this.ty) / this.anchor.r;
    const e = this.goalRel === null ? 0 : Math.abs(foldedErr(pc.angle - this.anchor.angle, this.goalRel));
    return { d, e, posOk: d <= this.tolP, angOk: e <= this.tolA };
  }

  private snap(c: StepCtx) {
    if (this.snapped) return;
    this.snapped = true; this.snapT = 0;
    const pc = this.piece;
    pc.locked = true; pc.grabbable = false;
    pc.q = 0.16;
    c.fx.sound('click', { vol: 0.8 });
    c.fx.ring(this.tx, this.ty, pc.r * 1.3, { color: 'ochre', life: 0.45 });
    c.fx.burst(this.tx, this.ty, { n: 6, color: 'bone2', speed: 50, life: 0.35 });
  }

  key(k: 'primary' | 'interact' | 'rotate', c: StepCtx, shift?: boolean) {
    if (this.snapped) return;
    const pc = this.piece;
    if (k === 'rotate') { c.world.rotate(pc, shift ? -Math.PI / 12 : Math.PI / 12); c.fx.sound('tick', { vol: 0.3 }); return; }
    // keyboard route: each press closes part of the gap, three finish it
    pc.x += (this.tx - pc.x) * 0.45; pc.y += (this.ty - pc.y) * 0.45;
    pc.tx = pc.x; pc.ty = pc.y; pc.vx = pc.vy = 0;
    if (this.goalRel !== null) pc.targetAngle += -foldedErr(pc.targetAngle - this.anchor.angle, this.goalRel) * 0.6;
    c.fx.sound('tick', { vol: 0.35 });
  }

  wheel(dy: number, c: StepCtx) {
    if (this.snapped) return;
    const by = Math.sign(dy) * Math.min(0.35, Math.abs(dy) * 0.0024);
    c.world.rotate(c.ptr.grab === this.piece ? this.piece : this.piece, by);
  }

  down(c: StepCtx) { if (c.ptr.grab === this.piece) this.touched = true; }

  update(dt: number, c: StepCtx) {
    const pc = this.piece;
    this.stuck += dt;
    // never stuck: after a long wait the windows quietly open
    if (this.stuck > 10 && !this.snapped) { const g = 1 + Math.min(0.9, (this.stuck - 10) * 0.05); this.tolP *= 1 + (g - 1) * dt; this.tolA *= 1 + (g - 1) * dt; }

    if (this.snapped) {
      this.snapT += dt;
      c.world.glide(pc, this.tx, this.ty, 20);
      if (this.goalRel !== null) pc.angle += angDiff(this.anchor.angle + this.goalRel, pc.angle) * Math.min(1, dt * 14);
      pc.targetAngle = pc.angle;
      pc.z += (0 - pc.z) * Math.min(1, dt * 14);
      this.progress = 1;
      if (this.snapT > 0.24) { pc.locked = false; this.finish(); }
      return;
    }

    const { d, e, posOk, angOk } = this.err();

    // soft magnetism: near the ghost, the hand is helped a little
    if (pc.held && d < 2.2) {
      const k = 1 - d / 2.2;
      const f = 1 - Math.exp(-dt * 7 * k);
      pc.tx += (this.tx - pc.tx) * f; pc.ty += (this.ty - pc.ty) * f;
      if (this.goalRel !== null && e < 0.55) {
        pc.targetAngle += -foldedErr(pc.targetAngle - this.anchor.angle, this.goalRel) * (1 - Math.exp(-dt * 3.2));
      }
    }

    if (posOk && angOk) this.dwell += dt; else this.dwell = Math.max(0, this.dwell - dt * 2);
    if (this.dwell >= 0.28) this.snap(c);

    const pk = 1 - clamp(d / 5), ak = this.goalRel === null ? 1 : 1 - clamp(e / 1.4);
    this.progress = clamp(pk * 0.6 + ak * 0.4) * 0.92;
  }

  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const pc = this.piece;
    if (this.snapped) return;
    const { posOk, angOk } = this.err();
    const good = posOk && angOk;
    const col = good ? c.pal.good : c.pal.ochre;
    dashedCircle(g, this.tx, this.ty, pc.r * 0.98, col, c.t, good ? 0.95 : 0.6);
    if (this.goalRel !== null) {
      // the way it must point: a line through the ghost, ticked at the ends
      const ang = this.anchor.angle + this.goalRel;
      const L = pc.r * 1.3;
      g.save();
      g.strokeStyle = col; g.lineWidth = 1.6; g.globalAlpha = 0.75; g.lineCap = 'round';
      g.setLineDash([4, 5]);
      g.beginPath();
      g.moveTo(this.tx - Math.cos(ang) * L, this.ty - Math.sin(ang) * L);
      g.lineTo(this.tx + Math.cos(ang) * L, this.ty + Math.sin(ang) * L);
      g.stroke();
      g.setLineDash([]);
      for (const s of [-1, 1]) {
        g.beginPath(); g.arc(this.tx + Math.cos(ang) * L * s, this.ty + Math.sin(ang) * L * s, 2.2, 0, TAU); g.fillStyle = col; g.fill();
      }
      g.restore();
    }
    if (this.dwell > 0) arcRing(g, this.tx, this.ty, pc.r * 1.28, this.dwell / 0.28, c.pal.good, 2.4);
    if (!this.touched && !pc.held) beacon(g, pc.x, pc.y, pc.r * 1.15, c.t, c.pal.ochre);
    if (!pc.held && !good && dist(pc.x, pc.y, this.tx, this.ty) > pc.r * 1.6) chevrons(g, pc.x, pc.y, this.tx, this.ty, c.t, c.pal.ochre, 0.55);
    g.globalAlpha = 1;
  }

  cleanup() {
    this.piece.locked = false; this.anchor.locked = false;
    this.piece.grabbable = true; this.anchor.grabbable = true;
  }
}

/* ── assemble / stack ──────────────────────────────────────────────────── */

interface SocketDef { x: number; y: number; part: string; angle?: number; use?: boolean }
interface Layout { pr: number; sockets: SocketDef[]; ordered?: boolean }

/**
 * Socket layouts, in units of the bench unit (x right, y down, 0,0 is the middle).
 * `use` sockets take the two things the player brought; the others take spare parts.
 * To add a shape, add an entry here and name it in a recipe: `assemble { layout: 'yours' }`.
 */
export const LAYOUTS: Record<string, (n: number) => Layout> = {
  cart: () => ({
    pr: 0.62,
    sockets: [
      { x: -1.55, y: 0.55, part: 'wheel' },
      { x: 0, y: 0.55, part: 'axle', use: true },
      { x: 1.55, y: 0.55, part: 'wheel' },
      { x: 0, y: -0.7, part: 'frame', use: true },
    ],
  }),
  row: n => ({
    pr: 0.6,
    sockets: Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * 1.25, y: 0, part: 'stake', use: i < 2 })),
  }),
  tent: n => ({
    pr: 0.6,
    sockets: [
      { x: -1.05, y: 0.35, part: 'pole', angle: 0.35, use: true },
      { x: 1.05, y: 0.35, part: 'pole', angle: -0.35, use: true },
      { x: 0, y: -0.6, part: 'cover' },
      ...Array.from({ length: Math.max(0, n - 3) }, (_, i) => ({ x: (i % 2 ? 1 : -1) * 1.75, y: 1.05, part: 'peg' })),
    ],
  }),
  ladder: n => ({
    pr: 0.5,
    sockets: [
      { x: -0.95, y: 0, part: 'pole', use: true },
      { x: 0.95, y: 0, part: 'pole', use: true },
      ...Array.from({ length: Math.max(1, n - 2) }, (_, i) => ({ x: 0, y: (i - (Math.max(1, n - 2) - 1) / 2) * 0.85, part: 'rung' })),
    ],
  }),
  hull: () => ({
    pr: 0.6,
    sockets: [
      { x: 0, y: 0.75, part: 'hull', use: true },
      { x: 0, y: 0.05, part: 'plank', use: true },
      { x: 0, y: -0.75, part: 'pole' },
      { x: 1.1, y: -0.6, part: 'cover' },
    ],
  }),
  gears: n => ({
    pr: 0.6,
    sockets: Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * 1.1, y: i % 2 ? 0.35 : -0.35, part: 'gear', use: i < 2 })),
  }),
  tower: n => ({
    pr: 0.52,
    ordered: true,
    sockets: Array.from({ length: n }, (_, i) => ({ x: 0, y: 0.95 - i * 0.95, part: '*' })),
  }),
};

const DEFAULT_N: Record<string, number> = { cart: 4, row: 4, tent: 3, ladder: 5, hull: 4, gears: 3, tower: 3 };
const layoutCount = (p: Record<string, unknown>) => Math.round(num(p.n, DEFAULT_N[str(p.layout, 'row')] ?? 3));

interface Socket extends SocketDef { px: number; py: number; ang: number; filled: Body | null }

/** Minimal line icon for a socket: what kind of piece goes here. */
function partIcon(g: CanvasRenderingContext2D, part: string, x: number, y: number, s: number) {
  g.beginPath();
  switch (part) {
    case 'wheel': g.arc(x, y, s, 0, TAU); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); break;
    case 'gear': g.arc(x, y, s * 0.7, 0, TAU); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.moveTo(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7); g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } break;
    case 'frame': g.rect(x - s, y - s * 0.5, s * 2, s); g.moveTo(x, y - s * 0.5); g.lineTo(x, y + s * 0.5); break;
    case 'axle': case 'rung': g.moveTo(x - s, y); g.lineTo(x + s, y); break;
    case 'pole': case 'stake': g.moveTo(x, y - s); g.lineTo(x, y + s); break;
    case 'plank': g.rect(x - s, y - s * 0.28, s * 2, s * 0.56); break;
    case 'hull': g.moveTo(x - s, y - s * 0.3); g.lineTo(x + s, y - s * 0.3); g.quadraticCurveTo(x + s * 0.6, y + s * 0.8, x, y + s * 0.8); g.quadraticCurveTo(x - s * 0.6, y + s * 0.8, x - s, y - s * 0.3); break;
    case 'cover': g.moveTo(x - s, y + s * 0.4); g.quadraticCurveTo(x, y - s, x + s, y + s * 0.4); g.closePath(); break;
    case 'peg': g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y + s * 0.6); g.lineTo(x - s * 0.3, y + s * 0.6); g.closePath(); break;
    default: g.arc(x, y, s * 0.3, 0, TAU);
  }
  g.stroke();
}

class Assemble extends Step {
  readonly kind: 'assemble' | 'stack';
  private sockets: Socket[] = [];
  private pieces: Body[] = [];
  private ordered: boolean;
  private S = 34;
  private R = 30;
  private settle = 0;
  private touched = false;

  constructor(kind: 'assemble' | 'stack', p: Record<string, unknown>, c: StepCtx) {
    super();
    this.kind = kind;
    this.grabs = true;
    const layoutId = kind === 'stack' ? 'tower' : str(p.layout, 'row');
    const build = LAYOUTS[layoutId] ?? LAYOUTS.row;
    const n = Math.max(2, kind === 'stack' ? Math.round(num(p.n, 3)) : layoutCount(p));
    const lay = build(n);
    this.ordered = !!lay.ordered;

    // scale the layout to the bench
    const hw = Math.max(...lay.sockets.map(s => Math.abs(s.x))) + lay.pr;
    const hh = Math.max(...lay.sockets.map(s => Math.abs(s.y))) + lay.pr;
    const S = Math.max(18, Math.min(c.world.unit * 1.15, (c.w * 0.44) / hw, (c.h * 0.3) / hh));
    this.S = S;
    this.R = S * 0.8 * (1 + c.assist * 0.5) / (0.9 + 0.1 * c.res);
    const cy = c.cy - S * 0.35;
    this.sockets = lay.sockets.map(s => ({
      ...s, px: c.cx + s.x * S, py: cy + s.y * S, ang: s.angle ?? 0, filled: null,
    }));

    // pieces: the two things brought, plus whatever spare parts the shape needs
    const pr = lay.pr * S;
    const list: Body[] = [c.a, c.b];
    if (this.ordered) {
      for (let i = 2; i < n; i++) list.push(c.spawnPart(i % 2 ? 'b' : 'a', c.cx, c.cy, { r: pr }));
    } else {
      for (const s of lay.sockets) if (!s.use) list.push(c.spawnPart(s.part, c.cx, c.cy, { r: pr }));
    }
    this.pieces = list;
    c.a.solid = false; c.b.solid = false;
    // shuffled tray along the bottom, in one or two rows
    const order = list.map((_, i) => i).sort(() => c.rnd() - 0.5);
    const rows = list.length > 4 ? 2 : 1;
    const per = Math.ceil(list.length / rows);
    order.forEach((idx, k) => {
      const b = list[idx];
      const row = Math.floor(k / per), col = k % per;
      const cnt = row === rows - 1 ? list.length - per * row : per;
      b.x = c.w * (0.14 + (0.72 * (col + 0.5)) / Math.max(1, cnt));
      b.y = Math.min(c.h - b.r - 6, c.cy + S * (2.25 + row * 0.85));
      b.vx = b.vy = 0; b.tx = b.x; b.ty = b.y; b.z = 0;
      b.angle = b.targetAngle = (c.rnd() - 0.5) * 1.2;
      b.grabbable = true; b.locked = false;
    });
  }

  private compat(b: Body, s: Socket, c: StepCtx): boolean {
    if (s.filled) return false;
    if (s.part === '*') return true;
    const real = b === c.a || b === c.b;
    return s.use ? real : b.part === s.part;
  }

  /** Sockets a piece may go into right now. */
  private open(b: Body, c: StepCtx): Socket[] {
    const out = this.sockets.filter(s => this.compat(b, s, c));
    if (!this.ordered) return out;
    const first = this.sockets.find(s => !s.filled);
    return first && out.includes(first) ? [first] : [];
  }

  private nearest(b: Body, c: StepCtx, within: number): Socket | null {
    let best: Socket | null = null, bd = within;
    for (const s of this.open(b, c)) {
      const d = dist(b.x, b.y, s.px, s.py);
      if (d < bd) { best = s; bd = d; }
    }
    return best;
  }

  private fill(s: Socket, b: Body, c: StepCtx) {
    s.filled = b;
    b.locked = true; b.grabbable = false;
    b.vx = b.vy = 0; b.q = Math.max(b.q, 0.14);
    c.fx.sound(this.ordered ? 'thud' : 'click', { vol: 0.7 });
    c.fx.ring(s.px, s.py, b.r * 1.15, { color: 'ochre', life: 0.4 });
    c.fx.burst(s.px, s.py, { n: 4, color: 'bone2', speed: 40, life: 0.3 });
  }

  up(c: StepCtx) {
    const b = c.ptr.grab;
    if (!b || !this.pieces.includes(b)) return;
    const s = this.nearest(b, c, this.R * 1.05);
    if (s) { this.fill(s, b, c); return; }
    if (this.ordered) {
      // dropped on the stack but not squarely: it slides off, and the next try is easier
      const next = this.sockets.find(q => !q.filled);
      if (next && Math.abs(b.x - next.px) < this.S * 1.6 && Math.abs(b.y - next.py) < this.S * 1.8) {
        b.vx = (b.x < next.px ? -1 : 1) * 190; b.vz = 200;
        c.fx.sound('tick', { vol: 0.5 });
        c.fail(0.25);
      }
    }
  }

  key(k: 'primary' | 'interact' | 'rotate', c: StepCtx, shift?: boolean) {
    const held = c.ptr.grab;
    if (k === 'rotate') { if (held && this.pieces.includes(held)) c.world.rotate(held, shift ? -Math.PI / 12 : Math.PI / 12); return; }
    // keyboard route: send the nearest loose piece to the next open socket
    for (const s of this.sockets) {
      if (s.filled || (this.ordered && s !== this.sockets.find(q => !q.filled))) continue;
      let best: Body | null = null, bd = Infinity;
      for (const b of this.pieces) {
        if (b.locked || !this.compat(b, s, c)) continue;
        const d = dist(b.x, b.y, s.px, s.py);
        if (d < bd) { best = b; bd = d; }
      }
      if (best) { best.x = s.px; best.y = s.py; this.fill(s, best, c); return; }
    }
  }

  wheel(dy: number, c: StepCtx) {
    const held = c.ptr.grab;
    if (held && this.pieces.includes(held)) c.world.rotate(held, Math.sign(dy) * Math.min(0.35, Math.abs(dy) * 0.0024));
  }

  down(c: StepCtx) { if (c.ptr.grab && this.pieces.includes(c.ptr.grab)) this.touched = true; }

  update(dt: number, c: StepCtx) {
    // the piece in hand is drawn toward the nearest socket it fits
    const held = c.ptr.grab;
    if (held && held.held && this.pieces.includes(held)) {
      const s = this.nearest(held, c, this.R * 1.9);
      if (s) {
        const d = dist(held.x, held.y, s.px, s.py);
        const k = 1 - d / (this.R * 1.9);
        const f = 1 - Math.exp(-dt * 6 * k);
        held.tx += (s.px - held.tx) * f; held.ty += (s.py - held.ty) * f;
        if (!s.use && s.part !== '*') held.targetAngle += angDiff(s.ang, held.targetAngle) * (1 - Math.exp(-dt * 2 * k));
      }
    }
    let filled = 0;
    for (const s of this.sockets) {
      if (!s.filled) continue;
      filled++;
      const b = s.filled;
      c.world.glide(b, s.px, s.py, 20);
      b.angle += angDiff(s.ang, b.angle) * Math.min(1, dt * 14);
      b.targetAngle = b.angle;
      b.z += (0 - b.z) * Math.min(1, dt * 14);
    }
    this.progress = filled / this.sockets.length;
    if (filled === this.sockets.length && !this.done) {
      this.settle += dt;
      if (this.settle > 0.3) {
        c.fx.sound('snap', { vol: 0.8 });
        c.fx.ring(c.cx, c.cy, this.S * 2, { color: 'ochre', life: 0.6 });
        c.fx.burst(c.cx, c.cy, { n: 10, color: 'bone2', speed: 80, life: 0.5 });
        this.finish();
      }
    }
  }

  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    const held = c.ptr.grab && c.ptr.grab.held && this.pieces.includes(c.ptr.grab) ? c.ptr.grab : null;
    const active = this.ordered ? this.sockets.find(s => !s.filled) : null;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of this.sockets) {
      if (s.filled) continue;
      if (this.ordered && s !== active) {
        g.globalAlpha = 0.2; g.strokeStyle = c.pal.line3; g.lineWidth = 1;
        g.setLineDash([2, 5]); g.beginPath(); g.arc(s.px, s.py, this.S * 0.5, 0, TAU); g.stroke(); g.setLineDash([]);
        continue;
      }
      const fits = held ? this.compat(held, s, c) && (!this.ordered || s === active) : true;
      const near = held && fits ? dist(held.x, held.y, s.px, s.py) < this.R * 1.05 : false;
      const col = near ? c.pal.good : c.pal.ochre;
      g.strokeStyle = col; g.lineWidth = 1.4;
      g.globalAlpha = held && !fits ? 0.18 : near ? 0.95 : 0.6;
      g.setLineDash([]);
      partIcon(g, s.part, s.px, s.py, this.S * 0.32);
      g.globalAlpha *= 0.9;
      dashedCircle(g, s.px, s.py, this.S * 0.62, col, c.t, near ? 0.95 : held && !fits ? 0.15 : 0.55);
      if (near) arcRing(g, s.px, s.py, this.S * 0.78, 1, c.pal.good, 1.6);
    }
    g.restore();
    if (!this.touched && !held) {
      const first = active ?? this.sockets.find(s => !s.filled);
      if (first) beacon(g, first.px, first.py, this.S * 0.7, c.t, c.pal.ochre, 0.6);
    }
    g.globalAlpha = 1;
  }

  cleanup() {
    for (const b of this.pieces) { b.locked = false; b.grabbable = true; }
  }
}

/* ── place ─────────────────────────────────────────────────────────────── */

class Place extends Step {
  readonly kind = 'place' as const;
  private zone: ZoneId;
  private piece: Body; private other: Body;
  private inside = 0;
  private placed = false;
  private settle = 0;
  private auto = false;
  private touched = false;

  constructor(p: Record<string, unknown>, c: StepCtx) {
    super();
    this.grabs = true;
    this.zone = str<ZoneId>(p.zone, 'hearth');
    c.world.zones.add(this.zone);
    const { piece, other } = workpiece(c, p.target);
    this.piece = piece; this.other = other;
    other.grabbable = false;
    piece.grabbable = true;
    c.setZoneLit(this.zone);
  }

  private centre(c: StepCtx) {
    const r = c.zoneRect(this.zone);
    return { x: r.x + r.w / 2, y: r.y + r.h * 0.58 };
  }

  key(k: 'primary' | 'interact' | 'rotate') { if (k !== 'rotate') this.auto = true; }
  down(c: StepCtx) { if (c.ptr.grab === this.piece) this.touched = true; }

  update(dt: number, c: StepCtx) {
    const { piece, other } = this;
    const ctr = this.centre(c);
    const inZone = c.zoneAt(piece.x, piece.y) === this.zone;

    if (!this.placed) {
      c.setZoneLit(this.zone);
      if (this.auto && !piece.held) {
        piece.locked = true;
        c.world.glide(piece, ctr.x, ctr.y, 9);
        if (dist(piece.x, piece.y, ctr.x, ctr.y) < 4) this.placed = true;
      } else if (inZone) {
        this.inside += dt;
        if ((!piece.held && this.inside > 0.2) || this.inside > 0.9) this.placed = true;
      } else this.inside = Math.max(0, this.inside - dt * 2);
      const d = dist(piece.x, piece.y, ctr.x, ctr.y);
      this.progress = this.placed ? 1 : clamp(1 - d / (c.w * 0.6)) * 0.85;
      if (this.placed) {
        piece.locked = true; other.locked = true; piece.grabbable = false; this.settle = 0;
        c.fx.sound(this.zone === 'basin' ? 'splash' : this.zone === 'anvil' ? 'clack' : 'whoosh', { vol: 0.6 });
        c.fx.ring(ctr.x, ctr.y, piece.r * 1.6, { color: this.zone === 'hearth' ? 'hot' : 'ochre', life: 0.5 });
        piece.q = 0.2;
      }
      return;
    }

    // set down: the piece in the middle of the station, its partner alongside
    this.settle += dt;
    c.world.glide(piece, ctr.x + piece.r * 0.2, ctr.y, 16);
    c.world.glide(other, ctr.x - (piece.r + other.r) * 0.58, ctr.y - other.r * 0.1, 12);
    piece.z += (0 - piece.z) * Math.min(1, dt * 14);
    other.z += (0 - other.z) * Math.min(1, dt * 14);
    this.progress = 1;
    if (this.settle > 0.4) { piece.locked = false; other.locked = false; this.finish(); }
  }

  draw(g: CanvasRenderingContext2D, c: StepCtx) {
    if (this.placed) return;
    const ctr = this.centre(c);
    const pc = this.piece;
    beacon(g, ctr.x, ctr.y, pc.r * 1.1, c.t, c.pal.ochre, 0.65);
    if (!pc.held && !this.touched) chevrons(g, pc.x, pc.y, ctr.x, ctr.y, c.t, c.pal.ochre, 0.6);
    if (this.inside > 0) arcRing(g, ctr.x, ctr.y, pc.r * 1.4, this.inside / 0.2, c.pal.good, 2.2);
    g.globalAlpha = 1;
  }

  cleanup(c: StepCtx) {
    this.piece.locked = false; this.other.locked = false;
    this.piece.grabbable = true; this.other.grabbable = true;
    void c;
  }
}

/* ── registry ──────────────────────────────────────────────────────────── */

export const buildSteps: StepDef[] = [
  { kind: 'align', verb: 'Drag, turn, set', estimate: p => (p.angle === undefined ? 2.4 : 3.6), create: (p, c) => new Align(p, c) },
  { kind: 'assemble', verb: 'Fit the pieces', estimate: p => 1.2 + layoutCount(p) * 1.5, create: (p, c) => new Assemble('assemble', p, c) },
  { kind: 'stack', verb: 'Stack', estimate: p => 1 + num(p.n, 3) * 1.3, create: (p, c) => new Assemble('stack', p, c) },
  { kind: 'place', verb: 'Carry to the station', estimate: () => 1.6, create: (p, c) => new Place(p, c) },
];
