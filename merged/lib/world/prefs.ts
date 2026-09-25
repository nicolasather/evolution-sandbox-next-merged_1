import { prefersReducedMotion } from '../perf';
import type { Motion } from './choreography';

/* ============================================================================
   WORLD PREFS — how much of the globe cinematic the visitor wants.

     full   the whole sequence for each major invention (about 3–5 s)
     quick  the shorter reveal for every one (about 3 s)
     off    no globe: the map and the progress panel still update

   Reduced motion (the OS setting) always wins: the globe fades up already
   turned to the place, with no spinning or zooming.
   ========================================================================== */

export type WorldMode = 'full' | 'quick' | 'off';

const KEY = 'evo.world.mode';
const EVENT = 'evo:world-mode';
const isBrowser = () => typeof window !== 'undefined';

export function worldModePref(): WorldMode {
  if (!isBrowser()) return 'full';
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'full' || v === 'quick' || v === 'off') return v;
  } catch { /* storage blocked */ }
  return 'full';
}

export function setWorldModePref(m: WorldMode): void {
  try { window.localStorage.setItem(KEY, m); } catch { /* storage blocked */ }
  if (isBrowser()) window.dispatchEvent(new Event(EVENT));
}

export function subscribeWorldMode(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export interface Playback {
  /** Whether a globe is shown at all. */
  enabled: boolean;
  motion: Motion;
  /** Play every major as the shorter reveal. */
  shorten: boolean;
}

/** What to do right now, from the visitor's choice and the device. */
export function playback(mode: WorldMode = worldModePref()): Playback {
  if (mode === 'off') return { enabled: false, motion: 'reduced', shorten: true };
  if (prefersReducedMotion()) return { enabled: true, motion: 'reduced', shorten: false };
  return { enabled: true, motion: 'full', shorten: mode === 'quick' };
}
