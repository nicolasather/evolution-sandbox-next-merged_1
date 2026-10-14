/* Ticket 069/079/086 — every Phase 2 switch lives here. Everything defaults to OFF / free. Server-only. */
type EnvLike = Record<string, string | undefined>;

export interface CreativeConfig {
  llmEnabled: boolean;          // CREATIVE_LLM_ENABLED
  assetAiEnabled: boolean;      // ASSET_AI_ENABLED
  modeAiEnabled: boolean;       // MODE_AI_ENABLED
  publicRollout: boolean;       // CREATIVE_PUBLIC_ROLLOUT (guests may trigger a model call at all)
  dailyGlobalUsd: number;       // CREATIVE_DAILY_USD_CAP
  reservePerCallUsd: number;    // CREATIVE_RESERVE_USD
  guestDailyAttempts: number;   // CREATIVE_GUEST_DAILY_ATTEMPTS
  providerTimeoutMs: number;
  actorSalt: string;            // CREATIVE_ACTOR_SALT (required to run; missing => feature unavailable)
  allowedOrigins: string[];     // CREATIVE_ALLOWED_ORIGINS, comma separated; same-origin is always allowed
}

const flag = (v: string | undefined) => v === 'true';
const num = (v: string | undefined, d: number, min: number, max: number) => {
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export function loadConfig(env: EnvLike = process.env): CreativeConfig {
  return {
    llmEnabled: flag(env.CREATIVE_LLM_ENABLED),
    assetAiEnabled: flag(env.ASSET_AI_ENABLED),
    modeAiEnabled: flag(env.MODE_AI_ENABLED),
    publicRollout: flag(env.CREATIVE_PUBLIC_ROLLOUT),
    dailyGlobalUsd: num(env.CREATIVE_DAILY_USD_CAP, 0, 0, 10_000),       // default 0 USD: nothing can be spent
    reservePerCallUsd: num(env.CREATIVE_RESERVE_USD, 0.02, 0.0001, 5),
    guestDailyAttempts: num(env.CREATIVE_GUEST_DAILY_ATTEMPTS, 30, 1, 1000),
    providerTimeoutMs: num(env.CREATIVE_PROVIDER_TIMEOUT_MS, 12_000, 1000, 60_000),
    actorSalt: env.CREATIVE_ACTOR_SALT ?? '',
    allowedOrigins: (env.CREATIVE_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  };
}
