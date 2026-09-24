'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { heroStone, svg as glyphSvg } from '@/lib/glyphs';
import { IntroFx } from '@/lib/intro/fx';
import { TUNNEL_OBJECTS, loadTunnelSprites, shortDate } from '@/lib/intro/objects';
import { getQuality, isPhone, prefersReducedMotion, tunnelDuration } from '@/lib/perf';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { Db } from '@/lib/types';

/* ============================================================================
   LANDING — the exhibition's opening, and the time-tunnel that follows it.

   It is one component because it is one continuous shot, and the whole shot
   is 4–6 seconds from the moment Start is pressed:

     idle      "HOW DID WE / GET HERE?", dust that leans away from the cursor
     collapse  the title folds into the centre; the dust spirals into a point
               that becomes a ring — the time hole                       ~0.5 s
     tunnel    the camera accelerates toward a vanishing point through soft,
               out-of-focus light; real discoveries, oldest first — stone
               tools, pottery, the wheel, metal, machines, the modern world —
               swing in beside the viewer and are gone behind. Meanwhile the
               current era's scenery, blurred, comes up behind the streaks
                                                                          ~2.5–3 s
     slow      the camera decelerates, the streaks settle, the scenery comes
               into focus; the first stone appears: "Begin with almost
               nothing."                                                  ~0.8 s
     fall      the stone drops onto the ground it will be worked on      ~0.6 s
     exit      the curtain lifts; nothing black in between               ~0.45 s

   Skip is immediate: any click, Space, Enter, Escape or the Skip button drops
   the stone on the scenery on the very next frame. Returning players get
   CONTINUE (no film at all, straight back in) and can replay the journey from
   here or from the shortcuts list. Reduced motion swaps the whole thing for a
   still strip of the same objects in the same order, fading in one by one.
   ========================================================================== */

type Phase = 'idle' | 'collapse' | 'tunnel' | 'slow' | 'reduced' | 'fall' | 'exit' | 'done';

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
  /** Bumped by the player (shortcuts list) to play the journey again over the running game. */
  replay?: number;
}

const SKIPPABLE: Phase[] = ['collapse', 'tunnel', 'slow', 'reduced'];

/** Set on <html> while the film runs: the scenery behind it is blurred, then comes into focus. */
function setFilm(v: 'tunnel' | 'clear' | null) {
  const el = document.documentElement;
  if (v) {
    el.dataset.film = v;
    if (getQuality() === 'low' || isPhone()) el.dataset.lowfx = ''; else delete el.dataset.lowfx;
  } else { delete el.dataset.film; delete el.dataset.lowfx; }
}

export function Landing({
  db, gone, resumedCount, onBegin, returning, onEnter, onLanded, onDone, getBenchTarget, replay = 0,
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

  useEffect(() => () => { clearTimers(); stopSound.current(); setFilm(null); }, [clearTimers]);

  /* ── the film ─────────────────────────────────────────────────────── */

  const replaying = useRef(false);
  const entered = useRef(false);

  /** The world starts appearing beneath the film (once). Not on a replay: it is already there. */
  const enterWorld = useCallback(() => {
    if (entered.current || replaying.current) return;
    entered.current = true;
    cb.current.onEnter?.(true);
  }, []);

  /** The curtain lifts. */
  const finish = useCallback((ms: number) => {
    setFilm('clear');
    go('exit');
    later(() => { go('done'); setFilm(null); fxRef.current?.stop(); cb.current.onDone?.(); }, ms);
  }, [go, later]);

  /** The stone is on the ground: hand over to the game. */
  const land = useCallback((x: number, y: number, exitMs: number) => {
    if (!replaying.current) { cb.current.onLanded?.(x, y); sound.sfx('stone'); }
    finish(exitMs);
  }, [finish]);

  const target = useCallback(
    () => cb.current.getBenchTarget?.() ?? { x: window.innerWidth * 0.5, y: window.innerHeight * 0.55 },
    [],
  );

  /** The stone drops from where it appeared to where it will be worked. */
  const fall = useCallback(() => {
    if (phaseRef.current !== 'slow' && phaseRef.current !== 'reduced') return;
    const t = tunnelDuration(getQuality());
    enterWorld();
    // a replay has no stone to drop: the bench already holds the player's work
    if (replaying.current) { finish(t.exit); return; }
    // reduced motion: nothing falls — the stone is simply there when the curtain lifts
    if (prefersReducedMotion()) { const to0 = target(); land(to0.x, to0.y, t.exit); return; }
    go('fall');
    const el = stoneRef.current;
    const to = target();
    if (!el || typeof el.animate !== 'function') { later(() => land(to.x, to.y, t.exit), 200); return; }
    const r = el.getBoundingClientRect();
    const dx = to.x - (r.left + r.width / 2);
    const dy = to.y - (r.top + r.height / 2);
    const s = Math.min(1, 96 / Math.max(48, r.width));
    const a = el.animate([
      { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', offset: 0 },
      { transform: `translate3d(${dx * 0.2}px, ${dy * 0.1}px, 0) scale(${0.95}) rotate(8deg)`, offset: 0.25 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotate(28deg)`, offset: 0.86 },
      { transform: `translate3d(${dx}px, ${dy - 8}px, 0) scale(${s * 1.04}) rotate(30deg)`, offset: 0.93 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotate(28deg)`, offset: 1 },
    ], { duration: t.fall, easing: 'cubic-bezier(.55,.05,.85,.45)', fill: 'forwards' });
    a.onfinish = () => land(to.x, to.y, t.exit);
  }, [go, later, enterWorld, finish, land, target]);

  /** Deceleration: the streaks settle, the scenery comes into focus, the stone appears. */
  const settle = useCallback(() => {
    const fx = fxRef.current;
    const t = tunnelDuration(getQuality());
    stopSound.current();
    go('slow');
    setFilm('clear');
    if (fx) {
      fx.onModeEnd = m => { if (m === 'slow') { fx.still(); fall(); } };
      fx.slow(t.slow);
      fx.fadeOut(t.slow * 0.92);
    } else later(fall, t.slow);
  }, [go, later, fall]);

  const startTunnel = useCallback(async () => {
    const fx = fxRef.current;
    if (!fx) { settle(); return; }
    await Promise.race([spritesReady.current, new Promise<void>(r => window.setTimeout(r, 500))]);
    if (phaseRef.current !== 'collapse') return;
    const { tunnel } = tunnelDuration(getQuality());
    const lite = isPhone() || getQuality() === 'low';
    go('tunnel');
    setFilm('tunnel');
    enterWorld();
    fx.tunnel(tunnel, TUNNEL_OBJECTS.filter(o => !lite || o.lite));
    stopSound.current = sound.tunnel(tunnel / 1000);
  }, [settle, go, enterWorld]);

  const begin = useCallback((journey: boolean, again = false) => {
    if (phaseRef.current !== 'idle') return;
    onBegin();
    sound.unlock();
    replaying.current = again;

    // returning player, straight back in: no film at all
    if (!journey) {
      go('exit');
      cb.current.onEnter?.(false);
      later(() => { go('done'); fxRef.current?.stop(); cb.current.onDone?.(); }, 480);
      return;
    }
    sound.sfx('begin');
    entered.current = false;
    const fx = fxRef.current;
    if (prefersReducedMotion() || !fx) {
      // the same objects in the same order, standing still, fading in one by one
      go('reduced');
      later(fall, 2300);
      return;
    }
    const { collapse } = tunnelDuration(getQuality());
    go('collapse');
    fx.onModeEnd = m => {
      if (m === 'collapse') void startTunnel();
      else if (m === 'tunnel') settle();
    };
    fx.collapse(collapse);
  }, [onBegin, go, later, startTunnel, settle, fall]);

  /** Skip is immediate: the film is gone on the next frame and the stone is already on the scenery. */
  const skip = useCallback(() => {
    if (!SKIPPABLE.includes(phaseRef.current)) return;
    clearTimers();
    stopSound.current();
    const fx = fxRef.current;
    if (fx) { fx.onModeEnd = null; fx.still(); fx.fadeOut(120); }
    const t = tunnelDuration(getQuality());
    enterWorld();
    setFilm('clear');
    const to = target();
    if (replaying.current) { finish(200); return; }
    // the stone is already where it belongs; the curtain just lifts
    land(to.x, to.y, Math.min(t.exit, 320));
  }, [clearTimers, enterWorld, finish, land, target]);

  /** The player asked to see it again, from inside the game. */
  const lastReplay = useRef(replay);
  useEffect(() => {
    if (replay === lastReplay.current) return;
    lastReplay.current = replay;
    if (replay <= 0) return;
    clearTimers();
    stopSound.current();
    const fx = fxRef.current;
    if (fx) { fx.reset(); fx.start(); }
    phaseRef.current = 'idle';
    // a replay is an explicit request from outside: the film restarts in response to it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    begin(true, true);
  }, [replay, begin, clearTimers]);

  useEffect(() => {
    if (gone) return;
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (SKIPPABLE.includes(p) && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault(); skip(); return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gone, skip]);

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

  // the still strip: the same real, non-hidden discoveries the tunnel flies past, in the same order
  const strip = TUNNEL_OBJECTS.filter(o => o.lite).flatMap(o => {
    const n = db.nodes.find(x => x.id === o.id);
    if (!n || n.hidden) return [];
    return [{ id: n.id, name: n.n, date: shortDate(n.date), art: glyphSvg({ id: n.id, vis: n.vis, cat: n.cat }) }];
  });

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

      {/* reduced motion: the journey as a still strip, oldest first */}
      <ol className="intro-strip" aria-label="A journey through time, oldest first" aria-hidden={phase !== 'reduced'}>
        {strip.map((n, i) => (
          <li key={n.id} style={{ transitionDelay: `${i * 240}ms` }}>
            <span className="strip-art" dangerouslySetInnerHTML={{ __html: n.art }} />
            <span className="strip-name mono">{n.name}</span>
            {n.date && <span className="strip-date mono">{n.date}</span>}
          </li>
        ))}
      </ol>

      {/* the centre of the film: the first stone and its line */}
      <div className="intro-arrive" aria-hidden={phase !== 'slow' && phase !== 'fall' && phase !== 'reduced'}>
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
