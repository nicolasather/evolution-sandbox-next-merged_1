/* The first-time guide's one saved fact: whether this browser has finished or skipped it.
   A per-browser convenience, never progress — reads and writes are wrapped because storage
   can be blocked, and the guide simply shows (or stays hidden) without it. */

const KEY = 'evo.sandbox.guide';

export function guideDone(): boolean {
  try { return window.localStorage.getItem(KEY) === 'done'; } catch { return false; }
}

export function markGuideDone(): void {
  try { window.localStorage.setItem(KEY, 'done'); } catch { /* storage blocked: the guide shows next visit */ }
}

/** Help → Replay: the guide runs again and is marked open again. */
export function clearGuideDone(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
