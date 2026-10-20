/** Writes the Tower Defense vector kit to public/quiz/td/ from lib/quiz/td/art.ts (the single source the renderer also uses).
 *    npx tsx tools/td-art/build.ts            (re-run after editing art.ts; the files are committed)
 *  Every file: explicit viewBox, no script, no foreignObject, no external URL. A contact sheet (index.html) is written for review. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bossSVG, coreSVG, enemySVG, kindSVG, propSVG, roleSVG, spawnSVG, towerSVG, INK, PAL } from '../../lib/quiz/td/art';
import { MAPS, mapPath, padCenter } from '../../lib/quiz/td/maps';
import { TD_BOSSES, TD_ENEMIES, TD_MAPS, TD_ROLES, TD_TOWERS } from '../../lib/quiz/td/domain';

const out = join(__dirname, '../../public/quiz/td'); mkdirSync(out, { recursive: true });
const files: string[] = [];
const put = (name: string, body: string) => {
  if (/<script|foreignObject|href=|url\(/i.test(body)) throw new Error(`unsafe svg ${name}`);
  writeFileSync(join(out, name), body); files.push(name);
};
for (const k of TD_TOWERS) for (const lv of [1, 2, 3] as const) { put(`tower_${k}_l${lv}.svg`, towerSVG(k, lv)); put(`tower_${k}_l${lv}_fire.svg`, towerSVG(k, lv, true)); }
for (const k of TD_ENEMIES) for (const pose of ['idle', 'move', 'hit'] as const) put(`enemy_${k}_${pose}.svg`, enemySVG(k, pose));
for (const b of TD_BOSSES) { put(`boss_${b}.svg`, bossSVG(b)); put(`boss_${b}_final.svg`, bossSVG(b, true)); }
for (const r of TD_ROLES) put(`role_${r}.svg`, roleSVG(r));
for (const k of ['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table']) put(`kind_${k}.svg`, kindSVG(k));
put('core.svg', coreSVG()); put('spawn.svg', spawnSVG());
// full boards at the logical 1280×768 resolution (64 px per tile): lane, pads, props, spawn and core
for (const id of TD_MAPS) {
  const m = MAPS[id]; const p = mapPath(id); const S = 64 / 1000;
  const d = p.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * S).toFixed(1)} ${(y * S).toFixed(1)}`).join(' ');
  const pads = m.pads.map((pad) => { const [cx, cy] = padCenter(pad); return `<rect x="${cx * S - 26}" y="${cy * S - 26}" width="52" height="52" rx="6" fill="none" stroke="${INK}" stroke-opacity="0.45" stroke-width="3" stroke-dasharray="7 6"/>`; }).join('');
  const props = m.scenery.map((s) => { const size = 48 * (s.s ?? 1); return `<g transform="translate(${s.x * 64 - size / 2} ${s.y * 64 - size / 2}) scale(${(s.s ?? 1).toFixed(2)})">${propSVG(s.kind, m.palette).replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/<title>.*?<\/title>/, '')}</g>`; }).join('');
  const dots = Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 197) % 1280}" cy="${(i * 113) % 768}" r="3" fill="${m.palette.ground2}"/>`).join('');
  const [ex, ey] = p.pts[p.pts.length - 1]!;
  const board = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 768" width="1280" height="768" role="img"><title>${m.title} board</title><rect width="1280" height="768" fill="${m.palette.ground}"/>${dots}<path d="${d}" fill="none" stroke="${m.palette.laneEdge}" stroke-width="74" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${m.palette.lane}" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/>${props}${pads}<g transform="translate(${ex * S - 40} ${ey * S - 52}) scale(1.25)">${coreSVG().replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/<title>.*?<\/title>/, '')}</g></svg>`;
  put(`map_${id}_board.svg`, board);
}
const sheet = `<!doctype html><meta charset="utf-8"><title>Tower Defense art kit</title><style>body{font-family:system-ui;background:${PAL.paper};color:${INK};margin:24px}h2{margin:24px 0 8px}div.g{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;background:#fff;border:3px solid ${INK};border-radius:5px;padding:8px;text-align:center;font-size:11px}img{display:block;margin:auto}img.b{width:420px}</style>
<h1>Tower Defense — original vector kit (${files.length} files)</h1>
${['tower_', 'enemy_', 'boss_', 'role_', 'kind_', 'core', 'map_'].map((pre) => `<h2>${pre.replace('_', '')}</h2><div class="g">${files.filter((f) => f.startsWith(pre)).map((f) => `<figure><img ${pre === 'map_' ? 'class="b"' : ''} src="${f}" alt="${f}"><figcaption>${f.replace('.svg', '')}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(join(out, 'index.html'), sheet);
console.log(`wrote ${files.length} svg files + index.html to public/quiz/td`);
