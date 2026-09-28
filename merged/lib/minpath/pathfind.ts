import type { MinPathGraph } from './graph';

/** Breadth-first shortest path (fewest hops, unweighted) between two nodes
 *  in the graph. Returns the full node-id sequence including both
 *  endpoints, or null if either endpoint is missing from the graph or no
 *  path connects them. Deterministic given the graph — BFS explores each
 *  node's neighbours in the same (Set-insertion) order every time. */
export function shortestPath(graph: MinPathGraph, start: string, target: string): string[] | null {
  if (start === target) return [start];
  if (!graph.neighbors.has(start) || !graph.neighbors.has(target)) return null;
  const prev = new Map<string, string>();
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const next of graph.neighbors.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === target) {
        const path = [target];
        let c = target;
        while (c !== start) { c = prev.get(c)!; path.push(c); }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}
