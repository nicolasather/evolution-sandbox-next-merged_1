'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadLand, landDots } from '@/lib/world/land';

/* ============================================================================
   WORLD MAP — a flat, dotted Earth with a mark for every major invention
   found. Land comes from the same distance-field texture as the globe, read
   as a lattice of dots. Decorative for assistive technology: the caller
   supplies a text alternative and the real list sits next to it.
   ========================================================================== */

export interface MapPoint { id: string; lat: number; lon: number; name?: string }

const LAT_TOP = 84, LAT_BOTTOM = -58;         // Antarctica and the far Arctic add nothing here
const SPACING = 2.4;

/** Land dots as [lon, lat] pairs, converted once from the globe's unit-vector lattice. */
let landLL: Float32Array | null = null;
function landPairs(img: HTMLImageElement): Float32Array | null {
  if (landLL) return landLL;
  const d = landDots(img, SPACING);
  if (!d) return null;
  const out = new Float32Array(d.count * 2);
  for (let i = 0; i < d.count; i++) {
    const x = d.xyz[i * 3], y = d.xyz[i * 3 + 1], z = d.xyz[i * 3 + 2];
    out[i * 2] = Math.atan2(x, z) * 180 / Math.PI;
    out[i * 2 + 1] = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
  }
  landLL = out;
  return out;
}

export function WorldMap({ points, latest, label, className }: { points: readonly MapPoint[]; latest?: string | null; label: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [width, setWidth] = useState(0);
  const key = useMemo(() => points.map(p => p.id).join('|'), [points]);

  useEffect(() => {
    let live = true;
    void loadLand().then(i => { if (live) setImg(i); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const measure = () => setWidth(c.parentElement?.clientWidth ?? c.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    if (c.parentElement) ro.observe(c.parentElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || width < 40) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const h = Math.round(width * (LAT_TOP - LAT_BOTTOM) / 360);
    c.width = Math.round(width * dpr); c.height = Math.round(h * dpr);
    c.style.width = `${width}px`; c.style.height = `${h}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    const cs = getComputedStyle(c);
    const ink = cs.color || '#999';
    const pin = cs.getPropertyValue('--pin').trim() || '#e2a35e';
    const X = (lon: number) => ((lon + 180) / 360) * width;
    const Y = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * h;

    // faint graticule
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.10; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = -150; lon <= 150; lon += 30) { ctx.moveTo(X(lon), 0); ctx.lineTo(X(lon), h); }
    for (let lat = -30; lat <= 60; lat += 30) { ctx.moveTo(0, Y(lat)); ctx.lineTo(width, Y(lat)); }
    ctx.stroke();

    // land
    const pairs = img ? landPairs(img) : null;
    if (pairs) {
      const d = Math.max(1.1, width / 360 * SPACING * 0.42);
      ctx.fillStyle = ink; ctx.globalAlpha = 0.34;
      for (let i = 0; i < pairs.length; i += 2) {
        const lat = pairs[i + 1];
        if (lat > LAT_TOP || lat < LAT_BOTTOM) continue;
        ctx.fillRect(X(pairs[i]) - d / 2, Y(lat) - d / 2, d, d);
      }
    }

    // the marks
    ctx.globalAlpha = 1;
    for (const p of points) {
      const x = X(p.lon), y = Y(p.lat);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, pin); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = p.id === latest ? 0.85 : 0.45;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pin; ctx.beginPath(); ctx.arc(x, y, p.id === latest ? 2.6 : 1.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `points`
  }, [width, img, key, latest]);

  return <canvas ref={ref} className={className ?? 'wm'} role="img" aria-label={label} />;
}
