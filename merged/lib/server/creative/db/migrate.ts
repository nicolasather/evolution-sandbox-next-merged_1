import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './sql';

/* Ticket 076 — explicit, forward-only, checksummed migrations. A migration that was edited after being applied
   is refused (drift), never silently re-run. */

export const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

export interface MigrationReport { applied: string[]; skipped: string[] }

export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<MigrationReport> {
  await db.exec('CREATE SCHEMA IF NOT EXISTS creative');
  await db.query(`CREATE TABLE IF NOT EXISTS creative.schema_migration (
    name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const files = readdirSync(dir).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
  const done = new Map((await db.query<{ name: string; sha256: string }>('SELECT name, sha256 FROM creative.schema_migration')).rows.map(r => [r.name, r.sha256]));
  const report: MigrationReport = { applied: [], skipped: [] };
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    const sha = createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');   // CRLF (Windows checkout) and LF (Linux deploy) are the same migration
    const prev = done.get(f);
    if (prev) {
      if (prev !== sha) throw new Error(`migration ${f} changed after it was applied (checksum drift)`);
      report.skipped.push(f); continue;
    }
    // each file carries its own BEGIN/COMMIT; the history row is written right after it succeeds
    await db.exec(text);
    await db.query('INSERT INTO creative.schema_migration(name, sha256) VALUES ($1, $2)', [f, sha]);
    report.applied.push(f);
  }
  return report;
}
