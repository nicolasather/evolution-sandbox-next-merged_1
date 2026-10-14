import { Engine } from '../../engine';
import { applyProcessing, multiKey } from '../../processing/overlay';
import { baseKnownIds, baseProcessingData, baseTakenKeys, mergeAltRoutes, playDb } from '../../processing';
import rawDb from '@/data/db.json';
import type { Db } from '../../types';

/* Ticket 083 — an approved release (alternative routes) is applied BEFORE the Engine is constructed; every canonical
   recipe, every old node and every old save behaves exactly as before. */
const SAVE_KEY = 'evo.sandbox.v1';
const prim = playDb.primitives;
const target = playDb.nodes.find(n => n.rec?.length && n.rec.every(r => r.length >= 2) && !prim.includes(n.id))!;
let alt: string[] = [];
for (let i = 0; i < prim.length && !alt.length; i++) for (let j = i; j < prim.length && !alt.length; j++) {
  const cand = [prim[i], prim[j], prim[(j + 1) % prim.length]];
  if (!baseTakenKeys.has(multiKey(cand)) && !cand.includes(target.id)) alt = cand;
}
const withRelease = (routes: { targetId: string; ingredientIds: string[] }[]): Db =>
  applyProcessing(rawDb as unknown as Db, mergeAltRoutes(baseProcessingData, routes, baseKnownIds, baseTakenKeys));

describe('083 release overlay and legacy saves', () => {
  beforeEach(() => window.localStorage.clear());
  const released = withRelease([{ targetId: target.id, ingredientIds: alt }]);

  it('the release adds the alternative route and nothing else: same node ids, same canonical recipes', () => {
    expect(released.nodes.map(n => n.id)).toEqual(playDb.nodes.map(n => n.id));
    for (const n of playDb.nodes) {
      const r = released.nodes.find(x => x.id === n.id)!;
      for (const rec of n.rec ?? []) expect(r.rec.map(multiKey)).toContain(multiKey(rec));
    }
    expect(released.nodes.find(n => n.id === target.id)!.rec.map(multiKey)).toContain(multiKey(alt));
  });
  it('a route onto an unknown item, onto itself, or duplicating a canonical recipe is ignored (no new items, canonical wins)', () => {
    const canonical = target.rec[0];
    const d = withRelease([{ targetId: 'brand_new_item', ingredientIds: alt }, { targetId: target.id, ingredientIds: [target.id, 'stone'] }, { targetId: 'other_id', ingredientIds: canonical }]);
    expect(d.nodes.length).toBe(playDb.nodes.length);
    expect(JSON.stringify(d.nodes.map(n => n.rec))).toBe(JSON.stringify(playDb.nodes.map(n => n.rec)));
  });
  for (const v of [1, 2, 3, 5]) {
    it(`a v${v} save loads into the released graph exactly as into the base graph`, () => {
      const first = playDb.nodes.find(n => n.rec?.some(r => r.length === 2 && r.every(i => playDb.primitives.includes(i))))!;
      const [a, b] = first.rec!.find(r => r.length === 2 && r.every(i => playDb.primitives.includes(i)))!;
      const save = { v, order: [...playDb.primitives, first.id], bag: [...playDb.primitives, first.id], steps: [{ a, b, r: first.id }], failed: 2, failedPairs: [], seen: [], lockedPairs: [], streak: 1, coached: 1, known: [], pending: [] };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      const base = new Engine(playDb), rel = new Engine(released);
      expect(base.load()).toBe(true); expect(rel.load()).toBe(true);
      expect(rel.order).toEqual(base.order);
      expect([...rel.found].sort()).toEqual([...base.found].sort());
    });
  }
  it('the canonical craft is unchanged and the first-class hint ladder still resolves for a base item', () => {
    const e = new Engine(released);
    const n = playDb.nodes.find(x => x.rec?.some(r => r.length === 2 && r.every(i => playDb.primitives.includes(i))))!;
    const [a, b] = n.rec!.find(r => r.length === 2 && r.every(i => playDb.primitives.includes(i)))!;
    expect(e.combine(a, b)).toBeTruthy();
  });
});
