'use client';

import { useSyncExternalStore } from 'react';
import { toggleFullscreen } from '@/lib/fx';

const subscribe = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb);
  return () => document.removeEventListener('fullscreenchange', cb);
};
const noop = () => () => {};

/** Enter / leave browser full screen. Hidden where the API is missing (iPhone Safari). */
export function FullscreenButton() {
  const supported = useSyncExternalStore(noop, () => !!document.documentElement.requestFullscreen, () => false);
  const on = useSyncExternalStore(subscribe, () => !!document.fullscreenElement, () => false);
  if (!supported) return null;
  return (
    <button
      className="icon-btn"
      id="fullscreen"
      aria-label={on ? 'Leave full screen' : 'Full screen'}
      title={on ? 'Leave full screen' : 'Full screen'}
      onClick={toggleFullscreen}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none" aria-hidden="true">
        {on
          ? <path d="M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5" />
          : <path d="M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5" />}
      </svg>
    </button>
  );
}
