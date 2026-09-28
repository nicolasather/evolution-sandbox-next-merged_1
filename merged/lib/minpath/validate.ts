import { degreeOf, type MinPathGraph } from './graph';

/* ============================================================================
   CHEAT-NODE VALIDATION — the brief warns that an overly broad category
   node (its example: "Technology") could act as a universal two-click
   bridge between any pair of discoveries, and asks for a check against it.
   This graph has no literal category nodes to click through (edges are
   always one discovery to one of its own ingredients), but the same risk
   shows up as a small number of widely-reused base materials/techniques
   acting as de facto hubs — hub detection and the "does this path lean on
   one" check below adapt the brief's concern to this graph's real shape.
   ========================================================================== */

/** Ids whose degree sits well above the graph's median — flagged for the
 *  challenge generator to avoid building "interesting-looking" pairs whose
 *  short path is actually just a cheap hub shortcut. */
export function hubIds(graph: MinPathGraph, opts: { multiplierOfMedian?: number; minDegree?: number } = {}): Set<string> {
  const degrees = graph.nodeIds.map(id => degreeOf(graph, id)).sort((a, b) => a - b);
  if (!degrees.length) return new Set();
  const median = degrees[Math.floor(degrees.length / 2)];
  const threshold = Math.max(opts.minDegree ?? 6, median * (opts.multiplierOfMedian ?? 3));
  return new Set(graph.nodeIds.filter(id => degreeOf(graph, id) >= threshold));
}

/** True when a hub sits strictly between the two endpoints of `path` — the
 *  endpoints themselves are never disqualifying, only a hub used as a
 *  shortcut in the middle. */
export function pathLeansOnHub(path: readonly string[], hubs: ReadonlySet<string>): boolean {
  return path.slice(1, -1).some(id => hubs.has(id));
}
