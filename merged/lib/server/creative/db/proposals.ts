import type { Db, Sql } from './sql';

/* Tickets 080–081 — private proposals, the owner inbox, optimistic approval and the immutable audit trail.
   Approval never makes anything playable: it only marks a proposal eligible for a NEW content release. */

export interface NewProposal {
  releaseId: number; targetId: string; ingredientIds: string[]; actionKey: string; processId: string;
  mechanism: string; reasonCodes: string[]; modelId: string; promptVersion: string; provenance: Record<string, unknown>;
}
export interface ProposalRow {
  id: number; release_id: number; target_item_id: string; ingredient_ids: string[]; recipe_key: string; action_key: string;
  process_id: string; mechanism: string; status: string; row_version: number; model_id: string; prompt_version: string;
  provenance: Record<string, unknown>; reviewed_by: string | null; created_at: string;
}
const COLS = `id::int, release_id::int, target_item_id, ingredient_ids, recipe_key, action_key, process_id, mechanism, status, row_version, model_id, prompt_version, provenance, reviewed_by, created_at`;

export async function audit(db: Sql, a: { actorRole: string; actorHash?: string | null; kind: string; objectType: string; objectId: string | number; details?: Record<string, unknown> }): Promise<void> {
  await db.query(`INSERT INTO creative.audit_event(actor_role, actor_hash, kind, object_type, object_id, details) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [a.actorRole, a.actorHash ?? null, a.kind, a.objectType, String(a.objectId), JSON.stringify(a.details ?? {})]);
}

/** Idempotent: the same (release, recipe, action, target, prompt version) is one proposal, however many times it arrives. */
export async function insertProposal(db: Sql, p: NewProposal): Promise<{ id: number; created: boolean }> {
  const ins = await db.query<{ id: number }>(
    `INSERT INTO creative.recipe_proposal(release_id, target_item_id, ingredient_ids, action_key, process_id, mechanism, reason_codes, model_id, prompt_version, provenance)
     VALUES ($1,$2,$3::text[],$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb) ON CONFLICT DO NOTHING RETURNING id::int`,
    [p.releaseId, p.targetId, p.ingredientIds, p.actionKey, p.processId, p.mechanism.slice(0, 600), JSON.stringify(p.reasonCodes), p.modelId, p.promptVersion, JSON.stringify(p.provenance)]);
  if (ins.rows[0]) { await audit(db, { actorRole: 'system', kind: 'proposal_created', objectType: 'proposal', objectId: ins.rows[0].id, details: { target: p.targetId } }); return { id: ins.rows[0].id, created: true }; }
  const ex = await db.query<{ id: number }>(
    `SELECT id::int FROM creative.recipe_proposal WHERE release_id=$1 AND recipe_key=creative.recipe_v2_key($2::text[]) AND action_key=$3 AND target_item_id=$4 AND prompt_version=$5`,
    [p.releaseId, p.ingredientIds, p.actionKey, p.targetId, p.promptVersion]);
  return { id: ex.rows[0].id, created: false };
}

export async function listProposals(db: Sql, a: { status: string; afterId?: number; limit?: number }): Promise<{ items: ProposalRow[]; next: number | null }> {
  const limit = Math.min(Math.max(a.limit ?? 20, 1), 100);
  const r = await db.query<ProposalRow>(`SELECT ${COLS} FROM creative.recipe_proposal WHERE status=$1 AND id > $2 ORDER BY id LIMIT $3`, [a.status, a.afterId ?? 0, limit + 1]);
  const items = r.rows.slice(0, limit);
  return { items, next: r.rows.length > limit ? items[items.length - 1].id : null };
}

export type Decision = 'approve' | 'reject';
export type DecideResult =
  | { ok: true; status: 'approved' | 'rejected'; rowVersion: number }
  | { ok: false; code: 'not_found' | 'conflict' | 'not_pending' | 'canonical_collision' | 'route_already_approved' | 'target_unverified' };

export async function decideProposal(db: Db, a: {
  proposalId: number; expectedVersion: number; decision: Decision; reason: string; reviewer: string;
  /** true when this multiset is already a canonical recipe in the CURRENT source-controlled graph */
  isClaimedCanonically: (ingredientIds: readonly string[]) => boolean;
}): Promise<DecideResult> {
  return db.transaction(async tx => {
    const row = (await tx.query<ProposalRow>(`SELECT ${COLS} FROM creative.recipe_proposal WHERE id=$1 FOR UPDATE`, [a.proposalId])).rows[0];
    if (!row) return { ok: false, code: 'not_found' } as const;
    if (row.row_version !== a.expectedVersion) return { ok: false, code: 'conflict' } as const;           // stale editor
    if (row.status !== 'pending') return { ok: false, code: 'not_pending' } as const;
    if (a.decision === 'approve') {
      const t = await tx.query<{ is_verified: boolean }>(`SELECT is_verified FROM creative.approved_item_ref WHERE id=$1`, [row.target_item_id]);
      if (!t.rows[0]?.is_verified) return { ok: false, code: 'target_unverified' } as const;
      if (a.isClaimedCanonically(row.ingredient_ids)) return { ok: false, code: 'canonical_collision' } as const;   // existing recipe always wins
      const dup = await tx.query(`SELECT 1 FROM creative.recipe_proposal WHERE recipe_key=$1 AND action_key=$2 AND status='approved'`, [row.recipe_key, row.action_key]);
      if (dup.rows[0]) return { ok: false, code: 'route_already_approved' } as const;                      // previous approval wins
    }
    const status = a.decision === 'approve' ? 'approved' : 'rejected';
    const up = await tx.query<{ row_version: number }>(
      `UPDATE creative.recipe_proposal SET status=$2, row_version=row_version+1, reviewed_by=$3, reviewed_at=now() WHERE id=$1 AND row_version=$4 RETURNING row_version`,
      [row.id, status, a.reviewer, a.expectedVersion]);
    if (!up.rows[0]) return { ok: false, code: 'conflict' } as const;
    await audit(tx, { actorRole: 'owner', actorHash: a.reviewer, kind: `proposal_${status}`, objectType: 'proposal', objectId: row.id, details: { reason: a.reason.slice(0, 400), target: row.target_item_id } });
    return { ok: true, status, rowVersion: up.rows[0].row_version } as const;
  });
}
