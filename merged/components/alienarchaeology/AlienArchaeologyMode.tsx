'use client';

import { useEffect, useState } from 'react';
import { alienExhibit, summarizeSite } from '@/lib/alienarchaeology/memory';
import { AXIS_LABEL, VALUE_LABEL, axisOptions, template } from '@/lib/alienarchaeology/catalog';
import { ALL_AXES, generateSite } from '@/lib/alienarchaeology/generate';
import { applyAction } from '@/lib/alienarchaeology/simulate';
import { alienArchaeologyStore } from '@/lib/alienarchaeology/store';
import type { AlienSiteState, AxisId, AxisValue } from '@/lib/alienarchaeology/types';
import { notebook } from '@/lib/notebook/store';
import { profile } from '@/lib/profile/store';

/* ============================================================================
   ALIEN ARCHAEOLOGY — "Unknown Worlds". A sixth genuinely different
   interaction language, gated behind Phases 8-10's evidence architecture
   per docs/ROADMAP-UNIVERSE.md. Reuses that architecture's shape (recover
   specimens, weigh evidence, write a hypothesis) but changes what "done"
   means: never a right/wrong verdict, always a calibration score — how
   well the player's own stated confidence matched how right they turned
   out to be. See docs/ROADMAP-UNIVERSE.md's Phase 11 section.
   ========================================================================== */

function investigationId(seed: string): string { return `alien-${seed}`; }

export function AlienArchaeologyMode({ onExit }: { onExit: () => void }) {
  const [site, setSite] = useState<AlienSiteState | null>(() => {
    alienArchaeologyStore.load();
    return alienArchaeologyStore.get().active ?? generateSite(`alien-${Date.now()}`);
  });

  useEffect(() => {
    if (!site) return;
    if (!alienArchaeologyStore.get().active) alienArchaeologyStore.setActive(site);
    notebook.ensureInvestigation(investigationId(site.seed), 'Xenoarchaeology — ' + site.seed, 'alien-archaeology');
    profile.recordModeVisit('alien-archaeology');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!site) return null;

  const run = (action: Exclude<Parameters<typeof applyAction>[1], { kind: 'submit' }>) => {
    const { state } = applyAction(site, action);
    setSite(state);
    alienArchaeologyStore.setActive(state);
  };

  const fileReport = () => {
    const { state } = applyAction(site, { kind: 'submit' });
    setSite(state);
    if (state.ending !== 'ongoing') {
      const memory = summarizeSite(state);
      alienArchaeologyStore.archiveActive(memory);
      const exhibit = alienExhibit(memory);
      profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'alien-archaeology', unlockedAt: Date.now() });
      for (const r of state.report!.axisResults) {
        notebook.addHypothesis(investigationId(state.seed), `${AXIS_LABEL[r.axis]}: ${VALUE_LABEL[r.axis][r.hypothesis]}`, r.confidence);
      }
    } else {
      alienArchaeologyStore.setActive(state);
    }
  };

  const startNew = () => {
    const fresh = generateSite(`alien-${Date.now()}`);
    setSite(fresh);
    alienArchaeologyStore.setActive(fresh);
  };

  if (site.ending !== 'ongoing' && site.report) {
    const report = site.report;
    return (
      <div id="alienarchaeology-mode" className="xa-ending">
        <div className="xa-ending-box">
          <p className="mono xa-eyebrow">Alien Archaeology — Unknown Worlds</p>
          <h1 className="xa-ending-title">{Math.round(report.overallCalibration * 100)}% calibrated</h1>
          <p className="xa-ending-line">{report.reportText}</p>
          <dl className="xa-ending-axes">
            {report.axisResults.map(r => (
              <div key={r.axis} className={'xa-axis-result' + (r.matched ? ' xa-matched' : '')}>
                <dt className="mono">{AXIS_LABEL[r.axis]}</dt>
                <dd>Your reading: {VALUE_LABEL[r.axis][r.hypothesis]} ({Math.round(r.confidence * 100)}% confident)</dd>
                <dd className="xa-truth-line">Expedition&rsquo;s own best reading: {VALUE_LABEL[r.axis][r.truth]}{r.matched ? ' — agrees' : ''}</dd>
              </div>
            ))}
          </dl>
          <div className="xa-ending-actions">
            <button className="chip" onClick={startNew}>Study a new site</button>
            <button className="chip" onClick={onExit}>Return to the Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const revealedCount = site.specimens.filter(s => s.revealed).length;
  const allAxesSet = ALL_AXES.every(a => site.hypotheses[a] != null && site.confidences[a] != null);

  return (
    <div id="alienarchaeology-mode">
      <header className="xa-top">
        <button className="chip xa-exit" onClick={onExit}>← Hub</button>
        <p className="mono xa-eyebrow">Alien Archaeology — Unknown Worlds</p>
        <p className="xa-progress mono">{revealedCount} of {site.specimens.length} specimens studied</p>
      </header>

      <div className="xa-body">
        <p className="xa-intro">{site.truth.setting}</p>

        <section className="xa-specimens-section">
          <p className="mono xa-h">Recovered specimens</p>
          <div className="xa-specimens">
            {site.specimens.map(spec => {
              const t = template(spec.templateId);
              return (
                <div key={spec.id} className={'xa-specimen' + (spec.revealed ? ' xa-revealed' : '')}>
                  {spec.revealed ? (
                    <p className="xa-specimen-desc">{t.description}</p>
                  ) : (
                    <>
                      <p className="xa-specimen-desc xa-unrevealed">An unstudied specimen, still crated.</p>
                      <button className="chip" onClick={() => run({ kind: 'reveal', specimenId: spec.id })}>Study it</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="xa-log-section">
          <p className="mono xa-h">Field notes</p>
          <ol className="xa-log">
            {site.log.slice(-4).map((e, i) => <li key={i}>{e.text}</li>)}
          </ol>
        </section>
      </div>

      <section className="xa-hypothesis">
        <p className="mono xa-h">Write your field report — a reading and a confidence for each question</p>
        {ALL_AXES.map((axis: AxisId) => {
          const options = axisOptions(axis);
          const current = site.hypotheses[axis];
          const confidence = site.confidences[axis] ?? 0.5;
          return (
            <div key={axis} className="xa-axis-row">
              <span className="mono xa-axis-label">{AXIS_LABEL[axis]}</span>
              <div className="xa-choice-group">
                {options.map((opt: AxisValue) => (
                  <button
                    key={opt}
                    className={'chip' + (current === opt ? ' xa-chosen' : '')}
                    onClick={() => run({ kind: 'setHypothesis', axis, value: opt })}
                  >{VALUE_LABEL[axis][opt as string]}</button>
                ))}
              </div>
              <label className="xa-confidence-row">
                <span className="mono">Confidence: {Math.round(confidence * 100)}%</span>
                <input
                  type="range" min={0} max={100} value={Math.round(confidence * 100)}
                  onChange={e => run({ kind: 'setConfidence', axis, value: Number(e.target.value) / 100 })}
                />
              </label>
            </div>
          );
        })}
        <div className="xa-report-row">
          <button className="chip xa-report-btn" disabled={!allAxesSet} onClick={fileReport}>File field report</button>
        </div>
      </section>
    </div>
  );
}
