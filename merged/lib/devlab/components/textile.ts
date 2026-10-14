import {
  E, ellipse, hatchSegments, lerp, line, mapElems, poly, rectPath, rng, sample, smooth, type Elem, type Path, type Pt,
} from '../geom';
import { bool, defineComponent, int, num, oneOf, req, type ComponentDef } from '../params';

/* Fibre, weave and plant growth. */

export const weave = defineComponent<{
  w: number; h: number; pitch: number; clip: string; topw: number; botw: number; amp: number; border: boolean;
}>({
  id: 'weave', group: 'textile',
  doc: 'over-under woven lattice inside a rectangle, ellipse or tapered (trapezoid) outline: mats, cloth, baskets, wicker, matting',
  params: {
    w: req(4, 140), h: req(4, 140), pitch: num(2, 12, 5), clip: oneOf(['rect', 'ellipse', 'trapezoid'], 'rect'),
    topw: num(0.2, 1.4, 1, { doc: 'trapezoid: width of the top edge relative to w' }),
    botw: num(0.2, 1.4, 0.6, { doc: 'trapezoid: width of the bottom edge relative to w' }),
    amp: num(0, 1, 0.5, { doc: 'how strongly the weft undulates over/under the warp' }), border: bool(true),
  },
  draw: p => {
    const hw = p.w / 2, hh = p.h / 2;
    const halfW = (y: number): number => {
      if (p.clip === 'rect') return hw;
      if (p.clip === 'ellipse') return hw * Math.sqrt(Math.max(0, 1 - (y / hh) ** 2));
      return hw * lerp(p.topw, p.botw, (y + hh) / p.h);
    };
    const inside = (x: number, y: number) => Math.abs(y) <= hh + 0.01 && Math.abs(x) <= halfW(y) + 0.01;
    const out: Elem[] = [];
    // weft: sinusoidal rows, alternate rows in antiphase
    for (let k = 0, y = -hh + p.pitch / 2; y < hh; k++, y += p.pitch) {
      const hx = halfW(y);
      if (hx < 1) continue;
      const nS = Math.max(2, Math.ceil((2 * hx) / (p.pitch / 2)));
      const pts: Pt[] = Array.from({ length: nS + 1 }, (_, i): Pt => {
        const x = -hx + (i * 2 * hx) / nS;
        return [x, y + p.amp * p.pitch * 0.32 * Math.sin((Math.PI * x) / p.pitch + k * Math.PI)];
      });
      out.push(E(smooth(pts), 'fine', 0.85));
    }
    // warp: straight uprights, split wherever the outline cuts them
    for (let x = -hw + p.pitch / 2; x < hw; x += p.pitch) {
      let run: Pt[] = [];
      const flush = () => { if (run.length > 1) out.push(E(poly([run[0], run[run.length - 1]]), 'fine', 0.7)); run = []; };
      for (let y = -hh; y <= hh + 0.01; y += 1.5) { if (inside(x, y)) run.push([x, y]); else flush(); }
      flush();
    }
    if (p.border) {
      if (p.clip === 'rect') out.push(E(rectPath(-hw, -hh, hw, hh)));
      else if (p.clip === 'ellipse') out.push(E(ellipse(0, 0, hw, hh)));
      else out.push(E(poly([[-hw * p.topw, -hh], [hw * p.topw, -hh], [hw * p.botw, hh], [-hw * p.botw, hh]], true)));
    }
    return out;
  },
});

export const net = defineComponent<{ w: number; h: number; mesh: number; shape: string }>({
  id: 'net', group: 'textile',
  doc: 'diamond-mesh netting inside a rectangle or ellipse: fishing net, snare, hair-net, fence mesh',
  params: { w: req(6, 140), h: req(6, 140), mesh: num(3, 16, 8), shape: oneOf(['rect', 'ellipse'], 'rect') },
  draw: p => {
    const s = p.shape as 'rect' | 'ellipse';
    const ext = (p.w + p.h) * 0.3536;
    const n = Math.max(2, Math.min(40, Math.round((2 * ext) / (0.7071 * p.mesh))));
    const out: Elem[] = [
      E(hatchSegments(p.w, p.h, 45, n, s), 'fine', 0.85),
      E(hatchSegments(p.w, p.h, -45, n, s), 'fine', 0.85),
      E(s === 'rect' ? rectPath(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2) : ellipse(0, 0, p.w / 2, p.h / 2)),
    ];
    return out;
  },
});

export const strands = defineComponent<{ len: number; r: number; n: number; pitch: number; fray: boolean }>({
  id: 'strands', group: 'textile',
  doc: 'twisted or plied cord lying along x: rope, yarn, cordage, sinew, braided line. n = plies (steeper twist), pitch = ridge spacing',
  params: { len: req(8, 140), r: num(1, 14, 4), n: int(2, 6, 3), pitch: num(2, 14, 6), fray: bool(false) },
  draw: p => {
    const L = p.len, r = p.r, dx = p.pitch * (0.4 + 0.25 * p.n);
    const out: Elem[] = [];
    const edge = (s: number): Path => {
      const pts: Pt[] = [];
      for (let x = -L / 2; x <= L / 2 + 0.1; x += p.pitch / 2) pts.push([x, s * r * (1 + 0.07 * Math.sin((x / p.pitch) * Math.PI))]);
      return smooth(pts);
    };
    out.push(E(edge(-1)), E(edge(1)));
    for (let x = -L / 2; x + dx <= L / 2 + 0.01; x += p.pitch) {
      out.push(E([['M', x, -r], ['C', x + dx * 0.3, -r * 0.55, x + dx * 0.7, r * 0.55, x + dx, r]], 'fine', 0.9));
    }
    out.push(E(line(-L / 2, -r, -L / 2, r), 'fine', 0.6));
    if (p.fray) {
      for (const k of [-1, -0.4, 0.4, 1]) out.push(E(smooth([[L / 2, k * r * 0.6], [L / 2 + r * 1.2, k * r * 0.9], [L / 2 + r * 2.4, k * r * 1.5 + 1]]), 'hair', 0.8));
    }
    return out;
  },
});

export const branch = defineComponent<{ depth: number; len: number; spread: number; seed: number; taper: number; leaves: boolean }>({
  id: 'branch', group: 'organic',
  doc: 'branching stem / twig / reed head / root system growing upward; leaves=true adds leaf tips. Auto-centred',
  params: {
    depth: int(1, 6, 4), len: num(4, 40, 18), spread: num(0.2, 1.2, 0.55), seed: int(0, 9999, 1),
    taper: num(0.5, 0.9, 0.7), leaves: bool(false),
  },
  draw: p => {
    const rnd = rng(p.seed);
    const out: Elem[] = [];
    const grow = (x: number, y: number, ang: number, len: number, depth: number): void => {
      if (depth <= 0 || len < 2) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const bend: Pt = [(x + x2) / 2 + (rnd() - 0.5) * len * 0.12, (y + y2) / 2 + (rnd() - 0.5) * len * 0.12];
      out.push(E(smooth([[x, y], bend, [x2, y2]]), depth >= p.depth - 1 ? 'main' : 'fine'));
      if (depth === 1 && p.leaves) out.push(E(ellipse(x2 + Math.cos(ang) * 2, y2 + Math.sin(ang) * 2, 3, 1.4, 0, 360, (ang * 180) / Math.PI), 'fine', 0.85));
      grow(x2, y2, ang - p.spread * (0.6 + rnd() * 0.8), len * p.taper, depth - 1);
      grow(x2, y2, ang + p.spread * (0.6 + rnd() * 0.8), len * p.taper, depth - 1);
    };
    grow(0, 0, -Math.PI / 2, p.len, p.depth);
    // centre on its own bounding box so x,y places the middle of the plant
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of out) for (const pl of sample(e.path ?? [], 4)) for (const [x, y] of pl) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (!Number.isFinite(x0)) return out;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return mapElems(out, (x, y) => [x - cx, y - cy]);
  },
});

export const TEXTILE: ComponentDef[] = [weave, net, strands, branch];
