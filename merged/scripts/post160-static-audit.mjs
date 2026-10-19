#!/usr/bin/env node
/**
 * Non-destructive, stdlib-only static PRE-FLIGHT for Quiz Studio post-160 follow-up.
 * Doesn't connect to Supabase/Vercel or run browser tests. All results are evidence
 * to guide Claude's real runtime checks, never a GO signal by themselves.
 *
 * From repo's `merged/` directory:
 *   node scripts/post160-static-audit.mjs --root .
 * Or from ZIP extraction:
 *   node path/to/post160-static-audit.mjs --root D:/path/to/repo/merged
 *
 * Writes: <root>/reports/post160-static-audit.json (safe/secret-free).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const i = args.indexOf('--root');
const root = path.resolve(i >= 0 && args[i + 1] ? args[i + 1] : '.');
const read = (name) => {
  const p = path.join(root, name);
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
};
const results = [];
const record = (id, severity, state, message, paths = []) => {
  results.push({ id, severity, state, message, paths });
  console.log(`${state.padEnd(15)} ${id} (${severity}): ${message}`);
};
const ledger = read('docs/QUIZ_STUDIO_160_LEDGER.md');
const handoff = read('docs/QUIZ_STUDIO_160_HANDOFF.md');
const migration = read('supabase/migrations/004_quiz_studio_160.sql');
const media = read('lib/quiz/media.ts');
const mediaApi = read('app/api/quiz/media/route.ts');
const pkg = read('package.json');

console.log(`Quiz Studio post-160 static audit — ${root}`);
if (!pkg || !fs.existsSync(path.join(root, 'app', 'quiz'))) {
  console.error('Expected the NEXT.JS APP ROOT `merged/`, not repository root.');
  process.exit(2);
}
if (!ledger || !handoff) record('S160-01', 'P1', 'NOT_FOUND', '160 ledger or handoff absent; inspect local branch and commit.', ['docs/QUIZ_STUDIO_160_LEDGER.md', 'docs/QUIZ_STUDIO_160_HANDOFF.md']);
else {
  record('S160-01', 'P1', 'PRESENT', 'Ledger and handoff exist; reconcile each item with runtime evidence.', ['docs/QUIZ_STUDIO_160_LEDGER.md']);
  if (/not applied to production|not applied.*production|not prod/i.test(ledger + '\n' + handoff))
    record('S160-02', 'P0', 'NEEDS_LIVE_CHECK', 'Documentation says migration 004 was not deployed. Confirm actual production migration state, do not assume unchanged.', ['docs/QUIZ_STUDIO_160_LEDGER.md']);
  else record('S160-02', 'P0', 'NEEDS_LIVE_CHECK', 'Actual Supabase migration status cannot be proved by source inspection.', ['supabase/migrations/004_quiz_studio_160.sql']);
  if (/311 pass, 2 fail|311 passing tests.*2 failing|2 flaky/i.test(ledger))
    record('S160-03', 'P1', 'REPORTED_FAIL', 'Ledger reports two failing ModeHub tests. Re-run current suite and fix confirmed failures.', ['docs/QUIZ_STUDIO_160_LEDGER.md']);
  if (/No browser\/screenshot evidence|UI-unverified|browser.*not run/i.test(ledger))
    record('S160-04', 'P1', 'NEEDS_RUNTIME', 'Browser and visual evidence missing in ledger. Run Playwright on current commit.', ['docs/QUIZ_STUDIO_160_LEDGER.md']);
  if (/Load tests.*not run|30\/100 players.*not run/i.test(ledger))
    record('S160-05', 'P1', 'NEEDS_RUNTIME', '30/100 player load evidence missing. Run safely against staging only.', ['docs/QUIZ_STUDIO_160_LEDGER.md']);
  if (/Vietnamese UI strings.*not wired/i.test(ledger))
    record('S160-06', 'P2', 'PARTIAL', 'Vietnamese UI translation wiring is documented incomplete.', ['docs/QUIZ_STUDIO_160_LEDGER.md']);
  if (/moderation appeal UI|speaker rotation UI|stranger-safe host identity/i.test(ledger))
    record('S160-07', 'P1', 'PARTIAL', 'Some hosting/safety controls are API/config only; check required user interfaces.', ['docs/QUIZ_STUDIO_160_LEDGER.md']);
}
if (!migration) record('S160-08', 'P0', 'NOT_FOUND', 'Migration 004 not present. Check branch before making new schema changes.', ['supabase/migrations/004_quiz_studio_160.sql']);
else record('S160-08', 'P0', 'SOURCE_ONLY', 'Migration 004 is in source. Database application still needs external verification.', ['supabase/migrations/004_quiz_studio_160.sql']);
if (!media || !mediaApi) record('S160-09', 'P1', 'NOT_FOUND', 'Media module/API absent at expected paths; inspect architecture.', ['lib/quiz/media.ts', 'app/api/quiz/media/route.ts']);
else {
  const getBody = mediaApi.split(/export\s+async\s+function\s+GET\s*\(/)[1] ?? '';
  if (/await\s+currentUser\s*\(\s*\)/.test(getBody))
    record('S160-09', 'P0', 'LIKELY_DEFECT', 'GET media appears to REQUIRE user session; publicly published media for unsigned visitors may fail. Verify and implement least-privilege optional auth.', ['app/api/quiz/media/route.ts']);
  else record('S160-09', 'P0', 'NEEDS_RUNTIME', 'No unconditional currentUser() detected in GET; test anonymous published, draft and room-token cases.', ['app/api/quiz/media/route.ts']);
  const videoMatch = media.match(/video\s*:\s*\{\s*maxBytes\s*:\s*([^,\n]+)/);
  const apiMatch = mediaApi.match(/file\.size\s*>\s*([0-9_]+)/);
  const dbMatch = migration?.match(/bytes\s+between\s+1\s+and\s+(\d+)/i);
  const videoVal = videoMatch ? (() => { try {
      const expr = videoMatch[1].trim();
      if (!/^[\d\s_*+\-/().]+$/.test(expr)) return null;
      // No eval. Parse only the known common multiplication forms.
      return expr.split('*').reduce((acc, x) => acc * Number(x.trim()), 1);
    } catch { return null; } })() : null;
  const apiVal = apiMatch ? Number(apiMatch[1].replaceAll('_', '')) : null;
  const dbVal = dbMatch ? Number(dbMatch[1]) : null;
  if (videoVal && apiVal && dbVal && (videoVal > apiVal || videoVal > dbVal))
    record('S160-10', 'P1', 'MISMATCH', `Video cap ${videoVal} bytes vs API ${apiVal} vs migration DB ${dbVal}. Align and verify hosting body limit.`, ['lib/quiz/media.ts', 'app/api/quiz/media/route.ts', 'supabase/migrations/004_quiz_studio_160.sql']);
  else record('S160-10', 'P1', 'NEEDS_RUNTIME', 'Check actual video upload across UI, API, DB and serverless/body limits: static heuristics cannot prove consistency.', ['lib/quiz/media.ts', 'app/api/quiz/media/route.ts']);
}
record('S160-11', 'P0', 'NEEDS_RUNTIME', 'Verify exact deployed commit, private quiz-media bucket, QUIZ_PRIVACY_SALT presence and 004 RPCs without printing secrets.');
record('S160-12', 'P0', 'NEEDS_RUNTIME', 'Run full staging creator→publish→host→join→play→report and media/rewards security tests.');
const out = { generatedAt: new Date().toISOString(), root, caution: 'STATIC PREFLIGHT ONLY. PRESENT/SOURCE_ONLY do not prove working features or completed deployment. Never use this file alone for GO.', results };
const dest = path.join(root, 'reports', 'post160-static-audit.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`\nReport: ${dest}`);
console.log('Next: inspect POST_160_FINAL_FIXES.md and verify with real tests; no deployment or production mutations performed.');
