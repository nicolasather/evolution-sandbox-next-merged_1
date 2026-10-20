/** Three authored arenas. World is 1920×1200 logical units; the beacon sits at (960,600). Maps are authored on a 960×600 sketch and expanded 2× (positions) / 1.4× (sizes)
 *  with themed regions and landmarks added on top, so the camera has real places to travel between. Only `obstacles` collide on the server;
 *  `props` are decoration drawn under entities and are never solid. The renderer draws exactly this data. */
import type { MapId } from './domain';
import { WORLD } from './balance';

export type Obstacle = { kind: 'rect'; x: number; y: number; w: number; h: number } | { kind: 'circle'; x: number; y: number; r: number };
export type Wind = { x: number; y: number; w: number; h: number; vx: number; vy: number };
export type MapDef = {
  id: MapId; title: string; blurb: string; ground: string; ground2: string; lane: string; ink: string; accent: string; danger: string;
  obstacles: Obstacle[]; wind: Wind[]; spawns: { x: number; y: number }[] | 'ring'; props: { kind: string; x: number; y: number; s?: number }[];
  /** themed areas: pure scenery + a label shown on the minimap/banner when you walk in (never solid, never gameplay) */
  regions: Region[]; landmarks: Landmark[];
};
export type Region = { id: string; name: string; x: number; y: number; w: number; h: number; tint: string };
export type Landmark = { kind: 'tower' | 'windmill' | 'pond' | 'arch' | 'statue' | 'lamp' | 'pylon' | 'dome'; x: number; y: number; name: string; s?: number };
type Base = Omit<MapDef, 'regions' | 'landmarks'>;
const BASE: Record<MapId, Base> = {
  meadow_circuit: {
    id: 'meadow_circuit', title: 'Meadow Circuit', blurb: 'Open grass with rounded shrub islands. Easy to dodge in.',
    ground: '#A9D69C', ground2: '#5CBBA0', lane: '#FFE3A5', ink: '#1D2C35', accent: '#F77765', danger: '#F77765',
    obstacles: [], wind: [], spawns: 'ring',
    props: [
      { kind: 'bush', x: 110, y: 115, s: 1.3 }, { kind: 'bush', x: 825, y: 115, s: 1.3 }, { kind: 'bush', x: 110, y: 480, s: 1.3 }, { kind: 'bush', x: 825, y: 480, s: 1.3 },
      { kind: 'tuft', x: 300, y: 90 }, { kind: 'tuft', x: 640, y: 520 }, { kind: 'flower', x: 220, y: 330 }, { kind: 'flower', x: 730, y: 250 }, { kind: 'flower', x: 400, y: 470 },
    ],
  },
  paper_quarry: {
    id: 'paper_quarry', title: 'Paper Quarry', blurb: 'Hand-cut ridges and four gates. Watch the diagonal gap.',
    ground: '#D4C5A6', ground2: '#C4B28F', lane: '#E6DAC0', ink: '#1D2C35', accent: '#F77765', danger: '#F77765',
    obstacles: [{ kind: 'rect', x: 190, y: 150, w: 130, h: 36 }, { kind: 'rect', x: 640, y: 414, w: 130, h: 36 }],
    wind: [], spawns: [{ x: 480, y: 28 }, { x: 932, y: 300 }, { x: 480, y: 572 }, { x: 28, y: 300 }],
    props: [{ kind: 'ridge', x: 255, y: 168, s: 1.4 }, { kind: 'ridge', x: 705, y: 432, s: 1.4 }, { kind: 'slate', x: 120, y: 470 }, { kind: 'slate', x: 840, y: 130 }, { kind: 'chip', x: 400, y: 90 }, { kind: 'chip', x: 560, y: 520 }],
  },
  frost_conservatory: {
    id: 'frost_conservatory', title: 'Frost Conservatory', blurb: 'Icy planters and gentle wind currents that push enemies.',
    ground: '#B8DDE4', ground2: '#D7EEF0', lane: '#EAF6F8', ink: '#1D2C35', accent: '#FFCD55', danger: '#F77765',
    obstacles: [{ kind: 'circle', x: 200, y: 150, r: 24 }, { kind: 'circle', x: 760, y: 150, r: 24 }, { kind: 'circle', x: 200, y: 450, r: 24 }, { kind: 'circle', x: 760, y: 450, r: 24 }],
    wind: [{ x: 280, y: 60, w: 400, h: 60, vx: 14, vy: 0 }, { x: 280, y: 480, w: 400, h: 60, vx: -14, vy: 0 }],
    spawns: 'ring',
    props: [{ kind: 'planter', x: 200, y: 150 }, { kind: 'planter', x: 760, y: 150 }, { kind: 'planter', x: 200, y: 450 }, { kind: 'planter', x: 760, y: 450 }, { kind: 'snow', x: 100, y: 300 }, { kind: 'snow', x: 860, y: 300 }],
  },
};
/** Push a circle out of every obstacle; returns the corrected position. Deterministic, no allocation beyond the result. */
export function resolveObstacles(map: MapDef, x: number, y: number, r: number): [number, number] {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of map.obstacles) {
      if (o.kind === 'circle') {
        const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy), min = o.r + r;
        if (d < min) { if (d < 1e-6) { x = o.x + min; } else { x = o.x + (dx / d) * min; y = o.y + (dy / d) * min; } }
      } else {
        const cx = Math.max(o.x, Math.min(x, o.x + o.w)), cy = Math.max(o.y, Math.min(y, o.y + o.h));
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 1e-6) { x = cx + (dx / d) * r; y = cy + (dy / d) * r; }
          else { // centre inside the rect: leave through the nearest edge
            const l = x - o.x, rr = o.x + o.w - x, t = y - o.y, b = o.y + o.h - y, m = Math.min(l, rr, t, b);
            if (m === l) x = o.x - r; else if (m === rr) x = o.x + o.w + r; else if (m === t) y = o.y - r; else y = o.y + o.h + r;
          }
        }
      }
    }
  }
  return [Math.min(WORLD.w - r, Math.max(r, x)), Math.min(WORLD.h - r, Math.max(r, y))];
}
export const windAt = (map: MapDef, x: number, y: number): [number, number] => {
  for (const w of map.wind) if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return [w.vx, w.vy];
  return [0, 0];
};

const K = 2, KS = 1.4;
const sc = (o: Obstacle): Obstacle => (o.kind === 'rect' ? { kind: 'rect', x: o.x * K - (o.w * (KS - 1)) / 2, y: o.y * K - (o.h * (KS - 1)) / 2, w: o.w * KS, h: o.h * KS } : { kind: 'circle', x: o.x * K, y: o.y * K, r: o.r * KS });
const EXTRA: Record<MapId, { regions: Region[]; landmarks: Landmark[]; obstacles: Obstacle[] }> = {
  meadow_circuit: {
    regions: [
      { id: 'orchard', name: 'Orchard Corner', x: 0, y: 0, w: 640, h: 420, tint: '#8CCB7E' },
      { id: 'pond', name: 'Lily Pond', x: 1280, y: 0, w: 640, h: 420, tint: '#7FC4C8' },
      { id: 'windmill', name: 'Windmill Hill', x: 0, y: 780, w: 640, h: 420, tint: '#C7DE8E' },
      { id: 'flowers', name: 'Flower Fields', x: 1280, y: 780, w: 640, h: 420, tint: '#F2C6D4' },
    ],
    landmarks: [{ kind: 'pond', x: 1560, y: 210, name: 'Lily Pond', s: 1.6 }, { kind: 'windmill', x: 300, y: 980, name: 'Windmill', s: 1.4 }, { kind: 'arch', x: 960, y: 140, name: 'Garden Arch' }, { kind: 'statue', x: 330, y: 220, name: 'Orchard Statue' }, { kind: 'lamp', x: 1560, y: 1000, name: 'Lantern Row' }],
    obstacles: [{ kind: 'circle', x: 330, y: 330, r: 30 }, { kind: 'circle', x: 1580, y: 870, r: 30 }],
  },
  paper_quarry: {
    regions: [
      { id: 'cut', name: 'Cutting Floor', x: 0, y: 0, w: 700, h: 460, tint: '#CDBB96' },
      { id: 'stack', name: 'Slate Stacks', x: 1220, y: 0, w: 700, h: 460, tint: '#D9CCB0' },
      { id: 'gate', name: 'Gate Yard', x: 0, y: 740, w: 700, h: 460, tint: '#C9B78F' },
      { id: 'lift', name: 'Lift Shaft', x: 1220, y: 740, w: 700, h: 460, tint: '#BFAE8A' },
    ],
    landmarks: [{ kind: 'tower', x: 330, y: 230, name: 'Crane Tower', s: 1.3 }, { kind: 'pylon', x: 1600, y: 960, name: 'Lift Pylon' }, { kind: 'arch', x: 960, y: 1100, name: 'South Gate' }, { kind: 'statue', x: 1560, y: 220, name: 'Quarry Master' }],
    obstacles: [{ kind: 'rect', x: 520, y: 880, w: 120, h: 40 }, { kind: 'rect', x: 1300, y: 300, w: 120, h: 40 }],
  },
  frost_conservatory: {
    regions: [
      { id: 'fern', name: 'Fern Hall', x: 0, y: 0, w: 700, h: 460, tint: '#A8D6C2' },
      { id: 'ice', name: 'Ice Court', x: 1220, y: 0, w: 700, h: 460, tint: '#D7EEF0' },
      { id: 'dome', name: 'Glass Dome', x: 0, y: 740, w: 700, h: 460, tint: '#C3E4EB' },
      { id: 'pump', name: 'Boiler Room', x: 1220, y: 740, w: 700, h: 460, tint: '#E6E0C0' },
    ],
    landmarks: [{ kind: 'dome', x: 330, y: 990, name: 'Glass Dome', s: 1.5 }, { kind: 'statue', x: 1580, y: 220, name: 'Frozen Fountain' }, { kind: 'pylon', x: 1600, y: 980, name: 'Boiler Stack' }, { kind: 'arch', x: 960, y: 120, name: 'North Arch' }],
    obstacles: [{ kind: 'circle', x: 520, y: 960, r: 28 }, { kind: 'circle', x: 1400, y: 240, r: 28 }],
  },
};
export const MAPS: Record<MapId, MapDef> = Object.fromEntries((Object.keys(BASE) as MapId[]).map((id) => {
  const b = BASE[id]; const x = EXTRA[id];
  return [id, {
    ...b,
    obstacles: [...b.obstacles.map(sc), ...x.obstacles],
    wind: b.wind.map((w) => ({ x: w.x * K, y: w.y * K, w: w.w * K, h: w.h * K, vx: w.vx, vy: w.vy })),
    spawns: b.spawns === 'ring' ? 'ring' : b.spawns.map((p) => ({ x: p.x * K, y: p.y * K })),
    props: b.props.map((p) => ({ ...p, x: p.x * K, y: p.y * K, s: (p.s ?? 1) * 1.15 })),
    regions: x.regions, landmarks: x.landmarks,
  } satisfies MapDef];
})) as Record<MapId, MapDef>;
/** which themed region a point is in, for the "you entered…" banner and the minimap legend */
export const regionAt = (map: MapDef, x: number, y: number): Region | null => map.regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ?? null;
