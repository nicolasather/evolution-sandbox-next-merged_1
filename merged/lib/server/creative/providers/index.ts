import type { CreativeCatalog } from '../catalog';
import type { CreativeConfig } from '../config';
import type { CreativeProvider } from '../types';
import { AnthropicProvider } from './anthropic';

/* Ticket 084 — provider selection. No flag, key or verified model id => null => feature "unavailable", never an error. */
export function providerFromCreativeEnv(env: Record<string, string | undefined>, cfg: CreativeConfig, cat: CreativeCatalog): CreativeProvider | null {
  if (!cfg.llmEnabled) return null;
  const apiKey = env.ANTHROPIC_API_KEY, modelId = env.CREATIVE_MODEL_ID;
  if (!apiKey || !modelId || !/^[a-z0-9][a-z0-9._-]{3,80}$/i.test(modelId)) return null;
  const pin = Number(env.CREATIVE_PRICE_IN_PER_MTOK), pout = Number(env.CREATIVE_PRICE_OUT_PER_MTOK);
  return new AnthropicProvider({
    apiKey, modelId,
    priceInPerMTok: Number.isFinite(pin) && env.CREATIVE_PRICE_IN_PER_MTOK ? pin : undefined,
    priceOutPerMTok: Number.isFinite(pout) && env.CREATIVE_PRICE_OUT_PER_MTOK ? pout : undefined,
  }, cat);
}
