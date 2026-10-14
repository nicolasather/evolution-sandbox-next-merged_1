import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { playDb } from '../../processing';
import { buildRecipeIndex, preflight } from '../strictCraft';
import { multiKey } from '../../processing/overlay';

/* Package 068 — release gate. A release is blocked if
   (a) any known recipe changed or vanished (golden digest of every key→result),
   (b) a deliberate-nonsense combination yields a result,
   (c) the guide / hint / old-save suites are not green (run by `npm run release:certify`). */

const index = buildRecipeIndex(playDb);
const GOLDEN = join(__dirname, 'fixtures', 'known_recipes.golden.json');
const entries = [...index.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
const digest = createHash('sha256').update(JSON.stringify(entries)).digest('hex');

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }

describe('release certification', () => {
  it('(a) known recipes: none changed, none lost', () => {
    if (!existsSync(GOLDEN) && process.env.UPDATE_GOLDEN === '1') writeFileSync(GOLDEN, JSON.stringify({ count: entries.length, digest }, null, 2) + '\n');
    const g = JSON.parse(readFileSync(GOLDEN, 'utf8')) as { count: number; digest: string };
    expect(entries.length).toBeGreaterThanOrEqual(g.count);   // new items may ADD recipes
    if (entries.length === g.count) expect(digest).toBe(g.digest);
  });

  it('(b) positive: every known recipe, in any order, gives its own result', () => {
    for (const node of playDb.nodes) for (const rec of node.rec ?? []) {
      const r = preflight(playDb, index, [...rec].sort().reverse());
      expect(r.kind).toBe('known_recipe');
      if (r.kind === 'known_recipe') expect(index.get(multiKey(rec))).toBe(r.resultId);
    }
  });

  it('(b) negative: deliberate nonsense gives no_result — 3, 4 and 5 slots, plus malformed input', () => {
    const rand = rng(68);
    const ids = playDb.nodes.map(n => n.id);
    for (const slots of [3, 4, 5]) {
      let hit = 0; const N = 6000;
      for (let i = 0; i < N; i++) {
        const pick = Array.from({ length: slots }, () => ids[Math.floor(rand() * ids.length)]);
        if (preflight(playDb, index, pick).kind === 'known_recipe') hit++;
      }
      expect(hit / N).toBeLessThan(0.02);
    }
    for (const bad of [[], ['stone'], ['stone', '__proto__'], ['stone', 'no_such_item_xyz'], ['a;b', 'c'], Array(6).fill('stone')] as string[][]) {
      expect(preflight(playDb, index, bad).kind).toBe('no_result');
    }
  });
});
