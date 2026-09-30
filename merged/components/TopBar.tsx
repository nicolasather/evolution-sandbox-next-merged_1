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

/** The face of a corner tile: one square, hairline, single-colour line drawing.
 *  Strokes use currentColor (see the .tile block in app/_cinematic.css) and every
 *  shape has pathLength=1 so it can draw itself in on hover. */
function TileArt({ tone }: { tone: Tone }) {
  const P = { pathLength: 1 } as const;
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {tone === 'minpath' && (
        <>
          <path {...P} d="M12 38h10V24h14V12" />
          <rect {...P} x="4" y="34" width="8" height="8" />
          <rect {...P} x="32" y="4" width="8" height="8" />
          <rect className="fill" x="20" y="22" width="4" height="4" />
        </>
      )}
      {tone === 'museum' && (
        <>
          <path {...P} d="M5 18 24 6l19 12z" />
          <path {...P} d="M11 22v14M19 22v14M29 22v14M37 22v14" />
          <path {...P} d="M5 41h38" />
        </>
      )}
      {tone === 'hub' && (
        <>
          <rect {...P} x="6" y="6" width="15" height="15" />
          <rect {...P} x="27" y="6" width="15" height="15" />
          <rect {...P} x="6" y="27" width="15" height="15" />
          <rect className="fill" x="30" y="30" width="9" height="9" />
        </>
      )}
      {tone === 'trade' && (
        <>
          <path {...P} d="M6 15h34M33 8l7 7-7 7" />
          <path {...P} d="M42 33H8M15 26l-7 7 7 7" />
        </>
      )}
      {tone === 'lab' && (
        <>
          <path {...P} d="M17 5h14M20 5v15L7 41h34L28 20V5" />
          <path {...P} d="M12 32h24" />
          <rect className="fill" x="21" y="26" width="3" height="3" />
        </>
      )}
      {tone === 'journal' && (
        <>
          <path {...P} d="M5 9h16a3 3 0 0 1 3 3v29a4 4 0 0 0-4-4H5z" />
          <path {...P} d="M43 9H27a3 3 0 0 0-3 3v29a4 4 0 0 1 4-4h15z" />
        </>
      )}
    </svg>
  );
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
