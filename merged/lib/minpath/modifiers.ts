import type { Db, EraId } from '../types';
import type { MinPathGraph } from './graph';
import type { MinPathSession } from './session';

/* ============================================================================
   MINIMUM PATH — CHALLENGE-MODIFIER VARIANTS. The brief's own four:
   no-backtracking, chronological-only, exactly-N-clicks, visit-an-era.
   Every modifier only ever NARROWS which of the graph's real edges are
   legal to click next, or adds a further condition on top of "reached
   the target" — never a new edge, never a shortcut. The base Minimum
   Path mode (lib/minpath/session.ts, daily.ts) is untouched; these are
   additive, opt-in, and only reached through the variant picker.
   ========================================================================== */

export type PathModifier =
  | { kind: 'no-backtracking' }
  | { kind: 'chronological-only' }
  | { kind: 'exactly-n-clicks'; n: number }
  | { kind: 'visit-an-era'; era: EraId };

export type ModifierKind = PathModifier['kind'];

export const MODIFIER_LABEL: Record<ModifierKind, string> = {
  'no-backtracking': 'No backtracking',
  'chronological-only': 'Chronological only',
  'exactly-n-clicks': 'Exactly N clicks',
  'visit-an-era': 'Visit an era',
};

export const MODIFIER_BLURB: Record<ModifierKind, string> = {
  'no-backtracking': 'Once you leave a discovery, you can never click back to it — every click has to move you forward.',
  'chronological-only': 'Every click must move to something dated the same or later — never back in time.',
  'exactly-n-clicks': 'Reaching the target early doesn’t end it — you need exactly the given number of clicks, no more, no fewer.',
  'visit-an-era': 'Your path has to pass through the named era at some point before it counts as reaching the target.',
};

function lastOf(session: MinPathSession): string { return session.path[session.path.length - 1]; }

/** Which of the graph's real neighbours the modifier still allows —
 *  always a subset of the real edges, never a new one. */
export function legalNeighbors(db: Pick<Db, 'nodes'>, graph: MinPathGraph, session: MinPathSession, modifier?: PathModifier): string[] {
  const base = [...(graph.neighbors.get(lastOf(session)) ?? [])];
  if (!modifier) return base;
  if (modifier.kind === 'no-backtracking') return base.filter(id => !session.path.includes(id));
  if (modifier.kind === 'chronological-only') {
    const byId = new Map(db.nodes.map(n => [n.id, n]));
    const curDs = byId.get(lastOf(session))?.ds ?? 0;
    return base.filter(id => (byId.get(id)?.ds ?? 0) >= curDs);
  }
  return base;
}

/** Reaching the target is necessary but, for exactly-n-clicks and
 *  visit-an-era, not always sufficient — the player may have to keep
 *  moving (or already have passed through the right era) first. */
export function isComplete(db: Pick<Db, 'nodes'>, session: MinPathSession, modifier?: PathModifier): boolean {
  if (lastOf(session) !== session.targetId) return false;
  if (!modifier) return true;
  if (modifier.kind === 'exactly-n-clicks') return session.path.length - 1 === modifier.n;
  if (modifier.kind === 'visit-an-era') {
    const byId = new Map(db.nodes.map(n => [n.id, n]));
    return session.path.some(id => byId.get(id)?.era === modifier.era);
  }
  return true;
}

/** A bounded breadth-first search over (node, path-so-far) states,
 *  legal-move-aware, that answers "does ANY path satisfying this
 *  modifier exist from start to target at all" — the same "generate,
 *  then prove it's actually solvable" discipline lib/techsudoku/
 *  generate.ts and lib/decipher/generate.ts already use, adapted to a
 *  graph search instead of a permutation check. Returns one such path,
 *  or null if none exists within `maxSteps`. */
export function findCompletingPath(
  db: Pick<Db, 'nodes'>, graph: MinPathGraph, startId: string, targetId: string,
  modifier: PathModifier | undefined, maxSteps: number,
): string[] | null {
  const seen = new Set<string>();
  const queue: string[][] = [[startId]];
  while (queue.length) {
    const path = queue.shift()!;
    const session: MinPathSession = { startId, targetId, path, done: false };
    if (isComplete(db, session, modifier)) return path;
    if (path.length - 1 >= maxSteps) continue;
    for (const next of legalNeighbors(db, graph, session, modifier)) {
      // Deduping by (node, steps-so-far) is safe for every modifier here:
      // exactly-n-clicks and visit-an-era only ever need the step count
      // and target-adjacency to decide completion (not the full history),
      // and no-backtracking's legality is already resolved per-branch by
      // legalNeighbors reading the real `path` above before this key is
      // built, so two branches sharing a key are always equally legal
      // from here on.
      const key = `${next}:${path.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([...path, next]);
    }
  }
  return null;
}
