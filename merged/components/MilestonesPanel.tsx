'use client';

import { useEffect, useRef } from 'react';
import type { Engine } from '@/lib/engine';
import { ERA_IDS, FEATURES, featureOfMode, unlockedFor, type Feature, type FeatureId } from '@/lib/unlocks/registry';
import { progressOf, type Unlocks } from '@/lib/unlocks/useUnlocks';
import { MODES } from '@/lib/modes/registry';
import { cn } from '@/lib/utils';

/* ============================================================================
   MILESTONES — one calm page that says how far the player has come and which
   doors (tools and modes) are open, in the order history opens them.

   Read-only and DERIVED: everything here comes from the engine and the unlock
   rules (lib/unlocks/registry.ts), the same inputs the game itself uses, so it
   can never drift from real progress and "Start over" clears it by itself.
   Nothing is saved by this panel.

   In the Developer Beta, `unlockAll` can hold a door open that the player has
   not earned: it is shown as "open (beta)", never as earned.
   ========================================================================== */

type Door = 'done' | 'next' | 'locked';

const isMode = (id: FeatureId) => id.startsWith('mode:') || id === 'minpath';

export function MilestonesPanel({
  open, engine, unlocks, onClose,
}: {
  open: boolean;
  engine: Engine;
  unlocks: Pick<Unlocks, 'has'>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' || ((ev.key === 'p' || ev.key === 'P') && !ev.metaKey && !ev.ctrlKey && !ev.altKey)) {
        ev.preventDefault(); ev.stopPropagation(); onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const progress = progressOf(engine);
  const earned = unlockedFor(progress);
  const stats = engine.stats();
  const world = engine.worldSummary();
  const eras = engine.db.eras.map(e => engine.eraProgress(e.id));
  const eraName = (id: string) => engine.db.eras.find(e => e.id === id)?.name ?? id;
  const current = engine.currentEra();

  /** What still stands between the player and this door, in one short line (null when earned). */
  const missing = (f: Feature): { text: string; done: number; total: number } | null => {
    if (earned.has(f.id)) return null;
    const parts: string[] = [];
    let done = 0, total = 0;
    if (f.rule.made !== undefined && progress.made < f.rule.made) {
      parts.push(`make ${f.rule.made - progress.made} more ${f.rule.made - progress.made === 1 ? 'discovery' : 'discoveries'}`);
      done = progress.made; total = f.rule.made;
    }
    if (f.rule.era !== undefined) {
      const target = ERA_IDS.indexOf(f.rule.era as (typeof ERA_IDS)[number]);
      if (target >= 0 && progress.eraIndex < target) {
        // the first era before the goal that still has required inventions to find
        const blocker = eras.slice(0, target).find(e => e.required > 0 && !e.complete);
        if (blocker) {
          const left = blocker.required - blocker.requiredDone;
          parts.push(`finish ${blocker.name} (${left} major ${left === 1 ? 'invention' : 'inventions'} left)`);
          done = blocker.requiredDone; total = blocker.required;
        } else {
          parts.push(`find a first discovery in ${eraName(f.rule.era)}`);
        }
      }
    }
    const s = parts.join(', then ');
    return { text: s.charAt(0).toUpperCase() + s.slice(1), done, total };
  };

  const nextId = FEATURES.find(f => !earned.has(f.id))?.id ?? null;
  const doorOf = (f: Feature): Door => (earned.has(f.id) ? 'done' : f.id === nextId ? 'next' : 'locked');
  const viaBeta = (f: Feature) => !earned.has(f.id) && unlocks.has(f.id);

  const modeRows = MODES.filter(m => m.status === 'available').map(m => {
    const fid = featureOfMode(m.id);
    const feature = fid ? FEATURES.find(f => f.id === fid) ?? null : null;
    const index = feature ? FEATURES.indexOf(feature) : -1;
    return { id: m.id, title: m.title, subtitle: m.subtitle, feature, index };
  }).sort((a, b) => a.index - b.index);
  const modesOpen = modeRows.filter(m => !m.feature || earned.has(m.feature.id)).length;

  const featuresOfEra = (era: string) => FEATURES.filter(f => f.rule.era === era && !f.rule.made);

  const pct = Math.round((stats.core / Math.max(1, stats.coreTotal)) * 100);

  return (
    <div id="milestones" className="confirm" role="dialog" aria-modal="true" aria-labelledby="ms-t"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="confirm-box ms-box">
        <p className="mono confirm-k" id="ms-t">Milestones</p>

        <section className="ms-top" aria-label="How far you have come">
          <div className="ms-top-row">
            <span className="ms-now">{current.name}</span>
            <span className="num ms-big">{stats.core}<i>/</i>{stats.coreTotal}<em className="mono"> discoveries</em></span>
          </div>
          <span className="gate-bar ms-bar" role="progressbar" aria-valuemin={0} aria-valuemax={stats.coreTotal} aria-valuenow={stats.core}
            aria-label={`${stats.core} of ${stats.coreTotal} discoveries`}>
            <i style={{ width: `${pct}%` }} />
          </span>
          <dl className="ms-stats">
            <div><dt className="mono">Eras reached</dt><dd className="num">{stats.eras} / {stats.eraTotal}</dd></div>
            <div><dt className="mono">Major inventions</dt><dd className="num">{world.requiredFound} / {world.requiredTotal}</dd></div>
            <div><dt className="mono">Modes open</dt><dd className="num">{modesOpen} / {modeRows.length}</dd></div>
            <div><dt className="mono">Hidden found</dt><dd className="num">{stats.hidden} / {stats.hiddenTotal}</dd></div>
          </dl>
        </section>

        <section aria-label="Modes">
          <h3 className="ms-h mono">Modes · {modesOpen} of {modeRows.length} open</h3>
          <ul className="ms-modes">
            {modeRows.map(m => {
              const f = m.feature;
              const state: Door = !f || earned.has(f.id) ? 'done' : f.id === nextId ? 'next' : 'locked';
              const need = f ? missing(f) : null;
              return (
                <li key={m.id} className={cn('ms-mode', `is-${state}`)}>
                  <span className="ms-mark" aria-hidden="true">{state === 'done' ? '✓' : state === 'next' ? '›' : '·'}</span>
                  <span className="ms-mode-name">{m.title}</span>
                  <span className="ms-mode-sub mono">
                    {state === 'done' ? m.subtitle : need?.text}
                    {f && viaBeta(f) && ' · open (beta)'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Path of unlocks">
          <h3 className="ms-h mono">The road, in order</h3>
          <ol className="ms-road">
            <li className="is-done">
              <span className="ms-dot" aria-hidden="true" />
              <span className="ms-label">Workbench <em className="mono">start</em></span>
              <span className="ms-line mono">Main Evolution is open from the first moment.</span>
            </li>
            {FEATURES.map(f => {
              const state = doorOf(f);
              const need = missing(f);
              return (
                <li key={f.id} className={cn(`is-${state}`)}>
                  <span className="ms-dot" aria-hidden="true" />
                  <span className="ms-label">
                    {f.label}
                    <em className="mono">{isMode(f.id) ? 'mode' : 'tool'}</em>
                    {state === 'next' && <em className="mono ms-nextflag">next</em>}
                    {viaBeta(f) && <em className="mono">open (beta)</em>}
                  </span>
                  <span className="ms-line mono">
                    {state === 'done' ? f.line : need?.text}
                  </span>
                  {state === 'next' && need && need.total > 0 && (
                    <span className="gate-bar ms-mini" role="progressbar" aria-valuemin={0} aria-valuemax={need.total} aria-valuenow={need.done}
                      aria-label={`${need.done} of ${need.total}`}>
                      <i style={{ width: `${(need.done / need.total) * 100}%` }} />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-label="Eras">
          <h3 className="ms-h mono">Eras · what each one opens</h3>
          <ul className="ms-eras">
            {eras.map(e => {
              const opens = featuresOfEra(e.era);
              const state = e.index === progress.eraIndex ? 'now' : e.index < progress.eraIndex ? 'past' : 'ahead';
              return (
                <li key={e.era} className={cn(`is-${state}`, e.complete && e.required > 0 && 'done')}>
                  <span className="ms-mark" aria-hidden="true">{e.complete && e.required > 0 ? '✓' : state === 'now' ? '›' : '·'}</span>
                  <span className="ms-era-name">{e.name}</span>
                  <span className="num ms-era-n">{e.required > 0 ? `${e.requiredDone}/${e.required}` : '—'}</span>
                  <span className="ms-era-opens mono">{opens.length ? `opens ${opens.map(f => f.label).join(', ')}` : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="confirm-row">
          <button ref={closeRef} type="button" className="chip" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
