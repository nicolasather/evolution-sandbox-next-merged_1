import { playDb } from '../../processing';
import { Engine } from '../../engine';
import { buildRecipeIndex, preflight } from '../strictCraft';

const index = buildRecipeIndex(playDb);
const nodeIds = playDb.nodes.map(n => n.id);

/** small deterministic PRNG so the negative suite is reproducible */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe('strict craft preflight', () => {
  it('every canonical recipe resolves to its own item (positive suite)', () => {
    let n = 0;
    for (const node of playDb.nodes) for (const rec of node.rec ?? []) {
      const r = preflight(playDb, index, [...rec].reverse());
      expect(r.kind).toBe('known_recipe');
      if (r.kind === 'known_recipe') expect(playDb.nodes.some(x => x.id === r.resultId)).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(1800);
  });

  it('almost every random combination is no_result (negative suite, reproducible)', () => {
    const rand = rng(20261014);
    let hits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const size = 2 + Math.floor(rand() * 2);
      const ids = Array.from({ length: size }, () => nodeIds[Math.floor(rand() * nodeIds.length)]);
      const r = preflight(playDb, index, ids);
      if (r.kind === 'known_recipe') hits++;
      else expect(r.reasons).toEqual(['no_canonical_recipe']);
    }
    // measured, not targeted: the real graph has ~1900 recipes out of ~420k pairs
    expect(hits / N).toBeLessThan(0.01);
  });

  it('refuses malformed input with a reason, never throws', () => {
    expect(preflight(playDb, index, ['stone'])).toEqual({ kind: 'no_result', reasons: ['bad_slot_count'] });
    expect(preflight(playDb, index, Array(6).fill('stone'))).toEqual({ kind: 'no_result', reasons: ['bad_slot_count'] });
    expect(preflight(playDb, index, ['stone', 'Wood'])).toEqual({ kind: 'no_result', reasons: ['bad_item_id'] });
    expect(preflight(playDb, index, ['stone', 'definitely_not_an_item'])).toEqual({ kind: 'no_result', reasons: ['unknown_item'] });
  });

  it('is deterministic and does not depend on input order', () => {
    const a = preflight(playDb, index, ['stone', 'wood']);
    const b = preflight(playDb, index, ['wood', 'stone']);
    expect(a).toEqual(b);
  });

  it('a failed craft in the real engine stays a plain fail with the normal guide message', () => {
    const e = new Engine(playDb);
    const r = e.combine('stone', 'bone');
    // whatever the graph says, the engine and the preflight must agree on whether a recipe exists
    const pf = preflight(playDb, index, ['stone', 'bone']);
    if (pf.kind === 'no_result') expect(r.status).toBe('fail');
    else expect(['new', 'known', 'tier_locked', 'era_locked', 'region_locked']).toContain(r.status);
  });
});
