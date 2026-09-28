import { buildGraph } from '../minpath/graph';
import { createRng } from '../seed';
import type { Db } from '../types';
import { generateOptions, isTerminal } from './generate';
import type { ReverseRunState, RunEvent, TreeNode } from './types';

/* ============================================================================
   RUN LOGIC — the entire pure, deterministic core. Exactly one question is
   ever live at a time (pendingQueue[0]), however many branches the tree
   has grown — answering it, right or wrong, always reveals the real
   recipe and expands into it, since this mode's whole point is teaching
   the real chain, never gatekeeping it behind a correct guess.
   ========================================================================== */

export type ReverseAction =
  | { kind: 'submit'; selectedIds: string[] }
  | { kind: 'reveal' };

/** True once a finished run stopped because the node budget ran out,
 *  never because every remaining branch genuinely bottomed out at a
 *  primitive — every curated target in lib/reverseevolution/catalog.ts
 *  is deep enough that this is the common case, so the UI must never
 *  claim "reached raw materials" without checking it first. */
export function isBudgetCapped(state: ReverseRunState): boolean {
  return state.nodesUsed >= state.nodeBudget;
}

function clone(s: ReverseRunState): ReverseRunState { return JSON.parse(JSON.stringify(s)); }

export function applyAction(db: Pick<Db, 'nodes'>, input: ReverseRunState, action: ReverseAction): { state: ReverseRunState; events: RunEvent[] } {
  const state = clone(input);
  const events: RunEvent[] = [];
  const log = (text: string) => { events.push({ text }); state.log = [...state.log, { text }].slice(-40); };

  if (state.ending !== 'ongoing') { log('This run is already complete.'); return { state, events }; }
  const currentKey = state.pendingQueue[0];
  if (!currentKey) { log('Nothing left to answer.'); return { state, events }; }

  const byId = new Map(db.nodes.map(n => [n.id, n]));
  const node = state.nodes[currentKey];
  const target = byId.get(node.discoveryId)!;
  const correctIds = target.rec![0];
  const correctSet = new Set(correctIds);

  if (action.kind === 'submit') {
    const selSet = new Set(action.selectedIds);
    const isMatch = selSet.size === correctSet.size && [...selSet].every(id => correctSet.has(id));
    if (isMatch) { node.status = 'correct'; state.correctCount++; log(`Correct — ${target.n} really was made from ${correctIds.map(id => byId.get(id)?.n ?? id).join(' + ')}.`); }
    else { node.status = 'revealed'; state.revealedCount++; log(`Not quite — ${target.n} was actually made from ${correctIds.map(id => byId.get(id)?.n ?? id).join(' + ')}.`); }
  } else {
    node.status = 'revealed';
    state.revealedCount++;
    log(`${target.n} was made from ${correctIds.map(id => byId.get(id)?.n ?? id).join(' + ')}.`);
  }
  node.correctIds = correctIds;
  state.pendingQueue.shift();

  const graph = buildGraph(db);
  // Dedupe a repeated ingredient ("Stone + Stone") to one child branch —
  // matching generateOptions's own dedup, and not spending two slots of
  // the node budget on what is really one distinct thing to trace.
  for (const childId of new Set(correctIds)) {
    if (state.nodesUsed >= state.nodeBudget) break;
    const childDiscovery = byId.get(childId);
    const key = `n${state.nodesUsed}`;
    state.nodesUsed++;
    const terminal = isTerminal(childDiscovery);
    const childNode: TreeNode = {
      key, discoveryId: childId, status: terminal ? 'primitive' : 'pending',
      parentKey: currentKey, childKeys: [], optionIds: null, correctIds: null,
    };
    node.childKeys.push(key);
    state.nodes[key] = childNode;
    if (!terminal) {
      const rng = createRng(`${state.seed}:${key}`);
      childNode.optionIds = generateOptions(db, graph, rng, childId, childDiscovery!.rec![0]);
      state.pendingQueue.push(key);
    }
  }

  if (state.pendingQueue.length === 0) {
    state.ending = 'complete';
    log(isBudgetCapped(state)
      ? 'This run’s tracing limit is reached — the real chain goes deeper than this session followed it.'
      : 'The chain bottoms out in raw materials — run complete.');
  }

  return { state, events };
}
