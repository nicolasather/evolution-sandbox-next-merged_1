import Anthropic from '@anthropic-ai/sdk';
import { ALT_SYSTEM_PROMPT, buildAltUserMessage, type AltPromptInput } from '@/lib/server/aiRecipePrompts';
import type { AltProvider } from '@/lib/server/aiRecipeProvider';
import { ProviderError } from '../types';
import { classify } from './anthropic';

/* Item onboarding (target-centric): ask the model for 0..3 alternative routes to ONE existing verified item.
   Same untrusted-output rules as everything else: the reply is a string that lib/content/altValidation.ts and the
   server's own hardGate/pool re-check; the model can never create an item, a date, a source or a rule. */

export interface AltUsage { provider: string; modelId: string; requestId: string | null; inputTokens: number; outputTokens: number; costUsd: number }
export interface MeteredAltProvider extends AltProvider { readonly last: AltUsage | null }

export class AnthropicAltProvider implements MeteredAltProvider {
  readonly name = 'anthropic-alt';
  last: AltUsage | null = null;
  private client: Pick<Anthropic, 'messages'>;
  constructor(private o: { apiKey: string; modelId: string; priceIn?: number; priceOut?: number; timeoutMs?: number; client?: Pick<Anthropic, 'messages'> }) {
    this.client = o.client ?? new Anthropic({ apiKey: o.apiKey, maxRetries: 0, timeout: o.timeoutMs ?? 25_000 });
  }
  async propose(i: AltPromptInput): Promise<string> {
    const tool = {
      name: 'record_alternative_routes', description: 'Record 0..3 alternative routes for the target (an empty list is a correct answer).',
      input_schema: {
        type: 'object', additionalProperties: false, required: ['schemaVersion', 'targetId', 'proposals'],
        properties: {
          schemaVersion: { type: 'integer', enum: [1] }, targetId: { type: 'string', enum: [i.targetId] },
          proposals: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['ingredientIds', 'explanation', 'evidenceClass'], properties: {
            ingredientIds: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string', enum: i.allowlist.slice(0, 120) } },
            action: { type: 'string', enum: i.actions }, explanation: { type: 'string', maxLength: 400 },
            evidenceClass: { type: 'string', enum: ['plausible_reconstruction', 'gameplay_only'] },
          } } },
        },
      },
    };
    let res;
    try {
      res = await this.client.messages.create({
        model: this.o.modelId, max_tokens: 800, temperature: 0.2, system: ALT_SYSTEM_PROMPT,
        tools: [tool as unknown as Anthropic.Tool], tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: buildAltUserMessage(i) }],
      });
    } catch (e) { throw classify(e); }
    const block = res.content.find(b => b.type === 'tool_use' && b.name === tool.name);
    const inT = res.usage?.input_tokens ?? 0, outT = res.usage?.output_tokens ?? 0;
    const cost = this.o.priceIn !== undefined && this.o.priceOut !== undefined ? (inT * this.o.priceIn + outT * this.o.priceOut) / 1e6 : -1;
    this.last = { provider: 'anthropic', modelId: res.model, requestId: (res as { _request_id?: string | null })._request_id ?? res.id ?? null, inputTokens: inT, outputTokens: outT, costUsd: cost };
    if (!block || block.type !== 'tool_use') throw new ProviderError('no_tool_call', false, false);
    return JSON.stringify(block.input);
  }
}
