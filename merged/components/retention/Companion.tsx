'use client';
import { useEffect, useRef, useState } from 'react';
import type { Engine } from '@/lib/engine';
import { arbiter, retentionBus } from '@/lib/retention/bus';
import { retention } from '@/lib/retention/store';
import { RArt } from './RArt';
import { useRetention } from './hooks';

export type Mood = 'idle' | 'curious' | 'delighted' | 'awe' | 'baffled' | 'worried' | 'nudge' | 'easter';
const MOOD_MS: Record<Mood, number> = { idle: 0, curious: 1600, delighted: 2400, awe: 3000, baffled: 1600, worried: 2400, nudge: 3200, easter: 2400 };

/** A silent little engraved creature in the corner. Eight states, each its own drawing and its own motion; it reacts to
 *  the same facts everything else hears and never speaks, makes a sound, takes the pointer or covers anything. */
export function Companion({ engine, visible }: { engine: Engine; visible: boolean }) {
  const r = useRetention();
  const [mood, setMood] = useState<Mood>('idle');
  const timer = useRef(0);
  const fails = useRef<number[]>([]);
  const pending = useRef<number[]>([]);
  const lastGood = useRef(0);

  useEffect(() => {
    lastGood.current = Date.now();
    const show = (m: Mood) => {
      if (!retention.get().prefs.companion) return;
      if (m !== 'idle' && !arbiter.request('companion', MOOD_MS[m])) return;
      window.clearTimeout(timer.current);
      setMood(m);
      if (m !== 'idle') timer.current = window.setTimeout(() => setMood('idle'), MOOD_MS[m]);
    };
    // the companion waits its turn: a finish, a gag or a secret holds the floor first (see the arbiter), then it reacts
    const later = (m: Mood, ms: number) => { pending.current.push(window.setTimeout(() => show(m), ms)); };
    const off = retentionBus.on(e => {
      switch (e.t) {
        case 'discovery':
          lastGood.current = Date.now(); fails.current = [];
          later(e.status === 'new' ? (e.rar === 'rare' || e.hidden ? 'awe' : 'delighted') : 'curious', 1800);
          break;
        case 'attempt-fail': {
          const now = Date.now();
          fails.current = [...fails.current.filter(t => now - t < 120_000), now];
          later(fails.current.length >= 4 ? 'worried' : 'baffled', 900);
          break;
        }
        case 'egg': later('easter', 2900); break;
        case 'sticker': show('delighted'); break;
        case 'npc': if (e.stage === 'quest-done') later('delighted', 1000); break;
        default: break;
      }
    });
    // after a long stretch with something within reach, it points — once, gently
    const iv = window.setInterval(() => {
      if (Date.now() - lastGood.current < 120_000 || document.hidden) return;
      if (engine.withinReach(false).length > 0) { lastGood.current = Date.now(); show('nudge'); }
    }, 15_000);
    const pend = pending.current;
    return () => { off(); window.clearInterval(iv); window.clearTimeout(timer.current); pend.forEach(t => window.clearTimeout(t)); pend.length = 0; };
  }, [engine]);

  if (!visible || !r.prefs.companion) return null;
  return (
    <div className="rcomp" data-mood={mood} aria-hidden="true">
      <RArt kind="companion" id={mood} size={84} />
    </div>
  );
}
