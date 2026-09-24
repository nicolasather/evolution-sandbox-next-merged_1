'use client';

import { useSyncExternalStore } from 'react';
import { Kbd } from '../vengeance/kbd';
import { getQuality, qualityPref, setQualityPref, subscribeQuality, type QualityPref } from '@/lib/perf';

const KBD_CLS = 'rounded-none border border-line-2 bg-ink-3 font-mono text-[10px] text-bone-3';

const ROWS: [string, string][] = [
  ['W', 'Workspace'],
  ['G', 'Graph'],
  ['A', 'Archive'],
  ['T', 'Timeline'],
  ['/', 'Search your discoveries'],
  ['Enter', 'Use the discovery just found'],
  ['Esc', 'Close a panel · dismiss an ending · let go of a craft'],
  ['Drag', 'Move, throw and drop things on the bench'],
  ['Space', 'The main action while crafting: hold, strike, press'],
  ['E', 'Interact while crafting: quench, place, link'],
  ['R', 'Turn the piece in hand (Shift turns it back)'],
  ['Wheel', 'Turn a piece · zoom the bench'],
  ['Right-click', 'Open, find in graph, or place a discovery'],
  ['Long-press', 'Same menu, for touch'],
  ['?', 'Show or hide this list'],
];

/** Presentational only — Sandbox's own keydown handler owns opening and
 *  closing this (including Escape and the ? toggle), so a stray Escape here
 *  can never also fire the game's own Escape handling underneath it. */
export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pref = useSyncExternalStore(subscribeQuality, qualityPref, () => 'auto' as QualityPref);
  const tier = useSyncExternalStore(subscribeQuality, getQuality, () => 'medium');
  if (!open) return null;

  return (
    <div
      className="confirm"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div className="confirm-box">
        <p className="mono confirm-k">Shortcuts</p>
        <dl className="shortcuts-list">
          {ROWS.map(([k, d]) => (
            <div key={k} className="shortcuts-row">
              <dt><Kbd className={KBD_CLS}>{k}</Kbd></dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <div className="quality-row" role="group" aria-label="Visual quality">
          <span className="mono">Effects</span>
          {(['auto', 'high', 'medium', 'low'] as QualityPref[]).map(q => (
            <button key={q} type="button" className="chip" aria-pressed={pref === q} onClick={() => setQualityPref(q)}>
              {q === 'auto' ? `Auto · ${tier}` : q}
            </button>
          ))}
        </div>
        <div className="confirm-row">
          <button type="button" className="chip" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
