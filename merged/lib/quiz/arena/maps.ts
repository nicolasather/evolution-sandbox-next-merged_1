/** Three original maps, built for ANY squad count (2–4) by rotating one sector, so every team has the same starting geometry, the same travel distances to its own
 *  gates / vault and the same shortcuts. Only the three central zones are shared, and they sit in a small plaza so travel differences stay small (measured in tests).
 *  Everything solid is a circle, so collision, bridging and the renderer all read the very same data. Decoration is separate and never collides. */
import type { MapId, Vec } from './domain';
import { CENTER, PLAYER_R, WORLD } from './balance';

export type Solid = { x: number; y: number; r: number; gate: number | null; kind: 'bush' | 'gear' | 'crystal' | 'water' };
export type Deco = { kind: string; x: number; y: number; s: number; rot: number; z: 0 | 1 };
export type NodeRec = { x: number; y: number; hot: boolean; slot: number | null };
export type Gate = { id: number; slot: number; x: number; y: number; r: number };
export type Geometry = {
  mapId: MapId; teamCount: number;
  bases: { x: number; y: number; angle: number }[]; spawns: Vec[][]; vaults: Vec[];
  zones: { id: string; color: 'gold' | 'coral' | 'sky'; x: number; y: number }[];
  checkpoints: Vec[][]; nodes: NodeRec[]; banner: Vec; solids: Solid[]; gates: Gate[]; deco: Deco[];
};
type Sector = { solids: [number, number, number, number | null][]; gateCircles: [number, number, number][]; cps: [number, number][]; nodes: [number, number][]; deco: [string, number, number, number, number][] };
type MapSpec = { id: MapId; title: string; blurb: string; solidKind: Solid['kind']; sector: Sector; global: Deco[]; palette: { ground: string; ground2: string; lane: string; accent: string; ink: string; water: string } };

const D = Math.PI / 180;
const polar = (r: number, deg: number): Vec => ({ x: CENTER + Math.cos(deg * D) * r, y: CENTER + Math.sin(deg * D) * r });
const rnd = (v: Vec): Vec => ({ x: Math.round(v.x), y: Math.round(v.y) });
/** a point in a sector: radius, and a fraction f ∈ [-1,1] of the half-sector width (so it scales with the squad count) */
const at = (slotDeg: number, half: number, r: number, f: number): Vec => rnd(polar(r, slotDeg + f * half));

const SPECS: Record<MapId, MapSpec> = {
  meadow_mosaic: {
    id: 'meadow_mosaic', title: 'Meadow Mosaic', blurb: 'Orchard hedges, stream shortcuts and a fountain plaza in the middle.', solidKind: 'bush',
    palette: { ground: '#96D881', ground2: '#7CC56E', lane: '#F5E6BC', accent: '#F7CD61', ink: '#203241', water: '#75C8EF' },
    sector: {
      solids: [[245, 0.5, 26, null], [245, -0.5, 26, null], [305, 0.55, 26, null], [305, -0.55, 26, null], [365, 0.6, 26, null], [365, -0.6, 26, null], [425, 0.62, 26, null], [425, -0.62, 26, null]],
      gateCircles: [[190, 0.5, 24], [190, -0.5, 24]],
      cps: [[170, 0.3], [290, -0.3], [390, 0.2]],
      nodes: [[190, 0], [300, 0.25], [300, -0.25], [400, 0.35], [400, -0.35], [250, 0.85]],
      deco: [['tree', 330, 0.9, 1.3, 0], ['tree', 400, -0.92, 1.2, 0], ['windmill', 450, 0.9, 1, 0], ['flowers', 350, 0.15, 1, 0], ['flowers', 230, -0.15, 1, 0], ['bridge', 190, 0.5, 1, 90], ['bridge', 190, -0.5, 1, 90], ['banner', 440, 0.3, 1, 0], ['banner', 440, -0.3, 1, 0], ['tree', 250, -0.9, 1.1, 0], ['hedge', 275, 0.5, 1, 0], ['hedge', 275, -0.5, 1, 0]],
    },
    global: [{ kind: 'fountain', x: CENTER, y: CENTER, s: 1, rot: 0, z: 0 }],
  },
  clockwork_carnival: {
    id: 'clockwork_carnival', title: 'Clockwork Carnival', blurb: 'Golden gear gates, turntable lanes and rotating stage lights.', solidKind: 'gear',
    palette: { ground: '#F9C967', ground2: '#EF8B57', lane: '#FFF0C8', accent: '#64CBBA', ink: '#203241', water: '#8E83DC' },
    sector: {
      solids: [[230, 0.42, 30, null], [230, -0.42, 30, null], [320, 0.7, 30, null], [320, -0.7, 30, null], [410, 0.5, 30, null], [410, -0.5, 30, null], [280, 0.95, 28, null], [280, -0.95, 28, null]],
      gateCircles: [[320, 0.3, 22], [320, -0.3, 22]],
      cps: [[180, -0.35], [300, 0.4], [400, -0.15]],
      nodes: [[210, 0.15], [210, -0.15], [330, 0.55], [330, -0.55], [400, 0.8], [400, -0.8]],
      deco: [['turntable', 300, 0.7, 1.5, 0], ['turntable', 300, -0.7, 1.5, 0], ['stagelight', 450, 0.6, 1, 0], ['stagelight', 450, -0.6, 1, 0], ['gearmat', 250, 0, 1.2, 0], ['sign', 440, 0, 1, 0], ['pennant', 380, 0.3, 1, 0], ['pennant', 380, -0.3, 1, 0]],
    },
    global: [{ kind: 'stagecenter', x: CENTER, y: CENTER, s: 1, rot: 0, z: 0 }],
  },
  crystal_lagoon: {
    id: 'crystal_lagoon', title: 'Crystal Lagoon', blurb: 'Turquoise canals, lilac glass isles and light bridges to open.', solidKind: 'water',
    palette: { ground: '#76D9D2', ground2: '#B89AE9', lane: '#E8F8F4', accent: '#FFD36A', ink: '#203241', water: '#3CA9C6' },
    sector: {
      solids: [[230, 0.28, 34, null], [230, -0.28, 34, null], [350, 0.72, 34, null], [350, -0.72, 34, null], [410, 0.9, 34, null], [410, -0.9, 34, null]],
      gateCircles: [[290, 0.5, 34], [290, -0.5, 34]],
      cps: [[160, 0.4], [270, -0.45], [380, 0.35]],
      nodes: [[170, 0.0], [260, 0.45], [260, -0.45], [330, 0.2], [330, -0.2], [420, 0.55]],
      deco: [['crystalcluster', 330, 0.88, 1.3, 0], ['crystalcluster', 330, -0.88, 1.3, 0], ['lilyisle', 400, 0.25, 1, 0], ['lilyisle', 400, -0.25, 1, 0], ['lightbridge', 290, 0, 1, 0], ['lantern', 450, 0.5, 1, 0], ['lantern', 450, -0.5, 1, 0], ['reeds', 240, 0.6, 1, 0], ['reeds', 240, -0.6, 1, 0]],
    },
    global: [{ kind: 'crystalhub', x: CENTER, y: CENTER, s: 1, rot: 0, z: 0 }],
  },
};
export const MAP_INFO = Object.fromEntries(Object.values(SPECS).map((m) => [m.id, { id: m.id, title: m.title, blurb: m.blurb, palette: m.palette }])) as Record<MapId, { id: MapId; title: string; blurb: string; palette: MapSpec['palette'] }>;

const BASE_R = 500; const SPAWN_R = 430; const PLAZA_R = 70; const HOT_R = 135;
/** Base slot angle in degrees: first squad at the top, then clockwise, evenly spaced for the squad count. */
export const slotAngle = (slot: number, teamCount: number) => -90 + (slot * 360) / teamCount;
/** Walls near the centre line must leave a lane a student can actually walk through, whatever the squad count: keep the lateral offset ≥ radius + 40 units. */
function laneFraction(r: number, f: number, rad: number, half: number): number {
  if (Math.abs(f) >= 0.98) return f; const need = Math.asin(Math.min(1, (rad + 40) / r)) / D / half; return Math.sign(f) * Math.min(0.98, Math.max(Math.abs(f), need));
}
const cache = new Map<string, Geometry>();
export function geometryFor(mapId: MapId, teamCount: number): Geometry {
  const key = `${mapId}|${teamCount}`; const hit = cache.get(key); if (hit) return hit;
  const spec = SPECS[mapId]; const n = Math.max(2, Math.min(4, Math.floor(teamCount))); const half = 180 / n;
  const bases: Geometry['bases'] = []; const spawns: Vec[][] = []; const vaults: Vec[] = []; const checkpoints: Vec[][] = []; const nodes: NodeRec[] = []; const solids: Solid[] = []; const gates: Gate[] = []; const deco: Deco[] = [];
  const angles = Array.from({ length: n }, (_, slot) => slotAngle(slot, n));
  for (let slot = 0; slot < n; slot++) {
    const a = angles[slot]!;
    for (const [r, f, rad, g] of spec.sector.solids) { const p = at(a, half, r, laneFraction(r, f, rad, half)); solids.push({ x: p.x, y: p.y, r: rad, gate: g, kind: spec.solidKind }); }
    spec.sector.gateCircles.forEach(([r, f, rad], i) => { const p = at(a, half, r, laneFraction(r, f, rad, half)); const id = slot * 2 + i; solids.push({ x: p.x, y: p.y, r: rad, gate: id, kind: spec.solidKind }); gates.push({ id, slot, x: p.x, y: p.y, r: rad }); });
  }
  // objectives are authored once in sector space; if a squad count would put one inside a wall, the SAME nudge is applied to every sector (symmetry is kept)
  const clear = (r: number, f: number): [number, number] => {
    const ok = (rr: number, ff: number) => { const p = at(angles[0]!, half, rr, ff); return !solids.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.r + PLAYER_R + 14); };
    if (ok(r, f)) return [r, f];
    for (let k = 1; k <= 40; k++) for (const dr of [0, k * 6, -k * 6]) for (const df of [0, k * 0.02, -k * 0.02]) { if (ok(r + dr, f + df) && Math.abs(f + df) <= 0.98) return [r + dr, f + df]; }
    return [r, f];
  };
  const cps = spec.sector.cps.map(([r, f]) => clear(r, f)); const nodeSpec = spec.sector.nodes.map(([r, f]) => clear(r, f));
  for (let slot = 0; slot < n; slot++) {
    const a = angles[slot]!; const base = rnd(polar(BASE_R, a)); bases.push({ ...base, angle: a }); vaults.push(base);
    const dirX = Math.cos(a * D), dirY = Math.sin(a * D); const px = -dirY, py = dirX; const c0 = polar(SPAWN_R, a);
    spawns.push([0, 1, -1, 2, -2].map((k) => rnd({ x: c0.x + px * k * 42, y: c0.y + py * k * 42 })));
    checkpoints.push(cps.map(([r, f]) => at(a, half, r, f)));
    for (const [r, f] of nodeSpec) { const p = at(a, half, r, f); nodes.push({ x: p.x, y: p.y, hot: false, slot }); }
    for (const [kind, r, f, sc, rot] of spec.sector.deco) { const p = at(a, half, r, f); deco.push({ kind, x: p.x, y: p.y, s: sc, rot: rot + a, z: 0 }); }
  }
  for (const ang of [-30, 90, 210]) { const p = rnd(polar(HOT_R, ang)); nodes.push({ x: p.x, y: p.y, hot: true, slot: null }); }
  const colors = ['gold', 'coral', 'sky'] as const;
  const zones = [-90, 30, 150].map((ang, i) => { const p = rnd(polar(PLAZA_R, ang)); return { id: `z${i}`, color: colors[i]!, x: p.x, y: p.y }; });
  for (const g of spec.global) deco.push({ ...g });
  const geo: Geometry = { mapId, teamCount: n, bases, spawns, vaults, zones, checkpoints, nodes, banner: { x: CENTER, y: CENTER }, solids, gates, deco };
  cache.set(key, geo); return geo;
}

/** Push a circle out of every solid that is not an open bridge, then keep it in the world. Deterministic. */
export function resolve(geo: Geometry, x: number, y: number, open: ReadonlySet<number> | null): [number, number] {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of geo.solids) {
      if (o.gate !== null && open?.has(o.gate)) continue;
      const dx = x - o.x, dy = y - o.y, min = o.r + PLAYER_R; const d2 = dx * dx + dy * dy;
      if (d2 < min * min) { const d = Math.sqrt(d2); if (d < 1e-6) { x = o.x + min; } else { x = o.x + (dx / d) * min; y = o.y + (dy / d) * min; } }
    }
  }
  return [Math.min(WORLD - PLAYER_R, Math.max(PLAYER_R, x)), Math.min(WORLD - PLAYER_R, Math.max(PLAYER_R, y))];
}

// ── navigation graph: a coarse grid shared by tests, bots and the "route" hints ───────────────────────────────────────────────
export const CELL = 20; export const GRID = WORLD / CELL;
const blockedCache = new Map<string, Uint8Array>();
function blocked(geo: Geometry, open: ReadonlySet<number> | null): Uint8Array {
  const key = `${geo.mapId}|${geo.teamCount}|${[...(open ?? [])].sort().join(',')}`; const hit = blockedCache.get(key); if (hit) return hit;
  const g = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
    let b = x < PLAYER_R || y < PLAYER_R || x > WORLD - PLAYER_R || y > WORLD - PLAYER_R;
    if (!b) for (const o of geo.solids) { if (o.gate !== null && open?.has(o.gate)) continue; if (Math.hypot(x - o.x, y - o.y) < o.r + PLAYER_R - 2) { b = true; break; } }
    g[j * GRID + i] = b ? 1 : 0;
  }
  if (blockedCache.size > 80) blockedCache.clear(); blockedCache.set(key, g); return g;
}
const fieldCache = new Map<string, Float64Array>();
/** Distance (in units) from every grid cell to `target`, walking around solids. Infinity where unreachable. */
export function distanceField(geo: Geometry, target: Vec, open: ReadonlySet<number> | null = null): Float64Array {
  const key = `${geo.mapId}|${geo.teamCount}|${Math.round(target.x)},${Math.round(target.y)}|${[...(open ?? [])].sort().join(',')}`; const hit = fieldCache.get(key); if (hit) return hit;
  const b = blocked(geo, open); const dist = new Float64Array(GRID * GRID).fill(Infinity);
  const ti = Math.min(GRID - 1, Math.max(0, Math.floor(target.x / CELL))), tj = Math.min(GRID - 1, Math.max(0, Math.floor(target.y / CELL)));
  // Dijkstra with a simple binary heap
  const heap: [number, number][] = []; const push = (d: number, id: number) => { heap.push([d, id]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p]![0] <= heap[k]![0]) break; [heap[p], heap[k]] = [heap[k]!, heap[p]!]; k = p; } };
  const pop = () => { const top = heap[0]!; const last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l; if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k]!, heap[m]!]; k = m; } } return top; };
  // targets inside a blocked cell (an objective next to a solid) start from the nearest free neighbour
  const start = tj * GRID + ti; dist[start] = 0; push(0, start);
  while (heap.length) {
    const [d, id] = pop(); if (d > dist[id]!) continue; const i = id % GRID, j = (id / GRID) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GRID || nj >= GRID) continue; const nid = nj * GRID + ni; if (b[nid]) continue;
      if (di && dj && (b[j * GRID + ni] || b[nj * GRID + i])) continue; // no cutting corners
      const nd = d + (di && dj ? CELL * 1.4142 : CELL); if (nd < dist[nid]!) { dist[nid] = nd; push(nd, nid); }
    }
  }
  if (fieldCache.size > 200) fieldCache.clear(); fieldCache.set(key, dist); return dist;
}
export const cellOf = (p: Vec) => Math.min(GRID - 1, Math.max(0, Math.floor(p.y / CELL))) * GRID + Math.min(GRID - 1, Math.max(0, Math.floor(p.x / CELL)));
export function walkDistance(geo: Geometry, from: Vec, to: Vec, open: ReadonlySet<number> | null = null): number { return distanceField(geo, to, open)[cellOf(from)]!; }
/** The unit direction a walker at `p` should steer to approach `target` (steepest descent of the distance field). */
export function steer(geo: Geometry, p: Vec, target: Vec, open: ReadonlySet<number> | null = null): Vec {
  const f = distanceField(geo, target, open); const i = Math.min(GRID - 1, Math.max(0, Math.floor(p.x / CELL))), j = Math.min(GRID - 1, Math.max(0, Math.floor(p.y / CELL))); let best = f[j * GRID + i]!, bx = 0, by = 0;
  if (Math.hypot(target.x - p.x, target.y - p.y) < CELL * 1.5) { const d = Math.hypot(target.x - p.x, target.y - p.y) || 1; return { x: (target.x - p.x) / d, y: (target.y - p.y) / d }; }
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GRID || nj >= GRID) continue; const v = f[nj * GRID + ni]!; if (v < best) { best = v; bx = di; by = dj; } }
  const m = Math.hypot(bx, by) || 1; return { x: bx / m, y: by / m };
}
export function nearestGate(geo: Geometry, x: number, y: number, range: number): Gate | null {
  let best: Gate | null = null, bd = range; for (const g of geo.gates) { const d = Math.hypot(g.x - x, g.y - y); if (d <= bd) { bd = d; best = g; } } return best;
}
