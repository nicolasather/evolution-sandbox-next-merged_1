/* npm run lab:one [-- --id vl_pagoda --dry-run --force]
   Generates EXACTLY ONE resource with ONE model request (no validation-feedback retries, no transport retries)
   and never continues to another resource. A failure is stored as a failure and the run stops.
   --dry-run prints the real request payload and the prompt size, then exits WITHOUT calling the model. */
import { configFromEnv, generateResource, OllamaClient } from '../../lib/devlab/ollama';
import { previewSvg } from '../../lib/devlab/preview';
import { readResult, writePreview, writeResult } from '../../lib/devlab/store';
import { arg, flag, gridsOf, loadAll, loadStyleRef, refuseOnVercel } from './common';

refuseOnVercel();
(async () => {
  const id = arg('id') ?? 'vl_pagoda';
  const cfg = { ...configFromEnv(), maxAttempts: 1, transportRetries: 0, maxConcurrent: 1 };
  // optional explicit overrides (these go straight into the request payload / client)
  if (arg('timeout-s')) cfg.timeoutMs = Number(arg('timeout-s')) * 1000;
  if (arg('num-ctx')) cfg.numCtx = Number(arg('num-ctx'));
  if (arg('num-predict')) cfg.numPredict = Number(arg('num-predict'));
  const client = new OllamaClient(cfg);
  const { dataset, results } = loadAll();
  const r = dataset.resources.find(x => x.id === id);
  if (!r) { console.error(`Unknown resource "${id}".`); process.exit(2); }

  // build the exact request without sending it
  const { systemPrompt, userPrompt, userPromptCompact } = await import('../../lib/devlab/prompt');
  const messages = [{ role: 'system' as const, content: systemPrompt(cfg.promptMode) }, { role: 'user' as const, content: cfg.promptMode === 'full' ? userPrompt(r) : userPromptCompact(r) }];
  const payload = client.buildPayload(messages, 1001);
  const chars = messages.reduce((n, m) => n + m.content.length, 0);
  console.log(`Resource: ${r.name} (${r.id}), category ${r.category}, complexity ${r.complexity}`);
  console.log(`Prompt: ${chars} characters (~${Math.round(chars / 3.4)} tokens estimated; the real count is reported after the call)`);
  console.log(`Request options: ${JSON.stringify((payload as { options: unknown }).options)}  think=${(payload as { think: unknown }).think}  keep_alive=${(payload as { keep_alive: unknown }).keep_alive}  format=${cfg.structured ? 'JSON schema' : 'json'}  timeout=${Math.round(cfg.timeoutMs / 1000)}s`);
  if (flag('dry-run')) { console.log('\n--dry-run: no request sent.'); return; }

  const prev = results.get(id);
  if (prev && prev.source === 'qwen' && !flag('force')) {
    console.error(`\n${id} already has a ${prev.status} Qwen record (version ${prev.version}). Nothing was changed. Use --force to run again; the old record is archived, never deleted.`);
    process.exit(4);
  }
  const h = await client.health();
  if (!h.ok) { console.error(`\nOllama is not ready: ${h.error}\nNothing was generated and nothing was written.`); process.exit(1); }

  console.log('\nSending ONE request… (CPU only: expect several minutes. Do not close this window.)');
  const t0 = Date.now();
  let got = 0;
  const beat = setInterval(() => process.stdout.write(`  …${Math.round((Date.now() - t0) / 1000)}s elapsed, ${got} characters of drawing received\n`), 30_000);
  const rec = await generateResource(r, { client, styleRef: loadStyleRef(), others: gridsOf([...results.values()].filter(x => x.source === 'qwen')), version: (readResult(id)?.version ?? 0) + 1, onProgress: p => { got = p.outputChars; } });
  clearInterval(beat);
  if (rec.status === 'ok' && rec.markup) rec.preview = writePreview(id, previewSvg(rec.markup));
  writeResult(rec);

  const a = rec.attempts[0];
  const s = (v?: number) => (v === undefined ? 'n/a' : `${(v / 1000).toFixed(1)} s`);
  console.log('\n──────── RESULT (one request only) ────────');
  console.log(`status            : ${rec.status.toUpperCase()}${rec.failure ? `  (${rec.failure.kind}: ${rec.failure.message})` : ''}`);
  console.log(`prompt tokens     : ${a?.promptTokens ?? 'n/a'}`);
  console.log(`output tokens     : ${a?.outputTokens ?? 'n/a'}`);
  console.log(`model load        : ${s(a?.loadMs)}`);
  console.log(`prompt processing : ${s(a?.promptEvalMs)}`);
  console.log(`generation        : ${s(a?.evalMs)}`);
  console.log(`wall clock        : ${s(Date.now() - t0)}`);
  if (rec.status === 'ok') {
    const m = rec.metrics!;
    console.log(`validation        : passed (${rec.validationWarnings?.length ?? 0} warnings) — parts ${m.detail.parts}, paths ${m.detail.paths}, dots ${m.detail.dots}`);
    console.log(`\nInspect it:  npm run dev   then open   http://localhost:3000/admin/visual-lab?focus=${id}`);
  } else console.log('\nStopped. No other resource was generated and no placeholder was substituted.');
  process.exit(rec.status === 'ok' ? 0 : 1);
})();
