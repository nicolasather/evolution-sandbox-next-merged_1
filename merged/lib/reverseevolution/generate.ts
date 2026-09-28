import { buildGraph, type MinPathGraph } from '../minpath/graph';
import { createRng, type Rng } from '../seed';
import type { Db, Discovery } from '../types';
import type { ReverseRunState, TreeNode } from './types';

/* ============================================================================
   RUN GENERATION — builds the root question for one target discovery.
   Every function here takes `db` as an explicit parameter (never imports
   the play database itself), the same dependency-injection discipline
   lib/minpath/*.ts already established, so this stays testable against a
   small fixture database and honest about depending on Main Evolution's
   real, canonical data rather than an authored copy of it.
   ========================================================================== */

const NODE_BUDGET = 14;
const MIN_OPTIONS = 6;

export function isTerminal(node: Discovery | undefined): boolean {
  return !node || !!node.primitive || !node.rec || node.rec.length === 0;
}

/** Real ingredients plus plausible-but-wrong distractors drawn from
 *  nearby real graph structure (2 hops out in the same undirected
 *  prerequisite graph lib/minpath/graph.ts builds) — never invented
 *  names, always other real discoveries, shuffled once and then fixed. */
export function generateOptions(db: Pick<Db, 'nodes'>, graph: MinPathGraph, rng: Rng, discoveryId: string, correctIds: string[]): string[] {
  // A recipe may repeat an ingredient ("Stone + Stone") — the quiz asks
  // which DISTINCT discoveries it took, not how many of each, so the
  // option pool (and the correctness check in simulate.ts) both work off
  // the deduplicated set. Without this, a repeated ingredient would show
  // as two identical option buttons sharing one id.
  const uniqueCorrect = [...new Set(correctIds)];
  const byId = new Map(db.nodes.map(n => [n.id, n]));
  const nearby = new Set<string>();
  for (const nb of graph.neighbors.get(discoveryId) ?? []) {
    nearby.add(nb);
    for (const nb2 of graph.neighbors.get(nb) ?? []) nearby.add(nb2);
  }
  nearby.delete(discoveryId);
  uniqueCorrect.forEach(id => nearby.delete(id));
  let pool = [...nearby].filter(id => byId.has(id));

  const distractorCount = Math.max(2, MIN_OPTIONS - uniqueCorrect.length);
  if (pool.length < distractorCount) {
    const fallback = db.nodes
      .map(n => n.id)
      .filter(id => id !== discoveryId && !uniqueCorrect.includes(id) && !pool.includes(id));
    pool = pool.concat(rng.shuffle(fallback));
  }
  const distractors = rng.shuffle(pool).slice(0, distractorCount);
  return rng.shuffle([...uniqueCorrect, ...distractors]);
}

export function generateRun(db: Pick<Db, 'nodes'>, seed: string, targetId: string): ReverseRunState {
  const byId = new Map(db.nodes.map(n => [n.id, n]));
  const target = byId.get(targetId);
  if (!target) throw new Error(`generateRun: unknown target "${targetId}"`);
  if (isTerminal(target)) throw new Error(`generateRun: target "${targetId}" has no recipe to decompose`);

  const graph = buildGraph(db);
  const rng = createRng(`${seed}:n0`);
  const correctIds = target.rec![0];
  const root: TreeNode = {
    key: 'n0', discoveryId: targetId, status: 'pending', parentKey: null, childKeys: [],
    optionIds: generateOptions(db, graph, rng, targetId, correctIds), correctIds: null,
  };

  return {
    seed, targetId,
    nodes: { n0: root },
    pendingQueue: ['n0'],
    nodeBudget: NODE_BUDGET,
    nodesUsed: 1,
    ending: 'ongoing',
    correctCount: 0,
    revealedCount: 0,
    log: [{ text: `Tracing ${target.n} back toward its raw origins.` }],
  };
}
