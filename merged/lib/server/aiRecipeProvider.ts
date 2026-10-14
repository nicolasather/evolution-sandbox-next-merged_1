import { ALT_SYSTEM_PROMPT, buildAltUserMessage, type AltPromptInput } from './aiRecipePrompts';

/* ============================================================================
   PROVIDER ADAPTER for alternative-route proposals.

   - NoneProvider  : the default. No credentials ⇒ always answers NONE. The game
                     and the studio work fully offline.
   - MockProvider  : scripted answers for tests / the demo fixture.
   - HttpProvider  : one JSON POST, hard timeout, size caps, `fetch` injected so
                     tests never touch the network. NOT exercised against a real
                     API in Phase 1 (no credentials, no spend).

   Whatever a provider returns is untrusted text: lib/content/altValidation.ts
   is the only thing that turns it into anything.
   ========================================================================== */

export interface AltProvider {
  readonly name: string;
  propose(input: AltPromptInput): Promise<string>;
}

const none = (id: string) => JSON.stringify({ schemaVersion: 1, targetId: id, proposals: [] });

export class NoneProvider implements AltProvider {
  readonly name = 'none';
  async propose(i: AltPromptInput) { return none(i.targetId); }
}

export class MockProvider implements AltProvider {
  readonly name = 'mock';
  constructor(private script: Record<string, string | (() => string)>) {}
  async propose(i: AltPromptInput) {
    const s = this.script[i.targetId];
    if (s === undefined) return none(i.targetId);
    return typeof s === 'function' ? s() : s;
  }
}

export interface HttpProviderConfig {
  url: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class HttpProvider implements AltProvider {
  readonly name = 'http';
  constructor(private cfg: HttpProviderConfig) {}
  async propose(i: AltPromptInput): Promise<string> {
    const f = this.cfg.fetchImpl ?? fetch;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.cfg.timeoutMs ?? 20_000);
    try {
      const res = await f(this.cfg.url, {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: this.cfg.temperature ?? 0,
          max_tokens: this.cfg.maxOutputTokens ?? 600,
          system: ALT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildAltUserMessage(i) }],
        }),
      });
      if (!res.ok) return none(i.targetId); // rate-limited / down ⇒ normal behaviour: no proposal
      const text = await res.text();
      return text.length > 32_000 ? none(i.targetId) : text;
    } catch {
      return none(i.targetId); // network, abort, DNS: never throws into a craft action
    } finally {
      clearTimeout(t);
    }
  }
}

/** Choose a provider from server env. Missing/blank credentials ⇒ NONE (offline, free). */
export function providerFromEnv(env: Record<string, string | undefined> = process.env): AltProvider {
  const { ALT_AI_URL, ALT_AI_KEY, ALT_AI_MODEL } = env;
  if (!ALT_AI_URL || !ALT_AI_KEY || !ALT_AI_MODEL) return new NoneProvider();
  return new HttpProvider({ url: ALT_AI_URL, apiKey: ALT_AI_KEY, model: ALT_AI_MODEL });
}
