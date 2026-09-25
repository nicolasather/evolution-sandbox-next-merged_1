'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { worldFocus } from '@/lib/world/progress';
import { subscribeWorldPings, worldPings } from '@/lib/world/bus';

/* ============================================================================
   WORLD CHIP — the top bar's small window on the world map: how many of the
   era's required inventions are found. It pulses when a place is registered,
   including the quiet case (a repeat find, or the globe turned off). Opens
   the World Progress panel.
   ========================================================================== */

export function WorldChip({ engine, onOpen }: { engine: Engine; onOpen: () => void }) {
  const f = worldFocus(engine);
  const pings = useSyncExternalStore(subscribeWorldPings, worldPings, () => 0);
  // a ping shows for a moment: the pulse is on while the latest ping has not yet been let go
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    if (!pings) return;
    const t = window.setTimeout(() => setSettled(pings), 1500);
    return () => window.clearTimeout(t);
  }, [pings]);
  const ping = pings && pings !== settled ? pings : 0;

  const p = f.current;
  const text = p.required ? `${p.requiredDone}/${p.required}` : '—';
  const label = p.required
    ? `World progress: ${p.requiredDone} of ${p.required} required inventions in ${p.name}. Open the world map.`
    : 'World progress. Open the world map.';
  return (
    <div className="top-slot" id="slot-world">
      <button type="button" className="world-chip" data-ping={ping ? 'on' : 'off'} data-key={ping} onClick={onOpen}
        aria-label={label} title="World progress — the map of major inventions (M)" aria-keyshortcuts="M">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" /><ellipse cx="8" cy="8" rx="2.6" ry="6.2" /><path d="M1.8 8h12.4M2.6 5h10.8M2.6 11h10.8" />
        </svg>
        <span className="mono wc-k" aria-hidden="true">WORLD</span>
        <span className="num wc-n" aria-hidden="true">{text}</span>
      </button>
    </div>
  );
}
