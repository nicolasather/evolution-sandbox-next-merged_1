'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { readPalette } from '@/lib/craft/fx';
import { unlockAudio } from '@/lib/craft/audio';
import { sound } from '@/lib/sound';
import { SceneFxEngine } from '@/lib/scenefx/engine';
import { hitRegion, pointInPoly, regionsFor, toScene } from '@/lib/scenefx/regions';
import { sceneState } from '@/lib/scenefx/state';

/* ============================================================================
   SCENE FX — the illustrated backdrop answering a click.

   Water splashes and ripples where you click it; grass bends away and lets go
   a few seeds; dry ground lifts a puff of dust. Only inside the regions of the
   picture that really are water, grass or ground (lib/scenefx/regions.ts).

   This layer is only ever asked about a *bare* click — the Workbench never
   reports a press that grabbed a piece, belonged to a craft, or turned into a
   drag — so a resource being carried or combined never splashes anything.
   ========================================================================== */

export interface SceneFxHandle {
  /** A bare click at this viewport point. Returns the kind of response, or null when the point is neither water, grass nor ground. */
  click(clientX: number, clientY: number): 'water' | 'grass' | 'dust' | null;
}

/** Real blades in the picture lean away from the click, only where the picture has grass. */
function nudgeBlades(cx: number, cy: number, vw: number, vh: number) {
  const layer = document.querySelector<SVGElement>('#scene .scene-layer.front');
  if (!layer) return;
  const par = { x: sceneState.px, y: sceneState.py };
  const grass = regionsFor(sceneState.id).filter(r => r.kind === 'grass');
  if (!grass.length) return;
  const reach = 170 * Math.min(1.4, Math.max(0.7, vw / 1440));
  let n = 0;
  layer.querySelectorAll<SVGGElement>('g.sway').forEach(gEl => {
    if (n >= 8) return;
    const r = gEl.getBoundingClientRect();
    if (!r.width || !r.height || r.width > vw * 0.4) return;   // a whole-width strip would tilt like a plank
    const bx = r.left + r.width / 2, by = r.bottom;
    const d = Math.hypot(bx - cx, (by - cy) * 0.6);
    if (d > reach) return;
    if (!grass.some(reg => { const p = toScene(bx, r.top + r.height / 2, vw, vh, par, reg.depth); return pointInPoly(p.u, p.v, reg.poly); })) return;
    const f = 1 - d / reach;
    const dir = bx >= cx ? 1 : -1;
    try {
      gEl.animate(
        [{ rotate: '0deg' }, { rotate: `${(dir * (5 + 8 * f)).toFixed(2)}deg`, offset: 0.28 }, { rotate: `${(-dir * 2.5 * f).toFixed(2)}deg`, offset: 0.62 }, { rotate: '0deg' }],
        { duration: 650 + 650 * f, easing: 'ease-out', delay: d * 1.1 },
      );
      n++;
    } catch { /* individual transform properties are not everywhere; the seeds still fly */ }
  });
}

export function SceneFx({ active, ref }: { active: boolean; ref?: Ref<SceneFxHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<SceneFxEngine | null>(null);
  const raf = useRef(0);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);
  const pal = useRef(readPaletteSafe());

  useEffect(() => {
    engine.current = new SceneFxEngine();
    const cv = canvasRef.current;
    if (!cv) return;
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(window.innerWidth * dpr); cv.height = Math.round(window.innerHeight * dpr);
    };
    size();
    window.addEventListener('resize', size);
    return () => { window.removeEventListener('resize', size); cancelAnimationFrame(raf.current); engine.current = null; };
  }, []);

  // leaving the workspace lets the effects go
  useEffect(() => { if (!active) engine.current?.clear(); }, [active]);

  const frame = useRef<(now: number) => void>(() => {});
  const last = useRef(0);
  useEffect(() => {
    frame.current = (now: number) => {
      raf.current = 0;
      const eng = engine.current, cv = canvasRef.current;
      const g = cv?.getContext('2d');
      if (!eng || !cv || !g) return;
      const dt = Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      eng.update(dt);
      const dpr = cv.width / Math.max(1, window.innerWidth);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, window.innerWidth, window.innerHeight);
      eng.draw(g, window.innerWidth, window.innerHeight, { x: sceneState.px, y: sceneState.py }, pal.current);
      if (eng.alive) raf.current = requestAnimationFrame(frame.current);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    click(x, y) {
      const eng = engine.current;
      if (!eng || !activeRef.current) return null;
      const vw = window.innerWidth, vh = window.innerHeight;
      eng.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      pal.current = readPaletteSafe();
      const res = eng.click(sceneState.id, x, y, vw, vh, { x: sceneState.px, y: sceneState.py }, performance.now());
      if (!res) return null;
      if (res.sound) { unlockAudio(); sound.scene(res.sound.kind, res.sound); }
      if (res.hit.kind === 'grass' && !eng.reduced) nudgeBlades(x, y, vw, vh);
      if (!raf.current) { last.current = performance.now(); raf.current = requestAnimationFrame(frame.current); }
      return res.hit.kind;
    },
  }), []);

  return <canvas ref={canvasRef} className="scene-fx" aria-hidden="true" data-testid="scene-fx" />;
}

function readPaletteSafe() {
  try { return readPalette(); } catch { return { bone: '#e9e5dd', bone2: '#a6a199', bone3: '#86817a', line: '', line3: '', ochre: '#c8763a', ink: '#0f1011', good: '#8fbf88', hot: '#ff9a55', water: '#7db8e0' }; }
}

// re-exported for tests that want the same lookup the click path uses
export { hitRegion };
