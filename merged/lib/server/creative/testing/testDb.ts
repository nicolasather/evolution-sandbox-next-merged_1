import { PGlite } from '@electric-sql/pglite';
import { pgDb, pgliteDb, type Db } from '../db/sql';

/* Default: PGlite (a real PostgreSQL engine in WASM) — no setup needed.
   TEST_DATABASE_URL=postgres://… runs the SAME suites against a real PostgreSQL server through the production `pg`
   adapter. The `creative` schema of that database is DROPPED first: point it only at a throw-away database. */
export async function testDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return pgliteDb(new PGlite());
  if (!/localhost|127\.0\.0\.1|test|ci/i.test(url)) throw new Error('TEST_DATABASE_URL must look like a local or test database');
  const { Pool } = await import('pg');
  const db = pgDb(new Pool({ connectionString: url, max: 12 }));
  await db.exec('DROP SCHEMA IF EXISTS creative CASCADE');
  return db;
}
