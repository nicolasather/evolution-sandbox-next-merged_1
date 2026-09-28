import type { Terrain, TileKind } from './types';

/** The nearest tile of a given kind to the camp (Manhattan distance,
 *  ties broken by scan order — deterministic). Assignment UI uses this so
 *  the player picks a task kind, not a specific tile, while the result
 *  still comes from the real generated map. Returns null if the terrain
 *  has none of that kind (shouldn't happen for water/woodland — see
 *  generate.ts's guarantee — but always checked defensively). */
export function nearestTileOfKind(terrain: Terrain, kind: TileKind): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let y = 0; y < terrain.height; y++) {
    for (let x = 0; x < terrain.width; x++) {
      if (terrain.tiles[y][x] !== kind) continue;
      const dist = Math.abs(x - terrain.campX) + Math.abs(y - terrain.campY);
      if (dist < bestDist) { bestDist = dist; best = { x, y }; }
    }
  }
  return best;
}
