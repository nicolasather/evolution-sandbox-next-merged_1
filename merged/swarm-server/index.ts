/** Swarm Survival worker entry point. One persistent Node process.  See swarm-server/README.md.
 *    SWARM_SECRET            required. >= 32 chars. Shared with the Next app (it mints host tokens with the same secret).
 *    DATABASE_URL            Postgres (Supabase direct connection). Required unless SWARM_DEV=1.
 *    PORT / HOST             default 8787 / 0.0.0.0
 *    SWARM_ALLOWED_ORIGINS   comma list of site origins allowed to join / open sockets (e.g. https://your-site.vercel.app)
 *    SWARM_MAX_ROOMS / SWARM_MAX_SOCKETS / SWARM_TRUST_PROXY / SWARM_WORKER_ID / SWARM_FILE (dev) */
import { Pool } from 'pg';
import { startSwarmServer } from '../lib/swarm/server/server';
import { MemoryStore, PgStore, FileStore, type Store } from '../lib/swarm/server/store';
import { PgSource, FixtureSource } from '../lib/swarm/server/quiz-source';

const env = process.env; const dev = env.SWARM_DEV === '1';
const log = (m: string, o?: unknown) => console.log(JSON.stringify({ t: new Date().toISOString(), m, ...(o && typeof o === 'object' ? o : {}) }));
const die = (m: string): never => { console.error(`swarm-server: ${m}`); process.exit(1); };

async function main() {
  const secret = env.SWARM_SECRET ?? ''; if (secret.length < (dev ? 16 : 32)) die('SWARM_SECRET must be set (at least 32 characters in production).');
  let store: Store; let pool: Pool | null = null;
  if (env.DATABASE_URL) {
    if (dev) die('SWARM_DEV=1 refuses to run with DATABASE_URL set: dev routes must never touch a real database.');
    pool = new Pool({ connectionString: env.DATABASE_URL, max: Number(env.SWARM_PG_POOL ?? 8), ssl: /localhost|127\.0\.0\.1/.test(env.DATABASE_URL) ? undefined : { rejectUnauthorized: false } });
    await pool.query('select 1'); store = new PgStore(pool, () => pool!.end());
  } else if (dev) store = env.SWARM_FILE ? await FileStore.open(env.SWARM_FILE) : new MemoryStore();
  else return die('DATABASE_URL is required (or SWARM_DEV=1 for local development with an in-memory store).');
  const origins = (env.SWARM_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!dev && origins.length === 0) die('SWARM_ALLOWED_ORIGINS must list the site origin(s) in production.');
  const sql = pool;
  const srv = await startSwarmServer({
    port: Number(env.PORT ?? 8787), host: env.HOST, secret, store, dev, log, allowedOrigins: dev && origins.length === 0 ? ['*'] : origins,
    workerId: env.SWARM_WORKER_ID, maxRooms: env.SWARM_MAX_ROOMS ? Number(env.SWARM_MAX_ROOMS) : undefined, maxSockets: env.SWARM_MAX_SOCKETS ? Number(env.SWARM_MAX_SOCKETS) : undefined, trustProxy: env.SWARM_TRUST_PROXY === '1',
    sourceFor: (roomId) => (sql ? new PgSource(sql, roomId) : new FixtureSource(40)),
  });
  log('swarm worker listening', { port: srv.port, dev, store: pool ? 'postgres' : env.SWARM_FILE ? 'file' : 'memory' });
  let stopping = false;
  const stop = async (sig: string) => { if (stopping) return; stopping = true; log('shutting down', { sig }); const t = setTimeout(() => process.exit(1), 10_000); try { await srv.close(); await store.close(); } finally { clearTimeout(t); process.exit(0); } };
  process.on('SIGTERM', () => void stop('SIGTERM')); process.on('SIGINT', () => void stop('SIGINT'));
}
main().catch((e) => die(e instanceof Error ? e.message : String(e)));
