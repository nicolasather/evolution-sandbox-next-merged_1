import { createHash } from 'node:crypto';
import rawDb from '@/data/db.json';
import processingJson from '@/data/processing.json';
import { altRoutesFile, baseKnownIds, baseTakenKeys, type ApprovedAltRoute } from '@/lib/processing';
import { multiKey } from '@/lib/processing/overlay';
import { recipeKey } from './recipeKey';
import type { CreativeCatalog } from './catalog';

/* Ticket 082 — the release manifest: a canonical, order-independent list of approved routes and its SHA-256.
   The same function is used by the compiler script, the server, the admin export and the tests. */

export interface ManifestRoute { targetId: string; ingredientIds: string[] }

export function canonicalRoutes(routes: readonly ApprovedAltRoute[]): ManifestRoute[] {
  const seen = new Set<string>();
  const out: ManifestRoute[] = [];
  for (const r of routes) {
    const ingredientIds = [...r.ingredientIds].sort();
    const k = recipeKey(ingredientIds);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ targetId: r.targetId, ingredientIds });
  }
  return out.sort((a, b) => recipeKey(a.ingredientIds).localeCompare(recipeKey(b.ingredientIds)) || a.targetId.localeCompare(b.targetId));
}

export const manifestSha = (routes: readonly ApprovedAltRoute[]): string =>
  createHash('sha256').update('esv-release-1\n' + JSON.stringify(canonicalRoutes(routes))).digest('hex');

export interface RouteProblem { index: number; code: 'unknown_item' | 'unverified_target' | 'self_reference' | 'canonical_collision' | 'duplicate' | 'bad_size'; detail: string }

/** Everything a release compiler must refuse. `cat` must be built from the BASE game (no alt routes merged). */
export function validateRoutes(cat: CreativeCatalog, routes: readonly ApprovedAltRoute[]): RouteProblem[] {
  const bad: RouteProblem[] = [];
  const seen = new Set<string>();
  routes.forEach((r, index) => {
    if (!Array.isArray(r.ingredientIds) || r.ingredientIds.length < 2 || r.ingredientIds.length > 5) return void bad.push({ index, code: 'bad_size', detail: String(r.ingredientIds?.length) });
    for (const id of [r.targetId, ...r.ingredientIds]) if (!cat.profiles.has(id)) return void bad.push({ index, code: 'unknown_item', detail: id });
    if (cat.profiles.get(r.targetId)!.status !== 'verified') return void bad.push({ index, code: 'unverified_target', detail: r.targetId });
    if (r.ingredientIds.includes(r.targetId)) return void bad.push({ index, code: 'self_reference', detail: r.targetId });
    const k = multiKey(r.ingredientIds);
    if (baseTakenKeys.has(k) || cat.recipeIndex.has(k)) return void bad.push({ index, code: 'canonical_collision', detail: k });
    if (seen.has(k)) return void bad.push({ index, code: 'duplicate', detail: k });
    seen.add(k);
  });
  return bad;
}

export { baseKnownIds };

/** The release this build was compiled with, re-computed (never trusted from the JSON field). */
export function activeManifest(): { manifestSha256: string; engineSourceHash: string; routes: ManifestRoute[] } {
  const routes = canonicalRoutes(altRoutesFile.routes ?? []);
  const engineSourceHash = createHash('sha256').update(JSON.stringify(rawDb)).update(JSON.stringify(processingJson)).digest('hex');
  return { manifestSha256: manifestSha(routes), engineSourceHash, routes };
}

import { applyProcessing } from '@/lib/processing/overlay';
import { baseProcessingData } from '@/lib/processing';
import { buildCatalog } from './catalog';
import type { Db as GameDb } from '@/lib/types';

/** Catalogue of the game WITHOUT any approved alternative route (what a release is validated against). */
export function buildBaseCatalog(): CreativeCatalog {
  return buildCatalog(applyProcessing(rawDb as unknown as GameDb, baseProcessingData), baseProcessingData);
}
