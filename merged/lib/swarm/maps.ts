/** Three authored arenas. World is 960×600 logical units; the beacon sits at (480,300). Only `obstacles` collide on the server;
 *  `props` are decoration drawn under entities and are never solid. The renderer draws exactly this data. */
import type { MapId } from './domain';
import { WORLD } from './balance';

export type Obstacle = { kind: 'rect'; x: number; y: number; w: number; h: number } | { kind: 'circle'; x: number; y: number; r: number };
export type Wind = { x: number; y: number; w: number; h: number; vx: number; vy: number };
export type MapDef = {
  id: MapId; title: string; blurb: string; ground: string; ground2: string; lane: string; ink: string; accent: string; danger: string;
  obstacles: Obstacle[]; wind: Wind[]; spawns: { x: number; y: number }[] | 'ring'; props: { kind: string; x: number; y: number; s?: number }[];
};
export const MAPS: Record<MapId, MapDef> = {
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
