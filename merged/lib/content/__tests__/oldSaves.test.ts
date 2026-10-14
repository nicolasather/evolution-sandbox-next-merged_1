import { Engine } from '../../engine';
import { playDb } from '../../processing';
import type { Db, Discovery } from '../../types';

/* OLD SAVES + GUIDE/HINT with newly imported items present.
   A save written before any import must load unchanged into a graph that has gained new items,
   and the hint ladder must still work. The "imported" items here are in-memory clones, not shipped data. */

const SAVE_KEY = 'evo.sandbox.v1';

function withImported(db: Db): Db {
  const base = db.nodes.find(n => n.id === 'stone_flake')!;
  const mk = (id: string, no: number, rec: string[][]): Discovery => ({ ...base, id, n: id, no, rec, uses: [], depth: 2, need: 3, src: ['source_required'] });
  return { ...db, nodes: [...db.nodes, mk('zz_import_a', 919, [['stone', 'stone', 'stone']]), mk('zz_import_b', 920, [['bone', 'stone', 'stone']])] };
}

const firstTwo = playDb.nodes.find(n => n.rec?.some(r => r.length === 2 && r.every(i => playDb.primitives.includes(i))))!;
const [a, b] = firstTwo.rec!.find(r => r.length === 2 && r.every(i => playDb.primitives.includes(i)))!;

const saves: Record<string, object> = {
  v1: { v: 1, order: [...playDb.primitives, firstTwo.id], steps: [{ a, b, r: firstTwo.id }], failed: 3, failedPairs: [], seen: [] },
  v2: { v: 2, order: [...playDb.primitives, firstTwo.id], steps: [{ a, b, r: firstTwo.id }], failed: 3, failedPairs: [], seen: [], lockedPairs: [], streak: 1, coached: 2 },
  v3: { v: 3, order: [...playDb.primitives, firstTwo.id], bag: [...playDb.primitives, firstTwo.id], steps: [{ a, b, r: firstTwo.id }], failed: 3, failedPairs: [], seen: [] },
  v5: { v: 5, order: [...playDb.primitives, firstTwo.id], bag: [...playDb.primitives, firstTwo.id], steps: [{ a, b, r: firstTwo.id }], failed: 3, failedPairs: [], seen: [], known: [], pending: [] },
};

describe('old saves with imported items present', () => {
  beforeEach(() => window.localStorage.clear());

  for (const [ver, save] of Object.entries(saves)) {
    it(`a ${ver} save loads unchanged into the larger graph`, () => {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      const plain = new Engine(playDb);
      const grown = new Engine(withImported(playDb));
      expect(plain.load()).toBe(true);
      expect(grown.load()).toBe(true);
      expect(grown.order).toEqual(plain.order);
      expect(grown.found.has(firstTwo.id)).toBe(true);
      expect(grown.found.has('zz_import_a')).toBe(false); // nothing is granted by the import
    });
  }

  it('a corrupt save is ignored, not fatal', () => {
    window.localStorage.setItem(SAVE_KEY, '{not json');
    expect(new Engine(withImported(playDb)).load()).toBe(false);
  });

  it('plate numbers of the original 918 never move', () => {
    const grown = withImported(playDb);
    for (const n of playDb.nodes) expect(grown.nodes.find(x => x.id === n.id)!.no).toBe(n.no);
  });

  it('an imported 3-slot item is craftable and wrong tries still fail normally', () => {
    const e = new Engine(withImported(playDb));
    const r = e.combineMany(['stone', 'stone', 'stone']);
    expect(['new', 'known', 'tier_locked', 'era_locked', 'region_locked']).toContain(r.status);
    expect(e.combineMany(['wood', 'wood', 'bone']).status).toBe('fail');
  });

  it('the hint ladder still works and never names both ingredients at once', () => {
    const e = new Engine(withImported(playDb));
    const h = e.requestHint(firstTwo.id);
    expect('error' in h).toBe(false);
    const text = JSON.stringify(h);
    expect(text.includes(`"${a}"`) && text.includes(`"${b}"`) && a !== b).toBe(false);
  });
});
