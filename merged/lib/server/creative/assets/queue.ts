import type { Db, Sql } from '../db/sql';

/* Ticket 089 — durable asset jobs. One job per (item, brief, style, provider). A worker holds a time-boxed lease;
   a crashed worker's lease simply expires and the next worker RESUMES the same provider task (the task id is
   write-once in SQL), so a crash can never submit — and bill — a second generation. */

export const JOB_LEASE_SECONDS = 60;
export const MAX_JOB_ATTEMPTS = 4;

export interface JobRow { id: number; item_id: string; visual_brief_hash: string; style_version: string; provider_version: string; state: string; provider_task_id: string | null; worker_id: string | null; lease_until: string | null; attempts: number; next_retry_at: string | null; last_error: string | null }
const COLS = `id::int, item_id, visual_brief_hash, style_version, provider_version, state, provider_task_id, worker_id, lease_until, attempts, next_retry_at, last_error`;

export async function enqueueAssetJob(db: Sql, a: { itemId: string; briefHash: string; styleVersion: string; providerVersion: string }): Promise<{ id: number; created: boolean }> {
  const ins = await db.query<{ id: number }>(
    `INSERT INTO creative.asset_job(item_id, visual_brief_hash, style_version, provider_version) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id::int`,
    [a.itemId, a.briefHash, a.styleVersion, a.providerVersion]);
  if (ins.rows[0]) return { id: ins.rows[0].id, created: true };
  const ex = await db.query<{ id: number }>(`SELECT id::int FROM creative.asset_job WHERE item_id=$1 AND visual_brief_hash=$2 AND style_version=$3 AND provider_version=$4`,
    [a.itemId, a.briefHash, a.styleVersion, a.providerVersion]);
  return { id: ex.rows[0].id, created: false };
}

/** Claim ONE runnable job (queued and due, retry due, or an expired lease). SKIP LOCKED: concurrent workers never share one. */
export async function claimJob(db: Db, a: { workerId: string; now: Date; leaseSeconds?: number }): Promise<JobRow | null> {
  const now = a.now.toISOString();
  const until = new Date(a.now.getTime() + (a.leaseSeconds ?? JOB_LEASE_SECONDS) * 1000).toISOString();
  return db.transaction(async tx => {
    const r = await tx.query<{ id: number }>(
      `SELECT id::int FROM creative.asset_job
        WHERE (state IN ('queued','retryable_failure') AND (next_retry_at IS NULL OR next_retry_at <= $1::timestamptz))
           OR (state = 'leased' AND lease_until <= $1::timestamptz)
        ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`, [now]);
    if (!r.rows[0]) return null;
    const u = await tx.query<JobRow>(`UPDATE creative.asset_job SET state='leased', worker_id=$2, lease_until=$3::timestamptz WHERE id=$1 RETURNING ${COLS}`, [r.rows[0].id, a.workerId, until]);
    return u.rows[0];
  });
}

const owns = `id=$1 AND state='leased' AND worker_id=$2 AND lease_until > $3::timestamptz`;

/** Write-once provider task id; only the current lease holder can record it. */
export async function recordTask(db: Sql, a: { jobId: number; workerId: string; taskId: string; now: Date }): Promise<boolean> {
  const r = await db.query(`UPDATE creative.asset_job SET provider_task_id=$4 WHERE ${owns} AND provider_task_id IS NULL`, [a.jobId, a.workerId, a.now.toISOString(), a.taskId]);
  return r.rowCount === 1;
}

/** Not ready yet: hand the job back and come again later. Polling does not count as an attempt. */
export async function requeueLater(db: Sql, a: { jobId: number; workerId: string; now: Date; delaySeconds: number }): Promise<boolean> {
  const r = await db.query(`UPDATE creative.asset_job SET state='queued', worker_id=NULL, lease_until=NULL, next_retry_at=$4::timestamptz WHERE ${owns}`,
    [a.jobId, a.workerId, a.now.toISOString(), new Date(a.now.getTime() + a.delaySeconds * 1000).toISOString()]);
  return r.rowCount === 1;
}

export async function failJob(db: Sql, a: { jobId: number; workerId: string; now: Date; error: string; retryable: boolean }): Promise<'retry' | 'permanent' | 'not_owner'> {
  const cur = await db.query<{ attempts: number }>(`SELECT attempts FROM creative.asset_job WHERE ${owns}`, [a.jobId, a.workerId, a.now.toISOString()]);
  if (!cur.rows[0]) return 'not_owner';
  const attempts = cur.rows[0].attempts + 1;
  const permanent = !a.retryable || attempts >= MAX_JOB_ATTEMPTS;
  const backoff = Math.min(3600, 30 * 2 ** (attempts - 1));
  await db.query(
    `UPDATE creative.asset_job SET state=$2, attempts=$3, worker_id=NULL, lease_until=NULL, last_error=$4, next_retry_at=$5::timestamptz WHERE id=$1`,
    [a.jobId, permanent ? 'permanent_failure' : 'retryable_failure', attempts, a.error.slice(0, 200), permanent ? null : new Date(a.now.getTime() + backoff * 1000).toISOString()]);
  return permanent ? 'permanent' : 'retry';
}

/** The generated file passed validation and is stored as a DRAFT asset awaiting a human. */
export async function completeJob(db: Db, a: { jobId: number; workerId: string; now: Date; itemId: string; storageKey: string; sha256: string; sizeBytes: number; provenance: Record<string, unknown> }): Promise<{ assetId: number } | null> {
  return db.transaction(async tx => {
    const own = await tx.query(`SELECT 1 FROM creative.asset_job WHERE ${owns} FOR UPDATE`, [a.jobId, a.workerId, a.now.toISOString()]);
    if (!own.rows[0]) return null;
    const v = await tx.query<{ id: number }>(
      `INSERT INTO creative.visual_asset(job_id, item_id, status, storage_key, media_type, size_bytes, sha256, provenance)
       VALUES ($1,$2,'validated',$3,'model/gltf-binary',$4,$5,$6::jsonb) RETURNING id::int`,
      [a.jobId, a.itemId, a.storageKey, a.sizeBytes, a.sha256, JSON.stringify(a.provenance)]);
    await tx.query(`UPDATE creative.asset_job SET state='pending_review', worker_id=NULL, lease_until=NULL WHERE id=$1`, [a.jobId]);
    return { assetId: v.rows[0].id };
  });
}
