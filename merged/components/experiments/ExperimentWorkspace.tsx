'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Engine } from '@/lib/engine';
import { runHeatTreatment, type HeatTreatmentOutcome } from '@/lib/experiments/heatTreatment';
import { notebook } from '@/lib/notebook/store';

/* ============================================================================
   EXPERIMENT WORKSPACE — the first Laboratory slice: Heat Treatment. Tune
   two variables, get a physically-described outcome (never a bare pass/
   fail), and every run is logged to the Research Notebook whether or not it
   "succeeds" — see the brief: observations matter even without a discovery.
   This never touches Engine state; it teaches the relationship the real
   combine (controlled_fire + stone, in the normal crafting loop) depends on.
   Same in-page dialog shape as Trade/World/Journal.
   ========================================================================== */

const INVESTIGATION_ID = 'heat-treatment';
const OUTCOME_LABEL: Record<HeatTreatmentOutcome, string> = {
  underfired: 'Underfired', success: 'Changed', 'thermal-shock': 'Cracked', overheated: 'Overheated',
};

export function ExperimentWorkspace({ open, engine, onClose }: { open: boolean; engine: Engine; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [intensity, setIntensity] = useState(50);
  const [duration, setDuration] = useState(50);
  const [lastOutcome, setLastOutcome] = useState<{ outcome: HeatTreatmentOutcome; description: string; insight: string } | null>(null);
  const version = useSyncExternalStore(notebook.subscribe, notebook.getVersion, () => 0);
  void version;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const hasHeatSource = engine.has('fire') || engine.has('controlled_fire');
  const hasMaterial = engine.has('stone') || engine.has('sharp_stone') || engine.has('stone_flake');
  const ready = hasHeatSource && hasMaterial;
  const alreadyKnown = engine.has('heat_treatment');

  const run = () => {
    const result = runHeatTreatment({ intensity, duration });
    setLastOutcome(result);
    notebook.ensureInvestigation(INVESTIGATION_ID, 'Heat Treatment experiments', 'main-evolution');
    notebook.logEvidence(
      INVESTIGATION_ID, 'experiment',
      `Intensity ${intensity}, duration ${duration} → ${OUTCOME_LABEL[result.outcome]}`,
      'main-evolution', { intensity, duration, outcome: result.outcome },
    );
  };

  const log = notebook.evidenceFor(INVESTIGATION_ID);

  return (
    <div id="experiment-workspace" className="confirm" role="dialog" aria-modal="true" aria-labelledby="ew-t"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="confirm-box ew-box">
        <p className="mono confirm-k" id="ew-t">Laboratory — Heat Treatment</p>

        {!ready && !alreadyKnown && (
          <>
            <p className="confirm-d">
              You need something that makes heat, and a stone-like material, before this experiment means anything
              — go find them first.
            </p>
            <div className="confirm-row"><button className="chip" ref={closeRef} onClick={onClose}>Close</button></div>
          </>
        )}

        {(ready || alreadyKnown) && (
          <>
            <p className="confirm-d">
              Heating a material changes its internal structure, not just its temperature — but how much heat, and
              for how long, matters. Try a few combinations and watch what actually happens.
            </p>

            <div className="ew-controls">
              <label className="ew-slider">
                <span className="mono">Intensity — {intensity}</span>
                <input type="range" min={0} max={100} value={intensity}
                  onChange={e => setIntensity(Number(e.target.value))} />
              </label>
              <label className="ew-slider">
                <span className="mono">Duration — {duration}</span>
                <input type="range" min={0} max={100} value={duration}
                  onChange={e => setDuration(Number(e.target.value))} />
              </label>
            </div>

            <div className="confirm-row" style={{ marginBottom: lastOutcome ? 14 : 0 }}>
              <button className="chip" onClick={run}>Run experiment</button>
            </div>

            {lastOutcome && (
              <div className="ew-outcome" data-outcome={lastOutcome.outcome}>
                <p className="mono ew-outcome-tag">{OUTCOME_LABEL[lastOutcome.outcome]}</p>
                <p>{lastOutcome.description}</p>
              </div>
            )}

            {log.length > 0 && (
              <section className="ew-log">
                <p className="mono wp-h">Logged in your notebook</p>
                <ul className="ew-log-list">
                  {log.slice(-6).reverse().map(e => <li key={e.id}>{e.summary}</li>)}
                </ul>
              </section>
            )}

            <div className="confirm-row">
              <button className="chip" ref={closeRef} onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
