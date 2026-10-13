'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { guidePrefs } from '@/lib/guide/prefs';
import type { ModeId } from '@/lib/modes/types';

/* ============================================================================
   MODE HELP — one small, quiet "?" in the corner of every extra mode. It holds the
   two things that must always be reachable: switching the guide back on (or off)
   and replaying the mode's opening. Neither touches progress, saves or the
   guide-completion records of any other mode.
   ========================================================================== */

export function ModeHelp({ mode, onReplayIntro }: { mode: ModeId; onReplayIntro: () => void }) {
  const prefs = useSyncExternalStore(guidePrefs.subscribe, guidePrefs.get, guidePrefs.getServer);
  const state = prefs.modes[mode] ?? 'auto';
  const guideOn = state === 'on' || state === 'auto';
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);

  return (
    <div className="mh" ref={root} data-open={open ? 'true' : undefined}>
      <button type="button" className="mh-btn" aria-label="Guide and intro" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>?</button>
      {open && (
        <div className="mh-menu" role="group" aria-label="Guide and intro">
          <button type="button" className="mh-item" aria-pressed={guideOn}
            onClick={() => { if (state === 'off' || state === 'done') guidePrefs.enable(mode); else guidePrefs.skip(mode); setOpen(false); }}>
            {state === 'off' || state === 'done' ? 'Guide on' : 'Guide off'}
          </button>
          <button type="button" className="mh-item" onClick={() => { setOpen(false); onReplayIntro(); }}>Replay intro</button>
        </div>
      )}
    </div>
  );
}
