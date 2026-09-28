import type { MinPathGraph } from './graph';

export interface MinPathSession {
  startId: string;
  targetId: string;
  /** Every node visited, including both endpoints, in click order. */
  path: string[];
  done: boolean;
}

export function startSession(startId: string, targetId: string): MinPathSession {
  return { startId, targetId, path: [startId], done: startId === targetId };
}

/** The only nodes the player may click next — the current node's real
 *  graph neighbours. Never a global search; no teleporting. */
export function neighborsOf(graph: MinPathGraph, session: MinPathSession): string[] {
  const cur = session.path[session.path.length - 1];
  return [...(graph.neighbors.get(cur) ?? [])];
}

export type StepResult =
  | { ok: true; session: MinPathSession }
  | { ok: false; reason: 'not-adjacent' | 'already-done' };

export function step(graph: MinPathGraph, session: MinPathSession, nextId: string): StepResult {
  if (session.done) return { ok: false, reason: 'already-done' };
  const cur = session.path[session.path.length - 1];
  if (!graph.neighbors.get(cur)?.has(nextId)) return { ok: false, reason: 'not-adjacent' };
  const path = [...session.path, nextId];
  return { ok: true, session: { ...session, path, done: nextId === session.targetId } };
}

export const clicksOf = (session: MinPathSession): number => session.path.length - 1;
