'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Glyph } from './Glyph';
import { Plate3D } from './Plate3D';
import { cn } from '@/lib/utils';
import type { Engine } from '@/lib/engine';
import type { CombineResult, HintView } from '@/lib/types';

type Outcome = (CombineResult & { key: number }) | null;

function Slot({
  which, id, engine, onDrop, onClear, state,
}: {
  which: 'a' | 'b';
  id: string | null;
  engine: Engine;
  onDrop: (which: 'a' | 'b', id: string) => void;
  onClear: (which: 'a' | 'b') => void;
  state: '' | 'merge' | 'shake';
}) {
  const [over, setOver] = useState(false);
  const node = id ? engine.get(id) : undefined;

  return (
    <div
      className={cn('slot', over && 'over', node && 'full', state)}
      aria-label={which === 'a' ? 'First ingredient' : 'Second ingredient'}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false);
        const dropped = e.dataTransfer.getData('text/plain');
        if (dropped && engine.has(dropped)) onDrop(which, dropped);
      }}
    >
      {!node ? (
        <span className="ph mono">{which === 'a' ? 'First' : 'Second'}</span>
      ) : (
        <>
          <motion.span
            key={node.id}
            className="slot-g"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 30 }}
          >
            <Glyph node={node} />
          </motion.span>
          <span className="lbl">{node.n}</span>
          <button className="clear" aria-label={`Remove ${node.n}`} onClick={() => onClear(which)}>
            <svg width="11" height="11" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

function OutcomeCard({
  result, onUse, onOpen,
}: { result: NonNullable<Outcome>; onUse: (id: string) => void; onOpen: (id: string) => void }) {
  if (result.status === 'error') return null;

  if (result.status === 'fail') {
    return (
      <motion.div
        key={result.key}
        className="oc oc-fail"
        role="status"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <p className="oc-msg">{result.message}</p>
        {result.nudge && <p className="oc-nudge mono">{result.nudge}</p>}
      </motion.div>
    );
  }

  if (result.status === 'tier_locked') {
    const g = result.gate;
    const pct = g.need ? Math.min(100, Math.round((g.have / g.need) * 100)) : 0;
    return (
      <motion.div
        key={result.key}
        className="oc oc-locked"
        role="status"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <p className="oc-msg">{result.message}</p>
        <div className="gate" aria-label={`${g.have} of ${g.need} ${g.prevName} discoveries`}>
          <span className="gate-bar"><i style={{ width: `${pct}%` }} /></span>
          <span className="mono">{g.have}/{g.need}</span>
        </div>
      </motion.div>
    );
  }

  const n = result.node;
  const isNew = result.status === 'new';
  const tag = isNew
    ? (n.hidden ? 'Hidden find' : n.rar === 'rare' ? 'Rare discovery' : 'New discovery')
    : result.newRoute ? `New route · ${result.routes.found}/${result.routes.total}` : 'Already known';

  return (
    <motion.div
      key={result.key}
      className={cn('oc oc-win', isNew && 'is-new', n.hidden && 'is-hidden', n.rar === 'rare' && 'is-rare')}
      role="status"
      initial={{ opacity: 0, scale: 0.86, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    >
      <div className="oc-art">
        {isNew && <span className="oc-ring" aria-hidden="true" />}
        <Plate3D node={n} variant="card" label={n.n} />
      </div>
      <div className="oc-text">
        <span className="oc-tag mono">{tag}</span>
        <span className="oc-name">{n.n}</span>
        <span className="oc-route mono">{result.a.n} + {result.b.n}</span>
      </div>
      <div className="oc-actions">
        <button className="chip" onClick={() => onUse(n.id)} title="Put it on the bench">Use</button>
        <button className="chip only-narrow" onClick={() => onOpen(n.id)}>Read</button>
      </div>
      <span className="sr">{isNew ? `Discovered ${n.n}` : `${n.n}, already known`}</span>
    </motion.div>
  );
}

function HintButton({ hint, onRequest }: { hint: HintView; onRequest: () => void }) {
  if (hint.targetId && hint.level >= 3) {
    return <button className="chip" disabled>No more hints</button>;
  }
  if (hint.targetId && !hint.canEscalate) {
    return (
      <button className="chip" disabled title="Hints get stronger only while you are still stuck">
        Try {hint.triesNeeded} more
      </button>
    );
  }
  const label = hint.targetId ? 'Another hint' : hint.stuck ? 'Stuck? Get a nudge' : 'Hint';
  return (
    <button className={cn('chip hint-btn', hint.stuck && !hint.targetId && 'warm')} onClick={onRequest}>
      {label}
    </button>
  );
}

export function Bench({
  engine, slotA, slotB, result, busy, hint, hintError, onDrop, onClear, onOpen, onUse, onRequestHint, onDropHint,
}: {
  engine: Engine;
  slotA: string | null;
  slotB: string | null;
  result: Outcome;
  busy: boolean;
  hint: HintView;
  hintError: string | null;
  onDrop: (which: 'a' | 'b', id: string) => void;
  onClear: (which: 'a' | 'b') => void;
  onOpen: (id: string) => void;
  onUse: (id: string) => void;
  onRequestHint: () => void;
  onDropHint: () => void;
}) {
  const trail = engine.path().slice(-26);
  const reach = engine.withinReach().length;
  const slotState: '' | 'merge' | 'shake' = !busy || !result ? ''
    : result.status === 'new' || result.status === 'known' ? 'merge'
    : result.status === 'fail' ? 'shake' : '';

  // one short line of guidance: onboarding first, then the hint, then nothing
  let line: React.ReactNode = null;
  if (engine.coached === 0) {
    line = <>Tap <b>Stone</b>, then tap <b>Stone</b> again.</>;
  } else if (engine.coached === 1) {
    line = <>Most pairs make nothing. That is normal — try another pair.</>;
  } else if (hint.targetId && hint.text) {
    line = <>{hint.text}</>;
  } else if (engine.order.length < 9) {
    line = <>Combine → discover → try again. Every find is a new ingredient.</>;
  }

  return (
    <div id="bench">
      <div id="bench-stage">
        <div className="slots">
          <Slot which="a" id={slotA} engine={engine} onDrop={onDrop} onClear={onClear} state={slotState} />
          <div className="slot-op" aria-hidden="true">+</div>
          <Slot which="b" id={slotB} engine={engine} onDrop={onDrop} onClear={onClear} state={slotState} />
        </div>

        <div id="outcome" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            {result && <OutcomeCard key={result.key} result={result} onUse={onUse} onOpen={onOpen} />}
          </AnimatePresence>
        </div>
      </div>

      <div id="bench-bar">
        <p className={cn('guide', hint.targetId && engine.coached === 2 && 'is-hint', `lvl-${hint.level}`)} aria-live="polite">
          <span className="guide-t">{hintError ?? line}</span>
          {hint.targetId && engine.coached === 2 && !hintError && (
            <button className="guide-x" onClick={onDropHint} aria-label="Dismiss hint">
              <svg width="9" height="9" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" /></svg>
            </button>
          )}
        </p>
        <div className="bar-right">
          <span className="reach mono" title="Undiscovered entries that a pair you already hold can make">
            <b className="num">{reach}</b> within reach
          </span>
          {engine.coached === 2 && <HintButton hint={hint} onRequest={onRequestHint} />}
        </div>
      </div>

      <div id="trail">
        <span className="trail-lbl mono">Your path</span>
        <div id="trail-items">
          {trail.map((n, i) => (
            <span key={n.id} style={{ display: 'contents' }}>
              {i > 0 && <span className="trail-sep">→</span>}
              <button className="trail-item" title={n.n} onClick={() => onOpen(n.id)}>
                <Glyph node={n} />
                <span className="mono">{n.n}</span>
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
