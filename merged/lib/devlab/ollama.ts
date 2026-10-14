/* ============================================================================
   VISUAL LAB — Ollama adapter (development only, server side only).

   • talks ONLY to a loopback Ollama (assertLoopbackUrl) — never a remote host
   • bounded time: per-request timeout via AbortController
   • bounded concurrency: a semaphore (default 1; a 14B model on one GPU)
   • retries: transport failures retry with backoff; INVALID model output retries
     with the validator's complaints fed back (max `maxAttempts`)
   • honest errors: every failure is typed and recorded; nothing is faked
   • model output is parsed as JSON data and validated; it is never executed
   ========================================================================== */

import { compileSpec } from './compile';
import { measure, qualityGate, type StyleRef } from './metrics';
import { feedbackPrompt, systemPrompt, userPrompt } from './prompt';
import { validateSpec } from './schema';
import { isLoopbackHostname } from './gate';
import type { AttemptLog, GenRecord, ResourceEntry } from './types';

export type OllamaErrorKind = 'unreachable' | 'timeout' | 'http' | 'model_missing' | 'empty' | 'bad_json' | 'invalid_spec' | 'quality';

export class OllamaError extends Error {
  constructor(public kind: OllamaErrorKind, message: string, public details?: string[]) {
    super(message);
    this.name = 'OllamaError';
  }
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxConcurrent: number;
  maxAttempts: number;
  transportRetries: number;
  numCtx: number;
  numPredict: number;
  temperature: number;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3:14b',
  timeoutMs: 240_000,
  maxConcurrent: 1,
  maxAttempts: 3,
  transportRetries: 1,
  numCtx: 16384,
  numPredict: 6144,
  temperature: 0.5,
};

export function configFromEnv(env: Record<string, string | undefined> = process.env): OllamaConfig {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    ...DEFAULT_CONFIG,
    baseUrl: env.OLLAMA_URL || DEFAULT_CONFIG.baseUrl,
    model: env.OLLAMA_MODEL || DEFAULT_CONFIG.model,
    timeoutMs: num(env.OLLAMA_TIMEOUT_MS, DEFAULT_CONFIG.timeoutMs),
    maxConcurrent: Math.max(1, Math.min(4, num(env.OLLAMA_CONCURRENCY, DEFAULT_CONFIG.maxConcurrent))),
    maxAttempts: Math.max(1, Math.min(5, num(env.OLLAMA_MAX_ATTEMPTS, DEFAULT_CONFIG.maxAttempts))),
    numCtx: num(env.OLLAMA_NUM_CTX, DEFAULT_CONFIG.numCtx),
    numPredict: num(env.OLLAMA_NUM_PREDICT, DEFAULT_CONFIG.numPredict),
    temperature: num(env.OLLAMA_TEMPERATURE, DEFAULT_CONFIG.temperature),
  };
}

export function assertLoopbackUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new OllamaError('unreachable', `OLLAMA_URL is not a valid URL: ${raw}`); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new OllamaError('unreachable', 'OLLAMA_URL must be http(s)');
  if (!isLoopbackHostname(u.hostname)) throw new OllamaError('unreachable', `refusing non-loopback Ollama host "${u.hostname}" — the lab only talks to a local Ollama`);
  return u;
}

class Semaphore {
  private waiting: Array<() => void> = [];
  private active = 0;
  constructor(private max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>(res => this.waiting.push(res));
    this.active++;
    try { return await fn(); } finally { this.active--; this.waiting.shift()?.(); }
  }
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ChatResult { content: string; ms: number; promptTokens?: number; outputTokens?: number }

/** Pull the JSON object out of a reply: drops <think> blocks and code fences, balances braces string-aware. */
export function extractJson(text: string): unknown {
  let s = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  if (start < 0) throw new OllamaError('bad_json', 'reply contains no JSON object');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { throw new OllamaError('bad_json', `JSON.parse failed: ${(e as Error).message}`); }
    }
  }
  throw new OllamaError('bad_json', 'JSON object is not closed (reply was probably cut off)');
}

export class OllamaClient {
  readonly cfg: OllamaConfig;
  private sem: Semaphore;
  private base: URL;

  constructor(cfg: Partial<OllamaConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.base = assertLoopbackUrl(this.cfg.baseUrl);
    this.sem = new Semaphore(this.cfg.maxConcurrent);
  }

  private async http(path: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
    const f = this.cfg.fetchImpl ?? fetch;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await f(new URL(path, this.base).toString(), { ...init, signal: ctl.signal });
    } catch (e) {
      if (ctl.signal.aborted) throw new OllamaError('timeout', `Ollama did not answer within ${Math.round(timeoutMs / 1000)}s`);
      throw new OllamaError('unreachable', `cannot reach Ollama at ${this.base.origin}: ${(e as Error).message}`);
    } finally { clearTimeout(timer); }
  }

  /** Connection report used by `check-ollama` and the gallery header. Never throws. */
  async health(): Promise<{ ok: boolean; version?: string; modelPresent: boolean; models: string[]; error?: string }> {
    try {
      const v = await this.http('/api/version', undefined, 5000);
      if (!v.ok) throw new OllamaError('http', `/api/version returned HTTP ${v.status}`);
      const version = ((await v.json()) as { version?: string }).version;
      const t = await this.http('/api/tags', undefined, 5000);
      if (!t.ok) throw new OllamaError('http', `/api/tags returned HTTP ${t.status}`);
      const models = ((await t.json()) as { models?: { name: string }[] }).models?.map(m => m.name) ?? [];
      const modelPresent = models.some(n => n === this.cfg.model || n.startsWith(this.cfg.model + ':') || n === this.cfg.model + ':latest');
      return { ok: modelPresent, version, modelPresent, models, error: modelPresent ? undefined : `model "${this.cfg.model}" is not pulled (run: ollama pull ${this.cfg.model})` };
    } catch (e) {
      return { ok: false, modelPresent: false, models: [], error: (e as Error).message };
    }
  }

  /** One chat completion with bounded time, bounded concurrency and transport retries. */
  chat(messages: ChatMessage[], seed?: number): Promise<ChatResult> {
    return this.sem.run(async () => {
      let lastErr: OllamaError | undefined;
      for (let a = 0; a <= this.cfg.transportRetries; a++) {
        if (a > 0) await new Promise(r => setTimeout(r, 750 * a));
        const t0 = Date.now();
        try {
          const res = await this.http('/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: this.cfg.model, messages, stream: false, format: 'json', think: false,
              options: { temperature: this.cfg.temperature, num_ctx: this.cfg.numCtx, num_predict: this.cfg.numPredict, ...(seed !== undefined ? { seed } : {}) },
            }),
          }, this.cfg.timeoutMs);
          if (res.status === 404) throw new OllamaError('model_missing', `Ollama says model "${this.cfg.model}" was not found (ollama pull ${this.cfg.model})`);
          if (!res.ok) throw new OllamaError('http', `Ollama returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
          const j = (await res.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
          const content = j.message?.content ?? '';
          if (!content.trim()) throw new OllamaError('empty', 'Ollama returned an empty reply');
          return { content, ms: Date.now() - t0, promptTokens: j.prompt_eval_count, outputTokens: j.eval_count };
        } catch (e) {
          lastErr = e instanceof OllamaError ? e : new OllamaError('unreachable', (e as Error).message);
          if (lastErr.kind === 'model_missing' || lastErr.kind === 'http') throw lastErr; // retrying will not help
        }
      }
      throw lastErr!;
    });
  }
}

export interface GenerateContext {
  client: OllamaClient;
  styleRef: StyleRef;
  others: ReadonlyArray<{ id: string; grid: readonly number[] }>;
  version: number;
  now?: () => Date;
}

/** Full pipeline for one resource: prompt → model → JSON → validate → compile → measure → quality gate.
    Invalid output is retried with feedback; the final failure is RECORDED, never replaced by a placeholder. */
export async function generateResource(r: ResourceEntry, ctx: GenerateContext): Promise<GenRecord> {
  const { client } = ctx;
  const attempts: AttemptLog[] = [];
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt() }, { role: 'user', content: userPrompt(r) }];
  const base = { id: r.id, version: ctx.version, model: client.cfg.model, generatedAt: (ctx.now ?? (() => new Date()))().toISOString(), source: 'qwen' as const };
  let failure: GenRecord['failure'];
  let lastRaw: string | undefined;

  for (let n = 1; n <= client.cfg.maxAttempts; n++) {
    const t0 = Date.now();
    let reply: ChatResult;
    try {
      reply = await client.chat(messages, 1000 + n);
    } catch (e) {
      const err = e as OllamaError;
      attempts.push({ n, ms: Date.now() - t0, error: { kind: err.kind, message: err.message } });
      failure = { kind: err.kind, message: err.message };
      // transport-level problems already had their retries inside chat(); do not hammer a dead server
      break;
    }
    lastRaw = reply.content;
    const log: AttemptLog = { n, ms: reply.ms, promptTokens: reply.promptTokens, outputTokens: reply.outputTokens };
    attempts.push(log);

    let problems: string[] = [];
    let kind: OllamaErrorKind = 'invalid_spec';
    try {
      const parsed = extractJson(reply.content);
      const v = validateSpec(parsed);
      if (!v.ok) problems = v.errors;
      else {
        const c0 = performance.now();
        const compiled = compileSpec(v.spec, r.id);
        const compileMs = performance.now() - c0;
        const metrics = measure(v.spec, compiled, compileMs, ctx.styleRef, ctx.others, r.id);
        const issues = qualityGate(metrics, r.complexity);
        if (issues.length === 0) {
          return { ...base, status: 'ok', attempts, spec: v.spec, validationWarnings: [...v.warnings, ...compiled.warnings], markup: compiled.markup, metrics };
        }
        problems = issues; kind = 'quality';
      }
    } catch (e) {
      const err = e as OllamaError;
      kind = err.kind ?? 'bad_json';
      problems = [err.message];
    }
    log.error = { kind, message: problems[0] ?? 'rejected', details: problems };
    failure = { kind, message: problems[0] ?? 'rejected', details: problems };
    messages.push({ role: 'assistant', content: reply.content }, { role: 'user', content: feedbackPrompt(problems) });
  }
  return { ...base, status: 'failed', attempts, failure, lastRaw };
}
