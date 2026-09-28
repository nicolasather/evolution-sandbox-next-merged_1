/* ============================================================================
   MODE FLAGS — localStorage-backed toggles for gating work-in-progress
   systems, following the same small pattern as lib/world/prefs.ts
   (read/write helpers + a getter/setter + a change event, no framework).
   Nothing in this file is reachable from production player UI; it exists so
   an in-development mode or system can be switched on for local testing
   without shipping a half-built experience to real players. See
   docs/ROADMAP-UNIVERSE.md, "Development order".
   ========================================================================== */

const PREFIX = 'evo.flag.';
const EVENT = 'evo:flag-change';
const isBrowser = () => typeof window !== 'undefined';

export function getFlag(name: string, fallback = false): boolean {
  if (!isBrowser()) return fallback;
  try {
    const v = window.localStorage.getItem(PREFIX + name);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* storage blocked */ }
  return fallback;
}

export function setFlag(name: string, value: boolean): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(PREFIX + name, value ? '1' : '0'); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeFlags(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Gates dev-only visualizers/tools (seed inspectors, generated-site
 *  debuggers, puzzle-state graphs) that later phases will add. Off by
 *  default everywhere, including local dev, until explicitly switched on. */
export const isDevToolsEnabled = () => getFlag('dev-tools', false);
export const setDevToolsEnabled = (v: boolean) => setFlag('dev-tools', v);

/** Gates Main Evolution's Trade Routes / regional origin-gating layer
 *  (lib/trade/). Off by default: with it off, lib/useSandbox.ts constructs
 *  the Engine with no regionGate at all, which is byte-for-byte the game's
 *  existing behaviour (see lib/engine.ts's combineMany/process — an absent
 *  regionGate never blocks anything). */
export const isTradeRoutesEnabled = () => getFlag('trade-routes', false);
export const setTradeRoutesEnabled = (v: boolean) => setFlag('trade-routes', v);
