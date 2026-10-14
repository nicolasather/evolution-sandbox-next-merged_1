import golden from '../../../tools/tests/fixtures/recipe_key_golden.json';
import { multiKey } from '../../processing/overlay';
import { playDb } from '../../processing';
import { legacyKey, recipeKey, RecipeKeyError, sameRecipe } from '../recipeKey';

describe('recipeKey v2', () => {
  it('matches the shared golden fixture (same file the Python tests run)', () => {
    const cases = (golden as { items: string[]; expected?: string }[]).filter(c => c.expected);
    expect(cases.length).toBeGreaterThan(5);
    for (const c of cases) expect(recipeKey(c.items)).toBe(c.expected);
  });

  it('is order-free and keeps repeats', () => {
    expect(sameRecipe(['stone', 'wood'], ['wood', 'stone'])).toBe(true);
    expect(sameRecipe(['stone', 'stone'], ['stone', 'wood'])).toBe(false);
    expect(sameRecipe(['stone', 'stone', 'wood'], ['stone', 'wood', 'wood'])).toBe(false);
    expect(recipeKey(['fiber', 'fiber', 'fiber'])).not.toBe(recipeKey(['fiber', 'fiber']));
  });

  it.each([
    [[]], [['stone']], [Array(6).fill('stone')], [['stone', '']], [['Stone', 'wood']], [['st one', 'wood']],
    [['stone', 'wo\u0000od']], [['1stone', 'wood']], [['é', 'wood']],
  ])('rejects %j', ids => {
    expect(() => recipeKey(ids as string[])).toThrow(RecipeKeyError);
  });

  it('legacy key equals the engine multiKey persisted in old saves, for every real recipe', () => {
    let n = 0;
    for (const node of playDb.nodes) {
      for (const rec of node.rec ?? []) {
        expect(legacyKey(rec)).toBe(multiKey(rec));
        n++;
      }
    }
    expect(n).toBeGreaterThan(1800);
  });

  it('no two real recipes share a v2 key', () => {
    const seen = new Map<string, string>();
    for (const node of playDb.nodes) {
      for (const rec of node.rec ?? []) {
        const k = recipeKey(rec);
        const prev = seen.get(k);
        if (prev && prev !== node.id) throw new Error(`${k} claimed by ${prev} and ${node.id}`);
        seen.set(k, node.id);
      }
    }
  });
});
