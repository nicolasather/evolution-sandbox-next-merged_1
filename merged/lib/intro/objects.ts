/* ============================================================================
   TUNNEL OBJECTS — what flies past the camera during the time-tunnel.

   Every object is a REAL discovery already in the game, drawn with its own
   engraved plate (data/art.json) so the intro speaks the same visual language
   as the rest of the interface. Only entries that are not hidden are used, so
   the cinematic never spoils a hidden find. Nothing here invents history: if
   an id is missing from the database it is simply skipped.
   ========================================================================== */

import { svg, type GlyphNode } from '../glyphs';

export interface TunnelObject {
  id: string;
  /** Fraction of the tunnel at which the object appears (0–1). */
  at: number;
  /** How long it is on screen, in ms, at the full-length tunnel. */
  life: number;
  /** Base sprite size in CSS px. */
  size: number;
  /** Passes extremely close to the camera: grows very large, leaves the frame. */
  near?: boolean;
  /** Stays far away: small and dim. */
  far?: boolean;
  /** Only part of the shorter mobile tunnel. */
  lite?: boolean;
}

/** In historical order — stone tools, pottery, the wheel, metal, machines, then the modern world.
 *  Only real, non-hidden discoveries; anything missing from the database is skipped. */
export const TUNNEL_OBJECTS: TunnelObject[] = [
  { id: 'handaxe',        at: 0.03, life: 1100, size: 150, far: true, lite: true },
  { id: 'microblade',     at: 0.12, life: 800,  size: 150 },
  { id: 'pottery',        at: 0.21, life: 700,  size: 170, lite: true },
  { id: 'wheel',          at: 0.31, life: 560,  size: 200, near: true, lite: true },
  { id: 'bronze_tools',   at: 0.40, life: 460,  size: 160, far: true },
  { id: 'steam_engine',   at: 0.50, life: 400,  size: 200, near: true, lite: true },
  { id: 'locomotive',     at: 0.60, life: 340,  size: 180 },
  { id: 'electric_light', at: 0.70, life: 290,  size: 160, far: true },
  { id: 'telephone',      at: 0.78, life: 250,  size: 160 },
  { id: 'computer',       at: 0.86, life: 220,  size: 210, near: true, lite: true },
  { id: 'smartphone',     at: 0.93, life: 200,  size: 190, lite: true },
];

export interface Sprite { canvas: HTMLCanvasElement; name: string; /** A short, real date from the database, or ''. */ date: string }

/** "≈ 1.7 million years ago onward" → "≈ 1.7 million years ago"; unsourced or contested dates give ''. */
export function shortDate(raw: string | undefined): string {
  if (!raw || /not yet sourced|contested/i.test(raw)) return '';
  const cut = raw.split(/[;(]/)[0].replace(/\s+onward.*$/i, '').replace(/\s+at scale.*$/i, '').trim();
  return cut.length <= 30 ? cut : '';
}

const SPRITE_PX = 192;
const STROKE = '#e6e1d8';

/** Render one plate to an offscreen canvas in the intro's bone colour. */
function rasterise(node: GlyphNode): Promise<HTMLCanvasElement | null> {
  return new Promise(resolve => {
    try {
      const markup = svg(node, { sw: 2.4 })
        .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${SPRITE_PX}" height="${SPRITE_PX}" `)
        .replace(/currentColor/g, STROKE);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = SPRITE_PX;
        const g = cv.getContext('2d');
        if (!g) { resolve(null); return; }
        g.drawImage(img, 0, 0, SPRITE_PX, SPRITE_PX);
        resolve(cv);
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    } catch { resolve(null); }
  });
}

/**
 * Rasterise the plates for every tunnel object the database knows.
 * `nodes` is the discovery list; hidden entries are refused even if named above.
 */
export async function loadTunnelSprites(
  nodes: (GlyphNode & { n: string; date?: string; hidden?: true })[],
): Promise<Map<string, Sprite>> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out = new Map<string, Sprite>();
  await Promise.all(TUNNEL_OBJECTS.map(async o => {
    const n = byId.get(o.id);
    if (!n || n.hidden) return;
    const canvas = await rasterise(n);
    if (canvas) out.set(o.id, { canvas, name: n.n, date: shortDate(n.date) });
  }));
  return out;
}
