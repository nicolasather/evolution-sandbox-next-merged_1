import type { Sql } from './sql';

/* Ticket 078 — durable negative cache. The key already contains release hash, rules version, recipe key and
   action (see recipeKey.negativeKey), so a new release or rules version simply never hits the old rows. Only the
   server writes it, and only from a validated "no" — never from model free text. */

export const NONE_TTL_SECONDS = 6 * 3600;
export const ERROR_TTL_SECONDS = 60;

export async function getNegative(db: Sql, key: string, now: Date): Promise<{ reason: string } | null> {
  const r = await db.query<{ reason_code: string }>(`SELECT reason_code FROM creative.negative_cache WHERE cache_key=$1 AND expires_at > $2::timestamptz`, [key, now.toISOString()]);
  return r.rows[0] ? { reason: r.rows[0].reason_code } : null;
}

export async function putNegative(db: Sql, key: string, reason: string, ttlSeconds: number, now: Date): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('bad cache key');
  await db.query(
    `INSERT INTO creative.negative_cache(cache_key, reason_code, expires_at, created_at) VALUES ($1,$2,$3::timestamptz,$4::timestamptz)
     ON CONFLICT (cache_key) DO UPDATE SET reason_code=EXCLUDED.reason_code, expires_at=EXCLUDED.expires_at`,
    [key, reason.slice(0, 64), new Date(now.getTime() + ttlSeconds * 1000).toISOString(), now.toISOString()]);
}

export async function pruneNegative(db: Sql, now: Date): Promise<number> {
  const r = await db.query(`DELETE FROM creative.negative_cache WHERE expires_at <= $1::timestamptz`, [now.toISOString()]);
  return r.rowCount;
}
