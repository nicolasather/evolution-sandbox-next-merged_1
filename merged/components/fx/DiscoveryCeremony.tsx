'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plate3D } from '../Plate3D';
import { cn } from '@/lib/utils';
import { emitFieldPulse, setFieldQuiet } from './ReactiveField';
import type { CombineResult } from '@/lib/types';

/* ============================================================================
   DISCOVERY CEREMONY — the reveal for a genuinely NEW discovery.

   Pause → a point of light forms → a thin ring expands from it → the plate
   materialises out of the dark → its name settles in → one quiet wave runs
   through the background and the world resumes. Roughly 5s the first time,
   shorter after that, always skippable (click, Space, Enter or Escape) and
   fully bypassed under prefers-reduced-motion. Known / route / fail / locked
   outcomes never go through this — they keep the snappier existing card.
   ========================================================================== */

// `newRoute` only exists on the 'new' | 'known' member of the union — a safer
// discriminant for Extract than `status`, since that member's own `status`
// field is itself `'new' | 'known'` and so isn't assignable to `{ status: 'new' }`.
type NewResult = Extract<CombineResult, { newRoute: boolean }> & { key: number };

const SEEN_KEY = 'evo.reveal.seen';
const seenBefore = () => { try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
const markSeen = () => { try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ } };

type Phase = 'pause' | 'form' | 'expand' | 'materialize' | 'name' | 'done';

export function DiscoveryCeremony({
  result, onUse, onOpen,
}: { result: NewResult; onUse: (id: string) => void; onOpen: (id: string) => void }) {
  const n = result.node;
  const tag = n.hidden ? 'Hidden find' : n.rar === 'rare' ? 'Rare discovery' : 'New discovery';
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [phase, setPhase] = useState<Phase>(reduced ? 'done' : 'pause');
  const [skipped, setSkipped] = useState(reduced);
  const hostRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const finished = useRef(reduced);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (reduced) return;
    const seen = seenBefore();
    const scale = seen ? 0.55 : 1;
    const weight = (n.hidden || n.rar === 'rare') ? 1.15 : 1;
    const ms = (base: number) => Math.round(base * scale * weight);

    setFieldQuiet(true);
    const t = timers.current;
    t.push(window.setTimeout(() => setPhase('form'), ms(420)));
    t.push(window.setTimeout(() => setPhase('expand'), ms(420 + 1300)));
    t.push(window.setTimeout(() => setPhase('materialize'), ms(420 + 1300 + 1500)));
    t.push(window.setTimeout(() => setPhase('name'), ms(420 + 1300 + 1500 + 1250)));
    t.push(window.setTimeout(() => land(), ms(420 + 1300 + 1500 + 1250 + 550)));

    /** Reached the end on its own timing — the CSS keyframes have already
     *  played (or are just finishing), so there is nothing to jump. */
    function land() {
      if (finished.current) return;
      finished.current = true;
      setPhase('done');
      pulse();
    }
    /** The player asked to skip, from any phase — jump straight to the
     *  final state instead of racing the remaining keyframes. */
    function skipNow() {
      if (finished.current) return;
      finished.current = true;
      setSkipped(true);
      setPhase('done');
      pulse();
    }
    function pulse() {
      setFieldQuiet(false);
      const r = hostRef.current?.getBoundingClientRect();
      emitFieldPulse(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined, 1.1);
      markSeen();
    }
    skipRef.current = skipNow;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); skipNow(); }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      t.forEach(id => window.clearTimeout(id));
      if (!finished.current) setFieldQuiet(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mounted (i.e. per result.key) instance
  }, []);

  const past = (p: Phase) => {
    const order: Phase[] = ['pause', 'form', 'expand', 'materialize', 'name', 'done'];
    return order.indexOf(phase) >= order.indexOf(p);
  };

  return (
    <motion.div
      key={result.key}
      ref={hostRef}
      className={cn('oc oc-win is-new', n.hidden && 'is-hidden', n.rar === 'rare' && 'is-rare', 'dc-host')}
      role="status"
      tabIndex={-1}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      onClick={() => { if (phase !== 'done') skipRef.current(); }}
    >
      <span className={cn('dc-seed', past('form') && !past('expand') && 'show')} aria-hidden="true" />
      <span className={cn('dc-ring', past('expand') && !past('materialize') && 'show')} aria-hidden="true" />

      <div className={cn('oc-art dc-body', past('materialize') && 'show', skipped && 'instant')}>
        {past('materialize') && <span className="oc-ring" aria-hidden="true" />}
        <Plate3D node={n} variant="card" label={n.n} />
      </div>
      <div className={cn('oc-text dc-name', past('name') && 'show', skipped && 'instant')}>
        <span className="oc-tag mono">{tag}</span>
        <span className="oc-name">{n.n}</span>
        <span className="oc-route mono">{result.a.n} + {result.b.n}</span>
      </div>
      {past('name') && (
        <div className="oc-actions">
          <button className="chip" onClick={() => onUse(n.id)} title="Put it on the bench">Use</button>
          <button className="chip only-narrow" onClick={() => onOpen(n.id)}>Read</button>
        </div>
      )}
      {phase !== 'done' && <span className="dc-skip show mono" aria-hidden="true">tap to skip</span>}
      <span className="sr">{`Discovered ${n.n}`}</span>
    </motion.div>
  );
}
