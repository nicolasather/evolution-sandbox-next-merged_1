/**
 * Pointer play: an "ideal hands" bot drives every recipe with the mouse (and R
 * for turning), on a simulated clock. It proves the pointer paths of every
 * step really complete, and measures how long a perfect player needs, which
 * the pacing budget (specs.ts BUDGET) must comfortably contain.
 */
import rawDb from '@/data/db.json';
import type { Db } from '@/lib/types';
import { Fx } from '../fx';
import { CraftSession } from '../session';
import { BUDGET, deriveSpec } from '../specs';
import type { Palette } from '../types';
import { World } from '../world';

const db = rawDb as unknown as Db;
const byId = new Map(db.nodes.map(n => [n.id, n]));
const eraIndex = (id: string) => Math.max(0, db.eras.findIndex(e => e.id === byId.get(id)!.era));
const PAL: Palette = { bone: '#eee', bone2: '#aaa', bone3: '#888', line: '#444', line3: '#666', ochre: '#c8763a', ink: '#111', good: '#8f8', hot: '#f95', water: '#7be' };

/* eslint-disable @typescript-eslint/no-explicit-any -- the bot reads step internals on purpose */
type RT = any;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const angDiff = (a: number, b: number) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };

class Bot {
  down = false;
  T = 0;
  phaseT = 0;
  kind = '';
  st: Record<string, number> = {};
  constructor(private s: CraftSession) {}
  private get p() { return this.s.ctx.ptr; }
  press(x: number, y: number) { if (!this.down) { this.s.pointerDown(x, y, 'mouse'); this.down = true; } else this.s.pointerMove(x, y); }
  release() { if (this.down) { this.s.pointerUp(); this.down = false; } }
  goto(x: number, y: number, speed: number, dt: number) {
    const d = dist(this.p.x, this.p.y, x, y);
    const step = Math.min(d, speed * dt);
    const nx = d < 1e-6 ? x : this.p.x + ((x - this.p.x) / d) * step, ny = d < 1e-6 ? y : this.p.y + ((y - this.p.y) / d) * step;
    if (this.down) this.s.pointerMove(nx, ny); else { this.s.pointerDown(nx, ny, 'mouse'); this.down = true; }
    return d - step;
  }
  tick(dt: number) {
    const s = this.s, rt = s.runtime as RT, c = s.ctx;
    const kind: string = rt ? rt.kind : '';
    if (kind !== this.kind) { this.release(); this.kind = kind; this.phaseT = 0; this.st = {}; }
    this.phaseT += dt;
    this.T += dt;
    if (!rt) return;
    const ph = this.phaseT;
    switch (kind) {
      case 'impact': {
        const cyc = ph % 2.6;
        if (cyc < 0.02 && !this.down) this.press(c.b.x, c.b.y);
        if (cyc > 0.95 && this.down) this.release();
        break;
      }
      case 'hold': this.press(c.cx, c.cy); break;
      case 'strike': {
        const t = rt.target;
        const cyc = ph % 0.5;
        if (cyc < 0.02 && !this.down) { this.press(t.x, t.y); } else if (cyc > 0.1) this.release();
        break;
      }
      case 'grind': {
        const o = Math.sin(ph * 2 * Math.PI * 3) * c.a.r * 0.8;
        // a twist is worked up and down, a rub side to side
        if (rt.variant === 'twist') this.press(c.cx, c.cy + o); else this.press(c.cx + o, c.cy);
        break;
      }
      case 'shake': this.press(c.cx + Math.sin(ph * 2 * Math.PI * 3) * 60, c.cy); break;
      case 'stretch': case 'separate': {
        if (!this.down) this.press(c.a.x, c.a.y);
        this.goto(c.b.x + 520, c.b.y, 700, dt);
        break;
      }
      case 'wrap': this.press(c.cx + Math.cos(ph * 7) * c.a.r * 1.5, c.cy + Math.sin(ph * 7) * c.a.r * 1.5); break;
      case 'pour': {
        const full = rt.fill >= rt.lo;
        if (full) this.press(c.cx, c.cy); else this.press(c.cx + c.w * 0.25 * Math.min(1, ph * 4), c.cy);
        break;
      }
      case 'heat': {
        const mid = (rt.lo + rt.hi) / 2;
        if (rt.phase === 'ready') { this.release(); s.keyDown('e'); s.keyUp('e'); } else if (rt.T < mid) this.press(c.cx, c.cy); else this.release();
        break;
      }
      case 'trace': case 'route': {
        const pts: [number, number][] = rt.pts;
        this.st.i = this.st.i ?? 0;
        if (!this.down) { this.press(pts[0][0], pts[0][1]); break; }
        // walk the polyline at a steady, human-ish speed
        let budget = 300 * dt;
        while (budget > 0 && this.st.i < pts.length - 1) {
          const n = pts[this.st.i + 1], d = dist(this.p.x, this.p.y, n[0], n[1]);
          if (d <= budget) { this.s.pointerMove(n[0], n[1]); budget -= d; this.st.i++; } else { this.goto(n[0], n[1], budget / dt, dt); budget = 0; }
        }
        break;
      }
      case 'connect': {
        const t = rt.terms.find((q: any) => q.side === 'l' && !q.done);
        if (!t) break;
        const u = rt.terms.find((q: any) => q.side === 'r' && q.pair === t.pair);
        if (!this.down) { this.press(t.x, t.y); this.st.w = 0; break; }
        if (this.goto(u.x, u.y, 900, dt) < 1) { this.st.w = (this.st.w ?? 0) + dt; if (this.st.w > 0.04) this.release(); }
        break;
      }
      case 'cut': {
        const t = rt.target, u = { x: Math.cos(rt.ang), y: Math.sin(rt.ang) };
        const cyc = ph % 0.5;
        if (cyc < 0.02) { this.release(); this.press(t.x - u.x * t.r * 1.6, t.y - u.y * t.r * 1.6); }
        else if (this.down && cyc < 0.2) this.goto(t.x + u.x * t.r * 1.6, t.y + u.y * t.r * 1.6, 900, dt);
        else if (cyc >= 0.2) this.release();
        break;
      }
      case 'keep': {
        if (rt.mode === 'zone') this.press(rt.zx, rt.zy);
        else this.press(c.cx + c.w * 0.22 * Math.max(-1, Math.min(1, -(rt.m - 0.5) * 5 - rt.vx * 0.8)), c.cy);
        break;
      }
      case 'timing': {
        const d = Math.abs(angDiff(rt.ang, rt.spot));
        if (d < rt.half * 0.55 && rt.cool <= 0 && !this.down) { this.press(c.cx, c.cy); } else if (this.down) this.release();
        break;
      }
      case 'align': {
        const pc = rt.piece;
        if (!this.down) { this.press(pc.x, pc.y - pc.z); break; }
        if (s.ctx.ptr.grab !== pc) break;
        this.goto(rt.tx + pc.gx * 0, rt.ty, 1100, dt);
        if (rt.goalRel !== null) {
          const e = angDiff(pc.targetAngle - rt.anchor.angle, rt.goalRel);
          let f = e; if (f > Math.PI / 2) f -= Math.PI; else if (f < -Math.PI / 2) f += Math.PI;
          this.st.k = (this.st.k ?? 0) + dt;
          if (Math.abs(f) > 0.2 && this.st.k > 0.04) { s.keyDown('r', f > 0); s.keyUp('r'); this.st.k = 0; }
        }
        break;
      }
      case 'assemble': case 'stack': {
        const sock = rt.sockets.find((q: any) => !q.filled && (!rt.ordered || q === rt.sockets.find((z: any) => !z.filled)));
        if (!sock) { this.release(); break; }
        if (!this.down) {
          const piece = rt.pieces.filter((b: any) => !b.locked && rt.compat(b, sock, c)).sort((a: any, b: any) => dist(a.x, a.y, sock.px, sock.py) - dist(b.x, b.y, sock.px, sock.py))[0];
          if (!piece) break;
          this.press(piece.x, piece.y - piece.z);
          break;
        }
        if (this.goto(sock.px, sock.py, 1100, dt) < 1) { this.st.w = (this.st.w ?? 0) + dt; if (this.st.w > 0.05) { this.release(); this.st.w = 0; } }
        break;
      }
      case 'place': {
        const r = c.zoneRect(rt.zone);
        const tx = r.x + r.w / 2, ty = r.y + r.h * 0.58;
        if (!this.down) { this.press(rt.piece.x, rt.piece.y); break; }
        this.goto(tx, ty, 900, dt);
        break;
      }
      default: break;
    }
  }
}

function play(a: string, b: string, r: string) {
  const host = document.createElement('div');
  const ids = new Map(db.nodes.map(n => [n.id, { id: n.id, n: n.n, vis: n.vis, cat: n.cat, era: n.era }]));
  const world = new World(host, { resolve: id => ids.get(id) ?? null, onImpact() {}, onWall() {}, onLand() {}, onZone() {} });
  world.resize(560, 320);
  const ba = world.spawn(a, 200, 160)!, bb = world.spawn(b, 360, 170)!;
  const spec = deriveSpec(byId.get(a)!, byId.get(b)!, byId.get(r)!, { eraIndex: eraIndex(r) });
  const fx = new Fx(PAL); fx.reduced = true;
  const kinds: string[] = [];
  const s = new CraftSession({ world, fx, a: ba, b: bb, spec, pal: PAL, reduced: true, seed: 5, onStep: (_i, _n, _v, k) => kinds.push(k) });
  const bot = new Bot(s);
  let T = 0;
  s.clock = () => T * 1000;
  const dt = 1 / 60;
  let last = '';
  while (!s.done && T < 120) {
    T += dt;
    bot.tick(dt);
    world.step(dt);
    s.update(dt);
    if (s.runtime) last = (s.runtime as RT).kind;
  }
  return { done: s.done, t: T, spec, kinds, stuckAt: s.done ? null : last };
}

const pairs: { a: string; b: string; r: string }[] = [];
for (const n of db.nodes) for (const [a, b] of n.rec) pairs.push({ a, b, r: n.id });

describe('recipe processes, played with the pointer by an ideal-hands bot', () => {
  it('every recipe completes, and an ideal player fits comfortably inside the budget', () => {
    const fails: string[] = [];
    const times: Record<string, number[]> = { quick: [], medium: [], major: [] };
    const slow: string[] = [];
    for (const p of pairs) {
      const res = play(p.a, p.b, p.r);
      if (!res.done) { fails.push(`${p.a}+${p.b}=${p.r} stuck at ${res.stuckAt} [${res.kinds.join('>')}]`); continue; }
      times[res.spec.tier].push(res.t);
      if (res.t > BUDGET[res.spec.tier] * 1.5) slow.push(`${p.r}:${res.t.toFixed(1)}s [${res.kinds.join('>')}]`);
    }
    // a perfect player never waits more than the tier allows, plus a little for the gaps between steps
    expect(slow).toEqual([]);
    const worst = (k: string) => Math.max(...times[k]);
    expect(worst('quick')).toBeLessThan(4);
    expect(worst('medium')).toBeLessThan(10);
    expect(worst('major')).toBeLessThan(16);
    expect(fails).toEqual([]);
  }, 600000);
});
