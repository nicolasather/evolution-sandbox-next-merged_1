'use client';

import { useEffect, useRef, useState } from 'react';
import { loadLand, landDots } from '@/lib/world/land';
import { slerp, toLatLon, toVec } from '@/lib/world/geo';

/* ============================================================================
   GLOBE CANVAS — the Museum's world-history globe: an orthographic, dotted
   Earth on a 2D canvas (the same land texture as Main Evolution's globe),
   drawn without WebGL so it can live inside a plaque as well as fill a room.

   Draggable, slowly turning when idle, and able to fly to a place. Points are
   exhibits (or regions); arcs are knowledge moving between places.
   ========================================================================== */

export interface GlobePoint {
  id: string;
  lat: number;
  lon: number;
  /** 0 supporting … 3 defining. */
  weight: number;
  /** CSS colour. */
  color?: string;
  /** Drawn as an open ring (independent origin) rather than a filled mark. */
  ring?: boolean;
  highlight?: boolean;
  /** 0–1 fade (e.g. newly reached). */
  alpha?: number;
}

export interface GlobeArc { from: { lat: number; lon: number }; to: { lat: number; lon: number }; alpha: number; kind: 'spread' | 'influence' }

const D2R = Math.PI / 180;

let landLL: Float32Array | null = null;
function landPairs(img: HTMLImageElement): Float32Array | null {
  if (landLL) return landLL;
  const d = landDots(img, 2.2);
  if (!d) return null;
  const out = new Float32Array(d.count * 2);
  for (let i = 0; i < d.count; i++) {
    const x = d.xyz[i * 3], y = d.xyz[i * 3 + 1], z = d.xyz[i * 3 + 2];
    out[i * 2] = Math.atan2(x, z) / D2R;
    out[i * 2 + 1] = Math.asin(Math.max(-1, Math.min(1, y))) / D2R;
  }
  landLL = out;
  return out;
}

export function GlobeCanvas({
  points, arcs = [], focus, onPick, autoRotate = true, className, label, interactive = true, tilt = 18,
}: {
  points: readonly GlobePoint[];
  arcs?: readonly GlobeArc[];
  /** Fly here when it changes. */
  focus?: { lat: number; lon: number; key: string } | null;
  onPick?: (id: string) => void;
  autoRotate?: boolean;
  className?: string;
  label: string;
  interactive?: boolean;
  tilt?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const cam = useRef({ lat: tilt, lon: 20, tLat: tilt, tLon: 20, drag: false, lastX: 0, lastY: 0, idleAt: 0, fly: 0 });
  const data = useRef({ points, arcs });
  const pickRef = useRef(onPick);
  useEffect(() => { data.current = { points, arcs }; pickRef.current = onPick; });
  const projected = useRef<{ id: string; x: number; y: number; r: number }[]>([]);

  useEffect(() => {
    let live = true;
    void loadLand().then(i => { if (live) setImg(i); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!focus) return;
    const c = cam.current;
    c.tLat = Math.max(-50, Math.min(60, focus.lat));
    c.tLon = focus.lon;
    c.fly = 1;
    c.idleAt = performance.now() + 9000;
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = Math.max(40, r.width); h = Math.max(40, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    const pairs = img ? landPairs(img) : null;

    const draw = (t: number) => {
      const c = cam.current;
      // camera easing: flights, then a slow idle drift
      if (!c.drag) {
        if (c.fly > 0) {
          let dl = ((c.tLon - c.lon + 540) % 360) - 180;
          c.lon += dl * 0.06; c.lat += (c.tLat - c.lat) * 0.06;
          if (Math.abs(dl) < 0.2 && Math.abs(c.tLat - c.lat) < 0.2) c.fly = 0;
          dl = 0;
        } else if (autoRotate && !reduced && t > c.idleAt) {
          c.lon += 0.035;
        }
      }
      const cs = getComputedStyle(canvas);
      const ink = cs.getPropertyValue('--globe-ink').trim() || '#e9e5dd';
      const accent = cs.getPropertyValue('--globe-accent').trim() || '#c4642c';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.44, cx = w / 2, cy = h / 2;
      const lat0 = c.lat * D2R, lon0 = c.lon * D2R;
      const sLat0 = Math.sin(lat0), cLat0 = Math.cos(lat0);
      const proj = (lat: number, lon: number, lift = 1) => {
        const la = lat * D2R, lo = lon * D2R - lon0;
        const cl = Math.cos(la);
        const x = cl * Math.sin(lo);
        const y = cLat0 * Math.sin(la) - sLat0 * cl * Math.cos(lo);
        const z = sLat0 * Math.sin(la) + cLat0 * cl * Math.cos(lo);
        return { x: cx + R * lift * x, y: cy - R * lift * y, z };
      };
      // sphere
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
      g.addColorStop(0, 'rgba(255,255,255,0.07)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.22; ctx.lineWidth = 1;
      ctx.stroke();
      // graticule
      ctx.globalAlpha = 0.07;
      ctx.beginPath();
      for (let lo = -180; lo < 180; lo += 30) {
        let pen = false;
        for (let la = -80; la <= 80; la += 5) {
          const p = proj(la, lo);
          if (p.z <= 0) { pen = false; continue; }
          if (!pen) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          pen = true;
        }
      }
      for (let la = -60; la <= 60; la += 30) {
        let pen = false;
        for (let lo = -180; lo <= 180; lo += 5) {
          const p = proj(la, lo);
          if (p.z <= 0) { pen = false; continue; }
          if (!pen) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          pen = true;
        }
      }
      ctx.stroke();
      // land
      if (pairs) {
        ctx.fillStyle = ink;
        const s = Math.max(1, R / 150);
        for (let i = 0; i < pairs.length; i += 2) {
          const p = proj(pairs[i + 1], pairs[i]);
          if (p.z <= 0.02) continue;
          ctx.globalAlpha = 0.12 + 0.28 * p.z;
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      // arcs
      ctx.lineWidth = 1.1;
      for (const a of data.current.arcs) {
        const va = toVec(a.from.lat, a.from.lon), vb = toVec(a.to.lat, a.to.lon);
        ctx.strokeStyle = a.kind === 'spread' ? accent : ink;
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i <= 28; i++) {
          const tt = i / 28;
          const ll = toLatLon(slerp(va, vb, tt));
          const p = proj(ll.lat, ll.lon, 1 + 0.12 * Math.sin(Math.PI * tt));
          if (p.z <= 0) { pen = false; continue; }
          if (!pen) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          pen = true;
        }
        ctx.globalAlpha = a.alpha * (a.kind === 'spread' ? 0.55 : 0.28);
        ctx.stroke();
      }
      // points
      const out: { id: string; x: number; y: number; r: number }[] = [];
      for (const pt of data.current.points) {
        const p = proj(pt.lat, pt.lon);
        if (p.z <= 0) continue;
        const r = (1.6 + pt.weight * 1.3) * (pt.highlight ? 1.6 : 1);
        const col = pt.color || accent;
        ctx.globalAlpha = (pt.alpha ?? 1) * (0.35 + 0.65 * p.z);
        if (pt.highlight || pt.weight >= 3) {
          const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
          hg.addColorStop(0, col); hg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = hg; ctx.globalAlpha *= 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = (pt.alpha ?? 1) * (0.35 + 0.65 * p.z);
        }
        if (pt.ring) {
          ctx.strokeStyle = col; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 1.5, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        }
        out.push({ id: pt.id, x: p.x, y: p.y, r: Math.max(8, r * 2) });
      }
      projected.current = out;
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [img, autoRotate]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !interactive) return;
    const c = cam.current;
    let moved = 0;
    const down = (e: PointerEvent) => {
      c.drag = true; c.fly = 0; c.lastX = e.clientX; c.lastY = e.clientY; moved = 0;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!c.drag) return;
      const dx = e.clientX - c.lastX, dy = e.clientY - c.lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      c.lon -= dx * 0.35; c.lat = Math.max(-70, Math.min(70, c.lat + dy * 0.3));
      c.lastX = e.clientX; c.lastY = e.clientY;
      c.idleAt = performance.now() + 6000;
    };
    const up = (e: PointerEvent) => {
      c.drag = false;
      if (moved < 5 && pickRef.current) {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        let best: { id: string; d: number } | null = null;
        for (const p of projected.current) {
          const d = Math.hypot(p.x - x, p.y - y);
          if (d <= p.r && (!best || d < best.d)) best = { id: p.id, d };
        }
        if (best) pickRef.current(best.id);
      }
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, [interactive]);

  return <canvas ref={ref} className={'globe-canvas' + (className ? ' ' + className : '')} role="img" aria-label={label} />;
}
