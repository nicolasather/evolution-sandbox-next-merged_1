import { ALT_SYSTEM_PROMPT, buildAltUserMessage, type AltPromptInput } from './aiRecipePrompts';

/* ============================================================================
   PROVIDER ADAPTER for alternative-route proposals.

   - NoneProvider  : the default. No credentials ⇒ always answers NONE. The game
                     and the studio work fully offline.
   - MockProvider  : scripted answers for tests / the demo fixture.
   - HttpProvider  : JSON POST in the Anthropic Messages or OpenAI chat format, hard
                     timeout, bounded retries (429 / 5xx / network only), size caps,
                     the answer text is unwrapped from the API envelope. `fetch` and
                     `sleep` are injected so tests never touch the network. The API
                     key lives only in server env; it is never logged or returned.
                     Live authentication is NOT verified until a key is supplied.

   Whatever a provider returns is untrusted text: lib/content/altValidation.ts
   is the only thing that turns it into anything.
   ========================================================================== */

export type ProviderStatus = 'ok' | 'none_configured' | 'unavailable' | 'rate_limited' | 'bad_envelope' | 'too_large';

export interface AltProvider {
  readonly name: string;
  /** Outcome of the LAST propose(): lets the review page say "AI unavailable" instead of a false "no routes". */
  status?(): ProviderStatus;
  propose(input: AltPromptInput): Promise<string>;
}

const none = (id: string) => JSON.stringify({ schemaVersion: 1, targetId: id, proposals: [] });

export class NoneProvider implements AltProvider {
  readonly name = 'none';
  status(): ProviderStatus { return 'none_configured'; }
  async propose(i: AltPromptInput) { return none(i.targetId); }
}

export class MockProvider implements AltProvider {
  readonly name = 'mock';
  constructor(private script: Record<string, string | (() => string)>) {}
  status(): ProviderStatus { return 'ok'; }
  async propose(i: AltPromptInput) {
    const s = this.script[i.targetId];
    if (s === undefined) return none(i.targetId);
    return typeof s === 'function' ? s() : s;
  }
}

export type ProviderFormat = 'anthropic' | 'openai';

/** One log line per attempt. Never contains the key, the prompt, or the model's text. */
export interface ProviderEvent { attempt: number; httpStatus?: number; outcome: 'ok' | 'retry' | 'gave_up' | 'bad_envelope' | 'too_large' | 'network' | 'timeout'; ms: number }

export interface HttpProviderConfig {
  url: string;
  apiKey: string;
  model: string;
  format?: ProviderFormat;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Extra attempts after the first, only for 429 / 5xx / network / timeout. Hard-capped at 3. */
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (e: ProviderEvent) => void;
}

const MAX_TEXT = 32_000;
const MAX_BACKOFF_MS = 4_000;
const realSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Pull the model's answer out of the API envelope. Anything unexpected ⇒ null (never a guess). */
export function extractText(format: ProviderFormat, body: string): string | null {
  let j: unknown;
  try { j = JSON.parse(body); } catch { return null; }
  let text: unknown;
  if (format === 'anthropic') {
    const c = (j as { content?: unknown })?.content;
    if (Array.isArray(c)) text = c.filter((b): b is { type: string; text: string } => !!b && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string').map(b => b.text).join('');
  } else {
    text = (j as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  }
  if (typeof text !== 'string' || !text.trim()) return null;
  // models sometimes wrap JSON in a code fence; strip exactly one fence, nothing else
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m ? m[1] : text).trim();
}

export class HttpProvider implements AltProvider {
  readonly name = 'http';
  private last: ProviderStatus = 'ok';
  constructor(private cfg: HttpProviderConfig) {}
  status(): ProviderStatus { return this.last; }

  private request(i: AltPromptInput, signal: AbortSignal): Promise<Response> {
    const f = this.cfg.fetchImpl ?? fetch;
    const format = this.cfg.format ?? 'anthropic';
    const max = this.cfg.maxOutputTokens ?? 600;
    const user = buildAltUserMessage(i);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    let body: Record<string, unknown>;
    if (format === 'anthropic') {
      headers['x-api-key'] = this.cfg.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = { model: this.cfg.model, max_tokens: max, temperature: this.cfg.temperature ?? 0, system: ALT_SYSTEM_PROMPT, messages: [{ role: 'user', content: user }] };
    } else {
      headers.authorization = `Bearer ${this.cfg.apiKey}`;
      body = { model: this.cfg.model, max_tokens: max, temperature: this.cfg.temperature ?? 0, messages: [{ role: 'system', content: ALT_SYSTEM_PROMPT }, { role: 'user', content: user }] };
    }
    return f(this.cfg.url, { method: 'POST', signal, headers, body: JSON.stringify(body) });
  }

  async propose(i: AltPromptInput): Promise<string> {
    const format = this.cfg.format ?? 'anthropic';
    const retries = Math.min(3, Math.max(0, this.cfg.maxRetries ?? 2));
    const sleep = this.cfg.sleep ?? realSleep;
    const emit = (e: ProviderEvent) => { try { this.cfg.onEvent?.(e); } catch { /* logging must never break a request */ } };
    for (let attempt = 0; attempt <= retries; attempt++) {
      const t0 = Date.now();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.cfg.timeoutMs ?? 20_000);
      let retryAfterMs = 0;
      try {
        const res = await this.request(i, ctl.signal);
        if (res.ok) {
          const raw = await res.text();
          if (raw.length > MAX_TEXT * 2) { this.last = 'too_large'; emit({ attempt, httpStatus: res.status, outcome: 'too_large', ms: Date.now() - t0 }); return none(i.targetId); }
          const text = extractText(format, raw);
          if (text === null) { this.last = 'bad_envelope'; emit({ attempt, httpStatus: res.status, outcome: 'bad_envelope', ms: Date.now() - t0 }); return none(i.targetId); }
          if (text.length > MAX_TEXT) { this.last = 'too_large'; emit({ attempt, httpStatus: res.status, outcome: 'too_large', ms: Date.now() - t0 }); return none(i.targetId); }
          this.last = 'ok';
          emit({ attempt, httpStatus: res.status, outcome: 'ok', ms: Date.now() - t0 });
          return text;
        }
        const retryable = res.status === 429 || res.status >= 500;
        this.last = res.status === 429 ? 'rate_limited' : 'unavailable';
        const ra = Number(res.headers?.get?.('retry-after'));
        if (Number.isFinite(ra) && ra > 0) retryAfterMs = Math.min(MAX_BACKOFF_MS, ra * 1000);
        if (!retryable || attempt === retries) { emit({ attempt, httpStatus: res.status, outcome: 'gave_up', ms: Date.now() - t0 }); return none(i.targetId); }
        emit({ attempt, httpStatus: res.status, outcome: 'retry', ms: Date.now() - t0 });
      } catch (e) {
        this.last = 'unavailable';
        const aborted = (e as { name?: string })?.name === 'AbortError';
        if (attempt === retries) { emit({ attempt, outcome: aborted ? 'timeout' : 'network', ms: Date.now() - t0 }); return none(i.targetId); }
        emit({ attempt, outcome: 'retry', ms: Date.now() - t0 });
      } finally {
        clearTimeout(timer);
      }
      await sleep(retryAfterMs || Math.min(MAX_BACKOFF_MS, 250 * 2 ** attempt));
    }
    return none(i.targetId);
  }
}

/** Choose a provider from server env. Missing/blank credentials ⇒ NONE (offline, free). Env is read on the server only. */
export function providerFromEnv(env: Record<string, string | undefined> = process.env, onEvent?: (e: ProviderEvent) => void): AltProvider {
  const { ALT_AI_URL, ALT_AI_KEY, ALT_AI_MODEL, ALT_AI_FORMAT, ALT_AI_TIMEOUT_MS, ALT_AI_MAX_RETRIES, ALT_AI_MAX_TOKENS } = env;
  if (!ALT_AI_URL || !ALT_AI_KEY || !ALT_AI_MODEL) return new NoneProvider();
  let url: URL;
  try { url = new URL(ALT_AI_URL); } catch { return new NoneProvider(); }
  if (url.protocol !== 'https:') return new NoneProvider(); // never send a key over plain http
  const num = (v: string | undefined, d: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && v ? Math.min(hi, Math.max(lo, n)) : d; };
  return new HttpProvider({
    url: url.toString(), apiKey: ALT_AI_KEY, model: ALT_AI_MODEL,
    format: ALT_AI_FORMAT === 'openai' ? 'openai' : 'anthropic',
    timeoutMs: num(ALT_AI_TIMEOUT_MS, 20_000, 1_000, 60_000),
    maxRetries: num(ALT_AI_MAX_RETRIES, 2, 0, 3),
    maxOutputTokens: num(ALT_AI_MAX_TOKENS, 600, 100, 1_500),
    onEvent,
  });
}
