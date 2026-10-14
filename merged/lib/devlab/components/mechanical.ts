import { DEG, E, ellipse, line, poly, smooth, type Elem, type Pt } from '../geom';
import { bool, defineComponent, int, num, oneOf, req, type ComponentDef } from '../params';
import { circle, polar, timber } from './shared';

/* Rotating machinery. */

export const gear = defineComponent<{
  teeth: number; r: number; depth: number; hole: number; style: string; spokes: number; rim: number; hub: number;
}>({
  id: 'gear', group: 'mechanical',
  doc: 'toothed wheel. style: spur (meshing teeth) | ratchet (sawtooth) | escape (clock escapement) | crown (square teeth). spokes>0 opens the web',
  params: {
    teeth: int(4, 48, 12), r: req(4, 48, 'pitch radius'), depth: num(0.5, 12, 4), hole: num(0, 0.8, 0.25),
    style: oneOf(['spur', 'ratchet', 'escape', 'crown'], 'spur'), spokes: int(0, 12, 0), rim: num(0, 16, 0), hub: num(0, 0.6, 0.3),
  },
  draw: p => {
    const rt = p.r + p.depth / 2, rr = Math.max(1, p.r - p.depth / 2), step = 360 / p.teeth;
    const outline: Pt[] = [];
    for (let i = 0; i < p.teeth; i++) {
      const P = (rad: number, f: number): Pt => polar(0, 0, rad, (i + f) * step);
      if (p.style === 'spur') outline.push(P(rr, 0), P(rr, 0.1), P(rt, 0.24), P(rt, 0.52), P(rr, 0.66), P(rr, 0.84));
      else if (p.style === 'ratchet') outline.push(P(rr, 0), P(rt, 0.03));
      else if (p.style === 'escape') outline.push(P(rr, 0), P(rt, 0.06), P(rt * 0.99, 0.14), P(rr + (rt - rr) * 0.3, 0.6));
      else outline.push(P(rr, 0), P(rt, 0), P(rt, 0.45), P(rr, 0.45));
    }
    const out: Elem[] = [E(poly(outline, true))];
    if (p.spokes > 0) {
      const rimIn = Math.max(rr * 0.5, rr - Math.max(p.rim, 2.5)), hubR = Math.max(1.5, p.hub * p.r);
      out.push(E(circle(0, 0, rimIn), 'fine'), E(circle(0, 0, hubR)));
      for (let k = 0; k < p.spokes; k++) {
        const a = (k * 360) / p.spokes, A = polar(0, 0, hubR, a), B = polar(0, 0, rimIn, a);
        out.push(...timber(A[0], A[1], B[0], B[1], 2.4, 'fine', false));
      }
      if (p.hole > 0.02) out.push(E(circle(0, 0, hubR * Math.max(0.2, p.hole)), 'fine'));
    } else {
      out.push(E(circle(0, 0, rr * 0.62), 'fine', 0.7));
      if (p.hole > 0.02) out.push(E(circle(0, 0, rr * p.hole)));
    }
    return out;
  },
});

export const spokedWheel = defineComponent<{
  r: number; spokes: number; rim: number; hub: number; paddles: number; paddleLen: number; tapered: boolean; groove: boolean;
}>({
  id: 'spoked_wheel', group: 'mechanical',
  doc: 'wheel with rim, spokes and hub. paddles>0 makes a waterwheel; thick rim + tapered spokes = flywheel; groove = pulley sheave; cart wheel otherwise',
  params: {
    r: req(6, 48), spokes: int(0, 24, 8), rim: num(0.5, 14, 3), hub: num(1, 16, 5), paddles: int(0, 24, 0),
    paddleLen: num(1, 14, 6), tapered: bool(false), groove: bool(false),
  },
  draw: p => {
    const rIn = Math.max(1, p.r - p.rim), heavy = p.rim >= 6;
    const out: Elem[] = [E(circle(0, 0, p.r)), E(circle(0, 0, rIn), heavy ? 'main' : 'fine')];
    out.push(E(circle(0, 0, p.hub)), E(circle(0, 0, Math.max(0.6, p.hub * 0.35)), 'fine'));
    if (p.groove) out.push(E(circle(0, 0, p.r - p.rim * 0.5), 'fine', 0.7));
    for (let k = 0; k < p.spokes; k++) {
      const a = ((k * 360) / p.spokes) * DEG, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
      if (p.tapered) {
        const h0 = 1.4, h1 = 0.7;
        out.push(E(poly([[ux * p.hub + vx * h0, uy * p.hub + vy * h0], [ux * rIn + vx * h1, uy * rIn + vy * h1]]), 'main'));
        out.push(E(poly([[ux * p.hub - vx * h0, uy * p.hub - vy * h0], [ux * rIn - vx * h1, uy * rIn - vy * h1]]), 'main'));
      } else out.push(E(line(ux * p.hub, uy * p.hub, ux * rIn, uy * rIn)));
    }
    if (p.paddles > 0) {
      const hw = Math.min(3, ((2 * Math.PI * p.r) / p.paddles) * 0.3);
      for (let k = 0; k < p.paddles; k++) {
        const a = ((k * 360) / p.paddles) * DEG, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
        const A = (rad: number, s: number): Pt => [ux * rad + vx * s, uy * rad + vy * s];
        out.push(E(poly([A(p.r, -hw), A(p.r + p.paddleLen, -hw), A(p.r + p.paddleLen, hw), A(p.r, hw)], true), 'main'));
      }
    }
    return out;
  },
});

export const coil = defineComponent<{ len: number; r: number; turns: number; slant: number; hooks: boolean }>({
  id: 'coil', group: 'mechanical',
  doc: 'helical coil spring / wire winding lying along x (side view). hooks=true adds end loops',
  params: { len: req(6, 140), r: req(1, 30), turns: num(2, 30, 8), slant: num(0, 0.9, 0.4), hooks: bool(false) },
  draw: p => {
    const N = Math.max(12, Math.round(p.turns * 14));
    const pts: Pt[] = Array.from({ length: N + 1 }, (_, i): Pt => {
      const a = (i / N) * p.turns * Math.PI * 2;
      return [-p.len / 2 + (i / N) * p.len + p.r * p.slant * Math.cos(a), p.r * Math.sin(a)];
    });
    const out: Elem[] = [E(smooth(pts))];
    if (p.hooks) out.push(E(ellipse(-p.len / 2 - p.r * 0.6, 0, p.r * 0.55, p.r * 0.55)), E(ellipse(p.len / 2 + p.r * 0.6, 0, p.r * 0.55, p.r * 0.55)));
    return out;
  },
});

export const MECHANICAL: ComponentDef[] = [gear, spokedWheel, coil];
