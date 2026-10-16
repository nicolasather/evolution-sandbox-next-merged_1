// Validates the retention content: every catalogue entry has real, finished, static art and the contracts hold.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const J = f => JSON.parse(readFileSync(join(root, 'data/retention', f), 'utf8'));
const errors = [];
const err = m => errors.push(m);
const svgs = dir => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)) : []);
const read = (dir, id) => readFileSync(join(root, dir, id + '.svg'), 'utf8');
const strokes = s => (s.match(/[Mm]\s*-?\d|<(?:circle|ellipse|rect|line|polyline|polygon)\b/g) || []).length;
const layers = s => (s.match(/data-z="/g) || []).length;

function common(file, s) {
  if (!/^<svg [^>]*viewBox="0 0 100 100"/.test(s)) err(`${file}: viewBox must be 0 0 100 100`);
  if (!/fill="none"/.test(s.split('>')[0]) || !/stroke="currentColor"/.test(s.split('>')[0])) err(`${file}: root must be fill=none stroke=currentColor`);
  if (/gradient|filter=|<image|<text|<script|<style|<foreignObject|\son\w+=|href=/i.test(s)) err(`${file}: forbidden element/attribute`);
  if (/stroke="#|stroke="rgb|fill="#|fill="rgb|fill="(?!none)/i.test(s)) err(`${file}: only currentColor strokes (fill none) are allowed`);
  if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(s)) err(`${file}: emoji not allowed`);
  if (!/data-z="/.test(s)) err(`${file}: needs data-z layers`);
}
function group(dir, ids, { min, max, lmin, lmax, label }) {
  const have = new Set(svgs(dir));
  for (const id of ids) if (!have.has(id)) err(`${label}: missing ${dir}/${id}.svg`);
  for (const id of have) if (!ids.includes(id)) err(`${label}: unexpected ${dir}/${id}.svg`);
  const seen = new Map();
  for (const id of ids) {
    if (!have.has(id)) continue;
    const s = read(dir, id), f = `${dir}/${id}.svg`;
    common(f, s);
    const n = strokes(s), l = layers(s);
    if (min != null && n < min) err(`${f}: ${n} strokes < ${min}`);
    if (max != null && n > max) err(`${f}: ${n} strokes > ${max}`);
    if (lmin != null && (l < lmin || l > lmax)) err(`${f}: ${l} layers not in ${lmin}-${lmax}`);
    const body = s.replace(/aria-label="[^"]*"/, '');
    if (seen.has(body)) err(`${f}: identical to ${seen.get(body)}`); else seen.set(body, f);
  }
  return have.size;
}
const counts = {};
const npcIds = J('npc-roster.json').map(n => n.id);
const specIds = J('character-art-specs.json').map(n => n.id);
if (JSON.stringify([...npcIds].sort()) !== JSON.stringify([...specIds].sort())) err('npc-roster and character-art-specs ids differ');
counts.npc = group('data/retention/characters/npc', npcIds, { min: 60, max: 110, lmin: 3, lmax: 6, label: 'npc' });
counts.companion = group('data/retention/characters/companion', ['idle', 'curious', 'delighted', 'baffled', 'worried', 'nudge', 'awe', 'easter'], { min: 12, lmin: 3, lmax: 6, label: 'companion' });
counts.stickers = group('data/retention/characters/stickers', J('vibe-stickers.json').map(s => s.id), { min: 12, max: 40, label: 'sticker' });
// 42 additive scenes (3 per era), drawn by hand as layered 1600x900 line art; distinct from each other
{
  const extra = J('scenes-extra.json'), dir = 'data/retention/scenes', have = new Set(svgs(dir)), seen = new Map();
  const eras = {};
  for (const sc of extra) {
    eras[sc.eras[0]] = (eras[sc.eras[0]] || 0) + 1;
    if (!have.has(sc.id)) { err(`scene: missing ${dir}/${sc.id}.svg`); continue; }
    const s = read(dir, sc.id), f = `${dir}/${sc.id}.svg`;
    if (!/viewBox="0 0 1600 900"/.test(s)) err(`${f}: viewBox must be 0 0 1600 900`);
    if (/gradient|filter=|<image|<text|<script|<style|<foreignObject|\son\w+=|href=|#[0-9a-f]{3,6}\b/i.test(s)) err(`${f}: forbidden content`);
    if ((s.match(/data-depth=/g) || []).length < 4) err(`${f}: needs at least 4 depth layers`);
    if (strokes(s) < 60) err(`${f}: too few strokes`);
    if (s.length < 4000) err(`${f}: too sparse`);
    const sig = s.replace(/aria-label="[^"]*"/, '');
    if (seen.has(sig)) err(`${f}: identical to ${seen.get(sig)}`); else seen.set(sig, f);
  }
  for (const [e, n] of Object.entries(eras)) if (n !== 3) err(`scenes: era ${e} has ${n} scenes, need 3`);
  if (Object.keys(eras).length !== 14) err(`scenes: ${Object.keys(eras).length} eras covered, need 14`);
  counts.scenes = have.size;
}
const shop = J('cosmetic-shop.json');
const by = c => shop.filter(x => x.category === c).map(x => x.id);
for (const [cat, dir] of [['icon', 'icons'], ['skin', 'skins'], ['decoration', 'decoration'], ['theme', 'themes']])
  counts[cat] = group(`data/retention/cosmetics/${dir}`, by(cat), { min: 4, label: cat });
if (by('effect').length !== 30) err('shop must hold 30 effects');
for (const c of ['icon', 'effect', 'skin', 'decoration', 'theme']) if (by(c).length !== 30) err(`shop ${c}: ${by(c).length} != 30`);
if (J('craft-fx-presets.json').length !== 48) err('48 craft success effects required');
if (J('failure-effects.json').length < 32) err('32 failure effects required');
if (J('easter-eggs.json').length !== 50) err('50 easter eggs required');
if (J('achievements.json').length < 60) err('>=60 achievements required');
if (J('scenes-extra.json').length !== 42) err('42 extra scenes required');
if (J('global-events.json').length < 14) err('>=14 events required');
if (J('daily-microgames.json').length !== 30) err('30 daily objectives required');
if (J('vibe-stickers.json').length !== 36) err('36 stickers required');
if (errors.length) { console.error('retention validation FAILED\n' + errors.map(e => ' - ' + e).join('\n')); process.exit(1); }
console.log('retention validation OK', JSON.stringify(counts));
