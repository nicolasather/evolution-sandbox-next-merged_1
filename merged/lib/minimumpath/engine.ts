import type { Content, Graph, Mission, Run, Save } from '@/lib/minimumpath/types';
export function buildGraph(content: Content): Graph {
  const items = new Map(content.items.map(item => [item.id, item]));
  const forward = new Map(content.items.map(item => [item.id, new Set<string>()]));
  const both = new Map(content.items.map(item => [item.id, new Set<string>()]));
  for (const item of content.items) for (const recipe of item.recipes) for (const id of recipe) {
    if (id === item.id || !items.has(id)) continue;
    forward.get(id)?.add(item.id);
    both.get(id)?.add(item.id);
    both.get(item.id)?.add(id);
  }
  const sorted = (map: Map<string, Set<string>>) => new Map([...map].map(([id, set]) => [id, [...set].sort()]));
  return { items, forward: sorted(forward), both: sorted(both) };
}
export function neighbors(graph: Graph, mission: Mission, id: string): string[] {
  return (graph[mission.direction].get(id) ?? []).filter(next => !mission.blocked.includes(next));
}
export function isComplete(mission: Mission, path: string[]): boolean {
  return path.at(-1) === mission.target && mission.via.every(id => path.includes(id));
}
/** BFS over (node, visited-waypoints), not just node. Every edge has unit cost. */
export function shortest(graph: Graph, mission: Mission, prefix: string[] = [mission.start]): string[] | null {
  const start = prefix.at(-1);
  if (!start || !graph.items.has(start) || !graph.items.has(mission.target) || mission.blocked.includes(start)) return null;
  const maskOf = (path: string[]) => mission.via.reduce((mask, id, i) => path.includes(id) ? mask | (1 << i) : mask, 0);
  const full = (1 << mission.via.length) - 1;
  const initial = { id: start, mask: maskOf(prefix), parent: -1 };
  const queue = [initial];
  const seen = new Set([`${initial.id}:${initial.mask}`]);
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    if (state.id === mission.target && state.mask === full) {
      const path: string[] = [];
      for (let i = head; i >= 0; i = queue[i].parent) path.push(queue[i].id);
      return path.reverse();
    }
    for (const id of neighbors(graph, mission, state.id)) {
      const mask = state.mask | maskOf([id]);
      const key = `${id}:${mask}`;
      if (!seen.has(key)) { seen.add(key); queue.push({ id, mask, parent: head }); }
    }
  }
  return null;
}
export function startRun(mission: Mission): Run { return { missionId: mission.id, path: [mission.start], assisted: false }; }
export function validPath(graph: Graph, mission: Mission, path: string[], max: number): boolean {
  return path.length > 0 && path.length <= max && path[0] === mission.start && !mission.blocked.includes(path[0]) &&
    path.every((id, i) => graph.items.has(id) && (i === 0 ||
      (!isComplete(mission, path.slice(0, i)) && neighbors(graph, mission, path[i - 1]).includes(id))));
}
export function move(graph: Graph, mission: Mission, run: Run, next: string, max: number): Run {
  if (run.missionId !== mission.id || isComplete(mission, run.path) || run.path.length >= max ||
      !neighbors(graph, mission, run.path.at(-1) ?? '').includes(next)) return run;
  return { ...run, path: [...run.path, next] };
}
export function recordResult(save: Save, mission: Mission): Save {
  const run = save.run;
  if (!run || run.missionId !== mission.id || !isComplete(mission, run.path)) return save;
  // Keep separate assisted/unassisted records. Hints never replace an unassisted result.
  const old = save.records.find(r => r.missionId === mission.id && r.assisted === run.assisted);
  if (old && old.path.length <= run.path.length) return save;
  return { ...save, records: [...save.records.filter(r => r !== old), { ...run, path: [...run.path] }] };
}
export function evidence(graph: Graph, from: string, to: string): string[] {
  const result: string[] = [];
  for (const [input, output] of [[from, to], [to, from]]) {
    const item = graph.items.get(output);
    for (const recipe of item?.recipes ?? []) if (recipe.includes(input)) {
      result.push(`${recipe.map(id => graph.items.get(id)?.name ?? id).join(' + ')} → ${item?.name ?? output}`);
    }
  }
  return [...new Set(result)];
}
