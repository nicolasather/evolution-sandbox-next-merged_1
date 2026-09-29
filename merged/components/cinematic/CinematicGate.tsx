'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Stage } from './CinematicStage';
import { Signature } from './CinematicSignature';
import { slidesOf } from '@/lib/cinematic/slides';
import { INTRO_MS, SCENES, paletteVars, type SceneId } from '@/lib/cinematic/scenes';

/* ============================================================================
   CINEMATIC GATE — the ~10 second opening that plays whenever the player opens
   something (a view, a panel, a mode).

   What is on screen:
     0.0 – 3.0 s   the title assembles, letter by letter, out of a 2.5D scene
     3.0 – 8.6 s   1–3 cinematic sentences, one after another
     8.6 – 10  s   the sentences are gone; only the title remains
     10 s          a spacebar glyph (no words) pulses. Space — or a tap — steps
                   through the door into the real content.

   Space (or Enter / tap) before the 10 s are up jumps straight to that final
   still, so nobody is ever trapped in the animation; Escape leaves at once.
   While the gate is up it owns the keyboard (nothing underneath can react).
   The choreography itself is pure CSS (see app/_cinematic.css); this file only
   owns the clock, the keys and the pointer parallax.
   ========================================================================== */

type Phase = 'play' | 'ready' | 'slides' | 'leave';

const LEAVE_MS = 900;
const LINES_FROM = 3.0;
const LINES_TO = 8.6;

function Gate({ scene, onClose }: { scene: SceneId; onClose: () => void }) {
  const def = SCENES[scene];
  const [phase, setPhase] = useState<Phase>('play');
  const slides = slidesOf(scene);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  const rootRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('play');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase(p => (p === 'play' ? 'ready' : p)), INTRO_MS);
    return () => window.clearTimeout(t);
  }, []);

  const leave = useCallback(() => {
    if (phaseRef.current === 'leave') return;
    setPhase('leave');
    window.setTimeout(onClose, LEAVE_MS);
  }, [onClose]);

  const nSlides = slidesOf(scene).length;
  const advance = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'play') setPhase('ready');
    else if (p === 'ready') {
      if (nSlides > 0) { setIdx(0); setPhase('slides'); } else leave();
    } else if (p === 'slides') {
      if (idxRef.current < nSlides - 1) setIdx(idxRef.current + 1); else leave();
    }
  }, [leave, nSlides]);
  const back = useCallback(() => {
    if (phaseRef.current !== 'slides') return;
    if (idxRef.current > 0) setIdx(idxRef.current - 1); else setPhase('ready');
  }, []);

  // The gate owns the keyboard: capture phase, so nothing underneath (view
  // shortcuts, search focus, Enter-to-accept…) can react while it is up.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return; // browser shortcuts stay the browser's
      if (/^F\d+$/.test(ev.key)) return;                 // F5, F11, F12… too
      ev.stopImmediatePropagation();
      ev.preventDefault();
      if (ev.type !== 'keydown') return;
      if (ev.key === 'Escape') { leave(); return; }
      if (ev.key === ' ' || ev.key === 'Spacebar' || ev.code === 'Space' || ev.key === 'Enter' || ev.key === 'ArrowRight') advance();
      else if (ev.key === 'ArrowLeft' || ev.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('keypress', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('keypress', onKey, true);
    };
  }, [advance, back, leave]);

  // A focused button underneath must not be "clicked" by the Space that closes the gate.
  useEffect(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) el.blur();
  }, []);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    el.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  };

  const chars = Array.from(def.title);
  const n = def.lines.length;
  const span = LINES_TO - LINES_FROM;
  const life = span / n;

  const style = {
    ...paletteVars(def), '--n': chars.length,
    // where the player is in the slides: drives the slow camera / light / hue drift
    '--si': idx, '--sf': slides.length > 1 ? idx / (slides.length - 1) : 0,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="cg"
      data-phase={phase}
      data-scene={scene}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={def.title}
      onPointerMove={onMove}
      onPointerDown={advance}
    >
      {/* ── the 2.5D stage ─────────────────────────────────────────────── */}
      <Stage shape={def.shape} />
      <Signature id={scene} />

      {/* ── the only words on screen ───────────────────────────────────── */}
      <div className="cg-front">
        <h1 className="cg-title" aria-label={def.title}>
          {chars.map((c, i) => (
            <span key={i} className={'cg-ch' + (c === ' ' ? ' sp' : '')} aria-hidden="true"
              style={{ '--i': i } as CSSProperties}>{c === ' ' ? ' ' : c}</span>
          ))}
        </h1>

        <div className="cg-lines" aria-live="polite">
          {def.lines.map((l, i) => (
            <p key={i} className="cg-line"
              style={{ '--ld': `${(LINES_FROM + i * life).toFixed(2)}s`, '--ll': `${life.toFixed(2)}s` } as CSSProperties}>
              {l}
            </p>
          ))}
        </div>

        <div className="cg-key" aria-hidden="true"><i /></div>

        {phase === 'slides' && (
          <div className="cg-slides">
            <div className="cg-wipe" key={'w' + idx} aria-hidden="true" />
            <p className="cg-slide" key={idx} role="status">{slides[idx]}</p>
            <div className="cg-dots" aria-hidden="true">
              {slides.map((_, i) => <i key={i} className={i === idx ? 'on' : i < idx ? 'past' : ''} />)}
            </div>
          </div>
        )}
      </div>

      <div className="cg-curtain" aria-hidden="true" />
    </div>
  );
}

/** Mount with `scene` set to play the opening; `onClose` fires once the door has opened. */
export function CinematicGate({ scene, onClose }: { scene: SceneId | null; onClose: () => void }) {
  if (!scene) return null;
  return <Gate key={scene} scene={scene} onClose={onClose} />;
}
