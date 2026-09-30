'use client';

import { useMemo } from 'react';
import { Glyph } from '../Glyph';
import type { Engine } from '@/lib/engine';
import type { Catalog } from '@/lib/museum/history/data';
import { isEligible } from '@/lib/museum/history/selectors';
import { formatYear } from '@/lib/museum/history/timeline';
import type { HistoricalExhibit, Year } from '@/lib/museum/history/types';
import { comparePath, personalDiscoveries } from '@/lib/museum/personal';
import { comparisonLine } from './labels';

/* ============================================================================
   YOUR OWN HISTORY — the Personal Discovery wing. What this player actually
   crafted or discovered in Main Evolution, in the order it happened, kept
   visibly apart from humanity's record: warmer, handwritten in feel, laid
   out as a trail rather than as a collection of museum objects.

   Where a discovery corresponds to a canonical exhibit that humanity has
   already reached on the timeline, a quiet cross-reference compares the two.
   A discovery made "ahead of its time" is marked as such — without naming or
   unlocking the future exhibit.
   ========================================================================== */

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function PersonalWing({ cat, year, engine, version, onOpenDiscovery, onOpenExhibit }: {
  cat: Catalog;
  year: Year;
  engine: Engine;
  version: number;
  onOpenDiscovery: (id: string) => void;
  onOpenExhibit: (id: string) => void;
}) {
  // exhibits indexed by the discovery ids they correspond to
  const byDiscovery = useMemo(() => {
    const m = new Map<string, HistoricalExhibit[]>();
    for (const e of cat.exhibits) for (const d of e.discoveryIds ?? []) m.set(d, [...(m.get(d) ?? []), e]);
    return m;
  }, [cat]);
  const mine = useMemo(() => personalDiscoveries(engine), [engine, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const eras = useMemo(() => {
    const out: { era: string; name: string; list: typeof mine }[] = [];
    for (const d of mine) {
      const last = out[out.length - 1];
      if (last && last.era === d.node.era) last.list.push(d);
      else out.push({ era: d.node.era, name: engine.db.eras.find(e => e.id === d.node.era)?.name ?? d.node.era, list: [d] });
    }
    return out;
  }, [mine, engine]);
  const majors = mine.filter(d => d.isMajor).length;

  return (
    <div className="pw">
      <header className="pw-head">
        <p className="mono pw-eyebrow">Personal Discovery Archive</p>
        <h2 className="pw-title">Your Own History</h2>
        <p className="pw-sub">
          Everything you have discovered in Main Evolution, in the order you found it. This is your path through
          the sandbox — it is kept apart from humanity&rsquo;s record, and never changes it.
        </p>
        <dl className="pw-stats">
          <div><dt className="mono">Discoveries</dt><dd>{mine.length}</dd></div>
          <div><dt className="mono">Major inventions</dt><dd>{majors}</dd></div>
          <div><dt className="mono">First</dt><dd>{mine[0]?.node.n ?? '—'}</dd></div>
          <div><dt className="mono">Latest</dt><dd>{mine[mine.length - 1]?.node.n ?? '—'}</dd></div>
        </dl>
      </header>

      {mine.length === 0 && <p className="pw-empty">Nothing yet. Your first discovery on the workbench will begin this trail.</p>}

      <ol className="pw-trail">
        {eras.map(block => (
          <li key={block.era + block.list[0].index} className="pw-era">
            <p className="mono pw-era-name">{block.name}</p>
            <ol>
              {block.list.map(d => {
                const ex = (byDiscovery.get(d.id) ?? [])[0];
                const reached = ex ? isEligible(ex, year) : false;
                const cmp = ex && d.timelineYear !== null ? comparePath(d.timelineYear, ex) : null;
                return (
                  <li key={d.id} className={'pw-item' + (d.isMajor ? ' major' : '')}>
                    <span className="mono pw-no">{String(d.index).padStart(3, '0')}</span>
                    <button type="button" className="pw-glyph" onClick={() => onOpenDiscovery(d.id)} aria-label={`Open ${d.node.n}`}>
                      <Glyph node={d.node} />
                    </button>
                    <div className="pw-body">
                      <button type="button" className="pw-name" onClick={() => onOpenDiscovery(d.id)}>{d.node.n}</button>
                      <p className="mono pw-when">
                        {d.foundAt ? dateFmt.format(d.foundAt) : 'found'}
                        {d.timelineYear !== null && <> · your timeline ≈ {formatYear(d.timelineYear)}</>}
                      </p>
                      {ex && reached && (
                        <p className="pw-xref">
                          In the Humanity Museum: <button type="button" onClick={() => onOpenExhibit(ex.id)}>{ex.title}</button>
                          <span className="mono"> · {ex.when.display}</span>
                          {cmp && <span className="pw-cmp"> {comparisonLine(cmp)}</span>}
                        </p>
                      )}
                      {ex && !reached && (
                        <p className="pw-xref ahead">You reached this ahead of humanity&rsquo;s timeline. Its place in the Museum is still sealed.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {mine.length > 0 && <p className="pw-note">Comparisons with real history are approximate: the game&rsquo;s timeline is a simplification.</p>}
    </div>
  );
}
