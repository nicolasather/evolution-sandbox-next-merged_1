'use client';
import { useEffect, useRef, useState } from 'react';
import type { Engine } from '@/lib/engine';
import { arbiter, retentionBus } from '@/lib/retention/bus';
import { EGG_BY_ID, EggEngine, eggPath, type EggDef } from '@/lib/retention/eggs';
import { eraIndex } from '@/lib/retention/catalog';
import { notices } from '@/lib/retention/notices';
import { readProbe } from '@/lib/retention/probe';
import { retention } from '@/lib/retention/store';
import { benchContains } from '@/lib/craft/bus';
import { useRetention } from './hooks';

const UI = 'button,a,input,select,textarea,label,[role="dialog"],[role="tab"],[data-wb-avoid],.wb-sel,#top-handle,nav,aside,header,.rhub-wrap,#toasts';

interface Show { key: number; egg: EggDef; x: number; y: number }

/** Feeds the easter-egg engine from real input and plays a small engraved vignette when a secret is found. */
export function EggWatcher({ engine, active }: { engine: Engine; active: boolean }) {
  const r = useRetention();
  const [shown, setShown] = useState<Show | null>(null);
  const [knot, setKnot] = useState<{ x: number; y: number } | null>(null);
  const eng = useRef<EggEngine | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const live = useRef({ engine, active });
  useEffect(() => { live.current = { engine, active }; });

  useEffect(() => {
    const env = {
      now: () => Date.now(),
      engine: () => live.current.engine,
      eraIdx: () => Math.max(0, eraIndex(live.current.engine.currentEra().id)),
      sceneId: () => document.querySelector('#scene .scene-layer.front')?.getAttribute('data-scene') ?? document.querySelector('#scene .scene-layer')?.getAttribute('data-scene') ?? null,
      view: () => document.getElementById('views')?.getAttribute('data-current') ?? 'work',
      reduced: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      vw: () => window.innerWidth, vh: () => window.innerHeight,
      fire: (id: string, at?: { x: number; y: number }) => {
        const egg = EGG_BY_ID[id];
        if (!egg || !live.current.active) return;
        const s = retention.get();
        if (!s.prefs.eggs || s.eggs[id] !== undefined) return;
        if (!arbiter.request('egg', 2800)) return;
        if (!retention.foundEgg(id)) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        const p = at ?? last.current;
        const place = egg.at === 'sky' ? { x: p.x, y: vh * 0.16 } : egg.at === 'corner' ? { x: vw - 70, y: vh - 150 } : egg.at === 'center' ? { x: vw / 2, y: vh * 0.42 } : egg.at === 'bench' ? { x: p.x || vw / 2, y: p.y || vh / 2 } : p;
        const paid = retention.award(`egg:${id}`, 10);
        notices.push({ kind: 'egg', title: 'A secret', sub: egg.note, coins: paid ? 10 : undefined });
        retentionBus.emit({ t: 'egg', id });
        setShown({ key: Date.now(), egg, x: Math.min(vw - 50, Math.max(50, place.x)), y: Math.min(vh - 50, Math.max(60, place.y)) });
      },
    };
    const e = new EggEngine(env);
    eng.current = e;
    const offBus = retentionBus.on(ev => { if (live.current.active || ev.t === 'signal') e.onBus(ev); });

    const plain = (t: EventTarget | null, x: number, y: number) => {
      if (t instanceof Element && t.closest(UI)) return false;
      if (!benchContains(x, y)) return false;
      const p = readProbe();
      if (p && p.bodies.some(b => Math.hypot(b.x - x, b.y - y) < b.r + 10)) return false;
      return true;
    };
    const down = (ev: PointerEvent) => { last.current = { x: ev.clientX, y: ev.clientY }; if (live.current.active) e.pointer('down', ev.clientX, ev.clientY, plain(ev.target, ev.clientX, ev.clientY), readProbe()); };
    const move = (ev: PointerEvent) => { if (ev.pointerType === 'touch') return; last.current = { x: ev.clientX, y: ev.clientY }; if (live.current.active) e.pointer('move', ev.clientX, ev.clientY, plain(ev.target, ev.clientX, ev.clientY), readProbe()); };
    const click = (ev: MouseEvent) => e.click(ev.target instanceof Element ? ev.target : null);
    const dbl = (ev: MouseEvent) => e.dblclick(ev.target instanceof Element ? ev.target : null);
    const over = (ev: PointerEvent) => e.hover(ev.target instanceof Element ? ev.target : null);
    const key = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey && !ev.altKey) e.key(ev.key);
    };
    const input = (ev: Event) => { const t = ev.target as HTMLInputElement; if (t?.id === 's-q') e.search(t.value); };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('click', click, true);
    window.addEventListener('dblclick', dbl, true);
    window.addEventListener('pointerover', over, { passive: true });
    window.addEventListener('keydown', key, true);
    window.addEventListener('change', input, true);
    const iv = window.setInterval(() => {
      if (document.hidden || !live.current.active || !retention.get().prefs.eggs) return;
      const p = readProbe();
      e.tick(p);
      setKnot(p && env.view() === 'work' && retention.get().eggs.e01 === undefined ? e.knot(p) : null);
    }, 250);
    return () => {
      offBus(); window.clearInterval(iv); eng.current = null;
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move);
      window.removeEventListener('click', click, true); window.removeEventListener('dblclick', dbl, true);
      window.removeEventListener('pointerover', over); window.removeEventListener('keydown', key, true); window.removeEventListener('change', input, true);
    };
  }, []);

  useEffect(() => { if (!shown) return; const t = window.setTimeout(() => setShown(null), 2800); return () => window.clearTimeout(t); }, [shown]);

  if (!r.prefs.eggs) return null;
  return (
    <>
      {knot && active && <svg className="regg-knot" style={{ left: knot.x - 14, top: knot.y - 14 }} width="28" height="28" viewBox="-14 -14 28 28" fill="none" stroke="currentColor" aria-hidden="true">
        <ellipse rx="9" ry="6" strokeWidth=".8" /><ellipse rx="5" ry="3.2" strokeWidth=".7" /><path d="M-12 0q12 -9 24 0M-12 2q12 8 24 0" strokeWidth=".5" /></svg>}
      {shown && (
        <div className="regg" key={shown.key} data-anim={shown.egg.anim} style={{ left: shown.x - 40, top: shown.y - 40 }} role="status" aria-label={shown.egg.note}>
          <svg width="80" height="80" viewBox="-12 -12 24 24" fill="none" stroke="currentColor" strokeWidth="0.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={eggPath(shown.egg.glyph)} />
          </svg>
          <span className="mono">{shown.egg.note}</span>
        </div>
      )}
    </>
  );
}
