/** @jest-environment node */
import { applyProcessing } from '@/lib/processing/overlay';
import rawDb from '@/data/db.json';
import { altRoutesFile, baseProcessingData, baseKnownIds, mergeAltRoutes, playDb, processingData } from '@/lib/processing';
import type { Db } from '@/lib/types';
import { releaseHash, approvedRouteCount } from '@/lib/content/releaseManifest';
import { buildCatalog } from '../catalog';
import { activeManifest, canonicalRoutes, manifestSha, validateRoutes } from '../manifest';

const base = applyProcessing(rawDb as unknown as Db, baseProcessingData);
const baseCat = buildCatalog(base, baseProcessingData);
const verified = [...baseCat.profiles.values()].filter(p => p.status === 'verified' && p.isNode).map(p => p.id);
const pending = [...baseCat.profiles.values()].find(p => p.status !== 'verified' && p.isNode)!.id;

describe('082 release manifest', () => {
  it('the committed alt_routes.json carries the hash the server recomputes (CI gate)', () => {
    expect(releaseHash).toBe(activeManifest().manifestSha256);
    expect(approvedRouteCount).toBe(altRoutesFile.routes?.length ?? 0);
  });
  it('hash is order independent and changes when any route changes', () => {
    const r1 = { targetId: verified[0], ingredientIds: [verified[3], verified[2]] };
    const r2 = { targetId: verified[1], ingredientIds: [verified[5], verified[4]] };
    expect(manifestSha([r1, r2])).toBe(manifestSha([r2, { ...r1, ingredientIds: [verified[2], verified[3]] }]));
    expect(manifestSha([r1])).not.toBe(manifestSha([r1, r2]));
    expect(manifestSha([r1])).not.toBe(manifestSha([{ ...r1, targetId: verified[9] }]));
    expect(canonicalRoutes([r1, r1]).length).toBe(1);
  });
  it('the compiler refuses unverified targets, unknown ids, self references, canonical collisions and duplicates', () => {
    const canonical = [...baseCat.recipeIndex.entries()][0];
    const canonIds = canonical[0].split(' ');
    const probs = validateRoutes(baseCat, [
      { targetId: pending, ingredientIds: [verified[0], verified[1]] },
      { targetId: verified[0], ingredientIds: ['nope_item', verified[1]] },
      { targetId: verified[0], ingredientIds: [verified[0], verified[1]] },
      { targetId: verified[2], ingredientIds: canonIds },
      { targetId: verified[3], ingredientIds: [verified[4], verified[5], verified[6]] },
      { targetId: verified[7], ingredientIds: [verified[6], verified[5], verified[4]] },
      { targetId: verified[0], ingredientIds: [verified[0]] },
    ]);
    expect(probs.map(p => p.code).sort()).toEqual(['bad_size', 'canonical_collision', 'duplicate', 'self_reference', 'unknown_item', 'unverified_target']);
  });
  it('mergeAltRoutes: an existing recipe always wins and a second route to the same multiset is dropped', () => {
    const canon = [...baseCat.recipeIndex.entries()][0][0].split(' ');
    const a = [verified[10], verified[11]];
    const merged = mergeAltRoutes(baseProcessingData, [
      { targetId: verified[0], ingredientIds: canon },
      { targetId: verified[1], ingredientIds: a },
      { targetId: verified[2], ingredientIds: [...a].reverse() },
    ], baseKnownIds, new Set(baseCat.recipeIndex.keys()));
    expect(merged.recipes.add.length).toBe(baseProcessingData.recipes.add.length + 1);
    const played = applyProcessing(rawDb as unknown as Db, merged);
    expect(played.nodes.find(n => n.id === verified[1])!.rec.some(r => [...r].sort().join(' ') === [...a].sort().join(' '))).toBe(true);
    expect(played.nodes.find(n => n.id === verified[2])!.rec.some(r => [...r].sort().join(' ') === [...a].sort().join(' '))).toBe(false);
  });
  it('083 legacy compatibility: adding a route changes nothing that existed (every old recipe and node id survives)', () => {
    const route = { targetId: verified[1], ingredientIds: [verified[10], verified[11]] };
    const merged = mergeAltRoutes(baseProcessingData, [route], baseKnownIds, new Set(baseCat.recipeIndex.keys()));
    const after = applyProcessing(rawDb as unknown as Db, merged);
    expect(after.nodes.map(n => n.id)).toEqual(base.nodes.map(n => n.id));
    for (const n of base.nodes) {
      const m = after.nodes.find(x => x.id === n.id)!;
      for (const r of n.rec) expect(m.rec.some(x => [...x].sort().join(' ') === [...r].sort().join(' '))).toBe(true);
      expect(m.era).toBe(n.era); expect(m.ds).toBe(n.ds);
    }
    expect(playDb.nodes.length).toBe(base.nodes.length);
    expect(processingData.recipes.add.length).toBe(baseProcessingData.recipes.add.length + (altRoutesFile.routes?.length ?? 0));
  });
});
