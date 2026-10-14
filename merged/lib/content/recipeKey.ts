/* ============================================================================
   RECIPE KEY v2 — the cross-language identity of a recipe (2–5 ingredient slots).

   Must stay byte-identical to tools/content/keys.py::recipe_key. The golden
   fixture tools/tests/fixtures/recipe_key_golden.json is run by BOTH test
   suites. Repeats are preserved ("stone stone wood" is not "stone wood").

   The engine's own `multiKey` (sorted ids joined by a space) is what old saves
   persist, so it is NOT replaced: `legacyKey` below is the same function, and
   a test proves the two never drift apart.
   ========================================================================== */

export const ITEM_ID_RE = /^[a-z][a-z0-9_]{1,63}$/;
export const MIN_SLOTS = 2;
export const MAX_SLOTS = 5;

export class RecipeKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeKeyError';
  }
}

function checked(ids: readonly string[]): string[] {
  if (!Array.isArray(ids)) throw new RecipeKeyError('ingredients must be a list');
  if (ids.length < MIN_SLOTS || ids.length > MAX_SLOTS) {
    throw new RecipeKeyError(`a recipe has ${MIN_SLOTS}–${MAX_SLOTS} ingredient slots, got ${ids.length}`);
  }
  for (const id of ids) {
    if (typeof id !== 'string' || !ITEM_ID_RE.test(id)) throw new RecipeKeyError(`invalid ingredient id: ${JSON.stringify(id)}`);
  }
  return [...ids].sort();
}

/** 'recipe-v2:' + slots + ':' + sortedIds.map(id => id.length + ':' + id). */
export function recipeKey(ids: readonly string[]): string {
  const sorted = checked(ids);
  return `recipe-v2:${sorted.length}:${sorted.map(s => `${s.length}:${s}`).join('')}`;
}

/** Exactly what Engine / overlay.multiKey persists in saves. */
export const legacyKey = (ids: readonly string[]): string => [...checked(ids)].join(' ');

export const sameRecipe = (a: readonly string[], b: readonly string[]): boolean => recipeKey(a) === recipeKey(b);
