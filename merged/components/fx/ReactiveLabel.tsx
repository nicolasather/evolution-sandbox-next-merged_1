'use client';

import { useEffect, useRef } from 'react';

/* ============================================================================
   REACTIVE LABEL — spatially-reactive text for the handful of labels that
   carry the interface (view names, nav). Each character tracks the pointer
   independently: a light lift, a touch more weight/warmth, all of it easing
   back to rest once the pointer moves on. Skipped entirely on touch and
   under prefers-reduced-motion, where it is just text.
   ========================================================================== */

const RADIUS = 46;

export function ReactiveLabel({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const el = ref.current;
    if (!el || !fine || reduced) return;

    const chars = Array.from(el.querySelectorAll<HTMLSpanElement>('.rc'));
    let rects: DOMRect[] = [];
    const measure = () => { rects = chars.map(c => c.getBoundingClientRect()); };
    measure();

    let raf = 0, px = -9999, py = -9999;
    const paint = () => {
      raf = 0;
      chars.forEach((c, i) => {
        const r = rects[i];
        if (!r) return;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.hypot(px - cx, py - cy);
        const t = Math.max(0, 1 - d / RADIUS);
        c.style.setProperty('--ry', (-t * 3).toFixed(2));
        c.style.setProperty('--rb', t.toFixed(2));
        c.style.fontWeight = t > 0.08 ? String(Math.round(400 + t * 200)) : '';
      });
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      px = -9999; py = -9999;
      if (!raf) raf = requestAnimationFrame(paint);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', measure);
      document.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [text]);

  return (
    <span ref={ref} className={'rlabel' + (className ? ` ${className}` : '')} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} className="rc" aria-hidden="true">{ch}</span>
      ))}
    </span>
  );
}
