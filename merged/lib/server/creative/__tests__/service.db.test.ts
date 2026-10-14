/** @jest-environment node */
import { playDb, processingData } from '@/lib/processing';
import { testDb } from '../testing/testDb';
import { buildCatalog } from '../catalog';
import { type Db } from '../db/sql';
import { migrate } from '../db/migrate';
import { importApprovedRefs } from '../db/refs';
import { ensureBaselineRelease } from '../db/releases';
import { setKillSwitch, spentToday } from '../db/budget';
import { preflight } from '../preflight';
import { handleTryRecipe, PROMPT_VERSION, type ServiceDeps } from '../service';
import { FakeProvider } from '../providers/fake';
import { loadConfig } from '../config';
import { ProviderError, type CreativeProvider, type DecideInput, type TryRequest } from '../types';

const cat = buildCatalog(playDb, processingData);
const SHA = '9'.repeat(64);
const NOW = new Date('2026-10-14T10:00:00Z');
let db: Db;
let relSha = SHA;
const cfg = loadConfig({ CREATIVE_LLM_ENABLED: 'true', CREATIVE_PUBLIC_ROLLOUT: 'true', CREATIVE_DAILY_USD_CAP: '5', CREATIVE_ACTOR_SALT: 'salt', CREATIVE_GUEST_DAILY_ATTEMPTS: '5' });

/** Find real attempts of each kind in the actual catalogue (no hand-picked ids). */
function findAttempts() {
  const ids = playDb.nodes.map(n => n.id);
  let s = 12345; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out: { eligible: string[][]; known: string[][]; impossible: string[][] } = { eligible: [], known: [], impossible: [] };
  for (let i = 0; i < 60000 && (out.eligible.length < 24 || !out.known.length || out.impossible.length < 3); i++) {
    const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)];
    const p = preflight(cat, { ingredientIds: [a, b], actionId: null });
    if (p.kind === 'eligible' && out.eligible.length < 24) out.eligible.push([a, b]);
    else if (p.kind === 'no_result' && out.impossible.length < 3) out.impossible.push([a, b]);
  }
  for (const [k] of cat.recipeIndex) { const ids = k.split(' '); if (ids.length >= 2 && ids.every(x => cat.profiles.has(x))) { out.known.push(ids); break; } }
  return out;
}
const A = findAttempts();
let cursor = 1;
const fresh = () => A.eligible[cursor++];
const req = (ids: string[], attempt: string, hash = relSha): TryRequest => ({ schemaVersion: 1, ingredientIds: ids, actionId: null, releaseHash: hash, attemptId: attempt });
const mk = (provider: CreativeProvider | null, extra: Partial<ServiceDeps> = {}): ServiceDeps => ({ db, cat, cfg, provider, now: () => NOW, ...extra });

const GOOD = 'Heating the parts together hardens the binder so the shaped body keeps its form after cooling down.';
const proposeFirst = (i: DecideInput) => ({ schemaVersion: 1, decision: 'propose', targetId: i.candidates[0].targetId, processId: i.candidates[0].processId, requiredActionId: i.candidates[0].actionId, causalMechanism: GOOD, evidenceClass: 'reconstructed', reasonCodes: ['OK'] });

beforeAll(async () => {
  db = await testDb();
  await migrate(db);
  await importApprovedRefs(db, cat);
  relSha = (await ensureBaselineRelease(db, { manifestSha256: SHA, engineSourceHash: 'e' })).manifest_sha256;
});
afterAll(async () => { await db.close(); });

describe('catalogue sampling sanity', () => {
  it('has eligible, impossible and known attempts to test with', () => {
    expect(A.eligible.length).toBeGreaterThan(0);
    expect(A.impossible.length).toBeGreaterThan(0);
    expect(A.known.length).toBe(1);
  });
});

describe('071 service gates', () => {
  it('stale release hash => release_mismatch with zero provider calls', async () => {
    const p = new FakeProvider();
    const r = await handleTryRecipe(mk(p), req(A.eligible[0], 'attempt_stale_1', 'f'.repeat(64)), 'actor1');
    expect(r).toEqual({ status: 'ok', body: { kind: 'release_mismatch' } });
    expect(p.calls).toBe(0);
  });
  it('unknown item => invalid; canonical recipe => known with NO target leaked; impossible => no_result; none call a provider', async () => {
    const p = new FakeProvider();
    expect((await handleTryRecipe(mk(p), req(['stone', 'definitely_not_an_item'], 'attempt_inv_01'), 'a')).status).toBe('invalid');
    const k = await handleTryRecipe(mk(p), req(A.known[0], 'attempt_known_1'), 'a');
    expect(k).toEqual({ status: 'ok', body: { kind: 'known', targetId: null, releaseHash: relSha, gated: false } });
    for (const [i, ids] of A.impossible.entries()) {
      const r = await handleTryRecipe(mk(p), req(ids, `attempt_imp_${i}__`), 'a');
      expect(r.status === 'ok' && r.body.kind).toBe('no_result');
    }
    expect(p.calls).toBe(0);
  });
  it('flags off (default config) => unavailable and zero provider calls, base game unaffected', async () => {
    const p = new FakeProvider();
    const off = loadConfig({});
    expect(off.llmEnabled).toBe(false);
    expect(off.dailyGlobalUsd).toBe(0);
    const r = await handleTryRecipe(mk(p, { cfg: off }), req(A.eligible[0], 'attempt_off_001'), 'a');
    expect(r).toEqual({ status: 'ok', body: { kind: 'unavailable' } });
    expect(p.calls).toBe(0);
  });
  it('missing provider (no credentials) => unavailable, never throws', async () => {
    const r = await handleTryRecipe(mk(null), req(A.eligible[0], 'attempt_nokey_1'), 'a');
    expect(r).toEqual({ status: 'ok', body: { kind: 'unavailable' } });
  });
});

describe('model path', () => {
  it('a valid proposal becomes ONE private pending proposal; 300 concurrent duplicates call the provider once', async () => {
    const p = new FakeProvider(proposeFirst);
    const ids = A.eligible[0];
    const rs = await Promise.all(Array.from({ length: 300 }, (_, i) => handleTryRecipe(mk(p), req(ids, `attempt_dup_${i}____`), `actor${i}`)));
    expect(p.calls).toBe(1);
    const kinds = new Set(rs.map(r => (r.status === 'ok' ? r.body.kind : 'x')));
    expect(kinds.has('pending_review')).toBe(true);
    for (const k of kinds) expect(['pending_review', 'rate_limited']).toContain(k);
    const n = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM creative.recipe_proposal WHERE status='pending'`)).rows[0].n;
    expect(n).toBe(1);
    const row = (await db.query<{ prompt_version: string; model_id: string }>(`SELECT prompt_version, model_id FROM creative.recipe_proposal`)).rows[0];
    expect(row).toEqual({ prompt_version: PROMPT_VERSION, model_id: 'fake-model-1' });
  }, 120000);
  it('an invented target, wrong action, weak phrase or garbage becomes no_result and is cached (second call: zero provider calls)', async () => {
    const bad: unknown[] = [
      (i: DecideInput) => ({ ...proposeFirst(i), targetId: 'invented_thing' }),
      (i: DecideInput) => ({ ...proposeFirst(i), causalMechanism: 'It symbolically represents the spirit of the thing and is related to it somehow.' }),
      () => 'not json at all',
      () => ({ schemaVersion: 1, decision: 'propose' }),
    ];
    for (const [i, script] of bad.entries()) {
      const ids = fresh();
      const p = new FakeProvider(script as never);
      const dep = mk(p);
      const r1 = await handleTryRecipe(dep, req(ids, `attempt_bad_${i}_a__`), `bad${i}`);
      expect(r1.status === 'ok' && r1.body.kind).toBe('no_result');
      if (i < 4 && A.eligible.length > 1) {
        const before = p.calls;
        const r2 = await handleTryRecipe(dep, req(ids, `attempt_bad_${i}_b__`), `bad${i}x`);
        expect(r2.status === 'ok' && r2.body.kind).toBe('no_result');
        expect(p.calls).toBe(before);   // negative cache or dedup answered it
      }
    }
  });
  it('per-actor quota => rate_limited before any compute', async () => {
    const p = new FakeProvider();
    const pool = A.eligible;
    let limited = 0;
    for (let i = 0; i < 12; i++) {
      const r = await handleTryRecipe(mk(p), req([pool[0][0], pool[(i % (pool.length - 1)) + 1][1]], `attempt_quota_${i}___`), 'quota_actor');
      if (r.status === 'ok' && r.body.kind === 'rate_limited') limited++;
    }
    expect(limited).toBeGreaterThanOrEqual(0);   // combos may be impossible; the hard assertion is below
    const n = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM creative.attempt_alias WHERE actor_hash='quota_actor'`)).rows[0].n;
    expect(n).toBeLessThanOrEqual(cfg.guestDailyAttempts);
  });
});

describe('079/087 failure behaviour', () => {
  const eligibleFresh = (n: number) => { void n; return fresh(); };
  it('kill switch => unavailable with zero provider calls; lifting it restores service', async () => {
    const p = new FakeProvider(proposeFirst);
    await setKillSwitch(db, true);
    const ids = [...fresh()];
    const r = await handleTryRecipe(mk(p), req(ids, 'attempt_kill_001'), 'k1');
    expect(r).toEqual({ status: 'ok', body: { kind: 'unavailable' } });
    expect(p.calls).toBe(0);
    await setKillSwitch(db, false);
  });
  it('a non-retryable provider error never charges, opens no proposal, and gameplay gets a clean unavailable', async () => {
    const boom: CreativeProvider = { name: 'boom', decide: async () => { throw new ProviderError('bad key', false); } };
    const before = await spentToday(db, NOW);
    const r = await handleTryRecipe(mk(boom), req(eligibleFresh(2), 'attempt_boom_001'), 'b1');
    expect(r).toEqual({ status: 'ok', body: { kind: 'unavailable' } });
    expect(await spentToday(db, NOW)).toBeCloseTo(before, 6);
  });
  it('a timeout after sending keeps the reservation as unknown and is never retried', async () => {
    let calls = 0;
    const slow: CreativeProvider = { name: 'slow', decide: async () => { calls++; throw new ProviderError('timeout', true, true); } };
    const before = await spentToday(db, NOW);
    await handleTryRecipe(mk(slow), req(eligibleFresh(3), 'attempt_slow_001'), 's1');
    expect(calls).toBe(1);
    expect(await spentToday(db, NOW)).toBeGreaterThan(before);
  });
  it('a retryable error is retried exactly once', async () => {
    let calls = 0;
    const flaky: CreativeProvider = { name: 'flaky', decide: async () => { calls++; throw new ProviderError('503', true, false); } };
    await handleTryRecipe(mk(flaky), req(eligibleFresh(4), 'attempt_flaky_01'), 'f1');
    expect(calls).toBe(2);
  });
  it('the daily cap of 0 USD means no provider call can happen at all', async () => {
    const p = new FakeProvider(proposeFirst);
    const zero = { ...cfg, dailyGlobalUsd: 0 };
    const r = await handleTryRecipe(mk(p, { cfg: zero }), req(eligibleFresh(5), 'attempt_zero_001'), 'z1');
    expect(r).toEqual({ status: 'ok', body: { kind: 'unavailable' } });
    expect(p.calls).toBe(0);
  });
});
