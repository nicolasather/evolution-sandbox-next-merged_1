/** SW-03: how the worker talks TLS to a REMOTE Postgres. The server certificate is always verified; there is no switch that turns that off.
 *  A loopback database (local dev, CI) keeps whatever the URL asks for, because there is no network to interpose on. */
import { isLoopbackHost } from '../config';

export type PgConn = { connectionString: string; ssl: false | undefined | { rejectUnauthorized: true; ca?: string }; remote: boolean };
const WEAK_MODES = new Set(['disable', 'allow', 'prefer', 'no-verify']);

/** `caPem` is the provider's CA certificate (SWARM_PG_CA_PEM). Literal "\n" sequences are accepted so it fits in a one-line secret. */
export function pgConnection(databaseUrl: string, caPem?: string): PgConn {
  let u: URL;
  try { u = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL is not a valid connection URL.'); }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') throw new Error('DATABASE_URL must be a postgres:// URL.');
  // IPv6 loopback appears as "[::1]" in URL.hostname
  if (isLoopbackHost(u.hostname)) return { connectionString: databaseUrl, ssl: undefined, remote: false };
  const mode = (u.searchParams.get('sslmode') ?? '').toLowerCase();
  if (WEAK_MODES.has(mode)) throw new Error(`DATABASE_URL asks for sslmode=${mode}, which does not verify the database server. Remove it (verification is always on for a remote database).`);
  // pg lets URL parameters override the ssl option, so every TLS-related parameter is removed and the verified config is passed explicitly.
  for (const k of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) u.searchParams.delete(k);
  const ca = caPem?.trim() ? caPem.replace(/\\n/g, '\n') : undefined;
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, remote: true };
}
