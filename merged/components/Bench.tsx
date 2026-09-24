'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Glyph } from './Glyph';
import { Plate3D } from './Plate3D';
import { ScenePicker } from './SceneBackdrop';
import { DiscoveryCeremony } from './fx/DiscoveryCeremony';
import { Workbench } from './Workbench';
import { cn } from '@/lib/utils';
import type { Engine } from '@/lib/engine';
import type { CombineResult, HintView } from '@/lib/types';

type Outcome = (CombineResult & { key: number }) | null;

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

  // a genuinely new discovery gets the slow reveal; an already-known result
  // (even by a new route) keeps the snappier card — it is not the ceremony's
  // subject
  if (result.status === 'new') {
    return <DiscoveryCeremony result={result} onUse={onUse} onOpen={onOpen} />;
  }

  const n = result.node;
  const tag = result.newRoute ? `New route · ${result.routes.found}/${result.routes.total}` : 'Already known';

  return (
    <motion.div
      key={result.key}
      className="oc oc-win"
      role="status"
      initial={{ opacity: 0, scale: 0.86, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    >
      <div className="oc-art">
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
      <span className="sr">{`${n.n}, already known`}</span>
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
  engine, active, result, hint, hintError, onCombine, onBegin, onOpen, onUse, onRequestHint, onDropHint,
}: {
  engine: Engine;
  /** The workspace view is showing (the bench sleeps otherwise). */
  active: boolean;
  result: Outcome;
  hint: HintView;
  hintError: string | null;
  onCombine: (a: string, b: string) => CombineResult;
  onBegin: () => void;
  onOpen: (id: string) => void;
  onUse: (id: string) => void;
  onRequestHint: () => void;
  onDropHint: () => void;
}) {
  const trail = engine.path().slice(-26);
  const reach = engine.withinReach().length;
  // one short line of guidance: onboarding first, then the hint, then nothing
  let line: React.ReactNode = null;
  if (engine.coached === 0) {
    line = <>Tap <b>Stone</b> twice. Then do the work with your hands.</>;
  } else if (engine.coached === 1) {
    line = <>Most pairs make nothing. That is normal — try another pair.</>;
  } else if (hint.targetId && hint.text) {
    line = <>{hint.text}</>;
  } else if (engine.order.length < 9) {
    line = <>Bring two things together → work it with your hands → discover. Every find is a new ingredient.</>;
  }

  return (
    <div id="bench">
      <div id="bench-stage">
        <ScenePicker era={engine.currentEra().id} />
        <Workbench engine={engine} active={active} onCombine={onCombine} onBegin={onBegin} />

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
