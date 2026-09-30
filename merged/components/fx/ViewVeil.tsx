'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/* ============================================================================
   VIEW VEIL — masks the instant display:none / block swap between the three
   views (workspace / graph / archive) with a brief, soft veil, so switching
   reads as a beat of movement through the same space rather than a hard cut.
   Graph and Archive keep their own mounted state (pan, zoom, scroll) across
   the switch — this only covers the moment it happens.
   ========================================================================== */

export function ViewVeil({ view }: { view: string }) {
  const [key, setKey] = useState(0);
  const prev = useRef(view);

  useEffect(() => {
    if (prev.current !== view) { prev.current = view; setKey(k => k + 1); }
  }, [view]);

  // read through an external-store hook so server and first client render agree
  const reduced = useSyncExternalStore(
    () => () => {},
    () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
  if (reduced) return null;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={key}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
          // an iris: the dark closes in from the edges and rushes past the camera
          background: 'radial-gradient(ellipse at 50% 50%, transparent 0%, var(--ink-0) 62%)',
        }}
        initial={{ opacity: 0.9, scale: 1.5, backdropFilter: 'blur(9px)' }}
        animate={{ opacity: 0, scale: 1, backdropFilter: 'blur(0px)' }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </AnimatePresence>
  );
}
