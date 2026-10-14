/* npm run lab:check — reports whether the local Ollama is reachable and has the model. Exit 0 only if usable. */
import { configFromEnv, OllamaClient } from '../../lib/devlab/ollama';
import { refuseOnVercel } from './common';

refuseOnVercel();
(async () => {
  const cfg = configFromEnv();
  let client: OllamaClient;
  try { client = new OllamaClient(cfg); } catch (e) { console.error(`CONFIG ERROR: ${(e as Error).message}`); process.exit(2); }
  const h = await client.health();
  console.log(`Ollama URL : ${cfg.baseUrl}`);
  console.log(`Model      : ${cfg.model}`);
  console.log(`Reachable  : ${h.version ? `yes (version ${h.version})` : 'NO'}`);
  console.log(`Models     : ${h.models.length ? h.models.join(', ') : '(none / unknown)'}`);
  console.log(`Model ready: ${h.modelPresent ? 'yes' : 'NO'}`);
  if (!h.ok) { console.error(`\nNOT READY: ${h.error}`); process.exit(1); }
  const t0 = Date.now();
  try {
    const r = await client.chat([{ role: 'user', content: 'Reply with exactly this JSON: {"ok":true}' }]);
    console.log(`Smoke call : ${r.ms} ms, reply ${JSON.stringify(r.content.slice(0, 80))}`);
  } catch (e) { console.error(`\nSMOKE CALL FAILED after ${Date.now() - t0} ms: ${(e as Error).message}`); process.exit(1); }
  console.log('\nOllama is ready.');
})();
