/* ============================================================================
   WORLD BUS — a tiny meeting point between the globe layer and the rest of
   the interface. Toasts and the reflective ending would otherwise appear on
   top of the globe and be gone before it closes; they ask to wait for it.
   ========================================================================== */

let busy = false;
const waiting = new Set<() => void>();

/** The globe layer says whether it is playing, or about to play, something. */
export function setWorldBusy(b: boolean): void {
  busy = b;
  if (!b) flush();
}

/** The layer has looked at what the engine announced and there is nothing (more) to show. */
export function notifyWorldDrained(): void {
  if (!busy) flush();
}

export function isWorldBusy(): boolean { return busy; }

function flush(): void {
  const fns = [...waiting];
  waiting.clear();
  fns.forEach(fn => { try { fn(); } catch { /* one late toast must not stop the rest */ } });
}

/**
 * Run `fn` once the globe is out of the way. `expect` says a moment is on its
 * way (the engine has announced one that the layer has not yet picked up), so
 * "not busy yet" does not mean "nothing coming". A time limit means a missing
 * layer (a test, a page without the globe) can never swallow the call.
 */
export function afterWorld(fn: () => void, expect = false, maxWaitMs = 14000): void {
  if (!busy && !expect) { fn(); return; }
  let done = false;
  const run = () => {
    if (done) return;
    done = true; waiting.delete(run);
    clearTimeout(timer);
    fn();
  };
  waiting.add(run);
  const timer = setTimeout(run, maxWaitMs);
}

/* ── the small signals between the globe layer and the rest of the interface ── */

let pings = 0;
const pingListeners = new Set<() => void>();

/** Something was registered on the world map (a reveal ended, or a repeat found a new route): the top-bar chip pulses. */
export function pingWorld(): void {
  pings++;
  pingListeners.forEach(fn => fn());
}
export const worldPings = (): number => pings;
export function subscribeWorldPings(fn: () => void): () => void {
  pingListeners.add(fn);
  return () => { pingListeners.delete(fn); };
}

let replayHandler: ((id: string) => boolean) | null = null;

/** The layer says how to play a major again. Pass null when it goes away. */
export function setReplayHandler(fn: ((id: string) => boolean) | null): void { replayHandler = fn; }

/** Ask for a major to be played again in its lighter, archive form. False when there is nothing to play it with. */
export function requestReplay(id: string): boolean { return replayHandler ? replayHandler(id) : false; }

/** Test helper: forget everything (module state outlives a test). */
export function resetWorldBus(): void {
  busy = false; waiting.clear(); pings = 0; pingListeners.clear(); replayHandler = null;
}
