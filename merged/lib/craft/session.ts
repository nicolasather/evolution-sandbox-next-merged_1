import type { Fx } from './fx';
import { stepDef } from './steps';
import type { Body, CraftSpec, Palette, Pointer, StepCtx, StepRuntime, StepSpec, ZoneId } from './types';
import type { World } from './world';

/* ============================================================================
   CRAFT SESSION — runs a recipe's physical process.

   A session owns two bodies on the bench and an ordered list of steps read
   from the recipe's `CraftSpec`. It builds each step's runtime just in time,
   feeds it the pointer and keyboard, draws it on the overlay canvas, and
   reports when the last one is done. It never decides what the recipe makes:
   that stays with Engine.combine, called by the Workbench when the session
   completes.

   The session is also where "never stuck" lives: any step can call `fail()`,
   which raises `assist`, which every later step reads to widen its windows.
   ========================================================================== */

/** A short breath between steps, so a process has a rhythm instead of a blur. */
const GAP = 0.2;

/** Small seeded generator: the same pair always lays its pieces out the same way. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SessionOpts {
  world: World;
  fx: Fx;
  a: Body;
  b: Body;
  spec: CraftSpec;
  pal: Palette;
  reduced: boolean;
  /** Carried over from earlier tries of the same pair: 0 – 1. */
  assist?: number;
  seed?: number;
  /** A short cue for the first time a kind of step is seen. */
  onStep?(index: number, total: number, verb: string, kind: StepSpec['kind']): void;
  onSay?(text: string): void;
}

export class CraftSession {
  readonly world: World;
  readonly a: Body;
  readonly b: Body;
  readonly spec: CraftSpec;
  readonly ctx: StepCtx;
  done = false;
  cancelled = false;
  idx = -1;
  runtime: StepRuntime | null = null;
  private steps: StepSpec[];
  private opts: SessionOpts;
  private gap = 0;
  private temps: Body[] = [];
  private keys = new Set<string>();
  private lastMove = 0;
  /** Milliseconds. Injectable so a test can drive the pointer on a simulated clock. */
  clock: () => number = () => performance.now();

  constructor(opts: SessionOpts) {
    this.opts = opts;
    const { world, a, b, spec, fx, pal } = opts;
    this.world = world; this.a = a; this.b = b; this.spec = spec;
    const rnd = mulberry32(opts.seed ?? 1);
    const steps = spec.steps.filter(s => stepDef(s.kind));
    this.steps = steps.length ? steps : [{ kind: 'touch' }];

    // Work happens at the station when there is one and nothing carries the pieces there.
    const carries = this.steps.some(s => s.kind === 'place');
    // the work happens where the pair met, kept inside the free area (never at a fixed screen centre)
    const area = world.area, play0 = world.play;
    const clampC = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
    let cx = clampC((a.x + b.x) / 2, area.x + play0.w / 2, area.x + area.w - play0.w / 2);
    let cy = clampC((a.y + b.y) / 2, area.y + play0.h / 2, area.y + area.h - play0.h / 2);
    if (spec.station) {
      world.zones.add(spec.station);
      if (!carries) { const r = world.zoneRect(spec.station); cx = r.x + r.w / 2; cy = r.y + r.h * 0.55; }
    }

    const ptr: Pointer = {
      x: cx, y: cy, x0: cx, y0: cy, down: false, vx: 0, vy: 0, speed: 0, held: 0,
      pressed: false, released: false, type: 'mouse', grab: null, seen: false,
    };
    this.ctx = {
      world, t: 0, w: play0.w, h: play0.h, x0: cx - play0.w / 2, y0: cy - play0.h / 2, cx, cy, a, b, temp: this.temps, ptr, keys: this.keys,
      fx, pal, rnd, assist: Math.max(0, Math.min(1, opts.assist ?? 0)),
      res: spec.resistance, reduced: opts.reduced,
      fail: (weight = 0.3) => { this.ctx.assist = Math.min(1, this.ctx.assist + weight * 0.22); },
      spawnPart: (src, x, y, o) => {
        const id = src === 'a' ? a.itemId : src === 'b' ? b.itemId : src;
        const p = world.spawnPart(id, x, y, o);
        this.temps.push(p);
        return p;
      },
      removePart: p => {
        const i = this.temps.indexOf(p);
        if (i >= 0) this.temps.splice(i, 1);
        world.remove(p, true);
      },
      zoneRect: id => world.zoneRect(id),
      zoneAt: (x, y) => world.zoneAt(x, y),
      setZoneLit: id => { this.lit = id; },
      moveTo: (body, x, y, k) => world.glide(body, x, y, k),
      say: text => opts.onSay?.(text),
    };

    for (const body of [a, b]) {
      body.held = false; body.vx = body.vy = 0; body.z = 0; body.locked = false;
      body.el.classList.remove('wb-held');
    }
    // carried to the station: set the pair down together there
    if (spec.station && !carries) {
      const gapx = (a.r + b.r) * 0.5;
      a.x = cx - gapx; b.x = cx + gapx; a.y = b.y = cy;
      a.tx = a.x; a.ty = a.y; b.tx = b.x; b.ty = b.y;
    }
    this.begin(0);
  }

  /** Zone the current step wants lit (the hearth while heating). Read by the Workbench. */
  lit: ZoneId | null = null;

  get total() { return this.steps.length; }
  /** Whole-process progress, 0 – 1. */
  get progress() {
    if (this.done) return 1;
    return Math.min(1, (Math.max(0, this.idx) + (this.runtime?.progress ?? 0)) / this.steps.length);
  }
  /** True while a step wants free grabbing of bodies. */
  get grabbing() { return !!this.runtime?.grabs; }

  private begin(i: number) {
    this.idx = i;
    const spec = this.steps[i];
    const def = stepDef(spec.kind);
    const { a, b } = this;
    this.lit = null;
    for (const body of [a, b, ...this.temps]) { body.grabbable = true; body.held = false; body.el.classList.remove('wb-held'); }
    a.locked = b.locked = false;
    a.solid = b.solid = true;
    this.ctx.ptr.grab = null;
    this.runtime = def ? def.create(spec as Record<string, unknown>, this.ctx) : null;
    // steps that drive the bodies themselves get them locked; grabbing steps manage their own
    if (this.runtime && !this.runtime.grabs) { a.locked = true; b.locked = true; a.grabbable = false; b.grabbable = false; a.z = b.z = 0; }
    if (def) this.opts.onStep?.(i, this.steps.length, def.verb, spec.kind);
  }

  private endStep() {
    this.runtime?.cleanup?.(this.ctx);
    this.runtime = null;
    this.ctx.ptr.grab = null;
    for (const body of [this.a, this.b, ...this.temps]) { body.held = false; body.el.classList.remove('wb-held'); }
    this.a.solid = this.b.solid = true;
  }

  /* ── input, in world coordinates ──────────────────────────────────── */

  pointerDown(x: number, y: number, type: Pointer['type']) {
    const p = this.ctx.ptr;
    p.x = p.x0 = x; p.y = p.y0 = y; p.down = true; p.pressed = true; p.held = 0; p.type = type; p.seen = true;
    p.vx = p.vy = 0; p.speed = 0;
    this.lastMove = this.clock();
    const rt = this.runtime;
    if (!rt) return;
    if (rt.grabs) {
      const body = this.world.bodyAt(x, y, q => !q.locked && q.grabbable);
      if (body) { this.world.grab(body, x, y); p.grab = body; }
    }
    rt.down?.(this.ctx);
  }

  pointerMove(x: number, y: number) {
    const p = this.ctx.ptr;
    const now = this.clock();
    const dt = Math.max(0.001, (now - this.lastMove) / 1000);
    this.lastMove = now;
    const k = Math.min(1, dt * 20);
    p.vx += ((x - p.x) / dt - p.vx) * k * 0.5;
    p.vy += ((y - p.y) / dt - p.vy) * k * 0.5;
    p.speed = Math.hypot(p.vx, p.vy);
    p.x = x; p.y = y; p.seen = true;
    if (p.grab) this.world.dragTo(p.grab, x, y);
    this.runtime?.move?.(this.ctx);
  }

  pointerUp() {
    const p = this.ctx.ptr;
    if (!p.down) return;
    this.runtime?.up?.(this.ctx);
    const g = p.grab;
    if (g) {
      const cap = 900;
      const s = Math.hypot(p.vx, p.vy) || 1;
      const k = s > cap ? cap / s : 1;
      this.world.release(g, p.vx * k * 0.6, p.vy * k * 0.6);
      p.grab = null;
    }
    p.down = false; p.released = true;
  }

  keyDown(key: string, shift = false, repeat = false) {
    const k = key.toLowerCase();
    this.keys.add(k);
    if (repeat) return;
    const rt = this.runtime;
    if (!rt) return;
    if (k === ' ') rt.key?.('primary', this.ctx, shift);
    else if (k === 'e') rt.key?.('interact', this.ctx, shift);
    else if (k === 'r') rt.key?.('rotate', this.ctx, shift);
  }
  keyUp(key: string) { this.keys.delete(key.toLowerCase()); }
  clearKeys() { this.keys.clear(); }
  wheel(dy: number) { this.runtime?.wheel?.(dy, this.ctx); }

  /* ── frame ────────────────────────────────────────────────────────── */

  update(dt: number) {
    if (this.done || this.cancelled) return;
    const c = this.ctx;
    c.t += dt;
    const pl = this.world.play;
    c.w = pl.w; c.h = pl.h;
    c.x0 = c.cx - pl.w / 2; c.y0 = c.cy - pl.h / 2;
    const p = c.ptr;
    if (p.down) p.held += dt;

    // a piece that a step has locked or hidden from the hand is let go
    if (p.grab && (p.grab.locked || !p.grab.grabbable)) { this.world.release(p.grab, 0, 0); p.grab = null; }

    if (this.runtime) {
      this.runtime.update(dt, c);
      if (this.runtime.done) { this.endStep(); this.gap = GAP; }
    } else if (this.gap > 0) {
      this.gap -= dt;
      if (this.gap <= 0) {
        if (this.idx + 1 >= this.steps.length) { this.finish(); return; }
        this.begin(this.idx + 1);
      }
    }
    p.pressed = false; p.released = false;
  }

  draw(g: CanvasRenderingContext2D) {
    if (this.done || this.cancelled) return;
    this.runtime?.draw(g, this.ctx);
  }

  private finish() {
    this.done = true;
    this.clearTemps();
    for (const body of [this.a, this.b]) { body.locked = false; body.grabbable = true; body.z = 0; body.solid = true; }
    this.lit = null;
  }

  private clearTemps() {
    for (const t of [...this.temps]) this.world.remove(t, true);
    this.temps.length = 0;
  }

  /** Finish the process for the player, for when the hands cannot or will not. */
  skip() {
    if (this.done || this.cancelled) return;
    if (this.ctx.ptr.grab) { this.world.release(this.ctx.ptr.grab, 0, 0); this.ctx.ptr.grab = null; }
    this.runtime?.cleanup?.(this.ctx);
    this.runtime = null;
    this.finish();
  }

  /** Stop without a result: put everything down and let it be a free bench again. */
  cancel() {
    if (this.done || this.cancelled) return;
    this.cancelled = true;
    if (this.ctx.ptr.grab) { this.world.release(this.ctx.ptr.grab, 0, 0); this.ctx.ptr.grab = null; }
    this.runtime?.cleanup?.(this.ctx);
    this.runtime = null;
    this.clearTemps();
    for (const body of [this.a, this.b]) { body.locked = false; body.grabbable = true; body.z = 0; body.held = false; body.solid = true; body.el.classList.remove('wb-held'); }
    this.lit = null;
  }

  /** Assist to remember for the next attempt at this pair. */
  get assist() { return this.ctx.assist; }
}
