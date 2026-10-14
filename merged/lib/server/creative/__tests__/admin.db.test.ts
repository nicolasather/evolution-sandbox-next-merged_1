/** @jest-environment node */
import { playDb, processingData } from '@/lib/processing';
import { testDb } from '../testing/testDb';
import { buildCatalog } from '../catalog';
import { type Db } from '../db/sql';
import { migrate } from '../db/migrate';
import { importApprovedRefs } from '../db/refs';
import { ensureBaselineRelease, activeRelease } from '../db/releases';
import { insertProposal } from '../db/proposals';
import { activateHandler, decideHandler, exportHandler, killSwitchHandler, listHandler } from '../admin';
import { activeManifest, buildBaseCatalog, manifestSha } from '../manifest';
import { reserve } from '../db/budget';

const cat = buildCatalog(playDb, processingData);
const base = buildBaseCatalog();
const open = { ENABLE_DEV_TOOLS: 'true', OWNER_REVIEW_TOKEN: 'tok-123' };
let db: Db;
let verified: string[];
const post = (url: string, o: unknown, token: string | null = 'tok-123') =>
  new Request(`https://x.example${url}`, { method: 'POST', body: JSON.stringify(o), headers: token ? { authorization: `Bearer ${token}` } : {} });
const get = (url: string, token: string | null = 'tok-123') => new Request(`https://x.example${url}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

beforeAll(async () => {
  db = await testDb();
  await migrate(db); await importApprovedRefs(db, cat);
  await ensureBaselineRelease(db, { manifestSha256: activeManifest().manifestSha256, engineSourceHash: activeManifest().engineSourceHash });
  verified = [...base.profiles.values()].filter(p => p.status === 'verified' && p.isNode).map(p => p.id);
});
afterAll(async () => { await db.close(); });

const mk = async (ing: string[], target: string, pv: string) => {
  const rel = (await activeRelease(db))!.id;
  return insertProposal(db, { releaseId: rel, targetId: target, ingredientIds: ing, actionKey: '', processId: 'proc_x', mechanism: 'm', reasonCodes: [], modelId: 'fake', promptVersion: pv, provenance: {} });
};

describe('080–082 owner admin', () => {
  it('is invisible without the developer gate or token; 401 with a wrong one', async () => {
    expect((await listHandler(get('/a'), { db, env: {} })).status).toBe(404);
    expect((await listHandler(get('/a'), { db, env: { ENABLE_DEV_TOOLS: 'true', OWNER_REVIEW_TOKEN: 't', VERCEL_ENV: 'production' } })).status).toBe(404);
    expect((await listHandler(get('/a', null), { db, env: open })).status).toBe(401);
    expect((await listHandler(get('/a', 'wrong'), { db, env: open })).status).toBe(401);
    expect((await exportHandler(post('/e', {}, 'wrong'), { db, env: open })).status).toBe(401);
  });
  it('lists pending, approves with optimistic version, conflicts when stale, refuses canonical collisions', async () => {
    const p = await mk([verified[20], verified[21]], verified[22], 'adm1');
    const l = await (await listHandler(get('/a?status=pending'), { db, env: open })).json();
    expect(l.items.some((x: { id: number }) => x.id === p.id)).toBe(true);
    expect((await decideHandler(post('/d', { proposalId: p.id, expectedVersion: 5, decision: 'approve', reason: 'ok source' }), { db, env: open })).status).toBe(409);
    expect((await decideHandler(post('/d', { proposalId: p.id, expectedVersion: 1, decision: 'approve', reason: '' }), { db, env: open })).status).toBe(400);
    const ok = await decideHandler(post('/d', { proposalId: p.id, expectedVersion: 1, decision: 'approve', reason: 'verified in sources' }), { db, env: open });
    expect(ok.status).toBe(200);
    const [canonKey] = [...base.recipeIndex.keys()];
    const ids = canonKey.split(' ');
    const target = verified.find(v => !ids.includes(v))!;
    const c = await mk(ids, target, 'adm2');
    expect((await decideHandler(post('/d', { proposalId: c.id, expectedVersion: 1, decision: 'approve', reason: 'try' }), { db, env: open })).status).toBe(422);
  });
  it('export stages a NEW immutable release (idempotent) without activating; compile file is validated', async () => {
    const before = (await activeRelease(db))!;
    const r1 = await (await exportHandler(post('/e', {}), { db, env: open })).json();
    expect(r1.routeCount).toBe(1);
    expect(r1.manifestSha256).toBe(manifestSha(r1.file.routes));
    expect(r1.manifestSha256).not.toBe(before.manifest_sha256);
    const r2 = await (await exportHandler(post('/e', {}), { db, env: open })).json();
    expect(r2.releaseId).toBe(r1.releaseId);
    expect(r2.created).toBe(false);
    expect((await activeRelease(db))!.id).toBe(before.id);          // approval/export never makes anything live
    const rows = await db.query(`SELECT 1 FROM creative.published_route WHERE release_id=$1`, [r1.releaseId]);
    expect(rows.rows.length).toBe(1);
  });
  it('activation is a guarded pointer swap with rollback; stale operators get 409; every step is audited', async () => {
    const before = (await activeRelease(db))!;
    const staged = (await db.query<{ id: number }>(`SELECT id::int FROM creative.content_release WHERE status='staged'`)).rows[0].id;
    expect((await activateHandler(post('/a', { releaseId: staged, expectedActiveId: 9999 }), { db, env: open })).status).toBe(409);
    expect((await activateHandler(post('/a', { releaseId: staged, expectedActiveId: before.id }), { db, env: open })).status).toBe(200);
    expect((await activeRelease(db))!.id).toBe(staged);
    expect((await activateHandler(post('/a', { releaseId: before.id, expectedActiveId: staged }), { db, env: open })).status).toBe(200);   // rollback
    expect((await activeRelease(db))!.id).toBe(before.id);
    const kinds = (await db.query<{ kind: string }>(`SELECT kind FROM creative.audit_event ORDER BY id`)).rows.map(x => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(['proposal_approved', 'release_staged', 'release_activated']));
  });
  it('kill switch endpoint blocks spending immediately', async () => {
    expect((await killSwitchHandler(post('/k', { on: true }), { db, env: open })).status).toBe(200);
    expect(await reserve(db, { computeId: null, provider: 'p', reserveUsd: 0.01, cfg: { dailyGlobalUsd: 10 }, now: new Date() })).toEqual({ ok: false, reason: 'kill_switch' });
    await killSwitchHandler(post('/k', { on: false }), { db, env: open });
    expect((await killSwitchHandler(post('/k', { on: 'yes' }), { db, env: open })).status).toBe(400);
  });
});

import { assetsEnqueueHandler, assetsListHandler, assetsReviewHandler, assetsManifestHandler, tickHandler } from '../admin';
import { MockAssetProvider } from '../assets/provider';
import { MemoryStore } from '../assets/storage';
import { assetTick } from '../assets/worker';
import { loadConfig } from '../config';

describe('089/092 asset admin + cron tick', () => {
  const cron = { CRON_SECRET: 'cron-secret-1' };
  let clock = Date.parse('2026-10-20T10:00:00Z');
  const wd = () => ({ db, cat, cfg: loadConfig({ ASSET_AI_ENABLED: 'true', CREATIVE_DAILY_USD_CAP: '5' }), provider: new MockAssetProvider(), store: new MemoryStore(), workerId: 'w', now: () => new Date(clock) });
  it('cron tick: 404 without a configured secret, 401 with a wrong one, runs one bounded step with the right one', async () => {
    const r = (tok: string | null) => new Request('https://x.example/t', { headers: tok ? { authorization: `Bearer ${tok}` } : {} });
    expect((await tickHandler(r('x'), wd(), {})).status).toBe(404);
    expect((await tickHandler(r(null), wd(), cron)).status).toBe(401);
    expect((await tickHandler(r('nope-nope-nope'), wd(), cron)).status).toBe(401);
    expect((await (await tickHandler(r('cron-secret-1'), wd(), cron)).json()).did).toBe('idle');
    expect((await (await tickHandler(r('cron-secret-1'), null, cron)).json()).did).toBe('disabled');
  });
  it('owner enqueues an eligible item, the worker stores a draft, the owner approves and publishes, the manifest lists it', async () => {
    const item = verified[30];
    expect((await assetsEnqueueHandler(post('/q', { itemId: 'definitely_not' }, 'wrong'), { db, env: open, cat, providerVersion: 'mock-1' })).status).toBe(401);
    expect((await assetsEnqueueHandler(post('/q', { itemId: 'definitely_not' }), { db, env: open, cat, providerVersion: 'mock-1' })).status).toBe(422);
    const q = await (await assetsEnqueueHandler(post('/q', { itemId: item }), { db, env: open, cat, providerVersion: 'mock-1' })).json();
    expect(q.created).toBe(true);
    const w = wd();
    let did = '';
    for (let i = 0; i < 4 && did !== 'stored'; i++) { did = (await assetTick(w)).did; clock += 30_000; }
    expect(did).toBe('stored');
    const list = await (await assetsListHandler(get('/a?status=validated'), { db, env: open })).json();
    const id = list.items.find((x: { item_id: string }) => x.item_id === item).id;
    expect((await assetsReviewHandler(post('/r', { assetId: id, action: 'publish' }), { db, env: open })).status).toBe(409);
    expect((await assetsReviewHandler(post('/r', { assetId: id, action: 'approve' }), { db, env: open })).status).toBe(200);
    expect((await assetsReviewHandler(post('/r', { assetId: id, action: 'publish' }), { db, env: open })).status).toBe(200);
    const man = await (await assetsManifestHandler(get('/m'), { db, env: open, baseUrl: 'https://store.invalid/', hosts: ['store.invalid'] })).json();
    expect(man.assets.map((a: { itemId: string }) => a.itemId)).toContain(item);
    expect((await assetsReviewHandler(post('/r', { assetId: 99999, action: 'approve' }), { db, env: open })).status).toBe(404);
  });
});
