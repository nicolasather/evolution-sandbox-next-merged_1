import { dailyRng } from '../seed';
import { buildGraph } from './graph';
import { shortestPath } from './pathfind';
import { hubIds, pathLeansOnHub } from './validate';
import type { Db } from '../types';
import type { Rng } from '../seed';

export interface MinPathChallenge {
  startId: string;
  targetId: string;
  /** The shortest possible number of clicks — never shown to the player
   *  until they finish (see components/minpath/). */
  optimalLength: number;
}

/** Picks a deterministic, fair (no hub-shortcut) start/target pair from a
 *  given Rng. Bounded attempts so it always terminates; falls back to a
 *  hub-leaning pair only if nothing better turns up (keeps this from ever
 *  failing outright on a small or unusual database). */
export function pickChallenge(
  db: Pick<Db, 'nodes'>,
  rng: Rng,
  opts: { minHops?: number; maxHops?: number } = {},
): MinPathChallenge | null {
  const graph = buildGraph(db);
  const hubs = hubIds(graph);
  const candidates = db.nodes.filter(n => !n.primitive && !n.hidden && graph.neighbors.has(n.id));
  if (candidates.length < 2) return null;
  const minHops = opts.minHops ?? 3;
  const maxHops = opts.maxHops ?? 8;
  let fallback: MinPathChallenge | null = null;
  for (let i = 0; i < 200; i++) {
    const a = rng.pick(candidates);
    const b = rng.pick(candidates);
    if (a.id === b.id) continue;
    const path = shortestPath(graph, a.id, b.id);
    if (!path) continue;
    const hops = path.length - 1;
    if (hops < minHops || hops > maxHops) continue;
    const challenge: MinPathChallenge = { startId: a.id, targetId: b.id, optimalLength: hops };
    if (!pathLeansOnHub(path, hubs)) return challenge;
    fallback ??= challenge;
  }
  return fallback;
}

/** Today's challenge (UTC calendar day) — the same for every player, and
 *  stable for the whole day regardless of when in the day they play. */
export function dailyChallenge(db: Pick<Db, 'nodes'>, date: Date = new Date()): MinPathChallenge | null {
  return pickChallenge(db, dailyRng('minimum-path', date));
}
