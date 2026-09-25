'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { AnimatedCount } from './vengeance/animated-count';
import { Kbd } from './vengeance/kbd';
import { Glyph } from './Glyph';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { ThemeToggle } from './ThemeToggle';
import { FullscreenButton } from './FullscreenButton';
import { sound } from '@/lib/sound';
import type { Engine } from '@/lib/engine';
import type { Discovery, ViewId } from '@/lib/types';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'work', label: 'Workspace' },
  { id: 'graph', label: 'Graph' },
  { id: 'arch', label: 'Archive' },
  { id: 'time', label: 'Timeline' },
];

/** SOUND ON / OFF — the one switch for every sound in the game. */
function SoundButton() {
  const on = useSyncExternalStore(sound.subscribe, sound.enabled, () => true);
  return (
    <button
      className="icon-btn"
      id="sound-toggle"
      aria-pressed={on}
      aria-label={on ? 'Sound on' : 'Sound off'}
      title={on ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
      onClick={() => { sound.unlock(); sound.set(!on); if (!on) sound.sfx('select'); }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
        {on ? <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.4 3.6a6 6 0 0 1 0 8.8" /> : <path d="M11 6l4 4M15 6l-4 4" />}
      </svg>
    </button>
  );
}

export function TopBar({
  engine, view, onView, onOpen, onReset, onShortcuts, onJournal,
}: {
  engine: Engine;
  view: ViewId;
  onView: (v: ViewId) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
  onShortcuts: () => void;
  onJournal: () => void;
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
          <svg className="hud-ring" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <circle cx="11" cy="11" r="9" className="trk" />
            <circle cx="11" cy="11" r="9" className="val" pathLength={100}
              strokeDasharray={`${Math.max(0.5, (s.core / s.coreTotal) * 100)} 100`} />
          </svg>
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

      <div className="top-slot" id="slot-routes" title="Routes you have walked">
        <span className="mono" style={{ color: 'var(--bone-4)' }} aria-hidden="true">ROUTES</span>
        <AnimatedCount value={s.routesFound} className="num" />
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
            <ReactiveLabel text={v.label} />
            {view === v.id && (
              <motion.span
                layoutId="tab-ind"
                className="tab-ind"
                aria-hidden="true"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
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
        <button
          className="icon-btn max-[900px]:hidden"
          id="journal-open"
          aria-label="Your journal"
          title="Your journal — a personal recap"
          onClick={onJournal}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.4" fill="none" aria-hidden="true">
            <path d="M3 2.5h8a1 1 0 0 1 1 1V14l-2.2-1.4L8 14l-1.8-1.4L4 14V3.5a1 1 0 0 1 1-1Z" />
          </svg>
        </button>
        <button
          className="icon-btn max-[900px]:hidden"
          id="shortcuts"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="?"
          title="Keyboard shortcuts (?)"
          onClick={onShortcuts}
        >
          <span className="mono" aria-hidden="true">?</span>
        </button>
        <SoundButton />
        <ThemeToggle />
        <FullscreenButton />
        <button className="icon-btn" id="reset" aria-label="Start over (Reset progress)" title="Start over" onClick={onReset}>
          <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none" aria-hidden="true">
            <path d="M14 8A6 6 0 1 1 8 2c2 0 3.7 1 4.7 2.5" /><path d="M13 1v4h-4" />
          </svg>
        </button>
      </div>
    </header>
  );
}
