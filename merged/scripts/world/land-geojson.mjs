// Step 1 of 2 — export Natural Earth land polygons as plain GeoJSON.
//
//   npm i --no-save world-atlas topojson-client
//   node scripts/world/land-geojson.mjs /tmp/land.geojson
//
// world-atlas ships Natural Earth (public domain) as TopoJSON; this only unpacks it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const out = process.argv[2] ?? 'land.geojson';
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-50m.json'), 'utf8'));
const land = feature(topo, topo.objects.land);
writeFileSync(out, JSON.stringify(land));
console.log('wrote', out, land.type, Array.isArray(land.features) ? land.features.length + ' features' : '');
