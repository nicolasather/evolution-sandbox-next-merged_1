import type { Db, Sql } from './sql';

/* Ticket 082/083 — content releases: draft -> validated -> staged -> active -> revoked. One active release
   (partial unique index). Rollback is a pointer swap back to a previously active immutable release. */

export interface ReleaseRow { id: number; manifest_sha256: string; status: string; parent_release_id: number | null; engine_source_hash: string }

export async function createRelease(db: Sql, a: { manifestSha256: string; engineSourceHash: string; parentId?: number | null }): Promise<number> {
  const r = await db.query<{ id: number }>(
    `INSERT INTO creative.content_release(manifest_sha256, engine_source_hash, parent_release_id)
     VALUES ($1,$2,$3) ON CONFLICT (manifest_sha256) DO UPDATE SET manifest_sha256 = EXCLUDED.manifest_sha256 RETURNING id`,
    [a.manifestSha256, a.engineSourceHash, a.parentId ?? null]);
  return Number(r.rows[0].id);
}

export async function activeRelease(db: Sql): Promise<ReleaseRow | null> {
  const r = await db.query<ReleaseRow>(`SELECT id::int, manifest_sha256, status, parent_release_id::int, engine_source_hash FROM creative.content_release WHERE status='active'`);
  return r.rows[0] ?? null;
}

export async function releaseBySha(db: Sql, sha: string): Promise<ReleaseRow | null> {
  const r = await db.query<ReleaseRow>(`SELECT id::int, manifest_sha256, status, parent_release_id::int, engine_source_hash FROM creative.content_release WHERE manifest_sha256=$1`, [sha]);
  return r.rows[0] ?? null;
}

async function step(tx: Sql, id: number, from: string, to: string): Promise<void> {
  const r = await tx.query(`UPDATE creative.content_release SET status=$3 WHERE id=$1 AND status=$2`, [id, from, to]);
  if (r.rowCount !== 1) throw new Error(`release ${id} is not ${from}`);
}

/** First run: make sure there is an active baseline release so requests have a hash to pin to. */
export async function ensureBaselineRelease(db: Db, a: { manifestSha256: string; engineSourceHash: string }): Promise<ReleaseRow> {
  return db.transaction(async tx => {
    const cur = await activeRelease(tx);
    if (cur) return cur;
    const id = await createRelease(tx, a);
    for (const [f, t] of [['draft', 'validated'], ['validated', 'staged'], ['staged', 'active']] as const) await step(tx, id, f, t);
    return (await releaseBySha(tx, a.manifestSha256))!;
  });
}

export type ActivateResult = { ok: true } | { ok: false; code: 'conflict' | 'not_found' | 'not_activatable' };

/** Pointer swap. `expectedActiveId` stops two operators from racing; the old active becomes revoked, the target active. */
export async function activateRelease(db: Db, a: { releaseId: number; expectedActiveId: number }): Promise<ActivateResult> {
  return db.transaction(async tx => {
    const rows = (await tx.query<{ id: number; status: string; activated_at: string | null }>(
      `SELECT id::int, status, activated_at FROM creative.content_release WHERE status='active' OR id=$1 ORDER BY id FOR UPDATE`, [a.releaseId])).rows;
    const cur = rows.find(r => r.status === 'active');
    const target = rows.find(r => r.id === a.releaseId);
    if (!target) return { ok: false, code: 'not_found' } as const;
    if (!cur || cur.id !== a.expectedActiveId) return { ok: false, code: 'conflict' } as const;
    if (cur.id === target.id) return { ok: true } as const;
    const okState = target.status === 'staged' || (target.status === 'revoked' && target.activated_at !== null);
    if (!okState) return { ok: false, code: 'not_activatable' } as const;
    await step(tx, cur.id, 'active', 'revoked');
    await step(tx, target.id, target.status, 'active');
    return { ok: true } as const;
  });
}

export interface StagedRoute { targetId: string; ingredientIds: string[]; sourceProposalId: number | null; approvedBy: string }

/** Create (or reuse) an immutable release holding exactly these routes and walk it to `staged`. */
export async function stageRelease(db: Db, a: { manifestSha256: string; engineSourceHash: string; parentId: number | null; routes: StagedRoute[] }): Promise<{ id: number; created: boolean }> {
  return db.transaction(async tx => {
    const ex = await releaseBySha(tx, a.manifestSha256);
    if (ex) return { id: ex.id, created: false };
    const id = await createRelease(tx, { manifestSha256: a.manifestSha256, engineSourceHash: a.engineSourceHash, parentId: a.parentId });
    for (const r of a.routes) {
      await tx.query(
        `INSERT INTO creative.published_route(release_id, target_item_id, ingredient_ids, action_key, source_proposal_id, approved_by) VALUES ($1,$2,$3::text[],'',$4,$5)`,
        [id, r.targetId, r.ingredientIds, r.sourceProposalId, r.approvedBy]);
    }
    await step(tx, id, 'draft', 'validated');
    await step(tx, id, 'validated', 'staged');
    return { id, created: true };
  });
}
