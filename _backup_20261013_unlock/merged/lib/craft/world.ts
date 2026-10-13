import { svg } from '../glyphs';
import { MATERIALS, materialOf, propsOf } from './materials';
import { isPart, partSvg } from './parts';
import type { Body, ContactInfo, MaterialId, ZoneId } from './types';

/* ============================================================================
   WORLD — a small physical bench. Not a physics engine: circles, a table,
   four walls, and enough honesty that weight, inertia, bounce and drop read
   correctly.

     · every item is a circle with a mass, a bounce and a surface drag taken
       from its material (lib/craft/materials.ts)
     · a held item follows the pointer on a spring whose stiffness falls with
       mass, so a stone lags and a fibre keeps up
     · release with a flick and it keeps going; release over another item and
       it drops onto it (height and impact speed are tracked)
     · impacts squash the body on a damped spring and are reported upward, so
       the Workbench can decide what they sound like and what they start

   Bodies are DOM nodes (the plates are SVG, so they stay crisp and follow the
   theme for free). The world moves them with transforms and does nothing
   when everything is at rest.
   ========================================================================== */

export interface Resolved {
  id: string; n: string; vis: string; cat: string; era: string; no?: number;
  /** Physical record (lib/processing/physics.ts): drives looks and how the environment treats it. */
  phys?: { materialClass: string; shapeClass: string; properties: string[]; chars: boolean; soaks: boolean; windy: number };
}

export interface WorldHooks {
  resolve(id: string): Resolved | null;
  onImpact(info: ContactInfo): void;
  onWall(b: Body, speed: number): void;
  onLand(b: Body, speed: number): void;
  onZone(b: Body, from: ZoneId | null, to: ZoneId | null): void;
  /** A body was hit hard enough to fly out through the boundary and has overshot; it is the hook's now. */
  onKnockOut?(b: Body, vx: number, vy: number): void;
  /** A crowded bench wants to put this idle piece away. If given, the hook does it (with a flight home). */
  onEvict?(b: Body): void;
}

/** A soft ground mark: where one thing is worked, and where things are put together. */
export type PatchId = 'processing' | 'assembly';
export interface Patch { cx: number; cy: number; rx: number; ry: number }

export interface ZoneRect { x: number; y: number; w: number; h: number }

const G = 2600;               // px/s² while a body is falling to the bench
const LIFT = 9;               // how high a held body rides
const MAX_BODIES = 12;

/** How fast (px/s) a fresh knock must carry a body into a wall to send it through. Heavy and hard things go
 *  easily; light and soft things never do — a fibre just bounces, an idea just drifts. */
const KNOCK: Partial<Record<MaterialId, number>> = {
  stone: 430, metal: 400, earth: 520, tool: 520, machine: 540, glass: 560, structure: 700,
  wood: 640, bone: 680, life: 640, fibre: 1300, liquid: 1500, fire: 1500, energy: 1500, signal: 1500, idea: 1500,
};
export const knockSpeed = (m: MaterialId) => KNOCK[m] ?? 760;
/** The play box: crafting minigames and stations are laid out inside a centred
 *  area of about this size, however large the screen is. It is not a visible
 *  or clickable limit — bodies can be carried and combined anywhere. */
const PLAY_W = 720;
const PLAY_H = 400;
let UID = 1;

/** Zone layout as fractions of the play box, so it survives any size. */
const ZONE_FRAC: Record<ZoneId, [number, number, number, number]> = {
  hearth: [0.7, 0.08, 0.27, 0.36],
  anvil: [0.7, 0.55, 0.27, 0.36],
  basin: [0.03, 0.55, 0.27, 0.36],
};

export class World {
  bodies: Body[] = [];
  w = 600;
  h = 360;
  /** Room taken by interface that floats over the scenery (the inventory, the
   *  bottom strip). Bodies keep out of it so nothing is hidden or unreachable;
   *  it is zero when that interface is folded away. */
  pad = { l: 0, t: 0, r: 0, b: 0 };
  /** Base radius of a body of size 1. */
  unit = 34;
  private host: HTMLElement;
  private hooks: WorldHooks;
  /** Zones that exist right now. */
  zones = new Set<ZoneId>();
  /** touching pairs → seconds in contact */
  private touch = new Map<string, number>();
  private latched = new Set<string>();
  private wasIn = new Map<number, ZoneId | null>();

  constructor(host: HTMLElement, hooks: WorldHooks) {
    this.host = host;
    this.hooks = hooks;
  }

  /* ── geometry ─────────────────────────────────────────────────────── */

  resize(w: number, h: number) {
    const sx = this.w ? w / this.w : 1, sy = this.h ? h / this.h : 1;
    this.w = w; this.h = h;
    this.unit = Math.max(24, Math.min(40, Math.min(w / 11, h / 6.4)));
    for (const b of this.bodies) {
      b.x *= sx; b.y *= sy; b.tx *= sx; b.ty *= sy;
      if (!b.temp || b.solid) b.r = this.unit * (b.props.size);
      this.clampIn(b);
    }
  }

  /** Where interface floats over the scene. Bodies that end up beneath it are moved clear. */
  setPad(p: { l?: number; t?: number; r?: number; b?: number }) {
    const n = { l: Math.max(0, p.l ?? 0), t: Math.max(0, p.t ?? 0), r: Math.max(0, p.r ?? 0), b: Math.max(0, p.b ?? 0) };
    const o = this.pad;
    if (n.l === o.l && n.t === o.t && n.r === o.r && n.b === o.b) return false;
    this.pad = n;
    for (const b of this.bodies) this.clampIn(b);
    return true;
  }

  /** The free area, in world px. */
  get area(): ZoneRect {
    const { l, t, r, b } = this.pad;
    return { x: l, y: t, w: Math.max(80, this.w - l - r), h: Math.max(80, this.h - t - b) };
  }

  /** The centred box that stations and hands-on steps are laid out in. */
  get play(): ZoneRect {
    const a = this.area;
    const w = Math.min(a.w, PLAY_W), h = Math.min(a.h, PLAY_H);
    return { x: a.x + (a.w - w) / 2, y: a.y + (a.h - h) / 2, w, h };
  }

  /** A station's soft, elliptical patch of ground (its bounding box). */
  zoneRect(id: ZoneId): ZoneRect {
    const [fx, fy, fw, fh] = ZONE_FRAC[id];
    const p = this.play;
    return { x: p.x + fx * p.w, y: p.y + fy * p.h, w: fw * p.w, h: fh * p.h };
  }

  /** Inside the station's ellipse — the same shape the player sees. */
  zoneAt(x: number, y: number): ZoneId | null {
    for (const id of this.zones) {
      const r = this.zoneRect(id);
      const nx = (x - (r.x + r.w / 2)) / (r.w / 2), ny = (y - (r.y + r.h / 2)) / (r.h / 2);
      if (nx * nx + ny * ny <= 1) return id;
    }
    return null;
  }

  private clampIn(b: Body) {
    const p = b.r * 0.85, a = this.area;
    b.x = Math.max(a.x + p, Math.min(a.x + a.w - p, b.x));
    b.y = Math.max(a.y + p, Math.min(a.y + a.h - p, b.y));
  }

  /* ── bodies ───────────────────────────────────────────────────────── */

  get count() { return this.bodies.length; }

  spawn(itemId: string, x: number, y: number, o: { vx?: number; vy?: number; z?: number; angle?: number; pop?: boolean } = {}): Body | null {
    const res = this.hooks.resolve(itemId);
    if (!res) return null;
    const material = materialOf({ id: res.id, cat: res.cat, era: res.era } as never);
    const b = this.make(res.id, res.n, material, res, x, y, o);
    // a crowded bench drops its oldest idle piece rather than growing
    if (this.bodies.filter(q => !q.temp).length > MAX_BODIES) {
      const idle = this.bodies.find(q => !q.temp && !q.held && !q.locked && !q.outside && q !== b);
      if (idle) { if (this.hooks.onEvict) this.hooks.onEvict(idle); else this.remove(idle, true); }
    }
    return b;
  }

  /** A body with no discovery behind it: a peg, a wheel, a rung. */
  spawnPart(partOrItem: string, x: number, y: number, o: { r?: number; solid?: boolean; itemName?: string } = {}): Body {
    const res = isPart(partOrItem) ? null : this.hooks.resolve(partOrItem);
    const material: MaterialId = res ? materialOf({ id: res.id, cat: res.cat, era: res.era } as never) : 'tool';
    const b = this.make(partOrItem, res?.n ?? '', material, res, x, y, { pop: true });
    b.temp = true;
    b.solid = o.solid ?? false;
    b.part = res ? undefined : partOrItem;
    if (o.r) b.r = o.r;
    b.lbl?.remove(); b.lbl = null;
    b.el.classList.add('wb-part');
    return b;
  }

  private make(itemId: string, name: string, material: MaterialId, res: Resolved | null, x: number, y: number,
    o: { vx?: number; vy?: number; z?: number; angle?: number; pop?: boolean }): Body {
    const props = propsOf(material) ?? MATERIALS.stone;
    const r = this.unit * props.size;
    const el = document.createElement('div');
    el.className = 'wb-body';
    el.dataset.item = itemId;
    el.dataset.mat = material;
    if (res?.era) el.dataset.era = res.era;
    if (res?.phys) {
      el.dataset.mclass = res.phys.materialClass;
      el.dataset.shape = res.phys.shapeClass;
      if (res.phys.properties.length) el.dataset.props = res.phys.properties.join(' ');
      if (res.phys.windy > 0) el.dataset.windy = res.phys.windy >= 0.9 ? '2' : '1';
    }
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    const art = res ? svg({ id: res.id, vis: res.vis, cat: res.cat }) : partSvg(itemId);
    el.innerHTML = `<i class="wb-shadow"></i><i class="wb-aura"></i><span class="wb-art">${art}</span>`;
    this.host.appendChild(el);
    let lbl: HTMLElement | null = null;
    if (name) {
      lbl = document.createElement('span');
      lbl.className = 'wb-lbl mono';
      if (res?.no) {
        const no = document.createElement('b');
        no.textContent = String(res.no).padStart(3, '0');
        lbl.append(no, document.createTextNode(name));
      } else lbl.textContent = name;
      this.host.appendChild(lbl);
    }
    const b: Body = {
      uid: UID++, itemId, material, props, r, mass: props.mass,
      x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, angle: o.angle ?? (Math.random() - 0.5) * 0.5, av: 0,
      z: o.z ?? 0, vz: 0, sx: 1, sy: 1, q: 0, qv: 0, gx: 0, gy: 0, lbl, name, ox: 0, oy: 0,
      heat: 0, glow: 0, held: false, locked: false, solid: true, grabbable: true,
      prepared: new Set(), zone: null, el, temp: false, tx: x, ty: y, targetAngle: 0, rest: 0,
      age: o.pop === false ? 1 : 0, layer: 0, kick: 0, kickT: 0, outside: false, outT: 0,
      env: { chars: !!res?.phys?.chars, soaks: !!res?.phys?.soaks }, warm: 0, wet: 0, scorch: 0,
      brittle: !!res?.phys?.properties?.includes('brittle'), wear: 0,
    };
    b.targetAngle = b.angle;
    this.bodies.push(b);
    this.clampIn(b);
    this.paint(b);
    return b;
  }

  remove(b: Body, quiet = false) {
    const i = this.bodies.indexOf(b);
    if (i < 0) return;
    this.bodies.splice(i, 1);
    b.held = false;
    const done = () => { b.el.remove(); b.lbl?.remove(); };
    if (quiet) { b.el.classList.add('wb-out'); b.lbl?.classList.add('wb-out'); window.setTimeout(done, 240); } else done();
    for (const k of [...this.touch.keys()]) if (k.split('|').includes(String(b.uid))) this.touch.delete(k);
  }

  clear() { [...this.bodies].forEach(b => this.remove(b)); this.touch.clear(); this.latched.clear(); }

  bodyAt(x: number, y: number, only?: (b: Body) => boolean): Body | null {
    let best: Body | null = null, bd = Infinity;
    for (const b of this.bodies) {
      if (!b.grabbable || b.outside || (only && !only(b))) continue;
      const d = Math.hypot(x - b.x, y - (b.y - b.z));
      if (d < b.r * 1.25 && d < bd) { best = b; bd = d; }
    }
    return best;
  }

  /* ── holding ──────────────────────────────────────────────────────── */

  grab(b: Body, px: number, py: number) {
    b.held = true;
    b.gx = b.x - px; b.gy = b.y - py;
    b.tx = b.x; b.ty = b.y;
    b.vx *= 0.3; b.vy *= 0.3;
    b.rest = 0;
    b.targetAngle = b.angle;
    // the one just picked up rides on top
    this.bodies.sort((p, q) => (p === b ? 1 : q === b ? -1 : 0));
    this.bodies.forEach((q, i) => { q.layer = i; });
    b.el.classList.add('wb-held');
  }

  dragTo(b: Body, px: number, py: number) {
    b.tx = px + b.gx; b.ty = py + b.gy;
  }

  /** Let go, keeping the pointer's speed so a flick throws. */
  release(b: Body, vx = 0, vy = 0) {
    b.held = false;
    b.el.classList.remove('wb-held');
    const cap = 1400 / Math.max(0.8, b.mass * 0.6);
    const s = Math.hypot(vx, vy);
    const k = s > cap ? cap / s : 1;
    b.vx = vx * k; b.vy = vy * k;
    b.rest = 0;
  }

  rotate(b: Body, by: number) { b.targetAngle += by; b.av += by * 4; }

  /* ── stepping ─────────────────────────────────────────────────────── */

  /** True while anything needs the next frame. */
  get busy(): boolean {
    for (const b of this.bodies) {
      if (b.held || b.z > 0.1 || b.age < 1 || b.q * b.q > 1e-4 || Math.abs(b.qv) > 0.01
        || Math.abs(b.vx) + Math.abs(b.vy) > 4 || Math.abs(b.av) > 0.03 || b.locked || b.outside
        || Math.abs(b.ox) + Math.abs(b.oy) > 0.05 || Math.abs(b.targetAngle - b.angle) > 0.01) return true;
      // the environment is still working on it (warming, cooling, soaking, drying)
      if ((b.warm > 0.004 && b.warm < 0.996) || (b.wet > 0.004 && b.wet < 0.996) || this.envMoving(b)) return true;
    }
    return false;
  }

  /** A flame or water is close enough that a fresh ramp is under way. */
  private envMoving(b: Body): boolean {
    if (b.temp || b.outside) return false;
    return (this.nearFire(b) && b.warm < 0.996) || (b.env.chars && b.warm > 0.99 && b.scorch < 1) || (this.nearWater(b) && b.env.soaks && b.wet < 0.996);
  }
  private nearFire(b: Body): boolean {
    for (const o of this.bodies) if (o !== b && o.material === 'fire' && !o.temp && !o.outside && Math.hypot(o.x - b.x, o.y - b.y) < (o.r + b.r) * 1.55) return true;
    return b.zone === 'hearth' && b.material !== 'fire' && b.material !== 'idea' && b.material !== 'signal' && b.material !== 'energy';
  }
  private nearWater(b: Body): boolean {
    for (const o of this.bodies) if (o !== b && o.material === 'liquid' && !o.temp && !o.outside && Math.hypot(o.x - b.x, o.y - b.y) < (o.r + b.r) * 1.35) return true;
    return b.zone === 'basin';
  }

  step(dt: number) {
    dt = Math.min(dt, 1 / 30);
    const bodies = this.bodies;

    for (const b of bodies) {
      b.age = Math.min(1, b.age + dt * 4);
      b.kickT = Math.max(0, b.kickT - dt);

      if (b.outside) {
        // through the wall: a short, natural overshoot before it is sent home
        const k = Math.exp(-2.6 * dt);
        b.vx *= k; b.vy *= k;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.angle += b.av * dt + b.vx * 0.0004;
        b.outT += dt;
        const a = this.area;
        const beyond = Math.max(a.x - b.x, b.x - (a.x + a.w), a.y - b.y, b.y - (a.y + a.h));
        if (b.outT > 0.42 || beyond > b.r * 1.9) {
          b.outside = false;
          this.hooks.onKnockOut?.(b, b.vx, b.vy);
        }
        continue;
      }

      // zone effects: the same item behaves differently in the fire, the water, on the anvil
      const z = this.zoneAt(b.x, b.y);
      const prev = this.wasIn.get(b.uid) ?? null;
      if (z !== prev) { this.wasIn.set(b.uid, z); b.zone = z; if (!b.temp) this.hooks.onZone(b, prev, z); }
      if (z === 'hearth' && b.material !== 'idea' && b.material !== 'signal') b.heat = Math.min(1, b.heat + dt * 0.35);
      else b.heat = Math.max(0, b.heat - dt * 0.22);

      // deformation spring
      b.qv += (-260 * b.q - 22 * b.qv) * dt;
      b.q += b.qv * dt;
      b.sx = 1 + b.q * 0.7; b.sy = 1 - b.q;
      b.ox *= Math.exp(-14 * dt); b.oy *= Math.exp(-14 * dt);

      if (b.locked) continue;

      if (b.held) {
        // spring toward the pointer; heavier bodies are softer, so they lag
        const w0 = 24 / (0.7 + 0.32 * b.mass);
        const ax = w0 * w0 * (b.tx - b.x) - 2 * w0 * b.vx;
        const ay = w0 * w0 * (b.ty - b.y) - 2 * w0 * b.vy;
        b.vx += ax * dt; b.vy += ay * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.z += (LIFT - b.z) * Math.min(1, dt * 16);
        b.vz = 0;
        // lean into the motion, then settle to the angle the player chose
        const lean = Math.max(-0.4, Math.min(0.4, b.vx * 0.0006 / (0.5 + b.mass * 0.3)));
        const want = b.targetAngle + lean;
        b.av += ((want - b.angle) * 90 - b.av * 12) * dt;
        b.angle += b.av * dt;
      } else if (b.solid) {
        if (b.z > 0 || b.vz !== 0) {
          b.vz -= G * dt; b.z += b.vz * dt;
          if (b.z <= 0) {
            const s = -b.vz; b.z = 0; b.vz = 0;
            if (s > 60) {
              b.q = Math.max(b.q, Math.min(0.32, s / 2400 + b.props.squash)); this.hooks.onLand(b, s); this.landed(b, s);
              this.wearHit(b, s);
              if (b.material === 'liquid' && s > 120 && !b.temp) this.splash(b);
            }
          }
        }
        const zoneDrag = z === 'basin' ? 2.4 : z === 'anvil' ? 1.2 : 1;
        const k = Math.exp(-b.props.drag * zoneDrag / (0.6 + 0.4 * b.mass) * dt);
        b.vx *= k; b.vy *= k;
        b.x += b.vx * dt; b.y += b.vy * dt;
        // settle rotation toward what the player last set, with a little give
        b.av += ((b.targetAngle - b.angle) * 26 - b.av * 9) * dt;
        b.angle += b.av * dt;
        this.walls(b);
        const sp = Math.abs(b.vx) + Math.abs(b.vy);
        b.rest = sp < 6 ? b.rest + dt : 0;
        if (sp < 3) { b.vx = 0; b.vy = 0; }
      } else {
        // a piece that only sits where it is put (parts, or bodies set against each other):
        // it settles onto the bench and turns to the angle it was given
        b.z += (0 - b.z) * Math.min(1, dt * 14);
        b.vx = b.vy = 0;
        b.av += ((b.targetAngle - b.angle) * 26 - b.av * 9) * dt;
        b.angle += b.av * dt;
      }
    }

    this.collide(dt);
    this.tickTouch(dt);
    this.environment(dt);
  }

  /** Fire warms what is beside it and, given time, scorches what burns; water soaks what drinks it; both fade
   *  when the source goes. Cheap: a handful of bodies, and nothing at all when there is no fire or water. */
  private environment(dt: number) {
    let any = false;
    for (const o of this.bodies) if (!o.temp && (o.material === 'fire' || o.material === 'liquid')) { any = true; break; }
    for (const b of this.bodies) {
      if (b.temp || b.outside) continue;
      if (!any && b.zone === null && b.warm === 0 && b.wet === 0) continue;
      const isSource = b.material === 'fire' || b.material === 'liquid';
      const warmTo = !isSource && !b.held && this.nearFire(b) ? 1 : 0;
      const wetTo = b.env.soaks && !b.held && this.nearWater(b) ? 1 : 0;
      b.warm += (warmTo - b.warm) * Math.min(1, dt * (warmTo ? 0.9 : 0.6));
      b.wet += (wetTo - b.wet) * Math.min(1, dt * (wetTo ? 0.8 : 0.25));
      if (b.warm < 0.004) b.warm = 0; else if (b.warm > 0.996) b.warm = 1;
      if (b.wet < 0.004) b.wet = 0; else if (b.wet > 0.996) b.wet = 1;
      // a flame beside a thing that burns, for long enough, leaves a mark that stays; water takes it out of the heat
      if (b.env.chars && b.warm > 0.99 && b.wet < 0.2) b.scorch = Math.min(1, b.scorch + dt * 0.18);
      if (b.warm > 0.02 && !b.held) b.heat = Math.max(b.heat, b.warm * 0.6);
    }
  }

  /** A ripple where a liquid lands: a ring that grows and goes. DOM only, removed when done. */
  private splash(b: Body) {
    const el = document.createElement('i');
    el.className = 'wb-ripple';
    el.style.left = `${b.x}px`; el.style.top = `${b.y}px`;
    el.style.width = el.style.height = `${b.r * 3.2}px`;
    this.host.appendChild(el);
    window.setTimeout(() => el.remove(), 760);
  }

  private walls(b: Body) {
    const p = b.r * 0.85, a = this.area;
    const x0 = a.x + p, x1 = a.x + a.w - p, y0 = a.y + p, y1 = a.y + a.h - p;
    // a hard knock, arriving at speed: it goes through instead of bouncing
    const need = knockSpeed(b.material);
    if (b.kickT > 0 && !b.temp) {
      const out = (b.x < x0 && -b.vx >= need) || (b.x > x1 && b.vx >= need) || (b.y < y0 && -b.vy >= need) || (b.y > y1 && b.vy >= need);
      if (out) { b.outside = true; b.outT = 0; b.kickT = 0; this.hooks.onWall(b, Math.hypot(b.vx, b.vy)); return; }
    }
    let hit = 0;
    if (b.x < x0) { b.x = x0; if (b.vx < 0) { hit = Math.max(hit, -b.vx); b.vx = -b.vx * (0.25 + b.props.bounce * 0.7); } }
    if (b.x > x1) { b.x = x1; if (b.vx > 0) { hit = Math.max(hit, b.vx); b.vx = -b.vx * (0.25 + b.props.bounce * 0.7); } }
    if (b.y < y0) { b.y = y0; if (b.vy < 0) { hit = Math.max(hit, -b.vy); b.vy = -b.vy * (0.25 + b.props.bounce * 0.7); } }
    if (b.y > y1) { b.y = y1; if (b.vy > 0) { hit = Math.max(hit, b.vy); b.vy = -b.vy * (0.25 + b.props.bounce * 0.7); } }
    if (hit > 80) { b.q = Math.max(b.q, Math.min(0.28, hit / 3200 + b.props.squash)); this.hooks.onWall(b, hit); this.wearHit(b, hit); }
  }

  /** A hard knock against something brittle leaves a lasting mark — cosmetic only (never a stat,
   *  never blocks an action), and only on materials physics.ts calls brittle; everything else just
   *  squashes (`q`) and springs back. Never decays: once cracked, it stays cracked this session. */
  private wearHit(b: Body, strength: number) {
    if (!b.brittle || b.temp) return;
    const add = Math.max(0, (strength - 500) / 6000);
    if (add > 0) b.wear = Math.min(1, b.wear + add);
  }

  /** A body just came down: if it landed on another, that is a drop. */
  private landed(b: Body, speed: number) {
    for (const o of this.bodies) {
      if (o === b || !o.solid || o.locked && !o.temp) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < (o.r + b.r) * 0.86) {
        const rm = (b.mass * o.mass) / (b.mass + o.mass);
        this.hooks.onImpact({ a: b, b: o, speed, force: speed * rm * 0.0022 * 1.4, fromDrop: true });
      }
    }
  }

  private collide(dt: number) {
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (!a.solid || a.temp || a.outside) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (!b.solid || b.temp || b.outside) continue;
        if (a.locked && b.locked) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.r + b.r) * 0.86;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        const pen = min - d;
        // held bodies shove as if heavier; locked ones do not move
        const ma = a.locked ? 1e6 : a.held ? a.mass * 3 : a.mass;
        const mb = b.locked ? 1e6 : b.held ? b.mass * 3 : b.mass;
        const ia = 1 / ma, ib = 1 / mb;
        const tot = ia + ib;
        if (!a.locked) { a.x -= nx * pen * (ia / tot); a.y -= ny * pen * (ia / tot); }
        if (!b.locked) { b.x += nx * pen * (ib / tot); b.y += ny * pen * (ib / tot); }
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const e = Math.min(a.props.bounce, b.props.bounce) * 0.8 + 0.06;
          const jimp = -(1 + e) * vn / tot;
          if (!a.locked) { a.vx -= jimp * ia * nx; a.vy -= jimp * ia * ny; a.av += (Math.random() - 0.5) * jimp * ia * 0.002; }
          if (!b.locked) { b.vx += jimp * ib * nx; b.vy += jimp * ib * ny; b.av += (Math.random() - 0.5) * jimp * ib * 0.002; }
          const speed = -vn;
          if (speed > 60) {
            a.q = Math.max(a.q, Math.min(0.3, speed / 2600 + a.props.squash * 0.8));
            b.q = Math.max(b.q, Math.min(0.3, speed / 2600 + b.props.squash * 0.8));
            this.wearHit(a, speed); this.wearHit(b, speed);
            const rm = (a.mass * b.mass) / (a.mass + b.mass);
            const drop = Math.max(0, (a.z > 2 ? 1 : 0) + (b.z > 2 ? 1 : 0)) > 0;
            if (speed > 200) {
              // remember the knock: a body carried into a wall by it can be sent through
              a.kick = b.kick = Math.max(a.kick, b.kick, speed); a.kickT = b.kickT = 0.9;
            }
            this.hooks.onImpact({ a, b, speed, force: speed * rm * 0.0022, fromDrop: drop });
          }
        }
      }
    }
    void dt;
  }

  private tickTouch(dt: number) {
    const seen = new Set<string>();
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (!a.solid || a.temp || a.outside) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (!b.solid || b.temp || b.outside) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < (a.r + b.r) * 0.86 + 4) {
          const k = a.uid < b.uid ? `${a.uid}|${b.uid}` : `${b.uid}|${a.uid}`;
          seen.add(k);
          this.touch.set(k, (this.touch.get(k) ?? 0) + dt);
        }
      }
    }
    for (const k of [...this.touch.keys()]) {
      if (!seen.has(k)) { this.touch.delete(k); this.latched.delete(k); }
    }
  }

  /** Pairs that have been touching, with how long. Pairs already answered are left out unless asked for. */
  touching(withLatched = false): { a: Body; b: Body; t: number; key: string }[] {
    const out: { a: Body; b: Body; t: number; key: string }[] = [];
    for (const [k, t] of this.touch) {
      const [ua, ub] = k.split('|').map(Number);
      const a = this.bodies.find(q => q.uid === ua), b = this.bodies.find(q => q.uid === ub);
      if (a && b && (withLatched || !this.latched.has(k))) out.push({ a, b, t, key: k });
    }
    return out;
  }

  /** Where a soft ground mark sits, in world px. Processing to the left, assembly beside it. */
  patch(id: PatchId): Patch {
    const a = this.area;
    if (id === 'processing') {
      const rx = Math.max(64, Math.min(150, a.w * 0.15)), ry = Math.max(58, Math.min(120, a.h * 0.2));
      return { cx: a.x + Math.max(rx + 8, a.w * 0.2), cy: a.y + a.h * 0.6, rx, ry };
    }
    const rx = Math.max(90, Math.min(260, a.w * 0.26)), ry = Math.max(70, Math.min(170, a.h * 0.27));
    return { cx: a.x + a.w * 0.58, cy: a.y + a.h * 0.56, rx, ry };
  }

  inPatch(b: { x: number; y: number }, id: PatchId): boolean {
    const p = this.patch(id);
    const nx = (b.x - p.cx) / p.rx, ny = (b.y - p.cy) / p.ry;
    return nx * nx + ny * ny <= 1;
  }
  /** A pair the game has already answered: leave it alone until they part. */
  latch(key: string) { this.latched.add(key); }
  unlatchAll() { this.latched.clear(); }
  pairKeyOf(a: Body, b: Body) { return a.uid < b.uid ? `${a.uid}|${b.uid}` : `${b.uid}|${a.uid}`; }

  /** Push two bodies apart, as a refusal. */
  repel(a: Body, b: Body, strength = 260) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const ia = 1 / a.mass, ib = 1 / b.mass, t = ia + ib;
    a.vx -= nx * strength * ia / t * 0.6; a.vy -= ny * strength * ia / t * 0.6;
    b.vx += nx * strength * ib / t * 0.6; b.vy += ny * strength * ib / t * 0.6;
    a.q = Math.max(a.q, 0.16); b.q = Math.max(b.q, 0.16);
  }

  /** Move a body somewhere with a soft spring, ignoring collisions. Used by sessions. */
  glide(b: Body, x: number, y: number, k = 14) {
    const f = Math.min(1, k * 0.016);
    b.x += (x - b.x) * f; b.y += (y - b.y) * f;
    b.vx = 0; b.vy = 0;
  }

  /* ── drawing ──────────────────────────────────────────────────────── */

  paint(b: Body) {
    const pop = b.age < 1 ? 0.55 + 0.45 * easeOutBack(b.age) : 1;
    const lift = b.z;
    const s = pop * (1 + lift * 0.0035);
    const x = b.x + b.ox, y = b.y + b.oy - lift;
    const st = b.el.style;
    st.transform = `translate3d(${(x - b.r).toFixed(2)}px, ${(y - b.r).toFixed(2)}px, 0) rotate(${b.angle.toFixed(4)}rad) scale(${(s * b.sx).toFixed(3)}, ${(s * b.sy).toFixed(3)})`;
    st.zIndex = String(10 + b.layer + (b.held ? 50 : 0) + (b.temp ? 20 : 0));
    st.setProperty('--z', lift.toFixed(2));
    st.setProperty('--heat', b.heat.toFixed(3));
    st.setProperty('--glow', b.glow.toFixed(3));
    if (b.warm !== 0 || b.el.hasAttribute('data-warm')) {
      st.setProperty('--warm', b.warm.toFixed(3));
      if (b.warm > 0.4) b.el.setAttribute('data-warm', ''); else b.el.removeAttribute('data-warm');
    }
    if (b.wet !== 0 || b.el.hasAttribute('data-wet')) {
      st.setProperty('--wet', b.wet.toFixed(3));
      if (b.wet > 0.4) b.el.setAttribute('data-wet', ''); else b.el.removeAttribute('data-wet');
    }
    if (b.scorch > 0 || b.el.hasAttribute('data-scorch')) {
      st.setProperty('--scorch', b.scorch.toFixed(3));
      if (b.scorch > 0.35) b.el.setAttribute('data-scorch', ''); else b.el.removeAttribute('data-scorch');
    }
    if (b.wear > 0) {
      st.setProperty('--wear', b.wear.toFixed(3));
      if (b.wear >= 0.85) b.el.setAttribute('data-damage', 'broken');
      else if (b.wear >= 0.35) b.el.setAttribute('data-damage', 'cracked');
    }
    if (b.lbl) {
      b.lbl.style.transform = `translate3d(${(b.x + b.ox).toFixed(1)}px, ${(b.y + b.oy + b.r * 0.92).toFixed(1)}px, 0) translateX(-50%)`;
      b.lbl.style.zIndex = st.zIndex;
    }
  }

  paintAll() { for (const b of this.bodies) this.paint(b); }
}

function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
