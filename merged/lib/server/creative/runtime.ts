import { playDb, processingData } from '@/lib/processing';
import { buildCatalog, type CreativeCatalog } from './catalog';
import { loadConfig } from './config';
import { pgDb, type Db } from './db/sql';
import { migrate } from './db/migrate';
import { importApprovedRefs } from './db/refs';
import { ensureBaselineRelease } from './db/releases';
import { activeManifest } from './manifest';
import { providerFromCreativeEnv } from './providers';
import type { ServiceDeps } from './service';

/* Ticket 071/076 — lazy server singleton. No DATABASE_URL => null => the route answers "unavailable" and the
   game plays on exactly as before. Migrations are NOT run implicitly in production: use `npm run db:migrate`. */

let cached: Promise<ServiceDeps | null> | null = null;
let catalog: CreativeCatalog | null = null;

export function creativeDeps(env: Record<string, string | undefined> = process.env): Promise<ServiceDeps | null> {
  if (!cached) cached = build(env).catch(() => { cached = null; return null; });
  return cached;
}

async function build(env: Record<string, string | undefined>): Promise<ServiceDeps | null> {
  const url = env.DATABASE_URL;
  if (!url) return null;
  const cfg = loadConfig(env);
  const { Pool } = await import('pg');
  const db: Db = pgDb(new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 3000 }));
  catalog ??= buildCatalog(playDb, processingData);
  if (env.CREATIVE_AUTO_MIGRATE === 'true' && env.VERCEL_ENV !== 'production') await migrate(db);
  const m = activeManifest();
  await importApprovedRefs(db, catalog);
  await ensureBaselineRelease(db, { manifestSha256: m.manifestSha256, engineSourceHash: m.engineSourceHash });
  return { db, cat: catalog, cfg, provider: providerFromCreativeEnv(env, cfg, catalog), now: () => new Date() };
}

import { MockAssetProvider } from './assets/provider';
import { MeshyProvider } from './assets/meshy';
import { MemoryStore, VercelBlobStore } from './assets/storage';
import type { WorkerDeps } from './assets/worker';

/** Asset worker dependencies, or null when the feature is off / has no database / no storage (nothing happens). */
export async function assetWorkerDeps(env: Record<string, string | undefined> = process.env): Promise<WorkerDeps | null> {
  const base = await creativeDeps(env);
  if (!base || !base.cfg.assetAiEnabled) return null;
  const real = env.ASSET_PROVIDER === 'meshy';
  if (real && !env.MESHY_API_KEY) return null;
  if (!env.BLOB_READ_WRITE_TOKEN && real) return null;
  return {
    db: base.db, cat: base.cat, cfg: base.cfg, now: base.now, workerId: `w_${Math.random().toString(36).slice(2, 10)}`,
    provider: real ? new MeshyProvider(env.MESHY_API_KEY!) : new MockAssetProvider(),
    store: env.BLOB_READ_WRITE_TOKEN ? new VercelBlobStore(env.BLOB_READ_WRITE_TOKEN) : new MemoryStore(),
    assetUsdPerJob: Number(env.ASSET_USD_PER_JOB) > 0 ? Number(env.ASSET_USD_PER_JOB) : 0.2,
  };
}
export const assetProviderVersion = (env: Record<string, string | undefined> = process.env) => env.ASSET_PROVIDER === 'meshy' ? 'meshy-text-to-3d-v2:preview:latest:poly8k' : 'mock-1';

import { AnthropicModeProvider, FakeModeProvider } from './modes/provider';
import type { ModeDeps } from './modes/gateway';
import { releaseHash as shippedReleaseHash } from '@/lib/content/releaseManifest';

/** Mode-packet dependencies. Provider exists ONLY with MODE_AI_ENABLED + key + a valid model id (or MODE_PROVIDER=fake for staging dry-runs). */
export async function modeDeps(env: Record<string, string | undefined> = process.env): Promise<ModeDeps | null> {
  const base = await creativeDeps(env);
  if (!base) return null;
  let provider = null;
  if (base.cfg.modeAiEnabled) {
    if (env.MODE_PROVIDER === 'fake') provider = new FakeModeProvider();
    else if (env.ANTHROPIC_API_KEY && env.CREATIVE_MODEL_ID && /^[a-z0-9][a-z0-9._-]{3,80}$/i.test(env.CREATIVE_MODEL_ID)) {
      const pin = Number(env.CREATIVE_PRICE_IN_PER_MTOK), pout = Number(env.CREATIVE_PRICE_OUT_PER_MTOK);
      provider = new AnthropicModeProvider({ apiKey: env.ANTHROPIC_API_KEY, modelId: env.CREATIVE_MODEL_ID, priceIn: env.CREATIVE_PRICE_IN_PER_MTOK && Number.isFinite(pin) ? pin : undefined, priceOut: env.CREATIVE_PRICE_OUT_PER_MTOK && Number.isFinite(pout) ? pout : undefined });
    }
  }
  return { db: base.db, cat: base.cat, cfg: base.cfg, provider, releaseHash: shippedReleaseHash, now: base.now, autoServeFlavor: env.MODE_AUTO_SERVE_FLAVOR === 'true' };
}

import { AnthropicAltProvider } from './providers/altAnthropic';
import type { OnboardDeps } from './onboard';

/** Item-onboarding dependencies. The model provider exists only with CREATIVE_LLM_ENABLED + key + a valid model id. */
export async function onboardDeps(env: Record<string, string | undefined> = process.env): Promise<OnboardDeps | null> {
  const base = await creativeDeps(env);
  if (!base) return null;
  let provider: AnthropicAltProvider | null = null;
  if (base.cfg.llmEnabled && env.ANTHROPIC_API_KEY && env.CREATIVE_MODEL_ID && /^[a-z0-9][a-z0-9._-]{3,80}$/i.test(env.CREATIVE_MODEL_ID)) {
    const pin = Number(env.CREATIVE_PRICE_IN_PER_MTOK), pout = Number(env.CREATIVE_PRICE_OUT_PER_MTOK);
    provider = new AnthropicAltProvider({ apiKey: env.ANTHROPIC_API_KEY, modelId: env.CREATIVE_MODEL_ID, priceIn: env.CREATIVE_PRICE_IN_PER_MTOK && Number.isFinite(pin) ? pin : undefined, priceOut: env.CREATIVE_PRICE_OUT_PER_MTOK && Number.isFinite(pout) ? pout : undefined });
  }
  return { db: base.db, cat: base.cat, cfg: base.cfg, now: base.now, provider, assetProviderVersion: assetProviderVersion(env) };
}
