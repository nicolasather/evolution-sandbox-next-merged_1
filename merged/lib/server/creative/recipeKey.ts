import { createHash } from 'node:crypto';
import { recipeKey, legacyKey, MIN_SLOTS, MAX_SLOTS, ITEM_ID_RE, RecipeKeyError } from '@/lib/content/recipeKey';

/* Ticket 070. The Phase 1 key is reused verbatim (TS = Python = SQL function creative.recipe_v2_key).
   The action is a SEPARATE string, '' for none. */
export { recipeKey, legacyKey, MIN_SLOTS, MAX_SLOTS, ITEM_ID_RE, RecipeKeyError };

export const ACTION_RE = /^[a-z][a-z0-9_]{1,63}$/;

export function actionKey(actionId: string | null): string {
  if (actionId === null) return '';
  if (!ACTION_RE.test(actionId)) throw new RecipeKeyError(`invalid action id: ${JSON.stringify(actionId)}`);
  return actionId;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** One compute per (release, recipe, action, model/prompt/rules version): the global dedup key (ticket 077). */
export const computeKey = (releaseHash: string, ids: readonly string[], actionId: string | null, versions: string): string =>
  sha(['compute', releaseHash, recipeKey(ids), actionKey(actionId), versions].join('|'));

/** Negative-cache key (ticket 078): a new release or rules version changes it, so old verdicts never apply. */
export const negativeKey = (releaseHash: string, ids: readonly string[], actionId: string | null, rulesVersion: string): string =>
  sha(['negative', releaseHash, recipeKey(ids), actionKey(actionId), rulesVersion].join('|'));

export const actorHash = (scope: string, salt: string): string => sha(`actor|${salt}|${scope}`);
