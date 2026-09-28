import { reachableRegions } from '../trade/gate';
import { originOf } from '../trade/regions';
import type { GeoId, TradeRoute } from '../trade/types';
import type { Discovery } from '../types';
import type { FragilityCause, ResilienceFactor, ResilienceScore, ResilienceState } from './types';

/* ============================================================================
   RESILIENCE — how hard a piece of knowledge would be to lose, if this game
   ever models loss. A deterministic, explainable score built only from
   already-sourced data (data/majors.json's certainty/geo, the discovery's
   own `rec`/`cat`) plus, when Trade Routes is on, how many regions the
   player's network already reaches — establishing a route to somewhere a
   fragile discovery originates measurably improves its resilience, which is
   the systemic link the brief asks Lost Knowledge to have with trade.

   The 0–1 score is internal only (see RESILIENCE_NOTES / resilienceLabel in
   the UI layer) — the player only ever sees the qualitative state and the
   plain-language causes below, never the number.
   ========================================================================== */

export const RESILIENCE_NOTES: Record<FragilityCause, string> = {
  'single-region': 'Only documented in one region so far — nothing has carried it elsewhere yet.',
  'undocumented': 'Understood and practiced, not written down — it survives only as long as someone remembers it.',
  'low-redundancy': 'Only one known way to it — no alternate route would preserve it if this one were forgotten.',
  'isolated-dependency': 'Leans on another discovery that is itself uncommon.',
};

const WEIGHTS: Record<FragilityCause, number> = {
  'single-region': 0.35,
  'undocumented': 0.25,
  'low-redundancy': 0.25,
  'isolated-dependency': 0.15,
};

const ORAL_CATEGORIES = new Set(['knowledge', 'culture', 'society']);

function stateFor(score: number): ResilienceState {
  if (score >= 0.66) return 'stable';
  if (score >= 0.33) return 'fragile';
  return 'at-risk';
}

export function scoreResilience(
  discovery: Discovery,
  byId: (id: string) => Discovery | undefined,
  opts: { homeRegion?: GeoId | null; routes?: readonly TradeRoute[] } = {},
): ResilienceScore {
  const factors: ResilienceFactor[] = [];
  const add = (cause: FragilityCause) => factors.push({ cause, note: RESILIENCE_NOTES[cause] });

  const origin = originOf(discovery.id);
  if (origin) {
    const home = opts.homeRegion ?? null;
    const reached = home ? reachableRegions(home, opts.routes ?? []) : null;
    // Still confined to its one documented region: no home region tracked yet
    // (trade layer off), or trade tracks a home region that has not reached it.
    if (!reached || !reached.has(origin.region)) add('single-region');
  }

  if (ORAL_CATEGORIES.has(discovery.cat) && !discovery.primitive) add('undocumented');

  if (!discovery.primitive && (discovery.rec?.length ?? 0) <= 1 && !(discovery.via?.length)) add('low-redundancy');

  const firstRecipe = discovery.rec?.[0];
  if (firstRecipe?.some(ingId => {
    const ing = byId(ingId);
    return ing && (ing.rar === 'rare' || ing.rar === 'hidden');
  })) add('isolated-dependency');

  const score = Math.max(0, 1 - factors.reduce((s, f) => s + WEIGHTS[f.cause], 0));
  return { discoveryId: discovery.id, state: stateFor(score), score, factors };
}
