#!/usr/bin/env node
/** Executes only non-mutating Playwright specs. Run within merged/ after copy. */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3100';
if (!/^https?:\/\//.test(base)) { console.error('Invalid BASE_URL.'); process.exit(2); }
if (!fs.existsSync('node_modules/@playwright/test')) {
  console.error('Missing @playwright/test: npm install -D @playwright/test && npx playwright install chromium firefox webkit');
  process.exit(2);
}
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['playwright','test','--config','tests/e2e/playwright.quiz.config.ts'];
console.log('Non-mutating Quiz UI smoke →',base);
const done = spawnSync(npx,args,{cwd:process.cwd(),stdio:'inherit',env:process.env,shell:process.platform==='win32'});
process.exit(done.status ?? 1);
