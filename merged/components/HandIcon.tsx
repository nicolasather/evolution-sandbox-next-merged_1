'use client';

import { useEffect, useRef } from 'react';
import type { ActionId } from '@/lib/types';
import { drawHandIcon } from '@/lib/craft/hand';

/** A small static line-art hand posed for one action, painted with the current ink colour.
 *  Repaints when the theme flips so it never sits dark-on-dark. */
export function HandIcon({ action, size = 26 }: { action: ActionId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const paint = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(size * dpr)) { cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
      const g = cv.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      const ink = getComputedStyle(cv).color || '#e9e4d8';
      drawHandIcon(g, action, size / 2, size / 2, size, ink);
    };
    paint();
    const mo = new MutationObserver(paint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => mo.disconnect();
  }, [action, size]);

  return <canvas ref={ref} className="wb-hand-icon" width={size} height={size} style={{ width: size, height: size }} aria-hidden="true" />;
}
