import rawDb from '@/data/db.json';
import { Engine, MAX_HINT } from '@/lib/engine';
import type { Db } from '@/lib/types';

/* Every craft in the catalogue must have a complete hint ladder: a vague first rung, a second
   rung that names the craft outright, and rungs 3–5 that each say something. The engine's
   dev hooks lift the era and tier gates so that every craft can be asked about. */

const db = rawDb as unknown as Db;
const dev = { enabled: () => true, chronology: () => true };
const SECOND_RUNG = /^(Put .+ together\.|Work .+ with .+\.|Use .+\.)$/;

describe('every craft has a complete hint ladder', () => {
  it('each rung says something for every craft that can be made from its first recipe', () => {
    const e = new Engine(db, { dev });
    // hold only the primitives and the first recipe's pieces, so the target is within reach
    const ask = e as unknown as { found: Set<string>; hint: { level: number } };
    const failures: string[] = [];
    let checked = 0;
    for (const n of db.nodes) {
      if (!n.rec?.length || n.primitive) continue;
      const pieces = n.rec[0];
      if (pieces.includes(n.id) || pieces.some(i => !e.get(i))) continue;
      ask.found = new Set([...db.primitives, ...pieces]);
      const asked = e.requestHint(n.id);
      if ('error' in asked) { failures.push(`${n.id}: ${asked.error}`); continue; }
      for (let level = 1; level <= MAX_HINT; level++) {
        ask.hint.level = level;
        const view = e.hintView();
        if (!view.text) failures.push(`${n.id} rung ${level}: empty`);
        if (level === 2 && !SECOND_RUNG.test(view.text)) failures.push(`${n.id} rung 2 does not name the craft: "${view.text}"`);
      }
      e.dropHint();
      checked++;
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(checked).toBeGreaterThan(2000);
  });
});
