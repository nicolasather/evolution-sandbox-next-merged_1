'use client';

import { useCallback, useEffect, useState } from 'react';
import { play } from '@/lib/craft/audio';
import type { Engine, Reveal } from '@/lib/engine';
import { TechniqueIcon } from './TechniqueIcon';

/* The moment a technique is learned: a quiet banner beside the rail, once, then gone.
   It says what became possible and how many things already held may react — never which. */

const SHOW_MS = 6500;

interface St { now: Reveal | null; queue: Reveal[] }

export function TechniqueReveal({ engine }: { engine: Engine }) {
  const [st, setSt] = useState<St>({ now: null, queue: [] });

  // the engine announces; several at once take turns
  useEffect(() => {
    const pump = () => {
      const got = engine.takeReveals();
      if (!got.length) return;
      setSt(s => (s.now ? { now: s.now, queue: [...s.queue, ...got] } : { now: got[0], queue: got.slice(1) }));
    };
    pump();
    return engine.subscribe(pump);
  }, [engine]);

  const next = useCallback(() => setSt(s => ({ now: s.queue[0] ?? null, queue: s.queue.slice(1) })), []);

  useEffect(() => {
    if (!st.now) return;
    try { play('chime', { vol: 0.35, rate: 1.15 }); } catch { /* sound is never load-bearing */ }
    const id = window.setTimeout(next, SHOW_MS);
    return () => window.clearTimeout(id);
  }, [st.now, next]);

  const now = st.now;
  if (!now) return null;
  const n = now.affects;
  return (
    <div className="tech-reveal" role="status" data-family={now.family} key={now.action}>
      <span className="tech-reveal-k mono">{now.via === 'question' ? 'LEARNED' : 'NEW TECHNIQUE'}</span>
      <div className="tech-reveal-row">
        <TechniqueIcon id={now.action} size={26} />
        <b className="mono">{now.label.toUpperCase()} UNLOCKED</b>
      </div>
      <p>{now.message}</p>
      {n > 0 && (
        <p className="tech-reveal-sub mono">
          {n} {n === 1 ? 'MATERIAL' : 'MATERIALS'} YOU HOLD MAY REACT DIFFERENTLY
        </p>
      )}
      <button type="button" className="tech-reveal-x" aria-label="Dismiss" onClick={next}>×</button>
    </div>
  );
}
