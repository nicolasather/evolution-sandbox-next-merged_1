/** @jest-environment node */
import { playDb, processingData } from '@/lib/processing';
import { testDb } from '../testing/testDb';
import { buildCatalog } from '../catalog';
import { type Db } from '../db/sql';
import { migrate } from '../db/migrate';
import { importApprovedRefs } from '../db/refs';
import { ensureBaselineRelease } from '../db/releases';
import { loadConfig } from '../config';
import { tryRecipeHandler, burst } from '../handler';
import { checkBrowserOrigin, BurstLimiter, actorFrom } from '../guard';
import { FakeProvider } from '../providers/fake';
import { MAX_BODY_BYTES } from '../http';
import type { ServiceDeps } from '../service';

const cat = buildCatalog(playDb, processingData);
const SHA = '8'.repeat(64);
let db: Db;
let deps: ServiceDeps;
const cfg = loadConfig({ CREATIVE_LLM_ENABLED: 'true', CREATIVE_PUBLIC_ROLLOUT: 'true', CREATIVE_DAILY_USD_CAP: '5', CREATIVE_ACTOR_SALT: 's' });
const provider = new FakeProvider();

beforeAll(async () => {
  db = await testDb();
  await migrate(db); await importApprovedRefs(db, cat);
  await ensureBaselineRelease(db, { manifestSha256: SHA, engineSourceHash: 'e' });
  deps = { db, cat, cfg, provider, now: () => new Date('2026-10-14T10:00:00Z') };
});
afterAll(async () => { await db.close(); });

const body = (o: unknown) => JSON.stringify(o);
const good = { schemaVersion: 1, ingredientIds: ['stone', 'wood'], actionId: null, releaseHash: SHA, attemptId: 'attempt_http_01' };
const mkReq = (b: string, headers: Record<string, string> = {}) => new Request('https://game.example/api/creative/try-recipe', {
  method: 'POST', body: b, headers: { 'content-type': 'application/json', origin: 'https://game.example', host: 'game.example', ...headers },
});
const call = (r: Request, d: ServiceDeps | null = deps) => tryRecipeHandler(r, async () => d);

describe('071 HTTP handler', () => {
  it('rejects wrong origin, missing origin, cross-site, wrong content type — before parsing the body', async () => {
    expect((await call(mkReq(body(good), { origin: 'https://evil.example' }))).status).toBe(403);
    const noOrigin = new Request('https://game.example/x', { method: 'POST', body: body(good), headers: { 'content-type': 'application/json', host: 'game.example' } });
    expect((await call(noOrigin)).status).toBe(403);
    expect((await call(mkReq(body(good), { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await call(mkReq(body(good), { 'content-type': 'text/plain' }))).status).toBe(415);
  });
  it('rejects malformed, oversized, extra-field, bad-id bodies with 400/413 and never calls the provider', async () => {
    for (const b of ['{', '[]', body({ ...good, extra: 1 }), body({ ...good, ingredientIds: ['stone'] }), body({ ...good, ingredientIds: ['stone', 'Wood!'] }), body({ ...good, attemptId: 'x' }), body({ ...good, schemaVersion: 2 })]) {
      expect((await call(mkReq(b))).status).toBe(400);
    }
    expect((await call(mkReq('x'.repeat(MAX_BODY_BYTES + 1)))).status).toBe(413);
    expect(provider.calls).toBe(0);
  });
  it('responses are never cacheable and never carry internals', async () => {
    const r = await call(mkReq(body(good)));
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.text()).not.toMatch(/stack|select |postgres|creative\./i);
  });
  it('no database configured => 503 unavailable (game plays on)', async () => {
    const r = await call(mkReq(body(good)), null);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ kind: 'unavailable' });
  });
  it('a database that throws inside the service => 503 unavailable, no leak', async () => {
    const broken = { ...deps, db: { ...db, query: async () => { throw new Error('secret connection string'); }, transaction: async () => { throw new Error('secret'); } } as unknown as Db };
    const r = await call(mkReq(body(good), { 'x-forwarded-for': '9.9.9.9' }), broken);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('secret');
  });
  it('unknown item => 400; stale release => 200 release_mismatch', async () => {
    expect((await call(mkReq(body({ ...good, ingredientIds: ['stone', 'zzz_unknown'] }), { 'x-forwarded-for': '1.1.1.1' }))).status).toBe(400);
    const r = await call(mkReq(body({ ...good, releaseHash: 'f'.repeat(64) }), { 'x-forwarded-for': '1.1.1.2' }));
    expect(await r.json()).toEqual({ kind: 'release_mismatch' });
  });
  it('burst limiter answers 429 after too many calls from one address', async () => {
    let last = 0;
    for (let i = 0; i < 20; i++) last = (await call(mkReq(body({ ...good, attemptId: `attempt_burst_${i}__` }), { 'x-forwarded-for': '7.7.7.7' }))).status;
    expect(last).toBe(429);
  });
});

describe('086 guard units', () => {
  it('allow-listed origin passes; BurstLimiter window slides; actor id is stable, salted, ip-only', () => {
    const h = new Headers({ origin: 'https://beta.example', host: 'game.example', 'content-type': 'application/json' });
    expect(checkBrowserOrigin(h, { allowedOrigins: [] }).ok).toBe(false);
    expect(checkBrowserOrigin(h, { allowedOrigins: ['https://beta.example'] }).ok).toBe(true);
    const l = new BurstLimiter(2, 1000);
    expect([l.allow('a', 0), l.allow('a', 1), l.allow('a', 2), l.allow('a', 1500)]).toEqual([true, true, false, true]);
    const a = actorFrom(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'x-guest-id': 'rotating' }), { actorSalt: 's' });
    expect(a).toBe(actorFrom(new Headers({ 'x-forwarded-for': '1.2.3.4', 'x-guest-id': 'other' }), { actorSalt: 's' }));
    expect(a).not.toBe(actorFrom(new Headers({ 'x-forwarded-for': '1.2.3.4' }), { actorSalt: 't' }));
    expect(burst).toBeDefined();
  });
});

describe('087 observability', () => {
  it('every response carries a correlation id, a log line without player data, and counters move', async () => {
    const { metrics } = await import('../telemetry');
    metrics.reset();
    const lines: string[] = [];
    const spy = jest.spyOn(console, 'info').mockImplementation(l => { lines.push(String(l)); });
    const r = await call(mkReq(body({ ...good, attemptId: 'attempt_obs_0001', releaseHash: 'f'.repeat(64) }), { 'x-forwarded-for': '4.4.4.4' }));
    spy.mockRestore();
    expect(r.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{8,36}$/);
    expect(lines.length).toBe(1);
    expect(lines[0]).not.toMatch(/stone|wood|4\.4\.4\.4|attempt_obs/);
    expect(metrics.snapshot().counters['try.release_mismatch']).toBe(1);
    expect(metrics.snapshot().latency.count).toBe(1);
  });
});
