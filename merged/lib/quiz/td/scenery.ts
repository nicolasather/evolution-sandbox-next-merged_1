/** Tower Defense scenery: deterministic landmarks and edge props for each map, kept clear of the lane, the build pads, the gate and the fort.
 *  Pure data (positions in board pixels of the 1280×768 board); the canvas painter lives in components/quiz/art/props.ts. */
import { hash2, type PropKind } from '@/components/quiz/art/props';
import { MAPS, mapPath, padCenter } from './maps';
import type { TDMapId } from './domain';

export type Scenery = { kind: PropKind; x: number; y: number; size: number; seed: number; tint: number };
const W = 1280, H = 768, S = 64 / 1000;
/** which prop kits belong to which map (tiles/biome flavour) and the landmark that makes each map recognisable at a glance */
const KIT: Record<TDMapId, { fill: PropKind[]; landmarks: [PropKind, number, number, number][] }> = {
  meadow_circuit: { fill: ['tree', 'bush', 'flowers', 'rock', 'mushroom', 'fence', 'haystack', 'pine'], landmarks: [['windmill', 1120, 150, 120], ['pond', 220, 690, 120], ['cart', 640, 735, 80], ['sign', 60, 400, 80], ['banner', 1230, 600, 90]] },
  coral_quarry: { fill: ['rock', 'ruins', 'torch', 'cart', 'totem', 'crystal', 'crate', 'tent'], landmarks: [['tent', 140, 140, 110], ['totem', 1210, 130, 110], ['crystal', 640, 60, 100], ['ruins', 1100, 700, 120], ['torch', 40, 700, 90]] },
  skyworks: { fill: ['gear', 'clock', 'crate', 'barrel', 'torch', 'banner', 'cloud', 'lantern'], landmarks: [['clock', 160, 120, 130], ['gear', 1100, 90, 110], ['gear', 1210, 690, 100], ['banner', 640, 50, 100], ['lantern', 60, 600, 100]] },
};
const cache = new Map<TDMapId, Scenery[]>();
export function sceneryFor(mapId: TDMapId): Scenery[] {
  const hit = cache.get(mapId); if (hit) return hit;
  const path = mapPath(mapId); const map = MAPS[mapId]; const kit = KIT[mapId];
  const pads = map.pads.map((p) => { const [x, y] = padCenter(p); return [x * S, y * S] as const; });
  const lane = path.pts.filter((_, i) => i % 3 === 0).map(([x, y]) => [x * S, y * S] as const);
  const [gx, gy] = path.pts[0]!; const [cx, cy] = path.pts[path.pts.length - 1]!;
  const clear = (x: number, y: number, r: number) => {
    for (const [px, py] of lane) if (Math.hypot(px - x, py - y) < 66 + r) return false;
    for (const [px, py] of pads) if (Math.hypot(px - x, py - y) < 58 + r) return false;
    if (Math.hypot(gx * S - x, gy * S - y) < 120 || Math.hypot(cx * S - x, cy * S - y) < 130) return false;
    return true;
  };
  const out: Scenery[] = [];
  for (const [kind, x, y, size] of kit.landmarks) if (clear(x, y, size * 0.25)) out.push({ kind, x, y, size, seed: hash2(x, y, 1), tint: 1 });
  // a loose grid of candidates with jitter: dense near the border, sparse in the middle so the play area stays readable
  for (let gyp = 36; gyp < H - 8; gyp += 52) for (let gxp = 30; gxp < W - 10; gxp += 58) {
    const jx = gxp + (hash2(gxp, gyp, 2) - 0.5) * 40; const jy = gyp + (hash2(gxp, gyp, 3) - 0.5) * 34;
    const border = Math.min(jx, W - jx, jy, H - jy) < 150; const p = border ? 0.55 : 0.2; if (hash2(gxp, gyp, 4) > p) continue;
    const size = 56 + hash2(gxp, gyp, 5) * 42; if (!clear(jx, jy, size * 0.25)) continue;
    const kind = kit.fill[Math.floor(hash2(gxp, gyp, 6) * kit.fill.length)]!;
    out.push({ kind, x: jx, y: jy, size, seed: hash2(gxp, gyp, 7), tint: Math.floor(hash2(gxp, gyp, 8) * 6) });
  }
  out.sort((a, b) => a.y - b.y); cache.set(mapId, out); return out;
}
