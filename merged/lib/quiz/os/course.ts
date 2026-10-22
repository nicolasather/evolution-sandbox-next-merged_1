import type { Cell, Course, Hazard, MapId } from './domain';
import { MAP_IDS } from './domain';
import { DAMAGING, HAZARD_WARNING_MIN, SOFT, SPEED, TILE } from './balance';
import { bounded } from './rng';
import chalkyard from './levels/chalkyard_circuit.json';
import paperfold from './levels/paperfold_canyon.json';
import lantern from './levels/lantern_harbor.json';
import clockwork from './levels/clockwork_commons.json';

export const BASE_COURSES: Record<MapId, Course> = {
  chalkyard_circuit: chalkyard as unknown as Course, paperfold_canyon: paperfold as unknown as Course,
  lantern_harbor: lantern as unknown as Course, clockwork_commons: clockwork as unknown as Course,
};
export const MAP_INFO = MAP_IDS.map((id) => ({ id, name: BASE_COURSES[id].displayName, biome: BASE_COURSES[id].biomeIndex }));

export const ck = (x: number, y: number) => x + y * 128;
export const unck = (k: number): Cell => [k % 128, Math.floor(k / 128)];
export const tileOf = (p: number) => Math.floor(p / TILE);
export const centerOf = (t: number) => t * TILE + TILE / 2;

/** A course ready for simulation: constant-time lookups. Build once per (map, seed) and reuse. */
export type CourseIndex = {
  course: Course; seed: string; lowPressure: boolean; cells: Set<number>; sockets: Set<number>;
  hazardAt: Map<number, number>; // cell key -> hazard index
  dist: Map<number, number>; totalDist: number; startKey: number; goalKey: number; checkpointKeys: number[];
};

const NEIGHBOURS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Walk distance from the start over walkable cells (bridge sockets excluded: a shortcut never adds progress units). */
function distances(c: Course): Map<number, number> {
  const cells = new Set(c.walkableCells.map(([x, y]) => ck(x, y)));
  const d = new Map<number, number>([[ck(...c.start), 0]]); const q = [ck(...c.start)]; let i = 0;
  while (i < q.length) {
    const k = q[i++]; const [x, y] = unck(k);
    for (const [dx, dy] of NEIGHBOURS) { const n = ck(x + dx, y + dy); if (cells.has(n) && !d.has(n)) { d.set(n, d.get(k)! + 1); q.push(n); } }
  }
  return d;
}

export function makeIndex(course: Course, seed = '', lowPressure = false): CourseIndex {
  const cells = new Set(course.walkableCells.map(([x, y]) => ck(x, y)));
  const hazardAt = new Map<number, number>(); course.hazards.forEach((h, i) => hazardAt.set(ck(...h.tile), i));
  const dist = distances(course);
  return {
    course, seed, lowPressure, cells, sockets: new Set((course.optionalBridgeSockets ?? []).map(([x, y]) => ck(x, y))), hazardAt, dist,
    totalDist: dist.get(ck(...course.goal)) ?? 0, startKey: ck(...course.start), goalKey: ck(...course.goal), checkpointKeys: course.checkpoints.map(([x, y]) => ck(x, y)),
  };
}

// ── hazard timing ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const mod = (a: number, n: number) => ((a % n) + n) % n;
export function hazardActive(h: Hazard, tick: number): boolean {
  const { periodTicks, activeTicks, phaseOffsetTicks } = h.schedule;
  if (!Number.isSafeInteger(tick) || periodTicks <= 0) return false;
  return mod(tick + phaseOffsetTicks, periodTicks) < activeTicks;
}
export function hazardWarning(h: Hazard, tick: number): boolean {
  const { periodTicks, warningTicks, phaseOffsetTicks } = h.schedule; if (warningTicks <= 0) return false;
  const cur = mod(tick + phaseOffsetTicks, periodTicks); return cur >= periodTicks - warningTicks && cur < periodTicks;
}
/** 0 idle, 1 warning, 2 active — the single source for both the renderer and the server. */
export function hazardPhase(h: Hazard, tick: number): 0 | 1 | 2 { return hazardActive(h, tick) ? 2 : hazardWarning(h, tick) ? 1 : 0; }
export const isDamaging = (h: Hazard) => DAMAGING.has(h.kind);
/** True when no tick in [from, to] is a damaging window of this hazard. */
export function clearBetween(h: Hazard, from: number, to: number): boolean {
  const { periodTicks, activeTicks, phaseOffsetTicks } = h.schedule;
  if (to - from + 1 >= periodTicks) return activeTicks === 0;
  const a = mod(from + phaseOffsetTicks, periodTicks); const len = to - from + 1;
  // the window [a, a+len) on the cycle must avoid [0, activeTicks) (and its wrap copy at periodTicks)
  return a >= activeTicks && a + len <= periodTicks;
}

// ── seeded room variation ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A preapproved variation of an authored map: the SAME geometry with the hazard rhythms shifted by the room seed. Never reorders or moves tiles. */
export function variantCourse(mapId: MapId, seed: string, lowPressure: boolean, salt = 0): Course {
  const base = BASE_COURSES[mapId];
  return {
    ...base,
    hazards: base.hazards.map((h) => {
      const s = h.schedule; const shift = bounded(`${seed}|${mapId}|${h.id}|${salt}`, s.periodTicks);
      const active = lowPressure ? Math.max(8, Math.floor(s.activeTicks * 0.7)) : s.activeTicks;
      return { ...h, schedule: { ...s, activeTicks: active, phaseOffsetTicks: (s.phaseOffsetTicks + shift) % s.periodTicks } };
    }),
  };
}

// ── static validation ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function validateCourse(c: Course): string[] {
  const e: string[] = []; const [w, h] = c.size;
  if (w < 10 || w > 80 || h < 8 || h > 50) e.push('map dimensions invalid');
  const cells = new Set(c.walkableCells.map(([x, y]) => ck(x, y)));
  if (cells.size !== c.walkableCells.length) e.push('duplicate cell');
  for (const [x, y] of c.walkableCells) if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= w || y >= h) e.push('cell outside map');
  for (const p of [c.start, c.goal, ...c.checkpoints]) if (!cells.has(ck(...p))) e.push('key location not walkable');
  const ids = new Set<string>();
  for (const z of c.hazards) {
    const a = z.schedule; if (ids.has(z.id)) e.push('duplicate hazard id'); ids.add(z.id);
    if (!cells.has(ck(...z.tile))) e.push('hazard outside walkable course');
    if (z.tile[0] === c.start[0] && z.tile[1] === c.start[1]) e.push('hazard on start');
    if (z.tile[0] === c.goal[0] && z.tile[1] === c.goal[1]) e.push('hazard on goal');
    if (!Number.isInteger(a.periodTicks) || a.periodTicks < 20 || a.periodTicks > 800 || a.activeTicks < 0 || a.activeTicks >= a.periodTicks || a.warningTicks < HAZARD_WARNING_MIN[z.kind] || a.warningTicks > a.periodTicks - a.activeTicks) e.push('unsafe hazard schedule');
    // GDD: a safe interval of at least 1.5 s (30 ticks) in every cycle
    if (a.periodTicks - a.activeTicks < 30) e.push('safe interval under 1.5 s');
  }
  if (c.expandedSafePath?.length) {
    const p = c.expandedSafePath;
    if (ck(...p[0]) !== ck(...c.start) || ck(...p[p.length - 1]) !== ck(...c.goal)) e.push('invalid path endpoints');
    for (let i = 1; i < p.length; i++) if (Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]) !== 1 || !cells.has(ck(...p[i]))) e.push('broken path');
  }
  const d = distances(c); if (!d.has(ck(...c.goal))) e.push('goal unreachable');
  const cpDist = c.checkpoints.map((p) => d.get(ck(...p)) ?? -1);
  for (let i = 1; i < cpDist.length; i++) if (cpDist[i] <= cpDist[i - 1]) e.push('checkpoints out of order');
  return [...new Set(e)];
}

// ── time-expanded solvability ─────────────────────────────────────────────────────────────────────────────────────────────
/** Ticks needed to cross one tile at `speed` (+1 for the integer rounding of the real movement), slow tiles at their worst case. */
export function crossTicks(speed: number, cellKey: number, idx: CourseIndex): number {
  const hi = idx.hazardAt.get(cellKey); let v = speed;
  if (hi !== undefined) { const k = idx.course.hazards[hi].kind; if (k === 'slime') v = (speed * SOFT.slime) / 1000; else if (k === 'mud_chute') v = (speed * SOFT.mud_chute) / 1000; }
  return Math.ceil(TILE / Math.max(1, Math.floor(v))) + 1;
}
const MARGIN = 2;
export type Plan = { cells: Cell[]; departs: number[]; arriveTick: number };
/** Earliest-arrival search on the (tile, tick) graph. Waiting is only allowed on tiles that cannot hurt. `speed` is the slowest speed a squad can have.
 *  Returns null when no schedule exists inside `horizon` ticks — that is a map/seed we must never serve. Gates are ignored (they only delay). */
export function solve(idx: CourseIndex, o: { speed?: number; startTick?: number; horizon?: number; from?: Cell; allowSockets?: boolean } = {}): Plan | null {
  const speed = o.speed ?? Math.min(...Object.values(SPEED)); const t0 = o.startTick ?? 0; const horizon = o.horizon ?? 2400;
  const start = ck(...(o.from ?? idx.course.start)); const best = new Map<number, number>([[start, t0]]); const prev = new Map<number, number>(); const dep = new Map<number, number>();
  // arrival times only ever improve, so a plain priority scan over the (small) cell set is exact
  const open = new Set<number>([start]); const walk = (k: number) => idx.cells.has(k) || (o.allowSockets !== false && idx.sockets.has(k));
  while (open.size) {
    let u = -1, tu = Infinity; for (const k of open) { const t = best.get(k)!; if (t < tu) { tu = t; u = k; } }
    open.delete(u); if (u === idx.goalKey) break;
    const [ux, uy] = unck(u); const uh = idx.hazardAt.get(u); const uDamaging = uh !== undefined && isDamaging(idx.course.hazards[uh]);
    const Tu = crossTicks(speed, u, idx);
    for (const [dx, dy] of NEIGHBOURS) {
      const v = ck(ux + dx, uy + dy); if (!walk(v)) continue;
      const vh = idx.hazardAt.get(v); const vz = vh !== undefined && isDamaging(idx.course.hazards[vh]) ? idx.course.hazards[vh] : null; const Tv = crossTicks(speed, v, idx);
      // our own tile must be clear for the whole time we stand on it (we may not wait on a damaging tile)
      let d = tu; let found = -1;
      for (let w = 0; w <= (uDamaging ? 0 : 400); w++, d++) {
        if (d + Tu > horizon) break;
        const arrive = d + Tu;
        if (!vz || clearBetween(vz, arrive - MARGIN, arrive + Tv + MARGIN)) { found = d; break; }
      }
      if (found < 0) continue;
      const arrive = found + Tu;
      if (arrive < (best.get(v) ?? Infinity)) { best.set(v, arrive); prev.set(v, u); dep.set(v, found); open.add(v); }
    }
  }
  if (!best.has(idx.goalKey)) return null;
  const cells: number[] = [idx.goalKey]; const departs: number[] = [];
  for (let k = idx.goalKey; prev.has(k);) { departs.unshift(dep.get(k)!); k = prev.get(k)!; cells.unshift(k); }
  return { cells: cells.map(unck), departs, arriveTick: best.get(idx.goalKey)! };
}
/** A course instance every squad may be served: found by trying approved salts until the slowest role is provably able to cross it. */
export function courseFor(mapId: MapId, seed: string, lowPressure = false): { idx: CourseIndex; salt: number } {
  for (let salt = 0; salt < 16; salt++) {
    const c = variantCourse(mapId, seed, lowPressure, salt); const idx = makeIndex(c, seed, lowPressure);
    if (validateCourse(c).length === 0 && solve(idx, { allowSockets: false }) && solvableFromEverywhere(idx)) return { idx, salt };
  }
  // the unshifted authored map is the proven fallback
  const c = BASE_COURSES[mapId]; return { idx: makeIndex(c, seed, lowPressure), salt: -1 };
}
/** Safe route from the start AND from every checkpoint, so a hit near a checkpoint can never strand a seat. */
function solvableFromEverywhere(idx: CourseIndex): boolean {
  for (const cp of idx.course.checkpoints) if (!solve(idx, { from: cp, allowSockets: false })) return false;
  return true;
}
