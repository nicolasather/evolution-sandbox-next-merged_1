/* Shared helpers for the Visual Lab CLI tools (development only). Run from the merged/ folder. */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { compileSpec } from '../../lib/devlab/compile';
import { labGate, onVercel } from '../../lib/devlab/gate';
import { referenceStyle, type StyleRef } from '../../lib/devlab/metrics';
import { validateSpec } from '../../lib/devlab/schema';
import { readDataset, listResults } from '../../lib/devlab/store';
import type { GenRecord } from '../../lib/devlab/types';

/** Tools refuse to run on Vercel / CI-production. They need no VISUAL_LAB flag (they are explicit CLI commands). */
export function refuseOnVercel(): void {
  if (onVercel(process.env) || process.env.NODE_ENV === 'production') {
    console.error('visual-lab tools are development-only and refuse to run here.');
    process.exit(3);
  }
}

export function loadStyleRef(): StyleRef {
  const f = path.join(process.cwd(), 'data', 'art.json');
  if (!existsSync(f)) throw new Error(`cannot find ${f} — run the tools from the merged/ folder`);
  return referenceStyle(JSON.parse(readFileSync(f, 'utf8')) as Record<string, string>);
}

export function loadAll() {
  return { dataset: readDataset(), results: new Map(listResults().map(r => [r.id, r])) };
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);
export { labGate };

/** Occupancy grids of every successful record, recomputed deterministically from its stored spec. */
export function gridsOf(records: Iterable<GenRecord>): { id: string; grid: number[] }[] {
  const out: { id: string; grid: number[] }[] = [];
  for (const r of records) {
    if (r.status !== 'ok' || !r.spec) continue;
    const v = validateSpec(r.spec);
    if (v.ok) out.push({ id: r.id, grid: compileSpec(v.spec, r.id).grid });
  }
  return out;
}
