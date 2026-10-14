import {
  D, DEG, E, ellipse, hatchSegments, line, poly, rectPath, rng, smooth, type ClipShape, type Elem, type Pt,
} from '../geom';
import { bool, defineComponent, int, num, oneOf, pts, req, type ComponentDef } from '../params';
import { circle, polar } from './shared';

/* Generic building blocks. Everything else in the library is built from the same idea:
   numeric parameters in, line work out. */

export const polyline = defineComponent<{ pts: Pt[]; closed: boolean; smooth: boolean; tension: number }>({
  id: 'polyline', group: 'basic',
  doc: 'free outline through your own points (local coords, origin = centre, ±80). closed makes a loop; smooth rounds it',
  params: { pts: pts(2, 24, 80), closed: bool(false), smooth: bool(false), tension: num(0.2, 1.5, 1) },
  draw: p => [E(p.smooth ? smooth(p.pts, p.closed, p.tension) : poly(p.pts, p.closed))],
});

export const ellipseC = defineComponent<{ rx: number; ry?: number; a0: number; a1: number }>({
  id: 'ellipse', group: 'basic',
  doc: 'circle / ellipse / arc. a0..a1 in degrees (0=right, 90=down); omit for a full loop',
  params: { rx: req(1, 80), ry: num(1, 80), a0: num(-360, 720, 0), a1: num(-360, 720, 360) },
  draw: p => {
    const flat = Math.abs(p.a1 - p.a0) < 0.5; // a zero-length arc is read as "no arc given" = full loop
    return [E(ellipse(0, 0, p.rx, p.ry ?? p.rx, flat ? 0 : p.a0, flat ? 360 : p.a1))];
  },
});

export const rect = defineComponent<{ w: number; h: number; r: number }>({
  id: 'rect', group: 'basic',
  doc: 'rectangle, optionally with rounded corners',
  params: { w: req(1, 140), h: req(1, 140), r: num(0, 30, 0) },
  draw: p => [E(rectPath(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2, p.r))],
});

export const ringSet = defineComponent<{ r: number; n: number; gap: number; squash: number }>({
  id: 'ring_set', group: 'basic',
  doc: 'n concentric rings (platters, targets, lens barrels, bearings); squash<1 tilts them into ellipses',
  params: { r: req(1, 80), n: int(1, 8, 2), gap: num(0.8, 20, 5), squash: num(0.15, 1, 1) },
  draw: p => Array.from({ length: p.n }, (_, i) => {
    const rx = p.r - i * p.gap;
    return rx > 0.5 ? E(ellipse(0, 0, rx, rx * p.squash), i === 0 ? 'main' : 'fine') : null;
  }).filter((e): e is Elem => !!e),
});

export const stick = defineComponent<{ x1: number; y1: number; x2: number; y2: number; t: number; caps: string }>({
  id: 'stick', group: 'basic',
  doc: 'a bar, rod, handle, leg or beam between two points. t = thickness (0 = single line)',
  params: {
    x1: req(-80, 80), y1: req(-80, 80), x2: req(-80, 80), y2: req(-80, 80),
    t: num(0, 24, 4), caps: oneOf(['flat', 'round', 'point', 'none'], 'flat'),
  },
  draw: p => {
    if (p.t < 0.3) return [E(line(p.x1, p.y1, p.x2, p.y2))];
    const dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy * (p.t / 2), ny = ux * (p.t / 2);
    const out: Elem[] = [
      E(line(p.x1 + nx, p.y1 + ny, p.x2 + nx, p.y2 + ny)),
      E(line(p.x1 - nx, p.y1 - ny, p.x2 - nx, p.y2 - ny)),
    ];
    const cap = (x: number, y: number, sign: number) => {
      if (p.caps === 'flat') out.push(E(line(x + nx, y + ny, x - nx, y - ny)));
      else if (p.caps === 'round') {
        const ang = Math.atan2(uy, ux) / DEG;
        out.push(E(ellipse(x, y, p.t / 2, p.t / 2, ang - 90 * sign, ang + 90 * sign)));
      } else if (p.caps === 'point') {
        const tx = x + ux * p.t * sign, ty = y + uy * p.t * sign;
        out.push(E(poly([[x + nx, y + ny], [tx, ty], [x - nx, y - ny]])));
      }
    };
    cap(p.x2, p.y2, 1);
    cap(p.x1, p.y1, -1);
    return out;
  },
});

export const hatch = defineComponent<{ w: number; h: number; angle: number; n: number; shape: string; cross: boolean }>({
  id: 'hatch', group: 'basic',
  doc: 'parallel shading / grain / fluting lines filling a box or ellipse (cross=true adds the perpendicular set)',
  params: {
    w: req(2, 140), h: req(2, 140), angle: num(-90, 90, 0), n: int(1, 40, 6),
    shape: oneOf(['rect', 'ellipse'], 'rect'), cross: bool(false),
  },
  draw: p => {
    const s = p.shape as ClipShape;
    const out = [E(hatchSegments(p.w, p.h, p.angle, p.n, s), 'fine', 0.7)];
    if (p.cross) out.push(E(hatchSegments(p.w, p.h, p.angle + 90, p.n, s), 'fine', 0.7));
    return out;
  },
});

export const dots = defineComponent<{ n: number; spread: number; r: number; seed: number; shape: string }>({
  id: 'dots', group: 'basic',
  doc: 'scattered accent dots (seeds, grains, rivets, sparks). seed makes the scatter reproducible',
  params: { n: int(1, 60, 8), spread: num(1, 60, 20), r: num(0.5, 3, 1.4), seed: int(0, 9999, 1), shape: oneOf(['disc', 'box'], 'disc') },
  draw: (p, _r) => {
    const rnd = rng(p.seed);
    return Array.from({ length: p.n }, () => {
      const a = rnd() * Math.PI * 2;
      const rr = p.shape === 'box' ? rnd() * p.spread : Math.sqrt(rnd()) * p.spread;
      return D(Math.cos(a) * rr, Math.sin(a) * rr * (p.shape === 'box' ? 0.7 : 1), p.r);
    });
  },
});

export const radial = defineComponent<{ n: number; r0: number; r1: number; w: number; kind: string; start: number }>({
  id: 'radial', group: 'basic',
  doc: 'n identical pieces around the centre: chuck jaws, spokes, rays, teeth, petals. kind = rect|tri|tooth|line',
  params: {
    n: int(2, 24, 3), r0: num(0, 48, 10), r1: req(2, 60), w: num(0.5, 20, 6),
    kind: oneOf(['rect', 'tri', 'tooth', 'line'], 'rect'), start: num(0, 360, 0),
  },
  draw: p => {
    const out: Elem[] = [];
    for (let i = 0; i < p.n; i++) {
      const a = (p.start + (i * 360) / p.n) * DEG;
      const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux, h = p.w / 2;
      const A = (r: number, s: number): Pt => [ux * r + vx * s, uy * r + vy * s];
      if (p.kind === 'line') out.push(E(line(ux * p.r0, uy * p.r0, ux * p.r1, uy * p.r1)));
      else if (p.kind === 'rect') out.push(E(poly([A(p.r0, -h), A(p.r1, -h), A(p.r1, h), A(p.r0, h)], true)));
      else if (p.kind === 'tri') out.push(E(poly([A(p.r0, -h), A(p.r1, 0), A(p.r0, h)], true)));
      else out.push(E(poly([A(p.r0, -h), A(p.r1, -h * 0.55), A(p.r1, h * 0.55), A(p.r0, h)], true)));
    }
    return out;
  },
});

export const rivets = defineComponent<{ x1: number; y1: number; x2: number; y2: number; n: number; r: number }>({
  id: 'rivets', group: 'basic',
  doc: 'a row of rivets / studs / bolts from one point to another',
  params: { x1: req(-80, 80), y1: req(-80, 80), x2: req(-80, 80), y2: req(-80, 80), n: int(2, 24, 6), r: num(0.6, 3, 1.4) },
  draw: p => {
    const out: Elem[] = [];
    for (let i = 0; i < p.n; i++) {
      const t = p.n === 1 ? 0.5 : i / (p.n - 1);
      const x = p.x1 + (p.x2 - p.x1) * t, y = p.y1 + (p.y2 - p.y1) * t;
      out.push(E(circle(x, y, p.r), 'fine'), D(x, y, p.r * 0.35));
    }
    return out;
  },
});

export const spiral = defineComponent<{ turns: number; r0: number; r1: number; log: boolean; ridges: number; squash: number; start: number }>({
  id: 'spiral', group: 'basic',
  doc: 'spiral: coiled rope, whorl, shell, fiddlehead, scroll. log=true grows outward like a seashell; ridges adds growth ribs',
  params: {
    turns: num(0.5, 8, 3), r0: num(0, 20, 2), r1: req(2, 60), log: bool(false), ridges: int(0, 40, 0),
    squash: num(0.4, 1, 1), start: num(0, 360, 0),
  },
  draw: p => {
    const steps = Math.max(8, Math.round(p.turns * 14));
    const rAt = (t: number) => p.r0 + (p.r1 - p.r0) * (p.log ? (Math.exp(2.2 * t) - 1) / (Math.exp(2.2) - 1) : t);
    const P = (t: number): Pt => polar(0, 0, rAt(t), p.start + t * p.turns * 360, rAt(t) * p.squash);
    const pts: Pt[] = Array.from({ length: steps + 1 }, (_, i) => P(i / steps));
    const out: Elem[] = [E(smooth(pts))];
    if (p.ridges > 0) {
      const tail = Math.min(1, 1.15 / p.turns);
      for (let i = 0; i < p.ridges; i++) {
        const t = 1 - tail + (tail * (i + 0.5)) / p.ridges;
        const a = P(t), r = rAt(t) * 0.82;
        const b = polar(0, 0, r, p.start + t * p.turns * 360, r * p.squash);
        out.push(E(line(a[0], a[1], b[0], b[1]), 'fine', 0.7));
      }
    }
    return out;
  },
});

export const BASIC: ComponentDef[] = [polyline, ellipseC, rect, ringSet, stick, hatch, dots, radial, rivets, spiral];
