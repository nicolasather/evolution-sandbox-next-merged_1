'use client';

import { useState } from 'react';
import { AnimatedCount } from './vengeance/animated-count';
import { Kbd } from './vengeance/kbd';
import { Glyph } from './Glyph';
import { ThemeToggle } from './ThemeToggle';
import type { Engine } from '@/lib/engine';
import type { Discovery, ViewId } from '@/lib/types';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'work', label: 'Workspace' },
  { id: 'graph', label: 'Graph' },
  { id: 'arch', label: 'Archive' },
];

export function TopBar({
  engine, view, onView, onOpen, onReset,
}: {
  engine: Engine;
  view: ViewId;
  onView: (v: ViewId) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  const s = engine.stats();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const found = q.trim() ? engine.search(q, 10) : { hits: [] as Discovery[], hiddenMatches: 0 };
  const results = found.hits;
  const showList = open && q.trim().length > 0;
  const reached = new Set(engine.erasReached().map(e => e.id));

  return (
    <header id="top">
      <div className="top-slot">
        <div className="counter">
          <AnimatedCount value={s.core} pad={3} className="big" />
          <span className="of" aria-label={`of ${s.coreTotal} core items`}>/ {s.coreTotal}</span>
        </div>
        <div className="tick-row" aria-hidden="true">
          {engine.db.eras.map((e, i) => (
            <i
              key={e.id}
              className={'tick' + (reached.has(e.id) ? ' on' : '')}
              style={{ height: (reached.has(e.id) ? 8 + i * 0.7 : 4) + 'px' }}
              title={e.name}
            />
          ))}
        </div>
      </div>

      <div className="top-slot" id="slot-era" aria-live="polite">
        <span className="mono" style={{ color: 'var(--bone-4)' }}>ERA</span>
        <span className="era-now">{engine.currentEra().name}</span>
      </div>

      <div className="top-slot" id="slot-hidden" title="Hidden discoveries">
        <span className="mono" style={{ color: 'var(--bone-4)' }} aria-hidden="true">HIDDEN</span>
        <span className="num" style={{ fontSize: 12 }} aria-label={`${s.hidden} hidden items found out of ${s.hiddenTotal}`}>{s.hidden}/{s.hiddenTotal}</span>
      </div>

      <nav className="tabs top-spacer" id="tabs" role="tablist" aria-label="Views">
        {VIEWS.map(v => (
          <button
            key={v.id}
            className="tab"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => onView(v.id)}
            aria-controls={`${v.id}-view`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <div className="top-slot" id="slot-search" style={{ position: 'relative' }}>
        <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none"
          style={{ color: 'var(--bone-4)', flex: 'none' }} aria-hidden="true">
          <circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" />
        </svg>
        <span className="searchbox">
          <input
            id="s-q"
            role="combobox"
            type="search"
            value={q}
            placeholder="Search"
            aria-label="Search your discoveries"
            aria-keyshortcuts="/"
            autoComplete="off"
            aria-expanded={showList}
            aria-controls="s-results"
            aria-owns="s-results"
            aria-autocomplete="list"
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          />
          <Kbd aria-hidden="true" className="rounded-none border border-line-2 bg-ink-3 font-mono text-[10px] text-bone-3 max-[900px]:hidden">/</Kbd>
        </span>
        {showList && (
          <div id="s-results" role="listbox" aria-label="Search results">
            {results.map(n => (
              <button
                key={n.id}
                className="item"
                role="option"
                aria-selected="false"
                // keep focus in the input so its blur does not hide the list before the click lands
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onOpen(n.id); setQ(''); setOpen(false); }}
              >
                <Glyph node={n} />
                <span className="nm">{n.n}</span>
                <span className="no mono" aria-hidden="true">{String(n.no).padStart(3, '0')}</span>
              </button>
            ))}
            {results.length === 0 && found.hiddenMatches === 0 && (
              <p className="s-note mono">Nothing by that name — in your collection or out of it.</p>
            )}
            {found.hiddenMatches > 0 && (
              <p className="s-note mono">
                {found.hiddenMatches} undiscovered {found.hiddenMatches === 1 ? 'entry matches' : 'entries match'}. Keep going.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="top-slot top-actions">
        <ThemeToggle />
        <button className="icon-btn" id="reset" aria-label="Start over (Reset progress)" title="Start over" onClick={onReset}>
          <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none" aria-hidden="true">
            <path d="M14 8A6 6 0 1 1 8 2c2 0 3.7 1 4.7 2.5" /><path d="M13 1v4h-4" />
          </svg>
        </button>
      </div>
    </header>
  );
}
