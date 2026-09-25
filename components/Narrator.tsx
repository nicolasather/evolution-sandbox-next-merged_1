'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { discoveryTier } from '@/lib/discoveryTier';
import { Narrator as NarratorStore, type NarratorMode } from '@/lib/narrator/narrator';
import { TECH_BY_ID } from '@/lib/processing/techniques';
import type { CombineResult } from '@/lib/types';
import { NarratorPortrait } from './NarratorPortrait';

/* ============================================================================
   NARRATOR — a short line in the corner of the workspace, in the voice of the
   era. Portrait, name and line in Full; the line alone in Minimal; nothing in
   Off. Click a line to send it away. It never covers the middle of the bench.
   ========================================================================== */

type Made = (CombineResult & { key: number }) | null;

const MODES: [NarratorMode, string][] = [['full', 'Full'], ['minimal', 'Minimal'], ['off', 'Off']];

export function NarratorView({ narrator, engine, entered, active, result }: {
  narrator: NarratorStore; engine: Engine; entered: boolean; active: boolean; result: Made;
}) {
  useSyncExternalStore(narrator.subscribe, narrator.getVersion, () => 0);

  // what was chosen last time
  useEffect(() => { narrator.load(); }, [narrator]);

  // ── listen to the game (only once the world is open, so a restored save is not re-announced)
  const seen = useRef({ era: '', known: 0, key: -1 });
  const live = useRef(active);
  useEffect(() => { live.current = active; }, [active]);

  useEffect(() => {
    if (!entered) return;
    const fresh = engine.order.length <= engine.db.primitives.length;
    engine.erasReached().forEach(e => { if (!(fresh && e.id === 'origins')) narrator.markMet(e.id); });
    seen.current.era = engine.currentEra().id;
    seen.current.known = engine.known.length;
    if (fresh) narrator.notice({ kind: 'era', era: 'origins' }, Date.now());

    return engine.subscribe(() => {
      const now = Date.now();
      const s = seen.current;
      const era = engine.currentEra().id;
      if (era !== s.era) {
        s.era = era;
        if (live.current) narrator.notice({ kind: 'era', era }, now);
      }
      const n = engine.known.length;
      if (n > s.known && live.current) {
        const t = TECH_BY_ID[engine.known[n - 1]];
        if (t) narrator.notice({ kind: 'technique', era, tech: t.label }, now);
      }
      s.known = n;
    });
  }, [entered, engine, narrator]);

  // a find: only the weighty and the very small speak; the ordinary ones already have their own ceremony
  useEffect(() => {
    if (!result || result.key === seen.current.key) return;
    seen.current.key = result.key;
    if (!entered || !live.current || result.status !== 'new') return;
    const tier = discoveryTier(result, true);
    if (tier === 'standard') return;
    narrator.notice({ kind: tier, era: result.node.era, name: result.node.n }, Date.now());
  }, [result, entered, narrator]);

  // lines expire and the "stuck" rule is checked once a second
  useEffect(() => {
    if (!entered) return;
    const id = window.setInterval(() => narrator.tick(Date.now(), engine.currentEra().id), 1000);
    return () => window.clearInterval(id);
  }, [entered, engine, narrator]);

  const line = narrator.current;
  const mode = narrator.mode;

  if (mode === 'off') {
    return active ? (
      <button type="button" className="nar-chip mono" onClick={() => narrator.setMode('full')} aria-label="Turn the narrator on">
        Narrator off
      </button>
    ) : null;
  }
  if (!line || !active) return null;

  const v = line.voice;
  return (
    <aside className="nar" data-mode={mode} data-tone={v.tone} data-kind={line.kind} role="status" aria-live="polite" key={line.key}>
      {mode === 'full' && <NarratorPortrait voice={v.id} />}
      <div className="nar-body">
        <p className="nar-name mono">{v.name}</p>
        <p className="nar-line">{line.text}</p>
        {(mode === 'full' || v.kind === 'dramatised') && <p className="nar-note mono">{v.note}</p>}
        <div className="nar-modes" role="group" aria-label="Narrator style">
          {MODES.map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => narrator.setMode(m)}>{label}</button>
          ))}
        </div>
      </div>
      <button type="button" className="nar-x" aria-label="Dismiss" onClick={() => narrator.dismiss()}>×</button>
    </aside>
  );
}
