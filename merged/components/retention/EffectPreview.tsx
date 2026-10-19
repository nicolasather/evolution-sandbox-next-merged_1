'use client';
import { useEffect, useRef } from 'react';
import { Fx, readPalette } from '@/lib/craft/fx';
import { SIGNATURES } from '@/lib/retention/finish';
import { useReducedMotion } from './hooks';

/** The REAL flourish the Workbench plays for this effect, on its own small canvas. `still` draws one frozen frame
 *  (for list thumbnails); otherwise it loops every couple of seconds, and holds a single frame under reduced motion. */
export function EffectPreview({ id, w = 220, h = 120, still = false, scale = 1.3 }: { id: string; w?: number; h?: number; still?: boolean; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const c = ref.current, play = SIGNATURES[id];
    if (!c || !play) return;
    const g = c.getContext('2d'); if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    const fx = new Fx(readPalette());
    const frame = () => { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); fx.draw(g, w, h); };
    const shot = () => { fx.reduced = false; play(fx, w / 2, h / 2, scale); };
    if (still || reduced) { shot(); fx.update(still ? 0.2 : 0.22); frame(); return; }
    let raf = 0, last = performance.now(), next = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (t >= next) { shot(); next = t + 2200; }
      fx.update(dt); frame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, w, h, still, scale, reduced]);
  return <canvas ref={ref} className="reff" style={{ width: w, height: h }} aria-label="Effect preview" role="img" />;
}
