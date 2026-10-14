import type { CreativeCatalog } from './catalog';
import type { CreativeConfig } from './config';
import type { Db } from './db/sql';
import { markUnknown, recordProviderFailure, recordProviderSuccess, releaseReservation, reserve, settle } from './db/budget';
import { audit, insertProposal } from './db/proposals';
import { activeRelease } from './db/releases';
import { enqueueAssetJob } from './assets/queue';
import { briefFor, STYLE_VERSION } from './assets/key';
import { preflight } from './preflight';
import { ProviderError } from './types';
import { validateAltResponse } from '@/lib/content/altValidation';
import { buildRecipeIndex } from '@/lib/content/strictCraft';
import { ACTIONS_LIST } from '@/lib/content/actionList';
import { candidatePool } from '@/lib/content/candidates';
import type { MeteredAltProvider } from './providers/altAnthropic';

/* Item onboarding. The owner adds an item (name, description, era, a source, ONE anchor craft) through the Phase 1
   pipeline. From then on, with no further typing:
     • a 3D draft job is queued for it (curated brief only);
     • the model is asked ONCE for 0..3 alternative routes, which must pass altValidation AND the same server gate a
       player attempt must pass (hardGate + approved target pool, action included). Survivors become PRIVATE pending proposals.
   Nothing here publishes anything. Draft models and proposals wait for the owner; routes only go live through a release. */

export const ONBOARD_PROMPT_VERSION = 'onboard-1';

export interface OnboardDeps {
  db: Db; cat: CreativeCatalog; cfg: CreativeConfig; now: () => Date;
  provider: MeteredAltProvider | null;
  assetProviderVersion: string;
}

export interface NewItem { itemId: string; name: string; needsAsset: boolean; needsRoutes: boolean }

/** Verified catalogue nodes that still lack a 3D job and/or have only their anchor craft and were never swept. */
export async function listNewItems(db: Db, cat: CreativeCatalog): Promise<NewItem[]> {
  const jobs = new Set((await db.query<{ item_id: string }>(`SELECT DISTINCT item_id FROM creative.asset_job`)).rows.map(r => r.item_id));
  const swept = new Set((await db.query<{ object_id: string }>(`SELECT object_id FROM creative.audit_event WHERE kind='onboard_routes_done' AND details->>'promptVersion'=$1`, [ONBOARD_PROMPT_VERSION])).rows.map(r => r.object_id));
  const withProposal = new Set((await db.query<{ target_item_id: string }>(`SELECT DISTINCT target_item_id FROM creative.recipe_proposal`)).rows.map(r => r.target_item_id));
  const out: NewItem[] = [];
  for (const n of cat.db.nodes) {
    const p = cat.profiles.get(n.id);
    if (!p || p.status !== 'verified') continue;
    const needsAsset = !jobs.has(n.id);
    const needsRoutes = (n.rec?.length ?? 0) <= 1 && !swept.has(n.id) && !withProposal.has(n.id);
    if (needsAsset || needsRoutes) out.push({ itemId: n.id, name: n.n, needsAsset, needsRoutes });
  }
  return out;
}

export interface OnboardReport { itemId: string; asset: string; routes: string; proposalsCreated: number; rejected: number }

export async function onboardItem(d: OnboardDeps, itemId: string): Promise<OnboardReport> {
  const rep: OnboardReport = { itemId, asset: 'skipped', routes: 'skipped', proposalsCreated: 0, rejected: 0 };
  const node = d.cat.nodes.get(itemId);
  const prof = d.cat.profiles.get(itemId);
  if (!node || !prof || prof.status !== 'verified') { rep.asset = rep.routes = 'not_verified'; return rep; }

  // 1) 3D draft (free to queue; the worker is what spends, and only under ASSET_AI_ENABLED + the daily cap)
  if (!d.cfg.assetAiEnabled) rep.asset = 'asset_ai_off';
  else {
    const b = briefFor(d.cat, itemId);
    if (!b) rep.asset = 'no_brief';
    else { const r = await enqueueAssetJob(d.db, { itemId, briefHash: b.briefHash, styleVersion: STYLE_VERSION, providerVersion: d.assetProviderVersion }); rep.asset = r.created ? 'queued' : 'already_queued'; }
  }

  // 2) alternative routes
  if (!d.cfg.llmEnabled || !d.provider) { rep.routes = 'llm_off'; return rep; }
  const rel = await activeRelease(d.db);
  if (!rel) { rep.routes = 'no_release'; return rep; }
  const pool = candidatePool(d.cat.db, itemId, { max: 40 });          // placeholders are already excluded; ingredients need not be 'verified' (only targets must be)
  if (pool.length < 2) { rep.routes = 'no_pool'; await audit(d.db, { actorRole: 'system', kind: 'onboard_routes_done', objectType: 'item', objectId: itemId, details: { promptVersion: ONBOARD_PROMPT_VERSION, result: 'no_pool' } }); return rep; }

  const rsv = await reserve(d.db, { computeId: null, provider: d.provider.name, reserveUsd: d.cfg.reservePerCallUsd, cfg: { dailyGlobalUsd: d.cfg.dailyGlobalUsd }, now: d.now() });
  if (!rsv.ok) { rep.routes = `budget:${rsv.reason}`; return rep; }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), d.cfg.providerTimeoutMs + 15_000);
  let raw: string;
  try {
    raw = await Promise.race([
      d.provider.propose({ targetId: itemId, targetName: node.n, verifiedFacts: [node.l1, node.l2, node.l3].filter((x): x is string => !!x), allowlist: pool, existingRoutes: (node.rec ?? []).map(r => [...r]), actions: [...ACTIONS_LIST] }),
      new Promise<string>((_, rej) => ac.signal.addEventListener('abort', () => rej(new ProviderError('timeout', true, true)))),
    ]);
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError('unexpected', false, true);
    if (pe.billableUnknown) await markUnknown(d.db, rsv.ledgerId); else await releaseReservation(d.db, rsv.ledgerId);
    await recordProviderFailure(d.db, d.provider.name, d.now());
    rep.routes = 'provider_error';                       // an outage is not a verdict: the item stays "new" and is retried later
    return rep;
  } finally { clearTimeout(timer); }
  await recordProviderSuccess(d.db, d.provider.name);
  const u = d.provider.last;
  const usd = u && u.costUsd >= 0 ? u.costUsd : d.cfg.reservePerCallUsd;
  try { await settle(d.db, rsv.ledgerId, { settledUsd: usd, inputTokens: u?.inputTokens ?? 0, outputTokens: u?.outputTokens ?? 0, externalRequestId: u?.requestId ?? null }); }
  catch { await settle(d.db, rsv.ledgerId, { settledUsd: usd, inputTokens: u?.inputTokens ?? 0, outputTokens: u?.outputTokens ?? 0, externalRequestId: null }); }

  const out = validateAltResponse(raw, itemId, {
    db: d.cat.db, allowlist: new Set(pool), actions: new Set(ACTIONS_LIST), knownSourceIds: new Set(Object.keys(d.cat.db.sources ?? {})),
    index: buildRecipeIndex(d.cat.db), maxProposals: 3,
  });
  for (const r of out.results) {
    if (r.status !== 'schema_valid' || !r.proposal) { rep.rejected++; continue; }
    const action = r.proposal.action ?? null;
    // the SAME server gate a player attempt must pass: physics/process/chronology, and the item must really be offered
    const pf = preflight(d.cat, { ingredientIds: r.proposal.ingredientIds, actionId: action });
    const rule = pf.kind === 'eligible' ? pf.candidates.find(c => c.targetId === itemId && (c.actionId === null || c.actionId === action)) : undefined;
    if (!rule) { rep.rejected++; continue; }
    const ins = await insertProposal(d.db, {
      releaseId: rel.id, targetId: itemId, ingredientIds: r.proposal.ingredientIds, actionKey: action ?? '', processId: rule.processId,
      mechanism: r.proposal.explanation, reasonCodes: ['ONBOARD'], modelId: u?.modelId ?? 'unknown', promptVersion: ONBOARD_PROMPT_VERSION,
      provenance: { source: 'onboard_sweep', evidenceClass: r.proposal.evidenceClass, requestId: u?.requestId ?? null },
    });
    if (ins.created) rep.proposalsCreated++;
  }
  rep.routes = out.outcome;
  await audit(d.db, { actorRole: 'system', kind: 'onboard_routes_done', objectType: 'item', objectId: itemId, details: { promptVersion: ONBOARD_PROMPT_VERSION, outcome: out.outcome, created: rep.proposalsCreated, rejected: rep.rejected } });
  return rep;
}

/** Bounded batch: at most `limit` items per call so one request can never fan out into unbounded spend. */
export async function onboardScan(d: OnboardDeps, limit = 3): Promise<{ pending: number; processed: OnboardReport[] }> {
  const list = await listNewItems(d.db, d.cat);
  const processed: OnboardReport[] = [];
  for (const it of list.slice(0, Math.max(0, Math.min(limit, 10)))) processed.push(await onboardItem(d, it.itemId));
  return { pending: Math.max(0, list.length - processed.length), processed };
}
