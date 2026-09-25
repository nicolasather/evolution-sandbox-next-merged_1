'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { ACTIONS } from '@/lib/processing/actions';
import { FAMILIES, inFamily } from '@/lib/processing/techniques';
import type { ActionId } from '@/lib/types';
import { LockedMark, TechniqueIcon } from './TechniqueIcon';

/* ============================================================================
   ACTION RAIL — the techniques the hands can perform, at the edge of the
   workspace so the middle stays for play. Down the right edge on a desktop,
   along the bottom on a phone; grouped by family; folds away to a single tab.

   Only what has been learned is a button. Under each family a row of small "?"
   marks says how many are still to find — a count, never a name — and a
   technique that has just been learned pulses until it has been used.
   ========================================================================== */

const PREF = 'evo.rail.folded';
const readFolded = (): boolean => { try { return window.localStorage.getItem(PREF) === '1'; } catch { return false; } };
// a tiny store for the folded preference, so the server render and the first client render agree
const listeners = new Set<() => void>();
const subscribeFolded = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const setFolded = (v: boolean) => {
  try { window.localStorage.setItem(PREF, v ? '1' : '0'); } catch { /* ignore */ }
  listeners.forEach(l => l());
};

interface Props {
  engine: Engine;
  mode: ActionId | null;
  /** A hint leans on this action: its button pulses. */
  hintAction?: ActionId | null;
  working: boolean;
  onPick: (a: ActionId | null) => void;
  onDo: () => void;
}

export function ActionRail({ engine, mode, hintAction = null, working, onPick, onDo }: Props) {
  useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
  const folded = useSyncExternalStore(subscribeFolded, readFolded, () => false);
  const toggle = useCallback(() => setFolded(!readFolded()), []);

  const known = new Set(engine.known);
  const learned = known.size;

  return (
    <nav className="wb-rail" data-wb-avoid="off" data-folded={folded ? 'true' : 'false'} aria-label="Techniques: choose how to work one thing">
      <button type="button" className="wb-rail-tab mono" onClick={toggle} aria-expanded={!folded}
        title={folded ? 'Show the techniques' : 'Fold the techniques away'}>
        <span aria-hidden="true">{folded ? (mode ? ACTIONS[mode].label : 'Hands') : 'Hands'}</span>
        <i aria-hidden="true">{folded ? '‹' : '›'}</i>
        <span className="sr">{folded ? 'Show techniques' : 'Hide techniques'}. {learned} of 25 learned.</span>
      </button>

      {!folded && (
        <div className="wb-rail-body" role="toolbar" aria-orientation="vertical">
          {FAMILIES.map(f => (
            <div key={f.id} className="wb-rail-group" data-family={f.id} role="group" aria-label={`${f.label}: ${f.blurb}`}>
              <span className="wb-rail-h mono" aria-hidden="true">{f.label}</span>
              <div className="wb-rail-row">
                {inFamily(f.id).filter(t => known.has(t.id)).map(t => {
                  const a = ACTIONS[t.id];
                  const isNew = engine.isNewTech(t.id);
                  return (
                    <button key={t.id} type="button" className="wb-act" data-a={t.id}
                      aria-pressed={mode === t.id}
                      data-hint={hintAction === t.id ? '' : undefined}
                      data-new={isNew ? '' : undefined}
                      title={`${a.label} (${a.key.toUpperCase()}) — ${a.gesture}. ${a.blurb}`}
                      onClick={() => { engine.usedTech(t.id); onPick(mode === t.id ? null : t.id); }}>
                      <TechniqueIcon id={t.id} />
                      <span className="mono">{a.label}</span>
                    </button>
                  );
                })}
                {(() => {
                  const left = inFamily(f.id).filter(t => !known.has(t.id)).length;
                  if (!left) return null;
                  return (
                    <span className="wb-locked-chip" role="img"
                      aria-label={`${left} more ${left === 1 ? 'technique' : 'techniques'} to find in this family`}
                      title="Techniques you have not found yet. Keep experimenting.">
                      {Array.from({ length: left }, (_, i) => <LockedMark key={i} size={13} />)}
                    </span>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
      {!folded && mode && (
        <button type="button" className="wb-act wb-do mono" onClick={onDo}
          title="Do the work on the piece you are pointing at (Enter)">
          {working ? 'Finish it' : 'Do it for me'}
        </button>
      )}
    </nav>
  );
}
