/** @jest-environment node */
import { testDb } from '../testing/testDb';
import { type Db } from '../db/sql';
import { migrate } from '../db/migrate';
import { recipeKey } from '../recipeKey';

let db: Db;
beforeAll(async () => { db = await testDb(); });
afterAll(async () => { await db.close(); });

describe('076 migrations apply to a real PostgreSQL engine (PGlite)', () => {
  it('applies 001–004 and is idempotent', async () => {
    const r1 = await migrate(db);
    expect(r1.applied).toEqual(['001_phase2.sql', '002_guards.sql', '003_asset_guards.sql', '004_mode_packets.sql']);
    const r2 = await migrate(db);
    expect(r2.applied).toEqual([]);
    expect(r2.skipped.length).toBe(4);
  });
  it('SQL recipe_v2_key equals the TypeScript key (parity), incl. duplicates and ordering', async () => {
    const cases = [['stone', 'stone'], ['wood', 'stone'], ['a_x', 'b_y', 'c_z'], ['stone', 'stone', 'wood', 'bone', 'fiber'], ['x_9', 'x_10'], ['ab', 'a_b'], ['a1', 'a_1']];
    for (const ids of cases) {
      const r = await db.query<{ k: string }>('SELECT creative.recipe_v2_key($1::text[]) AS k', [ids]);
      expect(r.rows[0].k).toBe(recipeKey(ids));
    }
    for (const bad of [['stone'], ['a', 'b', 'c', 'd', 'e', 'f'], ['stone', 'Wood']]) {
      await expect(db.query('SELECT creative.recipe_v2_key($1::text[])', [bad])).rejects.toThrow();
    }
  });
});
