/* npm run lab:generate [-- --limit N --only vl_a,vl_b --category A --retry-failed --force]
   Calls the local Ollama for each resource, validates, compiles, measures and stores the record.
   Failures are stored as failures. If Ollama is not ready the run stops BEFORE writing anything. */
import { configFromEnv, generateResource, OllamaClient } from '../../lib/devlab/ollama';
import { previewSvg } from '../../lib/devlab/preview';
import { readResult, writePreview, writeResult } from '../../lib/devlab/store';
import { arg, flag, gridsOf, loadAll, loadStyleRef, refuseOnVercel } from './common';

refuseOnVercel();
(async () => {
  const cfg = configFromEnv();
  const client = new OllamaClient(cfg);
  const h = await client.health();
  if (!h.ok) { console.error(`Ollama is not ready: ${h.error}\nNothing was generated and nothing was written.`); process.exit(1); }

  const styleRef = loadStyleRef();
  const { dataset, results } = loadAll();
  const only = arg('only')?.split(',').map(s => s.trim());
  const cat = arg('category')?.toUpperCase();
  const limit = Number(arg('limit') ?? Infinity);
  let todo = dataset.resources.filter(r => (!only || only.includes(r.id)) && (!cat || r.category === cat));
  todo = todo.filter(r => {
    const prev = results.get(r.id);
    if (flag('force') || !prev) return true;
    if (prev.source === 'fixture') return true;           // fixtures never count as generated
    return prev.status === 'failed' && flag('retry-failed');
  }).slice(0, limit);

  console.log(`Generating ${todo.length} resource(s) with ${cfg.model} @ ${cfg.baseUrl} (concurrency ${cfg.maxConcurrent}, ${cfg.maxAttempts} attempts each)`);
  // uniqueness is measured against every other record that already has a valid drawing
  const others = gridsOf([...results.values()].filter(r => r.source === 'qwen'));
  let ok = 0, failed = 0, n = 0;
  const started = Date.now();
  const worker = async (queue: typeof todo) => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const prev = readResult(r.id);
      const rec = await generateResource(r, { client, styleRef, others, version: (prev?.version ?? 0) + 1 });
      if (rec.status === 'ok' && rec.markup) rec.preview = writePreview(r.id, previewSvg(rec.markup));
      writeResult(rec);
      if (rec.status === 'ok') { const g = gridsOf([rec])[0]; if (g) { const i = others.findIndex(o => o.id === g.id); if (i >= 0) others[i] = g; else others.push(g); } }
      rec.status === 'ok' ? ok++ : failed++;
      console.log(`[${++n}/${todo.length}] ${r.id.padEnd(30)} ${rec.status.toUpperCase().padEnd(6)} attempts=${rec.attempts.length} ${rec.status === 'failed' ? `(${rec.failure?.kind}: ${rec.failure?.message.slice(0, 90)})` : `paths=${rec.metrics?.detail.paths}`}`);
    }
  };
  const queue = [...todo];
  await Promise.all(Array.from({ length: cfg.maxConcurrent }, () => worker(queue)));
  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s: ${ok} ok, ${failed} failed. Next: npm run lab:sheet && npm run lab:report`);
  process.exit(failed && !ok ? 1 : 0);
})();
