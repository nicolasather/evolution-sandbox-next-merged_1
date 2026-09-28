import type { Migratable } from '../save/types';

/* ============================================================================
   REVERSE EVOLUTION — "From Smartphone to Stone". A seventh genuinely
   different interaction language: not crafting (combine two things
   forward), not a single shortest path (Minimum Path), but a multiple-
   choice tree-decomposition quiz over the REAL 322-node discovery graph
   — the first mode to operate on Main Evolution's own canonical
   database rather than an authored/procedural catalog of its own. Start
   at one real, recognisable complex discovery; at each node, choose
   which real discoveries it was actually combined from, out of a set
   that includes real plausible distractors; wrong guesses are revealed
   immediately with the real answer, since this mode's whole point is
   teaching the real dependency chain, not gatekeeping it. See
   docs/ROADMAP-UNIVERSE.md's Reverse Evolution section for scope.
   ========================================================================== */

export type NodeStatus = 'pending' | 'correct' | 'revealed' | 'primitive' | 'unexplored';

export interface TreeNode {
  key: string;
  discoveryId: string;
  status: NodeStatus;
  parentKey: string | null;
  childKeys: string[];
  /** The multiple-choice pool shown for this node's question — real
   *  ingredients plus distractors, shuffled once and then fixed. Null
   *  until this node is actually reached (lazy, so RNG draws happen in
   *  real generation order, not all up front). */
  optionIds: string[] | null;
  /** The real ingredient set this node actually expands into, once
   *  answered (right or wrong) — always a real recipe from the
   *  database, never invented. */
  correctIds: string[] | null;
}

export interface RunEvent { text: string }

export interface ReverseRunState {
  seed: string;
  targetId: string;
  nodes: Record<string, TreeNode>;
  /** FIFO of node keys still awaiting a question — the node at index 0
   *  is always "the current question," so only one question is ever
   *  live at once despite the tree branching. */
  pendingQueue: string[];
  nodeBudget: number;
  nodesUsed: number;
  ending: 'ongoing' | 'complete';
  correctCount: number;
  revealedCount: number;
  log: RunEvent[];
}

export interface ReverseMemory {
  id: string;
  seed: string;
  targetId: string;
  correctCount: number;
  revealedCount: number;
  headline: string;
  completedAt: number;
  /** Computed once, at archive time, from every node the run actually
   *  touched (lib/reverseevolution/memory.ts's runSourceIds) — the full
   *  ReverseRunState this was aggregated from is discarded on archive,
   *  same as every other mode's memory, so this is captured here rather
   *  than recomputed later from data that no longer exists. */
  sourceIds: string[];
}

export interface ReverseEvolutionSave extends Migratable {
  v: 1;
  active: ReverseRunState | null;
  runs: ReverseMemory[];
}
