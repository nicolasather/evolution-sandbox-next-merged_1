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
  const trailRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const el = ref.current;
    if (!el) return;
    document.documentElement.classList.add('has-cursor');

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let raf = 0;

    // ── the comet: a tapering line behind the pointer that fades out in ~0.55 s ──
    const cv = trailRef.current;
    const tg = cv?.getContext('2d') ?? null;
    const pts: { x: number; y: number; t: number }[] = [];
    let trailRaf = 0;
    let ink = '#c4642c';
    const sizeTrail = () => { if (cv) { cv.width = window.innerWidth; cv.height = window.innerHeight; } };
    sizeTrail();
    const drawTrail = (now: number) => {
      trailRaf = 0;
      if (!cv || !tg) return;
      tg.clearRect(0, 0, cv.width, cv.height);
      while (pts.length && now - pts[0].t > 550) pts.shift();
      tg.lineCap = 'round';
      tg.strokeStyle = ink;
      for (let i = 1; i < pts.length; i++) {
        const life = 1 - (now - pts[i].t) / 550;
        if (life <= 0) continue;
        tg.globalAlpha = life * 0.55;
        tg.lineWidth = 0.8 + life * 3;
        tg.beginPath(); tg.moveTo(pts[i - 1].x, pts[i - 1].y); tg.lineTo(pts[i].x, pts[i].y); tg.stroke();
      }
      tg.globalAlpha = 1;
      if (pts.length) trailRaf = requestAnimationFrame(drawTrail);
    };
    const pushTrail = (px: number, py: number) => {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--ochre').trim();
      if (c) ink = c;
      pts.push({ x: px, y: py, t: performance.now() });
      if (pts.length > 40) pts.shift();
      if (!trailRaf) trailRaf = requestAnimationFrame(drawTrail);
    };
    window.addEventListener('resize', sizeTrail);
    // pointer position for CSS parallax (−1…1), written once per frame
    const root = document.documentElement;
    let pRaf = 0;
    const setP = () => {
      pRaf = 0;
      root.style.setProperty('--mx', ((x / window.innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty('--my', ((y / window.innerHeight) * 2 - 1).toFixed(3));
    };
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
      pushTrail(x, y);
      if (!pRaf) pRaf = requestAnimationFrame(setP);
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
      if (trailRaf) cancelAnimationFrame(trailRaf);
      if (pRaf) cancelAnimationFrame(pRaf);
      window.removeEventListener('resize', sizeTrail);
    };
  }, []);

  return (
    <>
      <canvas
        ref={trailRef} aria-hidden="true"
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9990 }}
      />
      <div id="rcursor" ref={ref} aria-hidden="true" />
    </>
  );
}
