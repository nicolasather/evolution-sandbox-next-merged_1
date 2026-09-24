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

/** In historical order — stone to smartphone. Lifetimes shorten as the tunnel speeds up. */
export const TUNNEL_OBJECTS: TunnelObject[] = [
  { id: 'stone',          at: 0.04, life: 900, size: 150, far: true, lite: true },
  { id: 'spear',          at: 0.13, life: 760, size: 170 },
  { id: 'fire',           at: 0.22, life: 640, size: 160, lite: true },
  { id: 'pottery',        at: 0.31, life: 560, size: 170 },
  { id: 'writing',        at: 0.40, life: 460, size: 150, far: true },
  { id: 'wheel',          at: 0.48, life: 420, size: 200, near: true, lite: true },
  { id: 'telescope',      at: 0.57, life: 340, size: 170 },
  { id: 'steam_engine',   at: 0.66, life: 320, size: 200, near: true, lite: true },
  { id: 'electric_light', at: 0.75, life: 240, size: 160, far: true },
  { id: 'telephone',      at: 0.82, life: 200, size: 160 },
  { id: 'computer',       at: 0.88, life: 190, size: 210, near: true, lite: true },
  { id: 'smartphone',     at: 0.94, life: 160, size: 190, lite: true },
];

export interface Sprite { canvas: HTMLCanvasElement; name: string }

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
  nodes: (GlyphNode & { n: string; hidden?: true })[],
): Promise<Map<string, Sprite>> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out = new Map<string, Sprite>();
  await Promise.all(TUNNEL_OBJECTS.map(async o => {
    const n = byId.get(o.id);
    if (!n || n.hidden) return;
    const canvas = await rasterise(n);
    if (canvas) out.set(o.id, { canvas, name: n.n });
  }));
  return out;
}
