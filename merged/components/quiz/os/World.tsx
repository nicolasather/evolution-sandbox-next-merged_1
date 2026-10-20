'use client';
/** The course canvas. Draws one scene per animation frame from `getFrame()`; the DOM HUD and controls sit on top. When the tab is hidden it stops. */
import { useEffect, useRef } from 'react';
import { drawWorld } from './render';
import type { Frame } from './useOS';
import { TILE } from '@/lib/quiz/os/balance';

export default function World({ getFrame, mode = 'follow', reduced = false, lowFx = false, label, className = '' }: { getFrame: () => Frame | null; mode?: 'follow' | 'overview'; reduced?: boolean; lowFx?: boolean; label: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = box.current; const c = cv.current; if (!el || !c) return; const g = c.getContext('2d'); if (!g) return;
    let w = 0; let h = 0; let raf = 0; let last = 0; let alive = true;
    const size = () => { const r = el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height)); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); const ro = new ResizeObserver(size); ro.observe(el);
    const loop = (t: number) => {
      if (!alive) return; raf = requestAnimationFrame(loop);
      if (document.hidden || t - last < (reduced || lowFx ? 50 : 16)) return; last = t;
      const f = getFrame(); if (!f) return;
      const me = f.me; drawWorld(g, { idx: f.idx, tick: f.tick, dots: f.dots, width: w, height: h, mode, center: mode === 'follow' && me ? { x: me.x, y: me.y } : mode === 'follow' ? { x: f.idx.course.start[0] * TILE + TILE / 2, y: f.idx.course.start[1] * TILE + TILE / 2 } : null, gate: f.gate, pulses: f.pulses, peek: f.peek, frozen: f.frozen, reduced, lowFx, sockets: f.sockets });
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [getFrame, mode, reduced, lowFx]);
  return <div ref={box} className={`os-world ${className}`}><canvas ref={cv} role="img" aria-label={label} data-testid="os-canvas" /></div>;
}
