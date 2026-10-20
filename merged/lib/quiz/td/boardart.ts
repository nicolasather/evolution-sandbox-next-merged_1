/** The whole static battlefield as ONE original SVG (1280×768, 64 px per tile): storybook ground, a textured lane, a framed edge of props, the spawn
 *  gate and the core fort. The game draws this exact string (components/quiz/td/sprites.ts → boardImg) under towers and enemies, and
 *  tools/td-art/build.ts writes it to public/quiz/td/map_<id>_board.svg, so the picture on the cards is the picture in the match.
 *  Decoration is deterministic (seeded by the map id), keeps off the lane and off every build pad, and stays mostly at the edges so the combat
 *  space stays readable. No gradients, no external references. */
import { coreSVG, INK, PAL, propSVG, spawnSVG } from './art';
import { MAPS, mapPath, padCenter } from './maps';
import type { TDMapId } from './domain';

const S = 64 / 1000;
const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const inner = (s: string) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<title>.*?<\/title>/, '');

/** Per-map flavour of the loose ground decoration. */
const FLAVOUR: Record<TDMapId, { tufts: string; dots: string[]; dotR: number; edge: 'bush' | 'rock' | 'cloud'; edgeColor: string; lanePebble: string }> = {
  meadow_circuit: { tufts: '#5FA676', dots: [PAL.candy, PAL.sun, PAL.white, PAL.sky], dotR: 3.4, edge: 'bush', edgeColor: '#6FB98A', lanePebble: '#D8C39A' },
  coral_quarry: { tufts: '#B98A6C', dots: ['#C99A7E', '#B58060', PAL.stone, '#F6D9B8'], dotR: 4.2, edge: 'rock', edgeColor: '#D49A80', lanePebble: '#E5C696' },
  skyworks: { tufts: '#7FA6BF', dots: [PAL.white, PAL.sun, '#D8EEF8', PAL.candy], dotR: 3, edge: 'cloud', edgeColor: '#FFFFFF', lanePebble: '#E8D49A' },
};

export function boardSVG(id: TDMapId): string {
  const m = MAPS[id]; const p = mapPath(id); const f = FLAVOUR[id]; const rnd = mulberry(hash(id));
  const pts = p.pts.map(([x, y]) => [x * S, y * S] as [number, number]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const padPx = m.pads.map((pd) => { const [cx, cy] = padCenter(pd); return [cx * S, cy * S] as [number, number]; });
  const distLane = (x: number, y: number) => { let best = 1e9; for (let i = 0; i < pts.length; i += 2) { const q = pts[i]!; const dd = Math.hypot(q[0] - x, q[1] - y); if (dd < best) best = dd; } return best; };
  const clear = (x: number, y: number, laneR = 66, padR = 44) => distLane(x, y) > laneR && padPx.every(([px, py]) => Math.hypot(px - x, py - y) > padR) && m.scenery.every((s) => Math.hypot(s.x * 64 - x, s.y * 64 - y) > 34 * (s.s ?? 1));
  const out: string[] = [];
  out.push(`<rect width="1280" height="768" fill="${m.palette.ground}"/>`);
  // soft ground patches (flat, two tones) so the field is not one flat colour
  for (let i = 0; i < 26; i++) { const x = rnd() * 1280, y = rnd() * 768, rx = 60 + rnd() * 120; out.push(`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${(rx * 0.55).toFixed(0)}" fill="${m.palette.ground2}" opacity="0.55"/>`); }
  // grass tufts / pebbles / sparkles in clear ground
  for (let i = 0, placed = 0; i < 700 && placed < 150; i++) {
    const x = 20 + rnd() * 1240, y = 20 + rnd() * 728; if (!clear(x, y)) continue; placed++;
    if (id === 'skyworks') out.push(`<path d="M${(x - 5).toFixed(0)} ${y.toFixed(0)} h10 M${x.toFixed(0)} ${(y - 5).toFixed(0)} v10" stroke="${f.dots[placed % f.dots.length]}" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>`);
    else if (id === 'coral_quarry') out.push(placed % 3 === 0 ? `<path d="M${(x - 8).toFixed(0)} ${(y + 4).toFixed(0)} l5 -9 l6 5 l5 -4 l3 8 z" fill="${f.dots[placed % 4]}" opacity="0.8"/>` : `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${f.dotR}" ry="${(f.dotR * 0.7).toFixed(1)}" fill="${f.dots[placed % 4]}" opacity="0.8"/>`);
    else out.push(placed % 4 === 0 ? `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><circle r="${f.dotR}" fill="${f.dots[placed % 4]}" stroke="${INK}" stroke-width="1.2" stroke-opacity="0.5"/><circle r="1.2" fill="${PAL.sun}"/></g>` : `<path d="M${(x - 5).toFixed(0)} ${(y + 4).toFixed(0)} q2 -9 5 0 m0 0 q2 -11 5 0" fill="none" stroke="${f.tufts}" stroke-width="2.4" stroke-linecap="round"/>`);
  }
  // lane: dark rim, light road, pebbles/rivets along the edges, soft centre dashes
  out.push(`<path d="${d}" fill="none" stroke="${m.palette.laneEdge}" stroke-width="78" stroke-linecap="round" stroke-linejoin="round"/>`);
  out.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="74" stroke-linecap="round" stroke-linejoin="round"/>`);
  out.push(`<path d="${d}" fill="none" stroke="${m.palette.lane}" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>`);
  for (let i = 3; i < pts.length - 1; i += 3) {
    const a = pts[i - 1]!, b = pts[i + 1]!; const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; const nx = -dy / len, ny = dx / len;
    for (const side of [-1, 1]) { const off = side * (24 + rnd() * 4); const x = pts[i]![0] + nx * off, y = pts[i]![1] + ny * off; out.push(id === 'skyworks' ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${INK}" opacity="0.45"/>` : `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3 + rnd() * 2.4).toFixed(1)}" ry="2.6" fill="${f.lanePebble}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1"/>`); }
  }
  out.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-opacity="0.13" stroke-width="4" stroke-dasharray="10 26" stroke-linecap="round" stroke-linejoin="round"/>`);
  // framed edge: a ring of bushes / rocks / clouds around the field, skipping the lane
  const edge = propSVG(f.edge, m.palette); const edgeInner = inner(edge);
  const ring: [number, number, number][] = [];
  for (let x = 24; x <= 1256; x += 52 + rnd() * 20) { ring.push([x, 10 + rnd() * 8, 0.9 + rnd() * 0.4]); ring.push([x + 20, 758 - rnd() * 8, 0.9 + rnd() * 0.4]); }
  for (let y = 60; y <= 708; y += 56 + rnd() * 20) { ring.push([8 + rnd() * 6, y, 0.9 + rnd() * 0.4]); ring.push([1272 - rnd() * 6, y, 0.9 + rnd() * 0.4]); }
  for (const [x, y, sc] of ring) { if (distLane(x, y) < 70) continue; if (m.scenery.some((s) => Math.hypot(s.x * 64 - x, s.y * 64 - y) < 30 * (s.s ?? 1))) continue; const size = 48 * sc * 0.9; out.push(`<g transform="translate(${(x - size / 2).toFixed(0)} ${(y - size / 2).toFixed(0)}) scale(${(sc * 0.9).toFixed(2)})" opacity="0.96">${edgeInner}</g>`); }
  // scenery props authored per map (bridges sit ON the lane on purpose)
  for (const s of m.scenery) { const sc = s.s ?? 1; const size = 48 * sc; out.push(`<g transform="translate(${(s.x * 64 - size / 2).toFixed(1)} ${(s.y * 64 - size / 2).toFixed(1)}) scale(${sc.toFixed(2)})">${inner(propSVG(s.kind, m.palette))}</g>`); }
  // spawn gate and core fort: the two landmarks
  const [sx, sy] = pts[0]!; const [ex, ey] = pts[pts.length - 1]!;
  out.push(`<g transform="translate(${(Math.max(0, sx) - 4).toFixed(0)} ${(sy - 64).toFixed(0)}) scale(1.35)">${inner(spawnSVG())}</g>`);
  out.push(`<g transform="translate(${(ex - 56).toFixed(0)} ${(ey - 92).toFixed(0)}) scale(1.75)">${inner(coreSVG())}</g>`);
  // a thin inner frame so the board reads as a game table
  out.push(`<rect x="4" y="4" width="1272" height="760" rx="14" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="6"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 768" width="1280" height="768" role="img"><title>${m.title} board</title>${out.join('')}</svg>`;
}
