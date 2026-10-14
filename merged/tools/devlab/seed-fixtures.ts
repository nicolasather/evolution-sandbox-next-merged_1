/* npm run lab:fixtures — writes the hand-authored reference plates as source:"fixture" records.
   They are labelled everywhere and are NEVER counted as AI-generated. */
import { compileSpec } from '../../lib/devlab/compile';
import { FIXTURES } from '../../lib/devlab/fixtures';
import { measure } from '../../lib/devlab/metrics';
import { previewSvg } from '../../lib/devlab/preview';
import { validateSpec } from '../../lib/devlab/schema';
import { readResult, writePreview, writeResult } from '../../lib/devlab/store';
import { loadStyleRef, refuseOnVercel } from './common';

refuseOnVercel();
const styleRef = loadStyleRef();
for (const [id, spec] of Object.entries(FIXTURES)) {
  const prev = readResult(id);
  if (prev && prev.source === 'qwen') { console.log(`skip ${id}: a model-generated record exists`); continue; }
  const v = validateSpec(spec);
  if (!v.ok) throw new Error(`fixture ${id} invalid: ${v.errors.join('; ')}`);
  const t0 = performance.now();
  const c = compileSpec(v.spec, id);
  const metrics = measure(v.spec, c, performance.now() - t0, styleRef, [], id);
  writeResult({
    id, version: 0, status: 'ok', source: 'fixture', model: 'hand-authored', generatedAt: new Date().toISOString(), attempts: [],
    spec: v.spec, validationWarnings: v.warnings, markup: c.markup, metrics, preview: writePreview(id, previewSvg(c.markup)),
  });
  console.log(`fixture ${id}: paths=${metrics.detail.paths}`);
}
