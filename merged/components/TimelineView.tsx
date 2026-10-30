'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Glyph } from './Glyph';
import type { Engine } from '@/lib/engine';
import type { Discovery } from '@/lib/types';
import { sortDiscoveries } from '@/lib/chronology';
import { cn } from '@/lib/utils';

/* ============================================================================
   TIMELINE — the same discoveries, laid out along real chronology.

   ONE global rail, oldest to newest, built from the central comparator
   (lib/chronology.ts) rather than one column per era. Era grouping used to
   run first and dates only inside it, which quietly claimed every entry of
   one era predates every entry of the next — false for Agriculture,
   Settlement, Trade and several others, which overlap in real history. Era
   names now appear as subtle inline dividers wherever the sequence actually
   crosses into a different era (which, honestly, can happen more than once
   for the same era if the record interleaves), never as a column boundary
   that reorders anything.

   A find you have made stands on the rail with its name and its real date
   (the `date` field, exactly as recorded); entries you have not found are
   unnamed ticks, so the rail shows how much is still ahead without saying
   what. The spacing between points is ordinal, not to scale — deep time and
   the last two centuries cannot share one linear axis.
   ========================================================================== */

interface Run { eraId: string; name: string; required: number; requiredDone: number; startIndex: number }
interface Row { items: (Discovery | null)[]; majorAt: boolean[]; runs: Run[]; foundCount: number; ahead: number }

export function TimelineView({
  engine, version, active, focusId, onOpen,
}: {
  engine: Engine; version: number; active: boolean; focusId: string | null; onOpen: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  const row = useMemo<Row>(() => {
    const all = sortDiscoveries(
      engine.db.nodes.filter(n => !(n.hidden && !engine.has(n.id))), // hidden finds stay hidden until found
    );
    const items = all.map(n => (engine.has(n.id) ? n : null));
    const majorAt = all.map(n => engine.isMajor(n.id));
    // era dividers: a new one starts whenever the era actually changes along
    // the real chronological sequence — not once per era, but once per
    // contiguous run of it, which is what "overlapping eras" looks like here.
    const runs: Run[] = [];
    all.forEach((n, i) => {
      if (i === 0 || all[i - 1].era !== n.era) {
        const p = engine.eraProgress(n.era);
        const name = engine.db.eras.find(e => e.id === n.era)?.name ?? n.era;
        runs.push({ eraId: n.era, name, required: p.required, requiredDone: p.requiredDone, startIndex: i });
      }
    });
    const foundCount = items.filter(Boolean).length;
    return { items, majorAt, runs, foundCount, ahead: items.length - foundCount };
    // version: the rail fills in as the player finds more
  }, [engine, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // first time it opens: bring the latest find into view
  useEffect(() => {
    if (!active || placed.current) return;
    const el = scroller.current;
    if (!el) return;
    placed.current = true;
    let lastIndex = -1;
    row.items.forEach((n, i) => { if (n) lastIndex = i; });
    if (lastIndex < 0) return;
    const target = el.querySelector<HTMLElement>(`[data-idx="${lastIndex}"]`);
    if (target) el.scrollLeft = Math.max(0, target.offsetLeft - 80);
  }, [active, row]);

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

  return (
    <section className={'view' + (active ? ' on' : '')} id="v-time" role="tabpanel" aria-label="Timeline">
      <header className="tl-head">
        <h2 className="g-title">Timeline</h2>
        <p className="g-sub">
          {row.foundCount === 0
            ? 'Nothing here yet. Make something, and it will take its place on the rail.'
            : 'Your finds, oldest to newest, by their real recorded date. Spacing is ordinal, not to scale.'}
        </p>
      </header>
      <div className="tl-scroll" ref={scroller} tabIndex={0} aria-label="Timeline, scroll sideways">
        <div className="tl-rail" aria-hidden="true" />
        {row.runs.map((run, ri) => {
          const end = row.runs[ri + 1]?.startIndex ?? row.items.length;
          const items = row.items.slice(run.startIndex, end);
          const majorAt = row.majorAt.slice(run.startIndex, end);
          const found = items.filter(Boolean).length;
          const ahead = items.length - found;
          return (
            // key includes the run index: the SAME era can recur later on the
            // rail (real chronology overlaps), so its id alone is not unique.
            <div className={cn('tl-era', found === 0 && 'empty')} data-era={run.eraId} key={`${run.eraId}-${ri}`}>
              <div className="tl-era-h mono">
                <b>{run.name}</b>
                <span>{found ? `${found} found` : 'not reached'}{ahead > 0 && found ? ` · ${ahead} ahead` : ''}</span>
                {run.required > 0 && (
                  <span className={cn('tl-world', run.requiredDone >= run.required && 'done')} title="Major world inventions this era needs before the next one opens">
                    {run.requiredDone >= run.required ? 'Era complete' : `${run.requiredDone}/${run.required} world`}
                  </span>
                )}
              </div>
              <ol className="tl-pts">
                {items.map((n, i) => {
                  const idx = run.startIndex + i;
                  return n ? (
                    <li key={n.id} className={cn('tl-pt', i % 2 ? 'dn' : 'up', n.id === focusId && 'sel', majorAt[i] && 'major')}
                        data-id={n.id} data-idx={idx} style={{ ['--i' as string]: Math.min(i, 24) }}>
                      <button onClick={() => onOpen(n.id)} aria-label={`${n.n}, ${n.date}${majorAt[i] ? ', major world invention' : ''}`}>
                        <span className="tl-card">
                          <Glyph node={n} />
                          <span className="tl-name">{n.n}</span>
                          <span className="tl-date mono">{n.date}</span>
                          {majorAt[i] && <span className="tl-flag mono">World milestone</span>}
                        </span>
                        <span className="tl-stem" />
                        <span className={cn('tl-dot', `r-${n.rar}`)} />
                      </button>
                    </li>
                  ) : (
                    <li key={`u${idx}`} className={cn('tl-pt ahead', majorAt[i] && 'major')} data-idx={idx} aria-hidden="true"><span className="tl-tick" /></li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
