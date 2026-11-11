/* The first-time guide's one saved fact: whether this browser has finished or skipped it.
   A per-browser convenience, never progress — reads and writes are wrapped because storage
   can be blocked, and the guide simply shows (or stays hidden) without it. */

/** Each workbench variant keeps its own flag: the Main Evolution guide and the Civilization guide are separate. */
export type GuideVariant = 'main' | 'civilization';

const KEYS: Record<GuideVariant, string> = {
  main: 'evo.sandbox.guide',
  civilization: 'evo.civilization.guide.v1',
};

export function guideDone(variant: GuideVariant = 'main'): boolean {
  try { return window.localStorage.getItem(KEYS[variant]) === 'done'; } catch { return false; }
}

export function markGuideDone(variant: GuideVariant = 'main'): void {
  try { window.localStorage.setItem(KEYS[variant], 'done'); } catch { /* storage blocked: the guide shows next visit */ }
}

/** Help → Replay: the guide runs again and is marked open again. */
export function clearGuideDone(variant: GuideVariant = 'main'): void {
  try { window.localStorage.removeItem(KEYS[variant]); } catch { /* ignore */ }
}
