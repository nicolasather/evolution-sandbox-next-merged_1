/** The four handcrafted courses. Each is one serpentine of 28 stations laid across a 5200×3300 world. Between two neighbouring stations there are three authored roads
 *  (main, short, scenic); the planner picks which stations are checkpoints, so a short match walks longer legs over the same fixed topology. Everything is a pure function of
 *  the map id: the same code runs on the server (authority) and in the browser (drawing, prediction, practice). */
import { ARRIVE_R, GATE_OPEN, GATE_PERIOD, HUB_R, ROAD_R, SPUR_R, STATIONS, WORLD_H, WORLD_W } from './balance';
import type { MapId, OptionId } from './domain';

export type Pt = { x: number; y: number };
export type Seg = { a: Pt; b: Pt; r: number; gate?: number; bridge?: true };
export type Spur = { idx: number; hub: number; pts: Pt[]; end: Pt; name: string; kind: string };
export type PairGeo = { i: number; main: Pt[]; short: Pt[]; scenic: Pt[]; gated: boolean; landmark: { x: number; y: number; name: string; kind: string } };
export type MapInfo = { id: MapId; title: string; blurb: string; theme: string; palette: { ground: string; ground2: string; road: string; accent: string; deep: string; water: string; ink: string }; landmarks: { name: string; kind: string }[]; stationNames: string[] };
const INK = '#233648';
export const MAP_INFO: Record<MapId, MapInfo> = {
  sunleaf_passage: { id: 'sunleaf_passage', title: 'Sunleaf Passage', theme: 'orchard', blurb: 'Hanging bridges, orchard terraces and lantern paths. The route fork is the heart of this map.',
    palette: { ground: '#8BD79A', ground2: '#6FC585', road: '#F2D9A0', accent: '#F6A04D', deep: '#2F7A5B', water: '#7FD1E0', ink: INK },
    landmarks: [{ name: 'Lantern Bridge', kind: 'bridge' }, { name: 'Orchard Gate', kind: 'orchard' }, { name: 'Fern Kiosk', kind: 'kiosk' }, { name: 'Harvest Pavilion', kind: 'pavilion' }, { name: 'Mill Pond', kind: 'pond' }, { name: 'Willow Bend', kind: 'willow' }, { name: 'Carved Signpost', kind: 'signpost' }, { name: 'Berry Cart', kind: 'cart' }, { name: 'Brook Ford', kind: 'ford' }, { name: 'Sun Terrace', kind: 'terrace' }],
    stationNames: ['Lantern', 'Apricot', 'Clover', 'Marigold', 'Fernbank', 'Thistle', 'Maple'] },
  tideglass_harbor: { id: 'tideglass_harbor', title: 'Tideglass Harbor', theme: 'harbor', blurb: 'Wooden docks, buoy channels and a lighthouse with working shutters. Signals matter here.',
    palette: { ground: '#F6E4BE', ground2: '#EBD3A2', road: '#C98F5E', accent: '#F47F79', deep: '#275C68', water: '#65C9D6', ink: INK },
    landmarks: [{ name: 'Striped Lighthouse', kind: 'lighthouse' }, { name: 'Harbor Bell', kind: 'bell' }, { name: 'Net Loft', kind: 'nets' }, { name: 'Buoy Chain', kind: 'buoys' }, { name: 'Winch Crane', kind: 'crane' }, { name: 'Coral Roofs', kind: 'roofs' }, { name: 'Kite Mast', kind: 'mast' }, { name: 'Quay Steps', kind: 'steps' }, { name: 'Dory Slip', kind: 'boats' }, { name: 'Salt Market', kind: 'market' }],
    stationNames: ['Pier', 'Anchor', 'Wharf', 'Keel', 'Jetty', 'Mooring', 'Beacon'] },
  copperwind_borough: { id: 'copperwind_borough', title: 'Copperwind Borough', theme: 'clockwork', blurb: 'Clockwork rooftops, tram lines and moving gates. Timing rewards patience, never speed.',
    palette: { ground: '#EDC9A0', ground2: '#E2B785', road: '#B9744A', accent: '#7FB6D6', deep: '#7A4A33', water: '#8FC7D8', ink: INK },
    landmarks: [{ name: 'Clock Plaza', kind: 'clock' }, { name: 'Tram Arch', kind: 'arch' }, { name: 'Gear Garden', kind: 'gears' }, { name: 'Pipe Walk', kind: 'pipes' }, { name: 'Lamp Row', kind: 'lamps' }, { name: 'Bunting Court', kind: 'bunting' }, { name: 'Tile Square', kind: 'tiles' }, { name: 'Lift Tower', kind: 'lift' }, { name: 'Awning Alley', kind: 'awnings' }, { name: 'Rivet Bridge', kind: 'rivets' }],
    stationNames: ['Cog', 'Spring', 'Pendulum', 'Sprocket', 'Rivet', 'Escapement', 'Chime'] },
  starpetal_heights: { id: 'starpetal_heights', title: 'Starpetal Heights', theme: 'sky', blurb: 'Sky islands, glass bridges and cloud tramways. Plan the stamp order in space.',
    palette: { ground: '#CDB7EE', ground2: '#BBA0E4', road: '#FFF1C9', accent: '#FFD36C', deep: '#5B3E9A', water: '#BEE9F0', ink: INK },
    landmarks: [{ name: 'Observatory', kind: 'dome' }, { name: 'Glass Skybridge', kind: 'glass' }, { name: 'Blossom Glade', kind: 'blossom' }, { name: 'Cloud Tram', kind: 'tram' }, { name: 'Banner Lift', kind: 'banners' }, { name: 'Moon Fountain', kind: 'fountain' }, { name: 'Petal Steps', kind: 'petals' }, { name: 'Star Tower', kind: 'spire' }, { name: 'Mint Island', kind: 'island' }, { name: 'Lantern Rope', kind: 'ropes' }],
    stationNames: ['Petal', 'Nimbus', 'Aster', 'Zephyr', 'Lumen', 'Orchid', 'Cirrus'] },
};
export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
const clampPt = (p: Pt): Pt => ({ x: Math.round(Math.max(150, Math.min(WORLD_W - 150, p.x))), y: Math.round(Math.max(150, Math.min(WORLD_H - 150, p.y))) });
const MIDX = (m: MapId) => Math.floor(hash(m) % 360);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const polyLen = (pts: readonly Pt[]) => { let n = 0; for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1]!, pts[i]!); return n; };

export function distToPoly(p: Pt, pts: readonly Pt[]) { let d = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!; const vx = b.x - a.x, vy = b.y - a.y; const l2 = vx * vx + vy * vy; const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0; d = Math.min(d, Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t))); } return d; }
export type Course = { mapId: MapId; stations: Pt[]; pairs: PairGeo[]; spurs: Spur[][] };
const cache = new Map<string, Course>();
/** Gates are timed barriers on the short roads. They only close for a few seconds and never harm; Easy has none. */
export const gateOn = (map: MapId, difficulty: 'easy' | 'normal' | 'challenge', i: number) => difficulty === 'easy' ? false : map === 'sunleaf_passage' ? difficulty === 'challenge' && i % 3 === 1 : difficulty === 'challenge' ? i % 2 === 1 : (map === 'copperwind_borough' ? i % 2 === 1 : i % 3 === 1);
export const gateOpen = (tick: number, pairIdx: number) => ((tick + pairIdx * 37) % GATE_PERIOD) < GATE_OPEN;
/** ticks until the gate flips (for the countdown ring) */
export const gateFlipIn = (tick: number, pairIdx: number) => { const p = (tick + pairIdx * 37) % GATE_PERIOD; return p < GATE_OPEN ? GATE_OPEN - p : GATE_PERIOD - p; };

export function stationPos(map: MapId, i: number): Pt {
  const cols = 7; const r = Math.floor(i / cols); const c = i % cols; const col = r % 2 ? cols - 1 - c : c; const m = MIDX(map);
  const amp = map === 'copperwind_borough' ? 40 : map === 'tideglass_harbor' ? 120 : map === 'starpetal_heights' ? 140 : 100;
  const wx = Math.sin(i * 1.71 + m) * amp; const wy = Math.cos(i * 2.31 + m * 0.5) * amp * 0.8;
  return clampPt({ x: 700 + (col * 3800) / (cols - 1) + wx, y: 720 + (r * 1980) / 3 + wy });
}
function pairGeo(map: MapId, i: number, P: Pt, Q: Pt, difficulty: 'easy' | 'normal' | 'challenge'): PairGeo {
  const dx = Q.x - P.x, dy = Q.y - P.y; const L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L; const nx = -uy, ny = ux; const sgn = i % 2 ? 1 : -1;
  const at = (t: number, off: number) => clampPt({ x: P.x + dx * t + nx * off * sgn, y: P.y + dy * t + ny * off * sgn });
  const bm = map === 'copperwind_borough' ? 190 : 250; const bs = map === 'starpetal_heights' ? 330 : 270;
  const main = [P, at(0.34, bm), at(0.68, bm * 0.75), Q];
  const gm = at(0.5, 0); const short = [P, clampPt({ x: gm.x - ux * 70, y: gm.y - uy * 70 }), clampPt({ x: gm.x + ux * 70, y: gm.y + uy * 70 }), Q];
  const lm = at(0.5, -bs * 1.25); const scenic = [P, at(0.2, -bs * 0.9), lm, at(0.8, -bs * 0.9), Q];
  const info = MAP_INFO[map]; const pick = info.landmarks[hash(`${map}:lm:${i}`) % info.landmarks.length]!;
  return { i, main, short, scenic, gated: gateOn(map, difficulty, i), landmark: { x: lm.x, y: lm.y, name: pick.name, kind: pick.kind } };
}
export function buildCourse(map: MapId, difficulty: 'easy' | 'normal' | 'challenge' = 'normal'): Course {
  const key = `${map}:${difficulty}`; const hit = cache.get(key); if (hit) return hit;
  const stations = Array.from({ length: STATIONS }, (_, i) => stationPos(map, i));
  const pairs = Array.from({ length: STATIONS - 1 }, (_, i) => pairGeo(map, i, stations[i]!, stations[i + 1]!, difficulty));
  const info = MAP_INFO[map];
  const spurs = stations.map((st, j) => {
    const base = ((hash(`${map}:spur:${j}`) % 360) * Math.PI) / 180; const out: Spur[] = [];
    const roads: Pt[][] = []; for (const q of [pairs[j - 1], pairs[j]]) if (q) roads.push(q.main, q.short, q.scenic);
    const clear = (p: Pt) => Math.min(400, ...roads.map((r) => distToPoly(p, r)));
    const chosen: number[] = [];
    for (let k = 0; k < 4; k++) {
      let best: { ang: number; len: number; c: number } | null = null; const want = base + (k * Math.PI) / 2;
      for (let d = 0; d <= 24 && !(best && best.c >= 210); d++) for (const sg of d === 0 ? [1] : [1, -1]) for (const len of [330, 390, 270, 450, 230]) {
        const ang = want + sg * d * (Math.PI / 24); const raw = { x: st.x + Math.cos(ang) * len, y: st.y + Math.sin(ang) * len };
        if (raw.x < 160 || raw.x > WORLD_W - 160 || raw.y < 160 || raw.y > WORLD_H - 160) continue;
        if (chosen.some((o) => Math.abs(Math.atan2(Math.sin(ang - o), Math.cos(ang - o))) < 0.8)) continue;
        const c = clear(raw); if (!best || c > best.c) best = { ang, len, c };
      }
      const f = best ?? { ang: want, len: 300, c: 0 }; chosen.push(f.ang);
      const end = clampPt({ x: st.x + Math.cos(f.ang) * f.len, y: st.y + Math.sin(f.ang) * f.len }); const mid = clampPt({ x: st.x + Math.cos(f.ang + 0.2) * f.len * 0.55, y: st.y + Math.sin(f.ang + 0.2) * f.len * 0.55 });
      const pk = info.landmarks[(hash(`${map}:sp:${j}`) + k * 3) % info.landmarks.length]!; out.push({ idx: k, hub: j, pts: [st, mid, end], end, name: pk.name, kind: pk.kind });
    }
    return out;
  });
  const c: Course = { mapId: map, stations, pairs, spurs }; cache.set(key, c); return c;
}
export const stationName = (map: MapId, i: number) => i === 0 ? 'Start Board' : i === STATIONS - 1 ? 'Finish Gate' : `${MAP_INFO[map].stationNames[i % 7]} Post`;
/** Station index of every leg boundary: leg k runs from stations[k] to stations[k+1]. */
export const stationPlan = (windows: number): number[] => Array.from({ length: windows + 2 }, (_, k) => Math.round((k * (STATIONS - 1)) / (windows + 1)));

export type OptionGeo = { id: OptionId; label: string; path: Pt[]; length: number; gates: number[]; landmark: string | null; segs: Seg[] };
const OPTION_LABEL: Record<OptionId, string> = { a: 'Main Road', b: 'Short Cut', c: 'Scenic Loop' };
export function optionsFor(course: Course, a: number, b: number): OptionGeo[] {
  const build = (id: OptionId): OptionGeo => {
    const path: Pt[] = []; const segs: Seg[] = []; const gates: number[] = []; let landmark: string | null = null;
    for (let i = a; i < b; i++) {
      const pg = course.pairs[i]!; const pts = id === 'a' ? pg.main : id === 'b' ? pg.short : pg.scenic;
      pts.forEach((p, n) => { if (!(path.length && n === 0)) path.push(p); });
      for (let n = 1; n < pts.length; n++) { const seg: Seg = { a: pts[n - 1]!, b: pts[n]!, r: ROAD_R }; if (id === 'b' && pg.gated && n === 2) { seg.gate = pg.i; if (!gates.includes(pg.i)) gates.push(pg.i); } segs.push(seg); }
      if (id === 'c' && !landmark) landmark = pg.landmark.name;
    }
    return { id, label: OPTION_LABEL[id], path, length: Math.round(polyLen(path)), gates, landmark, segs };
  };
  return [build('a'), build('b'), build('c')];
}
export type LegGeo = { k: number; a: number; b: number; options: OptionGeo[]; offered: OptionId[]; bridge: { seg: Seg; socket: Pt } | null; spurs: Spur[]; hubA: Pt; hubB: Pt };
export function legGeo(course: Course, a: number, b: number, k: number): LegGeo {
  const options = optionsFor(course, a, b); const offered: OptionId[] = k === 0 ? ['a'] : k % 3 === 0 ? ['a', 'b'] : ['a', 'b', 'c'];
  const hubA = course.stations[a]!, hubB = course.stations[b]!; const chord = dist(hubA, hubB); const best = Math.min(...options.filter((o) => offered.includes(o.id)).map((o) => o.length));
  const ux = (hubB.x - hubA.x) / (chord || 1), uy = (hubB.y - hubA.y) / (chord || 1);
  const bridge = b - a >= 1 && chord <= best * 0.82 && chord > HUB_R * 4 ? { seg: { a: hubA, b: hubB, r: ROAD_R, bridge: true as const }, socket: { x: Math.round(hubA.x + ux * (HUB_R + 100)), y: Math.round(hubA.y + uy * (HUB_R + 100)) } } : null;
  return { k, a, b, options, offered, bridge, spurs: course.spurs[b]!, hubA, hubB };
}
/** Everything a body may stand on during one leg for one team: its committed road, both hubs, the destination spurs, and (while open) the bridge. */
export function walkable(g: LegGeo, option: OptionId, bridgeOpen: boolean): Seg[] {
  const o = g.options.find((x) => x.id === option) ?? g.options[0]!; const segs: Seg[] = [...o.segs];
  segs.push({ a: g.hubA, b: g.hubA, r: HUB_R }, { a: g.hubB, b: g.hubB, r: HUB_R });
  for (const s of g.spurs) for (let n = 1; n < s.pts.length; n++) segs.push({ a: s.pts[n - 1]!, b: s.pts[n]!, r: SPUR_R });
  if (bridgeOpen && g.bridge) segs.push(g.bridge.seg);
  return segs;
}
function segDist(p: Pt, s: Seg) {
  const vx = s.b.x - s.a.x, vy = s.b.y - s.a.y; const l2 = vx * vx + vy * vy; let t = l2 ? ((p.x - s.a.x) * vx + (p.y - s.a.y) * vy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p.x - (s.a.x + vx * t), p.y - (s.a.y + vy * t)), q: { x: s.a.x + vx * t, y: s.a.y + vy * t } };
}
const open = (s: Seg, tick: number) => s.gate === undefined || gateOpen(tick, s.gate);
export function isFree(segs: readonly Seg[], x: number, y: number, tick: number): boolean {
  const p = { x, y }; for (const s of segs) if (open(s, tick) && segDist(p, s).d <= s.r - 6) return true; return false;
}
/** Move with wall-sliding; if the current spot is no longer walkable (a gate just closed) glide to the nearest open centre-line. */
export function resolveMove(segs: readonly Seg[], x: number, y: number, nx: number, ny: number, tick: number): [number, number] {
  if (!isFree(segs, x, y, tick)) { const q = nearestOpen(segs, x, y, tick); x = q.x; y = q.y; }
  if (isFree(segs, nx, ny, tick)) return [nx, ny]; if (isFree(segs, nx, y, tick)) return [nx, y]; if (isFree(segs, x, ny, tick)) return [x, ny]; return [x, y];
}
export function nearestOpen(segs: readonly Seg[], x: number, y: number, tick: number): Pt {
  let best: Pt = { x, y }; let bd = Infinity; for (const s of segs) { if (!open(s, tick)) continue; const r = segDist({ x, y }, s); if (r.d < bd) { bd = r.d; best = r.q; } } return best;
}
/** The way to walk from the hub to the leg's goal along a chosen road (for the compass, lamps and scripted classmates). */
export function goalPath(g: LegGeo, option: OptionId): Pt[] { return (g.options.find((o) => o.id === option) ?? g.options[0]!).path; }
export const nearestStation = (course: Course, x: number, y: number) => course.stations.reduce((best, s, i) => (dist(s, { x, y }) < dist(course.stations[best]!, { x, y }) ? i : best), 0);
export const arrived = (g: LegGeo, x: number, y: number) => dist(g.hubB, { x, y }) <= ARRIVE_R;
/** Where teammates stand at a hub: a ring so nobody overlaps. */
export const ringSpot = (hub: Pt, i: number, n: number): Pt => { const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.6; const r = n <= 1 ? 0 : 54; return { x: Math.round(hub.x + Math.cos(a) * r), y: Math.round(hub.y + Math.sin(a) * r) }; };
