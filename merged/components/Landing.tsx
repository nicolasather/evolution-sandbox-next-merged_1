'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { heroStone } from '@/lib/glyphs';
import { IntroFx } from '@/lib/intro/fx';
import { TUNNEL_OBJECTS, loadTunnelSprites } from '@/lib/intro/objects';
import { getQuality, isPhone, prefersReducedMotion, tunnelDuration } from '@/lib/perf';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { Db } from '@/lib/types';

/* ============================================================================
   LANDING — the exhibition's opening, and the time-tunnel that follows it.

   It is one component because it is one continuous shot:

     idle      "HOW DID WE / GET HERE?", dust that leans away from the cursor
     collapse  the title folds into the centre; the dust spirals into a point
               that becomes a ring — the time hole
     tunnel    the camera travels forward through history; real discoveries
               (stone → smartphone) fly through it
     slow      everything decelerates to a stop
     flash     a single white breath
     arrive    silence. One stone. "BEGIN WITH ALMOST NOTHING."
     fall      the stone drops toward the bench; the world loads in beneath it
     exit      the curtain lifts

   Returning players get CONTINUE TIMELINE (no tunnel) and, quietly, a way to
   replay the journey. Reduced motion replaces the whole thing with a short
   fade. Any click, Space or Escape during the film skips to the arrival.
   ========================================================================== */

type Phase = 'idle' | 'collapse' | 'tunnel' | 'slow' | 'flash' | 'arrive' | 'fall' | 'exit' | 'done';

export interface Returning {
  /** Name of the furthest era reached. */
  era: string;
  /** Name of the most recent discovery. */
  latest: string;
  /** Names of the last few discoveries, newest first. */
  recent: string[];
}

interface Props {
  db: Db;
  gone: boolean;
  resumedCount: number;
  /** The player pressed BEGIN / CONTINUE: a gesture, so full screen and audio can start. */
  onBegin: () => void;
  returning?: Returning | null;
  /** The world may start appearing beneath the film. `film` is false when the
   *  player skipped straight back in (CONTINUE) and no stone will fall. */
  onEnter?: (film: boolean) => void;
  /** The falling stone reached the bench: (x, y) in viewport px. */
  onLanded?: (x: number, y: number) => void;
  /** The curtain is up; the landing can be removed. */
  onDone?: () => void;
  /** Where the stone should land, in viewport px. */
  getBenchTarget?: () => { x: number; y: number } | null;
}

const SKIPPABLE: Phase[] = ['collapse', 'tunnel', 'slow', 'flash'];

export function Landing({
  db, gone, resumedCount, onBegin, returning, onEnter, onLanded, onDone, getBenchTarget,
}: Props) {
  const routes = db.nodes.reduce((a, n) => a + (n.rec?.length || 0), 0);
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beginRef = useRef<HTMLButtonElement>(null);
  const stoneRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<IntroFx | null>(null);
  const spritesReady = useRef<Promise<void>>(Promise.resolve());
  const timers = useRef<number[]>([]);
  const stopSound = useRef<() => void>(() => {});
  const cb = useRef({ onEnter, onLanded, onDone, getBenchTarget });
  useEffect(() => { cb.current = { onEnter, onLanded, onDone, getBenchTarget }; });

  const go = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; }, []);

  /* ── the canvas ───────────────────────────────────────────────────── */

  useEffect(() => {
    rootRef.current?.setAttribute('data-q', getQuality());
    const cv = canvasRef.current;
    if (!cv || prefersReducedMotion()) return;
    let fx: IntroFx;
    try { fx = new IntroFx(cv, { quality: getQuality(), lite: isPhone() }); } catch { return; }
    fxRef.current = fx;
    fx.start();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fx.resize()) : null;
    ro?.observe(cv);

    // the plates the tunnel needs, prepared while the visitor reads the title
    const nodes = db.nodes.filter(n => n.id) as Parameters<typeof loadTunnelSprites>[0];
    spritesReady.current = new Promise<void>(resolve => {
      const run = () => loadTunnelSprites(nodes).then(m => { fx.setSprites(m); resolve(); }, () => resolve());
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (ric) ric(run); else window.setTimeout(run, 60);
    });

    return () => { ro?.disconnect(); fx.destroy(); fxRef.current = null; };
    // the database never changes after load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { clearTimers(); stopSound.current(); }, [clearTimers]);

  /* ── the film ─────────────────────────────────────────────────────── */

  const fall = useCallback(() => {
    if (phaseRef.current !== 'arrive') return;
    go('fall');
    cb.current.onEnter?.(true);
    const el = stoneRef.current;
    const target = cb.current.getBenchTarget?.() ?? { x: window.innerWidth * 0.5, y: window.innerHeight * 0.55 };
    const finish = () => {
      cb.current.onLanded?.(target.x, target.y);
      sound.sfx('stone');
      go('exit');
      later(() => { go('done'); cb.current.onDone?.(); }, 760);
    };
    if (!el || typeof el.animate !== 'function') { later(finish, 400); return; }
    const r = el.getBoundingClientRect();
    const dx = target.x - (r.left + r.width / 2);
    const dy = target.y - (r.top + r.height / 2);
    const s = Math.min(1, 96 / Math.max(48, r.width));
    const a = el.animate([
      { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', offset: 0 },
      { transform: `translate3d(${dx * 0.2}px, ${dy * 0.1}px, 0) scale(${0.95}) rotate(8deg)`, offset: 0.25 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotate(28deg)`, offset: 0.86 },
      { transform: `translate3d(${dx}px, ${dy - 8}px, 0) scale(${s * 1.04}) rotate(30deg)`, offset: 0.93 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotate(28deg)`, offset: 1 },
    ], { duration: 820, easing: 'cubic-bezier(.55,.05,.85,.45)', fill: 'forwards' });
    a.onfinish = finish;
  }, [go, later]);

  const arrive = useCallback(() => {
    stopSound.current();
    fxRef.current?.fadeOut(500);
    go('arrive');
    const lite = isPhone();
    // after the line has been read, the stone falls
    later(() => fall(), lite ? 2100 : 2900);
  }, [go, later, fall]);

  const startTunnel = useCallback(async () => {
    const fx = fxRef.current;
    if (!fx) { arrive(); return; }
    await Promise.race([spritesReady.current, new Promise<void>(r => window.setTimeout(r, 700))]);
    if (phaseRef.current !== 'collapse') return;
    const { tunnel } = tunnelDuration(getQuality());
    const lite = isPhone() || getQuality() === 'low';
    go('tunnel');
    fx.tunnel(tunnel, TUNNEL_OBJECTS.filter(o => !lite || o.lite));
    stopSound.current = sound.tunnel(tunnel / 1000);
  }, [arrive, go]);

  const begin = useCallback((journey: boolean) => {
    if (phaseRef.current !== 'idle') return;
    onBegin();
    sound.unlock();

    // returning player, straight back in: no film at all
    if (!journey) {
      go('exit');
      cb.current.onEnter?.(false);
      later(() => { go('done'); cb.current.onDone?.(); }, 700);
      return;
    }
    sound.sfx('begin');
    const fx = fxRef.current;
    if (prefersReducedMotion() || !fx) {
      // a short, still version of the same beats
      go('arrive');
      later(() => fall(), 1500);
      return;
    }
    const { collapse } = tunnelDuration(getQuality());
    go('collapse');
    fx.onModeEnd = m => {
      if (m === 'collapse') void startTunnel();
      else if (m === 'tunnel') { stopSound.current(); fx.slow(460); }
      else if (m === 'slow') {
        fx.still();
        go('flash');
        sound.sfx('flash');
        later(() => arrive(), 520);
      }
    };
    fx.collapse(collapse);
  }, [onBegin, go, later, startTunnel, arrive, fall]);

  /** Any click / Space / Esc during the film jumps to the arrival. */
  const skip = useCallback(() => {
    if (!SKIPPABLE.includes(phaseRef.current)) return;
    clearTimers();
    const fx = fxRef.current;
    if (fx) { fx.onModeEnd = null; fx.still(); }
    arrive();
  }, [arrive, clearTimers]);

  useEffect(() => {
    if (gone) return;
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (SKIPPABLE.includes(p) && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault(); skip(); return;
      }
      if (p === 'arrive' && (e.key === 'Escape' || e.key === ' ')) { e.preventDefault(); fall(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gone, skip, fall]);

  /* ── pointer → dust ───────────────────────────────────────────────── */

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    fxRef.current?.pointer(e.clientX, e.clientY);
  };
  const hotOn = () => {
    const b = beginRef.current;
    if (!b || !fxRef.current) return;
    const r = b.getBoundingClientRect();
    fxRef.current.attract(r.left + r.width / 2, r.top + r.height / 2, 1);
  };
  const hotOff = () => fxRef.current?.release();

  const showReturn = resumedCount > 0 && !!returning;
  const facts = [
    [db.counts.core, 'discoveries'], [db.counts.hidden, 'hidden'], [routes, 'routes'], [Object.keys(db.sources).length, 'cited sources'],
  ] as const;

  return (
    <section
      id="landing"
      ref={rootRef}
      data-phase={phase}
      className={cn(gone && 'gone')}
      aria-label="Introduction"
      onPointerMove={onMove}
      onPointerLeave={() => fxRef.current?.leave()}
      onPointerDown={() => { if (SKIPPABLE.includes(phaseRef.current)) skip(); }}
    >
      <canvas ref={canvasRef} className="intro-canvas" aria-hidden="true" />

      <div className="landing-stage">
        {showReturn && (
          <p className="landing-kicker mono" role="status">You left the world here.</p>
        )}
        <h1 className="landing-q">
          <span className="q-1">How did we</span>
          <span className="q-2">get here<i className="q-mark">?</i></span>
        </h1>

        {showReturn && returning ? (
          <div className="landing-return">
            <p className="landing-last mono">
              <span>Last seen</span><b>{returning.era}</b>
              <span>Latest discovery</span><b>{returning.latest}</b>
            </p>
            {returning.recent.length > 1 && (
              <p className="landing-recent mono" aria-label="Last discoveries">
                {returning.recent.slice(0, 3).map((n, i) => <span key={i}>{n}</span>)}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="landing-sub">Start with almost nothing.</p>
            <p className="landing-mats mono" aria-label="Stone, wood, bone, fibre">
              <span>Stone</span><i>·</i><span>Wood</span><i>·</i><span>Bone</span><i>·</i><span>Fibre</span>
            </p>
          </>
        )}

        <div className="landing-actions">
          {showReturn ? (
            <>
              <button
                ref={beginRef} className="begin" id="begin" type="button"
                onClick={() => begin(false)} onPointerEnter={hotOn} onPointerLeave={hotOff}
              >
                <span>Continue timeline</span><span className="arrow" aria-hidden="true">→</span>
              </button>
              <button className="begin-alt mono" type="button" onClick={() => begin(true)}>
                Replay time journey
              </button>
            </>
          ) : (
            <button
              ref={beginRef} className="begin" id="begin" type="button"
              onClick={() => begin(true)} onPointerEnter={hotOn} onPointerLeave={hotOff}
            >
              <span>Begin</span><span className="arrow" aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>

      <div className="landing-foot mono">
        <span>No account. No tutorial. Nothing to read first.</span>
        <span className="landing-facts">
          {facts.map(([n, l]) => <span key={l}><b>{n}</b> {l}</span>)}
        </span>
      </div>

      {/* the centre of the film: hole label, flash, arrival */}
      <div className="intro-flash" aria-hidden="true" />
      <div className="intro-arrive" aria-hidden={phase !== 'arrive' && phase !== 'fall'}>
        <div ref={stoneRef} className="intro-stone" dangerouslySetInnerHTML={{ __html: heroStone() }} />
        <p className="intro-line">
          <span>Begin with</span>
          <span>almost nothing.</span>
        </p>
      </div>
      <button
        type="button" className="intro-skip mono"
        tabIndex={SKIPPABLE.includes(phase) ? 0 : -1}
        onClick={e => { e.stopPropagation(); skip(); }}
      >
        Skip
      </button>
    </section>
  );
}
