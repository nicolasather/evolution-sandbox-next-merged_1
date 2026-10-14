import type { MotionPhase, MotionPlan } from './motionPlan';
import type { SoundId } from './types';

/* Applies the player's accessibility choices to a MotionPlan (package 055). Pure, so it is unit-tested.
   - reduced motion: the still, <0.5 s variant, no particles, no shake, no vibration, same meaning
   - audio off: never any sound
   - vibration only when explicitly allowed and motion is not reduced */

export interface MotionPrefs { reducedMotion: boolean; audio: boolean; vibration?: boolean }

export interface ResolvedMotion {
  phases: MotionPhase[];
  totalMs: number;
  particles: number;
  shake: number;
  sounds: SoundId[];
  vibrate: boolean;
  /** true when the result should simply appear (with a visible affordance) instead of animating */
  instant: boolean;
}

export function resolveMotion(plan: MotionPlan, prefs: MotionPrefs): ResolvedMotion {
  const reduced = prefs.reducedMotion;
  const phases = reduced ? plan.reduced.phases : plan.phases;
  return {
    phases,
    totalMs: phases.reduce((t, p) => t + p.ms, 0),
    particles: reduced ? 0 : plan.particles.count,
    shake: reduced ? 0 : plan.shake,
    sounds: prefs.audio ? plan.sounds : [],
    vibrate: !reduced && prefs.vibration === true && plan.shake > 0.3,
    instant: reduced,
  };
}
