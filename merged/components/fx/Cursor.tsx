'use client';

import { useEffect, useRef } from 'react';

/* ============================================================================
   CURSOR — a minimal custom pointer for fine-pointer, motion-allowed visitors.

   States: default (tiny dot) · begin (the BEGIN label) · look (an archive card, a timeline point) · text (hovering interactive text) · drag
   (hovering something you can pick up) · dragging (a native HTML5 drag is in
   flight) · craft (both bench slots are loaded — hovering the combine point
   confirms the pairing). Everything else keeps its own native cursor: touch
   devices and prefers-reduced-motion never see this component do anything.

   Plain DOM, one rAF loop, no React state — same discipline as lib/fx.ts.
   ========================================================================== */

const TEXT_SEL = 'a, button, input, textarea, [role="tab"], [role="button"], .tab, .chip, .LineHoverLink, summary';
const DRAG_SEL = '[draggable="true"], .item, .p3d, #gcanvas, .wb';
// a thing to look at rather than pick up: archive cards, timeline points, route pills
const LOOK_SEL = '.card, .tl-pt button, .pill, .path-chain li button';
const BEGIN_SEL = '#begin, .begin, .begin-alt';

export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const el = ref.current;
    if (!el) return;
    document.documentElement.classList.add('has-cursor');

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let raf = 0;
    let state = '';
    let dragging = false;

    const setState = (next: string) => {
      if (next === state) return;
      if (state) el.classList.remove(state);
      if (next) el.classList.add(next);
      state = next;
    };

    const paint = () => {
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      el.classList.add('on');
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); });

      const t = e.target as Element | null;
      if (dragging || document.querySelector('.wb-held')) { setState('dragging'); return; }
      if (t?.closest(BEGIN_SEL)) { setState('begin'); return; }
      if (t?.closest(LOOK_SEL)) { setState('look'); return; }
      const charging = !!document.querySelector('.slots.charged');
      if (charging && t?.closest('.slot-op, .slots')) { setState('craft'); return; }
      if (t?.closest(DRAG_SEL)) { setState('drag'); return; }
      if (t?.closest(TEXT_SEL)) { setState('text'); return; }
      setState('');
    };

    const onLeave = () => el.classList.remove('on');
    const onDragStart = () => { dragging = true; setState('dragging'); };
    const onDragEnd = () => { dragging = false; setState(''); };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('dragstart', onDragStart);
    window.addEventListener('dragend', onDragEnd);
    paint();

    return () => {
      document.documentElement.classList.remove('has-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('dragend', onDragEnd);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div id="rcursor" ref={ref} aria-hidden="true" />;
}
