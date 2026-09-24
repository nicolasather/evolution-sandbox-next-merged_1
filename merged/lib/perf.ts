/* ============================================================================
   PERF — one place that decides how much the interface is allowed to spend.

   Three quality tiers drive particle counts, blur and how long the cinematic
   lasts. The tier is picked once from what the browser tells us (reduced
   motion, memory, cores, data-saver, screen size) and can be overridden by
   the visitor. Everything decorative asks this module instead of guessing.
   ========================================================================== */

export type Quality = 'high' | 'medium' | 'low';
export type QualityPref = 'auto' | Quality;

const KEY = 'evo.quality';
const EVENT = 'evo:quality';

/** Multiplier applied to every decorative particle count. */
export const PARTICLE_SCALE: Record<Quality, number> = { high: 1, medium: 0.55, low: 0.25 };

const isBrowser = () => typeof window !== 'undefined';

export function prefersReducedMotion(): boolean {
  return isBrowser() && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** A phone-sized viewport (matches the design system's mobile breakpoint). */
export function isPhone(): boolean {
  return isBrowser() && !!window.matchMedia?.('(max-width:900px)').matches;
}

export function isCoarsePointer(): boolean {
  return isBrowser() && !!window.matchMedia?.('(pointer:coarse)').matches;
}

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

/** The tier this device would get with no override. */
export function detectQuality(): Quality {
  if (!isBrowser()) return 'medium';
  if (prefersReducedMotion()) return 'low';
  const nav = navigator as Navigator & NavigatorHints;
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  if (nav.connection?.saveData) return 'low';
  if (mem <= 2 || cores <= 2) return 'low';
  if (isPhone() || isCoarsePointer() || mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}

export function qualityPref(): QualityPref {
  if (!isBrowser()) return 'auto';
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'high' || v === 'medium' || v === 'low' || v === 'auto') return v;
  } catch { /* storage blocked */ }
  return 'auto';
}

export function setQualityPref(p: QualityPref) {
  try { window.localStorage.setItem(KEY, p); } catch { /* storage blocked */ }
  if (isBrowser()) window.dispatchEvent(new Event(EVENT));
}

/** The tier in force: the visitor's choice, else what the device suggests. Reduced motion always wins. */
export function getQuality(): Quality {
  if (prefersReducedMotion()) return 'low';
  const p = qualityPref();
  return p === 'auto' ? detectQuality() : p;
}

export function subscribeQuality(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Length of the time-tunnel in ms, by tier and screen. Phones get the short one. */
export function tunnelDuration(q: Quality = getQuality()): { collapse: number; tunnel: number } {
  if (isPhone() || q === 'low') return { collapse: 600, tunnel: 1700 };
  if (q === 'medium') return { collapse: 800, tunnel: 2800 };
  return { collapse: 900, tunnel: 3600 };
}
