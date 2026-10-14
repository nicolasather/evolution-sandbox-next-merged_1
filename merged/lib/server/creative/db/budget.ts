import type { Db, Sql } from './sql';

/* Ticket 079 — atomic spending reservations, a kill switch and a provider circuit breaker. The reservation is a
   single locked statement, so N concurrent callers can never oversubscribe the daily cap. An outcome we cannot
   prove (timeout after sending) stays reserved as 'unknown' — never retried blindly, never charged twice. */

export interface BudgetConfig { dailyGlobalUsd: number }
export type Reservation = { ok: true; ledgerId: number } | { ok: false; reason: 'kill_switch' | 'breaker_open' | 'global_cap' };

export const BREAKER_THRESHOLD = 3;
export const BREAKER_OPEN_SECONDS = 120;

/** The budget day is the UTC day, spelled out explicitly so the database session's TimeZone can never shift it. */
export function utcDay(now: Date): [string, string] {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return [new Date(start).toISOString(), new Date(start + 86_400_000).toISOString()];
}

const LOCK = `SELECT pg_advisory_xact_lock(7011001)`;

export async function setKillSwitch(db: Sql, on: boolean): Promise<void> {
  await db.query(`INSERT INTO creative.runtime_state(key, value) VALUES ('kill_switch', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [JSON.stringify({ on })]);
}
async function killSwitchOn(db: Sql): Promise<boolean> {
  const r = await db.query<{ value: { on?: boolean } }>(`SELECT value FROM creative.runtime_state WHERE key='kill_switch'`);
  return r.rows[0]?.value?.on === true;
}

export async function breakerOpen(db: Sql, provider: string, now: Date): Promise<boolean> {
  const r = await db.query<{ value: { openUntil?: string } }>(`SELECT value FROM creative.runtime_state WHERE key=$1`, [`breaker:${provider}`]);
  const until = r.rows[0]?.value?.openUntil;
  return !!until && new Date(until) > now;
}
export async function recordProviderFailure(db: Db, provider: string, now: Date): Promise<void> {
  await db.transaction(async tx => {
    await tx.query(LOCK);
    const key = `breaker:${provider}`;
    const cur = (await tx.query<{ value: { failures?: number } }>(`SELECT value FROM creative.runtime_state WHERE key=$1`, [key])).rows[0]?.value?.failures ?? 0;
    const failures = cur + 1;
    const openUntil = failures >= BREAKER_THRESHOLD ? new Date(now.getTime() + BREAKER_OPEN_SECONDS * 1000).toISOString() : null;
    await tx.query(`INSERT INTO creative.runtime_state(key, value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
      [key, JSON.stringify({ failures: openUntil ? 0 : failures, openUntil })]);
  });
}
export async function recordProviderSuccess(db: Sql, provider: string): Promise<void> {
  await db.query(`INSERT INTO creative.runtime_state(key, value) VALUES ($1,'{"failures":0,"openUntil":null}'::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [`breaker:${provider}`]);
}

export async function reserve(db: Db, a: { computeId: number | null; jobId?: number | null; provider: string; reserveUsd: number; cfg: BudgetConfig; now: Date }): Promise<Reservation> {
  return db.transaction(async tx => {
    await tx.query(LOCK);                                                     // serialises every reservation
    if (await killSwitchOn(tx)) return { ok: false, reason: 'kill_switch' } as const;
    if (await breakerOpen(tx, a.provider, a.now)) return { ok: false, reason: 'breaker_open' } as const;
    const [d0, d1] = utcDay(a.now);
    const spent = (await tx.query<{ s: string }>(
      `SELECT COALESCE(SUM(CASE status WHEN 'settled' THEN settled_usd WHEN 'released' THEN 0 ELSE reserved_usd END),0)::text AS s
         FROM creative.usage_ledger WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`, [d0, d1])).rows[0].s;
    if (Number(spent) + a.reserveUsd > a.cfg.dailyGlobalUsd + 1e-9) return { ok: false, reason: 'global_cap' } as const;
    const r = await tx.query<{ id: number }>(
      `INSERT INTO creative.usage_ledger(compute_id, job_id, provider, reserved_usd, status, created_at) VALUES ($1,$2,$3,$4,'reserved',$5::timestamptz) RETURNING id::int`,
      [a.computeId, a.jobId ?? null, a.provider, a.reserveUsd, a.now.toISOString()]);
    return { ok: true, ledgerId: r.rows[0].id } as const;
  });
}

export async function settle(db: Sql, ledgerId: number, a: { settledUsd: number; inputTokens: number; outputTokens: number; externalRequestId: string | null }): Promise<void> {
  await db.query(
    `UPDATE creative.usage_ledger SET status='settled', settled_usd=$2, input_tokens=$3, output_tokens=$4, external_request_id=$5 WHERE id=$1 AND status IN ('reserved','unknown')`,
    [ledgerId, a.settledUsd, a.inputTokens, a.outputTokens, a.externalRequestId]);
}
/** No provider call happened (or it provably failed before billing): give the reservation back. */
export async function releaseReservation(db: Sql, ledgerId: number): Promise<void> {
  await db.query(`UPDATE creative.usage_ledger SET status='released', settled_usd=0 WHERE id=$1 AND status='reserved'`, [ledgerId]);
}
/** The request may have been billed. Keep the reservation counted; a human reconciles it. */
export async function markUnknown(db: Sql, ledgerId: number): Promise<void> {
  await db.query(`UPDATE creative.usage_ledger SET status='unknown' WHERE id=$1 AND status='reserved'`, [ledgerId]);
}
export async function spentToday(db: Sql, now: Date): Promise<number> {
  const [d0, d1] = utcDay(now);
  const r = await db.query<{ s: string }>(
    `SELECT COALESCE(SUM(CASE status WHEN 'settled' THEN settled_usd WHEN 'released' THEN 0 ELSE reserved_usd END),0)::text AS s FROM creative.usage_ledger WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`, [d0, d1]);
  return Number(r.rows[0].s);
}
