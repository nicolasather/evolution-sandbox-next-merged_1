'use client';

import { useEffect } from 'react';
import type { Feature } from '@/lib/unlocks/registry';

/* ============================================================================
   UNLOCK NOTICE — the quiet moment when a new part of the game opens.
   One at a time, bottom centre, never over a cinematic opening. It names the
   thing, says what it is for, and points to the control that is now glowing.
   It takes no focus and blocks nothing; it leaves by itself.
   ========================================================================== */

const SHOWN_MS = 8000;

export function UnlockNotice({ feature, onDone, hidden }: { feature: Feature | null; onDone: () => void; hidden: boolean }) {
  const id = feature?.id ?? null;
  useEffect(() => {
    if (!id || hidden) return undefined;
    const t = window.setTimeout(onDone, SHOWN_MS);
    return () => window.clearTimeout(t);
  }, [id, hidden, onDone]);

  if (!feature || hidden) return null;
  return (
    <div className="un" role="status" aria-live="polite" key={feature.id}>
      <button type="button" className="un-card" onClick={onDone} aria-label={`${feature.label} unlocked. Dismiss.`}>
        <span className="un-kick mono" aria-hidden="true">Unlocked</span>
        <span className="un-name" aria-hidden="true">{feature.label}</span>
        <span className="un-line">{feature.line}</span>
        <span className="un-where mono">Look for the glow · {feature.where}</span>
        <i className="un-bar" aria-hidden="true" style={{ animationDuration: `${SHOWN_MS}ms` }} />
      </button>
    </div>
  );
}
