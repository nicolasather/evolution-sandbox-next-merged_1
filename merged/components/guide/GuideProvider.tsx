'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { guidePrefs, isGuideActive } from '@/lib/guide/prefs';
import type { GuideStep } from '@/lib/guide/types';

/* ============================================================================
   GUIDE — the lightweight "follow the glow" layer.

   A mode derives its current GuideStep from its REAL game state (never from a
   click log) and hands it to <GuideProvider>. The provider adds nothing to the
   DOM; it tells the mode's own components which real control should glow
   (`useGuideGlow()`), and <GuideHint /> shows the one short instruction wherever
   the mode places it. No overlays, no fake buttons, no pointer interception.

   Behaviour: when the step changes, the old glow stops at once, there is a short
   pause (~450 ms) and then the next instruction and glow appear. When the beginner
   guide finishes, "YOU'RE READY" shows briefly and everything disappears.
   ========================================================================== */

export const GUIDE_PAUSE_MS = 450;
export const GUIDE_READY_MS = 2600;
export const READY_TEXT = "YOU'RE READY";

export interface GuideCtx {
  mode: string;
  /** The step currently shown (after the pause), or null. */
  step: GuideStep | null;
  /** True for a moment after the guide finished. */
  ready: boolean;
  /** Whether the guide is running for this mode right now. */
  enabled: boolean;
  /** Class name for a real control: 'guide-glow' while it is the target, else ''. */
  glow: (target: string) => string;
  skip: () => void;
}

const NONE: GuideCtx = { mode: '', step: null, ready: false, enabled: false, glow: () => '', skip: () => {} };
const Ctx = createContext<GuideCtx>(NONE);

export function useGuideEnabled(mode: string, eligible: boolean): boolean {
  const prefs = useSyncExternalStore(guidePrefs.subscribe, guidePrefs.get, guidePrefs.getServer);
  return isGuideActive(prefs, mode, eligible);
}

/**
 * The controller: call it in the component that owns the game state, then pass the result to
 * <GuideScope> so descendants (panels, drawers) can ask `useGuideGlow()` too. The owner itself
 * can use `guide.glow(...)` directly without going through context.
 */
export function useGuideController({ mode, eligible, step, finished = false }: {
  mode: string;
  /** The mode's own "this player is a beginner here" judgement. */
  eligible: boolean;
  /** The step derived from real state right now, or null when there is nothing to guide. */
  step: GuideStep | null;
  /** True once the beginner guide has reached its end (it is then marked done for good). */
  finished?: boolean;
}): GuideCtx {
  const enabled = useGuideEnabled(mode, eligible);
  const stepId = enabled && step ? step.id : null;

  // The glow of the previous step ends immediately; the next one waits a beat.
  const [shownId, setShownId] = useState<string | null>(null);
  useEffect(() => {
    if (!stepId) return undefined;
    const t = window.setTimeout(() => setShownId(stepId), GUIDE_PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [stepId]);
  const shown = stepId !== null && shownId === stepId ? step : null;

  // Finished: say so once, quietly, then remember it so it never restarts by itself.
  const [ready, setReady] = useState(false);
  const wasShowing = useRef(false);
  const finishedOnce = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => { if (shown) wasShowing.current = true; }, [shown]);
  useEffect(() => {
    if (!enabled || !finished || finishedOnce.current) return;
    finishedOnce.current = true;
    const showReady = wasShowing.current;
    guidePrefs.complete(mode);
    if (!showReady) return;
    // not cleared when the guide switches itself off a moment later; only on unmount
    timers.current.push(
      window.setTimeout(() => setReady(true), GUIDE_PAUSE_MS),
      window.setTimeout(() => setReady(false), GUIDE_PAUSE_MS + GUIDE_READY_MS),
    );
  }, [enabled, finished, mode]);
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  const skip = useCallback(() => guidePrefs.skip(mode), [mode]);
  const glow = useCallback((target: string) => (shown && shown.targets.includes(target) ? 'guide-glow' : ''), [shown]);
  return useMemo<GuideCtx>(() => ({ mode, step: shown, ready, enabled, glow, skip }), [mode, shown, ready, enabled, glow, skip]);
}

export function GuideScope({ value, children }: { value: GuideCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `const glow = useGuideGlow(); <button className={cx('btn', glow('forecast'))}>` */
export function useGuideGlow(): (target: string) => string {
  return useContext(Ctx).glow;
}

export function useGuide(): GuideCtx {
  return useContext(Ctx);
}

/** The one short instruction, with an optional "why" and a way to switch the guide off. Renders nothing when idle. */
export function GuideHint({ className = '' }: { className?: string }) {
  const { step, ready, skip } = useGuide();
  const [open, setOpen] = useState<string | null>(null);
  if (!step && !ready) return null;
  if (!step) return <p className={`guide-hint ready ${className}`.trim()} role="status">{READY_TEXT}</p>;
  const expanded = open === step.id;
  return (
    <div className={`guide-hint ${className}`.trim()} data-guide-step={step.id}>
      <p className="guide-text" role="status" aria-live="polite">
        {step.sr ? (
          <>
            <span aria-hidden="true">{step.text}</span>
            <span className="guide-sr">{step.sr}</span>
          </>
        ) : step.text}
      </p>
      <span className="guide-tools">
        {step.detail && (
          <button type="button" className="guide-link" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : step.id)}>
            {expanded ? 'LESS' : 'WHY?'}
          </button>
        )}
        <button type="button" className="guide-link" onClick={skip}>GUIDE OFF</button>
      </span>
      {expanded && step.detail && <p className="guide-detail">{step.detail}</p>}
    </div>
  );
}
