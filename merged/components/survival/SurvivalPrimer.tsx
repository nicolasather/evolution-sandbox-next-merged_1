'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SURVIVAL_PRIMER_STEPS } from '@/lib/guide/survivalPrimer';

/* ============================================================================
   SURVIVAL PRIMER OVERLAY — a guided tour drawn on top of the real mode.

   Each step spotlights one real control (the rest of the screen is dimmed with a
   hole cut around it), outlines it, and draws an arrow from the instruction card to
   it. The dim layer ignores the pointer, so the player can still press the real
   controls while the tour is open; only the card takes clicks.

   Nothing here touches the game state. A step only measures the element that
   carries its `data-primer` key inside #survival-mode.
   ========================================================================== */

interface Box { x: number; y: number; w: number; h: number }
interface Pt { x: number; y: number }

const PAD = 8;
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.x - PAD, y: r.y - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

/** Nearest point on a box's edge (or inside it) to a point — where the arrow lands. */
function nearestOn(b: Box, p: Pt): Pt {
  return { x: Math.min(Math.max(p.x, b.x), b.x + b.w), y: Math.min(Math.max(p.y, b.y), b.y + b.h) };
}

export function SurvivalPrimer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState<{ place: 'top' | 'bottom'; rect: Box } | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const step = SURVIVAL_PRIMER_STEPS[Math.min(i, SURVIVAL_PRIMER_STEPS.length - 1)];
  const last = i === SURVIVAL_PRIMER_STEPS.length - 1;

  const measure = useCallback(() => {
    if (typeof document === 'undefined') return;
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const el = document.querySelector(`#survival-mode [data-primer="${step.target}"]`);
    if (!el) { setBox(null); return; }
    const b = boxOf(el);
    setBox(b);
    setCard(c => ({ place: b.y + b.h / 2 > window.innerHeight / 2 ? 'top' : 'bottom', rect: c?.rect ?? { x: 0, y: 0, w: 0, h: 0 } }));
  }, [step.target]);

  // Bring the step's control into view, then measure once the scroll has settled.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const el = document.querySelector(`#survival-mode [data-primer="${step.target}"]`);
    el?.scrollIntoView?.({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
    measure();
    const t = window.setTimeout(measure, reduceMotion() ? 0 : 420);
    return () => window.clearTimeout(t);
  }, [open, step.target, measure]);

  // Keep the arrow attached while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, { capture: true });
    };
  }, [open, measure]);

  // Reading the card's own size lets the arrow start from its real edge.
  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setCard(c => (c && c.rect.w === r.width && c.rect.h === r.height && c.rect.x === r.x ? c : { place: c?.place ?? 'bottom', rect: { x: r.x, y: r.y, w: r.width, h: r.height } }));
  });

  // Start each opening at the first step, and put focus on the card so keys work straight away.
  useEffect(() => {
    if (open) { setI(0); window.setTimeout(() => primaryRef.current?.focus(), 0); }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight' && !last) { e.preventDefault(); setI(n => n + 1); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); setI(n => n - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, last, i, onClose]);

  if (!open) return null;

  // Arrow: from the card's near edge to the nearest point of the target.
  let arrow: { d: string } | null = null;
  if (box && card && card.rect.w > 0) {
    const start: Pt = { x: card.rect.x + card.rect.w / 2, y: card.place === 'bottom' ? card.rect.y : card.rect.y + card.rect.h };
    const end = nearestOn(box, start);
    const mid: Pt = { x: (start.x + end.x) / 2 + (end.x > start.x ? -60 : 60), y: (start.y + end.y) / 2 };
    arrow = { d: `M ${start.x} ${start.y} Q ${mid.x} ${mid.y} ${end.x} ${end.y}` };
  }

  const finish = () => { onClose(); };
  const next = () => (last ? finish() : setI(n => n + 1));

  return (
    <div className="sv-primer" role="dialog" aria-modal="false" aria-label="How to play Survival">
      {box && (
        <svg className="sv-primer-dim" width={vp.w} height={vp.h} viewBox={`0 0 ${vp.w} ${vp.h}`} aria-hidden="true">
          <defs>
            <mask id="sv-primer-hole">
              <rect x="0" y="0" width={vp.w} height={vp.h} fill="white" />
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="6" fill="black" />
            </mask>
            <marker id="sv-primer-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
            </marker>
          </defs>
          <rect x="0" y="0" width={vp.w} height={vp.h} className="sv-primer-shade" mask="url(#sv-primer-hole)" />
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="6" className="sv-primer-spot" />
          {arrow && <path d={arrow.d} className="sv-primer-arrow" markerEnd="url(#sv-primer-head)" />}
        </svg>
      )}

      <div ref={cardRef} className={`sv-primer-card ${card?.place === 'top' ? 'is-top' : 'is-bottom'}`}>
        <p className="mono sv-primer-count">Step {i + 1} of {SURVIVAL_PRIMER_STEPS.length}</p>
        <h2 className="sv-primer-title">{step.title}</h2>
        <p className="sv-primer-body">{step.body}</p>
        <div className="sv-primer-dots" aria-hidden="true">
          {SURVIVAL_PRIMER_STEPS.map((s, n) => <span key={s.id} className={n === i ? 'on' : ''} />)}
        </div>
        <div className="sv-primer-actions">
          <button type="button" className="chip sv-primer-skip" onClick={finish}>Skip</button>
          <span className="sv-primer-nav">
            <button type="button" className="chip" onClick={() => setI(n => Math.max(0, n - 1))} disabled={i === 0}>Back</button>
            <button ref={primaryRef} type="button" className="chip sv-primer-next" onClick={next}>{last ? 'Start playing' : 'Next'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
