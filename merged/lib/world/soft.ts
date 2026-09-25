import { distFor, TAN_HALF, viewAxes, clamp, type Camera, type Viewport } from './geo';

/* ============================================================================
   SOFT GLOBE — the Earth without WebGL.

   The same maths as the shader, done on the CPU at a fraction of the
   resolution: for each pixel of a small buffer, find where its ray meets the
   sphere, read the land distance field there, and shade ocean, land and coast.
   The buffer is then scaled up over the screen, so coastlines come out soft
   rather than sharp — plenty for a fallback, and it needs nothing but a 2D
   canvas. About 10⁵ pixels a frame.
   ========================================================================== */

/** The land distance field, read back to a small array (128 = coast, above = inland). */
export interface SdfData { data: Uint8Array; w: number; h: number }

const SDF_W = 1024, SDF_H = 512;
let cached: SdfData | null = null;

/** Read the texture back at a quarter of its size. Null where a 2D canvas is not available. */
export function sdfFromImage(img: HTMLImageElement | null): SdfData | null {
  if (cached) return cached;
  if (!img || typeof document === 'undefined') return null;
  try {
    const c = document.createElement('canvas');
    c.width = SDF_W; c.height = SDF_H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SDF_W, SDF_H);
    const rgba = ctx.getImageData(0, 0, SDF_W, SDF_H).data;
    const data = new Uint8Array(SDF_W * SDF_H);
    for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
    cached = { data, w: SDF_W, h: SDF_H };
    return cached;
  } catch { return null; }
}

export class SoftGlobe {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;

  /**
   * Draw the globe into the internal buffer and return it (transparent outside the disc), or null when
   * there is no 2D canvas to draw on. `cell` is how many screen pixels one buffer pixel covers.
   */
  render(vp: Viewport, cam: Camera, sdf: SdfData | null, cell: number, lift: number, tint: [number, number, number]): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const bw = Math.max(24, Math.ceil(vp.w / cell)), bh = Math.max(24, Math.ceil(vp.h / cell));
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }
    const ctx = this.ctx;
    if (!ctx) return null;
    if (this.canvas!.width !== bw || this.canvas!.height !== bh || !this.image) {
      this.canvas!.width = bw; this.canvas!.height = bh;
      this.image = ctx.createImageData(bw, bh);
    }
    const px = this.image.data;
    const { right, up, fwd } = viewAxes(cam.lat, cam.lon);
    const dist = distFor(cam.zoom, vp);
    const aspect = vp.w / vp.h;
    const shift2 = 2 * (cam.shift ?? 0);
    const c2 = dist * dist - 1;
    // the sun, as in the shader
    const sx = -0.62, sy = 0.42, sz = 0.66, sl = Math.hypot(sx, sy, sz);
    const Sx = sx / sl, Sy = sy / sl, Sz = sz / sl;
    const TWO_PI = Math.PI * 2;
    const D = sdf?.data, W = sdf?.w ?? 0, H = sdf?.h ?? 0;
    const tr = tint[0] * 255, tg = tint[1] * 255, tb = tint[2] * 255;

    let o = 0;
    for (let y = 0; y < bh; y++) {
      const ndcY = 1 - ((y + 0.5) / bh) * 2;
      for (let x = 0; x < bw; x++, o += 4) {
        const ndcX = ((x + 0.5) / bw) * 2 - 1;
        // the ray, as in the shader: the camera sits on +z looking at the origin
        let dx = ndcX * TAN_HALF * aspect, dy = (ndcY - shift2) * TAN_HALF, dz = -1;
        const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
        const b = dist * dz;
        const disc = b * b - c2;
        if (disc <= 0) { px[o + 3] = 0; continue; }
        const t = -b - Math.sqrt(disc);
        const ix = dx * t, iy = dy * t, iz = dist + dz * t;            // on the unit sphere: also its normal
        const facing = clamp(-(ix * dx + iy * dy + iz * dz), 0, 1);
        const gx = right[0] * ix + up[0] * iy + fwd[0] * iz;
        const gy = right[1] * ix + up[1] * iy + fwd[1] * iz;
        const gz = right[2] * ix + up[2] * iy + fwd[2] * iz;
        const lat = Math.asin(clamp(gy, -1, 1)), lon = Math.atan2(gx, gz);
        let sd = 0;
        if (D) {
          const u = clamp(lon / TWO_PI + 0.5, 0, 0.99999), v = clamp(0.5 - lat / Math.PI, 0, 0.99999);
          sd = D[((v * H) | 0) * W + ((u * W) | 0)];
        }
        // land: a soft edge on the distance field
        const land = D ? clamp((sd - 128) / 5 + 0.5, 0, 1) : 0;
        const shelf = D ? clamp(1 - (128 - sd) / 22, 0, 1) * (1 - land) : 0;
        let r = 4 + 20 * shelf, g = 9 + 44 * shelf, bl = 20 + 56 * shelf;
        const inland = clamp((sd - 128) / 32, 0, 1);
        const lr = 52 - 30 * inland, lg = 58 - 30 * inland, lb = 57 - 26 * inland;
        r += (lr + tr * 0.22 * lift - r) * land;
        g += (lg + tg * 0.22 * lift - g) * land;
        bl += (lb + tb * 0.22 * lift - bl) * land;
        // sun side
        const ndl = ix * Sx + iy * Sy + iz * Sz;
        const lit = 0.3 + 0.95 * clamp((ndl + 0.25) / 1.1, 0, 1);
        r *= lit; g *= lit; bl *= lit;
        // the coastline, a thin cool line (warm when an era is lit)
        const coast = Math.exp(-(((sd - 128) / 4) ** 2)) * 0.28;
        r += (70 + tr * 0.4 * lift) * coast; g += (118 + tg * 0.3 * lift) * coast; bl += (148 + tb * 0.2 * lift) * coast;
        // the atmosphere, seen edge-on
        const rim = clamp(Math.pow(1 - facing, 3) * 0.9, 0, 0.85);
        r += (58 - r) * rim * 0.75; g += (110 - g) * rim * 0.75; bl += (205 - bl) * rim * 0.75;
        px[o] = r > 255 ? 255 : r; px[o + 1] = g > 255 ? 255 : g; px[o + 2] = bl > 255 ? 255 : bl; px[o + 3] = 255;
      }
    }
    ctx.putImageData(this.image, 0, 0);
    return this.canvas;
  }
}
