/** The three authored levels. Immutable data: control points of the lane (smoothed once by `densify`), build pads at tile centres, scenery anchors
 *  and a palette. Competitive squads all get the SAME map. `validateMap` (and its test) guarantees: one spawn, one core, 12–24 pads, no pad on
 *  the lane, pads not overlapping, everything inside the 20×12 board, and every pad able to reach the lane with the shortest tower range. */
import { buildPath, densify, distToPath, FIX, type PathData, type Pt } from './path';
import type { TDBossId, TDMapId } from './domain';
import { TOWERS } from './balance';

export const BOARD_W = 20, BOARD_H = 12; // tiles
export type Scenery = { kind: 'leaf' | 'pond' | 'stone' | 'bridge' | 'rock' | 'flag' | 'crate' | 'gear' | 'pipe' | 'cloud' | 'bush' | 'cart'; x: number; y: number; s?: number };
export type MapPalette = { ground: string; ground2: string; lane: string; laneEdge: string; accent: string; prop: string; propInk: string };
export type MapData = {
  id: TDMapId; title: string; boss: TDBossId; materials: string;
  palette: MapPalette;
  control: Pt[]; // milli-tiles
  pads: { id: string; x: number; y: number }[]; // tile coordinates of the pad's tile (centre at x+0.5, y+0.5)
  scenery: Scenery[];
};

const T = (x: number, y: number): Pt => [Math.round(x * FIX), Math.round(y * FIX)];
const pads = (prefix: string, list: [number, number][]) => list.map(([x, y], i) => ({ id: `${prefix}${String(i + 1).padStart(2, '0')}`, x, y }));

export const MAPS: Record<TDMapId, MapData> = {
  meadow_circuit: {
    id: 'meadow_circuit', title: 'Meadow Circuit', boss: 'copper_colossus', materials: 'Grass · bridges · ponds',
    palette: { ground: '#A7D9AF', ground2: '#94CDA0', lane: '#FCE6BD', laneEdge: '#3E6B57', accent: '#55BD8C', prop: '#6FB98A', propInk: '#2B5A45' },
    control: [T(-0.6, 3.5), T(2.5, 3.5), T(4.5, 2.4), T(7, 2.4), T(8.6, 4.2), T(8.8, 7.2), T(10.6, 8.9), T(13.6, 8.9), T(15.2, 7.2), T(15.3, 4.6), T(16.6, 3.2), T(18.4, 3.2)],
    pads: pads('m', [[3, 1], [3, 4], [6, 3], [7, 6], [8, 1], [8, 9], [10, 7], [10, 10], [12, 10], [13, 5], [13, 7], [15, 2], [15, 9], [16, 6], [17, 1], [18, 5]]),
    scenery: [{ kind: 'pond', x: 1.6, y: 9.4, s: 1.3 }, { kind: 'leaf', x: 5.2, y: 9.2 }, { kind: 'bush', x: 11.4, y: 2.2 }, { kind: 'stone', x: 19, y: 10.6 }, { kind: 'bridge', x: 11.9, y: 8.9 }, { kind: 'leaf', x: 17.6, y: 8.6 }, { kind: 'bush', x: 0.8, y: 0.9 }, { kind: 'stone', x: 5.5, y: 5.6 }],
  },
  coral_quarry: {
    id: 'coral_quarry', title: 'Coral Quarry', boss: 'quarry_crawler', materials: 'Stone · flags · crates',
    palette: { ground: '#ECC6A6', ground2: '#E2B794', lane: '#FFE6B8', laneEdge: '#8A5544', accent: '#C77F69', prop: '#D49A80', propInk: '#6B3E31' },
    control: [T(-0.6, 8.5), T(3, 8.5), T(4.4, 6.6), T(4.4, 3.6), T(6, 2.2), T(9, 2.2), T(10.6, 3.8), T(10.6, 6.8), T(12.2, 8.6), T(15, 8.6), T(16.4, 7), T(16.4, 4.6), T(17.6, 3.4), T(18.6, 3.4)],
    pads: pads('q', [[2, 4], [4, 1], [4, 9], [5, 4], [5, 7], [7, 3], [9, 4], [9, 7], [10, 1], [10, 9], [12, 4], [13, 10], [14, 7], [15, 3], [16, 9], [17, 7]]),
    scenery: [{ kind: 'rock', x: 1.2, y: 1.2, s: 1.2 }, { kind: 'crate', x: 7.4, y: 10.4 }, { kind: 'flag', x: 12.6, y: 1.4 }, { kind: 'rock', x: 19, y: 10.4 }, { kind: 'cart', x: 7.4, y: 5.6 }, { kind: 'crate', x: 18.8, y: 1.0 }, { kind: 'flag', x: 1.0, y: 6.4 }],
  },
  skyworks: {
    id: 'skyworks', title: 'Skyworks', boss: 'skywork_leviathan', materials: 'Gears · pipes · clouds',
    palette: { ground: '#B7D8E6', ground2: '#A6CBDC', lane: '#FBEBBA', laneEdge: '#3E6684', accent: '#638AAE', prop: '#8FB4CC', propInk: '#2E4E66' },
    control: [T(-0.6, 5.5), T(2.4, 5.5), T(3.8, 3.4), T(6, 2.4), T(8.2, 3.6), T(8.4, 6.2), T(9.6, 8.8), T(12, 8.8), T(13, 6.6), T(13.4, 4), T(15, 2.8), T(17.2, 3.4), T(18.4, 5.2)],
    pads: pads('s', [[1, 4], [3, 6], [4, 1], [4, 4], [7, 1], [7, 7], [8, 9], [9, 3], [9, 5], [10, 10], [11, 7], [14, 4], [14, 6], [15, 1], [16, 4], [18, 7]]),
    scenery: [{ kind: 'gear', x: 1.4, y: 1.4, s: 1.3 }, { kind: 'cloud', x: 5.4, y: 9.6, s: 1.4 }, { kind: 'pipe', x: 11.6, y: 1.2 }, { kind: 'cloud', x: 16.4, y: 9.8 }, { kind: 'gear', x: 18.8, y: 10.6 }, { kind: 'cloud', x: 11.2, y: 4.4 }],
  },
};

const cache = new Map<TDMapId, PathData>();
/** The lane every wave walks (smoothed once, integer points). */
export function mapPath(id: TDMapId): PathData {
  let p = cache.get(id);
  if (!p) { p = buildPath(densify(MAPS[id].control)); cache.set(id, p); }
  return p;
}
export const padCenter = (p: { x: number; y: number }): Pt => [p.x * FIX + FIX / 2, p.y * FIX + FIX / 2];
export const padOf = (map: TDMapId, padId: string) => MAPS[map].pads.find((p) => p.id === padId);

/** Map rules a designer must satisfy. Returns human-readable problems (empty = valid). */
export function validateMap(m: MapData): string[] {
  const issues: string[] = []; const path = mapPath(m.id);
  if (m.control.length < 3) issues.push('lane needs at least three control points');
  if (m.pads.length < 12 || m.pads.length > 24) issues.push('12–24 build pads required');
  if (new Set(m.pads.map((p) => p.id)).size !== m.pads.length) issues.push('pad ids must be unique');
  if (new Set(m.pads.map((p) => `${p.x},${p.y}`)).size !== m.pads.length) issues.push('two pads share a tile');
  const shortest = Math.min(...Object.values(TOWERS).filter((t) => t.damage > 0).map((t) => t.range));
  for (const p of m.pads) {
    if (p.x < 0 || p.y < 0 || p.x >= BOARD_W || p.y >= BOARD_H) issues.push(`pad ${p.id} is off the board`);
    const d = distToPath(path, padCenter(p));
    if (d < 1000) issues.push(`pad ${p.id} sits on the lane (${d})`);
    if (d > shortest - 400) issues.push(`pad ${p.id} is too far from the lane for the shortest-range tower`);
  }
  for (const [x, y] of path.pts.slice(1, -1)) if (x < -700 || y < 0 || x > BOARD_W * FIX || y > BOARD_H * FIX) { issues.push('lane leaves the board'); break; }
  const [ex, ey] = path.pts[path.pts.length - 1]!;
  if (ex < 0 || ey < 0 || ex >= BOARD_W * FIX || ey >= BOARD_H * FIX) issues.push('the core must be on the board');
  if (path.length < 20_000 || path.length > 40_000) issues.push(`lane length ${path.length} outside 20–40 tiles`);
  // at least two pads near each third of the lane, so there are real placement choices along the whole route
  for (let third = 0; third < 3; third++) {
    const from = (path.length * third) / 3, to = (path.length * (third + 1)) / 3;
    const near = m.pads.filter((p) => { const c = padCenter(p); for (let i = 0; i < path.pts.length; i++) { if (path.cum[i]! < from || path.cum[i]! > to) continue; const q = path.pts[i]!; if (Math.hypot(q[0] - c[0], q[1] - c[1]) <= 2500) return true; } return false; });
    if (near.length < 3) issues.push(`only ${near.length} pads cover lane section ${third + 1}`);
  }
  return issues;
}
