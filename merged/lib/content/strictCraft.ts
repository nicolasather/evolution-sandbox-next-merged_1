import type { Db } from '../types';
import { recipeKey, MIN_SLOTS, MAX_SLOTS, ITEM_ID_RE } from './recipeKey';
import { multiKey } from '../processing/overlay';

/* ============================================================================
   STRICT CRAFT PREFLIGHT  (rejection first)

     known canonical recipe  →  its official result
     anything else           →  no_result   (never a roll of the dice)

   This is the deterministic gate that sits in front of any optional AI. In
   Phase 1 nothing public ever calls a model, so an unknown combination always
   ends here. Era / tier / region gates stay inside Engine.combineMany (they
   say "right idea, too early", which is a different answer from no_result);
   this module only answers "does a canonical route exist at all?".
   ========================================================================== */

export type NoResultReason = 'bad_slot_count' | 'bad_item_id' | 'unknown_item' | 'no_canonical_recipe';

export type Preflight =
  | { kind: 'known_recipe'; resultId: string; key: string }
  | { kind: 'no_result'; reasons: NoResultReason[] };

export type RecipeIndex = ReadonlyMap<string, string>;

/** multiKey (the engine's persisted key) → result id. First declaration wins, like the engine. */
export function buildRecipeIndex(db: Db): RecipeIndex {
  const idx = new Map<string, string>();
  for (const n of db.nodes) for (const r of n.rec ?? []) {
    const k = multiKey(r);
    if (!idx.has(k)) idx.set(k, n.id);
  }
  return idx;
}

export function preflight(db: Db, index: RecipeIndex, ids: readonly string[]): Preflight {
  const reasons: NoResultReason[] = [];
  if (!Array.isArray(ids) || ids.length < MIN_SLOTS || ids.length > MAX_SLOTS) reasons.push('bad_slot_count');
  else {
    if (ids.some(i => typeof i !== 'string' || !ITEM_ID_RE.test(i))) reasons.push('bad_item_id');
    else {
      const known = new Set<string>([...db.nodes.map(n => n.id), ...(db.states ?? []).map(s => s.id)]);
      if (ids.some(i => !known.has(i))) reasons.push('unknown_item');
    }
  }
  if (reasons.length) return { kind: 'no_result', reasons };
  const hit = index.get(multiKey(ids));
  if (hit) return { kind: 'known_recipe', resultId: hit, key: recipeKey(ids) };
  return { kind: 'no_result', reasons: ['no_canonical_recipe'] };
}
