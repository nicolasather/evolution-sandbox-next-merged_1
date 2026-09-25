/* ============================================================================
   GEO — the small amount of spherical geometry the globe needs. Pure, no DOM.

   Conventions (the WebGL shader in components/world uses exactly these):
     unit sphere, y = north.   x = cos(lat)·sin(lon),  y = sin(lat),  z = cos(lat)·cos(lon)
     longitude 0 faces +z, longitude +90° (east) faces +x.
   The camera looks at the centre of the globe from `dist` along +z, after the
   globe has been turned so that (lat, lon) faces it with north up.
   ========================================================================== */

export type Vec3 = [number, number, number];
export interface LatLon { lat: number; lon: number }

/** The camera: what it looks at, and how close (zoom = globe disc diameter as a fraction of the short screen side).
 *  `shift` lifts the whole picture by that fraction of the screen height, leaving room for a card below. */
export interface Camera extends LatLon { zoom: number; shift?: number }
export interface Viewport { w: number; h: number }

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
/** Vertical field of view of the globe camera. */
export const FOV = 30 * D2R;
export const TAN_HALF = Math.tan(FOV / 2);
export const EARTH_KM = 6371;

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

/** Wrap a longitude into (-180, 180]. */
export function wrapLon(lon: number): number {
  let l = ((lon + 180) % 360 + 360) % 360 - 180;
  if (l === -180) l = 180;
  return l;
}

export function toVec(lat: number, lon: number): Vec3 {
  const p = lat * D2R, l = lon * D2R, c = Math.cos(p);
  return [c * Math.sin(l), Math.sin(p), c * Math.cos(l)];
}

export function toLatLon(v: Vec3): LatLon {
  const [x, y, z] = v;
  const len = Math.hypot(x, y, z) || 1;
  return { lat: Math.asin(clamp(y / len, -1, 1)) * R2D, lon: Math.atan2(x, z) * R2D };
}

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Central angle between two unit vectors, in radians (stable for tiny and near-antipodal angles). */
export function angleBetween(a: Vec3, b: Vec3): number {
  const c = cross(a, b);
  return Math.atan2(Math.hypot(c[0], c[1], c[2]), dot(a, b));
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLon, b: LatLon): number {
  return angleBetween(toVec(a.lat, a.lon), toVec(b.lat, b.lon)) * EARTH_KM;
}

/** Central angle in radians between two places. */
export function angleOf(a: LatLon, b: LatLon): number {
  return angleBetween(toVec(a.lat, a.lon), toVec(b.lat, b.lon));
}

/** Spherical interpolation along the great circle. t = 0 → a, t = 1 → b. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const ang = angleBetween(a, b);
  if (ang < 1e-6) return a;
  if (Math.PI - ang < 1e-6) {
    // antipodal: any half circle will do — go over the pole nearest to a
    const side: Vec3 = Math.abs(a[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    const axis = norm(cross(a, side));
    const mid = norm(cross(axis, a));
    return t < 0.5 ? slerp(a, mid, t * 2) : slerp(mid, b, t * 2 - 1);
  }
  const s = Math.sin(ang);
  return add(scale(a, Math.sin((1 - t) * ang) / s), scale(b, Math.sin(t * ang) / s));
}

export function slerpLatLon(a: LatLon, b: LatLon, t: number): LatLon {
  return toLatLon(slerp(toVec(a.lat, a.lon), toVec(b.lat, b.lon), t));
}

/** A mean position of several places (for framing a set of markers). */
export function centroid(points: readonly LatLon[]): LatLon | null {
  if (!points.length) return null;
  let v: Vec3 = [0, 0, 0];
  for (const p of points) v = add(v, toVec(p.lat, p.lon));
  if (Math.hypot(v[0], v[1], v[2]) < 1e-6) return points[0];
  return toLatLon(v);
}

/* ── the camera ─────────────────────────────────────────────────────── */

/** Distance from the globe's centre to the camera for a zoom, so the globe's disc has the size `zoom` says. */
export function distFor(zoom: number, vp: Viewport): number {
  const short = Math.min(vp.w, vp.h) || 1;
  const k = (vp.h || 1) / (TAN_HALF * Math.max(0.05, zoom) * short);
  return Math.sqrt(1 + k * k);
}

/** The three axes of the view (right, up, toward the viewer) in globe space, for a camera looking at (lat, lon) with north up. */
export function viewAxes(lat: number, lon: number): { right: Vec3; up: Vec3; fwd: Vec3 } {
  const p = lat * D2R, l = lon * D2R;
  const fwd = toVec(lat, lon);
  const up: Vec3 = [-Math.sin(p) * Math.sin(l), Math.cos(p), -Math.sin(p) * Math.cos(l)];
  const right = cross(up, fwd);
  return { right, up, fwd };
}

export interface Projected {
  /** Pixels from the viewport's top-left. */
  x: number; y: number;
  /** True when the point is on the side of the globe the camera sees (and, for raised points, not hidden behind the globe). */
  visible: boolean;
  /** 0 at the limb, 1 facing the camera — for fading markers toward the edge. */
  facing: number;
}

/** Where a point at `radius` (1 = the surface) over (lat, lon) lands on screen. */
export function project(lat: number, lon: number, cam: Camera, vp: Viewport, radius = 1): Projected {
  return projectVec(scale(toVec(lat, lon), radius), cam, vp);
}

export function projectVec(p: Vec3, cam: Camera, vp: Viewport): Projected {
  const { right, up, fwd } = viewAxes(cam.lat, cam.lon);
  const q: Vec3 = [dot(p, right), dot(p, up), dot(p, fwd)];
  const dist = distFor(cam.zoom, vp);
  const depth = dist - q[2];
  const aspect = vp.w / vp.h;
  const x = (0.5 + 0.5 * (q[0] / depth) / (TAN_HALF * aspect)) * vp.w;
  const y = (0.5 - 0.5 * (q[1] / depth) / TAN_HALF - (cam.shift ?? 0)) * vp.h;
  // Occlusion: does the ray from the camera to the point pass through the unit sphere first?
  let visible = depth > 0;
  if (visible) {
    const o: Vec3 = [0, 0, dist];
    const d: Vec3 = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    const dn: Vec3 = [d[0] / len, d[1] / len, d[2] / len];
    const b = dot(o, dn), c = dot(o, o) - 1;
    const disc = b * b - c;
    if (disc > 0) {
      const tHit = -b - Math.sqrt(disc);
      // a point on the surface sits right at tHit; a point that is clearly farther than the sphere's near face is hidden
      if (tHit > 0 && tHit < len - 2e-3) visible = false;
    }
  }
  const facing = clamp((q[2] / Math.max(1e-6, Math.hypot(p[0], p[1], p[2])) - 1 / dist) / (1 - 1 / dist), 0, 1);
  return { x, y, visible, facing };
}

/** The screen radius, in pixels, of the globe's disc at a camera. */
export function discRadiusPx(cam: Camera, vp: Viewport): number {
  const dist = distFor(cam.zoom, vp);
  return (vp.h / 2) / (TAN_HALF * Math.sqrt(dist * dist - 1));
}

/**
 * Points along the great-circle arc from a to b, lifted off the surface in the
 * middle so a long journey reads as a flight rather than a scratch on the ground.
 */
export function arcPoints(a: LatLon, b: LatLon, steps = 48, lift = 0.16): Vec3[] {
  const va = toVec(a.lat, a.lon), vb = toVec(b.lat, b.lon);
  const ang = angleBetween(va, vb);
  const h = lift * clamp(ang / Math.PI, 0, 1) * 2;
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push(scale(slerp(va, vb, t), 1.004 + h * Math.sin(Math.PI * t)));
  }
  return out;
}
