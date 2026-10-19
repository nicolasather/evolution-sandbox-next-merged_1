'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MODES } from '@/lib/quiz/projector/modes';
import type { BossG } from '@/lib/quiz/projector/reducers/boss';
import type { EmpireG } from '@/lib/quiz/projector/reducers/empire';
import type { EscapeG } from '@/lib/quiz/projector/reducers/escape';
import type { LadderG } from '@/lib/quiz/projector/reducers/ladder';
import type { VaultG } from '@/lib/quiz/projector/reducers/vault';
import type { Core, Locale } from '@/lib/quiz/projector/types';
import { fmtClock, useTick } from '../useRoomState';
import { BossControls, EmpireControls, EscapeControls, LadderControls, VaultControls } from './GameControls';
import { MarkPanel, QuestionView, Summary, TeamStrip } from './parts';
import BossScene from './scenes/BossScene';
import EmpireScene from './scenes/EmpireScene';
import EscapeScene from './scenes/EscapeScene';
import LadderScene from './scenes/LadderScene';
import VaultScene from './scenes/VaultScene';
import { L, logText, tr } from './i18n';
import type { GameApi } from './useGame';

export type Prefs = { locale: Locale; large: boolean; contrast: boolean; calm: boolean; sound: boolean };
const KEY = 'qz:pj:prefs';
export function usePrefs(initial: Locale): [Prefs, (p: Partial<Prefs>) => void] {
  const [prefs, set] = useState<Prefs>({ locale: initial, large: false, contrast: false, calm: false, sound: false });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate saved preferences after mount (SSR-safe)
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) set((p) => ({ ...p, ...(JSON.parse(raw) as Partial<Prefs>) })); } catch { /* private mode */ } }, []);
  const update = useCallback((p: Partial<Prefs>) => set((cur) => { const n = { ...cur, ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; }), []);
  return [prefs, update];
}

/** Optional sound cues; every cue is also written as a caption line, so nothing depends on hearing it. */
function useCues(core: Core | undefined, enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null); const last = useRef(0);
  useEffect(() => {
    if (!core?.fx || !enabled || core.fx.n === last.current) { if (core?.fx) last.current = core.fx.n; return; }
    last.current = core.fx.n;
    try {
      ctx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const a = ctx.current; const o = a.createOscillator(); const g = a.createGain(); const k = core.fx.kind;
      o.type = k === 'miss' ? 'square' : 'triangle'; o.frequency.value = k === 'miss' ? 180 : k === 'finish' ? 660 : 440 + (core.fx.n % 4) * 60;
      g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.12, a.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.22);
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.25);
    } catch { /* audio unavailable */ }
  }, [core, enabled]);
}

function ClockBadge({ api, locale }: { api: GameApi; locale: Locale }) {
  useTick(500);
  const s = api.snap!; const c = s.clock; const now = c.paused && c.pausedAt ? Date.parse(c.pausedAt) : api.serverNow();
  if (c.status === 'waiting') return <span className="pj-clock">—</span>;
  if (c.untimed || !c.deadlineAt) return <span className="pj-clock" aria-label={tr(locale, 'untimed')}>∞ {tr(locale, 'untimed')}</span>;
  const left = (Date.parse(c.deadlineAt) - now) / 1000;
  const label = c.paused ? tr(locale, 'paused') : left <= 0 ? tr(locale, 'lastTurn') : '';
  return <span className={`pj-clock ${left < 60 && left > 0 ? 'low' : ''} ${c.paused ? 'paused' : ''}`} role="timer" aria-label={`${tr(locale, 'time')} ${fmtClock(left)}`}>{label ? `${label} · ` : ''}{left > 0 ? fmtClock(left) : '0:00'}</span>;
}

type SceneState = { selected: string | number | null; setSelected: (v: string | number | null) => void };
function Scene({ core, g, locale, host, st }: { core: Core; g: unknown; locale: Locale; host: boolean; st: SceneState }) {
  const sel = st.selected;
  switch (core.game) {
    case 'empire_race': return <EmpireScene core={core} g={g as EmpireG} locale={locale} selected={typeof sel === 'number' ? sel : null} onTile={host ? (id) => st.setSelected(id) : undefined} />;
    case 'boss_battle': return <BossScene core={core} g={g as BossG} locale={locale} />;
    case 'escape_room': return <EscapeScene core={core} g={g as EscapeG} locale={locale} selected={typeof sel === 'string' ? sel : null} onSpot={host ? (id) => st.setSelected(id) : undefined} />;
    case 'treasure_vault': return <VaultScene core={core} g={g as VaultG} locale={locale} onVault={host ? (id) => st.setSelected(id) : undefined} />;
    default: return <LadderScene core={core} g={g as LadderG} locale={locale} />;
  }
}

export default function GameStage({ api, view, prefs, setPrefs, projectorHref, backHref }: { api: GameApi; view: 'host' | 'projector'; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; projectorHref?: string; backHref?: string }) {
  const { snap } = api; const locale = prefs.locale; const host = view === 'host';
  const [selected, setSelected] = useState<string | number | null>(null);
  useCues(snap?.game.core, prefs.sound);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new phase or round clears the pending selection
  useEffect(() => { setSelected(null); }, [snap?.game.core.phase, snap?.game.core.round]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  if (api.fatal) return <main className="narrow"><section className="panel stack"><h1>{tr(locale, 'finished')}</h1><p className="error">{api.error}</p></section></main>;
  if (!snap) return <main className="page"><p className="muted-text" role="status">{api.offline ? tr(locale, 'offline') : tr(locale, 'loading')}</p></main>;
  const core = snap.game.core as Core; const g = snap.game.g; const info = MODES[core.game]; const waiting = snap.clock.status === 'waiting';
  const finished = core.phase === 'finished'; const turnN = Math.min(core.turnsUsed + (finished ? 0 : 1), core.turnBudget);
  const asking = core.phase === 'asking' && !!snap.question; const teamName = (id?: string) => core.teams.find((t) => t.id === id)?.name ?? '';
  const last = core.log[core.log.length - 1]; const activeName = core.askMode === 'all' ? tr(locale, 'allTeams') : tr(locale, 'yourTurn', { team: core.teams[core.actor % core.teams.length]!.name });
  const ctl = { core, g, locale, send: api.send, busy: api.busy, selected, clearSel: () => setSelected(null) };
  const Controls = core.game === 'empire_race' ? EmpireControls : core.game === 'boss_battle' ? BossControls : core.game === 'escape_room' ? EscapeControls : core.game === 'treasure_vault' ? VaultControls : LadderControls;
  return (
    <div className="pj" data-game={core.game} data-view={view} data-large={prefs.large || undefined} data-contrast={prefs.contrast || undefined} data-calm={prefs.calm || undefined} lang={locale}
      style={{ ['--pj-accent' as string]: info.accent, ['--pj-paper' as string]: info.paper, ['--pj-ink' as string]: info.ink }}>
      <header className="pj-top">
        <div className="pj-title"><p className="eyebrow">{L(locale, info.style)}</p><h1>{L(locale, info.name)}</h1></div>
        <div className="pj-meta">
          <span className="pj-turn">{finished ? tr(locale, 'finished') : waiting ? '—' : `${tr(locale, 'round', { n: turnN, m: core.turnBudget })} · ${activeName}`}</span>
          <ClockBadge api={api} locale={locale} />
          {core.finishAfterTurn && !finished && <span className="pj-flag">{tr(locale, 'lastTurn')}</span>}
        </div>
        <div className="pj-tools" role="group" aria-label={tr(locale, 'language')}>
          <button className="btn small ghost" aria-pressed={locale === 'vi'} onClick={() => setPrefs({ locale: locale === 'vi' ? 'en' : 'vi' })} aria-label={tr(locale, 'language')}>{locale === 'vi' ? 'VI · EN' : 'EN · VI'}</button>
          <button className="btn small ghost" aria-pressed={prefs.large} onClick={() => setPrefs({ large: !prefs.large })}>{tr(locale, 'largePrint')}</button>
          <button className="btn small ghost" aria-pressed={prefs.contrast} onClick={() => setPrefs({ contrast: !prefs.contrast })}>{tr(locale, 'highContrast')}</button>
          <button className="btn small ghost" aria-pressed={prefs.calm} onClick={() => setPrefs({ calm: !prefs.calm })}>{tr(locale, 'calm')}</button>
          <button className="btn small ghost" aria-pressed={prefs.sound} onClick={() => setPrefs({ sound: !prefs.sound })}>{tr(locale, 'sound')}</button>
          {host && projectorHref && <button className="btn small ghost" onClick={() => window.open(projectorHref, 'qz-projector', 'popup,width=1280,height=720')}>{tr(locale, 'openProjector')}</button>}
          <button className="btn small ghost" onClick={() => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()); }}>⛶</button>
        </div>
      </header>
      {(api.offline || api.error) && <p className="pj-alert" role="alert">{api.offline ? tr(locale, 'offline') : api.error}</p>}
      <div className="pj-body">
        <div className="pj-stage">
          <div className={`pj-scene ${asking ? 'dim' : ''}`}>
            <Scene core={core} g={g} locale={locale} host={host && !finished} st={{ selected, setSelected }} />
            {asking && <div className="pj-overlay"><QuestionView q={snap.question} core={core} locale={locale} />
              <p className="pj-asked">{core.ask!.teamIds.map((id) => teamName(id)).join(' · ')}</p></div>}
            {waiting && !finished && <div className="pj-overlay pj-wait" role="status"><p>{tr(locale, 'waiting')}</p></div>}
            {finished && <div className="pj-overlay pj-end"><Summary core={core} locale={locale} host={host} /></div>}
          </div>
          <TeamStrip core={core} g={g} locale={locale} />
          <p className="pj-caption" aria-live="polite" aria-label={tr(locale, 'captions')}>{last ? logText(locale, last, teamName) : ''}</p>
        </div>
        {host && (
          <aside className="pj-dock" aria-label="Teacher controls">
            <section className="pj-panel pj-clockctl">
              <div className="row">
                <button className="btn primary" disabled={api.busy || !waiting} onClick={() => api.send('start')}>{tr(locale, 'start')}</button>
                <button className="btn ghost" disabled={api.busy || waiting || finished} onClick={() => api.send(snap.clock.paused ? 'resume' : 'pause')}>{snap.clock.paused ? tr(locale, 'resume') : tr(locale, 'pause')}</button>
                <button className="btn ghost" disabled={api.busy || waiting || finished || snap.clock.untimed} onClick={() => api.send('extend', { minutes: 5, reason: 'teacher' })}>{tr(locale, 'extend', { n: 5 })}</button>
              </div>
              <div className="row">
                <button className="btn ghost" disabled={api.busy || waiting || finished || core.finishAfterTurn} onClick={() => api.send('finish_turn')}>{tr(locale, 'finishTurn')}</button>
                {confirmEnd
                  ? <><button className="btn danger" disabled={api.busy} onClick={() => { setConfirmEnd(false); void api.send('finish_now'); }}>{tr(locale, 'endNow')} ✓</button><button className="btn ghost" onClick={() => setConfirmEnd(false)}>✕</button></>
                  : <button className="btn danger" disabled={api.busy || waiting || finished} onClick={() => setConfirmEnd(true)}>{tr(locale, 'endNow')}</button>}
              </div>
              {confirmEnd && <p className="note" role="alert">{tr(locale, 'endConfirm')}</p>}
              {snap.clock.overtime && !finished && <p className="note" role="status">{tr(locale, 'overtime')}</p>}
            </section>
            {!finished && !waiting && core.phase === 'asking' && <MarkPanel q={snap.question} core={core} locale={locale} busy={api.busy} onMark={(teamId, verdict) => api.send('grade', { teamId, verdict })} />}
            {!finished && !waiting && (core.phase === 'review' || core.phase === 'resolution') && <section className="pj-panel"><button className="btn primary" disabled={api.busy} onClick={() => api.send('continue')}>{tr(locale, 'continueBtn')}</button></section>}
            {!finished && !waiting && core.phase !== 'asking' && <section className="pj-panel"><h3>{activeName}</h3><Controls {...ctl} /></section>}
            <section className="pj-panel pj-log" aria-label="log"><ol>{[...core.log].reverse().slice(0, 8).map((e) => <li key={e.n}>{logText(locale, e, teamName)}</li>)}</ol></section>
            {backHref && finished && <a className="btn ghost" href={backHref}>{tr(locale, 'report')}</a>}
          </aside>
        )}
      </div>
    </div>
  );
}
