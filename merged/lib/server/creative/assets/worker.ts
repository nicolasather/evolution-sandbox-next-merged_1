import { createHash } from 'node:crypto';
import { parseGlb, GLB_LIMITS } from '@/lib/visual3d/glb';
import type { CreativeCatalog } from '../catalog';
import type { CreativeConfig } from '../config';
import type { Db } from '../db/sql';
import { markUnknown, releaseReservation, reserve, settle } from '../db/budget';
import { briefFor } from './key';
import { AssetProviderError, type AssetProvider } from './provider';
import { claimJob, completeJob, failJob, recordTask, requeueLater } from './queue';
import type { ObjectStore } from './storage';

/* Ticket 089/090 — ONE bounded step per tick (a cron call or a manual run). No tick ever waits for the provider:
   it submits OR polls OR downloads, writes the new state and returns. Safe to run from many workers at once. */

export interface WorkerDeps { db: Db; cat: CreativeCatalog; cfg: CreativeConfig; provider: AssetProvider; store: ObjectStore; workerId: string; now: () => Date; assetUsdPerJob?: number }
export type TickResult = { did: 'idle' | 'disabled' | 'budget_blocked' | 'submitted' | 'waiting' | 'stored' | 'failed_retry' | 'failed_permanent' | 'lost_lease'; jobId?: number };

const POLL_DELAY_S = 20;

export async function assetTick(d: WorkerDeps): Promise<TickResult> {
  if (!d.cfg.assetAiEnabled) return { did: 'disabled' };
  const job = await claimJob(d.db, { workerId: d.workerId, now: d.now() });
  if (!job) return { did: 'idle' };
  const jobId = job.id;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.min(d.cfg.providerTimeoutMs, 20_000));
  try {
    // ---- 1. nothing submitted yet: reserve money, then submit exactly once -----------------------------------
    if (!job.provider_task_id) {
      const brief = briefFor(d.cat, job.item_id);
      if (!brief || brief.briefHash !== job.visual_brief_hash) { await failJob(d.db, { jobId, workerId: d.workerId, now: d.now(), error: 'brief_mismatch', retryable: false }); return { did: 'failed_permanent', jobId }; }
      const usd = d.assetUsdPerJob ?? 0.2;
      const r = await reserve(d.db, { computeId: null, jobId, provider: d.provider.name, reserveUsd: usd, cfg: { dailyGlobalUsd: d.cfg.dailyGlobalUsd }, now: d.now() });
      if (!r.ok) { await requeueLater(d.db, { jobId, workerId: d.workerId, now: d.now(), delaySeconds: 300 }); return { did: 'budget_blocked', jobId }; }
      try {
        const { taskId } = await d.provider.submit(brief.prompt, ac.signal);
        const ok = await recordTask(d.db, { jobId, workerId: d.workerId, taskId, now: d.now() });
        if (!ok) { await markUnknown(d.db, r.ledgerId); return { did: 'lost_lease', jobId }; }
        await settle(d.db, r.ledgerId, { settledUsd: usd, inputTokens: 0, outputTokens: 0, externalRequestId: null });
        await requeueLater(d.db, { jobId, workerId: d.workerId, now: d.now(), delaySeconds: POLL_DELAY_S });
        return { did: 'submitted', jobId };
      } catch (e) {
        const pe = e instanceof AssetProviderError ? e : new AssetProviderError('unexpected', false, true);
        if (pe.billableUnknown || ac.signal.aborted) await markUnknown(d.db, r.ledgerId); else await releaseReservation(d.db, r.ledgerId);
        // a submit whose outcome is unknown must NOT be retried blindly: a human reconciles it
        const out = await failJob(d.db, { jobId, workerId: d.workerId, now: d.now(), error: pe.message, retryable: pe.retryable && !pe.billableUnknown && !ac.signal.aborted });
        return { did: out === 'permanent' ? 'failed_permanent' : 'failed_retry', jobId };
      }
    }

    // ---- 2. already submitted (maybe by a crashed worker): resume the SAME task, never resubmit ---------------
    const st = await d.provider.poll(job.provider_task_id, ac.signal);
    if (st.state === 'pending' || st.state === 'running') {
      await requeueLater(d.db, { jobId, workerId: d.workerId, now: d.now(), delaySeconds: POLL_DELAY_S });
      return { did: 'waiting', jobId };
    }
    if (st.state === 'failed' || !st.glbUrl) {
      const out = await failJob(d.db, { jobId, workerId: d.workerId, now: d.now(), error: st.error ?? 'task_failed', retryable: false });
      return { did: out === 'not_owner' ? 'lost_lease' : 'failed_permanent', jobId };
    }
    const bytes = await d.provider.fetchGlb(st.glbUrl, GLB_LIMITS.maxBytes, ac.signal);
    const parsed = parseGlb(bytes);
    if (!parsed.ok) { await failJob(d.db, { jobId, workerId: d.workerId, now: d.now(), error: `invalid_glb:${parsed.reason}`, retryable: false }); return { did: 'failed_permanent', jobId }; }
    const sha = createHash('sha256').update(bytes).digest('hex');
    const key = `creative-assets/${job.item_id}/${sha}.glb`;
    await d.store.put(key, bytes, 'model/gltf-binary');
    const done = await completeJob(d.db, { jobId, workerId: d.workerId, now: d.now(), itemId: job.item_id, storageKey: key, sha256: sha, sizeBytes: bytes.byteLength,
      provenance: { provider: d.provider.name, providerVersion: d.provider.version, taskId: job.provider_task_id, vertices: parsed.stats.vertices, triangles: parsed.stats.triangles, styleVersion: job.style_version } });
    return done ? { did: 'stored', jobId } : { did: 'lost_lease', jobId };
  } catch (e) {
    const pe = e instanceof AssetProviderError ? e : new AssetProviderError(String((e as Error)?.message ?? 'unexpected').slice(0, 80), true);
    const out = await failJob(d.db, { jobId, workerId: d.workerId, now: d.now(), error: pe.message, retryable: pe.retryable });
    return { did: out === 'permanent' ? 'failed_permanent' : out === 'retry' ? 'failed_retry' : 'lost_lease', jobId };
  } finally { clearTimeout(timer); }
}
