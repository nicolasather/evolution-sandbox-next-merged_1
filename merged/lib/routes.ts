/* ============================================================================
   ROUTES — the "Explore routes" view of an exhibit.

   Everything here is computed from the recipes in the database: which pair
   makes a discovery, and, for a route the player has actually walked, the
   shortest chain of earlier discoveries standing behind it. Nothing is
   written by hand and nothing is implied about history — a recipe is a
   game's shorthand for how ideas connect.
   ========================================================================== */

import type { Engine } from './engine';
import type { Discovery } from './types';

export interface RoutePath {
  /** 1-based, as printed: PATH 01, PATH 02… */
  index: number;
  a: Discovery;
  b: Discovery;
  /** The player has made it this way. Unfound routes are shown closed. */
  found: boolean;
  /** Earlier discoveries behind this route, from a bare start to the ingredients. Empty when not found. */
  chain: Discovery[];
}

/** For every recipe of `node`, its ingredients and, when walked, the chain behind them. */
export function routePaths(engine: Engine, node: Discovery): RoutePath[] {
  const memo = new Map<string, Discovery[]>();

  /** The shallowest way back to the primitives from `id`, ancestors first. */
  const back = (id: string, guard: Set<string>): Discovery[] => {
    const hit = memo.get(id);
    if (hit) return hit;
    const n = engine.get(id);
    if (!n) return [];
    if (guard.has(id)) return [];
    guard.add(id);
    let out: Discovery[] = [];
    if (!n.primitive && n.rec?.length) {
      let best: [string, string] | null = null, bd = Infinity;
      for (const [a, b] of n.rec) {
        const d = Math.max(engine.get(a)?.depth ?? 99, engine.get(b)?.depth ?? 99);
        if (d < bd) { bd = d; best = [a, b]; }
      }
      if (best) {
        const seen = new Set<string>();
        for (const parent of best) for (const x of back(parent, guard)) if (!seen.has(x.id)) { seen.add(x.id); out.push(x); }
      }
    }
    out = out.filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i);
    out.push(n);
    guard.delete(id);
    memo.set(id, out);
    return out;
  };

  return engine.availableRecipes(node.id)
    .filter(r => r.a && r.b)
    .map((r, i) => ({ r, i }))
    .sort((p, q) => Number(q.r.found) - Number(p.r.found) || p.i - q.i)   // routes walked come first
    .map(({ r }, i) => {
      let chain: Discovery[] = [];
      if (r.found) {
        const seen = new Set<string>();
        for (const x of [...back(r.a.id, new Set()), ...back(r.b.id, new Set())]) if (!seen.has(x.id)) { seen.add(x.id); chain.push(x); }
        chain = chain.sort((p, q) => (p.depth || 0) - (q.depth || 0) || p.no - q.no);
      }
      return { index: i + 1, a: r.a, b: r.b, found: r.found, chain };
    });
}
