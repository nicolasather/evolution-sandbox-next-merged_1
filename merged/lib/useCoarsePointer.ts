import { useSyncExternalStore } from 'react';

/** True on touch-first devices (no hover, no Space key): prompts say TAP instead of PRESS. Server render → false. */
const QUERY = '(pointer: coarse)';

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.('change', cb);
  return () => mq.removeEventListener?.('change', cb);
}
const snapshot = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
