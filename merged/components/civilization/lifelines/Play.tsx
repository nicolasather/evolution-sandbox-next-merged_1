'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateMastery } from '@/lib/civilization/lifelines/campaign';
import { pickQuestion } from '@/lib/civilization/lifelines/questions';
import { GATHER_RESOURCES, SERVICE_LABEL, GATHER_AMOUNT, formatUnits } from '@/lib/civilization/lifelines/rules';
import { RESOURCE_IDS, type Command, type ResourceId } from '@/lib/civilization/lifelines/schema';
import { blockReasonText, hintFor, legalDistricts, needsDirection, tutorialStep } from '@/lib/civilization/lifelines/selectors';
import { GuideHint, GuideScope, useGuideController } from '@/components/guide/GuideProvider';
import { GUIDE_TARGET, civilizationGuide } from '@/lib/guide/civilization';
import { Banners } from './Banners';
import { DistrictList } from './DistrictList';
import { CompletionPanel, EventDecision, HelpDrawer, QuestionCard, SettingsDrawer } from './Overlays';
import {
  CouncilPanel, DistrictPanel, ForecastPanel, Objectives, PressuresPanel, ProgrammeDrawer, QueuePanel, Stocks,
  type ProgrammePreview,
} from './Panels';
import { SettlementScene } from './SettlementScene';
import { seasonLabel, useLifelines, useReducedMotion } from './ui';
import { useNarration } from './useNarration';

type Panel = 'none' | 'programmes' | 'council' | 'forecast' | 'settings' | 'help';

export function Play({ onChapters }: { onChapters: () => void }) {
  const { store, snap } = useLifelines();
  const { index, run, manifest } = snap;
  const settings = manifest.settings;
  const reduced = useReducedMotion(settings.motionSpeed);
  const narr = useNarration(snap, settings);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [list, setList] = useState(false);
  const [preview, setPreview] = useState<ProgrammePreview | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [doneDismissed, setDoneDismissed] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [blocked, setBlocked] = useState(0);
  const [caption, setCaption] = useState<string | null>(null);
  const [askedTurn, setAskedTurn] = useState<number | null>(null);
  const [gather, setGather] = useState<ResourceId>('food');
  const lastTurn = useRef<number | null>(null);

  const ro = snap.readOnly || !!snap.conflict;

  const act = useCallback((c: Command) => {
    const r = store.dispatch(c);
    if (!r.ok) { setNotice(blockReasonText(r.code)); setBlocked(n => n + 1); } else { setNotice(''); setBlocked(0); }
    return { ok: r.ok, code: r.ok ? undefined : r.code };
  }, [store]);

  // Season caption (skippable; none in reduced motion).
  useEffect(() => {
    if (!run) return undefined;
    if (lastTurn.current !== null && lastTurn.current !== run.turn && !reduced) {
      setCaption(seasonLabel(run.turn));
      const t = window.setTimeout(() => setCaption(null), settings.motionSpeed === 'slow' ? 2200 : 1100);
      lastTurn.current = run.turn;
      return () => window.clearTimeout(t);
    }
    lastTurn.current = run.turn;
    return undefined;
  }, [run?.turn, reduced, settings.motionSpeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const chapter = run && index ? index.chapters.get(run.chapterId) ?? null : null;
  const tut = useMemo(() => (run && index ? tutorialStep(index, run) : null), [run, index]);
  const question = useMemo(() => (run && index && askedTurn !== run.turn ? pickQuestion(index, manifest, run) : null), [run, index, manifest, askedTurn]);

  const openForecast = () => { setPanel(p => (p === 'forecast' ? 'none' : 'forecast')); act({ type: 'ack-forecast' }); };
  const revealHint = () => {
    if (hintLevel >= 3) return;
    setHintLevel(hintLevel + 1);
    act({ type: 'note-hint' });
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.key === 'Escape') { if (panel !== 'none') { setPanel('none'); setPreview(null); } else if (caption) setCaption(null); return; }
      if (run?.pendingEventId) return;
      const k = e.key.toLowerCase();
      if (e.key === '?') setPanel(p => (p === 'help' ? 'none' : 'help'));
      else if (k === 'p') setPanel(p => (p === 'programmes' ? 'none' : 'programmes'));
      else if (k === 'c') setPanel(p => (p === 'council' ? 'none' : 'council'));
      else if (k === 'f') openForecast();
      else if (k === 'l') setList(v => !v);
      else if (k === 'n' && !ro) act({ type: 'advance' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // intentionally re-bound each render so it always sees current state

  // The follow-the-glow guide: derived from the game's own tutorialStep() plus what is open on screen. Never writes to the game.
  const guideInfo = useMemo(() => (run && index
    ? civilizationGuide(index, run, {
      selectedDistrictId: selected, panel, preview,
      locked: ro || run.completion.status === 'archived',
      hasCompletions: Object.keys(manifest.completions).length > 0,
    })
    : null), [run, index, selected, panel, preview, ro, manifest.completions]);
  const guide = useGuideController({ mode: 'civilization', eligible: guideInfo?.eligible ?? false, step: guideInfo?.step ?? null, finished: guideInfo?.finished ?? false });

  if (!index || !run || !chapter) return null;
  const completed = run.completion.completedAtTurn !== null;
  const showDone = completed && doneDismissed !== run.runId && run.completion.status !== 'archived';
  const reward = run.completion.completionKey ? manifest.rewards[run.completion.completionKey] ?? null : null;
  const direction = needsDirection(run, blocked);
  const stepText = tut && tut.step !== 'done' ? tut.text : '';
  const hl = tut?.projectId && tut.step === 'start-programme' ? legalDistricts(index, run, tut.projectId).map(d => d.id) : [];

  return (
    <GuideScope value={guide}>
    <div className="ll-play" onPointerDown={narr.gesture} onKeyDown={narr.gesture}>
      <header className="ll-top">
        <button type="button" className="ll-btn ghost" onClick={() => { narr.cancel(); onChapters(); }}>← Chapters</button>
        <div className="ll-top-title">
          <p className="ll-eyebrow">{run.mode === 'sandbox' ? 'Sandbox · fictional' : `Chapter ${chapter.order} · ${index.eras.get(chapter.era)?.name ?? ''}`}</p>
          <h1 className="ll-h2">{chapter.title}</h1>
        </div>
        <div className="ll-top-meta">
          <span>{seasonLabel(run.turn)}</span>
          <span aria-label={`${run.actionsLeft} actions left`}>Actions {Array.from({ length: index.db.rules.actionsPerTurn }, (_, i) => <i key={i} className={'ll-pip' + (i < run.actionsLeft ? ' on' : '')} />)}</span>
          <span className={'ll-save ' + snap.persistence}>{snap.persistence === 'saved' ? 'Saved' : snap.persistence === 'memory-only' ? 'Not saved' : snap.persistence === 'readonly' ? 'Read-only' : snap.persistence}</span>
          <button type="button" className="ll-btn small ghost" onClick={() => setPanel(p => (p === 'settings' ? 'none' : 'settings'))}>Settings</button>
          <button type="button" className="ll-btn small ghost" onClick={() => setPanel(p => (p === 'help' ? 'none' : 'help'))} aria-label="Help">?</button>
        </div>
      </header>
      <Banners store={store} snap={snap} />
      {guide.enabled ? <GuideHint /> : stepText && <p className="ll-tutorial" role="note">{stepText}</p>}
      <p className="ll-sr" role="status" aria-live="polite">{snap.announce}</p>
      {notice && <p className="ll-notice" role="alert">{notice}</p>}

      <div className="ll-main">
        <section className="ll-stage" aria-label="Settlement">
          <div className="ll-stage-tools">
            <p className="ll-lede small">{chapter.brief}</p>
            <button type="button" className="ll-btn small ghost" aria-pressed={list} onClick={() => setList(v => !v)}>{list ? 'Show map' : 'Show list'}</button>
            <label className="ll-inline"><span className="ll-sr">Highlight a service</span>
              <select value={settings.overlay} onChange={e => store.updateSettings({ overlay: e.target.value as ResourceId | 'none' })} aria-label="Highlight a service">
                <option value="none">No overlay</option>
                {RESOURCE_IDS.map(r => <option key={r} value={r}>{SERVICE_LABEL[r]}</option>)}
              </select>
            </label>
          </div>
          {list
            ? <DistrictList index={index} run={run} selectedId={selected} onSelect={setSelected} />
            : <SettlementScene index={index} run={run} selectedId={selected} onSelect={setSelected} overlay={settings.overlay} reduced={reduced} highlightIds={hl} glowIds={run.layout.districts.filter(d => guide.glow(GUIDE_TARGET.district(d.id))).map(d => d.id)}
                highlightProgramme={preview ? { districtId: preview.districtId, name: index.projects.get(preview.projectId)?.name ?? '' } : null} />}
          {caption && <button type="button" className="ll-caption" onClick={() => setCaption(null)} aria-label="Skip season caption">{caption}</button>}
          {narr.subtitle && settings.subtitles && (
            <p className="ll-subtitle" role="status">{narr.subtitle.text}<button type="button" className="ll-link-btn" onClick={narr.dismiss} aria-label="Dismiss subtitle">×</button></p>
          )}
        </section>

        <div className="ll-side">
          <Stocks index={index} run={run} />
          <Objectives index={index} run={run} />
          {question && settings.questionsEnabled && (
            <QuestionCard question={question} onSkip={() => setAskedTurn(run.turn)}
              onAnswer={c => store.recordAnswer({ questionId: question.id, runId: run.runId, turn: run.turn, choiceIndex: c, correct: c === question.correct, answeredAt: Date.now() })} />
          )}
          <PressuresPanel index={index} run={run} dispatch={act} onSelectDistrict={id => { setSelected(id); setList(false); }} />
          <DistrictPanel index={index} run={run} districtId={selected} onProgrammes={() => setPanel('programmes')} />
          <QueuePanel index={index} run={run} dispatch={act} />
          {panel === 'forecast' && <ForecastPanel index={index} run={run} onClose={() => setPanel('none')} />}
          {hintLevel > 0 && (
            <section className="ll-panel" aria-label="Hints">
              <h2 className="ll-h3">Hint</h2>
              {[1, 2, 3].slice(0, hintLevel).map(l => {
                const h = hintFor(index, run, l as 1 | 2 | 3);
                return <div key={l}><p>{h.text}</p>{h.reasons.map(r => <p key={r} className="ll-dim">{r}</p>)}</div>;
              })}
            </section>
          )}
        </div>

        {panel === 'programmes' && <ProgrammeDrawer index={index} run={run} districtId={selected} dispatch={act} onClose={() => { setPanel('none'); setPreview(null); }} onPreview={setPreview} />}
        {panel === 'council' && <CouncilPanel index={index} run={run} dispatch={act} onClose={() => setPanel('none')} />}
        {panel === 'settings' && (
          <SettingsDrawer settings={settings} voices={narr.voices} audioReady={narr.audioReady} assetSummary={narr.assetSummary}
            onChange={p => store.updateSettings(p)} onClose={() => setPanel('none')} />
        )}
        {panel === 'help' && <HelpDrawer onClose={() => setPanel('none')} />}
      </div>

      <footer className="ll-dock" role="toolbar" aria-label="Planning">
        <button type="button" className={'ll-btn ' + guide.glow(GUIDE_TARGET.programmesButton)} onClick={() => setPanel(p => (p === 'programmes' ? 'none' : 'programmes'))} aria-pressed={panel === 'programmes'}>Programmes</button>
        <button type="button" className="ll-btn" onClick={() => setPanel(p => (p === 'council' ? 'none' : 'council'))} aria-pressed={panel === 'council'}>Council</button>
        <button type="button" className={'ll-btn ' + guide.glow(GUIDE_TARGET.forecast)} onClick={openForecast} aria-pressed={panel === 'forecast'}>Forecast</button>
        <span className="ll-dock-gather">
          <label className="ll-inline"><span className="ll-sr">Emergency shared work</span>
            <select value={gather} onChange={e => setGather(e.target.value as ResourceId)} aria-label="Emergency shared work resource">
              {GATHER_RESOURCES.map(r => <option key={r} value={r}>{SERVICE_LABEL[r]}</option>)}
            </select></label>
          <button type="button" className="ll-btn" disabled={ro || run.actionsLeft < 1} onClick={() => act({ type: 'gather', resource: gather as 'food' })} title={`Everyone helps for a season: +${formatUnits(GATHER_AMOUNT)}. Uses an action.`}>Emergency work</button>
        </span>
        <button type="button" className={'ll-btn ghost ' + guide.glow(GUIDE_TARGET.hint)} disabled={hintLevel >= 3} onClick={revealHint}>{direction ? 'Need a direction?' : 'Hint'}{hintLevel > 0 ? ` (${hintLevel}/3)` : ''}</button>
        <button type="button" className={'ll-btn primary ' + guide.glow(GUIDE_TARGET.advance)} disabled={ro} onClick={() => act({ type: 'advance' })}>Advance season</button>
      </footer>

      {run.pendingEventId && <EventDecision index={index} run={run} dispatch={act} />}
      {showDone && (
        <CompletionPanel chapter={chapter} mastery={evaluateMastery(run)} declared={run.masteryDeclared} reward={reward} mode={run.mode}
          onContinue={() => setDoneDismissed(run.runId)} onReview={() => { setDoneDismissed(run.runId); setPanel('forecast'); }}
          onArchive={() => { narr.cancel(); act({ type: 'archive' }); }} />
      )}
    </div>
    </GuideScope>
  );
}
