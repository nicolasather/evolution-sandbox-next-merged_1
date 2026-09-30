'use client';

import { useEffect, useRef, useState } from 'react';
import { isAttentionClaimed, subscribeAttention } from '@/lib/attention';
import type { Engine } from '@/lib/engine';
import { museumStore, type MuseumSignal as Signal } from '@/lib/museum/history/store';
import { engineTimeline } from '@/lib/museum/history/timeline';

/* ============================================================================
   MUSEUM SYNC + SIGNAL — runs during play, outside the Museum.

   useMuseumSync keeps the Humanity Museum's eligibility in step with the
   canonical timeline as the player advances (the exhibit database is loaded
   lazily, after the game has started, so it never weighs on the first load).

   <MuseumSignal/> is the restrained in-game moment: only when a new gallery
   opens or a civilisation-defining achievement becomes historically
   available, a thin letterboxed line appears at the bottom of the screen for
   a few seconds — never over a discovery ceremony, never blocking input, never
   more than one at a time. Everything else is signalled only by the quiet mark
   on the Museum tile.
   ========================================================================== */

export function useMuseumSync(engine: Engine, version: number, enabled: boolean): void {
  useEffect(() => { museumStore.load(); }, []);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void import('@/lib/museum/history/data').then(m => {
      if (!live) return;
      museumStore.sync(engineTimeline(engine).year, m.catalog());
    });
    return () => { live = false; };
  }, [engine, version, enabled]);
}

interface Shown { key: number; kicker: string; title: string; line: string }

export function MuseumSignal({ onVisit, suppressed }: { onVisit: () => void; suppressed: boolean }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const queue = useRef<Signal[]>([]);
  const busy = useRef(false);
  const keyN = useRef(0);

  useEffect(() => {
    if (suppressed) queue.current = [];       // being in the Museum answers every waiting signal
    const pump = () => {
      if (busy.current || suppressed || isAttentionClaimed() || !queue.current.length) return;
      const s = queue.current.shift()!;
      // several at once collapse into the most important one
      queue.current = [];
      busy.current = true;
      void import('@/lib/museum/history/data').then(m => {
        const cat = m.catalog();
        const more = s.count > 1 ? ` · ${s.count} new in the Museum` : '';
        if (s.kind === 'gallery') {
          const g = cat.galleryById.get(s.galleryId);
          setShown({ key: ++keyN.current, kicker: 'The Museum', title: `A new gallery has opened — ${g?.title ?? ''}`, line: (g?.epigraph ?? '') + more });
        } else {
          const e = cat.byId.get(s.exhibitId);
          setShown({ key: ++keyN.current, kicker: 'Humanity', title: e?.title ?? '', line: `${e?.when.display ?? ''}${more}` });
        }
        window.setTimeout(() => { setShown(null); busy.current = false; pump(); }, 7000);
      });
    };
    const offSig = museumStore.onSignal(s => { queue.current.push(s); window.setTimeout(pump, 1800); });
    const offAtt = subscribeAttention(b => { if (!b) window.setTimeout(pump, 1200); });
    const tick = window.setInterval(pump, 4000);
    return () => { offSig(); offAtt(); window.clearInterval(tick); };
  }, [suppressed]);

  if (!shown) return null;
  return (
    <div className="msig" role="status" key={shown.key}>
      <span className="msig-bar top" aria-hidden="true" />
      <span className="msig-bar bottom" aria-hidden="true" />
      <div className="msig-text">
        <span className="mono msig-kicker">{shown.kicker}</span>
        <span className="msig-title">{shown.title}</span>
        <span className="msig-row">
          <span className="mono msig-line">{shown.line}</span>
          <button type="button" className="msig-visit mono" onClick={() => { setShown(null); busy.current = false; onVisit(); }}>Visit the Museum</button>
        </span>
      </div>
    </div>
  );
}
