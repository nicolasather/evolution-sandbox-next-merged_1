/** @jest-environment node */
import http from 'http';
import type { AddressInfo } from 'net';
import { FIXTURES } from '../fixtures';
import { assertLoopbackUrl, extractJson, generateResource, OllamaClient, OllamaError } from '../ollama';
import type { StyleRef } from '../metrics';
import type { ResourceEntry } from '../types';

const styleRef: StyleRef = { entries: 1, thinPathFraction: 0.5, opacityPathFraction: 0.4, dotEntryFraction: 0.6, layeredEntryFraction: 0.5, medianPaths: 13, p90Paths: 40 };
const entry = (over: Partial<ResourceEntry> = {}): ResourceEntry => ({
  id: 'vl_amphora', name: 'Amphora', category: 'E', categoryName: 'Pottery and Glass', description: 'x'.repeat(40), period: 'p',
  materials: ['clay'], shapeFamily: 'vessel', features: ['a', 'b', 'c'], complexity: 3, catalogueCheck: { presentInCatalogue: false, matchedAgainst: 't' }, ...over,
});

type Reply = { status?: number; body?: unknown; delayMs?: number; raw?: string };
function fake(script: Reply[], models = ['qwen3:14b']) {
  const seen: { body: { messages: { role: string; content: string }[] } }[] = [];
  let active = 0, peak = 0, i = 0;
  const server = http.createServer((req, res) => {
    const send = (code: number, obj: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
    if (req.url === '/api/version') return send(200, { version: '0.0.0-test' });
    if (req.url === '/api/tags') return send(200, { models: models.map(name => ({ name })) });
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      seen.push({ body: JSON.parse(data) });
      active++; peak = Math.max(peak, active);
      const r = script[Math.min(i++, script.length - 1)];
      setTimeout(() => { active--; if (r.raw !== undefined) { res.writeHead(r.status ?? 200); res.end(r.raw); } else send(r.status ?? 200, r.body); }, r.delayMs ?? 0);
    });
  });
  return new Promise<{ url: string; seen: typeof seen; peak: () => number; close: () => Promise<void> }>(resolve =>
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen, peak: () => peak,
      close: () => new Promise<void>(r => { server.closeAllConnections?.(); server.close(() => r()); }),
    })));
}
const reply = (content: string) => ({ body: { message: { content }, prompt_eval_count: 10, eval_count: 20 } });
const good = () => reply(JSON.stringify(FIXTURES.vl_amphora));

describe('loopback enforcement', () => {
  it('accepts loopback and refuses everything else', () => {
    expect(() => assertLoopbackUrl('http://127.0.0.1:11434')).not.toThrow();
    expect(() => assertLoopbackUrl('http://localhost:11434')).not.toThrow();
    expect(() => assertLoopbackUrl('http://[::1]:11434')).not.toThrow();
    for (const bad of ['http://example.com:11434', 'http://10.0.0.5:11434', 'http://0.0.0.0:11434', 'http://localhost.evil.com', 'ftp://127.0.0.1', 'nonsense']) {
      expect(() => assertLoopbackUrl(bad)).toThrow(OllamaError);
    }
    expect(() => new OllamaClient({ baseUrl: 'https://ollama.example.com' })).toThrow();
  });
});

describe('extractJson', () => {
  it('handles fences, think blocks and surrounding prose', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('<think>hm {"x":1}</think>{"a":{"b":"}"}}')).toEqual({ a: { b: '}' } });
    expect(extractJson('Sure! {"a":[1,2]} hope that helps')).toEqual({ a: [1, 2] });
  });
  it('throws typed errors for garbage and truncation', () => {
    expect(() => extractJson('no json here')).toThrow(/no JSON/);
    expect(() => extractJson('{"a": [1, 2')).toThrow(/not closed/);
    expect(() => extractJson('{a:1}')).toThrow(/JSON.parse/);
  });
});

describe('OllamaClient against a fake local server', () => {
  it('reports health and a missing model honestly', async () => {
    const s = await fake([good()], ['llama3:8b']);
    const h = await new OllamaClient({ baseUrl: s.url }).health();
    expect(h.ok).toBe(false);
    expect(h.modelPresent).toBe(false);
    expect(h.error).toMatch(/ollama pull qwen3:14b/);
    await s.close();
    const s2 = await fake([good()], ['qwen3:14b']);
    expect((await new OllamaClient({ baseUrl: s2.url }).health()).ok).toBe(true);
    await s2.close();
  });

  it('reports an unreachable server as unreachable (no fake success)', async () => {
    const s = await fake([good()]);
    const url = s.url;
    await s.close();
    const c = new OllamaClient({ baseUrl: url, transportRetries: 0, timeoutMs: 2000 });
    expect((await c.health()).ok).toBe(false);
    await expect(c.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('times out slow replies', async () => {
    const s = await fake([{ ...good(), delayMs: 600 }]);
    const c = new OllamaClient({ baseUrl: s.url, timeoutMs: 100, transportRetries: 0 });
    await expect(c.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({ kind: 'timeout' });
    await s.close();
  });

  it('maps 404 to model_missing and does not retry it', async () => {
    const s = await fake([{ status: 404, body: { error: 'model not found' } }]);
    const c = new OllamaClient({ baseUrl: s.url, transportRetries: 3 });
    await expect(c.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({ kind: 'model_missing' });
    expect(s.seen).toHaveLength(1);
    await s.close();
  });

  it('never runs more than maxConcurrent requests at once', async () => {
    const s = await fake([{ ...good(), delayMs: 60 }]);
    const c = new OllamaClient({ baseUrl: s.url, maxConcurrent: 2 });
    await Promise.all(Array.from({ length: 6 }, () => c.chat([{ role: 'user', content: 'x' }])));
    expect(s.peak()).toBe(2);
    await s.close();
  });

  it('sends the documented request shape', async () => {
    const s = await fake([good()]);
    await new OllamaClient({ baseUrl: s.url }).chat([{ role: 'user', content: 'x' }], 7);
    const b = s.seen[0].body as unknown as Record<string, unknown>;
    expect(b).toMatchObject({ model: 'qwen3:14b', stream: false, format: 'json', think: false });
    expect((b.options as Record<string, unknown>).seed).toBe(7);
    await s.close();
  });
});

describe('generateResource', () => {
  it('accepts a valid reply on the first attempt and measures it', async () => {
    const s = await fake([good()]);
    const rec = await generateResource(entry(), { client: new OllamaClient({ baseUrl: s.url }), styleRef, others: [], version: 1 });
    expect(rec.status).toBe('ok');
    expect(rec.source).toBe('qwen');
    expect(rec.attempts).toHaveLength(1);
    expect(rec.markup).toMatch(/<g data-z/);
    expect(rec.metrics?.detail.paths).toBeGreaterThan(8);
    await s.close();
  });

  it('feeds validator complaints back and succeeds on the retry', async () => {
    const bad = reply(JSON.stringify({ layers: [{ z: 0, parts: [{ c: 'teleport', p: {} }] }] }));
    const s = await fake([bad, good()]);
    const rec = await generateResource(entry(), { client: new OllamaClient({ baseUrl: s.url }), styleRef, others: [], version: 1 });
    expect(rec.status).toBe('ok');
    expect(rec.attempts).toHaveLength(2);
    expect(rec.attempts[0].error?.kind).toBe('invalid_spec');
    const second = s.seen[1].body.messages;
    expect(second[second.length - 1].content).toMatch(/unknown component "teleport"/);
    await s.close();
  });

  it('records a failure (and keeps the raw reply) when every attempt is invalid', async () => {
    const s = await fake([reply('this is not json at all')]);
    const rec = await generateResource(entry(), { client: new OllamaClient({ baseUrl: s.url, maxAttempts: 2 }), styleRef, others: [], version: 3 });
    expect(rec.status).toBe('failed');
    expect(rec.spec).toBeUndefined();
    expect(rec.markup).toBeUndefined();
    expect(rec.failure?.kind).toBe('bad_json');
    expect(rec.attempts).toHaveLength(2);
    expect(rec.lastRaw).toContain('not json');
    expect(rec.version).toBe(3);
    await s.close();
  });

  it('rejects a valid-but-nearly-empty drawing via the quality gate', async () => {
    const thin = reply(JSON.stringify({ layers: [{ z: 0, parts: [{ c: 'ellipse', p: { rx: 4 } }, { c: 'ellipse', x: 52, p: { rx: 3 } }] }] }));
    const s = await fake([thin]);
    const rec = await generateResource(entry({ complexity: 4 }), { client: new OllamaClient({ baseUrl: s.url, maxAttempts: 1 }), styleRef, others: [], version: 1 });
    expect(rec.status).toBe('failed');
    expect(rec.failure?.kind).toBe('quality');
    await s.close();
  });

  it('records an unreachable Ollama as a failed record instead of throwing', async () => {
    const s = await fake([good()]);
    const url = s.url;
    await s.close();
    const rec = await generateResource(entry(), { client: new OllamaClient({ baseUrl: url, transportRetries: 0, timeoutMs: 1500 }), styleRef, others: [], version: 1 });
    expect(rec.status).toBe('failed');
    expect(rec.failure?.kind).toBe('unreachable');
    expect(rec.attempts).toHaveLength(1);
  });

  it('treats script-looking model output as data: nothing from it reaches the markup', async () => {
    const evil = reply(JSON.stringify({ title: '<script>alert(1)</script>', layers: [{ z: 0, parts: [{ c: 'ellipse', p: { rx: 10, onload: 'alert(1)' } }] }] }));
    const s = await fake([evil]);
    const rec = await generateResource(entry({ complexity: 1 }), { client: new OllamaClient({ baseUrl: s.url, maxAttempts: 1 }), styleRef, others: [], version: 1 });
    expect(JSON.stringify(rec.markup ?? '')).not.toMatch(/script|alert|onload/i);
    await s.close();
  });
});
