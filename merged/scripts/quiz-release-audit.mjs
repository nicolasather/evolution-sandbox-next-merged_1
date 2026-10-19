#!/usr/bin/env node
/**
 * Quiz Studio pre-game-mode release audit. Node.js >=20; zero extra dependencies.
 * STATIC findings are evidence of source structure, NOT proof of runtime correctness.
 * Use --checks for installed-project compile/lint/unit tests.
 * Use --integration only with isolated disposable Supabase and explicit write opt-in.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] || fallback : fallback;
};
const has = (name) => argv.includes(name);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(arg('--root', process.cwd()));
const pkg = path.join(root, 'package.json');
const app = path.join(root, 'app/quiz');
const api = path.join(root, 'app/api/quiz');
const lib = path.join(root, 'lib/quiz');
const stamp = new Date().toISOString();
const findings = [];
const executions = [];
const status = (v) => v ? 'FOUND_STATIC' : 'MISSING_STATIC';

function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) {
  const full = path.join(root, rel);
  return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : '';
}
function record(id, title, files, pattern = null, detail = '') {
  const all = Array.isArray(files) ? files : [files];
  const present = all.every(exists);
  const text = all.map(read).join('\n');
  const matches = !pattern || pattern.test(text);
  findings.push({ id, title, status: status(present && matches), source: all, detail, note: 'Static only: must be verified with runtime tests and UI.' });
}
function list(rootDir, max = 8000) {
  const output = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (output.length >= max) return;
      if (d.name.startsWith('.') || ['node_modules','dist','.next','out','coverage'].includes(d.name)) continue;
      const abs = path.join(dir, d.name);
      if (d.isDirectory()) walk(abs);
      else output.push(path.relative(root, abs).replaceAll('\\','/'));
    }
  }
  walk(rootDir);
  return output;
}
const allFiles = list(app).concat(list(api)).concat(list(lib)).concat(list(path.join(root, 'components/quiz'))).concat(list(path.join(root, 'supabase')));
const source = allFiles.filter(x => /\.(ts|tsx|sql)$/.test(x));
function corpus(files = source) { return files.map(read).join('\n'); }
function anySource(pattern) { return pattern.test(corpus()); }
function regexEntry(id, title, pattern, detail) {
  findings.push({ id, title, status: status(anySource(pattern)), source: 'Quiz Studio TS/SQL', detail, note: 'A keyword match is not proof of functionality.' });
}

console.log(`Quiz Phase 2 Audit | ${root} | ${stamp}`);
if (!fs.existsSync(pkg) || !fs.existsSync(app) || !fs.existsSync(api) || !fs.existsSync(lib)) {
  console.error('FATAL: --root must point to the Next.js app at repository/merged (not repo root).');
  process.exit(2);
}
const packageJson = JSON.parse(fs.readFileSync(pkg, 'utf8'));
const required = [
  ['Q01','Five question kinds','lib/quiz/types.ts',/multiple_choice[\s\S]*answer_forge[\s\S]*connection_rush[\s\S]*truth_hunt[\s\S]*fill_table/],
  ['Q02','Server question validation','lib/quiz/validation.ts',/questionSchema/],
  ['Q03','Modifier compatibility on server','lib/quiz/compatibility.ts',/assertCompatible/],
  ['Q04','Room create endpoint','app/api/quiz/rooms/create/route.ts',/createRoom/],
  ['Q05','Room submit endpoint','app/api/quiz/rooms/[id]/submit/route.ts',/submitAnswer/],
  ['Q06','Question answer serialization','lib/quiz/public.ts',/publicPayload/],
  ['Q07','Guest session route','app/api/quiz/auth/anonymous/route.ts',/signInAnonymously/],
  ['Q08','Local draft persistence','lib/quiz/local-drafts.ts',/saveLocalDraft/],
  ['Q09','Creator screen','components/quiz/QuizEditor.tsx',/QuizEditor/],
  ['Q10','Question editor','components/quiz/KindEditor.tsx',/KindEditor/],
  ['Q11','Online player screen','components/quiz/PlayerRoom.tsx',/PlayerRoom/],
  ['Q12','Host controls','components/quiz/HostConsole.tsx',/HostConsole/],
  ['Q13','Core E2E script','scripts/quiz-e2e.mjs',/async function main/],
  ['Q14','Initial Supabase schema','supabase/migrations/001_init.sql'],
  ['Q15','Supabase hardening','supabase/migrations/002_hardening.sql'],
  ['Q16','Supabase roles','supabase/migrations/003_service_role_grants.sql'],
  ['Q17','Quiz visual CSS','app/quiz/quiz.css'],
  ['Q18','Tests for compatibility','lib/quiz/__tests__/compatibility.test.ts'],
  ['Q19','Tests for grading','lib/quiz/__tests__/grading.test.ts'],
];
required.forEach(x => record(...x));
const mediaRelated = source.filter(f => /media|upload|storage|image|gif|video/i.test(f));
const mediaCorpus = corpus(mediaRelated);
const validationSource = read('lib/quiz/validation.ts');
const editorSource = read('components/quiz/QuizEditor.tsx') + read('components/quiz/KindEditor.tsx');
const rewardFiles = allFiles.filter(f => /collectib|reward|inventory|emblem|avatar|cosmetic|sticker/i.test(f));
findings.push({id:'Q20',title:'Media fields in question schema', status:status(/\b(media|attachments|imageUrl|videoUrl|assetId|mediaId)\b/.test(validationSource)), source:['lib/quiz/validation.ts'],detail:'All supported placements must be validated; inspect nested kinds, not just a top-level string.',note:'Static only.'});
findings.push({id:'Q21',title:'Media controls in editor',status:status(/\b(upload|file|media|video|gif|image)\b/i.test(editorSource)),source:['QuizEditor.tsx','KindEditor.tsx'],detail:'Must support questions AND relevant answer placements.',note:'Static only.'});
findings.push({id:'Q22',title:'Media upload/security integration',status:status(/storage\.from|createSignedUploadUrl|createSignedUrl|upload.*(route|media)|media.*(route|upload)/i.test(mediaCorpus)),source:mediaRelated.slice(0,15),detail:'Need content security, size, MIME, ownership, storage policies.',note:'Static only.'});
findings.push({id:'Q23',title:'Collectibles inventory/catalog source',status:status(rewardFiles.length > 0),source:rewardFiles.slice(0,25),detail:'Need real persistence, artwork, earn/equip/claim routes, reward anti-duplication.',note:'Static only.'});
regexEntry('Q24','Scroll fix scoped to quiz',/html:has\(\.qz\)|overflow-y\s*:\s*auto/i,'Verify browser navigation Sandbox ↔ Quiz.');
regexEntry('Q25','CSRF/origin checks',/assertSameOrigin/,'Verify all cookie-auth mutations use it.');
regexEntry('Q26','Auth/session handling',/currentUser|maybeUser|authServer/,'Verify owner-only access through live API.');
regexEntry('Q27','Server-side point mutation',/commit_answer|submitAnswer|base_awarded/,'Review transactional/replay protections.');
regexEntry('Q28','Server-side limited slots',/limited_slots|slotLimit/,'Test concurrent last slot.');
regexEntry('Q29','Public answer-key stripping',/answerKey|answer_key/,'Presence is NOT leak protection: run negative tests.');
regexEntry('Q30','Guest upgrade route',/\/upgrade|upgrade.*guest|updateUser/,'Test drafts/inventory ownership through upgrade.');

const tests = (packageJson.scripts || {});
for (const [key, label] of [['typecheck','TypeScript'], ['lint','Lint'], ['build','Production build'], ['test','Jest'], ['quiz:e2e','Existing API E2E']]) {
  findings.push({id:'CMD:'+key,title:label,status:status(typeof tests[key] === 'string'),source:'package.json/scripts',detail:tests[key] || 'Absent',note:'Command presence is not a successful test.'});
}
function run(label, command, args, timeoutMs = 200_000) {
  console.log(`\n> ${label}`);
  const res = spawnSync(command, args, { cwd:root, encoding:'utf8', timeout:timeoutMs, shell:process.platform==='win32', env:process.env, maxBuffer:4*1024*1024 });
  const output = [res.stdout,res.stderr].filter(Boolean).join('\n');
  const clean = output.replace(/(service[_-]?role[_-]?key|SUPABASE_SERVICE_ROLE_KEY|authorization|apikey)\s*[:=]\s*\S+/ig,'$1=[REDACTED]');
  const success = res.status === 0;
  executions.push({label,command:[command,...args].join(' '),status:success?'PASS':res.error?.code==='ETIMEDOUT'?'TIMEOUT':'FAIL',exitCode:res.status,error:res.error?.message ?? null,tail:clean.slice(-4500)});
  console.log(`${success?'PASS':'FAIL'}: ${label}`);
  return success;
}
if (has('--checks')) {
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  run('typecheck',npm,['run','typecheck']);
  run('lint',npm,['run','lint']);
  run('quiz unit tests',npm,['test','--','--runInBand','lib/quiz']);
  run('production build',npm,['run','build'],360_000);
}
if (has('--integration')) {
  const base = (process.env.BASE_URL || '').toLowerCase();
  const accepted = process.env.ALLOW_QUIZ_E2E_WRITES==='YES' && process.env.TEST_DATABASE_ISOLATED==='YES' && /^https?:\/\//.test(base) && !/vercel\.app|production|evolution-sandbox-next-merged-1-g1s/i.test(base);
  if (!accepted) {
    console.error('REFUSED: --integration requires isolated test DB + ALLOW_QUIZ_E2E_WRITES=YES, TEST_DATABASE_ISOLATED=YES, BASE_URL not production.');
    executions.push({label:'HTTP E2E',status:'BLOCKED',error:'missing isolated DB confirmation or unsafe base URL'});
  } else run('HTTP E2E',process.platform==='win32'?'npm.cmd':'npm',['run','quiz:e2e'],300_000);
}
const outDir=path.resolve(arg('--out', path.join(root,'docs','quiz-phase2-audit-output')));
fs.mkdirSync(outDir,{recursive:true});
const result={generatedAt:stamp,hostPlatform:os.platform(),appRoot:root,requirements:findings,executions,limitations:['Static source matching does not establish correct runtime behavior.','A passing build is not an E2E product release gate.','Unexercised browser, Supabase and collectibles journeys remain NOT RUN.','Existing E2E may require test Supabase + email signup settings.']};
fs.writeFileSync(path.join(outDir,'audit.json'),JSON.stringify(result,null,2)+'\n');
const escape=(s)=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
const markdown=[`# Quiz Phase 2 audit (not a release certification)`,`Generated: ${stamp}`,`App: \`${root}\``, '','## Static source scan','| ID | Area | Source finding | Notes |','|---|---|---|---|',...findings.map(f=>`| ${f.id} | ${escape(f.title)} | ${f.status} | ${escape(f.detail)} |`),'','## Executed commands','| Command | Result |','|---|---|',...executions.map(e=>`| ${escape(e.label)} | ${e.status} |`),'','## Important','A source match or scan alone is **NOT** a pass. All browser, Supabase, security and user-journey checks require real runtime evidence.','',...executions.flatMap(e=>[`### ${e.label} — ${e.status}`,'```text',e.tail||e.error||'', '```',''])];
fs.writeFileSync(path.join(outDir,'audit.md'),markdown.join('\n')+'\n');
console.log(`\nReport: ${path.join(outDir,'audit.md')}`);
console.log(`Source findings: ${findings.filter(x=>x.status==='FOUND_STATIC').length}/${findings.length}. These are NOT all verified features.`);
if (executions.some(x=>x.status==='FAIL'||x.status==='TIMEOUT')) process.exitCode=1;
if (has('--gate')) {
  console.error('NO-GO: this static harness never certifies game-mode readiness without manual + E2E release evidence.');
  process.exitCode=1;
}
