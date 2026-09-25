'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plate3D } from '../Plate3D';
import { cn } from '@/lib/utils';
import { emitFieldPulse, setFieldQuiet } from './ReactiveField';
import { CeremonyStage } from './CeremonyStage';
import { discoveryTier } from '@/lib/discoveryTier';
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
const markSeen = () => { try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ } };
const hasSeen = (): boolean => { try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };

type Phase = 'pause' | 'form' | 'expand' | 'materialize' | 'name' | 'done';

export function DiscoveryCeremony({
  result, onUse, onOpen,
}: { result: NewResult; onUse: (id: string) => void; onOpen: (id: string) => void }) {
  const n = result.node;
  const tag = n.hidden ? 'Hidden find' : n.rar === 'rare' ? 'Rare discovery' : result.firstOfEra ? 'A new era begins' : 'New discovery';
  const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // a light find, once the full reveal has been seen, gets a quick card instead of a stage
  const [tier] = useState(() => discoveryTier(result, typeof window !== 'undefined' && hasSeen()));
  const reduced = reducedMotion || tier === 'minor';

  const [phase, setPhase] = useState<Phase>(reduced ? 'done' : 'pause');
  const [skipped, setSkipped] = useState(reduced);
  const hostRef = useRef<HTMLDivElement>(null);
  const finished = useRef(reduced);

  useEffect(() => {
    if (reduced) return;
    // the field of dots goes still while the room is given over to the find
    setFieldQuiet(true);
    return () => { if (!finished.current) setFieldQuiet(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mounted (i.e. per result.key) instance
  }, []);

  /** The stage has closed: the small card takes its place, already finished. */
  const landed = () => {
    if (finished.current) return;
    finished.current = true;
    setSkipped(true);
    setPhase('done');
    setFieldQuiet(false);
    const r = hostRef.current?.getBoundingClientRect();
    emitFieldPulse(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined, tier === 'major' ? 1.7 : 1.1);
    markSeen();
  };

  const past = (p: Phase) => {
    const order: Phase[] = ['pause', 'form', 'expand', 'materialize', 'name', 'done'];
    return order.indexOf(phase) >= order.indexOf(p);
  };

  return (
    <motion.div
      key={result.key}
      ref={hostRef}
      className={cn('oc oc-win is-new', n.hidden && 'is-hidden', n.rar === 'rare' && 'is-rare', tier === 'major' && 'is-major', tier === 'minor' && 'is-minor', 'dc-host')}
      role="status"
      tabIndex={-1}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
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
      {!reduced && phase !== 'done' && <CeremonyStage node={n} onDone={landed} />}
      <span className="sr">{`Discovered ${n.n}`}</span>
    </motion.div>
  );
}
