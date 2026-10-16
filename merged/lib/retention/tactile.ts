/* ============================================================================
   TACTILE DIRECTOR (#19) — the bench answers the hand.

   Every one of the 16 material families has its own voice: what flies off it,
   what shape it draws, how it sounds and how the piece itself shivers. The
   director listens to the gestures the Workbench already tracks (grab, tap,
   double tap, press, rub, shake, swirl, throw, impact, wall bounce, landing,
   spin, proximity) and answers with small vector sprites on the SAME Fx canvas.

   It is strictly cosmetic:
     - it never captures the pointer, never creates a DOM overlay and never runs
       a second physics simulation;
     - it only nudges the decaying cosmetic channels already on a Body
       (`ox/oy` shiver, `q` squash) — never x/y/vx/vy, never recipes or counts;
     - a new grab cuts the piece's effects short at once (`fx.clearSprites`);
     - it stays silent unless the Workbench says the bench is free
       (active, no craft session, nothing resolving).
   ========================================================================== */
import type { Body, FxApi, MaterialId, SoundId } from '../craft/types';
import type { ContactInfo } from '../craft/types';
import type { Fx } from '../craft/fx';
import type { TactileGesture } from './bus';
import {
  type ColorKey, type ShapeId, TAU, billow, hatchFan, pieces, ripple, streaks, trace,
} from './vfx';

/* ── the 16 voices ─────────────────────────────────────────────────────── */

interface Voice {
  A: ShapeId; B: ShapeId;
  c: ColorKey; c2: ColorKey;
  snd: SoundId; snd2: SoundId; rate: number;
  /** debris gravity (negative rises) */ grav: number;
  /** debris speed scale */ spd: number;
  /** ripple aspect: [rx, ry] in body radii */ ring: [number, number];
  /** shiver amplitude px, frequency Hz, ring-down seconds */ shiver: [number, number, number];
  /** squash impulse scale */ soft: number;
  /** drag on debris */ drag: number;
}

export const VOICES: Record<MaterialId, Voice> = {
  stone:     { A: 'chip',     B: 'crumb',    c: 'bone',   c2: 'bone3', snd: 'clack',  snd2: 'tick',   rate: 0.9,  grav: 260, spd: 1.0, ring: [1.3, 0.5], shiver: [0.8, 40, 0.18], soft: 0.2, drag: 1.6 },
  wood:      { A: 'splinter', B: 'grain',    c: 'ochre',  c2: 'bone3', snd: 'knock',  snd2: 'click',  rate: 1.0,  grav: 180, spd: 0.9, ring: [1.5, 0.6], shiver: [1.1, 18, 0.35], soft: 0.5, drag: 1.8 },
  bone:      { A: 'tick',     B: 'flake',    c: 'bone',   c2: 'bone2', snd: 'click',  snd2: 'tick',   rate: 1.3,  grav: 220, spd: 1.1, ring: [1.1, 0.5], shiver: [1.0, 55, 0.3],  soft: 0.15, drag: 1.5 },
  fibre:     { A: 'thread',   B: 'thread',   c: 'ochre',  c2: 'bone3', snd: 'rustle', snd2: 'rustle', rate: 1.0,  grav: 24,  spd: 0.55, ring: [1.7, 0.7], shiver: [1.6, 7, 0.6],   soft: 1.6, drag: 2.6 },
  metal:     { A: 'star',     B: 'tick',    c: 'bone',   c2: 'ochre', snd: 'ring',   snd2: 'ring',   rate: 1.15, grav: 120, spd: 1.25, ring: [1.6, 1.6], shiver: [1.3, 62, 0.7],  soft: 0.1, drag: 1.2 },
  earth:     { A: 'crumb',    B: 'crumb',    c: 'ochre',  c2: 'bone3', snd: 'thud',   snd2: 'puff',   rate: 0.85, grav: 320, spd: 0.7, ring: [1.8, 0.7], shiver: [0.7, 9, 0.25],  soft: 0.9, drag: 2.4 },
  glass:     { A: 'prism',    B: 'cross',    c: 'water',  c2: 'bone',  snd: 'tick',   snd2: 'chime',  rate: 1.9,  grav: 140, spd: 1.2, ring: [1.3, 1.3], shiver: [0.9, 90, 0.55], soft: 0.05, drag: 1.3 },
  liquid:    { A: 'drop',     B: 'arc',      c: 'water',  c2: 'bone2', snd: 'plip',   snd2: 'splash', rate: 1.0,  grav: 420, spd: 0.9, ring: [1.9, 0.55], shiver: [1.8, 5, 0.7],  soft: 1.8, drag: 0.9 },
  fire:      { A: 'ember',    B: 'ember',    c: 'hot',    c2: 'ochre', snd: 'crackle', snd2: 'hiss',  rate: 1.1,  grav: -90, spd: 0.7, ring: [1.2, 1.2], shiver: [1.4, 11, 0.5],  soft: 0.8, drag: 1.5 },
  tool:      { A: 'shard',    B: 'tick',     c: 'bone',   c2: 'ochre', snd: 'clack',  snd2: 'click',  rate: 1.05, grav: 240, spd: 1.0, ring: [1.2, 0.8], shiver: [1.0, 30, 0.25], soft: 0.15, drag: 1.5 },
  structure: { A: 'pixel',    B: 'crumb',    c: 'bone2',  c2: 'bone3', snd: 'thud',   snd2: 'knock',  rate: 0.65, grav: 300, spd: 0.6, ring: [2.0, 0.55], shiver: [0.6, 6, 0.4],  soft: 0.1, drag: 2.2 },
  machine:   { A: 'tooth',    B: 'tick',     c: 'bone',   c2: 'ochre', snd: 'ring',   snd2: 'tick',   rate: 0.75, grav: 200, spd: 0.95, ring: [1.4, 1.4], shiver: [1.2, 24, 0.45], soft: 0.1, drag: 1.6 },
  energy:    { A: 'bolt',     B: 'star',     c: 'ochre',  c2: 'water', snd: 'hum',    snd2: 'crackle', rate: 1.4, grav: 0,   spd: 1.35, ring: [1.5, 1.5], shiver: [1.0, 80, 0.4],  soft: 0.4, drag: 0.8 },
  signal:    { A: 'pixel',    B: 'arc',      c: 'water',  c2: 'bone',  snd: 'tick',   snd2: 'chime',  rate: 1.6,  grav: 0,   spd: 1.0, ring: [1.9, 1.9], shiver: [0.8, 70, 0.3],  soft: 0.2, drag: 1.0 },
  idea:      { A: 'mote',     B: 'star',     c: 'ochre',  c2: 'bone',  snd: 'chime',  snd2: 'chime',  rate: 1.2,  grav: -30, spd: 0.5, ring: [1.6, 1.6], shiver: [0.6, 4, 0.9],   soft: 0.5, drag: 1.1 },
  life:      { A: 'leaf',     B: 'bead',     c: 'good',   c2: 'ochre', snd: 'thud',   snd2: 'puff',   rate: 1.2,  grav: 60,  spd: 0.6, ring: [1.5, 1.0], shiver: [1.2, 3, 1.0],   soft: 1.2, drag: 1.7 },
};

/** Gesture → cooldown (ms, per body) and the least intensity that deserves a reply. */
const COOL: Record<TactileGesture, number> = {
  grab: 500, tap: 220, doubleTap: 900, press: 2800, rub: 700, shake: 1500, swirl: 1800, throw: 450,
  impact: 260, bounce: 420, land: 380, spin: 340, near: 5200,
};

/** What a pair does beside each other (no touching required): [a, b] → label. */
export const AFFINITY: Record<string, string> = {
  'fire|wood': 'warm', 'fire|fibre': 'warm', 'fire|bone': 'warm', 'fire|life': 'warm',
  'fire|metal': 'glow', 'fire|glass': 'shimmer', 'fire|earth': 'bake', 'fire|liquid': 'steam',
  'liquid|earth': 'damp', 'liquid|fibre': 'damp', 'liquid|wood': 'damp', 'liquid|stone': 'wet',
  'energy|machine': 'hum', 'energy|metal': 'arc', 'signal|machine': 'ping', 'signal|energy': 'ping',
  'idea|signal': 'link', 'idea|tool': 'think', 'idea|life': 'think', 'metal|tool': 'ring',
  'glass|idea': 'prism', 'stone|tool': 'ring', 'structure|tool': 'tap', 'life|earth': 'sprout',
};

export interface TactileHost {
  enabled(): boolean;
  /** true only while the bench is free: active, no session, nothing resolving */
  canAct(): boolean;
  reduced(): boolean;
  /** sound is audible in the game right now */
  /** report a meaningful gesture upward (for daily objectives and achievements) */
  onGesture?(g: TactileGesture, b: Body): void;
}

interface PathPt { x: number; y: number; t: number }
interface Track { pts: PathPt[]; lastShake: number; lastRub: number; lastSwirl: number }
interface Shiver { b: Body; t: number; dur: number; amp: number; hz: number; ax: number; ay: number }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const pairKey = (a: Body, b: Body) => (a.uid < b.uid ? `${a.uid}|${b.uid}` : `${b.uid}|${a.uid}`);

export class TactileDirector {
  private last = new Map<string, number>();
  private tracks = new Map<number, Track>();
  private lastTap = new Map<number, number>();
  private shivers: Shiver[] = [];
  private budget = 12;      // effects per second, refilled in frame()
  private prox = 0;
  private pairLast = new Map<string, number>();
  private pressed: { b: Body; t: number; x: number; y: number; done: boolean } | null = null;

  constructor(private fx: Fx, private host: TactileHost) {}

  /* ── plumbing ──────────────────────────────────────────────────────── */

  private ok(b: Body, g: TactileGesture, now: number, force = false): boolean {
    if (!this.host.enabled() || !this.host.canAct()) return false;
    if (b.temp || b.locked || b.outside) return false;
    if (this.budget < 1 && !force) return false;
    const key = `${b.uid}/${g}`;
    if (now - (this.last.get(key) ?? -1e9) < COOL[g]) return false;
    this.last.set(key, now);
    this.budget -= 1;
    return true;
  }

  private snd(id: SoundId, vol: number, rate: number, pan = 0) {
    (this.fx as FxApi).sound(id, { vol: clamp(vol, 0.03, 0.7), rate, pan });
  }
  private pan(b: Body) { return clamp((b.x - 400) / 900, -0.6, 0.6); }

  private done(g: TactileGesture, b: Body) { this.host.onGesture?.(g, b); }

  private startShiver(b: Body, v: Voice, strength: number, ax = 1, ay = 0.3) {
    if (this.host.reduced()) return;
    this.shivers = this.shivers.filter(s => s.b !== b);
    if (this.shivers.length > 10) this.shivers.shift();
    this.shivers.push({ b, t: 0, dur: v.shiver[2] * (0.6 + strength * 0.6), amp: v.shiver[0] * (0.5 + strength), hz: v.shiver[1], ax, ay });
  }

  /** Interrupt: a new grab (or removal) ends everything this piece was doing. */
  cancel(b: Body) {
    this.fx.clearSprites(b.uid);
    this.shivers = this.shivers.filter(s => s.b !== b);
    b.ox = 0; b.oy = 0;
    if (this.pressed?.b === b) this.pressed = null;
  }
  cancelAll() { this.fx.clearSprites(); this.shivers = []; this.pressed = null; this.tracks.clear(); }
  dispose() { this.cancelAll(); this.last.clear(); this.lastTap.clear(); this.pairLast.clear(); }

  /** Bench props shiver a little (a gag): cosmetic offsets only, loose pieces only. */
  quake(bodies: readonly Body[]) {
    if (this.host.reduced()) return;
    let i = 0;
    for (const b of bodies) {
      if (b.temp || b.held || b.locked || b.outside) continue;
      this.shivers = this.shivers.filter(s => s.b !== b);
      this.shivers.push({ b, t: 0, dur: 0.9, amp: 1.6, hz: 9 + (i++ % 3), ax: 1, ay: 0.5 });
    }
  }
  /** A tool shrugs: a few degrees of spin that the world springs back on its own. */
  shrug(b: Body) { if (!this.host.reduced() && !b.held && !b.locked) b.av += 1.3; }

  /* ── gestures ──────────────────────────────────────────────────────── */

  grab(b: Body, px: number, py: number, now = performance.now()) {
    this.cancel(b);
    this.tracks.set(b.uid, { pts: [{ x: px, y: py, t: now }], lastShake: 0, lastRub: 0, lastSwirl: 0 });
    this.pressed = { b, t: now, x: px, y: py, done: false };
    if (!this.ok(b, 'grab', now)) return;
    const v = VOICES[b.material];
    hatchFan(this.fx, px, py, { n: 5, len: 7 + b.r * 0.12, inner: 4, color: v.c2, life: 0.32, width: 0.9, owner: b.uid, spread: Math.PI * 0.9, angle: -Math.PI / 2 });
    b.q = Math.max(b.q, v.soft * 0.045);
    this.done('grab', b);
  }

  tap(b: Body, now = performance.now()) {
    const prev = this.lastTap.get(b.uid) ?? -1e9;
    this.lastTap.set(b.uid, now);
    const dbl = now - prev < 360;
    const v = VOICES[b.material];
    const x = b.x, y = b.y - b.z;
    if (dbl) {
      if (!this.ok(b, 'doubleTap', now, true)) return;
      this.signature(b, v, 'doubleTap');
      this.snd(v.snd, 0.28, v.rate * 1.12, this.pan(b));
      b.q = Math.max(b.q, v.soft * 0.08);
      this.done('doubleTap', b);
      return;
    }
    if (!this.ok(b, 'tap', now)) return;
    pieces(this.fx, x, y - b.r * 0.55, { shape: v.B, n: 3 + (b.r > 30 ? 1 : 0), speed: 46 * v.spd, spread: 1.5, angle: -Math.PI / 2, gravity: v.grav, life: 0.5, size: 2.4, color: v.c2, drag: v.drag, spin: 6, owner: b.uid });
    this.snd(v.snd2, 0.14, v.rate * 1.25, this.pan(b));
    b.q = Math.max(b.q, v.soft * 0.07);
    this.startShiver(b, v, 0.2);
    this.done('tap', b);
  }

  /** The held piece moved: detect rub, shake and swirl from the path of the hand. */
  moveHeld(b: Body, px: number, py: number, now = performance.now()) {
    if (!this.host.enabled() || !this.host.canAct() || b.temp || b.locked) return;
    const tr = this.tracks.get(b.uid);
    if (!tr) return;
    const pts = tr.pts;
    const lastp = pts[pts.length - 1];
    if (Math.hypot(px - lastp.x, py - lastp.y) < 2.5) return;
    pts.push({ x: px, y: py, t: now });
    while (pts.length > 2 && now - pts[0].t > 1300) pts.shift();
    if (pts.length > 60) pts.splice(0, pts.length - 60);
    if (this.pressed && Math.hypot(px - this.pressed.x, py - this.pressed.y) > 10) this.pressed = null;
    if (pts.length < 6) return;

    const v = VOICES[b.material];
    // window: the last 0.8 s
    let i0 = pts.length - 1;
    while (i0 > 0 && now - pts[i0 - 1].t < 800) i0--;
    const w = pts.slice(i0);
    if (w.length < 6) return;
    let path = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, cx = 0, cy = 0;
    for (let i = 0; i < w.length; i++) {
      if (i) path += Math.hypot(w[i].x - w[i - 1].x, w[i].y - w[i - 1].y);
      minX = Math.min(minX, w[i].x); maxX = Math.max(maxX, w[i].x); minY = Math.min(minY, w[i].y); maxY = Math.max(maxY, w[i].y);
      cx += w[i].x; cy += w[i].y;
    }
    cx /= w.length; cy /= w.length;
    const span = Math.hypot(maxX - minX, maxY - minY);
    const dur = Math.max(0.05, (w[w.length - 1].t - w[0].t) / 1000);
    const speed = path / dur;
    // direction reversals along the long axis
    const ax = maxX - minX >= maxY - minY ? 0 : 1;
    let rev = 0, dir = 0, anchor = ax ? w[0].y : w[0].x;
    for (let i = 1; i < w.length; i++) {
      const p = ax ? w[i].y : w[i].x;
      const d = p - anchor;
      if (Math.abs(d) > 9) { const s = Math.sign(d); if (dir && s !== dir) { rev++; } dir = s; anchor = p; }
    }
    // swirl: signed angle swept around the centroid
    let sweep = 0, rAvg = 0;
    for (let i = 1; i < w.length; i++) {
      const a0 = Math.atan2(w[i - 1].y - cy, w[i - 1].x - cx), a1 = Math.atan2(w[i].y - cy, w[i].x - cx);
      let da = a1 - a0; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      sweep += da; rAvg += Math.hypot(w[i].x - cx, w[i].y - cy);
    }
    rAvg /= w.length - 1;

    if (rev >= 3 && speed > 340 && span > 22 && now - tr.lastShake > COOL.shake) {
      if (this.ok(b, 'shake', now, true)) { tr.lastShake = now; this.shake(b, v, ax, speed); }
      return;
    }
    if (Math.abs(sweep) > Math.PI * 1.55 && rAvg > 11 && rAvg < 150 && now - tr.lastSwirl > COOL.swirl) {
      if (this.ok(b, 'swirl', now, true)) { tr.lastSwirl = now; this.swirl(b, v, cx, cy, rAvg, Math.sign(sweep)); }
      return;
    }
    if (rev >= 2 && speed > 45 && speed < 420 && span < b.r * 2.6 && path > 70 && now - tr.lastRub > COOL.rub) {
      if (this.ok(b, 'rub', now)) { tr.lastRub = now; this.rub(b, v, px, py, ax); }
    }
  }

  private shake(b: Body, v: Voice, ax: number, speed: number) {
    const x = b.x, y = b.y - b.z;
    const k = clamp(speed / 900, 0.3, 1);
    const a = ax ? Math.PI / 2 : 0;
    pieces(this.fx, x, y, { shape: v.A, n: 5 + Math.round(k * 5), speed: 130 * v.spd, spread: 0.7, angle: a, gravity: v.grav, life: 0.7, size: 3, color: v.c, drag: v.drag, spin: 12, owner: b.uid });
    pieces(this.fx, x, y, { shape: v.A, n: 4 + Math.round(k * 4), speed: 130 * v.spd, spread: 0.7, angle: a + Math.PI, gravity: v.grav, life: 0.7, size: 3, color: v.c2, drag: v.drag, spin: 12, owner: b.uid });
    this.signature(b, v, 'shake');
    this.snd(v.snd, 0.3 * k + 0.1, v.rate * 0.85, this.pan(b));
    this.startShiver(b, v, k, ax ? 0.3 : 1, ax ? 1 : 0.3);
    this.done('shake', b);
  }

  private swirl(b: Body, v: Voice, cx: number, cy: number, r: number, dir: number) {
    const pts: number[] = [];
    for (let i = 0; i <= 26; i++) {
      const k = i / 26, a = k * TAU * 1.25 * dir;
      const rr = r * (0.35 + k * 0.85);
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9);
    }
    trace(this.fx, pts, { color: v.c, life: 0.8, width: 1.1, owner: b.uid, hold: 0.5 });
    pieces(this.fx, b.x, b.y - b.z, { shape: v.B, n: 5, speed: 70 * v.spd, spread: TAU, gravity: v.grav * 0.3, life: 0.75, size: 2.4, color: v.c2, drag: 1.2, spin: 10, owner: b.uid, ring: b.r * 0.5 });
    this.signature(b, v, 'swirl');
    this.snd('whoosh', 0.18, v.rate * 1.1, this.pan(b));
    this.done('swirl', b);
  }

  private rub(b: Body, v: Voice, px: number, py: number, ax: number) {
    const a = ax ? Math.PI / 2 : 0;
    pieces(this.fx, px, py, { shape: v.B, n: 3, speed: 38 * v.spd, spread: 0.9, angle: a + Math.PI * (Math.random() < 0.5 ? 0 : 1), gravity: v.grav * 0.4, life: 0.45, size: 2, color: v.c2, drag: 2.2, along: true, owner: b.uid });
    const scr: SoundId =
      b.material === 'fibre' || b.material === 'earth' || b.material === 'life' ? 'rustle'
      : b.material === 'liquid' ? 'plip' : b.material === 'fire' ? 'hiss'
      : b.material === 'glass' || b.material === 'signal' || b.material === 'idea' ? 'tick' : 'scrape';
    this.snd(scr, 0.16, v.rate, this.pan(b));
    this.done('rub', b);
  }

  /** Let go: a quick flick leaves a trail; slower releases are silent. */
  release(b: Body, vx: number, vy: number, now = performance.now()) {
    this.tracks.delete(b.uid);
    this.pressed = null;
    const sp = Math.hypot(vx, vy);
    if (sp < 300) return;
    if (!this.ok(b, 'throw', now)) return;
    const v = VOICES[b.material];
    const a = Math.atan2(vy, vx);
    const x = b.x, y = b.y - b.z;
    streaks(this.fx, x - Math.cos(a) * b.r * 0.4, y - Math.sin(a) * b.r * 0.4, { angle: a + Math.PI, n: 3, len: 10 + sp / 90, gap: 4.5, dist: 22 + sp / 40, life: 0.38, color: v.c2, width: 0.9, owner: b.uid });
    pieces(this.fx, x, y, { shape: v.B, n: 2 + Math.round(clamp(sp / 700, 0, 3)), speed: 50 * v.spd, spread: 0.8, angle: a + Math.PI, gravity: v.grav * 0.3, life: 0.5, size: 2.2, color: v.c, drag: 2, along: true, owner: b.uid });
    this.snd('whoosh', clamp(sp / 2400, 0.06, 0.22), v.rate * 0.9 + sp / 4000, this.pan(b));
    b.q = Math.max(b.q, v.soft * 0.05);
    this.done('throw', b);
  }

  /** Two pieces struck: the harder one throws debris along the contact line. */
  impact(info: ContactInfo, now = performance.now()) {
    const { a, b, speed, force } = info;
    if (speed < 150) return;
    const hard = a.props.hard >= b.props.hard ? a : b;
    const soft = hard === a ? b : a;
    const nx = soft.x - hard.x, ny = soft.y - hard.y, d = Math.hypot(nx, ny) || 1;
    const ang = Math.atan2(ny / d, nx / d);
    const mx = hard.x + (nx / d) * hard.r, my = hard.y - hard.z + (ny / d) * hard.r;
    const k = clamp(speed / 800 + force * 0.6, 0.25, 1);
    for (const [body, other] of [[hard, soft], [soft, hard]] as [Body, Body][]) {
      if (!this.ok(body, 'impact', now, true)) continue;
      const v = VOICES[body.material];
      const away = body === hard ? ang + Math.PI : ang;
      pieces(this.fx, mx, my, { shape: v.A, n: 2 + Math.round(k * 4), speed: (70 + speed * 0.09) * v.spd, spread: 1.3, angle: away, gravity: v.grav, life: 0.55, size: 2.6 + k, color: v.c, drag: v.drag, spin: 14, owner: body.uid });
      if (body === hard) hatchFan(this.fx, mx, my, { n: 6, len: 8 + k * 8, inner: 3, color: v.c2, life: 0.3, width: 1, spread: Math.PI * 1.1, angle: ang, owner: body.uid });
      this.startShiver(body, v, k, Math.cos(ang), Math.sin(ang));
      void other;
    }
    // one extra, material-specific "after-ring" for the hardest family on the contact
    const hv = VOICES[hard.material];
    if (k > 0.55) this.signature(hard, hv, 'impact', mx, my);
    this.done('impact', hard);
  }

  wall(b: Body, speed: number, now = performance.now()) {
    if (speed < 170 || !this.ok(b, 'bounce', now)) return;
    const v = VOICES[b.material];
    const a = this.host.reduced() ? 0 : Math.atan2(-b.vy, -b.vx);
    pieces(this.fx, b.x, b.y - b.z, { shape: v.B, n: 3, speed: 60 * v.spd, spread: 1.1, angle: a, gravity: v.grav, life: 0.45, size: 2.2, color: v.c2, drag: v.drag, spin: 8, owner: b.uid });
    this.startShiver(b, v, clamp(speed / 700, 0.2, 0.8), Math.cos(a), Math.sin(a));
    this.done('bounce', b);
  }

  land(b: Body, speed: number, now = performance.now()) {
    if (speed < 140 || !this.ok(b, 'land', now)) return;
    const v = VOICES[b.material];
    const k = clamp(speed / 700, 0.25, 1);
    ripple(this.fx, b.x, b.y + b.r * 0.55, { rx: b.r * v.ring[0] * (0.7 + k * 0.5), ry: b.r * v.ring[1] * 0.35 * (0.7 + k * 0.5), color: v.c2, life: 0.55, rings: v.ring[0] > 1.6 ? 3 : 2, width: 0.9, owner: b.uid });
    if (v.grav > 200) billow(this.fx, b.x, b.y + b.r * 0.5, { color: v.c2, r: b.r * 0.6, rise: 8, life: 0.7, n: 3 + Math.round(k * 2), owner: b.uid, seed: b.uid });
    else pieces(this.fx, b.x, b.y + b.r * 0.3, { shape: v.B, n: 3, speed: 36 * v.spd, spread: Math.PI, angle: -Math.PI / 2, gravity: v.grav * 0.6, life: 0.55, size: 2, color: v.c2, drag: 2, owner: b.uid });
    this.startShiver(b, v, k, 0.2, 1);
    this.done('land', b);
  }

  spin(b: Body, dir: number, now = performance.now()) {
    if (!this.ok(b, 'spin', now)) return;
    const v = VOICES[b.material];
    const x = b.x, y = b.y - b.z;
    const a0 = dir > 0 ? -0.4 : Math.PI + 0.4;
    pieces(this.fx, x, y, { shape: 'arc', n: 3, speed: 30, spread: 0.2, angle: a0 + Math.PI / 2 * dir, gravity: 0, life: 0.45, size: b.r * 0.9, color: v.c2, drag: 3, width: 0.9, owner: b.uid, ring: 0, alpha: 0.6 });
    this.snd('tick', 0.1, v.rate * (1.3 + 0.1 * dir), this.pan(b));
    this.done('spin', b);
  }

  /** Material-specific flourishes used by double taps, shakes, swirls and hard impacts. */
  private signature(b: Body, _v: Voice, ctx: 'doubleTap' | 'shake' | 'swirl' | 'impact', ix?: number, iy?: number) {
    const x = ix ?? b.x, y = iy ?? (b.y - b.z), r = b.r;
    const f = this.fx;
    const o = b.uid;
    switch (b.material) {
      case 'stone': {      // a hairline crack that runs and closes
        trace(f, [x - r * 0.5, y - r * 0.3, x - r * 0.1, y, x + r * 0.15, y - r * 0.1, x + r * 0.5, y + r * 0.35], { color: 'bone2', life: 0.7, width: 1, owner: o });
        break;
      }
      case 'wood': {       // growth rings widen from the grain
        ripple(f, x, y, { rx: r * 1.1, ry: r * 0.6, color: 'ochre', life: 0.8, rings: 3, width: 0.8, owner: o, rot: -0.3 });
        break;
      }
      case 'bone': {       // three dry clicks in a row
        for (let i = 0; i < 3; i++) pieces(f, x + (i - 1) * r * 0.7, y - r * 0.6, { shape: 'tick', n: 2, speed: 28, spread: 0.6, angle: -Math.PI / 2, life: 0.35, size: 4, color: 'bone', delay: i * 0.08, owner: o, gravity: 80 });
        break;
      }
      case 'fibre': {      // a loose end loops itself into a knot and lets go
        const p: number[] = [];
        for (let i = 0; i <= 22; i++) { const t = i / 22 * TAU * 1.1; p.push(x + Math.sin(t * 1.0) * r * 0.8, y + Math.sin(t * 2) * r * 0.45); }
        trace(f, p, { color: 'ochre', life: 1.0, width: 1, owner: o, hold: 0.4 });
        break;
      }
      case 'metal': {      // ring-down: two bright rings and a travelling glint
        ripple(f, x, y, { rx: r * 1.5, color: 'bone', life: 0.9, rings: 2, width: 1.1, owner: o });
        streaks(f, x - r, y - r * 0.6, { angle: 0.5, n: 1, len: 14, dist: r * 2, life: 0.45, color: 'bone', width: 1.3, owner: o });
        break;
      }
      case 'earth': {      // a clod slumps: crumbs fall and a smear settles
        pieces(f, x, y - r * 0.3, { shape: 'crumb', n: 6, speed: 26, spread: 2.4, angle: Math.PI / 2, gravity: 340, life: 0.7, size: 3, color: 'ochre', owner: o, drag: 1.5 });
        trace(f, [x - r * 0.9, y + r * 0.7, x - r * 0.2, y + r * 0.78, x + r * 0.9, y + r * 0.7], { color: 'ochre', life: 0.8, width: 1.6, owner: o, hold: 0.2 });
        break;
      }
      case 'glass': {      // a prism throws a fan of rays
        for (let i = 0; i < 5; i++) streaks(f, x, y, { angle: -0.9 + i * 0.38, n: 1, len: 12, dist: r * 1.9, life: 0.55, color: i % 2 ? 'water' : 'bone', width: 0.9, owner: o });
        break;
      }
      case 'liquid': {     // three plips like a dropped bead
        for (let i = 0; i < 3; i++) ripple(f, x + (i - 1) * r * 0.5, y + r * 0.3, { rx: r * 0.7, ry: r * 0.2, color: 'water', life: 0.7, rings: 2, width: 0.9, delay: i * 0.12, owner: o });
        break;
      }
      case 'fire': {       // a flare: embers climb in a narrow tongue
        pieces(f, x, y - r * 0.2, { shape: 'ember', n: 7, speed: 80, spread: 0.45, angle: -Math.PI / 2, gravity: -60, life: 0.8, size: 2.6, color: 'hot', owner: o, drag: 1.1 });
        break;
      }
      case 'tool': {       // the working edge swings an arc
        pieces(f, x, y, { shape: 'arc', n: 2, speed: 0, spread: 0, life: 0.45, size: r * 1.15, color: 'bone', width: 1.1, owner: o, alpha: 0.7 });
        break;
      }
      case 'structure': {  // it settles: dust line and a brace cross
        trace(f, [x - r * 1.1, y + r * 0.85, x + r * 1.1, y + r * 0.85], { color: 'bone3', life: 0.6, width: 1.4, owner: o });
        pieces(f, x, y - r * 0.2, { shape: 'cross', n: 1, speed: 0, life: 0.6, size: r * 0.5, color: 'bone2', owner: o });
        break;
      }
      case 'machine': {    // gear teeth tick around a ring
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; pieces(f, x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, { shape: 'tooth', n: 1, speed: 0, life: 0.5, size: 3, color: 'bone', delay: i * 0.04, owner: o, alpha: 0.7, seed: i }); }
        break;
      }
      case 'energy': {     // a bolt hops across the piece
        pieces(f, x, y, { shape: 'bolt', n: 3, speed: 90, spread: TAU, life: 0.3, size: 5, color: 'ochre', owner: o, drag: 3, along: true });
        break;
      }
      case 'signal': {     // pulse rings and a packet of pixels leave
        ripple(f, x, y, { rx: r * 1.8, color: 'water', life: 0.8, rings: 3, width: 0.8, owner: o });
        pieces(f, x, y, { shape: 'pixel', n: 4, speed: 70, spread: 0.5, angle: ctx === 'shake' ? 0 : -0.5, life: 0.6, size: 3, color: 'water', owner: o, drag: 1 });
        break;
      }
      case 'idea': {       // thoughts orbit once and rise
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; pieces(f, x + Math.cos(a) * r, y + Math.sin(a) * r, { shape: 'mote', n: 1, speed: 18, spread: 0.2, angle: -Math.PI / 2, life: 0.95, size: 3.2, color: 'ochre', gravity: -20, delay: i * 0.1, owner: o }); }
        break;
      }
      case 'life': {       // a breath: two leaves lift and a bead of dew
        pieces(f, x, y - r * 0.4, { shape: 'leaf', n: 2, speed: 36, spread: 1.0, angle: -Math.PI / 2, gravity: 40, life: 0.9, size: 4, color: 'good', owner: o, spin: 4, drag: 1.3 });
        ripple(f, x, y, { rx: r * 1.4, color: 'good', life: 0.9, rings: 1, width: 0.8, owner: o });
        break;
      }
    }
  }

  /* ── per-frame: shivers, press, proximity ─────────────────────────── */

  frame(dt: number, bodies: readonly Body[], ptr: { x: number; y: number; inside: boolean; touch: boolean }, now = performance.now()) {
    this.budget = Math.min(12, this.budget + dt * 12);
    // shivers: a damped, decaying offset on the cosmetic channel only
    for (let i = this.shivers.length - 1; i >= 0; i--) {
      const s = this.shivers[i];
      s.t += dt;
      if (s.t >= s.dur || !bodies.includes(s.b) || s.b.held || s.b.locked) { s.b.ox *= 0.5; s.b.oy *= 0.5; this.shivers.splice(i, 1); continue; }
      const env = Math.pow(1 - s.t / s.dur, 2);
      const w = Math.sin(s.t * s.hz * TAU) * s.amp * env;
      s.b.ox = w * s.ax; s.b.oy = w * s.ay;
    }
    if (!this.host.enabled() || !this.host.canAct()) return;

    // press: a still hand on a piece (mouse and pen; a held finger puts a piece away instead)
    const pr = this.pressed;
    if (pr && !pr.done && now - pr.t > 520 && !ptr.touch && pr.b.held) {
      pr.done = true;
      if (this.ok(pr.b, 'press', now, true)) {
        const v = VOICES[pr.b.material];
        ripple(this.fx, pr.b.x, pr.b.y - pr.b.z, { rx: pr.b.r * 1.5, ry: pr.b.r * 1.5 * v.ring[1] / v.ring[0], color: v.c, life: 0.9, rings: 2, width: 0.9, owner: pr.b.uid });
        this.snd(v.snd2, 0.1, v.rate * 0.8, this.pan(pr.b));
        pr.b.q = Math.max(pr.b.q, v.soft * 0.06);
        this.done('press', pr.b);
      }
    }

    // proximity: slow scan, never every frame
    this.prox += dt;
    if (this.prox < 0.34) return;
    this.prox = 0;
    const loose = bodies.filter(b => !b.temp && !b.held && !b.locked && !b.outside);
    if (!loose.length) return;
    for (let i = 0; i < loose.length; i++) {
      const a = loose[i];
      for (let j = i + 1; j < loose.length; j++) {
        const b = loose[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const reach = (a.r + b.r) * 1.0;
        if (d < reach * 0.98 || d > reach * 2.05) continue;
        const kind = AFFINITY[`${a.material}|${b.material}`] ?? AFFINITY[`${b.material}|${a.material}`];
        if (!kind) continue;
        const key = pairKey(a, b);
        if (now - (this.pairLast.get(key) ?? -1e9) < 7000) continue;
        if (this.budget < 2) return;
        this.pairLast.set(key, now);
        this.budget -= 1;
        this.affinity(a, b, kind);
        this.done('near', a);
        return;
      }
    }
    // the hand hovering close over a resting piece (mouse only)
    if (ptr.inside && !ptr.touch) {
      for (const b of loose) {
        if (Math.hypot(ptr.x - b.x, ptr.y - (b.y - b.z)) > b.r * 1.02) continue;
        if (!this.ok(b, 'near', now)) continue;
        const v = VOICES[b.material];
        pieces(this.fx, b.x, b.y - b.z - b.r * 0.7, { shape: v.B, n: 1, speed: 14, spread: 0.6, angle: -Math.PI / 2, gravity: v.grav * 0.1, life: 0.9, size: 2.4, color: v.c2, drag: 0.8, owner: b.uid, alpha: 0.6 });
        this.done('near', b);
        break;
      }
    }
  }

  private affinity(a: Body, b: Body, kind: string) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 6;
    const f = this.fx;
    const va = VOICES[a.material], vb = VOICES[b.material];
    const dir = Math.atan2(b.y - a.y, b.x - a.x);
    switch (kind) {
      case 'warm': pieces(f, mx, my, { shape: 'ember', n: 3, speed: 22, spread: 1.2, angle: -Math.PI / 2, gravity: -40, life: 1.0, size: 2.4, color: 'hot', alpha: 0.7, drag: 1 }); break;
      case 'glow': ripple(f, (a.material === 'metal' ? a : b).x, (a.material === 'metal' ? a : b).y, { rx: 30, color: 'hot', life: 1.1, rings: 2, width: 0.8 }); break;
      case 'shimmer': for (let i = 0; i < 4; i++) streaks(f, mx - 12 + i * 8, my + 8, { angle: -Math.PI / 2 + 0.2, n: 1, len: 8, dist: 18, life: 0.9, color: 'bone', width: 0.8 }); break;
      case 'bake': billow(f, mx, my, { color: 'ochre', r: 10, rise: 10, life: 1.1, n: 3 }); break;
      case 'steam': billow(f, mx, my, { color: 'bone', r: 8, rise: 22, life: 1.3, n: 4, width: 0.8 }); break;
      case 'damp': case 'wet': pieces(f, mx, my + 8, { shape: 'drop', n: 3, speed: 12, spread: 1.4, angle: Math.PI / 2, gravity: 160, life: 0.9, size: 2.4, color: 'water', alpha: 0.7 }); break;
      case 'hum': case 'arc': pieces(f, mx, my, { shape: 'bolt', n: 2, speed: 40, spread: 0.6, angle: dir, life: 0.4, size: 4, color: 'ochre', along: true }); break;
      case 'ping': ripple(f, mx, my, { rx: 34, color: 'water', life: 0.9, rings: 3, width: 0.7 }); break;
      case 'link': trace(f, [a.x, a.y, mx, my - 10, b.x, b.y], { color: 'ochre', life: 1.1, width: 0.9, dash: [2, 4] }); break;
      case 'think': case 'prism': pieces(f, mx, my - 6, { shape: 'mote', n: 2, speed: 12, spread: 0.7, angle: -Math.PI / 2, gravity: -16, life: 1.2, size: 3, color: 'ochre', alpha: 0.7 }); break;
      case 'ring': ripple(f, mx, my, { rx: 22, color: 'bone', life: 0.7, rings: 2, width: 0.8 }); break;
      case 'tap': pieces(f, mx, my, { shape: 'tick', n: 3, speed: 20, spread: 1.5, angle: -Math.PI / 2, life: 0.4, size: 4, color: 'bone2' }); break;
      case 'sprout': pieces(f, mx, my, { shape: 'leaf', n: 2, speed: 16, spread: 0.8, angle: -Math.PI / 2, gravity: -10, life: 1.1, size: 3.4, color: 'good', alpha: 0.8, spin: 2 }); break;
    }
    this.snd(va.snd2, 0.05, va.rate, this.pan(a));
    void vb;
  }
}

/** The set of gestures that count as a real physical manipulation for daily objectives. */
export const PHYSICAL_GESTURES: ReadonlySet<TactileGesture> = new Set<TactileGesture>(['doubleTap', 'press', 'rub', 'shake', 'swirl', 'throw', 'spin', 'bounce']);
