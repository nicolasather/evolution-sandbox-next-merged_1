/* Small derived-progress helpers shared by the runtime, the journey and the share card. */
import type { Engine } from '../engine';
import type { Discovery } from '../types';

/** Discoveries the player has actually made: raw materials and worked states are not counted. */
export function madeDiscoveries(engine: Engine): Discovery[] {
  const prim = new Set(engine.db.primitives);
  const out: Discovery[] = [];
  for (const id of engine.order) {
    const n = engine.get(id);
    if (n && !n.state && !prim.has(id)) out.push(n);
  }
  return out;
}
export function personalCount(engine: Engine): number {
  const prim = new Set(engine.db.primitives);
  let c = 0;
  for (const id of engine.order) { const n = engine.get(id); if (n && !n.state && !prim.has(id)) c++; }
  return c;
}
