import Anthropic from '@anthropic-ai/sdk';
import type { CreativeCatalog } from '../catalog';
import { DECISION_TOOL, PROMPT_VERSION_ID, SYSTEM_PROMPT, buildUserPayload } from '../prompt';
import { ProviderError, type CreativeProvider, type DecideInput, type DecideOutput } from '../types';

/* Ticket 084 — the real model adapter. It only ever runs when ALL of these are set by the owner on the server:
   CREATIVE_LLM_ENABLED=true, ANTHROPIC_API_KEY, CREATIVE_MODEL_ID (an exact API model id the owner has verified).
   It forces ONE tool call with a strict schema, sends no player text, and returns RAW data that the caller validates. */

export interface AnthropicOptions {
  apiKey: string;
  modelId: string;
  /** USD per million tokens; when absent the cost is reported as the reservation (conservative) by the caller */
  priceInPerMTok?: number;
  priceOutPerMTok?: number;
  maxOutputTokens?: number;
  client?: Pick<Anthropic, 'messages'>;           // injected in tests
}

export class AnthropicProvider implements CreativeProvider {
  readonly name = 'anthropic';
  private client: Pick<Anthropic, 'messages'>;
  constructor(private o: AnthropicOptions, private cat: CreativeCatalog) {
    this.client = o.client ?? new Anthropic({ apiKey: o.apiKey, maxRetries: 0, timeout: 20_000 });   // the service owns retries
  }

  async decide(input: DecideInput): Promise<DecideOutput> {
    let res;
    try {
      res = await this.client.messages.create({
        model: this.o.modelId,
        max_tokens: this.o.maxOutputTokens ?? 450,
        temperature: 0,
        system: SYSTEM_PROMPT,
        tools: [DECISION_TOOL as unknown as Anthropic.Tool],
        tool_choice: { type: 'tool', name: DECISION_TOOL.name },
        messages: [{ role: 'user', content: buildUserPayload(this.cat, input) }],
      }, { signal: input.signal });
    } catch (e) {
      throw classify(e);
    }
    const block = res.content.find(b => b.type === 'tool_use' && b.name === DECISION_TOOL.name);
    const inT = res.usage?.input_tokens ?? 0, outT = res.usage?.output_tokens ?? 0;
    const cost = this.o.priceInPerMTok !== undefined && this.o.priceOutPerMTok !== undefined
      ? (inT * this.o.priceInPerMTok + outT * this.o.priceOutPerMTok) / 1_000_000 : -1;
    return {
      // anything but exactly one forced tool call is handed on as-is; parseDecision will refuse it
      decision: block && block.type === 'tool_use' ? block.input : null,
      meta: { provider: 'anthropic', modelId: res.model, promptVersion: PROMPT_VERSION_ID, requestId: (res as { _request_id?: string | null })._request_id ?? res.id ?? null, inputTokens: inT, outputTokens: outT, costUsd: cost },
    };
  }
}

/** Map SDK errors onto our contract. After a request has left, a timeout/abort/connection loss MAY have been billed. */
export function classify(e: unknown): ProviderError {
  if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('timeout', false, true);
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError('connection', true, false);
  if (e instanceof Anthropic.RateLimitError) return new ProviderError('rate_limited', true, false);
  if (e instanceof Anthropic.InternalServerError) return new ProviderError('upstream_5xx', true, false);
  if (e instanceof Anthropic.APIError) return new ProviderError(`http_${e.status ?? 'x'}`, false, false);    // 400/401/403/404: our config, retry is pointless
  return new ProviderError('unexpected', false, true);
}
