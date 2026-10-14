import { D, E, line, poly, type Elem, type Pt } from '../geom';
import { bool, defineComponent, int, num, nums, oneOf, req, type ComponentDef } from '../params';
import { circle, polar } from './shared';

/* Scales, dials and optics. */

export const dial = defineComponent<{
  r: number; ticks: number; major: number; tickLen: number; majorLen: number; rings: number;
  hands: number[]; hub: number; start: number; arc: number;
}>({
  id: 'dial', group: 'instrument',
  doc: 'round instrument face: rings, tick marks, optional hands (angles in degrees, 0 = up, clockwise). clocks, compasses, barometers, astrolabe limb, sundial. arc<360 makes a gauge sweep',
  params: {
    r: req(4, 48), ticks: int(0, 120, 60), major: int(0, 24, 12, { doc: 'every Nth tick is long (0 = none)' }),
    tickLen: num(1, 8, 3), majorLen: num(2, 12, 6), rings: int(1, 4, 2), hands: nums(0, 6, -360, 720, [], 'angles of hands; first is longest'),
    hub: num(0, 6, 2), start: num(0, 360, 0, { doc: 'angle of the first tick (0 = up)' }), arc: num(30, 360, 360),
  },
  draw: p => {
    const out: Elem[] = [];
    for (let i = 0; i < p.rings; i++) out.push(E(circle(0, 0, p.r - i * 2.2), i === 0 ? 'main' : 'fine'));
    const full = p.arc >= 359.9;
    const n = full ? p.ticks : Math.max(1, p.ticks - 1);
    for (let i = 0; i < p.ticks; i++) {
      const a = p.start - 90 + (i * p.arc) / (n || 1);
      const isMajor = p.major > 0 && i % p.major === 0;
      const rIn = p.r - 2.2 * p.rings - (isMajor ? p.majorLen : p.tickLen) + 2.2;
      const A = polar(0, 0, p.r - 2.2 * (p.rings - 1) - 0.4, a), B = polar(0, 0, rIn, a);
      out.push(E(line(A[0], A[1], B[0], B[1]), isMajor ? 'main' : 'fine', isMajor ? 1 : 0.8));
    }
    p.hands.forEach((h, i) => {
      const a = h - 90, len = p.r * [0.78, 0.55, 0.85][i % 3];
      const B = polar(0, 0, len, a), T = polar(0, 0, -len * 0.14, a);
      out.push(E(line(T[0], T[1], B[0], B[1]), i === 2 ? 'fine' : 'main'));
    });
    if (p.hub > 0) out.push(E(circle(0, 0, p.hub), 'main'), D(0, 0, 0.7));
    return out;
  },
});

export const rose = defineComponent<{ points: number; r: number; inner: number; ring: boolean; ordinal: number }>({
  id: 'rose', group: 'instrument',
  doc: 'compass rose / star: alternating long and short points around a centre (compass card, wind rose, star pointer, sun)',
  params: { points: int(4, 16, 8), r: req(4, 48), inner: num(0.1, 0.7, 0.25), ring: bool(true), ordinal: num(0.4, 1, 0.68, { doc: 'length of the in-between points relative to the cardinal ones' }) },
  draw: p => {
    const n = p.points, out: Elem[] = [];
    const pts: Pt[] = [];
    for (let i = 0; i < n * 2; i++) {
      const tip = i % 2 === 0, ord = tip && (i / 2) % 2 === 1;
      const rad = tip ? p.r * (ord ? p.ordinal : 1) : p.r * p.inner;
      pts.push(polar(0, 0, rad, -90 + (i * 180) / n));
    }
    out.push(E(poly(pts, true)));
    for (let i = 0; i < n; i++) out.push(E(line(0, 0, pts[i * 2][0], pts[i * 2][1]), 'hair', 0.7));
    if (p.ring) out.push(E(circle(0, 0, p.r * 0.5), 'fine', 0.7));
    return out;
  },
});

export const scale = defineComponent<{ len: number; n: number; h: number; major: number; majorH: number; log: boolean; line: boolean }>({
  id: 'scale', group: 'instrument',
  doc: 'straight ruled scale along x: ruler, slide rule (log=true gives a logarithmic C/D scale), vernier, balance beam markings',
  params: {
    len: req(6, 140), n: int(2, 120, 50), h: num(1, 12, 4), major: int(0, 20, 10), majorH: num(2, 16, 7),
    log: bool(false), line: bool(true),
  },
  draw: p => {
    const out: Elem[] = [];
    if (p.line) out.push(E(poly([[-p.len / 2, 0], [p.len / 2, 0]])));
    for (let i = 0; i <= p.n; i++) {
      const f = i / p.n, x = -p.len / 2 + p.len * (p.log ? Math.log10(1 + 9 * f) : f);
      const major = p.major > 0 && i % p.major === 0;
      out.push(E(line(x, 0, x, -(major ? p.majorH : p.h)), major ? 'main' : 'fine', major ? 1 : 0.8));
    }
    return out;
  },
});

export const lens = defineComponent<{ w: number; h: number; kind: string }>({
  id: 'lens', group: 'instrument',
  doc: 'cross-section of an optical element (axis along x): biconvex | plano | concave | meniscus. w = thickness, h = diameter',
  params: { w: req(2, 40), h: req(6, 100), kind: oneOf(['biconvex', 'plano', 'concave', 'meniscus'], 'biconvex') },
  draw: p => {
    const hw = p.w / 2, hh = p.h / 2, k = 0.62;
    const out: Elem[] = [];
    if (p.kind === 'biconvex') {
      out.push(E([['M', 0, -hh], ['C', hw * 2 * k + hw * 0.4, -hh * 0.55, hw * 2 * k + hw * 0.4, hh * 0.55, 0, hh], ['C', -hw * 2 * k - hw * 0.4, hh * 0.55, -hw * 2 * k - hw * 0.4, -hh * 0.55, 0, -hh], ['Z']]));
    } else if (p.kind === 'plano') {
      out.push(E([['M', -hw, -hh], ['L', -hw, hh], ['C', hw * 2.2, hh * 0.6, hw * 2.2, -hh * 0.6, -hw, -hh], ['Z']]));
    } else if (p.kind === 'concave') {
      out.push(E([['M', -hw, -hh], ['C', hw * 0.1, -hh * 0.4, hw * 0.1, hh * 0.4, -hw, hh], ['L', hw, hh], ['C', -hw * 0.1, hh * 0.4, -hw * 0.1, -hh * 0.4, hw, -hh], ['Z']]));
    } else {
      out.push(E([['M', -hw, -hh * 0.9], ['C', hw * 1.6, -hh * 0.5, hw * 1.6, hh * 0.5, -hw, hh * 0.9], ['C', hw * 0.2, hh * 0.45, hw * 0.2, -hh * 0.45, -hw, -hh * 0.9], ['Z']]));
    }
    return out;
  },
});

export const rayFan = defineComponent<{ x0: number; y0: number; x1: number; y1: number; n: number; s0: number; s1: number }>({
  id: 'ray_fan', group: 'instrument',
  doc: 'bundle of light rays from (x0,y0) to (x1,y1); s0/s1 = vertical spread at each end (parallel→focus: s0 big, s1 0)',
  params: {
    x0: req(-80, 80), y0: req(-80, 80), x1: req(-80, 80), y1: req(-80, 80), n: int(2, 14, 5), s0: num(0, 60, 20), s1: num(0, 60, 0),
  },
  draw: p => Array.from({ length: p.n }, (_, i) => {
    const f = p.n === 1 ? 0 : i / (p.n - 1) - 0.5;
    return E(line(p.x0, p.y0 + f * p.s0, p.x1, p.y1 + f * p.s1), 'fine', 0.85);
  }),
});

export const prism = defineComponent<{ s: number; rays: number; beam: boolean; inner: boolean }>({
  id: 'prism', group: 'instrument', center: true,
  doc: 'triangular glass prism splitting a light beam into a spectrum fan',
  params: { s: req(10, 80), rays: int(0, 9, 6), beam: bool(true), inner: bool(true) },
  draw: p => {
    const h = p.s * 0.866, A: Pt = [0, -h * (2 / 3)], B: Pt = [-p.s / 2, h / 3], C: Pt = [p.s / 2, h / 3];
    const out: Elem[] = [E(poly([A, B, C], true))];
    if (p.inner) { const k = 0.8; out.push(E(poly([A, B, C].map(([x, y]): Pt => [x * k, y * k + h * 0.02]), true), 'fine', 0.6)); }
    const m1: Pt = [(A[0] * 0.55 + B[0] * 0.45), (A[1] * 0.55 + B[1] * 0.45)];
    const m2: Pt = [(A[0] * 0.5 + C[0] * 0.5) + p.s * 0.02, (A[1] * 0.5 + C[1] * 0.5) + h * 0.12];
    if (p.beam) out.push(E(line(-p.s * 1.0, m1[1] + h * 0.22, m1[0], m1[1]), 'main'));
    out.push(E(line(m1[0], m1[1], m2[0], m2[1]), 'fine', 0.9));
    for (let i = 0; i < p.rays; i++) {
      const f = p.rays === 1 ? 0 : i / (p.rays - 1) - 0.5;
      out.push(E(line(m2[0], m2[1], p.s * 1.0, m2[1] + h * 0.1 + f * h * 0.75), 'fine', 0.9));
    }
    return out;
  },
});

export const INSTRUMENT: ComponentDef[] = [dial, rose, scale, lens, rayFan, prism];
