import { DEG, E, ellipse, line, poly, type Elem, type Path, type Pt, type Weight } from '../geom';

/** A timber / bar between two points drawn as two parallel edges plus (optionally) square end caps. */
export function timber(x1: number, y1: number, x2: number, y2: number, t: number, w: Weight = 'main', caps = true, dz?: number): Elem[] {
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * (t / 2), ny = (dx / L) * (t / 2);
  const out: Elem[] = [
    E(line(x1 + nx, y1 + ny, x2 + nx, y2 + ny), w, undefined, dz),
    E(line(x1 - nx, y1 - ny, x2 - nx, y2 - ny), w, undefined, dz),
  ];
  if (caps) {
    out.push(E(line(x1 + nx, y1 + ny, x1 - nx, y1 - ny), w, undefined, dz));
    out.push(E(line(x2 + nx, y2 + ny, x2 - nx, y2 - ny), w, undefined, dz));
  }
  return out;
}

/** Point on a circle/ellipse in local coordinates (degrees, 0° = +x, y down). */
export const polar = (cx: number, cy: number, r: number, aDeg: number, ry?: number): Pt =>
  [cx + r * Math.cos(aDeg * DEG), cy + (ry ?? r) * Math.sin(aDeg * DEG)];

export const circle = (cx: number, cy: number, r: number): Path => ellipse(cx, cy, r, r);

export const quad = (a: Pt, b: Pt, c: Pt, d: Pt): Path => poly([a, b, c, d], true);
