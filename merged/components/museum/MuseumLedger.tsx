'use client';

import { useMemo } from 'react';
import type { Catalog } from '@/lib/museum/history/data';
import { isEligible } from '@/lib/museum/history/selectors';
import { museumStore } from '@/lib/museum/history/store';
import { formatYear } from '@/lib/museum/history/timeline';
import { CATEGORIES, type Year } from '@/lib/museum/history/types';
import { CATEGORY_LABEL, categoryColor } from './labels';

/* The Curator's Ledger — the Museum's numbers, kept in one secondary room on
   purpose (no progress bars anywhere else). Counts, not a checklist. */

export function MuseumLedger({ cat, year }: { cat: Catalog; year: Year }) {
  const m = museumStore.metrics(cat);
  const byCat = useMemo(() => CATEGORIES.map(c => ({
    c, n: cat.exhibits.filter(e => e.categories[0] === c && isEligible(e, year)).length,
  })).filter(x => x.n > 0).sort((a, b) => b.n - a.n), [cat, year]);
  const open = cat.galleries.filter(g => year >= (cat.galleryOpensAt.get(g.id) ?? g.span.from));

  return (
    <div className="lg">
      <header className="lg-head">
        <p className="mono lg-eyebrow">Curator&rsquo;s Ledger</p>
        <h2 className="lg-title">The collection so far</h2>
        <p className="lg-sub">Humanity&rsquo;s timeline stands at <b>{formatYear(year)}</b>.</p>
      </header>
      <dl className="lg-grid">
        <div><dt className="mono">Achievements on display</dt><dd>{m.available}</dd></div>
        <div><dt className="mono">Seen in the halls</dt><dd>{m.revealed}</dd></div>
        <div><dt className="mono">Visited up close</dt><dd>{m.visited}</dd></div>
        <div><dt className="mono">Read in full</dt><dd>{m.detailOpened}</dd></div>
        <div><dt className="mono">Major achievements met</dt><dd>{m.majorEncountered} <small>of {m.majorAvailable} reached</small></dd></div>
        <div><dt className="mono">Galleries open</dt><dd>{m.galleriesOpen}</dd></div>
        <div><dt className="mono">Parts of the world represented</dt><dd>{m.regionsRepresented}</dd></div>
      </dl>
      <section className="lg-section">
        <h3 className="mono">Periods reached</h3>
        <ol className="lg-periods">{open.map(g => <li key={g.id}>{g.title}</li>)}</ol>
      </section>
      <section className="lg-section">
        <h3 className="mono">By field</h3>
        <ul className="lg-cats">
          {byCat.map(x => (
            <li key={x.c}><i style={{ background: categoryColor(x.c) }} /><span>{CATEGORY_LABEL[x.c]}</span><span className="mono">{x.n}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
