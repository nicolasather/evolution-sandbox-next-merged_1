'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { EraId } from '@/lib/types';

/* ============================================================================
   SCENE BACKDROP — engraved line-art landscapes behind the craft screen.

   Eleven scenes (data/scenes.json), one per stage of the story: savanna, night
   camp, river village, first fields, ancient city, harbour, forge valley,
   observatory, industrial age, electric city, digital frontier. By default the
   scene follows the furthest era reached; the player can also pick one.

   Each scene is stroke-only SVG in the same language as the discovery plates,
   split into <g data-depth> layers that drift with the mouse (parallax) and
   small <g class="drift|sway|twinkle|flicker|rise|flow|spin|blink|bob"> groups
   animated in CSS (app/_fx.css). The JSON is loaded lazily, in its own chunk,
   only once the workspace is on screen.
   ========================================================================== */

export interface Scene { id: string; name: string; eras: EraId[]; svg: string }

export const SCENE_KEY = 'evo.scene';
export const SCENE_EVENT = 'evo:scene';

let loaded: Scene[] | null = null;
let loading: Promise<Scene[]> | null = null;
export function loadScenes(): Promise<Scene[]> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= import('@/data/scenes.json').then(m => {
    loaded = (m.default as unknown as Scene[]);
    return loaded;
  });
  return loading;
}

export function readScenePref(): string {
  try { return window.localStorage.getItem(SCENE_KEY) || 'auto'; } catch { return 'auto'; }
}
export function saveScenePref(v: string) {
  try { window.localStorage.setItem(SCENE_KEY, v); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(SCENE_EVENT, { detail: v }));
}

const subscribePref = (cb: () => void) => {
  window.addEventListener(SCENE_EVENT, cb);
  return () => window.removeEventListener(SCENE_EVENT, cb);
};
/** The player's scene choice: 'auto' (follow the era) or a scene id. */
function useScenePref(): string {
  return useSyncExternalStore(subscribePref, readScenePref, () => 'auto');
}

export function sceneForEra(scenes: Scene[], era: EraId): Scene {
  return scenes.find(s => s.eras.includes(era)) ?? scenes[0];
}

/** Deterministic jitter so every animated group runs out of phase. */
function stagger(root: Element, seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  root.querySelectorAll<SVGGElement>('g[class]').forEach((g, i) => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    const r = (h % 1000) / 1000;
    g.style.animationDelay = `${-(r * 12 + i * 0.37).toFixed(2)}s`;
    g.style.animationDuration = '';
    if (g.classList.contains('twinkle') || g.classList.contains('blink')) {
      g.style.animationDuration = `${(2.2 + r * 3).toFixed(2)}s`;
    }
  });
}

export function SceneBackdrop({ era, active }: { era: EraId; active: boolean }) {
  const [scenes, setScenes] = useState<Scene[] | null>(loaded);
  const pref = useScenePref();
  const hostRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<{ a: Scene | null; b: Scene | null; front: 'a' | 'b' }>({ a: null, b: null, front: 'a' });

  useEffect(() => {
    if (!active || scenes) return;
    let alive = true;
    loadScenes().then(s => { if (alive) setScenes(s); }).catch(() => { /* backdrop is decoration */ });
    return () => { alive = false; };
  }, [active, scenes]);

  const target = scenes
    ? (pref !== 'auto' && scenes.find(s => s.id === pref)) || sceneForEra(scenes, era)
    : null;

  // crossfade: the new scene goes on the other layer, which becomes the front
  // one (state adjusted during render — React's pattern for derived state)
  const frontScene = shown.front === 'a' ? shown.a : shown.b;
  if (target && frontScene?.id !== target.id) {
    setShown(!frontScene ? { a: target, b: null, front: 'a' }
      : shown.front === 'a' ? { a: shown.a, b: target, front: 'b' } : { a: target, b: shown.b, front: 'a' });
  }

  // stagger animations whenever a scene is mounted
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll('.scene-layer').forEach(el => stagger(el, el.getAttribute('data-scene') || ''));
  }, [shown]);

  // mouse parallax — layers slide by their depth, eased every frame
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !active) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia?.('(pointer: fine)').matches ?? true;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      raf = 0;
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      host.querySelectorAll<SVGGElement>('g[data-depth]').forEach(g => {
        const d = parseFloat(g.getAttribute('data-depth') || '0');
        g.style.transform = `translate(${(-x * d * 26).toFixed(2)}px, ${(-y * d * 12).toFixed(2)}px)`;
      });
      if (Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002) raf = requestAnimationFrame(tick);
    };
    if (fine) window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, [active]);

  const layer = (s: Scene | null, which: 'a' | 'b') => s && (
    <svg
      key={`${which}-${s.id}`}
      className={'scene-layer' + (shown.front === which ? ' front' : '')}
      data-scene={s.id}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
      // stroke-only markup from our own data file — no external input
      dangerouslySetInnerHTML={{ __html: s.svg }}
    />
  );

  return (
    <div id="scene" ref={hostRef} className={active ? 'on' : ''} aria-hidden="true">
      {layer(shown.a, 'a')}
      {layer(shown.b, 'b')}
    </div>
  );
}

/** Small control on the bench: step through the scenes, or let them follow the era. */
export function ScenePicker({ era }: { era: EraId }) {
  const [scenes, setScenes] = useState<Scene[] | null>(loaded);
  const pref = useScenePref();
  useEffect(() => {
    if (!loaded) loadScenes().then(setScenes).catch(() => {});
  }, []);
  if (!scenes) return null;

  const ids = ['auto', ...scenes.map(s => s.id)];
  const i = Math.max(0, ids.indexOf(pref));
  const step = (d: number) => saveScenePref(ids[(i + d + ids.length) % ids.length]);
  const current = pref === 'auto' ? sceneForEra(scenes, era) : scenes.find(s => s.id === pref) ?? scenes[0];

  return (
    <div className="scene-pick mono" role="group" aria-label="Background scene">
      <button className="sp-btn" onClick={() => step(-1)} aria-label="Previous background">‹</button>
      <span className="sp-name" aria-live="polite">
        <span className="sp-k">{pref === 'auto' ? 'Scene · auto' : 'Scene'}</span>
        <span className="sp-v">{current.name}</span>
      </span>
      <button className="sp-btn" onClick={() => step(1)} aria-label="Next background">›</button>
    </div>
  );
}
