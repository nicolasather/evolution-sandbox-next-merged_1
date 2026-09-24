import type { ActionId } from '../types';

/* ============================================================================
   GESTURES — what the player's hand has to DO for each action. Pure geometry:
   no DOM, no engine. The bench feeds it pointer positions in world px and
   reads back `prog` (0–1) and a few numbers it can draw with; when `done`
   flips, the bench asks the engine what the work made.

     brush     sweep back and forth across it
     smash     strike it — twice, or three times if it is hard
     cut       draw one straight line through it
     separate  take hold and pull it apart from the middle
     dig       scoop down and out, three times

   Each is forgiving on purpose (a hand is not a ruler) and each un-does itself
   if the player lets go, so nothing is ever half spent.
   ========================================================================== */

export interface Target { x: number; y: number; r: number; hard: number }

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Distance from a point to a segment. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return dist(px, py, ax, ay);
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / l2);
  return dist(px, py, ax + t * dx, ay + t * dy);
}

export class Gesture {
  readonly action: ActionId;
  readonly t: Target;
  prog = 0;
  done = false;
  /** Pointer is holding on to it. */
  pressed = false;

  /** smash: strikes made since the last read; the bench turns each into a blow. */
  strikes = 0;
  private struck = 0;
  private sinceStrike = 0;
  readonly need: number;

  /** cut: the line drawn so far. */
  cut: { x0: number; y0: number; x1: number; y1: number } | null = null;
  /** separate: how far it is being pulled (world px, already limited). */
  pull = { x: 0, y: 0 };
  /** dig: 0 up … 1 down, for the bob. */
  dip = 0;
  /** brush: sweeps counted (direction changes). */
  sweeps = 0;

  private lx = 0; private ly = 0;
  private path = 0;
  private dir = 0;
  private ax = 0; private ay = 0;
  private phase: 'down' | 'up' = 'down';
  private acc = 0;
  private scoops = 0;

  constructor(action: ActionId, target: Target) {
    this.action = action;
    this.t = target;
    this.need = target.hard >= 0.5 ? 3 : 2;
  }

  private near(x: number, y: number, k = 1.3) { return dist(x, y, this.t.x, this.t.y) <= this.t.r * k; }

  /** Pointer went down. Returns whether it took hold of the work. */
  down(x: number, y: number): boolean {
    if (this.done) return false;
    const { action } = this;
    if (action === 'cut') {
      if (!this.near(x, y, 2.4)) return false;
      this.pressed = true; this.cut = { x0: x, y0: y, x1: x, y1: y };
      return true;
    }
    if (!this.near(x, y)) return false;
    this.pressed = true;
    this.lx = x; this.ly = y; this.ax = x; this.ay = y;
    if (action === 'smash') {
      if (this.sinceStrike >= 0.16 || this.struck === 0) {
        this.struck++; this.strikes++; this.sinceStrike = 0;
        this.prog = clamp01(this.struck / this.need);
        if (this.struck >= this.need) this.done = true;
      }
    }
    return true;
  }

  move(x: number, y: number) {
    if (this.done || !this.pressed) return;
    const { action, t } = this;
    if (action === 'brush') {
      if (!this.near(x, y, 1.45)) { this.lx = x; this.ly = y; return; }
      const dx = x - this.lx;
      this.path += dist(x, y, this.lx, this.ly);
      const d = Math.abs(dx) > 1.5 ? Math.sign(dx) : 0;
      if (d !== 0) { if (this.dir !== 0 && d !== this.dir) this.sweeps++; this.dir = d; }
      this.lx = x; this.ly = y;
      const raw = clamp01(this.path / (t.r * 5.5));
      this.prog = this.sweeps >= 2 ? raw : Math.min(raw, 0.9);
      if (this.prog >= 1) this.done = true;
    } else if (action === 'cut' && this.cut) {
      this.cut.x1 = x; this.cut.y1 = y;
      const len = dist(this.cut.x0, this.cut.y0, x, y);
      const through = segDist(t.x, t.y, this.cut.x0, this.cut.y0, x, y) <= t.r * 0.75;
      const raw = clamp01(len / (t.r * 2));
      this.prog = through ? raw : Math.min(raw, 0.3);
      if (this.prog >= 1) this.done = true;
    } else if (action === 'separate') {
      let px = x - this.ax, py = y - this.ay;
      const len = Math.hypot(px, py);
      const lim = t.r * 0.7;
      if (len > lim) { px *= lim / len; py *= lim / len; }
      this.pull.x = px; this.pull.y = py;
      this.prog = clamp01(len / (t.r * 1.5));
      if (this.prog >= 1) this.done = true;
    } else if (action === 'dig') {
      const dy = y - this.ly;
      this.lx = x; this.ly = y;
      if (this.phase === 'down') {
        if (dy > 0) this.acc += dy;
        if (this.acc >= t.r * 0.8) { this.phase = 'up'; this.acc = 0; }
      } else {
        if (dy < 0) this.acc -= dy;
        if (this.acc >= t.r * 0.35) { this.phase = 'down'; this.acc = 0; this.scoops++; }
      }
      const part = this.phase === 'down' ? clamp01(this.acc / (t.r * 0.8)) * 0.5 : 0.5 + clamp01(this.acc / (t.r * 0.35)) * 0.5;
      this.dip = this.phase === 'down' ? clamp01(this.acc / (t.r * 0.8)) : 1 - clamp01(this.acc / (t.r * 0.35));
      this.prog = clamp01((this.scoops + part) / 3);
      if (this.scoops >= 3) { this.prog = 1; this.done = true; }
    }
  }

  up() {
    this.pressed = false;
    if (this.action === 'separate') { this.pull.x = 0; this.pull.y = 0; }
    if (this.action === 'cut' && !this.done) this.cut = null;
    if (this.action === 'dig') this.dip = 0;
  }

  /** Time passes. Half-done work slowly un-does itself once the hand is off it. */
  tick(dt: number) {
    if (this.done) return;
    this.sinceStrike += dt;
    if (this.action === 'smash') {
      if (this.struck > 0 && this.sinceStrike > 1.6) { this.struck = 0; this.prog = 0; }
      return;
    }
    if (this.pressed) return;
    const k = this.action === 'brush' ? 0.22 : 1.6;
    this.prog = Math.max(0, this.prog - dt * k);
    if (this.action === 'brush' && this.prog === 0) { this.path = 0; this.sweeps = 0; this.dir = 0; }
    if (this.action === 'dig' && this.prog === 0) { this.scoops = 0; this.acc = 0; this.phase = 'down'; }
    if (this.action === 'separate' || this.action === 'cut') { if (this.prog === 0) this.cut = null; }
  }

  /** Read and clear the strikes made since the last call. */
  takeStrikes(): number { const n = this.strikes; this.strikes = 0; return n; }

  /** Do it for the player (keyboard, Instant, or after a few tries). */
  finish() { this.prog = 1; this.done = true; this.pressed = false; }
}
