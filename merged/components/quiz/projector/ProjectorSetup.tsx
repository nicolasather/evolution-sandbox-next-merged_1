'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/quiz/client';
import { MODE_LIST, MODES, isGameKey } from '@/lib/quiz/projector/modes';
import { DURATION_PRESETS, planFor, type Plan, type PoolCheck } from '@/lib/quiz/projector/scale';
import { modifierRule } from '@/lib/quiz/projector/compat';
import { MODIFIERS } from '@/lib/quiz/types';
import type { GameKey, LearningFocus, ProjectorSettings } from '@/lib/quiz/projector/types';
import { L } from './i18n';
import { TeamSwatch } from './parts';
import type { Locale } from '@/lib/quiz/projector/types';

const S = {
  steps: { en: ['Game', 'Teams & flow', 'Time', 'Learning', 'Launch'] },
  game: { en: 'Pick the game first. Modifiers come afterwards.' },
  teams: { en: 'Number of teams' }, flow: { en: 'Turn flow' },
  rr: { en: 'Round robin — one team at a time' }, sync: { en: 'Synchronized — every team answers' },
  names: { en: 'Team names' }, time: { en: 'Lesson length' }, untimed: { en: 'No clock' }, min: { en: 'min' },
  focus: { en: 'Learning emphasis' }, study: { en: 'Study — explanations after every question' },
  balanced: { en: 'Balanced' }, gameF: { en: 'Game — faster pace' },
  low: { en: 'Low pressure (no penalties, gentler timing)' }, read: { en: 'Read questions aloud (teacher)' },
  repeats: { en: 'Allow one labelled review cycle if the quiz runs short' },
  comeback: { en: 'Comeback help for trailing teams' },
  plan: { en: 'What this lesson will contain' }, turns: { en: 'Turns' }, perTeam: { en: 'Per team' }, qs: { en: 'Questions' }, sec: { en: 'Sec / turn' },
  avail: { en: 'In this quiz' }, short: { en: 'The quiz has {n} fewer questions than this lesson needs.' },
  suggest: { en: 'A {m}-minute lesson fits this quiz.' }, useIt: { en: 'Use {m} min' },
  tooFew: { en: 'Not enough questions even with a review cycle. Add questions or shorten the lesson.' },
  mods: { en: 'Modifiers' }, modsNote: { en: 'Each projector game has its own native mechanics, so classic modifiers are shown with the reason they are off.' },
  next: { en: 'Next' }, back: { en: 'Back' }, launch: { en: 'Create game' }, tryLab: { en: 'Try it first with sample questions' },
  creating: { en: 'Creating…' }, signin: { en: 'Sign in to create a game.' },
  world: { en: 'World' }, objective: { en: 'Objective' }, boss: { en: 'Boss' }, campaign: { en: 'Campaign' }, mission: { en: 'Mission' }, board: { en: 'Map' },
  weak: { en: 'Preview unavailable right now.' },
} as const;
const SETTING_OPTS: Record<GameKey, { key: keyof ProjectorSettings; label: keyof typeof S; vals: { v: string; en: string }[] }[]> = {
  empire_race: [
    { key: 'world', label: 'world', vals: [{ v: 'archipelago', en: 'Archipelago' }, { v: 'river_kingdom', en: 'River Kingdom' }, { v: 'desert_crossing', en: 'Desert Crossing' }] },
    { key: 'objective', label: 'objective', vals: [{ v: 'territory', en: 'Territory' }, { v: 'capital', en: 'Capital' }, { v: 'expedition', en: 'Expedition' }] }],
  boss_battle: [{ key: 'boss', label: 'boss', vals: [{ v: 'clockwork_leviathan', en: 'Clockwork Leviathan' }, { v: 'library_colossus', en: 'Library Colossus' }, { v: 'storm_engine', en: 'Storm Engine' }] }],
  escape_room: [{ key: 'campaign', label: 'campaign', vals: [{ v: 'clockhouse', en: 'Clockhouse' }, { v: 'celestial_archive', en: 'Celestial Archive' }, { v: 'glass_garden', en: 'Glass Garden' }] }],
  treasure_vault: [],
  risk_ladder: [{ key: 'mission', label: 'mission', vals: [{ v: 'highest', en: 'Highest climb' }, { v: 'first', en: 'First to summit' }, { v: 'group', en: 'Class climb' }] }],
  auction_house: [],
  territory_war: [{ key: 'board', label: 'board', vals: [{ v: 'frontier', en: 'Frontier plains' }, { v: 'canyon', en: 'Canyon crossing' }, { v: 'delta', en: 'River delta' }] }],
  lucky_factory: [],
  pirate_voyage: [],
  final_showdown: [],
};
const t = (l: Locale, k: keyof typeof S, vars: Record<string, string | number> = {}) => { const v = S[k] as { en: string }; return Object.entries(vars).reduce((s, [a, b]) => s.replace(`{${a}}`, String(b)), v[l]); };

export default function ProjectorSetup({ quizId, quizTitle, questionCount, signedIn, initialGame }: { quizId: string; quizTitle: string; questionCount: number; signedIn: boolean; initialGame: string | null }) {
  const router = useRouter();
  const [locale] = useState<Locale>('en'); // English-only launch
  const [step, setStep] = useState(isGameKey(initialGame) ? 1 : 0);
  const [game, setGame] = useState<GameKey>(isGameKey(initialGame) ? initialGame : 'empire_race');
  const [teams, setTeams] = useState(3); const [names, setNames] = useState<string[]>(['Red', 'Blue', 'Green', 'Gold', 'Violet', 'Teal', 'Pink', 'Grey']);
  const [flow, setFlow] = useState<'round_robin' | 'synchronized'>('round_robin');
  const [minutes, setMinutes] = useState<number | null>(30); const [focus, setFocus] = useState<LearningFocus>('balanced');
  const [low, setLow] = useState(false); const [read, setRead] = useState(false); const [repeats, setRepeats] = useState(false); const [comeback, setComeback] = useState(true);
  const [settings, setSettings] = useState<ProjectorSettings>({});
  const [check, setCheck] = useState<PoolCheck | null>(null); const [fitTurns, setFitTurns] = useState<number | null>(null); const [previewErr, setPreviewErr] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const info = MODES[game];
  const plan: Plan = useMemo(() => planFor(game, minutes, teams, focus), [game, minutes, teams, focus]);
  useEffect(() => {
    if (!signedIn) return; let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the stale preview error before a fresh request
    setPreviewErr(false);
    const h = setTimeout(async () => {
      try { const d = await api<{ plan: Plan; check: PoolCheck; fitTurns: number | null }>('/api/quiz/projector/preflight', { method: 'POST', json: { quizId, game, minutes, focus, teams } }); if (live) { setCheck(d.check); setFitTurns(d.fitTurns); } }
      catch { if (live) setPreviewErr(true); }
    }, 300);
    return () => { live = false; clearTimeout(h); };
  }, [quizId, game, minutes, focus, teams, signedIn]);
  const blocked = !!check && !check.ok && !(check.flags.includes('needsRepeatCycle') && repeats);
  const launch = async () => {
    setBusy(true); setErr('');
    try {
      const body = { quizId, game, flow, teamNames: names.slice(0, teams).map((n, i) => n.trim() || `Team ${i + 1}`), minutes, focus, modifiers: [], allowRepeats: repeats, lowPressure: low, readAloud: read, settings: { ...settings, ...(game === 'empire_race' ? { comeback } : {}) } };
      const r = await api<{ roomId?: string; id?: string }>('/api/quiz/projector/create', { method: 'POST', json: body });
      router.push(`/quiz/host/${r.roomId ?? r.id}`);
    } catch (e) { setErr(e instanceof ApiError ? e.message : String(e)); setBusy(false); }
  };
  const last = step === 4;
  return (
    <main className="page stack" style={{ ['--pj-accent' as string]: info.accent }}>
      <header className="stack"><p className="eyebrow">{quizTitle} · {questionCount}</p><h1>{L(locale, info.name)}</h1>
</header>
      <ol className="pj-steps" aria-label="steps">{S.steps[locale].map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} style={i === step ? { background: 'var(--qz-yellow)', color: '#0b1018' } : undefined}>{s}</li>)}</ol>
      {step === 0 && <section className="stack"><h2>{t(locale, 'game')}</h2>
        <div className="pj-games" role="radiogroup" aria-label={t(locale, 'game')}>{MODE_LIST.map((m) => (
          <button key={m.key} role="radio" aria-checked={game === m.key} className="pj-game" style={{ ['--accent' as string]: m.accent }} onClick={() => { setGame(m.key); setSettings({}); setMinutes(m.defaultMinutes); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/quiz/modes/${m.art}.svg`} alt="" /><span className="body"><span className="tag">{L(locale, m.style)}</span><h3>{L(locale, m.name)}</h3><p>{L(locale, m.tagline)}</p><p className="muted-text">{L(locale, m.objective)}</p></span>
          </button>))}</div></section>}
      {step === 1 && <section className="panel stack">
        <fieldset className="pj-fieldset"><legend>{t(locale, 'teams')}</legend><div className="pj-radios">{[2, 3, 4, 5, 6, 7, 8].map((n) => <label key={n}><input type="radio" name="teams" checked={teams === n} onChange={() => setTeams(n)} />{n}</label>)}</div></fieldset>
        <fieldset className="pj-fieldset"><legend>{t(locale, 'names')}</legend><div className="pj-names">{names.slice(0, teams).map((n, i) => <label key={i}><TeamSwatch i={i} /><input value={n} maxLength={40} aria-label={`${t(locale, 'names')} ${i + 1}`} onChange={(e) => setNames((a) => a.map((x, j) => (j === i ? e.target.value : x)))} /></label>)}</div></fieldset>
        <fieldset className="pj-fieldset"><legend>{t(locale, 'flow')}</legend><div className="pj-radios">
          <label><input type="radio" name="flow" checked={flow === 'round_robin'} onChange={() => setFlow('round_robin')} />{t(locale, 'rr')}</label>
          <label><input type="radio" name="flow" checked={flow === 'synchronized'} onChange={() => setFlow('synchronized')} />{t(locale, 'sync')}</label></div></fieldset>
        {SETTING_OPTS[game].map((o) => <fieldset key={o.key} className="pj-fieldset"><legend>{t(locale, o.label)}</legend><div className="pj-radios">{o.vals.map((v, i) => {
          const cur = (settings[o.key] as string | undefined) ?? o.vals[0]!.v;
          return <label key={v.v}><input type="radio" name={o.key} checked={cur === v.v} onChange={() => setSettings((s) => ({ ...s, [o.key]: v.v }))} />{v[locale]}{i === 0 ? '' : ''}</label>; })}</div></fieldset>)}
        {game === 'empire_race' && <label className="pj-check"><input type="checkbox" checked={comeback} onChange={(e) => setComeback(e.target.checked)} />{t(locale, 'comeback')}</label>}
      </section>}
      {step === 2 && <section className="panel stack">
        <fieldset className="pj-fieldset"><legend>{t(locale, 'time')}</legend><div className="pj-radios">
          {DURATION_PRESETS.map((m) => <label key={m}><input type="radio" name="min" checked={minutes === m} onChange={() => setMinutes(m)} />{m} {t(locale, 'min')}</label>)}
          <label><input type="radio" name="min" checked={minutes === null} onChange={() => setMinutes(null)} />{t(locale, 'untimed')}</label></div>
          <label className="pj-field">{minutes ?? '∞'} {minutes !== null && t(locale, 'min')}<input type="range" min={5} max={180} step={5} value={minutes ?? 45} disabled={minutes === null} aria-label={t(locale, 'time')} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
        </fieldset>
        <h3>{t(locale, 'plan')}</h3>
        <div className="pj-plan"><div><b>{plan.turnBudget}</b><small>{t(locale, 'turns')}</small></div><div><b>{plan.turnsPerTeam}</b><small>{t(locale, 'perTeam')}</small></div><div><b>{plan.questionsNeeded}</b><small>{t(locale, 'qs')}</small></div><div><b>{plan.secondsPerTurn}</b><small>{t(locale, 'sec')}</small></div>{check && <div><b>{check.available}</b><small>{t(locale, 'avail')}</small></div>}</div>
        {previewErr && <p className="muted-text">{t(locale, 'weak')}</p>}
        {check && check.shortage > 0 && <div className="note" role="status"><p>{t(locale, 'short', { n: check.shortage })}</p>
          {check.fitMinutes && <p>{t(locale, 'suggest', { m: check.fitMinutes })} <button className="btn small" onClick={() => setMinutes(check.fitMinutes)}>{t(locale, 'useIt', { m: check.fitMinutes })}</button></p>}
          {check.flags.includes('needsRepeatCycle') ? <label className="pj-check"><input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />{t(locale, 'repeats')}</label> : <p className="error">{t(locale, 'tooFew')}</p>}</div>}
        {fitTurns !== null && check && check.shortage > 0 && null}
      </section>}
      {step === 3 && <section className="panel stack">
        <fieldset className="pj-fieldset"><legend>{t(locale, 'focus')}</legend><div className="pj-radios">
          <label><input type="radio" name="focus" checked={focus === 'study'} onChange={() => setFocus('study')} />{t(locale, 'study')}</label>
          <label><input type="radio" name="focus" checked={focus === 'balanced'} onChange={() => setFocus('balanced')} />{t(locale, 'balanced')}</label>
          <label><input type="radio" name="focus" checked={focus === 'game'} onChange={() => setFocus('game')} />{t(locale, 'gameF')}</label></div></fieldset>
        <label className="pj-check"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />{t(locale, 'low')}</label>
        <label className="pj-check"><input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />{t(locale, 'read')}</label>
        <h3>{t(locale, 'mods')}</h3><p className="muted-text">{t(locale, 'modsNote')}</p>
        <ul className="pj-mods">{MODIFIERS.map((m) => <li key={m}><b>{m.replace(/_/g, ' ')}</b><span>{L(locale, modifierRule(game, m).reason)}</span></li>)}</ul>
      </section>}
      {step === 4 && <section className="panel stack">
        <p><b>{L(locale, info.name)}</b> · {teams} · {minutes ?? t(locale, 'untimed')} {minutes !== null && t(locale, 'min')} · {flow === 'round_robin' ? t(locale, 'rr') : t(locale, 'sync')}</p>
        <ul className="pj-teams" style={{ marginTop: 0 }}>{names.slice(0, teams).map((n, i) => <li key={i}><TeamSwatch i={i} /><span className="pj-tn">{n || `Team ${i + 1}`}</span></li>)}</ul>
        {!signedIn && <p className="error">{t(locale, 'signin')}</p>}
        {blocked && <p className="error">{t(locale, 'tooFew')}</p>}
        {err && <p className="error" role="alert">{err}</p>}
        <div className="row"><button className="btn primary" disabled={busy || !signedIn || blocked} onClick={launch}>{busy ? t(locale, 'creating') : t(locale, 'launch')}</button>
          <a className="btn ghost" href={`/quiz/lab?game=${game}&teams=${teams}&minutes=${minutes ?? 'none'}&focus=${focus}`} target="_blank" rel="noreferrer">{t(locale, 'tryLab')}</a></div>
      </section>}
      <div className="row"><button className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>{t(locale, 'back')}</button>
        {!last && <button className="btn" onClick={() => setStep((s) => s + 1)}>{t(locale, 'next')}</button>}</div>
    </main>
  );
}
