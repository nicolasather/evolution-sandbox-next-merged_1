import type { Mesh } from './types';

/* 2D fallback + the "do they look different?" metric. Orthographic front projection of the mesh. */

export interface Silhouette { width: number; height: number; fill: number; aspect: number; svg: string; grid: string }

const N = 24;

export function silhouette(mesh: Mesh): Silhouette {
  const p = mesh.positions;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < p.length; i += 3) { minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]); minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]); }
  const w = maxX - minX || 1, h = maxY - minY || 1, s = Math.max(w, h);
  const cell = new Uint8Array(N * N);
  const idx = mesh.indices;
  const px = (i: number) => ((p[i * 3] - minX) / s) * (N - 1), py = (i: number) => ((p[i * 3 + 1] - minY) / s) * (N - 1);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const x0 = Math.floor(Math.min(px(a), px(b), px(c))), x1 = Math.ceil(Math.max(px(a), px(b), px(c)));
    const y0 = Math.floor(Math.min(py(a), py(b), py(c))), y1 = Math.ceil(Math.max(py(a), py(b), py(c)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (inTri(x, y, px(a), py(a), px(b), py(b), px(c), py(c))) cell[y * N + x] = 1;
    }
  }
  let filled = 0;
  const rows: string[] = [];
  let rects = '';
  for (let y = N - 1; y >= 0; y--) {
    let row = '';
    for (let x = 0; x < N; x++) { const v = cell[y * N + x]; row += v ? '#' : '.'; if (v) { filled++; rects += `<rect x="${x}" y="${N - 1 - y}" width="1" height="1"/>`; } }
    rows.push(row);
  }
  return {
    width: w, height: h, fill: filled / (N * N), aspect: w / h, grid: rows.join('\n'),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" fill="currentColor" role="img" aria-label="reconstruction silhouette">${rects}</svg>`,
  };
}

function inTri(x: number, y: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(d) < 1e-9) return false;
  const u = ((x - ax) * (cy - ay) - (y - ay) * (cx - ax)) / d;
  const v = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / d;
  return u >= -0.15 && v >= -0.15 && u + v <= 1.15;
}

/** Hamming-style distance between two silhouettes' grids (0..1). */
export function silhouetteDistance(a: Silhouette, b: Silhouette): number {
  let diff = 0, tot = 0;
  for (let i = 0; i < a.grid.length; i++) { if (a.grid[i] === '\n') continue; tot++; if (a.grid[i] !== b.grid[i]) diff++; }
  return diff / tot;
}
