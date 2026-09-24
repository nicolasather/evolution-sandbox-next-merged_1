/* ============================================================================
   PREFS — the few per-browser choices the bench remembers. Read through tiny
   external stores so server and client agree during hydration (both start
   from the defaults) and React re-renders when a choice changes.
   ========================================================================== */

const INSTANT_KEY = 'evo.craft.instant';
const SEEN_KEY = 'evo.craft.seen';
const EVENT = 'evo:craft-prefs';

const read = (k: string): string | null => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* storage blocked: the choice lasts this visit */ } };

let instantMem = false;

/** Instant mode: skip the hands-on part and combine on contact, as before. */
export function instantEnabled(): boolean {
  const v = read(INSTANT_KEY);
  return v === null ? instantMem : v === '1';
}
export function setInstant(on: boolean) {
  instantMem = on;
  write(INSTANT_KEY, on ? '1' : '0');
  window.dispatchEvent(new Event(EVENT));
}
export function subscribePrefs(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Kinds of step whose how-to line has already been shown enough times. */
export function seenSteps(): Record<string, number> {
  try { return JSON.parse(read(SEEN_KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}
export function markStepSeen(kind: string) {
  const s = seenSteps();
  s[kind] = (s[kind] ?? 0) + 1;
  write(SEEN_KEY, JSON.stringify(s));
}
/** A step's how-to line is shown the first two times only. */
export const CUE_LIMIT = 2;
