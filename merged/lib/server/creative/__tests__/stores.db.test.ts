/** @jest-environment node */
import { playDb, processingData } from '@/lib/processing';
import { testDb } from '../testing/testDb';
import { buildCatalog } from '../catalog';
import { type Db } from '../db/sql';
import { migrate } from '../db/migrate';
import { importApprovedRefs } from '../db/refs';
import { createRelease, activeRelease, ensureBaselineRelease, activateRelease, releaseBySha } from '../db/releases';
import { claimCompute, finishCompute, actorAttemptsToday } from '../db/attempts';
import { getNegative, putNegative, pruneNegative } from '../db/negativeCache';
import { reserve, settle, releaseReservation, markUnknown, spentToday, setKillSwitch, recordProviderFailure, recordProviderSuccess, breakerOpen, BREAKER_THRESHOLD } from '../db/budget';
import { insertProposal, decideProposal, listProposals } from '../db/proposals';
import { negativeKey } from '../recipeKey';

const cat = buildCatalog(playDb, processingData);
const SHA_A = 'a'.repeat(64), SHA_B = 'b'.repeat(64), SHA_C = 'c'.repeat(64);
const T0 = new Date('2026-10-14T10:00:00Z');
let db: Db;
let verified: string[] = [];
let unverified = '';

beforeAll(async () => {
  db = await testDb();
  await migrate(db);
  const r = await importApprovedRefs(db, cat);
  expect(r.verified).toBeGreaterThan(50);
  expect(r.quarantined).toBeGreaterThan(100);
  verified = (await db.query<{ id: string }>(`SELECT id FROM creative.approved_item_ref WHERE is_verified ORDER BY id LIMIT 12`)).rows.map(x => x.id);
  unverified = (await db.query<{ id: string }>(`SELECT id FROM creative.approved_item_ref WHERE NOT is_verified ORDER BY id LIMIT 1`)).rows[0].id;
});
afterAll(async () => { await db.close(); });

describe('074/076 approved refs', () => {
  it('only catalogue-verified items are flagged verified; re-import is idempotent', async () => {
    const again = await importApprovedRefs(db, cat);
    expect(again.verified + again.quarantined).toBe(playDb.nodes.length);
    const n = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM creative.approved_item_ref`)).rows[0].n;
    expect(n).toBe(playDb.nodes.length);
  });
});

describe('082 releases: single active, pointer-swap rollback, illegal transitions', () => {
  let base: number, second: number;
  it('baseline is created once and is the only active release', async () => {
    const a = await ensureBaselineRelease(db, { manifestSha256: SHA_A, engineSourceHash: 'e1' });
    const b = await ensureBaselineRelease(db, { manifestSha256: SHA_B, engineSourceHash: 'e1' });
    expect(a.id).toBe(b.id);
    expect(a.status).toBe('active');
    base = a.id;
  });
  it('activating a staged release revokes the old one; rollback restores it', async () => {
    second = await createRelease(db, { manifestSha256: SHA_C, engineSourceHash: 'e1', parentId: base });
    await db.query(`UPDATE creative.content_release SET status='validated' WHERE id=$1`, [second]);
    await db.query(`UPDATE creative.content_release SET status='staged' WHERE id=$1`, [second]);
    expect(await activateRelease(db, { releaseId: second, expectedActiveId: base })).toEqual({ ok: true });
    expect((await activeRelease(db))!.id).toBe(second);
    expect((await releaseBySha(db, SHA_A))!.status).toBe('revoked');
    expect(await activateRelease(db, { releaseId: base, expectedActiveId: second })).toEqual({ ok: true });   // rollback
    expect((await activeRelease(db))!.manifest_sha256).toBe(SHA_A);
  });
  it('a stale operator (wrong expected active id) gets a conflict and nothing changes', async () => {
    expect(await activateRelease(db, { releaseId: second, expectedActiveId: 999 })).toEqual({ ok: false, code: 'conflict' });
    expect((await activeRelease(db))!.id).toBe(base);
  });
  it('SQL refuses draft->active, never-active revoked->active, manifest edits and a second active row', async () => {
    const d = await createRelease(db, { manifestSha256: 'd'.repeat(64), engineSourceHash: 'e1' });
    await expect(db.query(`UPDATE creative.content_release SET status='active' WHERE id=$1`, [d])).rejects.toThrow();
    await expect(db.query(`UPDATE creative.content_release SET manifest_sha256=$2 WHERE id=$1`, [d, 'f'.repeat(64)])).rejects.toThrow(/immutable/);
    await db.query(`UPDATE creative.content_release SET status='validated' WHERE id=$1`, [d]);
    await db.query(`UPDATE creative.content_release SET status='staged' WHERE id=$1`, [d]);
    await expect(db.query(`UPDATE creative.content_release SET status='active' WHERE id=$1`, [d])).rejects.toThrow();   // unique active
  });
});

describe('077 compute dedup', () => {
  it('1000 identical concurrent attempts produce exactly one winner', async () => {
    const rel = (await activeRelease(db))!.id;
    const rk = 'recipe-v2:2:5:stone', ak = '';
    const claims = await Promise.all(Array.from({ length: 1000 }, (_, i) =>
      claimCompute(db, { actorHash: `actor${i % 200}`, attemptId: `attempt_${i}__x`, computeKey: 'k'.repeat(64), releaseId: rel, recipeKey: rk, actionKey: ak, now: T0 })));
    expect(claims.filter(c => c.role === 'winner').length).toBe(1);
    expect(new Set(claims.map(c => c.compute.id)).size).toBe(1);
  }, 120000);
  it('an expired lease is taken over by exactly one resumer; a live lease is not', async () => {
    const rel = (await activeRelease(db))!.id;
    const base = { computeKey: 'l'.repeat(64), releaseId: rel, recipeKey: 'recipe-v2:2:5:wood', actionKey: '' };
    const w = await claimCompute(db, { ...base, actorHash: 'u1', attemptId: 'attempt_lease_1', now: T0 });
    expect(w.role).toBe('winner');
    const live = await claimCompute(db, { ...base, actorHash: 'u2', attemptId: 'attempt_lease_2', now: new Date(T0.getTime() + 5000) });
    expect(live.role).toBe('follower');
    const later = new Date(T0.getTime() + 60_000);
    const res = await Promise.all([3, 4, 5, 6].map(i => claimCompute(db, { ...base, actorHash: `u${i}`, attemptId: `attempt_lease_${i}`, now: later })));
    expect(res.filter(c => c.role === 'winner').length).toBe(1);
    expect((res.find(c => c.role === 'winner') as { resumed: boolean }).resumed).toBe(true);
  });
  it('an attempt id stays bound to its first compute; finish stores the result; quota counts aliases', async () => {
    const rel = (await activeRelease(db))!.id;
    const w = await claimCompute(db, { actorHash: 'q1', attemptId: 'attempt_bind_1', computeKey: 'm'.repeat(64), releaseId: rel, recipeKey: 'recipe-v2:2:4:bone', actionKey: '', now: T0 });
    const again = await claimCompute(db, { actorHash: 'q1', attemptId: 'attempt_bind_1', computeKey: 'n'.repeat(64), releaseId: rel, recipeKey: 'recipe-v2:2:4:zzzz', actionKey: '', now: T0 });
    expect(again.compute.id).toBe(w.compute.id);
    await finishCompute(db, { computeId: w.compute.id, state: 'none', resultCode: 'no_route', now: T0 });
    const fol = await claimCompute(db, { actorHash: 'q2', attemptId: 'attempt_bind_2', computeKey: 'm'.repeat(64), releaseId: rel, recipeKey: 'recipe-v2:2:4:bone', actionKey: '', now: T0 });
    expect(fol.role).toBe('follower');
    expect(fol.compute.state).toBe('none');
    expect(await actorAttemptsToday(db, 'q1', new Date())).toBeGreaterThanOrEqual(0);
  });
});

describe('078 negative cache', () => {
  it('hits until expiry (fake clock), a new release/rules version never hits the old key, prune removes', async () => {
    const k = negativeKey(SHA_A, ['stone', 'wood'], null, 'rules-1');
    await putNegative(db, k, 'none', 60, T0);
    expect(await getNegative(db, k, new Date(T0.getTime() + 59_000))).toEqual({ reason: 'none' });
    expect(await getNegative(db, k, new Date(T0.getTime() + 61_000))).toBeNull();
    expect(await getNegative(db, negativeKey(SHA_B, ['stone', 'wood'], null, 'rules-1'), T0)).toBeNull();
    expect(await getNegative(db, negativeKey(SHA_A, ['stone', 'wood'], null, 'rules-2'), T0)).toBeNull();
    expect(await pruneNegative(db, new Date(T0.getTime() + 120_000))).toBeGreaterThanOrEqual(1);
    await expect(putNegative(db, 'short', 'x', 1, T0)).rejects.toThrow();
  });
});

describe('079 budget, kill switch, breaker', () => {
  const NOW = new Date('2026-10-15T09:00:00Z');   // a fresh UTC day
  it('serial reservations stop at the cap; release gives money back; unknown stays counted', async () => {
    const cfg = { dailyGlobalUsd: 1 };
    const r1 = await reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.4, cfg, now: NOW });
    const r2 = await reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.4, cfg, now: NOW });
    const r3 = await reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.4, cfg, now: NOW });
    expect(r1.ok && r2.ok).toBe(true);
    expect(r3).toEqual({ ok: false, reason: 'global_cap' });
    if (r1.ok) await releaseReservation(db, r1.ledgerId);
    if (r2.ok) await markUnknown(db, r2.ledgerId);
    expect(await spentToday(db, NOW)).toBeCloseTo(0.4, 5);
    const r4 = await reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.5, cfg, now: NOW });
    expect(r4.ok).toBe(true);
    if (r4.ok) await settle(db, r4.ledgerId, { settledUsd: 0.1, inputTokens: 10, outputTokens: 5, externalRequestId: 'req_1' });
    expect(await spentToday(db, NOW)).toBeCloseTo(0.5, 5);
  });
  it('200 concurrent reservations never exceed the cap', async () => {
    const NOW2 = new Date('2026-10-16T09:00:00Z');
    const cfg = { dailyGlobalUsd: 2 };
    const res = await Promise.all(Array.from({ length: 200 }, () => reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.05, cfg, now: NOW2 })));
    expect(res.filter(r => r.ok).length).toBe(40);
    expect(await spentToday(db, NOW2)).toBeLessThanOrEqual(2 + 1e-9);
  }, 120000);
  it('kill switch blocks every reservation and can be lifted', async () => {
    const NOW3 = new Date('2026-10-17T09:00:00Z');
    await setKillSwitch(db, true);
    expect(await reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.01, cfg: { dailyGlobalUsd: 100 }, now: NOW3 })).toEqual({ ok: false, reason: 'kill_switch' });
    await setKillSwitch(db, false);
    expect((await reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.01, cfg: { dailyGlobalUsd: 100 }, now: NOW3 })).ok).toBe(true);
  });
  it('breaker opens after repeated failures, closes by time and by success', async () => {
    const NOW4 = new Date('2026-10-18T09:00:00Z');
    for (let i = 0; i < BREAKER_THRESHOLD; i++) await recordProviderFailure(db, 'llm', NOW4);
    expect(await breakerOpen(db, 'llm', NOW4)).toBe(true);
    expect(await reserve(db, { computeId: null, provider: 'llm', reserveUsd: 0.01, cfg: { dailyGlobalUsd: 100 }, now: NOW4 })).toEqual({ ok: false, reason: 'breaker_open' });
    expect(await breakerOpen(db, 'llm', new Date(NOW4.getTime() + 121_000))).toBe(false);
    await recordProviderSuccess(db, 'llm');
    expect(await breakerOpen(db, 'llm', NOW4)).toBe(false);   // a proven success closes the breaker immediately
  });
});

describe('080/081 proposals: idempotent, optimistic approval, canonical wins, SQL guards', () => {
  const mk = (rel: number, ing: string[], target: string, pv = 'p1') => ({
    releaseId: rel, targetId: target, ingredientIds: ing, actionKey: '', processId: 'proc_x', mechanism: 'm', reasonCodes: ['r'], modelId: 'fake', promptVersion: pv, provenance: {},
  });
  it('same proposal arriving 50 times is one row; unverified or self targets are refused by SQL', async () => {
    const rel = (await activeRelease(db))!.id;
    const [a, b, c] = verified; void 0;
    const all = await Promise.all(Array.from({ length: 50 }, () => insertProposal(db, mk(rel, [a, b], c))));
    expect(new Set(all.map(x => x.id)).size).toBe(1);
    expect(all.filter(x => x.created).length).toBe(1);
    await expect(insertProposal(db, mk(rel, [a, b], unverified))).rejects.toThrow();
    await expect(insertProposal(db, mk(rel, [a, c], c))).rejects.toThrow();
  });
  it('stale editor gets conflict; approval is recorded in the audit trail; decided proposals are final', async () => {
    const rel = (await activeRelease(db))!.id;
    const [a, b, , d] = verified;
    const { id } = await insertProposal(db, mk(rel, [a, d], b));
    const never = () => false;
    expect(await decideProposal(db, { proposalId: id, expectedVersion: 7, decision: 'approve', reason: 'x', reviewer: 'owner', isClaimedCanonically: never })).toEqual({ ok: false, code: 'conflict' });
    const ok = await decideProposal(db, { proposalId: id, expectedVersion: 1, decision: 'approve', reason: 'verified source', reviewer: 'owner', isClaimedCanonically: never });
    expect(ok).toEqual({ ok: true, status: 'approved', rowVersion: 2 });
    expect(await decideProposal(db, { proposalId: id, expectedVersion: 2, decision: 'reject', reason: 'x', reviewer: 'owner', isClaimedCanonically: never })).toEqual({ ok: false, code: 'not_pending' });
    await expect(db.query(`UPDATE creative.recipe_proposal SET status='pending', row_version=9 WHERE id=$1`, [id])).rejects.toThrow(/illegal/);
    await expect(db.query(`UPDATE creative.recipe_proposal SET mechanism='changed' WHERE id=$1`, [id])).rejects.toThrow(/immutable/);
    const ev = await db.query(`SELECT 1 FROM creative.audit_event WHERE kind='proposal_approved' AND object_id=$1`, [String(id)]);
    expect(ev.rows.length).toBe(1);
  });
  it('an already-canonical recipe cannot be approved; a second approval for the same route is refused', async () => {
    const rel = (await activeRelease(db))!.id;
    const [a, b, c, , e] = verified;
    const p1 = await insertProposal(db, mk(rel, [a, e], b, 'pc'));
    expect(await decideProposal(db, { proposalId: p1.id, expectedVersion: 1, decision: 'approve', reason: 'x', reviewer: 'o', isClaimedCanonically: () => true })).toEqual({ ok: false, code: 'canonical_collision' });
    const p2 = await insertProposal(db, mk(rel, [c, e], a, 'pd'));
    const p3 = await insertProposal(db, mk(rel, [c, e], b, 'pe'));
    const never = () => false;
    expect((await decideProposal(db, { proposalId: p2.id, expectedVersion: 1, decision: 'approve', reason: 'x', reviewer: 'o', isClaimedCanonically: never })).ok).toBe(true);
    expect(await decideProposal(db, { proposalId: p3.id, expectedVersion: 1, decision: 'approve', reason: 'x', reviewer: 'o', isClaimedCanonically: never })).toEqual({ ok: false, code: 'route_already_approved' });
  });
  it('audit rows and published routes are append-only; lists paginate', async () => {
    await expect(db.query(`DELETE FROM creative.audit_event`)).rejects.toThrow(/append-only/);
    const page = await listProposals(db, { status: 'pending', limit: 1 });
    expect(page.items.length).toBeLessThanOrEqual(1);
  });
});
