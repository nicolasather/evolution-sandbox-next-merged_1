import type { Mesh, Part } from './types';

/* Real vertices / indices / normals — not CSS rotations of one icon. Everything is deterministic. */

type V3 = [number, number, number];
const MAX_VERTS = 65_000;

class Builder {
  p: number[] = []; n: number[] = []; i: number[] = []; t: number[] = [];
  get count() { return this.p.length / 3; }
  vert(pos: V3, nor: V3, tint: number) { this.p.push(...pos); this.n.push(...nor); this.t.push(tint); return this.count - 1; }
}

const rot = (v: V3, r: V3 = [0, 0, 0]): V3 => {
  let [x, y, z] = v;
  let c = Math.cos(r[0]), s = Math.sin(r[0]); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(r[1]); s = Math.sin(r[1]); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(r[2]); s = Math.sin(r[2]); [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
};

function emit(b: Builder, part: Part, grid: V3[][], normals: V3[][]) {
  const base = b.count;
  const rows = grid.length, cols = grid[0].length;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const q = rot(grid[r][c], part.rot);
    const nn = rot(normals[r][c], part.rot);
    b.vert([q[0] + part.offset[0], q[1] + part.offset[1], q[2] + part.offset[2]], nn, part.tint ?? 0);
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = base + r * cols + c, bb = a + 1, cc = a + cols, d = cc + 1;
    b.i.push(a, cc, bb, bb, cc, d);
  }
}

const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function sphereGrid(sx: number, sy: number, sz: number, seg: number) {
  const g: V3[][] = [], n: V3[][] = [];
  for (let r = 0; r <= seg; r++) {
    const th = (r / seg) * Math.PI; g.push([]); n.push([]);
    for (let c = 0; c <= seg * 2; c++) {
      const ph = (c / (seg * 2)) * Math.PI * 2;
      const u: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      g[r].push([u[0] * sx, u[1] * sy, u[2] * sz]);
      n[r].push(norm([u[0] / (sx || 1), u[1] / (sy || 1), u[2] / (sz || 1)]));
    }
  }
  return { g, n };
}

/** surface of revolution around Y from a [radius, y] profile (vessels, beads, cones, cylinders) */
function latheGrid(profile: [number, number][], seg: number, sx: number, sz: number) {
  const g: V3[][] = [], n: V3[][] = [];
  profile.forEach(([rad, y], k) => {
    g.push([]); n.push([]);
    const prev = profile[Math.max(0, k - 1)], next = profile[Math.min(profile.length - 1, k + 1)];
    const dr = next[0] - prev[0], dy = next[1] - prev[1];
    for (let c = 0; c <= seg; c++) {
      const a = (c / seg) * Math.PI * 2;
      g[k].push([Math.cos(a) * rad * sx, y, Math.sin(a) * rad * sz]);
      n[k].push(norm([Math.cos(a) * dy, -dr, Math.sin(a) * dy]));
    }
  });
  return { g, n };
}

function boxLike(b: Builder, part: Part, topScale = 1) {
  // six faces, flat normals; `topScale` < 1 turns the box into a wedge/ingot (narrower top)
  const [hx, hy, hz] = part.size;
  const t = topScale;
  const P = (x: number, y: number, z: number): V3 => [x * (y > 0 ? t : 1), y, z * (y > 0 ? t : 1)];
  const faces: [V3, V3, V3, V3][] = [
    [P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)],
    [P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz)],
    [P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz)],
    [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz)],
    [P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz)],
    [P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz)],
  ];
  for (const f of faces) {
    const e1: V3 = [f[1][0] - f[0][0], f[1][1] - f[0][1], f[1][2] - f[0][2]];
    const e2: V3 = [f[3][0] - f[0][0], f[3][1] - f[0][1], f[3][2] - f[0][2]];
    const nor = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
    const base = b.count;
    f.forEach(q => { const w = rot(q, part.rot); b.vert([w[0] + part.offset[0], w[1] + part.offset[1], w[2] + part.offset[2]], rot(nor, part.rot), part.tint ?? 0); });
    b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

export function buildPart(b: Builder, part: Part, seg: number) {
  const [sx, sy, sz] = part.size;
  switch (part.shape) {
    case 'box': return boxLike(b, part, 1);
    case 'wedge': return boxLike(b, part, 0.35);
    case 'sphere': { const { g, n } = sphereGrid(sx, sy, sz, seg); return emit(b, part, g, n); }
    case 'cylinder': { const { g, n } = latheGrid([[1, -sy], [1, sy]], seg * 2, sx, sz); emit(b, part, g, n);
      const cap1 = latheGrid([[0, sy], [1, sy]], seg * 2, sx, sz); cap1.n.forEach(r => r.forEach(v => { v[0] = 0; v[1] = 1; v[2] = 0; })); return emit(b, part, cap1.g, cap1.n); }
    case 'cone': { const { g, n } = latheGrid([[1, -sy], [0.0, sy]], seg * 2, sx, sz); return emit(b, part, g, n); }
    case 'lathe': { const { g, n } = latheGrid(part.profile ?? [[0.5, -1], [1, 0], [0.6, 1]], seg * 2, sx, sz); return emit(b, part, g, n); }
    case 'torus': {
      const g: V3[][] = [], n: V3[][] = [];
      const R = sx, r = sy;
      for (let i = 0; i <= seg * 2; i++) {
        const u = (i / (seg * 2)) * Math.PI * 2; g.push([]); n.push([]);
        for (let j = 0; j <= seg; j++) {
          const v = (j / seg) * Math.PI * 2;
          g[i].push([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v) * (sz / (r || 1)), (R + r * Math.cos(v)) * Math.sin(u)]);
          n[i].push(norm([Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)]));
        }
      }
      return emit(b, part, g, n);
    }
  }
}

export function buildMesh(parts: Part[], seg: number): Mesh {
  const b = new Builder();
  for (const p of parts) buildPart(b, p, Math.max(3, seg));
  if (b.count > MAX_VERTS) throw new Error(`mesh over budget: ${b.count} vertices`);
  return {
    positions: new Float32Array(b.p), normals: new Float32Array(b.n),
    indices: new Uint16Array(b.i), tint: new Uint8Array(b.t),
  };
}

export const triangleCount = (m: Mesh) => m.indices.length / 3;
