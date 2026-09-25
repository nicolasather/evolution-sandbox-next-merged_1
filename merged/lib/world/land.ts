/* ============================================================================
   LAND — the globe's land texture, and the dotted version of it.

   /world/land-sdf.png is a signed distance to the coastline (see
   scripts/world/build_land_mask.py): 128 on the coast, brighter inland,
   darker at sea. It is served from our own origin, which the site's
   content-security policy requires, and is fetched once, on first use.
   ========================================================================== */

export const LAND_URL = '/world/land-sdf.png';
/** The ±degrees the texture's 0–255 ramp covers around the coast. Must match the generator. */
export const SDF_RANGE_DEG = 6;

let pending: Promise<HTMLImageElement | null> | null = null;

/** Fetch the land texture once. Resolves to null if it cannot be loaded — the globe then draws without land. */
export function loadLand(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return Promise.resolve(null);
  if (!pending) {
    pending = new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => { pending = null; resolve(null); };   // a later moment may try again
      img.src = LAND_URL;
    });
  }
  return pending;
}

/** Warm the cache when the browser is idle, so the first reveal does not wait for the file. */
export function preloadLand(): void {
  if (typeof window === 'undefined') return;
  const go = () => { void loadLand(); };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(go, { timeout: 4000 }); else window.setTimeout(go, 1500);
}

export interface LandDots {
  /** Unit vectors, x y z interleaved. */
  xyz: Float32Array;
  count: number;
}

const cache = new Map<number, LandDots>();

/**
 * A lattice of points on land, for the dotted (no-WebGL) globe. Read from the
 * texture through a scratch canvas; returns null where a 2D context or the
 * image is not available.
 */
export function landDots(img: HTMLImageElement | null, spacingDeg: number): LandDots | null {
  if (!img || typeof document === 'undefined') return null;
  const hit = cache.get(spacingDeg);
  if (hit) return hit;
  let data: Uint8ClampedArray;
  // the texture is 4096 wide; a lattice of dots needs a quarter of that, and reading it all back would cost 33 MB
  const w = 1024, h = 512;
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    data = ctx.getImageData(0, 0, w, h).data;
  } catch { return null; }
  const out: number[] = [];
  const D2R = Math.PI / 180;
  for (let lat = -84 + spacingDeg / 2; lat < 90; lat += spacingDeg) {
    // fewer dots per row toward the poles keeps the density even on the sphere
    const c = Math.cos(lat * D2R);
    const step = spacingDeg / Math.max(0.12, c);
    for (let lon = -180; lon < 180; lon += step) {
      const px = Math.min(w - 1, Math.floor(((lon + 180) / 360) * w));
      const py = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h));
      if (data[(py * w + px) * 4] < 128) continue;
      const p = lat * D2R, l = lon * D2R;
      out.push(c * Math.sin(l), Math.sin(p), c * Math.cos(l));
    }
  }
  const dots = { xyz: new Float32Array(out), count: out.length / 3 };
  cache.set(spacingDeg, dots);
  return dots;
}
