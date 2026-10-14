/* Server-side helpers shared by the Visual Lab route and page (development only). */

import { readFileSync } from 'fs';
import path from 'path';
import { labGate, hostnameOf, isLoopbackHostname } from './gate';
import { referenceStyle, type StyleRef } from './metrics';
import { compileSpec } from './compile';
import { configFromEnv, generateResource, OllamaClient } from './ollama';
import { previewSvg } from './preview';
import { validateSpec } from './schema';
import { listResults, readDataset, readResult, writePreview, writeResult } from './store';
import type { GenRecord, ResourceEntry } from './types';

export function gateFor(headers: Pick<Headers, 'get'>): { open: boolean; reason?: string } {
  return labGate(process.env, headers.get('host') ?? '');
}

/** Mutating requests must come from a page on the same loopback origin and carry a custom header
    (which a cross-site form cannot send), so a random website cannot drive the local lab. */
export function sameOriginMutation(headers: Pick<Headers, 'get'>): boolean {
  if (headers.get('x-visual-lab') !== '1') return false;
  const origin = headers.get('origin');
  if (!origin) return false;
  try {
    const o = new URL(origin);
    return isLoopbackHostname(o.hostname) && o.host === headers.get('host');
  } catch { return false; }
}

export function hostOk(headers: Pick<Headers, 'get'>): boolean {
  return isLoopbackHostname(hostnameOf(headers.get('host')));
}

let styleRefCache: StyleRef | null = null;
export function styleRef(): StyleRef {
  if (!styleRefCache) {
    styleRefCache = referenceStyle(JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'art.json'), 'utf8')) as Record<string, string>);
  }
  return styleRefCache;
}

/** Existing catalogue entries offered for side-by-side comparison. */
export function existingResources(): { id: string; n: string; cat: string; vis: string }[] {
  const db = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'db.json'), 'utf8')) as { nodes: { id: string; n: string; cat: string; vis: string }[] };
  return db.nodes.map(n => ({ id: n.id, n: n.n, cat: n.cat, vis: n.vis }));
}

let client: OllamaClient | null = null;
export function ollama(): OllamaClient {
  if (!client) client = new OllamaClient(configFromEnv());
  return client;
}

const inFlight = new Set<string>();

export async function regenerate(id: string): Promise<GenRecord> {
  const r: ResourceEntry | undefined = readDataset().resources.find(x => x.id === id);
  if (!r) throw new Error('unknown resource');
  if (inFlight.has(id)) throw new Error('already regenerating');
  inFlight.add(id);
  try {
    const prev = readResult(id);
    const others = listResults()
      .filter(g => g.id !== id && g.status === 'ok' && g.spec)
      .flatMap(g => { const v = validateSpec(g.spec); return v.ok ? [{ id: g.id, grid: compileSpec(v.spec, g.id).grid }] : []; });
    const rec = await generateResource(r, { client: ollama(), styleRef: styleRef(), others, version: (prev?.version ?? 0) + 1 });
    if (rec.status === 'ok' && rec.markup) rec.preview = writePreview(id, previewSvg(rec.markup));
    writeResult(rec);
    return rec;
  } finally { inFlight.delete(id); }
}
