/** @jest-environment node */
import { testDb } from '../testing/testDb';
import { playDb, processingData } from '@/lib/processing';
import { buildCatalog } from '../catalog';
import { type Db } from '../db/sql';
import { migrate } from '../db/migrate';
import { importApprovedRefs } from '../db/refs';
import { ensureBaselineRelease } from '../db/releases';
import { loadConfig } from '../config';
import { preflight } from '../preflight';
import { listNewItems, onboardItem, onboardScan, type OnboardDeps } from '../onboard';
import type { MeteredAltProvider, AltUsage } from '../providers/altAnthropic';
import type { AltPromptInput } from '@/lib/server/aiRecipePrompts';
import { ACTIONS_LIST } from '@/lib/content/actionList';
import { candidatePool } from '@/lib/content/candidates';
import { onboardListHandler, onboardRunHandler, onboardTickHandler } from '../admin';

const cat = buildCatalog(playDb, processingData);
const NOW = new Date('2026-10-14T10:00:00Z');
let db: Db;
const cfg = (o: Record<string, string> = {}) => loadConfig({ CREATIVE_LLM_ENABLED: 'true', ASSET_AI_ENABLED: 'true', CREATIVE_DAILY_USD_CAP: '20', CREATIVE_ACTOR_SALT: 's', ...o });

class Script implements MeteredAltProvider {
  readonly name = 'script'; calls = 0; last: AltUsage | null = null;
  constructor(private f: (i: AltPromptInput) => unknown) {}
  async propose(i: AltPromptInput) { this.calls++; this.last = { provider: 'script', modelId: 'script-1', requestId: `s-${this.calls}-${i.targetId}`, inputTokens: 100, outputTokens: 50, costUsd: 0.01 }; const v = this.f(i); return typeof v === 'string' ? v : JSON.stringify(v); }
}
const deps = (provider: MeteredAltProvider | null, c = cfg()): OnboardDeps => ({ db, cat, cfg: c, now: () => NOW, provider, assetProviderVersion: 'mock-1' });

/** a route the server's own gate accepts for target T (found by search, never hand-picked) */
function acceptableRoute(T: string): { ingredientIds: string[]; action?: string } | null {
  const pool = candidatePool(cat.db, T, { max: 40 }).slice(0, 30);
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) for (const a of [null, ...ACTIONS_LIST]) {
    const r = preflight(cat, { ingredientIds: [pool[i], pool[j]], actionId: a });
    if (r.kind === 'eligible' && r.candidates.some(c => c.targetId === T && (c.actionId === null || c.actionId === a))) return { ingredientIds: [pool[i], pool[j]], ...(a ? { action: a } : {}) };
  }
  return null;
}
const MECH = 'The shaped stone is struck against the harder piece so a sharp edge is chipped off, which is the physical change that matters here.';
const single = cat.db.nodes.filter(n => cat.profiles.get(n.id)!.status === 'verified' && n.rec.length === 1).map(n => n.id);
const T = single.find(t => acceptableRoute(t))!;
const route = acceptableRoute(T)!;
const answer = (i: AltPromptInput, props: unknown[]) => ({ schemaVersion: 1, targetId: i.targetId, proposals: props });
const good = { ...route, explanation: MECH, evidenceClass: 'plausible_reconstruction' };

beforeAll(async () => {
  db = await testDb(); await migrate(db); await importApprovedRefs(db, cat);
  await ensureBaselineRelease(db, { manifestSha256: '7'.repeat(64), engineSourceHash: 'e' });
});
afterAll(async () => { await db.close(); });

describe('onboarding: a new verified item gets a 3D job and private route proposals, nothing is published', () => {
  it('a target with a single anchor craft is listed as new; unverified items never are', async () => {
    const l = await listNewItems(db, cat);
    expect(l.find(x => x.itemId === T)).toMatchObject({ needsAsset: true, needsRoutes: true });
    for (const x of l) expect(cat.profiles.get(x.itemId)!.status).toBe('verified');
    expect(T).toBeTruthy();
  });
  it('AI off (no provider) => nothing is spent, the item stays new, the 3D job is still queued when assets are on', async () => {
    const r = await onboardItem(deps(null), T);
    expect(r).toMatchObject({ asset: 'queued', routes: 'llm_off', proposalsCreated: 0 });
    expect((await listNewItems(db, cat)).find(x => x.itemId === T)).toMatchObject({ needsAsset: false, needsRoutes: true });
    const again = await onboardItem(deps(null), T);
    expect(again.asset).toBe('already_queued');
  });
  it('cap 0 => provider is never called, no proposal', async () => {
    const p = new Script(i => answer(i, [good]));
    const r = await onboardItem(deps(p, cfg({ CREATIVE_DAILY_USD_CAP: '0' })), T);
    expect(r.routes).toMatch(/^budget:/); expect(p.calls).toBe(0);
  });
  it('hostile and invalid answers create nothing: invented ids, other item\'s route, weak reason, new-item smuggling, junk', async () => {
    const owned = [...cat.recipeIndex.entries()].find(([, id]) => id !== T)!;
    const bad: unknown[] = [
      (i: AltPromptInput) => answer(i, [{ ...good, ingredientIds: ['definitely_not_real', route.ingredientIds[0]] }]),
      (i: AltPromptInput) => answer(i, [{ ...good, ingredientIds: owned[0].split(' ').slice(0, 2) }]),
      (i: AltPromptInput) => answer(i, [{ ...good, explanation: 'It symbolically represents the spirit of the thing, somehow, in a magical way.' }]),
      (i: AltPromptInput) => answer(i, [{ ...good, name: 'Mystic Axe' }]),
      (i: AltPromptInput) => answer(i, [{ ...good, ingredientIds: [...route.ingredientIds, 'pizza'] }]),
      () => 'not json', () => ({ schemaVersion: 2 }), (i: AltPromptInput) => ({ ...answer(i, []), extra: 1 }),
    ];
    for (const f of bad) {
      const before = Number((await db.query<{ n: string }>('SELECT count(*) n FROM creative.recipe_proposal')).rows[0].n);
      const r = await onboardItem(deps(new Script(f as never)), T);
      expect(r.proposalsCreated).toBe(0);
      const after = Number((await db.query<{ n: string }>('SELECT count(*) n FROM creative.recipe_proposal')).rows[0].n);
      expect(after).toBe(before);
    }
  });
  it('a valid route that also passes the server gate becomes ONE private pending proposal (idempotent), with provenance', async () => {
    const p = new Script(i => answer(i, [good]));
    const r = await onboardItem(deps(p), T);
    expect(r).toMatchObject({ routes: 'proposals', proposalsCreated: 1 });
    const row = (await db.query<{ status: string; target_item_id: string; provenance: { source: string } }>(`SELECT status, target_item_id, provenance FROM creative.recipe_proposal WHERE target_item_id=$1`, [T])).rows;
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({ status: 'pending', target_item_id: T });
    expect(row[0].provenance.source).toBe('onboard_sweep');
    // after a completed sweep the item is no longer "new"; a second run does not call the model again
    const l = await listNewItems(db, cat);
    expect(l.find(x => x.itemId === T)).toBeUndefined();
    const p2 = new Script(i => answer(i, [good]));
    await onboardScan(deps(p2), 3);
    expect(p2.calls).toBeLessThanOrEqual(5);
    expect(await onboardItem(deps(p2), T).then(x => x.proposalsCreated)).toBe(0);
  });
  it('an AI route cannot go live by itself: the route is in no release until an owner approves AND a release is exported', async () => {
    const r = await db.query(`SELECT 1 FROM creative.published_route`);
    expect(r.rowCount).toBe(0);
  });
  it('a provider outage leaves the item "new" and releases the money; it is not cached as a verdict', async () => {
    const boom: MeteredAltProvider = { name: 'boom', last: null, propose: async () => { throw new Error('socket hang up'); } };
    const sweepable = single.find(t => t !== T)!;
    const r = await onboardItem(deps(boom), sweepable);
    expect(r.routes).toBe('provider_error');
    expect((await listNewItems(db, cat)).find(x => x.itemId === sweepable)?.needsRoutes).toBe(true);
  });
  it('scan is bounded: at most 5 items per call even if asked for more', async () => {
    const p = new Script(i => answer(i, []));
    const res = await onboardScan(deps(p), 999);
    expect(res.processed.length).toBeLessThanOrEqual(10);
  });
});

describe('onboarding endpoints: owner-only; cron needs its own secret', () => {
  const open = { ENABLE_DEV_TOOLS: 'true', OWNER_REVIEW_TOKEN: 'tok-123' };
  const rq = (m: string, t: string | null, body?: unknown) => new Request('https://x.example/a', { method: m, body: body ? JSON.stringify(body) : undefined, headers: t ? { authorization: `Bearer ${t}` } : {} });
  it('closed without the gate, 401 with a wrong token, 200 for the owner', async () => {
    const on = deps(null);
    expect((await onboardListHandler(rq('GET', 'tok-123'), { db, env: {}, on })).status).toBe(404);
    expect((await onboardListHandler(rq('GET', 'x'), { db, env: open, on })).status).toBe(401);
    expect((await onboardRunHandler(rq('POST', null, {}), { db, env: open, on })).status).toBe(401);
    const l = await onboardListHandler(rq('GET', 'tok-123'), { db, env: open, on });
    expect(l.status).toBe(200);
    const j = await l.json(); expect(Array.isArray(j.items)).toBe(true); expect(j.aiRoutes).toBe(false);
    expect((await onboardRunHandler(rq('POST', 'tok-123', { limit: 1 }), { db, env: open, on })).status).toBe(200);
  });
  it('cron: no secret => 404, wrong => 401, right => runs one item', async () => {
    expect((await onboardTickHandler(rq('GET', 'x'), deps(null), {})).status).toBe(404);
    expect((await onboardTickHandler(rq('GET', 'bad'), deps(null), { CRON_SECRET: 'sss' })).status).toBe(401);
    expect((await onboardTickHandler(rq('GET', 'sss'), deps(null), { CRON_SECRET: 'sss' })).status).toBe(200);
    expect(await (await onboardTickHandler(rq('GET', 'sss'), null, { CRON_SECRET: 'sss' })).json()).toEqual({ did: 'disabled' });
  });
});

describe('the owner scenario: add ONE new item (name, description, source, one craft) and nothing else', () => {
  const base = cat.db.nodes.find(n => n.id === 'sharp_stone')!;
  const mkNode = (id: string, src: string[]) => ({ ...base, id, n: 'Hand adze', l1: 'A small stone blade lashed across a short wooden handle, used to dress timber and scrape hides.', rec: [['stone', 'stone', 'wood', 'fiber']], uses: [], src, no: 5001, depth: base.depth, need: base.need });
  const withNew = (src: string[]) => buildCatalog({ ...playDb, nodes: [...playDb.nodes, mkNode('zz_hand_adze', src) as typeof base] }, processingData);

  it('with a real source it becomes verified: queued for 3D with the description in the brief, and swept for routes', async () => {
    const c2 = withNew(['owner_declared:museum-catalogue']);
    expect(c2.profiles.get('zz_hand_adze')!.status).toBe('verified');
    await importApprovedRefs(db, c2);                                    // happens automatically on every cold start
    const { briefFor } = await import('../assets/key');
    expect(briefFor(c2, 'zz_hand_adze')!.prompt).toMatch(/Hand adze.*stone blade lashed/s);
    const p = new Script(i => answer(i, []));
    const on: OnboardDeps = { db, cat: c2, cfg: cfg(), now: () => NOW, provider: p, assetProviderVersion: 'mock-1' };
    expect((await listNewItems(db, c2)).find(x => x.itemId === 'zz_hand_adze')).toMatchObject({ needsAsset: true, needsRoutes: true });
    const r = await onboardItem(on, 'zz_hand_adze');
    expect(r.asset).toBe('queued');
    expect(r.routes).toBe('none');                                       // "no extra route" is a valid, free answer
    expect(p.calls).toBe(1);
  });
  it('WITHOUT a source (source_required) the item is "pending": the AI refuses to touch it', async () => {
    const c3 = withNew(['source_required']);
    expect(c3.profiles.get('zz_hand_adze')!.status).toBe('pending');
    const p = new Script(i => answer(i, []));
    const r = await onboardItem({ db, cat: c3, cfg: cfg(), now: () => NOW, provider: p, assetProviderVersion: 'mock-1' }, 'zz_hand_adze');
    expect(r).toMatchObject({ asset: 'not_verified', routes: 'not_verified' });
    expect(p.calls).toBe(0);
  });
  it('a verified new item enters the item pools of the item-based modes automatically (no mode code edited)', async () => {
    const { poolFor } = await import('../modes/contracts');
    const c2 = withNew(['owner_declared:museum-catalogue']);
    const seen = { survival: 0, archaeology: 0 };
    for (let s = 1; s <= 60; s++) for (const m of ['survival', 'archaeology'] as const) if (poolFor(c2, m, s).includes('zz_hand_adze')) seen[m]++;
    console.log('new item appeared in mode pools (of 60 seeds):', JSON.stringify(seen));
    expect(seen.survival + seen.archaeology).toBeGreaterThan(0);
  });
});
