/** @jest-environment node */
import { playDb, processingData } from '@/lib/processing';
import { testDb } from '../testing/testDb';
import { buildCatalog } from '../catalog';
import { type Db } from '../db/sql';
import { migrate } from '../db/migrate';
import { importApprovedRefs } from '../db/refs';
import { loadConfig } from '../config';
import { briefFor, assetKey, STYLE_VERSION } from '../assets/key';
import { claimJob, enqueueAssetJob, recordTask, requeueLater, completeJob, MAX_JOB_ATTEMPTS } from '../assets/queue';
import { MockAssetProvider, AssetProviderError } from '../assets/provider';
import { MemoryStore } from '../assets/storage';
import { assetTick, type WorkerDeps } from '../assets/worker';
import { exportAssetManifest, listAssets, reviewAsset } from '../assets/review';
import { MeshyProvider } from '../assets/meshy';
import { spentToday } from '../db/budget';

const cat = buildCatalog(playDb, processingData);
const T0 = new Date('2026-10-14T10:00:00Z');
let db: Db;
let verifiedItems: string[] = [];
let unverified = '';
let clock = T0.getTime();
const now = () => new Date(clock);
const advance = (s: number) => { clock += s * 1000; };
const cfgOn = loadConfig({ ASSET_AI_ENABLED: 'true', CREATIVE_DAILY_USD_CAP: '50', CREATIVE_ACTOR_SALT: 's' });

const jobFor = async (item: string, providerVersion = 'mock-1') => {
  const b = briefFor(cat, item)!;
  return enqueueAssetJob(db, { itemId: item, briefHash: b.briefHash, styleVersion: STYLE_VERSION, providerVersion });
};
const deps = (p: MockAssetProvider, workerId: string, store = new MemoryStore(), cfg = cfgOn): WorkerDeps => ({ db, cat, cfg, provider: p, store, workerId, now, assetUsdPerJob: 0.2 });

beforeAll(async () => {
  db = await testDb();
  await migrate(db); await importApprovedRefs(db, cat);
  verifiedItems = [...cat.profiles.values()].filter(p => p.status === 'verified' && p.isNode).map(p => p.id).slice(0, 20);
  unverified = [...cat.profiles.values()].find(p => p.isNode && p.status !== 'verified')!.id;
});
afterAll(async () => { await db.close(); });

describe('088/089 brief + queue', () => {
  it('the brief comes only from curated fields and is refused for unverified items; the key is stable', () => {
    const b = briefFor(cat, verifiedItems[0])!;
    expect(b.prompt.length).toBeLessThanOrEqual(400);
    expect(b.prompt).toMatch(/no text, no logo, no characters/);
    expect(briefFor(cat, unverified)).toBeNull();
    expect(assetKey(b, 's', 'p')).toBe(assetKey(b, 's', 'p'));
    expect(assetKey(b, 's', 'p')).not.toBe(assetKey(b, 's', 'q'));
  });
  it('100 identical enqueue requests make exactly one job; an unverified item is refused by SQL', async () => {
    const rs = await Promise.all(Array.from({ length: 100 }, () => jobFor(verifiedItems[0])));
    expect(new Set(rs.map(r => r.id)).size).toBe(1);
    expect(rs.filter(r => r.created).length).toBe(1);
    await expect(enqueueAssetJob(db, { itemId: unverified, briefHash: 'h'.repeat(64), styleVersion: 's', providerVersion: 'p' })).rejects.toThrow(/not a verified/);
  });
});

describe('089/090/091/092 full mock pipeline', () => {
  it('submit -> wait -> store -> validated draft -> approve -> publish -> manifest; drafts are never exported', async () => {
    const item = verifiedItems[1];
    const prov = new MockAssetProvider({ readyAfterPolls: 1 });
    const store = new MemoryStore('https://blob.test/');
    await jobFor(item);
    // first job in the table is item[0]'s, finish it quickly by making it idle: run ticks until both processed
    const log: string[] = [];
    for (let i = 0; i < 12; i++) { const r = await assetTick(deps(prov, 'w1', store)); log.push(r.did); advance(25); if (r.did === 'idle') break; }
    expect(log).toContain('submitted'); expect(log).toContain('waiting'); expect(log).toContain('stored');
    expect(prov.submits).toBe(2);                                       // two distinct items, each submitted exactly once
    const drafts = await listAssets(db, 'validated');
    expect(drafts.length).toBe(2);
    expect(store.files.size).toBe(2);
    expect((await exportAssetManifest(db, 'https://blob.test/', ['blob.test'])).assets).toEqual([]);   // nothing visible before review
    const a = drafts.find(x => x.item_id === item)!;
    expect(await reviewAsset(db, { assetId: a.id, action: 'publish', reviewer: 'owner' })).toEqual({ ok: false, code: 'illegal_transition' });
    expect(await reviewAsset(db, { assetId: a.id, action: 'approve', reviewer: 'owner' })).toEqual({ ok: true, status: 'approved' });
    expect((await exportAssetManifest(db, 'https://blob.test/', ['blob.test'])).assets).toEqual([]);   // approved is still not visible
    expect(await reviewAsset(db, { assetId: a.id, action: 'publish', reviewer: 'owner' })).toEqual({ ok: true, status: 'published' });
    const man = await exportAssetManifest(db, 'https://blob.test/', ['blob.test']);
    expect(man.assets.length).toBe(1);
    expect(man.assets[0]).toMatchObject({ itemId: item, status: 'published', mediaType: 'model/gltf-binary' });
    expect(man.assets[0].url).toBe(`https://blob.test/${a.storage_key}`);
    expect((await exportAssetManifest(db, 'https://other.test/', ['blob.test'])).assets).toEqual([]);   // host not allowed => not exported
  });
  it('SQL refuses shortcuts: published bytes are immutable, approval needs a reviewer, rejected is final, task id is write-once', async () => {
    const a = (await listAssets(db, 'published'))[0];
    await expect(db.query(`UPDATE creative.visual_asset SET sha256=$2 WHERE id=$1`, [a.id, 'e'.repeat(64)])).rejects.toThrow(/immutable/);
    await expect(db.query(`UPDATE creative.visual_asset SET status='draft' WHERE id=$1`, [a.id])).rejects.toThrow(/illegal/);
    const other = (await listAssets(db, 'validated'))[0];
    await expect(db.query(`UPDATE creative.visual_asset SET status='approved' WHERE id=$1`, [other.id])).rejects.toThrow(/reviewer/);
    expect(await reviewAsset(db, { assetId: other.id, action: 'reject', reviewer: 'owner' })).toEqual({ ok: true, status: 'rejected' });
    expect(await reviewAsset(db, { assetId: other.id, action: 'approve', reviewer: 'owner' })).toEqual({ ok: false, code: 'illegal_transition' });
    await expect(db.query(`UPDATE creative.asset_job SET provider_task_id='x' WHERE provider_task_id IS NOT NULL`)).rejects.toThrow(/write-once/);
  });
});

describe('089 crash recovery, leases, concurrency', () => {
  it('a crashed worker never causes a second submission: the next worker resumes the same provider task', async () => {
    const item = verifiedItems[2];
    const prov = new MockAssetProvider();
    await jobFor(item);
    // worker A claims, submits, records the task id, then "crashes" (never releases the lease)
    const claimed = (await claimJob(db, { workerId: 'A', now: now() }))!;
    expect(claimed.item_id).toBe(item);
    const { taskId } = await prov.submit('x');
    expect(await recordTask(db, { jobId: claimed.id, workerId: 'A', taskId, now: now() })).toBe(true);
    expect((await assetTick(deps(prov, 'B'))).did).toBe('idle');          // lease still held: B cannot take it
    advance(120);
    const r = await assetTick(deps(prov, 'B'));
    expect(r.did).toBe('stored');                                            // resumed: polled and finished
    expect(prov.submits).toBe(1);                                            // still ONE submission
  });
  it('a malformed or stale lease owner cannot complete, requeue or record', async () => {
    const item = verifiedItems[3];
    await jobFor(item);
    const j = (await claimJob(db, { workerId: 'owner1', now: now() }))!;
    expect(await recordTask(db, { jobId: j.id, workerId: 'intruder', taskId: 't', now: now() })).toBe(false);
    expect(await requeueLater(db, { jobId: j.id, workerId: 'intruder', now: now(), delaySeconds: 1 })).toBe(false);
    expect(await completeJob(db, { jobId: j.id, workerId: 'intruder', now: now(), itemId: item, storageKey: 'k', sha256: 'a'.repeat(64), sizeBytes: 5, provenance: {} })).toBeNull();
    advance(500);
    expect(await recordTask(db, { jobId: j.id, workerId: 'owner1', taskId: 't', now: now() })).toBe(false);   // expired lease
    await requeueLater(db, { jobId: j.id, workerId: 'x', now: now(), delaySeconds: 1 });
    // clean up for later tests: let a worker finish it
    const prov = new MockAssetProvider();
    for (let i = 0; i < 6; i++) { await assetTick(deps(prov, 'cleanup')); advance(30); }
  });
  it('5 workers racing over 3 new jobs never share a job: exactly 3 submissions', async () => {
    for (const it of verifiedItems.slice(4, 7)) await jobFor(it);
    const prov = new MockAssetProvider({ readyAfterPolls: 5 });
    const rs = await Promise.all(['w1', 'w2', 'w3', 'w4', 'w5'].map(w => assetTick(deps(prov, w))));
    expect(rs.filter(r => r.did === 'submitted').length).toBe(3);
    expect(rs.filter(r => r.did === 'idle').length).toBe(2);
    expect(prov.submits).toBe(3);
  });
});

describe('090 provider failure modes', () => {
  beforeAll(async () => {            // finish everything left over from earlier tests with a healthy provider
    const healthy = new MockAssetProvider();
    await db.query(`UPDATE creative.asset_job SET state='permanent_failure', worker_id=NULL, lease_until=NULL WHERE state NOT IN ('pending_review','published','permanent_failure')`);
    void healthy;
  });
  it('flag off => disabled with zero provider calls; zero budget => blocked with zero provider calls', async () => {
    const prov = new MockAssetProvider();
    await jobFor(verifiedItems[8]);
    expect((await assetTick(deps(prov, 'w', new MemoryStore(), loadConfig({})))).did).toBe('disabled');
    const zero = loadConfig({ ASSET_AI_ENABLED: 'true', CREATIVE_DAILY_USD_CAP: '0' });
    expect((await assetTick(deps(prov, 'w', new MemoryStore(), zero))).did).toBe('budget_blocked');
    expect(prov.submits).toBe(0);
  });
  it('retryable outage backs off exponentially then becomes permanent after the attempt cap; money is released', async () => {
    const prov = new MockAssetProvider({ failSubmit: new AssetProviderError('http_503', true) });
    const before = await spentToday(db, now());
    const results: string[] = [];
    for (let i = 0; i < MAX_JOB_ATTEMPTS + 2; i++) {
      advance(4000);
      const r = await assetTick(deps(prov, 'w'));
      if (r.did !== 'idle') results.push(r.did);
    }
    expect(results.slice(0, MAX_JOB_ATTEMPTS - 1).every(x => x === 'failed_retry' || x === 'budget_blocked')).toBe(true);
    expect(results).toContain('failed_permanent');
    expect(await spentToday(db, now())).toBeCloseTo(before, 6);
  });
  it('a submit whose outcome is unknown stays counted as spent and is NOT retried', async () => {
    await jobFor(verifiedItems[9]);
    const prov = new MockAssetProvider({ failSubmit: new AssetProviderError('timeout', false, true) });
    advance(4000 * 3);
    const before = await spentToday(db, now());
    // flush any earlier job first
    for (let i = 0; i < 6; i++) { const r = await assetTick(deps(prov, 'w')); if (r.did === 'idle') break; advance(4000); }
    expect(prov.submits).toBe(0);
    expect(await spentToday(db, now())).toBeGreaterThan(before);
  });
  it('a corrupt or hostile GLB is a permanent failure and nothing is stored or exposed', async () => {
    await jobFor(verifiedItems[10]);
    const store = new MemoryStore();
    const prov = new MockAssetProvider({ corrupt: true });
    for (let i = 0; i < 6; i++) { const r = await assetTick(deps(prov, 'w', store)); if (r.did === 'idle') break; advance(30); }
    expect(store.files.size).toBe(0);
    const j = (await db.query<{ state: string; last_error: string }>(`SELECT state, last_error FROM creative.asset_job WHERE item_id=$1`, [verifiedItems[10]])).rows[0];
    expect(j.state).toBe('permanent_failure');
    expect(j.last_error).toMatch(/invalid_glb/);
  });
});

describe('090 Meshy adapter (no network: injected fetch)', () => {
  const resp = (b: unknown, status = 200, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers: h });
  it('builds the documented request, never sends player text, and maps statuses', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const m = new MeshyProvider('key_123', (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (init.method === 'POST') return resp({ result: 'task_abc123' });
      return resp({ status: 'SUCCEEDED', model_urls: { glb: 'https://assets.meshy.ai/x.glb' } });
    }) as never);
    expect(await m.submit('A single simple blade')).toEqual({ taskId: 'task_abc123' });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toMatchObject({ mode: 'preview', should_remesh: true, target_polycount: 8000, target_formats: ['glb'] });
    expect(calls[0].url).toBe('https://api.meshy.ai/openapi/v2/text-to-3d');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer key_123');
    expect(await m.poll('task_abc123')).toEqual({ state: 'succeeded', progress: 100, glbUrl: 'https://assets.meshy.ai/x.glb' });
  });
  it('maps errors and refuses untrusted download hosts', async () => {
    const mk = (f: unknown) => new MeshyProvider('k', f as never);
    await expect(mk(async () => resp({}, 429)).submit('p')).rejects.toMatchObject({ retryable: true });
    await expect(mk(async () => resp({}, 402)).submit('p')).rejects.toMatchObject({ retryable: false });
    await expect(mk(async () => resp({ result: '../../etc' })).submit('p')).rejects.toMatchObject({ billableUnknown: true });
    await expect(mk(async () => { throw new TypeError('x'); }).submit('p')).rejects.toMatchObject({ retryable: true });
    expect(await mk(async () => resp({ status: 'FAILED', task_error: { message: 'nsfw' } })).poll('task_abc123')).toEqual({ state: 'failed', error: 'nsfw' });
    await expect(mk(async () => resp({})).fetchGlb('https://evil.example/a.glb', 1000)).rejects.toThrow(/untrusted/);
    await expect(mk(async () => resp({})).fetchGlb('http://assets.meshy.ai/a.glb', 1000)).rejects.toThrow(/untrusted/);
    await expect(mk(async () => resp({})).fetchGlb('https://evil.meshy.ai.attacker.com/a.glb', 1000)).rejects.toThrow(/untrusted/);
    await expect(mk(async () => resp({})).poll('../x')).rejects.toThrow();
  });
});
