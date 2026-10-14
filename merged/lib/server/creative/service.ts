import type { CreativeCatalog } from './catalog';
import type { Db } from './db/sql';
import { activeRelease } from './db/releases';
import { claimCompute, finishCompute, actorAttemptsToday } from './db/attempts';
import { getNegative, putNegative, NONE_TTL_SECONDS, ERROR_TTL_SECONDS } from './db/negativeCache';
import { markUnknown, recordProviderFailure, recordProviderSuccess, releaseReservation, reserve, settle } from './db/budget';
import { insertProposal } from './db/proposals';
import { computeKey, negativeKey, recipeKey, actionKey } from './recipeKey';
import { preflight, RULES_VERSION } from './preflight';
import { parseDecision, judgeDecision, type Judgement } from './decision';
import { validateProposal } from './policy';
import { ProviderError, type CreativeProvider, type TryCraftResponse, type TryRequest } from './types';
import type { CreativeConfig } from './config';

/* Tickets 071–079 orchestration. The order of the gates is the safety argument:
     release pin → canonical → impossibility → pool → (flags) → negative cache → quota → dedup winner →
     budget/breaker/kill → ONE model call → parse → judge → private proposal.
   Every gate before the model call is deterministic and free. Nothing here can make a craft succeed. */

export const PROMPT_VERSION = 'prompt-1';
export const VERSIONS = `${RULES_VERSION}|${PROMPT_VERSION}`;

export interface ServiceDeps {
  db: Db;
  cat: CreativeCatalog;
  cfg: CreativeConfig;
  provider: CreativeProvider | null;
  now: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export type ServiceResult =
  | { status: 'ok'; body: TryCraftResponse }
  | { status: 'invalid'; code: string };

const ok = (body: TryCraftResponse): ServiceResult => ({ status: 'ok', body });

export async function handleTryRecipe(deps: ServiceDeps, req: TryRequest, actor: string): Promise<ServiceResult> {
  const { db, cat, cfg, provider } = deps;
  const rel = await activeRelease(db);
  if (!rel) return ok({ kind: 'unavailable' });
  if (req.releaseHash !== rel.manifest_sha256) return ok({ kind: 'release_mismatch' });
  const releaseHash = rel.manifest_sha256;

  const pre = preflight(cat, req);
  if (pre.kind === 'invalid') return { status: 'invalid', code: pre.code };
  // Known recipes are decided by the client's Engine (it knows what this player has unlocked). The server
  // never reveals the target, so a guest cannot read the recipe book through this endpoint.
  if (pre.kind === 'known') return ok({ kind: 'known', targetId: null, releaseHash, gated: false });
  if (pre.kind === 'no_result') return ok({ kind: 'no_result', reason: pre.reason, releaseHash });

  // ---- eligible: only now can anything cost money -----------------------------------------------------------
  if (!cfg.llmEnabled || !cfg.publicRollout || !provider || !cfg.actorSalt) return ok({ kind: 'unavailable' });

  const now = deps.now();
  const nKey = negativeKey(releaseHash, req.ingredientIds, req.actionId, RULES_VERSION);
  if (await getNegative(db, nKey, now)) return ok({ kind: 'no_result', reason: 'cached_none', releaseHash });

  if (await actorAttemptsToday(db, actor, now) >= cfg.guestDailyAttempts) return ok({ kind: 'rate_limited', retryAfterSeconds: 3600 });

  const claim = await claimCompute(db, {
    actorHash: actor, attemptId: req.attemptId, computeKey: computeKey(releaseHash, req.ingredientIds, req.actionId, VERSIONS),
    releaseId: rel.id, recipeKey: recipeKey(req.ingredientIds), actionKey: actionKey(req.actionId), now,
  });

  if (claim.role === 'follower') {
    const s = claim.compute.state;
    if (s === 'none') return ok({ kind: 'no_result', reason: 'validated_none', releaseHash });
    if (s === 'pending_review') return ok({ kind: 'pending_review', attemptId: req.attemptId, releaseHash, message: 'A possible route is being reviewed.' });
    if (s === 'failed') return ok({ kind: 'unavailable' });
    return ok({ kind: 'rate_limited', retryAfterSeconds: 3 });   // someone else is computing it right now
  }

  const computeId = claim.compute.id;
  const fail = async (retrySeconds = 60): Promise<ServiceResult> => {
    await finishCompute(db, { computeId, state: 'failed', resultCode: 'provider_unavailable', retryAfter: new Date(deps.now().getTime() + retrySeconds * 1000), now: deps.now() });
    return ok({ kind: 'unavailable' });
  };

  const rsv = await reserve(db, { computeId, provider: provider.name, reserveUsd: cfg.reservePerCallUsd, cfg: { dailyGlobalUsd: cfg.dailyGlobalUsd }, now });
  if (!rsv.ok) return fail(rsv.reason === 'breaker_open' ? 120 : 300);

  let out: Awaited<ReturnType<CreativeProvider['decide']>> | null = null;
  let billableUnknown = false;
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), cfg.providerTimeoutMs);
    try {
      out = await provider.decide({ ingredientIds: req.ingredientIds, actionId: req.actionId, candidates: pre.candidates, releaseHash, promptVersion: PROMPT_VERSION, signal: ac.signal });
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError('unexpected', false, true);
      billableUnknown = billableUnknown || pe.billableUnknown || ac.signal.aborted;
      if (!pe.retryable || billableUnknown) break;        // never blindly retry something that may already be billed
    } finally { clearTimeout(timer); }
  }

  if (!out) {
    if (billableUnknown) await markUnknown(db, rsv.ledgerId); else await releaseReservation(db, rsv.ledgerId);
    await recordProviderFailure(db, provider.name, deps.now());
    await putNegative(db, nKey, 'provider_error', ERROR_TTL_SECONDS, deps.now());
    return fail();
  }

  await recordProviderSuccess(db, provider.name);
  const usage = { settledUsd: out.meta.costUsd >= 0 ? out.meta.costUsd : cfg.reservePerCallUsd, inputTokens: out.meta.inputTokens, outputTokens: out.meta.outputTokens };
  try { await settle(db, rsv.ledgerId, { ...usage, externalRequestId: out.meta.requestId }); }
  catch { await settle(db, rsv.ledgerId, { ...usage, externalRequestId: null }); }   // a duplicate provider id must never lose the cost

  const parsed = parseDecision(out.decision);
  let judged: Judgement = parsed.ok ? judgeDecision(parsed.decision, pre.candidates, req.actionId) : { kind: 'no_result' as const, reason: `invalid_output:${parsed.reason}` };
  if (judged.kind === 'pending_review') {          // independent second opinion, derived only from our own catalogue
    const pick = judged;
    const rule = pre.candidates.find(c => c.targetId === pick.targetId && c.processId === pick.processId)!;
    const v = validateProposal(cat, req.ingredientIds, req.actionId, rule);
    if (!v.ok) judged = { kind: 'no_result', reason: `validator:${v.reason}` };
  }

  if (judged.kind === 'no_result') {
    await putNegative(db, nKey, judged.reason.slice(0, 60), NONE_TTL_SECONDS, deps.now());
    await finishCompute(db, { computeId, state: 'none', resultCode: judged.reason.slice(0, 60), requestId: out.meta.requestId, now: deps.now() });
    return ok({ kind: 'no_result', reason: 'validated_none', releaseHash });
  }

  const p = await insertProposal(db, {
    releaseId: rel.id, targetId: judged.targetId, ingredientIds: req.ingredientIds, actionKey: actionKey(req.actionId), processId: judged.processId,
    mechanism: judged.mechanism, reasonCodes: parsed.ok ? [...parsed.decision.reasonCodes] : [], modelId: out.meta.modelId, promptVersion: PROMPT_VERSION,
    provenance: { provider: out.meta.provider, requestId: out.meta.requestId, evidenceClass: judged.evidenceClass, rulesVersion: RULES_VERSION, poolFingerprint: pre.fingerprint },
  });
  await finishCompute(db, { computeId, state: 'pending_review', resultCode: 'proposal', proposalId: p.id, requestId: out.meta.requestId, now: deps.now() });
  return ok({ kind: 'pending_review', attemptId: req.attemptId, releaseHash, message: 'A possible route is being reviewed.' });
}
