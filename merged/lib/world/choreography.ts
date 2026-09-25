import type { Quality } from '../perf';
import {
  angleOf, centroid, clamp, easeInOutCubic, easeInOutSine, easeOutCubic, lerp, slerpLatLon, wrapLon,
  type Camera, type LatLon,
} from './geo';
import type { Precision } from './types';

/* ============================================================================
   CHOREOGRAPHY — what the camera and the picture do, and when.

   Pure functions of time. `buildPlan` turns "where from, where to, how heavy"
   into a Plan (durations and camera waypoints); `frameAt(plan, t)` says what
   the picture looks like `t` milliseconds in. The globe component only draws a
   Frame, so every timing rule lives here where it can be tested.

   A major invention, the full version (Tier A), about 3–5 s (median 4 s):

     enter   the globe fades up, already turned to the PREVIOUS major's place
     linger  a beat there, so the eye finds the last landmark
     travel  the globe turns to the new place along the great circle, pulling
             back for a long journey; a thin arc follows           0.65–1.6 s
     zoom    the camera settles in on the place                     0.7–1.1 s
     reveal  the marker pulses, the card names it, other early centres appear
     exit    fade back to the bench

   Tier B is the same in about two thirds of the time (2–3.5 s). A nearby place (a few
   hundred km) is a short regional shift instead of a journey. The first major
   ever starts from a neutral, whole-world view. With reduced motion the
   camera never travels: the globe fades up already on the place.
   ========================================================================== */

export type Motion = 'full' | 'reduced';

/** A place the camera can rest on, and how exactly it is known. */
export interface Anchor extends LatLon { precision: Precision }

export interface MajorPlanInput {
  kind: 'major';
  tier: 'A' | 'B';
  /** The previous major's place; null for the first major ever (a neutral view of the world). */
  from: Anchor | null;
  to: Anchor;
  /** Other early centres of the same invention (agriculture arose in several places): the camera settles where they can be seen too. */
  others?: LatLon[];
  motion: Motion;
  quality: Quality;
  /** Looking again from the archive: no arc, a shorter stay. */
  inspect?: boolean;
  /** A screen where the card sits under the globe (a phone): lifts the picture a little more. */
  narrow?: boolean;
}

export interface EraPlanInput {
  kind: 'era';
  /** Where the era's major inventions belong, in the order they were found (unlocated ones left out). */
  points: LatLon[];
  motion: Motion;
  quality: Quality;
  narrow?: boolean;
}

export type PlanInput = MajorPlanInput | EraPlanInput;
export type PhaseName = 'enter' | 'linger' | 'travel' | 'zoom' | 'reveal' | 'exit'
  | 'era_zoomout' | 'era_light' | 'era_title';

export interface Segment { name: PhaseName; start: number; end: number }

export interface Plan {
  kind: 'major' | 'era';
  input: PlanInput;
  segments: Segment[];
  total: number;
  /** Input is ignored before this many ms, so a click that started the moment cannot end it. */
  skipAfter: number;
  camStart: Camera;
  camMid: Camera;
  camEnd: Camera;
  /** Central angle of the journey, radians. */
  angle: number;
  /** Which kind of move: a journey across the globe, a short regional shift, or none. */
  move: 'journey' | 'shift' | 'none';
  /** A place with no single location: the camera rests on the whole world. */
  unlocated: boolean;
  /** Milliseconds each marker of an era plan takes to light. */
  lightEach: number;
  /** Whether the thin arc from the last place to the new one is drawn. */
  arcOn: boolean;
}

/* ── tuning ─────────────────────────────────────────────────────────── */

/** Disc diameter as a fraction of the short screen side, per how exactly a place is known. */
export const ZOOM: Record<Precision, number> = { site: 2.05, area: 1.8, region: 1.4, broad: 1.08, unlocated: 0.8 };
export const ZOOM_WORLD = 0.8;
/** The view before any major has been found: turned toward the Atlantic, so the first journey has somewhere to go. */
export const NEUTRAL: LatLon = { lat: 18, lon: 12 };
/** Below this central angle (~1,300 km) a move is a short regional shift, not a journey. */
export const NEAR_ANGLE = 0.2;

const T = {
  A: { enter: 350, linger: 150, travelMin: 650, travelMax: 1600, zoomMin: 700, zoomMax: 1100, hold: 1500, exit: 350, skipAfter: 1500 },
  B: { enter: 250, linger: 0, travelMin: 450, travelMax: 1050, zoomMin: 500, zoomMax: 800, hold: 1150, exit: 300, skipAfter: 1200 },
} as const;

/** The seconds a moment is held before the camera takes off, i.e. the pause after the craft. */
export function startDelay(quality: Quality, reduced: boolean): number {
  if (reduced) return 200;
  return quality === 'low' ? 250 : 350;
}

const shiftFor = (narrow?: boolean) => (narrow ? 0.13 : 0.07);

function zoomFor(a: Anchor): number { return ZOOM[a.precision]; }

/** Build the plan for a moment. Pure. */
export function buildPlan(input: PlanInput): Plan {
  return input.kind === 'major' ? majorPlan(input) : eraPlan(input);
}

function majorPlan(inp: MajorPlanInput): Plan {
  const { to, from } = inp;
  const unlocated = to.precision === 'unlocated';
  const reduced = inp.motion === 'reduced';
  const tierKey = inp.tier === 'B' || inp.inspect ? 'B' : 'A';
  const k = T[tierKey];
  const shift = unlocated ? 0 : shiftFor(inp.narrow);
  let zTo = unlocated ? ZOOM_WORLD : zoomFor(to);
  let target: LatLon = unlocated ? { lat: NEUTRAL.lat, lon: to.lon || NEUTRAL.lon } : { lat: to.lat, lon: to.lon };
  // several early centres: pull back and lean toward them so they are in the picture, while the main place stays near the middle
  if (!unlocated && inp.others?.length) {
    const near = inp.others.filter(o => angleOf(target, o) < 1.9);
    if (near.length) {
      const far = Math.max(...near.map(o => angleOf(target, o)));
      const mid = centroid([target, ...near]);
      if (mid && far > 0.3) {
        target = slerpLatLon(target, mid, 0.45);
        zTo = Math.min(zTo, clamp(1.75 - 0.85 * far, 0.86, zTo));
      }
    }
  }

  // where the camera starts: the last major's place, or a neutral world turned a little west of the new place
  const startAt: LatLon = from && from.precision !== 'unlocated'
    ? { lat: from.lat, lon: from.lon }
    : { lat: NEUTRAL.lat, lon: wrapLon(target.lon - (unlocated ? 40 : 75)) };
  const zFrom = from && from.precision !== 'unlocated' ? zoomFor(from) : ZOOM_WORLD;

  const angle = angleOf(startAt, target);
  const move: Plan['move'] = reduced ? 'none' : angle < 0.012 ? 'none' : angle < NEAR_ANGLE ? 'shift' : 'journey';

  // how far the camera pulls back on a long journey
  const far = clamp(angle / 1.6, 0, 1);
  const zMid = move === 'journey' ? lerp(Math.min(zFrom, zTo, 1.2), 0.85, far) : Math.min(zFrom, zTo);

  const travel = move === 'none' ? 0 : move === 'shift' ? Math.round(k.travelMin * 0.85)
    : Math.round(clamp(k.travelMin + (k.travelMax - k.travelMin) * (angle / Math.PI), k.travelMin, k.travelMax));
  const zoomMs = reduced ? 0 : Math.round(clamp(k.zoomMin + (k.zoomMax - k.zoomMin) * Math.abs(Math.log(zTo / Math.max(0.3, zMid)) / Math.log(3)), k.zoomMin, k.zoomMax));
  const enter = reduced ? 250 : k.enter;
  const linger = reduced || !from ? 0 : k.linger;
  const hold = reduced ? 2200 : inp.inspect ? 1100 : k.hold;
  const exit = reduced ? 250 : k.exit;

  const segs: Segment[] = [];
  let at = 0;
  const push = (name: PhaseName, d: number) => { if (d > 0) { segs.push({ name, start: at, end: at + d }); at += d; } };
  push('enter', enter); push('linger', linger); push('travel', travel); push('zoom', zoomMs); push('reveal', hold); push('exit', exit);

  const camStart: Camera = { lat: startAt.lat, lon: startAt.lon, zoom: reduced ? zTo : zFrom, shift: 0 };
  const camMid: Camera = { lat: target.lat, lon: target.lon, zoom: reduced ? zTo : zMid, shift: 0 };
  const camEnd: Camera = { lat: target.lat, lon: target.lon, zoom: zTo, shift };
  if (reduced) { camStart.lat = target.lat; camStart.lon = target.lon; camStart.shift = shift; camMid.shift = shift; }

  return {
    kind: 'major', input: inp, segments: segs, total: at, skipAfter: k.skipAfter,
    camStart, camMid, camEnd, angle, move, unlocated, lightEach: 0, arcOn: move === 'journey' && !inp.inspect && !unlocated,
  };
}

function eraPlan(inp: EraPlanInput): Plan {
  const reduced = inp.motion === 'reduced';
  const centre = centroid(inp.points) ?? NEUTRAL;
  const n = Math.max(1, inp.points.length);
  const lightEach = reduced ? 0 : Math.round(clamp(1500 / n, 60, 160));
  const segs: Segment[] = [];
  let at = 0;
  const push = (name: PhaseName, d: number) => { if (d > 0) { segs.push({ name, start: at, end: at + d }); at += d; } };
  push('enter', reduced ? 250 : 400);
  push('era_zoomout', reduced ? 0 : 800);
  push('era_light', reduced ? 0 : lightEach * n + 300);
  push('era_title', reduced ? 2600 : 2100);
  push('exit', reduced ? 250 : 450);
  const view: LatLon = { lat: clamp(centre.lat * 0.6 + 8, -30, 45), lon: centre.lon };
  return {
    kind: 'era', input: inp, segments: segs, total: at, skipAfter: 1500,
    camStart: { lat: view.lat, lon: view.lon, zoom: reduced ? ZOOM_WORLD : 1.15, shift: 0 },
    camMid: { lat: view.lat, lon: view.lon, zoom: ZOOM_WORLD, shift: shiftFor(inp.narrow) },
    camEnd: { lat: view.lat, lon: view.lon, zoom: ZOOM_WORLD, shift: shiftFor(inp.narrow) },
    angle: 0, move: 'none', unlocated: false, lightEach, arcOn: false,
  };
}

/* ── one frame ──────────────────────────────────────────────────────── */

export interface Frame {
  /** The plan time this frame is for, ms. */
  t: number;
  phase: PhaseName;
  cam: Camera;
  /** The dark backdrop and the globe fade together: 0 → 1 in, 1 → 0 out. */
  veil: number;
  /** 0–1 how much of the arc from the last place to the new one is drawn (−1: no arc in this plan). */
  arc: number;
  /** The arc's own alpha (it fades once the journey is over). */
  arcAlpha: number;
  /** Seconds since the marker began to pulse, or −1 before it does. */
  pulse: number;
  /** 0–1 reveal of the quieter markers for other early centres. */
  extras: number;
  /** 0–1 the card. */
  card: number;
  /** The previous place's marker: 1 while the camera leaves it, dimmer once it has arrived. */
  prev: number;
  /** Era plans: how many of the era's markers are lit (fractional), and the title's alpha. */
  light: number;
  title: number;
  /** All the discovered majors' quiet dots. */
  dots: number;
  done: boolean;
}

const seg = (plan: Plan, name: PhaseName) => plan.segments.find(s => s.name === name);
const prog = (t: number, s: Segment | undefined) => (s ? clamp((t - s.start) / Math.max(1, s.end - s.start), 0, 1) : t < 0 ? 0 : 1);

const lerpCam = (a: Camera, b: Camera, t: number): Camera => ({
  lat: lerp(a.lat, b.lat, t), lon: a.lon + wrapDelta(a.lon, b.lon) * t,
  zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), t)), shift: lerp(a.shift ?? 0, b.shift ?? 0, t),
});
const wrapDelta = (a: number, b: number) => wrapLon(b - a);

export function frameAt(plan: Plan, tRaw: number): Frame {
  const t = clamp(tRaw, 0, plan.total);
  const enter = seg(plan, 'enter'), exit = seg(plan, 'exit');
  const veilIn = easeOutCubic(prog(t, enter));
  const veilOut = 1 - easeInOutSine(prog(t, exit));
  const veil = t >= (exit?.start ?? Infinity) ? veilOut : veilIn;
  const phase = (plan.segments.find(s => t >= s.start && t < s.end) ?? plan.segments[plan.segments.length - 1]).name;
  const done = tRaw >= plan.total;
  const base: Frame = {
    t, phase, cam: plan.camStart, veil, arc: -1, arcAlpha: 0, pulse: -1, extras: 0, card: 0, prev: 1, light: 0, title: 0, dots: veil, done,
  };
  return plan.kind === 'major' ? majorFrame(plan, t, base) : eraFrame(plan, t, base);
}

function majorFrame(plan: Plan, t: number, f: Frame): Frame {
  const travel = seg(plan, 'travel'), zoom = seg(plan, 'zoom'), reveal = seg(plan, 'reveal'), exit = seg(plan, 'exit');
  const reduced = plan.input.kind === 'major' && plan.input.motion === 'reduced';
  let cam: Camera;
  if (reduced) {
    cam = plan.camEnd;
  } else if (travel && t < travel.end) {
    const p = prog(t, travel);
    const e = plan.move === 'shift' ? easeInOutSine(p) : easeInOutCubic(p);
    const centre = slerpLatLon(plan.camStart, plan.camMid, e);
    const zoomLevel = Math.exp(lerp(Math.log(plan.camStart.zoom), Math.log(plan.camMid.zoom), easeInOutSine(p)));
    cam = { lat: centre.lat, lon: centre.lon, zoom: zoomLevel, shift: 0 };
    if (t >= travel.start) f.arc = plan.arcOn ? e : -1;
  } else if (zoom && t < zoom.end) {
    const e = easeOutCubic(prog(t, zoom));
    cam = lerpCam(plan.camMid, plan.camEnd, e);
    f.arc = plan.arcOn ? 1 : -1;
  } else {
    cam = plan.camEnd;
    f.arc = plan.arcOn ? 1 : -1;
  }
  f.cam = cam;

  const arrived = (zoom ? zoom.start : reveal ? reveal.start : plan.total) + (zoom ? (zoom.end - zoom.start) * 0.5 : 0);
  if (reduced || t >= arrived) f.pulse = Math.max(0, (t - (reduced ? (reveal?.start ?? 0) : arrived)) / 1000);
  const cardAt = reduced ? (reveal?.start ?? 0) : arrived + (zoom ? (zoom.end - zoom.start) * 0.1 : 0);
  f.card = easeOutCubic(clamp((t - cardAt) / 380, 0, 1));
  f.extras = easeOutCubic(clamp((t - (arrived + 120)) / 520, 0, 1));
  if (exit && t >= exit.start) f.card *= 1 - easeInOutSine(prog(t, exit));
  f.arcAlpha = f.arc < 0 ? 0 : clamp(1 - (t - (travel?.end ?? 0)) / 900, 0, 1);
  f.prev = reduced ? 0.4 : t < (travel?.end ?? 0) ? 1 : clamp(1 - (t - (travel?.end ?? 0)) / 700, 0.4, 1);
  return f;
}

function eraFrame(plan: Plan, t: number, f: Frame): Frame {
  const zo = seg(plan, 'era_zoomout'), light = seg(plan, 'era_light'), title = seg(plan, 'era_title'), exit = seg(plan, 'exit');
  const drift = (t / Math.max(1, plan.total)) * 18;    // a slow turn under the whole moment
  const reduced = plan.input.kind === 'era' && plan.input.motion === 'reduced';
  const base = zo && !reduced ? lerpCam(plan.camStart, plan.camMid, easeInOutCubic(prog(t, zo))) : plan.camMid;
  f.cam = reduced ? plan.camMid : { ...base, lon: wrapLon(base.lon + drift) };
  const n = plan.input.kind === 'era' ? plan.input.points.length : 0;
  if (light && plan.lightEach > 0) f.light = clamp((t - light.start) / plan.lightEach, 0, n);
  else if (title || reduced) f.light = n;
  if (t >= (title?.start ?? Infinity) || reduced) f.light = n;
  f.title = easeOutCubic(clamp((t - (title?.start ?? plan.total)) / 450, 0, 1));
  if (exit && t >= exit.start) f.title *= 1 - easeInOutSine(prog(t, exit));
  f.pulse = f.light >= n && n > 0 ? Math.max(0, (t - (title?.start ?? 0)) / 1000) : -1;
  f.prev = 0;
  return f;
}
