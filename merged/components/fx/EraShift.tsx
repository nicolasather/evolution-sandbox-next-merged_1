'use client';

import { useEffect, useRef, useState } from 'react';
import { sound } from '@/lib/sound';
import { prefersReducedMotion } from '@/lib/perf';
import { ERA_TINT } from '@/lib/useSandbox';
import type { Era } from '@/lib/types';

/* ============================================================================
   ERA SHIFT — reaching a later era is marked, once, for about a second and
   a half: the room takes on the new era's colour, a line draws across, and
   the era's name is set in type. Only a forward step counts: resuming a
   saved game or starting over never triggers it. It waits for a discovery
   ceremony to close, never on top of one, and it never blocks input.
   ========================================================================== */

/** Fourteen eras, seven material worlds — used for CSS hooks on <html>. */
export const ERA_GROUP: Record<string, string> = {
  origins: 'stone', fire: 'stone', settlement: 'earth', agriculture: 'earth',
  civilization: 'earth', trade: 'metal', metallurgy: 'metal', science: 'paper',
  industry: 'iron', electric: 'circuit', computing: 'circuit', network: 'glow',
  games: 'glow', simulation: 'glow',
};

export function EraShift({ era, index, active }: { era: Era; index: number; active: boolean }) {
  const [shown, setShown] = useState<{ era: Era; key: number } | null>(null);
  const prev = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  // material theme hooks
  useEffect(() => {
    document.documentElement.dataset.era = era.id;
    document.documentElement.dataset.eraGroup = ERA_GROUP[era.id] ?? 'stone';
  }, [era.id]);

  useEffect(() => {
    if (!active) { prev.current = index; return; }   // remember where we stand until the world is live
    if (prev.current === null) { prev.current = index; return; }
    const before = prev.current;
    prev.current = index;
    if (index <= before) return;                     // resets and resumes never celebrate
    const t = timers.current;
    let tries = 0;
    const show = () => {
      // wait for a discovery ceremony, or a globe reveal, to close
      if (document.querySelector('.cer, .wg[data-on="true"]') && tries++ < 60) { t.push(window.setTimeout(show, 200)); return; }
      setShown({ era, key: Date.now() });
      sound.sfx('era');
      t.push(window.setTimeout(() => setShown(null), prefersReducedMotion() ? 1200 : 1700));
    };
    t.push(window.setTimeout(show, 350));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the era index only
  }, [index, active]);

  useEffect(() => () => timers.current.forEach(id => window.clearTimeout(id)), []);

  if (!shown) return null;
  return (
    <div className="era-shift" key={shown.key} role="status" aria-live="polite"
      style={{ ['--tint' as string]: ERA_TINT[shown.era.id] ?? '16,16,17' }}>
      <div className="es-wash" aria-hidden="true" />
      <div className="es-body">
        <p className="es-k mono">Era shift</p>
        <h2 className="es-name">{shown.era.name}</h2>
        <i className="es-rule" aria-hidden="true" />
        <p className="es-blurb mono">{shown.era.blurb}</p>
      </div>
    </div>
  );
}
