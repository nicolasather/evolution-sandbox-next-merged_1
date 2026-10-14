import { D, E, line, poly, rectPath, rng, type Elem, type Pt } from '../geom';
import { bool, defineComponent, int, num, req, type ComponentDef } from '../params';
import { circle } from './shared';

/* Modern electronics: boards, cells, chips. */

export const pcb = defineComponent<{ w: number; h: number; seed: number; chips: number; traces: number; pads: number; corner: number }>({
  id: 'pcb', group: 'electronic',
  doc: 'circuit board: outline, seeded orthogonal traces with via pads, rectangular chips with pins. seed varies the layout',
  params: {
    w: req(10, 140), h: req(10, 140), seed: int(0, 9999, 7), chips: int(0, 5, 2), traces: int(0, 24, 10),
    pads: int(0, 30, 12), corner: num(0, 12, 2),
  },
  draw: p => {
    const rnd = rng(p.seed), hw = p.w / 2, hh = p.h / 2, out: Elem[] = [E(rectPath(-hw, -hh, hw, hh, p.corner))];
    const inX = (v: number) => Math.max(-hw + 3, Math.min(hw - 3, v));
    const inY = (v: number) => Math.max(-hh + 3, Math.min(hh - 3, v));
    const chipBoxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (let c = 0; c < p.chips; c++) {
      const cw = Math.min(p.w * 0.3, 8 + rnd() * 10), ch = Math.min(p.h * 0.3, 8 + rnd() * 10);
      const cx = inX((rnd() - 0.5) * p.w * 0.6), cy = inY((rnd() - 0.5) * p.h * 0.6);
      const b = { x0: cx - cw / 2, y0: cy - ch / 2, x1: cx + cw / 2, y1: cy + ch / 2 };
      chipBoxes.push(b);
      out.push(E(rectPath(b.x0, b.y0, b.x1, b.y1), 'main'));
      const n = Math.max(2, Math.floor(cw / 2.4));
      for (let i = 0; i < n; i++) {
        const x = b.x0 + ((i + 0.5) * cw) / n;
        out.push(E(line(x, b.y0, x, b.y0 - 1.6), 'fine'), E(line(x, b.y1, x, b.y1 + 1.6), 'fine'));
      }
      out.push(E(circle(b.x0 + 1.5, b.y0 + 1.5, 0.7), 'hair'));
    }
    for (let t = 0; t < p.traces; t++) {
      const horizontalFirst = rnd() < 0.5;
      const a: Pt = [inX((rnd() - 0.5) * p.w), inY((rnd() - 0.5) * p.h)];
      const b: Pt = [inX((rnd() - 0.5) * p.w), inY((rnd() - 0.5) * p.h)];
      const mid: Pt = horizontalFirst ? [b[0], a[1]] : [a[0], b[1]];
      const bend: Pt = horizontalFirst ? [mid[0] + (b[0] > a[0] ? -2 : 2), mid[1]] : [mid[0], mid[1] + (b[1] > a[1] ? -2 : 2)];
      out.push(E(poly([a, bend, mid, b]), 'fine', 0.8));
      out.push(E(circle(a[0], a[1], 0.9), 'fine'), E(circle(b[0], b[1], 0.9), 'fine'));
    }
    for (let i = 0; i < p.pads; i++) out.push(D(inX((rnd() - 0.5) * p.w), inY((rnd() - 0.5) * p.h), 0.7, 0.8));
    return out;
  },
});

export const cells = defineComponent<{ w: number; h: number; cols: number; rows: number; skew: number; persp: number; bus: number; frame: boolean }>({
  id: 'cells', group: 'electronic',
  doc: 'grid of cells in a frame: solar panel, battery bank, LED matrix, tile array. persp narrows the top edge for a tilted view; skew shears it',
  params: {
    w: req(10, 140), h: req(10, 140), cols: int(1, 14, 6), rows: int(1, 12, 4), skew: num(-0.8, 0.8, 0),
    persp: num(0.3, 1, 1), bus: int(0, 4, 2), frame: bool(true),
  },
  draw: p => {
    const hh = p.h / 2, out: Elem[] = [];
    const P = (u: number, v: number): Pt => {
      const s = 1 - (1 - p.persp) * (1 - v);
      return [(u - 0.5) * p.w * s + p.skew * (0.5 - v) * p.w * 0.4, -hh + v * p.h];
    };
    const q = (u0: number, v0: number, u1: number, v1: number) => poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], true);
    const gap = 0.012;
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      const u0 = c / p.cols + gap, u1 = (c + 1) / p.cols - gap, v0 = r / p.rows + gap, v1 = (r + 1) / p.rows - gap;
      out.push(E(q(u0, v0, u1, v1), 'fine', 0.9));
      for (let b = 1; b <= p.bus; b++) {
        const u = u0 + ((u1 - u0) * b) / (p.bus + 1);
        out.push(E([['M', ...P(u, v0 + 0.01)], ['L', ...P(u, v1 - 0.01)]], 'hair', 0.7));
      }
    }
    if (p.frame) out.push(E(poly([P(-0.01, -0.01), P(1.01, -0.01), P(1.01, 1.01), P(-0.01, 1.01)], true), 'main'));
    return out;
  },
});

export const ELECTRONIC: ComponentDef[] = [pcb, cells];
