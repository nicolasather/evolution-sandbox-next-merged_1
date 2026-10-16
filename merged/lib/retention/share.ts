/* ============================================================================
   SHAREABLE DISCOVERY CARD (#16) — a card built from the player's real data and nothing else.

   Name, plate number, era, date, rarity, how far along the player is and how many ways they have found to make it all
   come from the Engine and the local save. A discovery with no recorded time says so ("before tracking began") rather
   than showing a made-up date. The card is plain SVG with explicit colours, so it renders the same everywhere, and is
   shared as a PNG file when the browser can, else downloaded. No account, no upload, no tracking.
   ========================================================================== */
import type { Engine } from '../engine';
import type { Discovery } from '../types';
import { svg as glyphSvg } from '../glyphs';
import { peekArt } from './art/loader';
import { retention } from './store';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const RARITY: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', hidden: 'Hidden find' };

export interface CardFacts {
  name: string; no: number; era: string; date: string; rarity: string; found: string; progress: string; routes: string; sources: string;
}

export function cardFacts(engine: Engine, node: Discovery): CardFacts {
  const st = engine.stats();
  const at = engine.whenFound(node.id);
  const r = engine.routeCount(node.id);
  return {
    name: node.n, no: node.no, era: engine.db.eras.find(e => e.id === node.era)?.name ?? node.era, date: node.date, rarity: RARITY[node.rar] ?? node.rar,
    found: at ? `Found ${new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}` : 'Found before tracking began',
    progress: `${st.core} of ${st.coreTotal} discoveries`, routes: r.found > 0 ? `${r.found} way${r.found === 1 ? '' : 's'} found to make it` : '',
    sources: node.src.includes('source_required') ? 'Sources: verification required' : 'Sources listed in the game',
  };
}

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export interface Palette { bg: string; ink: string; soft: string; accent: string }

/** The card, 1080×1350. The equipped icon, when there is one, is drawn in the corner from its own engraving. */
export function buildCardSvg(engine: Engine, node: Discovery, pal: Palette): string {
  const f = cardFacts(engine, node);
  const inner = (glyphSvg(node, { plate: true, sw: 1.8 }).match(/^<svg[^>]*>([\s\S]*)<\/svg>$/) ?? [])[1] ?? '';
  const iconId = retention.get().equipped.icon;
  const icon = iconId ? peekArt('icons', iconId) : undefined;
  const lines = wrap(f.name, 20);
  const size = lines.length > 1 ? 78 : 96;
  const title = lines.map((l, i) => `<text x="540" y="${790 + i * (size + 8)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" fill="${pal.ink}">${esc(l)}</text>`).join('');
  const base = 790 + (lines.length - 1) * (size + 8);
  const meta = (t: string, y: number, op = 1) => `<text x="540" y="${y}" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="26" letter-spacing="2" fill="${pal.soft}" opacity="${op}">${esc(t)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<rect width="1080" height="1350" fill="${pal.bg}"/>
<rect x="36" y="36" width="1008" height="1278" rx="6" fill="none" stroke="${pal.soft}" stroke-width="2" opacity=".55"/>
<rect x="56" y="56" width="968" height="1238" rx="4" fill="none" stroke="${pal.soft}" stroke-width="1" opacity=".3"/>
<text x="540" y="132" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="28" letter-spacing="9" fill="${pal.accent}">EVOLUTION SANDBOX</text>
<text x="540" y="180" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="24" letter-spacing="5" fill="${pal.soft}">PLATE № ${String(f.no).padStart(4, '0')}</text>
<g transform="translate(290 214) scale(5)" fill="none" stroke="${pal.ink}" stroke-linecap="round" stroke-linejoin="round" color="${pal.ink}">${inner}</g>
${title}
${meta(clip(`${f.era.toUpperCase()}  ·  ${f.date}`, 52), base + 70)}
${meta(f.rarity.toUpperCase(), base + 118, 0.9)}
<line x1="300" y1="${base + 160}" x2="780" y2="${base + 160}" stroke="${pal.accent}" stroke-width="2" opacity=".7"/>
${meta(f.found, base + 214)}
${meta(f.progress, base + 258)}
${f.routes ? meta(f.routes, base + 302, 0.9) : ''}
${meta(f.sources, base + (f.routes ? 346 : 302), 0.75)}
${icon ? `<g transform="translate(930 66) scale(.8)" fill="none" stroke="${pal.accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icon.b}</g>` : ''}
<text x="540" y="1262" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="20" letter-spacing="2" fill="${pal.soft}" opacity=".7">A personal progress card · made from this browser's own save</text>
</svg>`;
}

/** Colours read from the page's live theme, with safe fallbacks. */
export function livePalette(): Palette {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const v = (k: string, d: string) => (cs?.getPropertyValue(k).trim() || d);
  return { bg: v('--ink-1', '#111111'), ink: v('--bone', '#ece6d8'), soft: v('--bone-3', '#9b9484'), accent: v('--ochre', '#c8a14a') };
}

export function svgToPng(svg: string, w = 1080, h = 1350): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); if (!g) { URL.revokeObjectURL(url); reject(new Error('no canvas')); return; }
      g.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('no png'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg failed to load')); };
    img.src = url;
  });
}

/** Share the PNG where files can be shared; otherwise download it. Returns what happened. */
export async function shareCard(png: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([png], `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, { type: 'image/png' });
  try {
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Evolution Sandbox' });
      return 'shared';
    }
  } catch { return 'cancelled'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
