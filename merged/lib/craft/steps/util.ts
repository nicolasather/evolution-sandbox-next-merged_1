import type { Body, StepCtx, StepKind, StepRuntime } from '../types';

export const TAU = Math.PI * 2;
export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
/** Shortest signed difference between two angles. */
export const angDiff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const num = (v: unknown, fb: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
export const str = <T extends string>(v: unknown, fb: T): T => (typeof v === 'string' ? (v as T) : fb);

/** Base for step runtimes: progress, done, and no-op hooks. */
export abstract class Step implements StepRuntime {
  abstract readonly kind: StepKind;
  progress = 0;
  done = false;
  grabs = false;
  abstract update(dt: number, c: StepCtx): void;
  abstract draw(g: CanvasRenderingContext2D, c: StepCtx): void;
  finish() { this.progress = 1; this.done = true; }
}

/** Space held, or a press on the stage. */
export const pressing = (c: StepCtx) => c.ptr.down || c.keys.has(' ');

/** Which of a pair acts on the other. Falls back to the harder, then the first. */
export function pickTool(c: StepCtx, want: unknown, on: unknown): { tool: Body; target: Body } {
  if (on === 'a' || on === 'b') {
    const target = on === 'a' ? c.a : c.b;
    return { tool: target === c.a ? c.b : c.a, target };
  }
  if (want === 'a') return { tool: c.a, target: c.b };
  if (want === 'b') return { tool: c.b, target: c.a };
  const sa = c.a.props.hard * (1 + c.a.mass * 0.1), sb = c.b.props.hard * (1 + c.b.mass * 0.1);
  return sa >= sb ? { tool: c.a, target: c.b } : { tool: c.b, target: c.a };
}

/* ── canvas helpers ───────────────────────────────────────────────────── */

export function arcRing(g: CanvasRenderingContext2D, x: number, y: number, r: number, frac: number,
  color: string, width = 2, track?: string, from = -Math.PI / 2) {
  if (track) {
    g.strokeStyle = track; g.lineWidth = width; g.globalAlpha = 0.5;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }
  if (frac <= 0) { g.globalAlpha = 1; return; }
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.globalAlpha = 1;
  g.beginPath(); g.arc(x, y, r, from, from + TAU * clamp(frac)); g.stroke();
}

export function dashedCircle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, t: number, alpha = 0.6) {
  g.save();
  g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = 1.3; g.setLineDash([5, 7]); g.lineDashOffset = -t * 14;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.restore();
}

/** A vertical gauge with a highlighted band and a fill. */
export function gauge(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  value: number, band: [number, number] | null, c: StepCtx, fillColor: string) {
  g.save();
  g.lineWidth = 1.4; g.strokeStyle = c.pal.line3; g.globalAlpha = 0.9;
  g.strokeRect(x, y, w, h);
  if (band) {
    g.globalAlpha = 0.28; g.fillStyle = c.pal.ochre;
    g.fillRect(x, y + h * (1 - band[1]), w, h * (band[1] - band[0]));
    g.globalAlpha = 0.9; g.strokeStyle = c.pal.ochre; g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - 5, y + h * (1 - band[1])); g.lineTo(x + w + 5, y + h * (1 - band[1]));
    g.moveTo(x - 5, y + h * (1 - band[0])); g.lineTo(x + w + 5, y + h * (1 - band[0]));
    g.stroke();
  }
  g.globalAlpha = 1; g.fillStyle = fillColor;
  const fh = h * clamp(value);
  g.fillRect(x + 2, y + h - fh, w - 4, fh);
  g.restore();
}

/** Small chevrons walking along a line: "this way". */
export function chevrons(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number, color: string, alpha = 0.7) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 4) return;
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const n = Math.max(2, Math.floor(len / 26));
  g.save();
  g.strokeStyle = color; g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const k = ((i + (t * 1.4) % 1) / n);
    const px = x0 + ux * len * k, py = y0 + uy * len * k;
    g.globalAlpha = alpha * Math.sin(Math.PI * k);
    g.beginPath();
    g.moveTo(px - ux * 4 - uy * 4, py - uy * 4 + ux * 4);
    g.lineTo(px + ux * 3, py + uy * 3);
    g.lineTo(px - ux * 4 + uy * 4, py - uy * 4 - ux * 4);
    g.stroke();
  }
  g.restore();
}

/** A pulsing target ring: where to look. */
export function beacon(g: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string, alpha = 0.7) {
  const k = (t * 0.9) % 1;
  g.save();
  g.strokeStyle = color; g.lineWidth = 1.4;
  g.globalAlpha = alpha * (1 - k);
  g.beginPath(); g.arc(x, y, r * (0.85 + k * 0.45), 0, TAU); g.stroke();
  g.globalAlpha = alpha * 0.55;
  g.beginPath(); g.arc(x, y, r * 0.85, 0, TAU); g.stroke();
  g.restore();
}

/** Deterministic pseudo-random from an integer, for shapes that must not flicker between frames. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Cheap smooth noise, −1..1. */
export function noise1(t: number): number {
  const i = Math.floor(t), f = t - i;
  const a = hash(i) * 2 - 1, b = hash(i + 1) * 2 - 1;
  return lerp(a, b, smooth(f));
}
