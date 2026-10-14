/* Ticket 082 — the release compiler. Turns a reviewed list of approved routes into data/verified/alt_routes.json
   (the file the game already merges) plus its manifest hash, after refusing anything unsafe.

     npm run release:compile -- --in approved_routes.json          write the file
     npm run release:compile -- --refresh                          re-validate + stamp the hash on the committed file
     npm run release:compile -- --check                            verify the committed file (CI / pre-deploy)

   It never reaches a network, a database or a model. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import rawDb from '@/data/db.json';
import { baseProcessingData, baseKnownIds, mergeAltRoutes, type ApprovedAltRoute } from '@/lib/processing';
import { applyProcessing } from '@/lib/processing/overlay';
import type { Db } from '@/lib/types';
import { buildCatalog } from '@/lib/server/creative/catalog';
import { canonicalRoutes, manifestSha, validateRoutes } from '@/lib/server/creative/manifest';

const OUT = join(process.cwd(), 'data', 'verified', 'alt_routes.json');

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}

function main(): number {
  const base = applyProcessing(rawDb as unknown as Db, baseProcessingData);
  const cat = buildCatalog(base, baseProcessingData);

  if (process.argv.includes('--check')) {
    const cur = JSON.parse(readFileSync(OUT, 'utf8')) as { routes?: ApprovedAltRoute[]; manifestSha256?: string };
    const routes = cur.routes ?? [];
    const problems = validateRoutes(cat, routes);
    const sha = manifestSha(routes);
    const ok = problems.length === 0 && cur.manifestSha256 === sha;
    console.log(ok ? `OK  ${routes.length} route(s)  sha256=${sha}` : `FAIL problems=${JSON.stringify(problems)} embedded=${cur.manifestSha256} computed=${sha}`);
    return ok ? 0 : 1;
  }

  if (process.argv.includes('--refresh')) {          // after tools/verified_content.py publish: re-validate and stamp the hash
    const cur = JSON.parse(readFileSync(OUT, 'utf8')) as { routes?: ApprovedAltRoute[] };
    const routes = canonicalRoutes(cur.routes ?? []);
    const problems = validateRoutes(cat, routes);
    if (problems.length) { console.error('REFUSED:\n' + problems.map(p => `  #${p.index} ${p.code} ${p.detail}`).join('\n')); return 1; }
    const sha = manifestSha(routes);
    writeFileSync(OUT, JSON.stringify({ schemaVersion: 1, manifestSha256: sha, routes }, null, 2) + '\n');
    console.log(`refreshed routes=${routes.length} sha256=${sha}`);
    return 0;
  }
  const inFile = arg('--in');
  if (!inFile) { console.error('usage: release:compile --in <approved_routes.json> | --check'); return 2; }
  const input = JSON.parse(readFileSync(inFile, 'utf8')) as { routes?: ApprovedAltRoute[] };
  const routes = canonicalRoutes(input.routes ?? []);
  const problems = validateRoutes(cat, routes);
  if (problems.length) { console.error('REFUSED:\n' + problems.map(p => `  #${p.index} ${p.code} ${p.detail}`).join('\n')); return 1; }

  // the whole game must still compile with these routes, and every route must really be reachable
  const merged = mergeAltRoutes(baseProcessingData, routes, baseKnownIds);
  const played = applyProcessing(rawDb as unknown as Db, merged);
  for (const r of routes) {
    const n = played.nodes.find(x => x.id === r.targetId);
    if (!n || !n.rec.some(rec => [...rec].sort().join(' ') === r.ingredientIds.join(' '))) { console.error(`REFUSED: route to ${r.targetId} did not compile`); return 1; }
  }
  const sha = manifestSha(routes);
  writeFileSync(OUT, JSON.stringify({ schemaVersion: 1, manifestSha256: sha, routes }, null, 2) + '\n');
  console.log(`wrote ${OUT}  routes=${routes.length}  sha256=${sha}`);
  return 0;
}
process.exit(main());
