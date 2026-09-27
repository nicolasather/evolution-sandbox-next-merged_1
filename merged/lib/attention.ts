'use client';

/* ============================================================================
   ATTENTION — a small shared "is something the visual centre of the screen
   right now" signal. A discovery ceremony, the era-shift banner and the
   globe sequence each claim it for as long as they are the thing the eye
   should be on; anything ambient that would otherwise compete for it — right
   now, the reactive point field behind the scene — quiets itself while any
   claim is held, and settles back the moment the last one releases.

   Independent of lib/world/bus.ts, which is about *game* moments waiting on
   the globe specifically (a toast holding until the picture clears): this is
   about what commands the eye, and the globe being busy is only one of
   several things that can claim it.
   ========================================================================== */

const claims = new Set<symbol>();
const listeners = new Set<(busy: boolean) => void>();

function notify() {
  const on = claims.size > 0;
  listeners.forEach(fn => fn(on));
}

/**
 * Claim visual attention under `name` (a label for debugging only — the
 * token returned internally is what actually tracks the claim). Call the
 * result once to release it; releasing twice, or after the surface that
 * claimed it has already unmounted, is harmless.
 */
export function claimAttention(name: string): () => void {
  const token = Symbol(name);
  claims.add(token);
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims.delete(token);
    notify();
  };
}

/** Is anything currently claiming attention? */
export function isAttentionClaimed(): boolean {
  return claims.size > 0;
}

/** Called whenever the claimed/unclaimed state changes (not on every claim). */
export function subscribeAttention(fn: (busy: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Test helper: forget every claim (module state outlives a test). */
export function resetAttention(): void {
  claims.clear();
}
