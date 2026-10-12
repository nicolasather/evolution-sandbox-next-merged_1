import { type District, type Layout, type Link, type LinkFlow, type ResourceId } from './schema';

/* ============================================================================
   LIFELINES NETWORK — deterministic bounded max-flow over a tiny district graph.

   The data layer decides that six units crossed a link; the renderer only
   illustrates that result. Nothing here reads positions, animation time or
   object iteration order: nodes and arcs are processed in stable id order, so
   two equally short routes always resolve the same way (Edmonds–Karp: BFS in
   id order, augment by the bottleneck).

   Undirected links are a pair of mutually reversing arcs, so opposite flows of
   the same commodity cancel, and the traffic a link carries is the NET flow.
   Traffic accumulates across services in one season, so a link's capacity is
   shared by everything that travels over it.
   ========================================================================== */

interface Edge { to: number; cap: number; rev: number; linkId: string | null; orig: number }

export interface FlowResult {
  total: number;
  /** Amount drawn from each source node id. */
  drawn: Map<string, number>;
  /** Amount absorbed by each sink node id. */
  absorbed: Map<string, number>;
  /** Net flow per link id in canonical a→b direction (negative means b→a). */
  net: Map<string, number>;
}

interface FlowArc { linkId: string; from: string; to: string; cap: number; directed: boolean }

/** Max flow from `sources` (node → available) to `sinks` (node → wanted) over `arcs`. Pure and deterministic. */
export function maxFlow(
  nodeIds: readonly string[],
  arcs: readonly FlowArc[],
  sources: ReadonlyMap<string, number>,
  sinks: ReadonlyMap<string, number>,
): FlowResult {
  const ids = [...nodeIds].sort();
  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length, S = n, T = n + 1;
  const g: Edge[][] = Array.from({ length: n + 2 }, () => []);
  const link = (u: number, v: number, cap: number, back: number, linkId: string | null) => {
    g[u].push({ to: v, cap, rev: g[v].length, linkId, orig: cap });
    g[v].push({ to: u, cap: back, rev: g[u].length - 1, linkId, orig: back });
  };
  const linkEdge = new Map<string, { u: number; k: number; a: string }>();
  for (const arc of [...arcs].sort((x, y) => (x.linkId < y.linkId ? -1 : x.linkId > y.linkId ? 1 : 0))) {
    const u = idx.get(arc.from), v = idx.get(arc.to);
    if (u === undefined || v === undefined || u === v || arc.cap <= 0) continue;
    link(u, v, arc.cap, arc.directed ? 0 : arc.cap, arc.linkId);
    linkEdge.set(arc.linkId, { u, k: g[u].length - 1, a: arc.from });
  }
  const sinkEdge = new Map<string, { u: number; k: number }>();
  const sourceEdge = new Map<string, number>();
  for (const id of ids) {
    const s = sources.get(id) ?? 0;
    if (s > 0) { link(S, idx.get(id) as number, s, 0, null); sourceEdge.set(id, g[S].length - 1); }
  }
  for (const id of ids) {
    const w = sinks.get(id) ?? 0;
    if (w > 0) { const u = idx.get(id) as number; link(u, T, w, 0, null); sinkEdge.set(id, { u, k: g[u].length - 1 }); }
  }

  let total = 0;
  for (;;) {
    const prev: ({ u: number; k: number } | null)[] = new Array(n + 2).fill(null);
    const seen = new Array<boolean>(n + 2).fill(false);
    const queue = [S]; seen[S] = true;
    for (let qi = 0; qi < queue.length && !seen[T]; qi++) {
      const u = queue[qi];
      for (let k = 0; k < g[u].length; k++) {
        const e = g[u][k];
        if (e.cap > 0 && !seen[e.to]) { seen[e.to] = true; prev[e.to] = { u, k }; queue.push(e.to); }
      }
    }
    if (!seen[T]) break;
    let bottleneck = Infinity;
    for (let v = T; v !== S;) { const p = prev[v] as { u: number; k: number }; bottleneck = Math.min(bottleneck, g[p.u][p.k].cap); v = p.u; }
    for (let v = T; v !== S;) {
      const p = prev[v] as { u: number; k: number };
      const e = g[p.u][p.k];
      e.cap -= bottleneck; g[e.to][e.rev].cap += bottleneck; v = p.u;
    }
    total += bottleneck;
  }

  const drawn = new Map<string, number>();
  for (const [id, k] of sourceEdge) drawn.set(id, g[S][k].orig - g[S][k].cap);
  const absorbed = new Map<string, number>();
  for (const [id, { u, k }] of sinkEdge) absorbed.set(id, g[u][k].orig - g[u][k].cap);
  const net = new Map<string, number>();
  for (const [linkId, { u, k }] of linkEdge) {
    const e = g[u][k];
    const flow = e.orig - e.cap; // may be negative for undirected links
    if (flow !== 0) net.set(linkId, flow);
  }
  return { total, drawn, absorbed, net };
}

/* ------------------------------ link helpers ----------------------------- */

export function linkOther(l: Link, id: string): string { return l.a === id ? l.b : l.a; }

/** Effective capacity of a link this season: base capacity (+ boosts) scaled by condition. */
export function effectiveCapacity(l: Link, boost = 0): number {
  return Math.floor(((l.capacity + boost) * l.condition) / 1000);
}

export function serviceLinks(layout: Layout, service: ResourceId): Link[] {
  return layout.links.filter(l => l.supports.includes(service));
}

/** Districts reachable from `start` over links that carry `service`, ignoring capacity. */
export function reachableDistricts(layout: Layout, service: ResourceId, start: string): Set<string> {
  const links = serviceLinks(layout, service);
  const seen = new Set<string>([start]);
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (const l of links) {
      if (l.a !== cur && l.b !== cur) continue;
      if (l.directed && l.a !== cur) continue;
      const next = linkOther(l, cur);
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

/** Fewest-hop path (link ids) between two districts over links that carry `service`; stable by link id. */
export function shortestLinkPath(layout: Layout, service: ResourceId, from: string, to: string): string[] | null {
  if (from === to) return [];
  const links = serviceLinks(layout, service).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const prev = new Map<string, { node: string; linkId: string }>();
  const seen = new Set<string>([from]);
  const queue = [from];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (const l of links) {
      if (l.a !== cur && l.b !== cur) continue;
      if (l.directed && l.a !== cur) continue;
      const next = linkOther(l, cur);
      if (seen.has(next)) continue;
      seen.add(next); prev.set(next, { node: cur, linkId: l.id });
      if (next === to) {
        const path: string[] = [];
        for (let c = to; c !== from;) { const p = prev.get(c) as { node: string; linkId: string }; path.unshift(p.linkId); c = p.node; }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

export function toLinkFlows(layout: Layout, service: ResourceId, net: ReadonlyMap<string, number>): LinkFlow[] {
  const out: LinkFlow[] = [];
  for (const l of [...layout.links].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const f = net.get(l.id);
    if (!f) continue;
    out.push(f > 0
      ? { linkId: l.id, service, from: l.a, to: l.b, amount: f }
      : { linkId: l.id, service, from: l.b, to: l.a, amount: -f });
  }
  return out;
}

export function districtName(layout: Layout, id: string): string {
  return layout.districts.find((d: District) => d.id === id)?.name ?? id;
}
