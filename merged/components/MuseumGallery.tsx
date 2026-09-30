'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { Engine } from '@/lib/engine';
import { ARCHIVE_STORES, archiveSections } from '@/lib/museum/archive';
import { catalog } from '@/lib/museum/history/data';
import { storyChapters } from '@/lib/museum/history/selectors';
import { museumStore } from '@/lib/museum/history/store';
import { engineTimeline, formatYear } from '@/lib/museum/history/timeline';
import { unlockOf } from '@/lib/museum/history/util';
import { personalDiscoveries } from '@/lib/museum/personal';
import { sound } from '@/lib/sound';
import { ExhibitFocus } from './museum/ExhibitFocus';
import { HumanityHall, type HallTarget } from './museum/HumanityHall';
import { hallLayout } from './museum/layout';
import { ModeArchiveWing } from './museum/ModeArchiveWing';
import { MuseumAtrium, type Place } from './museum/MuseumAtrium';
import { MuseumLedger } from './museum/MuseumLedger';
import { MuseumReveal } from './museum/MuseumReveal';
import { PersonalWing } from './museum/PersonalWing';
import { WorldHistory } from './museum/WorldHistory';

/* ============================================================================
   THE MUSEUM — one building, three separate kinds of knowledge:

     HUMANITY MUSEUM  canonical real-world achievements, opened ONLY by the
                      canonical timeline (lib/museum/history/). The centre
                      of the building: a walkable hall through history.
     YOUR OWN HISTORY the player's own discoveries (lib/museum/personal/).
     RECORDS          what the extra modes produced (lib/museum/archive/).

   Nothing here is a grid of cards: the atrium's doorways lead into distinct
   wings; the Humanity hall is a spatial corridor whose rooms open as history
   advances. This file only orchestrates places, focus, the story tour and the
   one-time reveals; every wing lives in components/museum/.
   (The file keeps its historical name so existing imports stay valid.)
   ========================================================================== */

const PLACE_LABEL: Record<Place, string> = {
  atrium: 'Atrium', humanity: 'The Humanity Museum', personal: 'Your Own History',
  records: 'Records', world: 'World History', ledger: 'Curator’s Ledger',
};

const STORY_STEP_MS = 9000;

export function MuseumGallery({ engine, version, active, onOpen, blocked = false }: {
  engine: Engine;
  version: number;
  active: boolean;
  /** Opens a Main Evolution discovery in the game's own exhibit drawer. */
  onOpen: (id: string) => void;
  /** Something (the cinematic gate) is covering the screen: hold reveals until it clears. */
  blocked?: boolean;
}) {
  const cat = catalog();
  const pos = engineTimeline(engine);
  const year = pos.year;
  void version;
  const storeVersion = useSyncExternalStore(museumStore.subscribe, museumStore.getVersion, () => 0);
  const archiveVersion = ARCHIVE_STORES.map(s =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length list, stable order
    useSyncExternalStore(s.subscribe, s.getVersion, () => 0)).reduce((a, b) => a + b, 0);

  // keep the Humanity Museum in step with the canonical timeline (idempotent)
  useEffect(() => { museumStore.load(); museumStore.sync(year, cat); }, [year, cat]);

  const layout = useMemo(() => hallLayout(cat, year), [cat, year]);
  const [place, setPlace] = useState<Place>('atrium');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [target, setTarget] = useState<HallTarget | null>(null);
  const [worldFocus, setWorldFocus] = useState<string | null>(null);
  const [tour, setTour] = useState<number | null>(null);
  const [tourEnd, setTourEnd] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const keyN = useRef(0);
  const jump = useCallback((t: Omit<HallTarget, 'key'>) => setTarget({ ...t, key: ++keyN.current }), []);

  const go = useCallback((p: Place) => {
    sound.sfx('tab', 0.5);
    setPlace(p);
    if (p !== 'humanity') { setTour(null); setTourEnd(false); }
  }, []);

  // one-time reveals, on entering — after the opening gate has cleared
  useEffect(() => {
    if (!active || blocked || revealing) return;
    const t = window.setTimeout(() => { if (museumStore.peekReveal()) setRevealing(true); }, 400);
    return () => window.clearTimeout(t);
  }, [active, blocked, revealing, storeVersion]);

  const onArrive = useCallback((to: { galleryId?: string; exhibitId?: string }) => {
    setPlace('humanity');
    setTour(null);
    if (to.exhibitId) { setFocusId(to.exhibitId); jump({ id: to.exhibitId, instant: true }); }
    else if (to.galleryId) {
      const g = layout.galleries.find(x => x.gallery.id === to.galleryId);
      if (g) { setFocusId(null); jump({ x: g.x0 - 60, instant: true }); }
    }
  }, [layout, jump]);

  // the Human Story tour
  const chapters = useMemo(() => storyChapters(cat, year), [cat, year]);
  const startStory = useCallback(() => {
    if (!chapters.length) return;
    setPlace('humanity');
    setTourEnd(false);
    setTour(0);
  }, [chapters.length]);
  const tourRef = useRef<number | null>(null);
  useEffect(() => { tourRef.current = tour; }, [tour]);
  const stepTour = useCallback((d: number) => {
    const t = tourRef.current;
    if (t === null) return;
    const n = Math.max(0, t + d);
    if (n >= chapters.length) {
      setTour(null);
      setTourEnd(true);
      setFocusId(null);
      jump({ x: layout.frontierX - 500 });
      return;
    }
    setTour(n);
  }, [chapters.length, jump, layout.frontierX]);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (tour === null || paused || !active) return;
    const t = window.setTimeout(() => stepTour(1), STORY_STEP_MS);
    return () => window.clearTimeout(t);
  }, [tour, paused, active, stepTour]);

  // keys: Escape steps back out (focus → hall → atrium); Space drives the tour
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      if (revealing || document.querySelector('.cg')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') {
        if (tour !== null) { setTour(null); return; }
        if (focusId) { setFocusId(null); return; }
        if (place !== 'atrium') { setPlace('atrium'); setTourEnd(false); }
        return;
      }
      if (tour !== null && (e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); e.stopPropagation(); stepTour(1); }
      if (tour !== null && e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); stepTour(-1); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [active, revealing, tour, focusId, place, stepTour]);

  // during the story tour, the chapter's exhibit is the one in focus
  const shownFocus = tour !== null ? chapters[tour]?.exhibit.id ?? null : focusId;
  const focus = shownFocus ? cat.byId.get(shownFocus) : undefined;
  const unseen = museumStore.unseenCount();
  const headline = useMemo(() => {
    const list = cat.exhibits.filter(e => e.importance === 'defining' && unlockOf(e) <= year);
    return list[list.length - 1] ?? null;
  }, [cat, year]);
  const personalCount = active ? personalDiscoveries(engine).length : 0;
  const recordCount = useMemo(() => archiveSections().reduce((n, s) => n + s.records.length, 0), [archiveVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentGallery = layout.galleries.filter(g => g.status === 'open').slice(-1)[0];

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-museum" role="tabpanel" aria-label="Museum"
      data-place={place} style={{ ['--room-hue' as string]: currentGallery?.gallery.hue ?? 30 } as CSSProperties}>
      {active && (
        <div className={`mu mu-${place}`} key={place === 'atrium' ? 'a' : 'b'}>
          {place !== 'atrium' && (
            <header className="mu-bar">
              <button type="button" className="mu-btn" onClick={() => { setTour(null); setFocusId(null); setPlace('atrium'); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
                Atrium
              </button>
              <p className="mu-where">
                <span className="mono">{PLACE_LABEL[place]}</span>
                {place === 'humanity' && <span className="mu-year">timeline · {formatYear(year)}</span>}
              </p>
              {place === 'humanity' && (
                <div className="mu-actions">
                  <button type="button" className="mu-btn" aria-pressed={tour !== null} onClick={() => (tour === null ? startStory() : setTour(null))}>
                    {tour === null ? 'The Human Story' : 'Leave the story'}
                  </button>
                  <button type="button" className="mu-btn" onClick={() => { setWorldFocus(focusId); go('world'); }}>World</button>
                  <button type="button" className="mu-btn" onClick={() => { setFocusId(null); jump({ x: layout.frontierX - 700 }); }}>Latest history</button>
                </div>
              )}
            </header>
          )}

          {place === 'atrium' && (
            <MuseumAtrium cat={cat} year={year} layout={layout} unseen={unseen} headline={headline}
              personalCount={personalCount} recordCount={recordCount} onGo={go} onStory={startStory} />
          )}

          {place === 'humanity' && (
            <>
              <HumanityHall cat={cat} year={year} layout={layout} focusId={shownFocus} active={active && place === 'humanity'}
                onFocus={id => { if (tour !== null) setTour(null); setFocusId(id); if (id) sound.sfx('select', 0.4); }}
                target={target} storeVersion={storeVersion} story={tour !== null} />
              {focus && tour === null && (
                <ExhibitFocus key={focus.id} cat={cat} year={year} exhibit={focus} engine={engine}
                  storyLine={tour !== null ? chapters[tour]?.chapter.line : undefined}
                  onClose={() => { setFocusId(null); setTour(null); }}
                  onGo={id => { setTour(null); setFocusId(id); jump({ id }); }}
                  onShowWorld={id => { setWorldFocus(id); go('world'); }} />
              )}
              {tour !== null && chapters[tour] && (
                <div className="mst" role="region" aria-label="The Human Story">
                  <p className="mono mst-count">{String(tour + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}</p>
                  <p className="mst-line" key={tour}>{chapters[tour].chapter.line}</p>
                  <p className="mono mst-meta">{chapters[tour].exhibit.title} · {chapters[tour].exhibit.when.display}</p>
                  <div className="mst-ctl">
                    <button type="button" className="mu-btn" onClick={() => stepTour(-1)} disabled={tour === 0} aria-label="Previous chapter">←</button>
                    <button type="button" className="mu-btn" onClick={() => setPaused(p => !p)}>{paused ? 'Play' : 'Pause'}</button>
                    <button type="button" className="mu-btn" onClick={() => stepTour(1)} aria-label="Next chapter">→</button>
                  </div>
                  <span className="mst-progress" style={{ ['--p' as string]: (tour + 1) / chapters.length, ['--dur' as string]: `${STORY_STEP_MS}ms` } as CSSProperties}
                    key={`p${tour}${paused}`} data-paused={paused || undefined} />
                </div>
              )}
              {tourEnd && (
                <div className="mst mst-end" role="status">
                  <p className="mst-line">Your timeline stands here.</p>
                  <p className="mono mst-meta">{formatYear(year)} · beyond this light, history is still sealed</p>
                  <div className="mst-ctl"><button type="button" className="mu-btn" onClick={() => setTourEnd(false)}>Stay in the hall</button></div>
                </div>
              )}
            </>
          )}

          {place === 'world' && (
            <WorldHistory key={worldFocus ?? 'world'} cat={cat} year={year} focusExhibit={worldFocus}
              onOpenInHall={id => { setPlace('humanity'); setFocusId(id); jump({ id, instant: true }); }} />
          )}
          {place === 'personal' && (
            <PersonalWing cat={cat} year={year} engine={engine} version={version} onOpenDiscovery={onOpen}
              onOpenExhibit={id => { setPlace('humanity'); setFocusId(id); jump({ id, instant: true }); }} />
          )}
          {place === 'records' && <ModeArchiveWing />}
          {place === 'ledger' && <MuseumLedger cat={cat} year={year} />}

          {revealing && (
            <MuseumReveal cat={cat} onArrive={onArrive} onDone={() => setRevealing(false)} />
          )}
        </div>
      )}
    </section>
  );
}
