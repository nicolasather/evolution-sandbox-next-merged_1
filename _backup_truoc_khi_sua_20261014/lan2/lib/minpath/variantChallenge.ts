import type { Db, EraId } from '../types';
import { buildGraph } from './graph';
import { findCompletingPath, type ModifierKind, type PathModifier } from './modifiers';
import { shortestPath } from './pathfind';
import { hubIds, pathLeansOnHub } from './validate';
import type { Rng } from '../seed';

/* ============================================================================
   VARIANT CHALLENGE GENERATION — picks a start/target pair (same
   hub-avoidance discipline as lib/minpath/daily.ts's pickChallenge) and,
   for the modifiers whose legality actually changes what's reachable
   (chronological-only, exactly-n-clicks, visit-an-era), proves a real
   solution exists before ever handing the challenge to a player — the
   same "generate, then prove it's solvable" discipline lib/techsudoku/
   and lib/decipher/ already use. no-backtracking never needs this: a
   graph's own shortest path never revisits a node, so it always already
   satisfies that modifier.
   ========================================================================== */

export interface VariantChallenge {
  startId: string;
  targetId: string;
  modifier: PathModifier;
  /** The shortest length that actually satisfies the modifier — never
   *  shown to the player until they finish, same as the base mode. */
  optimalLength: number;
}

const ERAS: EraId[] = [
  'origins', 'fire', 'settlement', 'agriculture', 'civilization', 'trade',
  'metallurgy', 'science', 'industry', 'electric', 'computing', 'network', 'games', 'simulation',
];

export function pickVariantChallenge(db: Pick<Db, 'nodes'>, rng: Rng, kind: ModifierKind): VariantChallenge | null {
  const graph = buildGraph(db);
  const hubs = hubIds(graph);
  const candidates = db.nodes.filter(n => !n.primitive && !n.hidden && graph.neighbors.has(n.id));
  if (candidates.length < 2) return null;

  for (let attempt = 0; attempt < 60; attempt++) {
    const a = rng.pick(candidates);
    const b = rng.pick(candidates);
    if (a.id === b.id) continue;
    const basePath = shortestPath(graph, a.id, b.id);
    if (!basePath) continue;
    const hops = basePath.length - 1;
    if (hops < 3 || hops > 8) continue;
    if (pathLeansOnHub(basePath, hubs)) continue;

    const searchBound = hops + 6;
    let modifier: PathModifier;

    if (kind === 'no-backtracking') {
      modifier = { kind };
    } else if (kind === 'chronological-only') {
      modifier = { kind };
    } else if (kind === 'exactly-n-clicks') {
      const stretched = hops + 2;
      const stretchedWorks = !!findCompletingPath(db, graph, a.id, b.id, { kind, n: stretched }, searchBound);
      modifier = { kind, n: stretchedWorks ? stretched : hops };
    } else {
      // The required era must be a genuine waypoint, never the start's or
      // the target's own era — either would satisfy "visit an era" for
      // free (already true at 0 clicks, or automatically true on arrival
      // with no detour needed), which would make the modifier a no-op.
      const startEra = db.nodes.find(n => n.id === a.id)?.era;
      const targetEra = db.nodes.find(n => n.id === b.id)?.era;
      const isWaypointEra = (e: EraId | undefined): e is EraId => !!e && e !== startEra && e !== targetEra;

      let era: EraId | undefined;
      for (let e = 0; e < 10; e++) {
        const candidate = rng.pick(ERAS);
        if (!isWaypointEra(candidate)) continue;
        if (findCompletingPath(db, graph, a.id, b.id, { kind, era: candidate }, searchBound)) { era = candidate; break; }
      }
      if (!era) {
        era = basePath.slice(1, -1).map(id => db.nodes.find(n => n.id === id)?.era).find(isWaypointEra);
      }
      if (!era) continue;
      modifier = { kind, era };
    }

    const solved = findCompletingPath(db, graph, a.id, b.id, modifier, searchBound);
    if (!solved) continue;
    // The modifier can force a detour off basePath (already hub-checked
    // above) onto a different route — that actual solving route needs the
    // same hub-avoidance guarantee, or the challenge would be cheatable.
    if (pathLeansOnHub(solved, hubs)) continue;
    return { startId: a.id, targetId: b.id, modifier, optimalLength: solved.length - 1 };
  }
  return null;
}
