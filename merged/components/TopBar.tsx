'use client';

import { useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { AnimatedCount } from './vengeance/animated-count';
import { Kbd } from './vengeance/kbd';
import { Glyph } from './Glyph';
import { ReactiveLabel } from './fx/ReactiveLabel';
import { ThemeToggle } from './ThemeToggle';
import { FullscreenButton } from './FullscreenButton';
import { WorldChip } from './world/WorldChip';
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

type Tone = 'minpath' | 'museum' | 'hub' | 'trade' | 'lab' | 'journal';

/** The drawn face of a corner tile: a small, lit, layered picture — not an icon glyph.
 *  Fills come from the tile's own --a1…--a4 (see the .tile block in app/_cinematic.css). */
function TileArt({ tone }: { tone: Tone }) {
  switch (tone) {
    case 'minpath':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path className="s1" d="M14 50C26 50 18 32 32 32S40 16 50 14" />
          <circle className="a1" cx="14" cy="50" r="8" /><circle className="a3" cx="14" cy="50" r="3.5" />
          <circle className="a2 float" cx="32" cy="32" r="5" />
          <circle className="a4" cx="50" cy="14" r="9" /><circle className="a3" cx="50" cy="14" r="3.5" />
        </svg>
      );
    case 'museum':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path className="a1" d="M6 24 32 8l26 16z" />
          <rect className="a2" x="10" y="27" width="8" height="22" rx="1.5" /><rect className="a2" x="21" y="27" width="8" height="22" rx="1.5" />
          <rect className="a2" x="35" y="27" width="8" height="22" rx="1.5" /><rect className="a2" x="46" y="27" width="8" height="22" rx="1.5" />
          <rect className="a1" x="5" y="51" width="54" height="7" rx="2" />
          <circle className="a4 float" cx="32" cy="19" r="3" />
        </svg>
      );
    case 'hub':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path className="a3" d="M32 52 6 40l26-12 26 12z" transform="translate(0 6)" />
          <path className="a2" d="M32 46 6 34l26-12 26 12z" transform="translate(0 2)" />
          <path className="a1" d="M32 36 6 24 32 12l26 12z" />
          <circle className="a4 float" cx="32" cy="24" r="4" />
        </svg>
      );
    case 'trade':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle className="a4" cx="32" cy="32" r="10" /><circle className="a3" cx="32" cy="32" r="4" />
          <path className="s1" d="M8 20h40M40 12l8 8-8 8" />
          <path className="s1" d="M56 44H16M24 36l-8 8 8 8" />
        </svg>
      );
    case 'lab':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path className="a1" d="M26 6h12v4h-3v16l15 26a5 5 0 0 1-4.4 7.5H18.4A5 5 0 0 1 14 52l15-26V10h-3z" />
          <path className="a4" d="M19 46h26l5.4 9.4a3 3 0 0 1-2.6 4.6H16.2a3 3 0 0 1-2.6-4.6z" />
          <circle className="a1 float" cx="30" cy="40" r="3" /><circle className="a2 float" cx="37" cy="34" r="2.2" />
        </svg>
      );
    case 'journal':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path className="a3" d="M8 14c8-4 16-4 24 2v38c-8-6-16-6-24-2z" />
          <path className="a2" d="M56 14c-8-4-16-4-24 2v38c8-6 16-6 24-2z" />
          <path className="s4" d="M14 25c4-1 8-1 12 1M14 34c4-1 8-1 12 1M38 26c4-2 8-2 12-1M38 35c4-2 8-2 12-1" />
          <path className="a4" d="M44 4h8v22l-4-3.5L44 26z" />
        </svg>
      );
  }
}

function Tile({
  id, tone, cap, label, pressed, className, onClick,
}: {
  id: string; tone: Tone; cap: string; label: string; pressed?: boolean; className?: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={'tile' + (className ? ' ' + className : '')}
      id={id}
      data-tone={tone}
      data-cap={cap}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className="tile-art"><TileArt tone={tone} /></span>
    </button>
  );
}

export function TopBar({
  engine, view, onView, onOpen, onReset, onShortcuts, onJournal, onWorld, onHub, onTrade, onLab, onMuseum, onMinPath,
}: {
  engine: Engine;
  view: ViewId;
  onView: (v: ViewId) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
  onShortcuts: () => void;
  onJournal: () => void;
  onWorld: () => void;
  onHub: () => void;
  onTrade: () => void;
  onLab: () => void;
  onMuseum: () => void;
  onMinPath: () => void;
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

      <WorldChip engine={engine} onOpen={onWorld} />

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
        <div className="dock">
          <Tile id="minpath-open" tone="minpath" cap="Minimum Path" label="Minimum Path challenge"
            pressed={view === 'minpath'} className="max-[900px]:hidden" onClick={onMinPath} />
          <Tile id="museum-open" tone="museum" cap="Museum" label="Museum"
            pressed={view === 'museum'} className="max-[900px]:hidden" onClick={onMuseum} />
          <Tile id="hub-open" tone="hub" cap="Modes" label="Mode Hub"
            pressed={view === 'hub'} onClick={onHub} />
          <Tile id="trade-open" tone="trade" cap="Trade" label="Trade"
            className="max-[900px]:hidden" onClick={onTrade} />
          <Tile id="lab-open" tone="lab" cap="Laboratory" label="Laboratory"
            className="max-[900px]:hidden" onClick={onLab} />
          <Tile id="journal-open" tone="journal" cap="Journal" label="Your journal"
            className="max-[900px]:hidden" onClick={onJournal} />
        </div>
        <div className="util">
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
      </div>
    </header>
  );
}
