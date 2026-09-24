'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Glyph } from './Glyph';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';
import { cn } from '@/lib/utils';

/* ============================================================================
   TIMELINE — the same discoveries, laid out along time.

   One horizontal rail, era after era. A find you have made stands on the rail
   with its name and its real date (the `date` field, exactly as recorded);
   entries you have not found are unnamed ticks, so the rail shows how much
   is still ahead without saying what. Within an era entries are ordered by
   their recorded signed year. The spacing between points is even, not to
   scale — deep time and the last two centuries cannot share one axis.
   ========================================================================== */

interface Column { eraId: string; name: string; blurb: string; found: Discovery[]; ahead: number; items: (Discovery | null)[] }

export function TimelineView({
  engine, version, active, focusId, onOpen,
}: {
  engine: Engine; version: number; active: boolean; focusId: string | null; onOpen: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  const cols = useMemo<Column[]>(() => {
    return engine.db.eras.map(e => {
      const all = engine.db.nodes
        .filter(n => n.era === e.id && !(n.hidden && !engine.has(n.id)))   // hidden finds stay hidden until found
        .slice().sort((a, b) => (a.ds - b.ds) || (a.no - b.no));
      const found = all.filter(n => engine.has(n.id));
      return {
        eraId: e.id, name: e.name, blurb: e.blurb, found, ahead: all.length - found.length,
        items: all.map(n => (engine.has(n.id) ? n : null)),
      };
    });
    // version: the rail fills in as the player finds more
  }, [engine, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // first time it opens: bring the latest era into view
  useEffect(() => {
    if (!active || placed.current) return;
    const el = scroller.current;
    if (!el) return;
    placed.current = true;
    let last = 0;
    cols.forEach((c, i) => { if (c.found.length) last = i; });
    const target = el.querySelector<HTMLElement>(`[data-era="${cols[last]?.eraId}"]`);
    if (target) el.scrollLeft = Math.max(0, target.offsetLeft - 40);
  }, [active, cols]);

  // a vertical wheel scrolls the rail sideways
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // opening an exhibit from elsewhere brings its point into view
  useEffect(() => {
    if (!active || !focusId) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active, focusId]);

  const total = cols.reduce((n, c) => n + c.found.length, 0);

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-time" role="tabpanel" aria-label="Timeline">
      <header className="tl-head">
        <h2 className="g-title">Timeline</h2>
        <p className="g-sub">
          {total === 0
            ? 'Nothing here yet. Make something, and it will take its place on the rail.'
            : 'Your finds, in the order the record gives them. Spacing is even, not to scale.'}
        </p>
      </header>
      <div className="tl-scroll" ref={scroller} tabIndex={0} aria-label="Timeline, scroll sideways">
        <div className="tl-rail" aria-hidden="true" />
        {cols.map(c => (
          <div className={cn('tl-era', c.found.length === 0 && 'empty')} data-era={c.eraId} key={c.eraId}>
            <div className="tl-era-h mono">
              <b>{c.name}</b>
              <span>{c.found.length ? `${c.found.length} found` : 'not reached'}{c.ahead > 0 && c.found.length ? ` · ${c.ahead} ahead` : ''}</span>
            </div>
            <ol className="tl-pts">
              {c.items.map((n, i) => n ? (
                <li key={n.id} className={cn('tl-pt', i % 2 ? 'dn' : 'up', n.id === focusId && 'sel')} data-id={n.id}
                    style={{ ['--i' as string]: Math.min(i, 24) }}>
                  <button onClick={() => onOpen(n.id)} aria-label={`${n.n}, ${n.date}`}>
                    <span className="tl-card">
                      <Glyph node={n} />
                      <span className="tl-name">{n.n}</span>
                      <span className="tl-date mono">{n.date}</span>
                    </span>
                    <span className="tl-stem" />
                    <span className={cn('tl-dot', `r-${n.rar}`)} />
                  </button>
                </li>
              ) : (
                <li key={`u${i}`} className="tl-pt ahead" aria-hidden="true"><span className="tl-tick" /></li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
