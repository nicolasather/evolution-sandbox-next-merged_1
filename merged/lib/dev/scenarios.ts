import type { Engine } from '@/lib/engine';
import type { EraId } from '@/lib/types';
import { devOverrides } from './overrides';

/* ============================================================================
   TEST SCENARIOS — "start me at an early / middle / late point of the game".

   A scenario is NOT a hand-written save. It starts from a blank Main Evolution
   and plays the game for the tester through the Engine's own public actions
   (combineMany for recipes, process for worked routes), era by era, until
   nothing more can be made inside the chosen era. So every discovery it leaves
   behind has a real recipe step, a real "found" time and the real world/unlock
   side effects — the same record a player's own play would leave. The only
   thing the beta bypasses is the clock-gate, and that only while the runner
   runs (devOverrides.withChronology).
   ========================================================================== */

export interface Scenario {
  id: 'early' | 'middle' | 'late';
  label: string;
  /** Last era the fast-forward may reach (inclusive). */
  untilEra: EraId;
  /** Stop after this many new discoveries (the Stone Age alone holds ~680, so "early" needs a count, not an era). */
  maxMade?: number;
  description: string;
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'early', label: 'Sớm — 25 phát hiện', untilEra: 'origins', maxMade: 25,
    description: 'Game mới, chơi tới 25 phát hiện đầu: mở Archive, Graph, Quiz, Journal, Hub và Survival theo tiến trình thật.' },
  { id: 'middle', label: 'Giữa — hết Civilization', untilEra: 'civilization',
    description: 'Tới hết thời đại Civilization: mở Timeline, Museum, World, Archaeologist và mode Civilization.' },
  { id: 'late', label: 'Muộn — tới cuối', untilEra: 'simulation',
    description: 'Chơi tới thời đại cuối (Simulation): mọi mode, mọi tính năng đều mở theo tiến trình thật.' },
];

export interface FastForwardResult {
  /** New discoveries made by the runner. */
  made: number;
  passes: number;
  /** Furthest era with something found, as an id. */
  reachedEra: string;
  /** True when it stopped because nothing more could be made inside the limit (as opposed to the safety cap). */
  settled: boolean;
}

const MAX_PASSES = 400;

/**
 * Play the game forward without a player. Deterministic: nodes are tried in
 * catalogue order, the first recipe whose ingredients are all held wins.
 * Does nothing outside an authorised beta (the Engine refuses to be driven past
 * its gates then, and `withChronology` is a no-op).
 */
export function fastForward(engine: Engine, untilEra: EraId, maxMade = Infinity): FastForwardResult {
  const eras = engine.db.eras.map(e => e.id);
  const limit = Math.max(0, eras.indexOf(untilEra));
  const eraRank = (id: EraId) => eras.indexOf(id);
  const nodes = [...engine.db.nodes, ...(engine.db.states ?? [])]
    .filter(n => eraRank(n.era) <= limit)
    .sort((a, b) => a.no - b.no);

  const before = engine.found.size;
  let passes = 0;
  let settled = false;

  devOverrides.withChronology(() => {
    for (; passes < MAX_PASSES; passes++) {
      const size = engine.found.size + engine.states.size;
      for (const n of nodes) {
        if (engine.found.size - before >= maxMade) break;
        // worked routes: one held piece + a technique (+ a held tool)
        for (const v of n.via ?? []) {
          const have = n.state ? engine.states.has(n.id) : engine.found.has(n.id);
          if (!have && engine.canWork(v)) engine.process(v.from, v.action);
        }
        // assembled recipes: every ingredient held
        if (!n.state && !engine.found.has(n.id)) {
          for (const r of n.rec ?? []) {
            if (r.length >= 2 && r.length <= 5 && r.every(id => engine.holds(id))) {
              const res = engine.combineMany(r);
              if (res.status === 'new') break;
            }
          }
        }
      }
      if (engine.found.size - before >= maxMade) { settled = true; break; }
      if (engine.found.size + engine.states.size === size) { settled = true; break; }
    }
  });

  engine.devSettle();

  let reached = 0;
  for (const id of engine.found) reached = Math.max(reached, eraRank(engine.byId[id].era));
  return { made: engine.found.size - before, passes, reachedEra: eras[reached] ?? eras[0], settled };
}

/** Blank Main Evolution, then play it forward to the scenario's era. */
export function runScenario(engine: Engine, scenario: Scenario): FastForwardResult {
  engine.reset();
  return fastForward(engine, scenario.untilEra, scenario.maxMade);
}
