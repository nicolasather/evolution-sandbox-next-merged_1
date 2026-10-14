import type { Db, Sql } from '../db/sql';
import { audit } from '../db/proposals';
import { safeAssetUrl, type AssetManifest } from '@/lib/visuals/resolver';

/* Ticket 092 — human review of generated assets and the published manifest. A generated file is invisible to players
   until: validated by the server (GLB rules) -> approved by a named human -> published into the manifest that the
   next build ships. Rows are append-mostly; SQL refuses any shortcut (see 003_asset_guards.sql). */

export interface AssetRow { id: number; item_id: string; status: string; storage_key: string; sha256: string; size_bytes: number; provenance: Record<string, unknown>; reviewed_by: string | null }
const COLS = `id::int, item_id, status, storage_key, sha256, size_bytes::int, provenance, reviewed_by`;

export async function listAssets(db: Sql, status: string): Promise<AssetRow[]> {
  return (await db.query<AssetRow>(`SELECT ${COLS} FROM creative.visual_asset WHERE status=$1 ORDER BY id LIMIT 100`, [status])).rows;
}

export type ReviewResult = { ok: true; status: string } | { ok: false; code: 'not_found' | 'illegal_transition' };

export async function reviewAsset(db: Db, a: { assetId: number; action: 'approve' | 'publish' | 'reject'; reviewer: string }): Promise<ReviewResult> {
  return db.transaction(async tx => {
    const row = (await tx.query<AssetRow>(`SELECT ${COLS} FROM creative.visual_asset WHERE id=$1 FOR UPDATE`, [a.assetId])).rows[0];
    if (!row) return { ok: false, code: 'not_found' } as const;
    const next = a.action === 'approve' ? 'approved' : a.action === 'publish' ? 'published' : 'rejected';
    const legal = (row.status === 'validated' && (next === 'approved' || next === 'rejected')) || (row.status === 'approved' && (next === 'published' || next === 'rejected'));
    if (!legal) return { ok: false, code: 'illegal_transition' } as const;
    await tx.query(`UPDATE creative.visual_asset SET status=$2, reviewed_by=$3 WHERE id=$1`, [a.assetId, next, a.reviewer]);
    if (next === 'published') await tx.query(`UPDATE creative.asset_job SET state='published' WHERE id=(SELECT job_id FROM creative.visual_asset WHERE id=$1)`, [a.assetId]);
    await audit(tx, { actorRole: 'owner', actorHash: a.reviewer, kind: `asset_${next}`, objectType: 'asset', objectId: a.assetId, details: { item: row.item_id, sha256: row.sha256 } });
    return { ok: true, status: next } as const;
  });
}

/** The manifest the next build ships: PUBLISHED assets only, URL built from the store base the owner configured. */
export async function exportAssetManifest(db: Sql, baseUrl: string, allowedHosts: readonly string[]): Promise<AssetManifest> {
  const rows = await db.query<{ item_id: string; sha256: string; storage_key: string }>(
    `SELECT item_id, sha256, storage_key FROM creative.visual_asset WHERE status='published' ORDER BY item_id, id`);
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const assets = rows.rows
    .map(r => ({ itemId: r.item_id, sha256: r.sha256, mediaType: 'model/gltf-binary' as const, url: base + r.storage_key, status: 'published' as const }))
    .filter(a => safeAssetUrl(a.url, allowedHosts));
  return { schemaVersion: 1, assets };
}
