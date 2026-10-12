'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SERVICE_LABEL, formatUnits, quantitiesToMilli, MASTERY_DEFS, type MasteryKind } from '@/lib/civilization/lifelines/rules';
import type { Settings, RewardRecord } from '@/lib/civilization/lifelines/campaign';
import { gradeAnswer, type LearningQuestion } from '@/lib/civilization/lifelines/questions';
import { districtName } from '@/lib/civilization/lifelines/network';
import type { VoiceInfo } from '@/lib/civilization/lifelines/narration';
import { voiceHint } from '@/lib/civilization/lifelines/narration';
import type { Chapter, ContentIndex, LifelinesState, ResourceId } from '@/lib/civilization/lifelines/schema';
import type { Dispatch } from './Panels';
import { useRestoreFocus } from './ui';

/** Keeps Tab inside a dialog. */
function trap(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'Tab') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),select,input,[href],[tabindex]:not([tabindex="-1"])'));
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function EventDecision({ index, run, dispatch }: { index: ContentIndex; run: LifelinesState; dispatch: Dispatch }) {
  const ev = run.pendingEventId ? index.events.get(run.pendingEventId) : null;
  const sent = useRef(false);
  const first = useRef<HTMLButtonElement | null>(null);
  useRestoreFocus();
  useEffect(() => { first.current?.focus(); }, [ev?.id]);
  useEffect(() => { sent.current = false; }, [run.revision]);
  if (!ev) return null;
  const choose = (id: string) => {
    if (sent.current) return; // synchronous double-submit guard
    sent.current = true;
    const r = dispatch({ type: 'resolve-event', choiceId: id });
    if (!r.ok) sent.current = false;
  };
  const firstAffordable = ev.choices.findIndex(c => affordable(run, c.cost));
  return (
    <div className="ll-modal" role="dialog" aria-modal="true" aria-labelledby="ll-ev-title" onKeyDown={trap}>
      <div className="ll-modal-box">
        <p className="ll-eyebrow">A situation needs a decision · {SERVICE_LABEL[ev.sector]}{run.pendingEventDistrictId ? ` · ${districtName(run.layout, run.pendingEventDistrictId)}` : ''}</p>
        <h2 id="ll-ev-title" className="ll-h2">{ev.title}</h2>
        <p>{ev.body}</p>
        <p className="ll-dim">Every option is survivable. One costs nothing.</p>
        <ul className="ll-choices">
          {ev.choices.map((c, i) => {
            const ok = affordable(run, c.cost);
            const short = shortText(run, c.cost);
            return (
              <li key={c.id}>
                <button type="button" ref={i === firstAffordable ? first : undefined} className="ll-choice" disabled={!ok} onClick={() => choose(c.id)}>
                  <b>{c.label}</b>
                  <span>{Object.keys(c.cost).length ? `Costs ${costLine(c.cost)}` : 'No cost'}{Object.keys(c.delta).length ? ` · Effect ${costLine(c.delta, true)}` : ''}</span>
                  <em>{c.consequence}</em>
                  {!ok && <strong>Unavailable: {short}</strong>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
const affordable = (run: LifelinesState, cost: Partial<Record<ResourceId, number>>) =>
  Object.entries(quantitiesToMilli(cost)).every(([r, n]) => run.stocks[r as ResourceId] >= (n as number));
const shortText = (run: LifelinesState, cost: Partial<Record<ResourceId, number>>) =>
  Object.entries(quantitiesToMilli(cost)).filter(([r, n]) => run.stocks[r as ResourceId] < (n as number))
    .map(([r, n]) => `need ${formatUnits((n as number) - run.stocks[r as ResourceId])} more ${SERVICE_LABEL[r as ResourceId].toLowerCase()}`).join(', ');
const costLine = (q: Partial<Record<ResourceId, number>>, sign = false) =>
  Object.entries(q).filter(([, n]) => n).map(([r, n]) => `${sign && (n as number) > 0 ? '+' : ''}${n} ${SERVICE_LABEL[r as ResourceId].toLowerCase()}`).join(', ');

export function CompletionPanel({ chapter, mastery, declared, reward, mode, onContinue, onReview, onArchive }: {
  chapter: Chapter; mastery: MasteryKind[]; declared: string[]; reward: RewardRecord | null; mode: 'campaign' | 'sandbox';
  onContinue: () => void; onReview: () => void; onArchive: () => void;
}) {
  const btn = useRef<HTMLButtonElement | null>(null);
  useRestoreFocus();
  useEffect(() => { btn.current?.focus(); }, []);
  return (
    <div className="ll-modal" role="dialog" aria-modal="true" aria-labelledby="ll-done-title" onKeyDown={trap}>
      <div className="ll-modal-box">
        <p className="ll-eyebrow">{chapter.title} · goals met</p>
        <h2 id="ll-done-title" className="ll-h2">The settlement holds.</h2>
        <p>{chapter.narration.success}</p>
        <p className="ll-dim">This is a simulated settlement from procedural-fiction content, not a historical record.{mode === 'sandbox' ? ' Sandbox runs do not count toward the campaign.' : ''}</p>
        {declared.length > 0 && (
          <ul className="ll-goals">{declared.map(id => <li key={id} className={mastery.includes(id as MasteryKind) ? 'done' : ''}>{mastery.includes(id as MasteryKind) ? '■' : '□'} {MASTERY_DEFS[id as MasteryKind]?.label ?? id}</li>)}</ul>
        )}
        {mode === 'campaign' && reward && (
          <p className="ll-dim">{reward.status === 'none' ? 'No museum card: no verified exhibit is linked to this chapter.' : reward.status === 'delivered' ? 'A museum card was added.' : 'A museum card is waiting to be delivered.'}</p>
        )}
        <div className="ll-row wrap">
          <button type="button" ref={btn} className="ll-btn primary" onClick={onContinue}>Continue tending</button>
          <button type="button" className="ll-btn" onClick={onReview}>Review plan</button>
          <button type="button" className="ll-btn" onClick={onArchive}>Archive this attempt</button>
        </div>
      </div>
    </div>
  );
}

export function QuestionCard({ question, onAnswer, onSkip }: { question: LearningQuestion; onAnswer: (choice: number) => void; onSkip: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const g = picked === null ? null : gradeAnswer(question, picked);
  return (
    <section className="ll-panel" aria-label="Optional question">
      <p className="ll-eyebrow">Optional question</p>
      <p><b>{question.prompt}</b></p>
      <ul className="ll-qchoices">
        {question.choices.map((c, i) => (
          <li key={c}><button type="button" className={'ll-btn' + (picked === i ? ' sel' : '')} disabled={picked !== null} onClick={() => { setPicked(i); onAnswer(i); }}>{c}</button></li>
        ))}
      </ul>
      {g && <p role="status"><b>{g.label}</b> {g.rationale}</p>}
      <button type="button" className="ll-link-btn" onClick={onSkip}>{picked === null ? 'Not now' : 'Done'}</button>
    </section>
  );
}

export function SettingsDrawer({ settings, voices, audioReady, assetSummary, onChange, onClose }: {
  settings: Settings; voices: VoiceInfo[]; audioReady: boolean; assetSummary: string; onChange: (p: Partial<Settings>) => void; onClose: () => void;
}) {
  useRestoreFocus();
  return (
    <aside className="ll-drawer" aria-label="Settings" onKeyDown={trap}>
      <div className="ll-row spread"><h2 className="ll-h3">Settings</h2><button type="button" className="ll-btn small ghost" onClick={onClose}>Close</button></div>
      <fieldset className="ll-field"><legend>Narration</legend>
        {(['off', 'subtitles', 'browser'] as const).map(m => (
          <label key={m}><input type="radio" name="narr" checked={settings.narration === m} onChange={() => onChange({ narration: m })} />
            {m === 'off' ? 'Off' : m === 'subtitles' ? 'Subtitles only' : 'Spoken by a voice on this device'}</label>
        ))}
        <p className="ll-dim">{assetSummary}</p>
        {settings.narration === 'browser' && !audioReady && <p className="warn-text">No speech voice is available in this browser; subtitles are used instead.</p>}
      </fieldset>
      <label className="ll-field"><input type="checkbox" checked={settings.subtitles} onChange={e => onChange({ subtitles: e.target.checked })} /> Show subtitles</label>
      {settings.narration === 'browser' && audioReady && (
        <>
          <label className="ll-field"><span>Voice</span>
            <select value={settings.voiceURI ?? ''} onChange={e => onChange({ voiceURI: e.target.value || null })}>
              <option value="">Default voice</option>
              {voices.map(v => <option key={v.uri} value={v.uri}>{v.name} ({v.lang}){voiceHint(v) ? ' — name suggests a female-style voice' : ''}</option>)}
            </select>
          </label>
          <label className="ll-field"><span>Speed {settings.narrationSpeed.toFixed(2)}×</span><input type="range" min={0.6} max={1.4} step={0.02} value={settings.narrationSpeed} onChange={e => onChange({ narrationSpeed: Number(e.target.value) })} /></label>
          <label className="ll-field"><span>Volume {Math.round(settings.volume * 100)}%</span><input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={e => onChange({ volume: Number(e.target.value) })} /></label>
        </>
      )}
      <label className="ll-field"><span>Motion</span>
        <select value={settings.motionSpeed} onChange={e => onChange({ motionSpeed: e.target.value as Settings['motionSpeed'] })}>
          <option value="normal">Normal</option><option value="slow">Slow</option><option value="instant">Instant (no animation)</option>
        </select>
      </label>
      <label className="ll-field"><input type="checkbox" checked={settings.questionsEnabled} onChange={e => onChange({ questionsEnabled: e.target.checked })} /> Occasional optional learning questions</label>
    </aside>
  );
}

export function HelpDrawer({ onClose }: { onClose: () => void }) {
  useRestoreFocus();
  return (
    <aside className="ll-drawer" aria-label="Help" onKeyDown={trap}>
      <div className="ll-row spread"><h2 className="ll-h3">How this works</h2><button type="button" className="ll-btn small ghost" onClick={onClose}>Close</button></div>
      <ul className="ll-help">
        <li>Each season you have a few actions. Plan programmes in districts; their cost is reserved once.</li>
        <li>Services reach districts over links. A district can be short even when the reserve is full if a link is too narrow.</li>
        <li>Shortages are warnings, not defeat. The Pressures panel explains the cause and offers different fixes.</li>
        <li>Open the forecast any time: it uses the exact calculation the season will use.</li>
        <li>This is a game of simulated settlements. Programme names are game concepts, not historical claims.</li>
      </ul>
      <h3 className="ll-h3">Keyboard</h3>
      <dl className="ll-keys">
        <dt>Arrow keys</dt><dd>Move between districts</dd>
        <dt>Enter / Space</dt><dd>Select or activate</dd>
        <dt>P</dt><dd>Programmes</dd><dt>C</dt><dd>Council</dd><dt>F</dt><dd>Forecast</dd>
        <dt>N</dt><dd>Advance to the next season</dd><dt>L</dt><dd>Toggle map / list</dd>
        <dt>?</dt><dd>This help</dd><dt>Escape</dt><dd>Close the open panel</dd>
      </dl>
    </aside>
  );
}
