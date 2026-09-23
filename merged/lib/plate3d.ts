/* ============================================================================
   3D PLATE MODEL — turns a flat line drawing into an extruded wireframe.

   Every discovery's drawing (data/art.json) is SVG line art in a 100x100 box.
   To float it in 3D we let the browser do the geometry: the markup is mounted
   in a hidden <svg>, every stroke is sampled along its length with
   getPointAtLength() and mapped through getCTM() (so transforms, arcs and
   curves all come out right), then each polyline is extruded into a front and
   a back contour joined by struts at its corners. `data-z` on a group pushes
   that part forward or back, which is what gives a cart two wheels at
   different depths instead of one flat picture.

   Browser-only: call from an effect, never during render.
   ========================================================================== */

/** One 3D polyline: xyz triples, relative opacity, relative stroke weight. */
export interface Line3 { p: Float32Array; a: number; w: number }
/** A filled accent dot from the drawing (fill="currentColor"). */
export interface Dot3 { x: number; y: number; z: number; r: number; a: number }

export interface Model {
  lines: Line3[];
  dots: Dot3[];
  /** Bounding radius about the centre, in drawing units. */
  radius: number;
  /** Total vertex count — used to scale down effects on very dense drawings. */
  verts: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = 'path,circle,ellipse,rect,line,polyline,polygon';
/** Front-to-back thickness of the extrusion, in drawing units. */
const DEPTH = 6;
/** Hard budget of sampled 2D points per drawing. */
const MAX_POINTS = 5200;

const cache = new Map<string, Model>();

function num(v: string | null, d: number): number {
  if (v == null || v === '') return d;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

/** Walk from an element up to the root <svg>, summing data-z and multiplying opacity. */
function inherited(el: Element, root: Element): { z: number; a: number; w: number } {
  let z = 0, a = 1, w = NaN;
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    z += num(e.getAttribute('data-z'), 0);
    a *= num(e.getAttribute('opacity'), 1);
    if (Number.isNaN(w) && e.hasAttribute('stroke-width')) w = num(e.getAttribute('stroke-width'), 2);
  }
  return { z, a: Math.max(0.05, Math.min(1, a)), w: Number.isNaN(w) ? 2 : w };
}

/** Indices along a 2D polyline where a strut should join front and back. */
function strutIndices(xs: number[], ys: number[], closed: boolean): number[] {
  const n = xs.length;
  const out: number[] = [];
  if (n < 2) return out;
  if (!closed) out.push(0);
  let since = 0, run = 0;
  for (let i = 1; i < n - 1; i++) {
    const ax = xs[i] - xs[i - 1], ay = ys[i] - ys[i - 1];
    const bx = xs[i + 1] - xs[i], by = ys[i + 1] - ys[i];
    run += Math.hypot(ax, ay);
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    since++;
    if (la < 1e-6 || lb < 1e-6) continue;
    const cos = (ax * bx + ay * by) / (la * lb);
    // a real corner (> ~38°), or a long smooth stretch without any strut
    if ((cos < 0.79 && since > 2) || run > 24) { out.push(i); since = 0; run = 0; }
  }
  if (!closed) out.push(n - 1);
  else if (out.length < 3) {
    // smooth closed loops (wheels, rims, bowls): four evenly spaced struts
    for (let k = 0; k < 4; k++) out.push(Math.floor((k * n) / 4));
  }
  return out;
}

/** Build (or fetch from cache) the 3D model for a drawing. Returns null when
 *  the browser cannot measure SVG geometry (tests, very old engines). */
export function buildModel(key: string, markup: string): Model | null {
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;

  const host = document.createElementNS(SVG_NS, 'svg');
  host.setAttribute('viewBox', '0 0 100 100');
  host.setAttribute('width', '100');
  host.setAttribute('height', '100');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none';
  host.innerHTML = markup;
  document.body.appendChild(host);

  try {
    const els = Array.from(host.querySelectorAll<SVGGeometryElement>(SHAPES));
    if (!els.length || typeof els[0].getTotalLength !== 'function') return null;

    const lens = els.map(el => { try { return el.getTotalLength(); } catch { return 0; } });
    const total = lens.reduce((s, l) => s + l, 0);
    const step = Math.max(1.1, total / MAX_POINTS);

    type Poly = { xs: number[]; ys: number[]; z: number; a: number; w: number; closed: boolean };
    const polys: Poly[] = [];
    const dots: Dot3[] = [];

    els.forEach((el, idx) => {
      const L = lens[idx];
      const inh = inherited(el, host);
      const tag = el.tagName.toLowerCase();
      const fill = el.getAttribute('fill');
      const m = el.getCTM();
      const map = (x: number, y: number): [number, number] =>
        m ? [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f] : [x, y];

      // small filled circles are accents (eyes, rivets, seeds): keep them as dots
      if (tag === 'circle' && fill === 'currentColor') {
        const [x, y] = map(num(el.getAttribute('cx'), 0), num(el.getAttribute('cy'), 0));
        const scale = m ? Math.hypot(m.a, m.b) : 1;
        dots.push({ x, y, z: inh.z, r: num(el.getAttribute('r'), 1.5) * scale, a: inh.a });
        return;
      }
      if (!(L > 0.2)) return;

      const n = Math.max(2, Math.min(600, Math.ceil(L / step)));
      const seg = L / n;
      const jump = seg * 1.08 + 0.35;
      let cur: Poly = { xs: [], ys: [], z: inh.z, a: inh.a, w: inh.w, closed: false };
      for (let i = 0; i <= n; i++) {
        const p = el.getPointAtLength((L * i) / n);
        const [x, y] = map(p.x, p.y);
        const k = cur.xs.length;
        // a sudden gap means the path lifted the pen (a new "M" subpath)
        if (k && Math.hypot(x - cur.xs[k - 1], y - cur.ys[k - 1]) > jump) {
          if (cur.xs.length > 1) polys.push(cur);
          cur = { xs: [], ys: [], z: inh.z, a: inh.a, w: inh.w, closed: false };
        }
        cur.xs.push(x); cur.ys.push(y);
      }
      if (cur.xs.length > 1) polys.push(cur);
    });

    // close detection + centre of the whole drawing
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of polys) {
      const k = q.xs.length - 1;
      q.closed = k > 2 && Math.hypot(q.xs[0] - q.xs[k], q.ys[0] - q.ys[k]) < 0.6;
      for (let i = 0; i <= k; i++) {
        if (q.xs[i] < minX) minX = q.xs[i]; if (q.xs[i] > maxX) maxX = q.xs[i];
        if (q.ys[i] < minY) minY = q.ys[i]; if (q.ys[i] > maxY) maxY = q.ys[i];
      }
      if (q.z < minZ) minZ = q.z; if (q.z > maxZ) maxZ = q.z;
    }
    for (const d of dots) {
      minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
    }
    if (!Number.isFinite(minX)) return null;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const cz = Number.isFinite(minZ) ? (minZ + maxZ) / 2 : 0;

    const lines: Line3[] = [];
    let radius = 1, verts = 0;
    const half = DEPTH / 2;

    for (const q of polys) {
      const n = q.xs.length;
      const front = new Float32Array(n * 3), back = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const x = q.xs[i] - cx, y = q.ys[i] - cy, z = q.z - cz;
        front[i * 3] = back[i * 3] = x;
        front[i * 3 + 1] = back[i * 3 + 1] = y;
        front[i * 3 + 2] = z + half;
        back[i * 3 + 2] = z - half;
        const r = Math.hypot(x, y, Math.abs(z) + half);
        if (r > radius) radius = r;
      }
      const w = q.w / 2;
      lines.push({ p: front, a: q.a, w });
      // the back contour and the struts are what make it read as a solid,
      // so fine detail lines (low opacity) stay single to avoid clutter
      if (q.a >= 0.55 && w >= 0.7) {
        lines.push({ p: back, a: q.a * 0.5, w: w * 0.8 });
        for (const i of strutIndices(q.xs, q.ys, q.closed)) {
          lines.push({
            p: new Float32Array([front[i * 3], front[i * 3 + 1], front[i * 3 + 2], back[i * 3], back[i * 3 + 1], back[i * 3 + 2]]),
            a: q.a * 0.42, w: w * 0.7,
          });
        }
      }
      verts += n;
    }
    for (const d of dots) { d.x -= cx; d.y -= cy; d.z -= cz; }

    const model: Model = { lines, dots, radius, verts };
    cache.set(key, model);
    return model;
  } catch {
    return null;
  } finally {
    host.remove();
  }
}
