'use client';

import { useEffect, useState } from 'react';
import { template } from '@/lib/archaeology/catalog';
import { generateSite } from '@/lib/archaeology/generate';
import { siteExhibit, summarizeSite } from '@/lib/archaeology/memory';
import { FUNCTION_LABEL, PHASE_LABEL, SURVEY_HINT_LABEL } from '@/lib/archaeology/read';
import { applyAction, isFindRevealed, type SiteAction } from '@/lib/archaeology/simulate';
import { archaeologyStore } from '@/lib/archaeology/store';
import type { SiteFunction, SitePhase, SiteState } from '@/lib/archaeology/types';
import { notebook } from '@/lib/notebook/store';
import { profile } from '@/lib/profile/store';

/* ============================================================================
   ARCHAEOLOGIST — "Recover". A fourth, genuinely different interaction
   language: no crafting (Main Evolution), no per-member spatial tasks
   (Survival), no allocation sliders (Civilization). The player spends
   three independent, scarce action budgets — survey, excavate, analyze —
   across a small fixed grid, then has to argue an interpretation from
   only the evidence they actually recovered. See
   docs/ROADMAP-UNIVERSE.md's Phase 8 section for what this slice does and
   does not attempt. First real consumer of lib/notebook's Hypothesis/
   Evidence methods, as Phase 3 flagged it would be.
   ========================================================================== */

const FUNCTIONS: SiteFunction[] = ['seasonal-camp', 'permanent-settlement', 'workshop', 'ceremonial-site'];
const PHASES: SitePhase[] = ['early-occupation', 'peak-occupation', 'late-occupation'];

function investigationId(seed: string): string { return `arch-${seed}`; }

export function ArchaeologyMode({ onExit }: { onExit: () => void }) {
  const [site, setSite] = useState<SiteState | null>(() => {
    archaeologyStore.load();
    return archaeologyStore.get().active ?? generateSite(`dig-${Date.now()}`);
  });
  const [selectedFind, setSelectedFind] = useState<string | null>(null);

  useEffect(() => {
    if (!site) return;
    if (!archaeologyStore.get().active) archaeologyStore.setActive(site);
    notebook.ensureInvestigation(investigationId(site.seed), 'Excavation — ' + site.seed, 'archaeology');
    profile.recordModeVisit('archaeology');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!site) return null;

  // Only 'report' can ever end a dig — every other action stays fully
  // reversible-in-budget, so this handler never needs the impure
  // Date.now() call below and can stay a plain wrapped closure.
  const run = (action: Exclude<SiteAction, { kind: 'report' }>) => {
    const { state } = applyAction(site, action);
    setSite(state);
    archaeologyStore.setActive(state);
    if (action.kind === 'analyze') {
      const f = state.finds.find(x => x.id === action.findId);
      if (f?.analysis) {
        notebook.logEvidence(
          investigationId(state.seed), 'artifact',
          `${template(f.templateId).label} — ${f.analysis.likelyFunction}`,
          'archaeology', { templateId: f.templateId, confidence: f.analysis.confidence },
        );
      }
    }
    if (action.kind === 'hypothesize' && action.field === 'function') {
      notebook.addHypothesis(investigationId(state.seed), `Site function: ${FUNCTION_LABEL[action.value]}`, 0.5);
    }
  };

  /** Referenced directly as an onClick prop (never wrapped in an inline
   *  arrow) so the one impure call this mode ever makes — timestamping a
   *  finished report's Museum unlock — stays inside a function React's
   *  purity analysis can see is only ever invoked from a real event. */
  const fileReport = () => {
    const { state } = applyAction(site, { kind: 'report' });
    setSite(state);
    if (state.ending !== 'ongoing') {
      const memory = summarizeSite(state);
      archaeologyStore.archiveActive(memory);
      const exhibit = siteExhibit(memory);
      profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'archaeology', unlockedAt: Date.now() });
    } else {
      archaeologyStore.setActive(state);
    }
  };

  const startNew = () => {
    const fresh = generateSite(`dig-${Date.now()}`);
    setSite(fresh);
    setSelectedFind(null);
    archaeologyStore.setActive(fresh);
  };

  if (site.ending !== 'ongoing' && site.report) {
    const report = site.report;
    return (
      <div id="archaeology-mode" className={`ar-ending ar-${report.verdict}`}>
        <div className="ar-ending-box">
          <p className="mono ar-eyebrow">Archaeologist — Recover</p>
          <h1 className="ar-ending-title">
            {report.verdict === 'well-supported' ? 'A well-supported report.'
              : report.verdict === 'plausible' ? 'A plausible, if thin, report.'
                : 'An inconclusive report.'}
          </h1>
          <p className="ar-ending-line">{report.reportText}</p>
          <dl className="ar-ending-stats">
            <div><dt className="mono">Interpretation</dt><dd>{FUNCTION_LABEL[site.hypotheses.function!]}</dd></div>
            <div><dt className="mono">Finds analyzed</dt><dd>{report.analyzedCount}</dd></div>
            <div><dt className="mono">Evidence score</dt><dd>{Math.round(report.evidenceScore * 100)}%</dd></div>
          </dl>
          <ol className="ar-log">
            {site.log.slice(-8).map((e, i) => <li key={i}>{e.text}</li>)}
          </ol>
          <div className="ar-ending-actions">
            <button className="chip" onClick={startNew}>Stake out a new site</button>
            <button className="chip" onClick={onExit}>Return to the Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const revealed = site.finds.filter(f => isFindRevealed(site, f));
  const unanalyzed = revealed.filter(f => !f.analyzed);
  const analyzed = revealed.filter(f => f.analyzed);
  const active = selectedFind ? site.finds.find(f => f.id === selectedFind) ?? null : null;

  return (
    <div id="archaeology-mode">
      <header className="ar-top">
        <button className="chip ar-exit" onClick={onExit}>← Hub</button>
        <p className="mono ar-eyebrow">Archaeologist — Recover</p>
        <p className="ar-budgets mono">
          Survey {site.budgets.survey - site.spent.survey}/{site.budgets.survey} ·
          {' '}Excavate {site.budgets.excavate - site.spent.excavate}/{site.budgets.excavate} ·
          {' '}Analyze {site.budgets.analyze - site.spent.analyze}/{site.budgets.analyze}
        </p>
      </header>

      <div className="ar-body">
        <section className="ar-grid-section">
          <p className="mono ar-h">Site grid — {site.gridSize}×{site.gridSize}</p>
          <div className="ar-grid" style={{ gridTemplateColumns: `repeat(${site.gridSize}, 1fr)` }}>
            {site.squares.flat().map(sq => {
              const findsHere = revealed.filter(f => f.squareX === sq.x && f.squareY === sq.y).length;
              const sterile = sq.dugContexts >= sq.contexts.length;
              return (
                <div key={`${sq.x}-${sq.y}`} className={'ar-square' + (sterile ? ' ar-sterile' : '')}>
                  <span className="mono ar-square-coord">{sq.x},{sq.y}</span>
                  <span className="ar-square-hint mono">{SURVEY_HINT_LABEL[sq.surveyHint]}</span>
                  <span className="ar-square-depth mono">{sq.dugContexts}/{sq.contexts.length} dug</span>
                  {findsHere > 0 && <span className="ar-square-finds mono">{findsHere} find{findsHere > 1 ? 's' : ''}</span>}
                  <div className="ar-square-actions">
                    <button
                      className="chip"
                      disabled={sq.surveyHint !== 'unsurveyed' || site.spent.survey >= site.budgets.survey}
                      onClick={() => run({ kind: 'survey', x: sq.x, y: sq.y })}
                    >Survey</button>
                    <button
                      className="chip"
                      disabled={sterile || site.spent.excavate >= site.budgets.excavate}
                      onClick={() => run({ kind: 'excavate', x: sq.x, y: sq.y })}
                    >Dig</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ar-finds-section">
          <p className="mono ar-h">Recovered finds</p>
          {revealed.length === 0 && <p className="ar-empty">Nothing excavated yet.</p>}
          <ul className="ar-finds-list">
            {unanalyzed.map(f => (
              <li key={f.id} className="ar-find ar-find-unanalyzed">
                <span>An unidentified find, square ({f.squareX}, {f.squareY})</span>
                <button
                  className="chip"
                  disabled={site.spent.analyze >= site.budgets.analyze}
                  onClick={() => run({ kind: 'analyze', findId: f.id })}
                >Analyze</button>
              </li>
            ))}
            {analyzed.map(f => (
              <li key={f.id} className="ar-find ar-find-analyzed" onClick={() => setSelectedFind(f.id)}>
                <span className="ar-find-title">{template(f.templateId).label}</span>
                <span className="ar-find-sub mono">{f.analysis!.confidence} confidence · {PHASE_LABEL[f.analysis!.phaseEstimate]}</span>
              </li>
            ))}
          </ul>
          {active?.analysis && (
            <div className="ar-find-detail">
              <p className="ar-find-detail-title">{template(active.templateId).label}</p>
              <p className="ar-find-detail-line">Material: {active.analysis.material}</p>
              <p className="ar-find-detail-line">{active.analysis.likelyFunction}</p>
            </div>
          )}
        </section>

        <section className="ar-log-section">
          <p className="mono ar-h">Field notes</p>
          <ol className="ar-log">
            {site.log.slice(-5).map((e, i) => <li key={i}>{e.text}</li>)}
          </ol>
        </section>
      </div>

      <section className="ar-hypothesis">
        <p className="mono ar-h">Working hypothesis</p>
        <div className="ar-hypothesis-row">
          <span className="mono">Site function</span>
          <div className="ar-choice-group">
            {FUNCTIONS.map(fn => (
              <button
                key={fn}
                className={'chip' + (site.hypotheses.function === fn ? ' ar-chosen' : '')}
                onClick={() => run({ kind: 'hypothesize', field: 'function', value: fn })}
              >{FUNCTION_LABEL[fn]}</button>
            ))}
          </div>
        </div>
        <div className="ar-hypothesis-row">
          <span className="mono">Best-represented phase</span>
          <div className="ar-choice-group">
            {PHASES.map(ph => (
              <button
                key={ph}
                className={'chip' + (site.hypotheses.phase === ph ? ' ar-chosen' : '')}
                onClick={() => run({ kind: 'hypothesize', field: 'phase', value: ph })}
              >{PHASE_LABEL[ph]}</button>
            ))}
          </div>
        </div>
        <div className="ar-report-row">
          <button
            className="chip ar-report-btn"
            disabled={!site.hypotheses.function}
            onClick={fileReport}
          >File report</button>
        </div>
      </section>
    </div>
  );
}
