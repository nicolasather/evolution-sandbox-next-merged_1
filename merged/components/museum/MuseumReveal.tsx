'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { claimAttention } from '@/lib/attention';
import type { Catalog } from '@/lib/museum/history/data';
import { museumStore } from '@/lib/museum/history/store';
import { shortYear } from '@/lib/museum/history/timeline';
import { sound } from '@/lib/sound';
import { MotifArt } from './MotifArt';

/* ============================================================================
   MAJOR MILESTONE REVEAL — plays once, on entering the Museum, for a gallery
   that has opened or a civilisation-defining achievement that became
   historically available since the last visit.

   Slow, monumental and restrained: darkness, a seam of light, the doors part,
   the reconstruction draws itself, the name settles. No confetti, badges,
   counters or reward language — it says "humanity changed", not "you won".
   Space / Enter / a click continues; Escape skips every queued reveal.
   At most three play in a row; anything further is simply there to find.
   ========================================================================== */

const MAX_IN_A_ROW = 3;
const DURATION = 9000;

export function MuseumReveal({ cat, onDone, onArrive }: {
  cat: Catalog;
  onDone: () => void;
  /** Where to stand in the hall afterwards. */
  onArrive: (target: { galleryId?: string; exhibitId?: string }) => void;
}) {
  const [cur, setCur] = useState(() => museumStore.peekReveal());
  const [ready, setReady] = useState(false);
  const shown = useRef(0);
  const last = useRef<{ galleryId?: string; exhibitId?: string }>({});

  useEffect(() => claimAttention('museum-reveal'), []);

  const next = useCallback(() => {
    if (!cur) return;
    museumStore.consumeReveal(cur.kind, cur.id);
    last.current = cur.kind === 'gallery' ? { galleryId: cur.id } : { exhibitId: cur.id };
    shown.current++;
    const n = museumStore.peekReveal();
    if (!n || shown.current >= MAX_IN_A_ROW) {
      if (n) museumStore.clearReveals();
      onArrive(last.current);
      onDone();
      return;
    }
    setReady(false);
    setCur(n);
  }, [cur, onDone, onArrive]);

  const skipAll = useCallback(() => {
    if (cur) last.current = cur.kind === 'gallery' ? { galleryId: cur.id } : { exhibitId: cur.id };
    museumStore.clearReveals();
    onArrive(last.current);
    onDone();
  }, [cur, onDone, onArrive]);

  useEffect(() => {
    if (!cur) { onDone(); return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t1 = window.setTimeout(() => sound.sfx('major', 0.45), reduced ? 100 : 2600);
    const t2 = window.setTimeout(() => setReady(true), reduced ? 1500 : DURATION - 1500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [cur, onDone]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); skipAll(); }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); next(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [next, skipAll]);

  if (!cur) return null;
  const gallery = cur.kind === 'gallery' ? cat.galleryById.get(cur.id) : undefined;
  const galleryHead = gallery ? (cat.byGallery.get(gallery.id) ?? []).slice().sort((a, b) => {
    const w = { supporting: 0, milestone: 1, breakthrough: 2, defining: 3 };
    return w[b.importance] - w[a.importance];
  })[0] : undefined;
  const exhibit = cur.kind === 'exhibit' ? cat.byId.get(cur.id) : galleryHead;
  const hue = gallery?.hue ?? (exhibit ? cat.galleryById.get(exhibit.gallery)?.hue : 30) ?? 30;

  return (
    <div className="mr-overlay" role="dialog" aria-modal="true"
      aria-label={gallery ? `A new gallery has opened: ${gallery.title}` : `Humanity reached: ${exhibit?.title}`}
      style={{ ['--hue' as string]: hue } as CSSProperties} onClick={next} key={cur.kind + cur.id}>
      <div className="mr-dark" />
      <div className="mr-seam" />
      <div className="mr-doors"><span className="l" /><span className="r" /></div>
      <div className="mr-light" />
      {exhibit && <div className="mr-object"><MotifArt motif={exhibit.display.motif} /></div>}
      <div className="mr-text">
        <p className="mono mr-kicker">{gallery ? 'A new gallery has opened' : 'Humanity changed'}</p>
        <h2 className="mr-title">{gallery ? gallery.title : exhibit?.title}</h2>
        <p className="mr-line">{gallery ? gallery.epigraph : exhibit?.change}</p>
        <p className="mono mr-date">{gallery ? `${shortYear(gallery.span.from)} — ${gallery.span.to >= 2020 ? 'today' : shortYear(gallery.span.to)}` : exhibit?.when.display}</p>
      </div>
      <div className={'mr-continue' + (ready ? ' on' : '')} aria-hidden={!ready}>
        <span className="mr-key" /><span className="mono">Enter the gallery</span>
      </div>
      <button type="button" className="mr-skip mono" onClick={e => { e.stopPropagation(); skipAll(); }}>Skip</button>
    </div>
  );
}
