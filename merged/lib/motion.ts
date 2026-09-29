import { getQuality, prefersReducedMotion, type Quality } from './perf';

/* ============================================================================
   MOTION — one shared cinematic animation language, so no screen invents its
   own duration or easing. Every reveal in the game is one of five weights,
   never picked ad hoc:

     micro             100–250 ms    press, pickup, collision, cursor reaction
     interfaceReveal    600–1400 ms  panels, filters, secondary information
     importantReveal    2–4 s        new technique, quiz, museum artifact
     majorEvent         5–12 s       a major invention, a milestone
     eraTransition      12–25 s      leaving one era for the next

   A tier is a *range*, not one number — `tierMs` below picks the default
   inside it and then scales it the same way `lib/perf.ts` already scales
   particle counts: quiet on `prefers-reduced-motion` (collapses to the
   `micro` floor, same rule `CeremonyStage`'s own `k` multiplier already
   follows), a little shorter on `medium`/`low` so a slower device is not
   also asked to sit through the longest cut of every cinematic.

   This module has no DOM, no timers and no React — it is pure numbers, the
   same shape as `lib/perf.ts` and `lib/discoveryTier.ts`, so every surface
   (a `setTimeout` sequence like `CeremonyStage`, or a Framer Motion
   `transition` prop) can read off it without adopting a new dependency.
   ========================================================================== */

export type MotionTier = 'micro' | 'interfaceReveal' | 'importantReveal' | 'majorEvent' | 'eraTransition';

/** [floor, default, ceiling] in ms, straight from the brief's own numbers. */
const RANGE_MS: Record<MotionTier, readonly [number, number, number]> = {
  micro: [100, 180, 250],
  interfaceReveal: [600, 900, 1400],
  importantReveal: [2000, 2800, 4000],
  majorEvent: [5000, 7000, 12000],
  eraTransition: [12000, 16000, 25000],
};

/** How much of the default duration a device tier actually gets. Reduced
 *  motion is handled separately (it does not merely shrink — it floors). */
const QUALITY_SCALE: Record<Quality, number> = { high: 1, medium: 0.85, low: 0.68 };

/**
 * Cinematic easings, as cubic-bezier control points — for CSS
 * (`cubic-bezier(${EASE.x.join(',')})`) and Framer Motion alike (it accepts
 * the same four-number array directly as an `ease`).
 *
 *   reveal        interface panels: quick out, no overshoot
 *   materialize   text/objects emerging from blur or darkness: slow start
 *   cinematicIn   a large camera or object move settling in: begins almost
 *                 imperceptibly, accelerates, decelerates for a long tail
 *   cinematicOut  the mirror, for something leaving frame or dissolving
 *   breathe       tiny continuous idle motion: symmetric, no snap either end
 */
export const EASE = {
  reveal: [0.2, 0.7, 0.2, 1] as const,
  materialize: [0.16, 0.02, 0.13, 1] as const,
  cinematicIn: [0.11, 0, 0.15, 1] as const,
  cinematicOut: [0.7, 0, 0.84, 0] as const,
  breathe: [0.45, 0, 0.55, 1] as const,
};

const cssEase = (e: readonly [number, number, number, number]) => `cubic-bezier(${e.join(',')})`;

/** The default easing for each tier — small reveals get a plain `reveal`;
 *  anything long enough to be a real cinematic gets `materialize`/`cinematicIn`. */
const TIER_EASE: Record<MotionTier, readonly [number, number, number, number]> = {
  micro: EASE.reveal,
  interfaceReveal: EASE.reveal,
  importantReveal: EASE.materialize,
  majorEvent: EASE.cinematicIn,
  eraTransition: EASE.cinematicIn,
};

export interface MotionOptions {
  /** Use a specific point in the tier's range instead of its default (ms). */
  ms?: number;
  quality?: Quality;
  reducedMotion?: boolean;
}

/** The tier's duration in ms, scaled for the current device and motion
 *  preference. Reduced motion always floors to something quick and legible
 *  rather than instant — a cinematic still *happens*, it just does not make
 *  anyone wait for it (the same choice `CeremonyStage` already makes with
 *  its own `k = 0.01` reduced-motion multiplier). */
export function tierMs(tier: MotionTier, opts: MotionOptions = {}): number {
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  if (reduced) return Math.min(RANGE_MS[tier][0], 220);
  const base = opts.ms ?? RANGE_MS[tier][1];
  const quality = opts.quality ?? getQuality();
  return Math.round(base * QUALITY_SCALE[quality]);
}

/** A ready-to-spread Framer Motion `transition` for this tier. */
export function motionTransition(tier: MotionTier, opts: MotionOptions = {}) {
  return { duration: tierMs(tier, opts) / 1000, ease: TIER_EASE[tier] as unknown as number[] };
}

/** The tier's duration and easing as CSS custom-property-ready strings,
 *  e.g. for an inline `style` on a one-off element that can't use the
 *  `.cin-*` utility classes in `app/_cinematic-motion.css`. */
export function motionCss(tier: MotionTier, opts: MotionOptions = {}): { duration: string; ease: string } {
  return { duration: `${tierMs(tier, opts)}ms`, ease: cssEase(TIER_EASE[tier]) };
}

/** Every tier's default duration in ms, unscaled — for reading, not for
 *  driving an animation directly (use `tierMs`/`motionTransition` for that). */
export const MOTION_DEFAULTS: Record<MotionTier, number> = Object.fromEntries(
  (Object.keys(RANGE_MS) as MotionTier[]).map(t => [t, RANGE_MS[t][1]]),
) as Record<MotionTier, number>;
