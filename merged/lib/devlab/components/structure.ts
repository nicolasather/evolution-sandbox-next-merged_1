import {
  D, DEG, E, ellipse, lerp, line, mapElems, poly, rectPath, rng, smooth, type Elem, type Pt,
} from '../geom';
import { bool, defineComponent, int, num, oneOf, req, type ComponentDef } from '../params';
import { circle, timber } from './shared';

/* Buildings, bridges and frames. All of these re-centre on their own bounding box. */

type Curve = (u: number) => Pt;

/** Left→right intrados curve of an arch: semicircle/ellipse or equilateral-style pointed (gothic) arch. */
function archCurve(rx: number, ry: number, pointed: boolean): Curve {
  if (!pointed) return u => { const a = (180 + 180 * u) * DEG; return [Math.cos(a) * rx, Math.sin(a) * ry]; };
  const k = ry / (Math.sqrt(3) * rx);
  const half = (v: number): Pt => { const a = (180 + 60 * v) * DEG; return [rx + 2 * rx * Math.cos(a), 2 * rx * Math.sin(a) * k]; };
  return u => (u <= 0.5 ? half(u * 2) : (() => { const q = half((1 - u) * 2); return [-q[0], q[1]] as Pt; })());
}

export const arch = defineComponent<{
  span: number; rise?: number; thick: number; voussoirs: number; pier: number; pw: number; count: number;
  keystone: boolean; pointed: boolean; deck: boolean;
}>({
  id: 'arch', group: 'structure', center: true,
  doc: 'masonry arch in a wall with voussoir stones. count>1 = arcade / aqueduct; deck adds a channel/parapet line; pointed = gothic arch',
  params: {
    span: req(6, 100), rise: num(3, 80, undefined, { doc: 'height of the arch opening (default = half the span)' }), thick: num(1, 20, 5),
    voussoirs: int(5, 25, 11), pier: num(0, 60, 14, { doc: 'height of piers/walls below the springing line' }),
    pw: num(1, 30, 6, { doc: 'pier width between arches' }), count: int(1, 6, 1), keystone: bool(true), pointed: bool(false), deck: bool(false),
  },
  draw: p => {
    const s = p.span / 2, ry = p.rise ?? p.span / 2, spacing = p.span + p.pw;
    const thick = p.count > 1 ? Math.min(p.thick, Math.max(1, p.pw / 2)) : p.thick;
    const out: Elem[] = [];
    const yTop = -(ry + thick * 1.25);
    for (let k = 0; k < p.count; k++) {
      const cx = (k - (p.count - 1) / 2) * spacing;
      const inC = archCurve(s, ry, p.pointed), exC = archCurve(s + thick, ry + thick, p.pointed);
      const shift = (q: Pt): Pt => [q[0] + cx, q[1]];
      const trace = (c: Curve, lo: number, hi: number, w: 'main' | 'fine') => {
        const pts = Array.from({ length: 19 }, (_, i) => shift(c(lerp(lo, hi, i / 18))));
        out.push(E(smooth(pts), w));
      };
      if (p.pointed) { trace(inC, 0, 0.5, 'main'); trace(inC, 0.5, 1, 'main'); trace(exC, 0, 0.5, 'fine'); trace(exC, 0.5, 1, 'fine'); }
      else { trace(inC, 0, 1, 'main'); trace(exC, 0, 1, 'fine'); }
      for (let j = 0; j <= p.voussoirs; j++) {
        const u = j / p.voussoirs, a = shift(inC(u)), b = shift(exC(u));
        out.push(E(line(a[0], a[1], b[0], b[1]), 'fine', 0.85));
      }
      if (p.keystone) {
        const big = (u: number): Pt => { const a = inC(u), b = exC(u); return shift([a[0] + (b[0] - a[0]) * 1.35, a[1] + (b[1] - a[1]) * 1.35]); };
        out.push(E(poly([shift(inC(0.46)), big(0.46), big(0.54), shift(inC(0.54))], true), 'main'));
      }
      if (p.pier > 0) {
        out.push(E(line(cx - s, 0, cx - s, p.pier)), E(line(cx + s, 0, cx + s, p.pier)));
      }
    }
    const left = -((p.count - 1) / 2) * spacing - s - p.pw, right = ((p.count - 1) / 2) * spacing + s + p.pw;
    out.push(E(poly([[left, p.pier], [left, yTop], [right, yTop], [right, p.pier]]), 'main'));
    out.push(E(line(left, p.pier, right, p.pier)));
    if (p.deck) {
      out.push(E(line(left, yTop - 4, right, yTop - 4), 'fine'), E(line(left, yTop, left, yTop - 4), 'fine'), E(line(right, yTop, right, yTop - 4), 'fine'));
    }
    return out;
  },
});

export const dome = defineComponent<{
  r: number; height?: number; ribs: number; courses: number; drum: number; lantern: boolean; windows: number;
}>({
  id: 'dome', group: 'structure', center: true,
  doc: 'masonry dome with meridian ribs and stone courses; optional drum with windows and a lantern on top',
  params: {
    r: req(8, 60), height: num(4, 60, undefined, { doc: 'rise of the dome (default = r, a hemisphere)' }), ribs: int(0, 16, 8),
    courses: int(0, 8, 4), drum: num(0, 40, 0), lantern: bool(false), windows: int(0, 12, 0),
  },
  draw: p => {
    const h = p.height ?? p.r, r = p.r, out: Elem[] = [];
    out.push(E(ellipse(0, 0, r, h, 180, 360)), E(ellipse(0, 0, r, r * 0.2, 0, 180)));
    for (let k = 1; k < p.ribs; k++) {
      const c = Math.cos((Math.PI * k) / p.ribs), rx = Math.abs(c) * r;
      if (rx < 0.8) out.push(E(line(0, 0, 0, -h), 'fine', 0.8));
      else out.push(E(c > 0 ? ellipse(0, 0, rx, h, 270, 360) : ellipse(0, 0, rx, h, 180, 270), 'fine', 0.8));
    }
    for (let j = 1; j <= p.courses; j++) {
      const phi = (j / (p.courses + 1)) * (Math.PI / 2), rx = r * Math.cos(phi);
      out.push(E(ellipse(0, -h * Math.sin(phi), rx, rx * 0.2, 0, 180), 'fine', 0.8));
    }
    if (p.drum > 0) {
      out.push(E(line(-r, 0, -r, p.drum)), E(line(r, 0, r, p.drum)), E(ellipse(0, p.drum, r, r * 0.2, 0, 180)));
      for (let i = 0; i < p.windows; i++) {
        const x = p.windows === 1 ? 0 : lerp(-r * 0.72, r * 0.72, i / (p.windows - 1));
        const w = Math.min(3, (r * 0.7) / Math.max(2, p.windows)), y0 = p.drum * 0.28, y1 = p.drum * 0.82;
        out.push(E(poly([[x - w, y1], [x - w, y0 + w]]), 'fine'), E(poly([[x + w, y1], [x + w, y0 + w]]), 'fine'),
          E(ellipse(x, y0 + w, w, w, 180, 360), 'fine'), E(line(x - w, y1, x + w, y1), 'fine'));
      }
    }
    if (p.lantern) {
      const lw = r * 0.1, ly = -h - r * 0.22;
      out.push(E(line(-lw, -h + 1, -lw, ly)), E(line(lw, -h + 1, lw, ly)), E(ellipse(0, ly, lw, lw * 0.7, 180, 360)), E(line(0, ly - lw * 0.7, 0, ly - lw * 0.7 - r * 0.12)));
    }
    return out;
  },
});

export const courses = defineComponent<{
  w: number; h: number; rows: number; brick: number; bond: string; taper: number; seed: number; round: number;
}>({
  id: 'courses', group: 'structure', center: true,
  doc: 'masonry / brickwork / paving: running-bond bricks, stacked blocks, or irregular cobbles. taper>0 narrows the top (chimney, tower)',
  params: {
    w: req(6, 140), h: req(6, 140), rows: int(2, 24, 8), brick: num(3, 40, 14), bond: oneOf(['running', 'stack', 'cobble'], 'running'),
    taper: num(0, 0.6, 0), seed: int(0, 9999, 1), round: num(0, 4, 1.2),
  },
  draw: p => {
    const rnd = rng(p.seed), rowH = p.h / p.rows, out: Elem[] = [];
    const halfW = (y: number) => (p.w / 2) * (1 - p.taper * ((p.h / 2 - y) / p.h));
    const y0 = -p.h / 2;
    if (p.bond === 'cobble') {
      for (let r = 0; r < p.rows; r++) {
        const yt = y0 + r * rowH, yb = yt + rowH, hw = halfW((yt + yb) / 2);
        let x = -hw;
        while (x < hw - 1) {
          const wd = Math.min(hw - x, p.brick * (0.75 + rnd() * 0.5));
          const g = 0.7, a = x + g, b = x + wd - g, t = yt + g + rnd() * 0.6, bt = yb - g - rnd() * 0.6;
          if (b - a > 1.5) {
            const rr = Math.min(p.round + 1, (b - a) / 3);
            out.push(E(smooth([[a + rr, t], [b - rr, t - rnd() * 0.5], [b, (t + bt) / 2], [b - rr, bt + rnd() * 0.5], [a + rr, bt], [a, (t + bt) / 2]], true), 'fine'));
          }
          x += wd;
        }
      }
      return out;
    }
    out.push(E(poly(Array.from({ length: p.rows + 1 }, (_, i): Pt => [-halfW(y0 + i * rowH), y0 + i * rowH])), 'main'));
    out.push(E(poly(Array.from({ length: p.rows + 1 }, (_, i): Pt => [halfW(y0 + i * rowH), y0 + i * rowH])), 'main'));
    out.push(E(line(-halfW(y0), y0, halfW(y0), y0), 'main'), E(line(-halfW(-y0), -y0, halfW(-y0), -y0), 'main'));
    for (let r = 1; r < p.rows; r++) {
      const y = y0 + r * rowH;
      out.push(E(line(-halfW(y), y, halfW(y), y), 'fine', 0.85));
    }
    for (let r = 0; r < p.rows; r++) {
      const yt = y0 + r * rowH, off = p.bond === 'running' && r % 2 ? p.brick / 2 : 0, hw = halfW(yt + rowH / 2);
      for (let x = -hw + off + p.brick; x < hw - 0.8; x += p.brick) out.push(E(line(x, yt, x, yt + rowH), 'fine', 0.7));
    }
    return out;
  },
});

export const truss = defineComponent<{ span: number; rise: number; kind: string; t: number; chord: boolean; bolts: boolean }>({
  id: 'truss', group: 'structure', center: true,
  doc: 'triangular timber roof truss: kind king | queen | howe | scissor. t = timber thickness; chord = bottom tie beam',
  params: {
    span: req(10, 140), rise: req(4, 70), kind: oneOf(['king', 'queen', 'howe', 'scissor'], 'king'),
    t: num(1, 8, 3), chord: bool(true), bolts: bool(true),
  },
  draw: p => {
    const S = p.span / 2, R = p.rise, t = p.t, out: Elem[] = [];
    const ry = (x: number) => -R * (1 - Math.abs(x) / S);
    out.push(...timber(-S, 0, 0, -R, t), ...timber(S, 0, 0, -R, t));
    if (p.chord) out.push(...timber(-S, 0, S, 0, t));
    const nodes: Pt[] = [[-S, 0], [S, 0], [0, -R]];
    if (p.kind === 'king') {
      out.push(...timber(0, -R, 0, 0, t * 0.8, 'main', false));
      for (const sg of [-1, 1]) { const x = sg * S * 0.45; out.push(...timber(0, 0, x, ry(x), t * 0.7, 'main', false)); nodes.push([x, ry(x)]); }
    } else if (p.kind === 'queen') {
      const x = S * 0.38, y = ry(x);
      for (const sg of [-1, 1]) { out.push(...timber(sg * x, 0, sg * x, y, t * 0.8, 'main', false)); nodes.push([sg * x, y]); }
      out.push(...timber(-x, y, x, y, t * 0.8, 'main', false));
      for (const sg of [-1, 1]) out.push(...timber(sg * x, y, 0, -R, t * 0.6, 'main', false));
    } else if (p.kind === 'howe') {
      const xs = [-2 / 3, -1 / 3, 0, 1 / 3, 2 / 3].map(f => f * S);
      for (const x of xs) { out.push(...timber(x, 0, x, ry(x), t * 0.7, 'main', false)); nodes.push([x, ry(x)]); }
      for (let i = 0; i < 2; i++) {
        out.push(...timber(xs[i], ry(xs[i]), xs[i + 1], 0, t * 0.6, 'main', false));
        out.push(...timber(-xs[i], ry(xs[i]), -xs[i + 1], 0, t * 0.6, 'main', false));
      }
    } else {
      out.push(...timber(-S, 0, S * 0.5, ry(S * 0.5), t * 0.8, 'main', false), ...timber(S, 0, -S * 0.5, ry(S * 0.5), t * 0.8, 'main', false));
    }
    if (p.bolts) nodes.forEach(([x, y]) => out.push(D(x, y, 1)));
    return out;
  },
});

export const portal = defineComponent<{
  w: number; h: number; bays: number; depth: number; t: number; brace: boolean; sill: boolean; plate: boolean;
}>({
  id: 'portal', group: 'structure', center: true,
  doc: 'post-and-beam timber frame seen in slight perspective: posts, top plate, sill, knee braces, a second frame behind it, pegged joints',
  params: {
    w: req(10, 140), h: req(10, 120), bays: int(1, 4, 2), depth: num(0, 40, 14), t: num(1, 8, 3),
    brace: bool(true), sill: bool(true), plate: bool(true),
  },
  draw: p => {
    const frame = (): Elem[] => {
      const out: Elem[] = [], bw = p.w / p.bays, b = Math.min(p.h, bw) * 0.28;
      for (let k = 0; k <= p.bays; k++) out.push(...timber(-p.w / 2 + k * bw, -p.h / 2, -p.w / 2 + k * bw, p.h / 2, p.t));
      if (p.plate) out.push(...timber(-p.w / 2, -p.h / 2, p.w / 2, -p.h / 2, p.t));
      if (p.sill) out.push(...timber(-p.w / 2, p.h / 2, p.w / 2, p.h / 2, p.t * 0.8));
      if (p.brace) {
        for (let k = 0; k <= p.bays; k++) {
          const x = -p.w / 2 + k * bw;
          if (k > 0) out.push(E(line(x, -p.h / 2 + b, x - b, -p.h / 2), 'fine'));
          if (k < p.bays) out.push(E(line(x, -p.h / 2 + b, x + b, -p.h / 2), 'fine'));
        }
      }
      return out;
    };
    const dx = p.depth, dy = -p.depth * 0.55;
    const out: Elem[] = [];
    if (p.depth > 0) {
      out.push(...mapElems(frame(), (x, y) => [x + dx, y + dy]).map(e => ({ ...e, w: 'fine' as const, o: 0.6, dz: -5 })));
      for (let k = 0; k <= p.bays; k++) {
        const x = -p.w / 2 + (k * p.w) / p.bays;
        out.push(E(line(x, -p.h / 2, x + dx, -p.h / 2 + dy), 'fine', 0.7), E(line(x, p.h / 2, x + dx, p.h / 2 + dy), 'hair', 0.6));
      }
    }
    out.push(...frame().map(e => ({ ...e, dz: 3 })));
    for (let k = 0; k <= p.bays; k++) out.push(D(-p.w / 2 + (k * p.w) / p.bays, -p.h / 2, 0.9));
    return out;
  },
});

export const sails = defineComponent<{ n: number; len: number; w: number; lattice: number; hub: number; start: number; sweep: number }>({
  id: 'sails', group: 'structure',
  doc: 'windmill sail assembly radiating from a hub at the local origin: n lattice sails on stocks. start = angle of the first arm',
  params: {
    n: int(2, 8, 4), len: req(10, 60), w: num(3, 24, 10), lattice: int(0, 12, 6), hub: num(1, 10, 4),
    start: num(0, 360, 20), sweep: num(0, 40, 8),
  },
  draw: p => {
    const out: Elem[] = [E(circle(0, 0, p.hub)), E(circle(0, 0, Math.max(0.6, p.hub * 0.35)), 'fine')];
    for (let i = 0; i < p.n; i++) {
      const a = (p.start + (i * 360) / p.n) * DEG, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
      const P = (d: number, s: number): Pt => [ux * d + vx * s, uy * d + vy * s];
      const d0 = p.hub * 1.4, s0 = p.w * 0.08, s1 = p.w, shift = p.sweep * 0.12;
      out.push(E(line(...P(p.hub, 0), ...P(p.len * 1.02, 0)), 'main'));
      out.push(E(poly([P(d0, s0), P(p.len, s0 + shift), P(p.len, s1 + shift), P(d0, s1)], true), 'main'));
      for (let j = 1; j < p.lattice; j++) {
        const d = lerp(d0, p.len, j / p.lattice), sh = shift * (d / p.len);
        out.push(E(line(...P(d, s0 + sh), ...P(d, s1 + sh)), 'fine', 0.85));
      }
      if (p.lattice > 0) out.push(E(line(...P(d0, (s0 + s1) / 2), ...P(p.len, (s0 + s1) / 2 + shift)), 'hair', 0.7));
    }
    return out;
  },
});

export const catenary = defineComponent<{
  span: number; sag: number; hangers: number; towers: boolean; towerH: number; deck: boolean; strands: number; deckGap: number;
}>({
  id: 'catenary', group: 'structure', center: true,
  doc: 'suspension cable between two towers with vertical hangers and a deck: bridges, cableways. strands>1 = laid-up wire cable',
  params: {
    span: req(20, 140), sag: req(3, 60), hangers: int(0, 30, 10), towers: bool(true), towerH: num(0, 40, 10),
    deck: bool(true), strands: int(1, 4, 1), deckGap: num(4, 40, 14),
  },
  draw: p => {
    const S = p.span / 2, cableY = (x: number) => p.sag * (1 - (x / S) ** 2), deckY = p.sag + p.deckGap, out: Elem[] = [];
    for (let s = 0; s < p.strands; s++) {
      const pts = Array.from({ length: 25 }, (_, i): Pt => { const x = -S + (2 * S * i) / 24; return [x, cableY(x) + s * 1.8]; });
      out.push(E(smooth(pts), s === 0 ? 'main' : 'fine'));
    }
    for (let i = 1; i <= p.hangers; i++) {
      const x = -S + (2 * S * i) / (p.hangers + 1);
      out.push(E(line(x, cableY(x) + (p.strands - 1) * 1.8, x, deckY), 'fine', 0.85));
    }
    if (p.deck) out.push(E(line(-S, deckY, S, deckY)), E(line(-S, deckY + 2.2, S, deckY + 2.2)));
    if (p.towers) for (const sg of [-1, 1]) out.push(...timber(sg * S, -p.towerH, sg * S, deckY + 8, 4));
    return out;
  },
});

export const bellows = defineComponent<{ w: number; h: number; folds: number; taper: number; front: boolean }>({
  id: 'bellows', group: 'structure', center: true,
  doc: 'accordion bellows in side view narrowing to the right: camera bellows, forge bellows, concertina',
  params: { w: req(10, 120), h: req(6, 80), folds: int(3, 16, 8), taper: num(0.2, 1, 0.55), front: bool(true) },
  draw: p => {
    const hh = (x: number) => (p.h / 2) * lerp(1, p.taper, (x + p.w / 2) / p.w);
    const xs = Array.from({ length: p.folds + 1 }, (_, i) => -p.w / 2 + (i * p.w) / p.folds);
    const top = xs.map((x, i): Pt => [x, -hh(x) * (i % 2 ? 0.78 : 1)]);
    const bot = xs.map((x, i): Pt => [x, hh(x) * (i % 2 ? 0.78 : 1)]);
    const out: Elem[] = [E(poly(top)), E(poly(bot))];
    xs.forEach((x, i) => out.push(E(line(x, -hh(x) * (i % 2 ? 0.78 : 1), x, hh(x) * (i % 2 ? 0.78 : 1)), i % 2 ? 'hair' : 'fine', 0.8)));
    if (p.front) {
      const rh = p.h * 0.58, fh = p.h * p.taper * 0.72;
      out.push(E(rectPath(-p.w / 2 - 3.5, -rh, -p.w / 2, rh), 'main'), E(rectPath(p.w / 2, -fh, p.w / 2 + 3.5, fh), 'main'));
    }
    return out;
  },
});

export const STRUCTURE: ComponentDef[] = [arch, dome, courses, truss, portal, sails, catenary, bellows];
