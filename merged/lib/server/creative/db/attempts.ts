import type { Db, Sql } from './sql';

/* Ticket 077 — global compute dedup + per-actor attempt alias, with durable leases.
   Exactly one caller per compute key becomes the WINNER and may call a provider; everyone else follows. */

export interface ComputeRow { id: number; state: string; lease_until: string | null; proposal_id: number | null; result_code: string | null; model_request_id: string | null }
export type Claim =
  | { role: 'winner'; compute: ComputeRow; resumed: boolean }
  | { role: 'follower'; compute: ComputeRow };

const COLS = `id::int, state, lease_until, proposal_id::int, result_code, model_request_id`;
export const LEASE_SECONDS = 30;

export async function claimCompute(db: Db, a: {
  actorHash: string; attemptId: string; computeKey: string; releaseId: number; recipeKey: string; actionKey: string; now: Date; leaseSeconds?: number;
}): Promise<Claim> {
  const lease = new Date(a.now.getTime() + (a.leaseSeconds ?? LEASE_SECONDS) * 1000).toISOString();
  const now = a.now.toISOString();
  return db.transaction(async tx => {
    // 1. an attempt id is bound to the FIRST compute it ever pointed at (a stale/forged id cannot be re-aimed)
    const alias = await tx.query<{ compute_id: number }>(
      `SELECT compute_id::int FROM creative.attempt_alias WHERE actor_hash=$1 AND attempt_id=$2`, [a.actorHash, a.attemptId]);
    if (alias.rows[0]) {
      const c = (await tx.query<ComputeRow>(`SELECT ${COLS} FROM creative.creative_compute WHERE id=$1`, [alias.rows[0].compute_id])).rows[0];
      return { role: 'follower', compute: c } as Claim;
    }
    // 2. the single winner inserts the row
    const ins = await tx.query<ComputeRow>(
      `INSERT INTO creative.creative_compute(compute_key, release_id, recipe_key, action_key, state, lease_until, updated_at)
       VALUES ($1,$2,$3,$4,'leased',$5::timestamptz,$6::timestamptz) ON CONFLICT (compute_key) DO NOTHING RETURNING ${COLS}`,
      [a.computeKey, a.releaseId, a.recipeKey, a.actionKey, lease, now]);
    let claim: Claim;
    if (ins.rows[0]) {
      claim = { role: 'winner', compute: ins.rows[0], resumed: false };
    } else {
      const cur = (await tx.query<ComputeRow>(`SELECT ${COLS} FROM creative.creative_compute WHERE compute_key=$1 FOR UPDATE`, [a.computeKey])).rows[0];
      const expired = (cur.state === 'leased' || cur.state === 'failed') && cur.lease_until !== null && new Date(cur.lease_until) <= a.now;
      if (expired) {
        // a crashed or failed worker: ONE new winner resumes it (the row is locked, so only one passes)
        const up = await tx.query<ComputeRow>(
          `UPDATE creative.creative_compute SET state='leased', lease_until=$2::timestamptz, updated_at=$3::timestamptz WHERE id=$1 RETURNING ${COLS}`,
          [cur.id, lease, now]);
        claim = { role: 'winner', compute: up.rows[0], resumed: true };
      } else claim = { role: 'follower', compute: cur };
    }
    await tx.query(
      `INSERT INTO creative.attempt_alias(actor_hash, attempt_id, compute_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [a.actorHash, a.attemptId, claim.compute.id]);
    return claim;
  });
}

export async function finishCompute(db: Sql, a: {
  computeId: number; state: 'none' | 'pending_review' | 'failed'; resultCode?: string; proposalId?: number | null; requestId?: string | null; retryAfter?: Date; now: Date;
}): Promise<void> {
  await db.query(
    `UPDATE creative.creative_compute SET state=$2, result_code=$3, proposal_id=$4, model_request_id=COALESCE($5, model_request_id),
       lease_until=$6::timestamptz, updated_at=$7::timestamptz WHERE id=$1`,
    [a.computeId, a.state, a.resultCode ?? null, a.proposalId ?? null, a.requestId ?? null, a.state === 'failed' ? (a.retryAfter ?? a.now).toISOString() : null, a.now.toISOString()]);
}

/** Attempts a guest has started in the current UTC day (used by the per-actor quota). */
export async function actorAttemptsToday(db: Sql, actorHash: string, now: Date): Promise<number> {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM creative.attempt_alias WHERE actor_hash=$1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
    [actorHash, new Date(start).toISOString(), new Date(start + 86_400_000).toISOString()]);
  return r.rows[0].n;
}
