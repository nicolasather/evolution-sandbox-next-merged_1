import { Pool } from 'pg';
import { pgDb } from '../../lib/server/creative/db/sql';
import { migrate } from '../../lib/server/creative/db/migrate';

/* `npm run db:migrate` — applies db/migrations/*.sql to DATABASE_URL, in order, once each (checksummed).
   Refuses to run against a URL that looks like production unless ALLOW_PROD_MIGRATE=yes is set by the owner. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set. Nothing was changed.'); process.exit(2); }
  if (/prod/i.test(url) && process.env.ALLOW_PROD_MIGRATE !== 'yes') { console.error('The URL contains "prod". Set ALLOW_PROD_MIGRATE=yes only after the owner approved a production migration.'); process.exit(3); }
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const r = await migrate(pgDb(pool));
    console.log(`applied: ${r.applied.join(', ') || '(none)'}\nalready applied: ${r.skipped.join(', ') || '(none)'}`);
  } finally { await pool.end(); }
}
main().catch(e => { console.error('migration failed:', e instanceof Error ? e.message : e); process.exit(1); });
