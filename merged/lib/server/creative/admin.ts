import { checkOwner } from '@/lib/server/ownerAuth';
import { jsonResponse } from './http';
import type { Db } from './db/sql';
import { audit, decideProposal, listProposals } from './db/proposals';
import { activateRelease, activeRelease, stageRelease } from './db/releases';
import { setKillSwitch } from './db/budget';
import { buildBaseCatalog, canonicalRoutes, manifestSha, validateRoutes, activeManifest, type ManifestRoute } from './manifest';
import { recipeKey } from './recipeKey';

/* Tickets 080–082 — owner-only. Reuses the Phase 1 gate: closed (404) unless the developer gate is open, never on
   production, and the Bearer token matches. Approval never publishes; `export` stages a NEW immutable release; the
   release only becomes live when the owner deploys the compiled file AND activates it. */

export interface AdminDeps { db: Db; env?: Record<string, string | undefined> }
const REVIEWER = 'owner';

function gate(req: Request, env: Record<string, string | undefined> | undefined): Response | null {
  const a = checkOwner(req.headers, env ?? process.env);
  return a.ok ? null : new Response(null, { status: a.status, headers: { 'Cache-Control': 'no-store' } });
}
const bad = (code: string, status = 400) => jsonResponse({ error: code }, status);

async function readJson(req: Request, max = 4096): Promise<Record<string, unknown> | null> {
  const t = await req.text().catch(() => '');
  if (t.length > max) return null;
  try { const v = JSON.parse(t); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null; } catch { return null; }
}

export async function listHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const u = new URL(req.url);
  const status = u.searchParams.get('status') ?? 'pending';
  if (!['pending', 'approved', 'rejected', 'superseded'].includes(status)) return bad('bad_status');
  const after = Number(u.searchParams.get('after') ?? 0);
  const limit = Number(u.searchParams.get('limit') ?? 20);
  if (!Number.isInteger(after) || after < 0 || !Number.isFinite(limit)) return bad('bad_page');
  return jsonResponse(await listProposals(d.db, { status, afterId: after, limit }));
}

export async function decideHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = await readJson(req);
  if (!b) return bad('bad_body');
  const { proposalId, expectedVersion, decision, reason } = b;
  if (!Number.isInteger(proposalId) || !Number.isInteger(expectedVersion) || (decision !== 'approve' && decision !== 'reject') || typeof reason !== 'string' || reason.trim().length < 3) return bad('bad_fields');
  const base = buildBaseCatalog();
  const isClaimed = (ids: readonly string[]) => base.recipeIndex.has([...ids].sort().join(' '));
  const r = await decideProposal(d.db, { proposalId: proposalId as number, expectedVersion: expectedVersion as number, decision, reason, reviewer: REVIEWER, isClaimedCanonically: isClaimed });
  if (r.ok) return jsonResponse(r);
  return jsonResponse(r, r.code === 'not_found' ? 404 : r.code === 'conflict' ? 409 : 422);
}

/** Build the next release from: routes already shipped + every approved proposal. Does NOT activate. */
export async function exportHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const shipped = activeManifest();
  const approved = await d.db.query<{ id: number; target_item_id: string; ingredient_ids: string[] }>(
    `SELECT id::int, target_item_id, ingredient_ids FROM creative.recipe_proposal WHERE status='approved' ORDER BY id`);
  const merged: { r: ManifestRoute; src: number | null }[] = shipped.routes.map(r => ({ r, src: null }));
  const have = new Set(shipped.routes.map(r => recipeKey(r.ingredientIds)));
  for (const p of approved.rows) {
    const k = recipeKey(p.ingredient_ids);
    if (have.has(k)) continue;
    have.add(k);
    merged.push({ r: { targetId: p.target_item_id, ingredientIds: [...p.ingredient_ids].sort() }, src: p.id });
  }
  const routes = canonicalRoutes(merged.map(m => m.r));
  const problems = validateRoutes(buildBaseCatalog(), routes);
  if (problems.length) return jsonResponse({ error: 'validation_failed', problems }, 422);
  const sha = manifestSha(routes);
  const cur = await activeRelease(d.db);
  const srcOf = new Map(merged.map(m => [recipeKey(m.r.ingredientIds), m.src]));
  const staged = await stageRelease(d.db, {
    manifestSha256: sha, engineSourceHash: shipped.engineSourceHash, parentId: cur?.id ?? null,
    routes: routes.map(r => ({ ...r, sourceProposalId: srcOf.get(recipeKey(r.ingredientIds)) ?? null, approvedBy: REVIEWER })),
  });
  await audit(d.db, { actorRole: 'owner', kind: 'release_staged', objectType: 'release', objectId: staged.id, details: { sha256: sha, routes: routes.length } });
  // `file` is exactly what `npm run release:compile -- --in` expects; commit it, deploy, THEN activate.
  return jsonResponse({ releaseId: staged.id, created: staged.created, manifestSha256: sha, routeCount: routes.length, file: { routes } });
}

export async function activateHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = await readJson(req);
  if (!b || !Number.isInteger(b.releaseId) || !Number.isInteger(b.expectedActiveId)) return bad('bad_fields');
  const r = await activateRelease(d.db, { releaseId: b.releaseId as number, expectedActiveId: b.expectedActiveId as number });
  await audit(d.db, { actorRole: 'owner', kind: r.ok ? 'release_activated' : 'release_activate_refused', objectType: 'release', objectId: String(b.releaseId), details: r.ok ? {} : { code: r.code } });
  return jsonResponse(r, r.ok ? 200 : r.code === 'not_found' ? 404 : 409);
}

export async function killSwitchHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = await readJson(req);
  if (!b || typeof b.on !== 'boolean') return bad('bad_fields');
  await setKillSwitch(d.db, b.on);
  await audit(d.db, { actorRole: 'owner', kind: b.on ? 'kill_switch_on' : 'kill_switch_off', objectType: 'runtime', objectId: 'kill_switch' });
  return jsonResponse({ ok: true, killSwitch: b.on });
}

import { metrics } from './telemetry';
import { spentToday } from './db/budget';

export async function metricsHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const q = async (sql: string) => (await d.db.query<{ k: string; n: number }>(sql)).rows;
  const compute = await q(`SELECT state AS k, count(*)::int n FROM creative.creative_compute GROUP BY state`);
  const proposals = await q(`SELECT status AS k, count(*)::int n FROM creative.recipe_proposal GROUP BY status`);
  const ledger = await q(`SELECT status AS k, count(*)::int n FROM creative.usage_ledger GROUP BY status`);
  const attempts = (await d.db.query<{ n: number }>(`SELECT count(*)::int n FROM creative.attempt_alias`)).rows[0].n;
  const computes = compute.reduce((s, r) => s + r.n, 0);
  return jsonResponse({
    process: metrics.snapshot(),
    database: { compute, proposals, ledger, attempts, computes, dedupRatio: attempts ? Number((1 - computes / attempts).toFixed(4)) : 0 },
    spentTodayUsd: await spentToday(d.db, new Date()),
  });
}

// ---- assets (tickets 089, 092) ----------------------------------------------------------------------------
import { timingSafeEqual } from 'node:crypto';
import type { CreativeCatalog } from './catalog';
import { briefFor, STYLE_VERSION } from './assets/key';
import { enqueueAssetJob } from './assets/queue';
import { listAssets, reviewAsset, exportAssetManifest } from './assets/review';
import type { WorkerDeps } from './assets/worker';
import { assetTick } from './assets/worker';

export async function assetsListHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const status = new URL(req.url).searchParams.get('status') ?? 'validated';
  if (!['draft', 'validated', 'approved', 'published', 'rejected'].includes(status)) return bad('bad_status');
  return jsonResponse({ items: await listAssets(d.db, status) });
}

export async function assetsEnqueueHandler(req: Request, d: AdminDeps & { cat: CreativeCatalog; providerVersion: string }): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = await readJson(req);
  if (!b || typeof b.itemId !== 'string') return bad('bad_fields');
  const brief = briefFor(d.cat, b.itemId);
  if (!brief) return bad('item_not_eligible', 422);
  const r = await enqueueAssetJob(d.db, { itemId: b.itemId, briefHash: brief.briefHash, styleVersion: STYLE_VERSION, providerVersion: d.providerVersion });
  return jsonResponse(r);
}

export async function assetsReviewHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = await readJson(req);
  if (!b || !Number.isInteger(b.assetId) || (b.action !== 'approve' && b.action !== 'publish' && b.action !== 'reject')) return bad('bad_fields');
  const r = await reviewAsset(d.db, { assetId: b.assetId as number, action: b.action, reviewer: REVIEWER });
  return jsonResponse(r, r.ok ? 200 : r.code === 'not_found' ? 404 : 409);
}

export async function assetsManifestHandler(req: Request, d: AdminDeps & { baseUrl: string; hosts: string[] }): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  return jsonResponse(await exportAssetManifest(d.db, d.baseUrl, d.hosts));
}

/** Cron entry: bearer CRON_SECRET (constant time), one bounded worker step per call. */
export async function tickHandler(req: Request, w: WorkerDeps | null, env: Record<string, string | undefined> = process.env): Promise<Response> {
  const secret = env.CRON_SECRET;
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '');
  if (!secret || !m || m[1].length !== secret.length || !timingSafeEqual(Buffer.from(m[1]), Buffer.from(secret))) return new Response(null, { status: secret ? 401 : 404, headers: { 'Cache-Control': 'no-store' } });
  if (!w) return jsonResponse({ did: 'disabled' });
  return jsonResponse(await assetTick(w));
}

/* ── Mode packets (tickets 093–097): owner-only generate / list / review / export. There is NO public generation route. ── */
import { generateModePacket, reviewModePacket, exportModePackets, type ModeDeps } from './modes/gateway';

export async function modePacketsGenerateHandler(req: Request, d: AdminDeps & { mode: ModeDeps }): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = await readJson(req);
  if (!b) return bad('bad_fields');
  const r = await generateModePacket(d.mode, { modeId: b.modeId, seed: b.seed });
  return jsonResponse(r, r.ok ? 200 : r.code === 'unsupported_mode' || r.code === 'bad_seed' ? 400 : r.code === 'unavailable' ? 503 : 422);
}
export async function modePacketsListHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const u = new URL(req.url);
  const status = u.searchParams.get('status') ?? 'certified';
  if (!['certified', 'approved', 'published', 'rejected'].includes(status)) return bad('bad_status');
  const r = await d.db.query(`SELECT id::int, mode_id, seed::int, status, packet_hash, reviewed_by, created_at, packet->'flavor' AS flavor, packet->'approvedItemIds' AS items, packet->>'disclosure' AS disclosure
    FROM creative.mode_packet WHERE status=$1 ORDER BY id DESC LIMIT 50`, [status]);
  return jsonResponse({ packets: r.rows });
}
export async function modePacketsReviewHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = await readJson(req);
  if (!b || !Number.isInteger(b.packetId) || (b.action !== 'approve' && b.action !== 'publish' && b.action !== 'reject')) return bad('bad_fields');
  const r = await reviewModePacket(d.db, { packetId: b.packetId as number, action: b.action, reviewer: REVIEWER, reason: typeof b.reason === 'string' ? b.reason.slice(0, 120) : undefined });
  return jsonResponse(r, r.ok ? 200 : r.code === 'not_found' ? 404 : 409);
}
export async function modePacketsExportHandler(req: Request, d: AdminDeps): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  return jsonResponse(await exportModePackets(d.db));
}

/* ── Item onboarding: list what is new, run a bounded sweep (owner clicks one button) ── */
import { listNewItems, onboardScan, type OnboardDeps } from './onboard';

export async function onboardListHandler(req: Request, d: AdminDeps & { on: OnboardDeps }): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  return jsonResponse({ items: await listNewItems(d.on.db, d.on.cat), aiRoutes: d.on.cfg.llmEnabled && !!d.on.provider, aiAssets: d.on.cfg.assetAiEnabled });
}
export async function onboardRunHandler(req: Request, d: AdminDeps & { on: OnboardDeps }): Promise<Response> {
  const g = gate(req, d.env); if (g) return g;
  const b = (await readJson(req)) ?? {};
  const limit = Number.isInteger(b.limit) ? Math.min(Math.max(b.limit as number, 1), 5) : 3;
  return jsonResponse(await onboardScan(d.on, limit));
}
/** Cron entry (bearer CRON_SECRET): one item per call. Optional; the owner button does the same thing. */
export async function onboardTickHandler(req: Request, on: OnboardDeps | null, env: Record<string, string | undefined> = process.env): Promise<Response> {
  const secret = env.CRON_SECRET;
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '');
  if (!secret || !m || m[1].length !== secret.length || !timingSafeEqual(Buffer.from(m[1]), Buffer.from(secret))) return new Response(null, { status: secret ? 401 : 404, headers: { 'Cache-Control': 'no-store' } });
  if (!on) return jsonResponse({ did: 'disabled' });
  return jsonResponse(await onboardScan(on, 1));
}
