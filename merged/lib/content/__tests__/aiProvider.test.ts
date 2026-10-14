import { playDb } from '@/lib/processing';
import { suggestAlternatives } from '../altService';
import { HttpProvider, extractText, providerFromEnv, NoneProvider, type ProviderEvent } from '../../server/aiRecipeProvider';
import { RateLimiter, limitsFromEnv } from '../../server/rateLimit';

const input = { targetId: 'axe', targetName: 'Axe', verifiedFacts: [], allowlist: [], existingRoutes: [], actions: [] };
const noneStr = JSON.stringify({ schemaVersion: 1, targetId: 'axe', proposals: [] });
const res = (body: string, status = 200, headers: Record<string, string> = {}) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => body, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as Response;
const anth = (text: string) => JSON.stringify({ content: [{ type: 'text', text }] });
const oai = (text: string) => JSON.stringify({ choices: [{ message: { content: text } }] });
const mk = (f: typeof fetch, over: Partial<ConstructorParameters<typeof HttpProvider>[0]> = {}, events?: ProviderEvent[]) =>
  new HttpProvider({ url: 'https://api.example.test/v1', apiKey: 'SECRET-KEY-123', model: 'm', fetchImpl: f, sleep: async () => {}, onEvent: e => events?.push(e), ...over });

describe('envelope handling', () => {
  it('unwraps Anthropic and OpenAI shapes and a single code fence', () => {
    expect(extractText('anthropic', anth('{"a":1}'))).toBe('{"a":1}');
    expect(extractText('openai', oai('{"a":1}'))).toBe('{"a":1}');
    expect(extractText('anthropic', anth('```json\n{"a":1}\n```'))).toBe('{"a":1}');
  });
  it('anything else is null, never a guess', () => {
    for (const b of ['not json', '{}', '{"content":[]}', '{"content":[{"type":"tool_use"}]}', '{"choices":[]}', anth('   ')]) expect(extractText('anthropic', b)).toBeNull();
    expect(extractText('openai', '{"content":[{"type":"text","text":"x"}]}')).toBeNull();
  });
});

describe('HttpProvider request shape (mock fetch, no network)', () => {
  it('anthropic format: x-api-key + version header, system prompt separate, POST', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const p = mk((async (url: string, init: RequestInit) => { seen = { url, init }; return res(anth(noneStr)); }) as unknown as typeof fetch);
    expect(await p.propose(input)).toBe(noneStr);
    const h = seen!.init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('SECRET-KEY-123'); expect(h['anthropic-version']).toBeTruthy(); expect(h.authorization).toBeUndefined();
    const b = JSON.parse(seen!.init.body as string);
    expect(b.system).toMatch(/alternative crafting routes/); expect(b.max_tokens).toBe(600); expect(b.temperature).toBe(0);
    expect(p.status()).toBe('ok');
  });
  it('openai format: bearer header, system as a message', async () => {
    let init: RequestInit | undefined;
    const p = mk((async (_u: string, i: RequestInit) => { init = i; return res(oai(noneStr)); }) as unknown as typeof fetch, { format: 'openai' });
    expect(await p.propose(input)).toBe(noneStr);
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer SECRET-KEY-123');
    expect(JSON.parse(init!.body as string).messages[0].role).toBe('system');
  });
});

describe('retries, limits and failure handling', () => {
  it('retries a 429 and then succeeds; waits at least the Retry-After (capped)', async () => {
    const calls: number[] = []; const waits: number[] = [];
    const f = (async () => { calls.push(1); return calls.length < 3 ? res('', 429, { 'retry-after': '1' }) : res(anth(noneStr)); }) as unknown as typeof fetch;
    const p = mk(f, { sleep: async ms => { waits.push(ms); } });
    expect(await p.propose(input)).toBe(noneStr);
    expect(calls.length).toBe(3); expect(waits).toEqual([1000, 1000]); expect(p.status()).toBe('ok');
  });
  it('retries are bounded: 1 + maxRetries calls, then NONE and a truthful status', async () => {
    let n = 0; const ev: ProviderEvent[] = [];
    const p = mk((async () => { n++; return res('', 503); }) as unknown as typeof fetch, { maxRetries: 2 }, ev);
    expect(await p.propose(input)).toBe(noneStr);
    expect(n).toBe(3); expect(p.status()).toBe('unavailable'); expect(ev.at(-1)?.outcome).toBe('gave_up');
  });
  it('maxRetries is hard-capped at 3 even if configured higher', async () => {
    let n = 0;
    await mk((async () => { n++; return res('', 500); }) as unknown as typeof fetch, { maxRetries: 99 }).propose(input);
    expect(n).toBe(4);
  });
  it('a 400/401/403 is NOT retried', async () => {
    for (const code of [400, 401, 403, 404]) {
      let n = 0;
      expect(await mk((async () => { n++; return res('', code); }) as unknown as typeof fetch).propose(input)).toBe(noneStr);
      expect(n).toBe(1);
    }
  });
  it('429 that never clears reports rate_limited, not a false "no routes"', async () => {
    const p = mk((async () => res('', 429)) as unknown as typeof fetch, { maxRetries: 1 });
    await p.propose(input); expect(p.status()).toBe('rate_limited');
  });
  it('a hung request is aborted by the timeout', async () => {
    const f = ((_u: string, init: RequestInit) => new Promise((_r, rej) => { init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))); })) as unknown as typeof fetch;
    const ev: ProviderEvent[] = [];
    const p = mk(f, { timeoutMs: 20, maxRetries: 0 }, ev);
    expect(await p.propose(input)).toBe(noneStr);
    expect(ev[0].outcome).toBe('timeout'); expect(p.status()).toBe('unavailable');
  });
  it('malformed envelope and oversized answers are rejected', async () => {
    const a = mk((async () => res('<html>oops</html>')) as unknown as typeof fetch); expect(await a.propose(input)).toBe(noneStr); expect(a.status()).toBe('bad_envelope');
    const b = mk((async () => res(anth('x'.repeat(40_000)))) as unknown as typeof fetch); expect(await b.propose(input)).toBe(noneStr); expect(b.status()).toBe('too_large');
  });
  it('log events never contain the key, prompt or model text', async () => {
    const ev: ProviderEvent[] = [];
    await mk((async () => res(anth(noneStr))) as unknown as typeof fetch, {}, ev).propose(input);
    const s = JSON.stringify(ev); expect(s).not.toMatch(/SECRET-KEY|alternative|proposals/);
  });
  it('a throwing logger cannot break a request', async () => {
    const p = mk((async () => res(anth(noneStr))) as unknown as typeof fetch, { onEvent: () => { throw new Error('log down'); } });
    expect(await p.propose(input)).toBe(noneStr);
  });
});

describe('the model can never bypass the deterministic checks (full path through the service)', () => {
  const via = (answer: string) => mk((async () => res(anth(answer))) as unknown as typeof fetch);
  const proposal = (over: object) => JSON.stringify({ schemaVersion: 1, targetId: 'axe', proposals: [{ ingredientIds: ['stone', 'wood', 'fiber'], explanation: 'A stone head is lashed to a wooden haft with plant fibre, so the blow lands on the stone edge.', evidenceClass: 'plausible_reconstruction', ...over }] });
  it('hallucinated ingredient ⇒ rejected', async () => {
    const r = await suggestAlternatives(playDb, 'axe', via(proposal({ ingredientIds: ['stone', 'wood', 'unobtainium_zz'] })));
    expect(r.results.every(x => x.status === 'rejected')).toBe(true);
  });
  it('wrong target id in the answer ⇒ rejected response', async () => {
    const r = await suggestAlternatives(playDb, 'axe', via(JSON.stringify({ schemaVersion: 1, targetId: 'smartphone', proposals: [] })));
    expect(r.outcome).toBe('rejected_response'); expect(r.reasons).toContain('TARGET_MISMATCH');
  });
  it('word-association explanation ⇒ rejected', async () => {
    const r = await suggestAlternatives(playDb, 'axe', via(proposal({ explanation: 'They feel related.' })));
    expect(r.results.some(x => x.status === 'schema_valid')).toBe(false);
  });
  it('provider outage is reported as unavailable, with outcome none (offline fallback)', async () => {
    const r = await suggestAlternatives(playDb, 'axe', mk((async () => { throw new Error('offline'); }) as unknown as typeof fetch, { maxRetries: 0 }));
    expect(r.outcome).toBe('none'); expect(r.providerStatus).toBe('unavailable');
  });
  it('no credentials ⇒ none_configured, game unaffected', async () => {
    const r = await suggestAlternatives(playDb, 'axe', new NoneProvider());
    expect(r.outcome).toBe('none'); expect(r.providerStatus).toBe('none_configured');
  });
  it('even a well-formed proposal is only a draft: nothing is written, the item keeps its recipes', async () => {
    const before = JSON.stringify(playDb.nodes.find(n => n.id === 'axe')!.rec);
    await suggestAlternatives(playDb, 'axe', via(proposal({})));
    expect(JSON.stringify(playDb.nodes.find(n => n.id === 'axe')!.rec)).toBe(before);
  });
});

describe('providerFromEnv', () => {
  const base = { ALT_AI_URL: 'https://api.example.test/v1', ALT_AI_KEY: 'k', ALT_AI_MODEL: 'm' };
  it('needs all three; refuses plain http and junk urls', () => {
    expect(providerFromEnv({})).toBeInstanceOf(NoneProvider);
    expect(providerFromEnv({ ...base, ALT_AI_KEY: '' })).toBeInstanceOf(NoneProvider);
    expect(providerFromEnv({ ...base, ALT_AI_URL: 'http://api.example.test' })).toBeInstanceOf(NoneProvider);
    expect(providerFromEnv({ ...base, ALT_AI_URL: 'not a url' })).toBeInstanceOf(NoneProvider);
    expect(providerFromEnv(base)).toBeInstanceOf(HttpProvider);
  });
});

describe('rate limiter (owner AI route)', () => {
  it('limits per minute and per hour, with a Retry-After, and recovers', () => {
    let t = 0; const rl = new RateLimiter({ perMinute: 2, perHour: 3 }, () => t);
    expect(rl.check().ok).toBe(true); expect(rl.check().ok).toBe(true);
    const v = rl.check(); expect(v).toMatchObject({ ok: false, reason: 'minute' }); expect((v as { retryAfterSec: number }).retryAfterSec).toBeGreaterThan(0);
    t = 61_000; expect(rl.check().ok).toBe(true);
    t = 125_000; expect(rl.check()).toMatchObject({ ok: false, reason: 'hour' });
    t = 3_700_000; expect(rl.check().ok).toBe(true);
  });
  it('env limits are clamped to sane bounds', () => {
    expect(limitsFromEnv({})).toEqual({ perMinute: 6, perHour: 40 });
    expect(limitsFromEnv({ ALT_AI_RPM: '9999', ALT_AI_HOURLY: '-1' })).toEqual({ perMinute: 60, perHour: 40 });
  });
});
