#!/usr/bin/env node
/* Run one of the Python tools with whatever Python 3 this machine has.
   npm scripts cannot assume a `python3` command: on Windows it is usually
   `py -3` (the launcher) or `python`. Also no `cp`: see package.json. */
import { spawnSync } from 'node:child_process';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('usage: node tools/py.mjs <script.py> [args...]');
  process.exit(2);
}

const candidates = process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]];

for (const [cmd, pre] of candidates) {
  const probe = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' });
  if (probe.status === 0 && /Python 3\./.test(`${probe.stdout}${probe.stderr}`)) {
    const run = spawnSync(cmd, [...pre, script, ...args], { stdio: 'inherit' });
    process.exit(run.status ?? 1);
  }
}
console.error('Python 3 was not found on PATH. Install it from https://www.python.org/downloads/ and run this again.');
process.exit(1);
