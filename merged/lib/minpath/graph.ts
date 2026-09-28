import type { Db } from '../types';

/* ============================================================================
   MINIMUM PATH — GRAPH. An undirected "prerequisite" graph: a discovery is
   connected to every ingredient of every recipe it has. This is the
   standard, single, well-defined edge type the brief asks the base mode to
   use, so every player's click count is comparable — not a mix of
   prerequisite/chronological/related edges at once.
   ========================================================================== */

export interface MinPathGraph {
  neighbors: Map<string, Set<string>>;
  nodeIds: string[];
}

export function buildGraph(db: Pick<Db, 'nodes'>): MinPathGraph {
  const neighbors = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!neighbors.has(a)) neighbors.set(a, new Set());
    if (!neighbors.has(b)) neighbors.set(b, new Set());
    neighbors.get(a)!.add(b);
    neighbors.get(b)!.add(a);
  };
  for (const n of db.nodes) {
    for (const rec of n.rec ?? []) {
      for (const ing of rec) {
        if (ing !== n.id) add(n.id, ing);
      }
    }
  }
  return { neighbors, nodeIds: [...neighbors.keys()] };
}

export function degreeOf(graph: MinPathGraph, id: string): number {
  return graph.neighbors.get(id)?.size ?? 0;
}
