'use client';
/** Teacher setup for an online Clue Racing race, in five stages: 1 Format → 2 Map & difficulty → 3 Teams → 4 Length (the quiz check runs here with the real question formats) → 5 Options & perks.
 *  Nothing is created until the last button, and the button says what it does and, when disabled, why. */
import MapPoster, { CR_THEME } from '@/components/quiz/art/MapPoster';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import { checkTeamNames } from '@/lib/quiz/projector/team-names';
import { DIFFICULTY_COPY, DURATION_MINUTES, FORMAT_COPY, PERK_COPY, ROLE_INFO } from '@/lib/quiz/cr/balance';
import { FORMATS, MAP_IDS, PERKS, type Format, type MapId, type Perk } from '@/lib/quiz/cr/domain';
import { MAP_INFO } from '@/lib/quiz/cr/maps';
import { FormatIcon, PerkIcon, TeamBadge } from './icons';
import { TEAM_COLORS } from './art';

const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
type Pre = { plan: { windows: number; legs: number; legSeconds: number; estimatedMinutes: number; questionsAvailable: number; reviewCycle: boolean; notes: string[]; minutes: number; quizShare: number }; questions: number; byKind: Record<string, number>; ok: boolean; needsMinimum: number };
const KIND: Record<string, string> = { multiple_choice: 'multiple choice', truth_hunt: 'true / false', answer_forge: 'typed answer', connection_rush: 'matching', fill_table: 'table' };
const STAGES = ['Format', 'Map', 'Teams', 'Length', 'Options'] as const;

export default function CRSetup({ quizId, quizTitle, questionCount, signedIn }: { quizId: string; quizTitle: string; questionCount: number; signedIn: boolean }) {
  const router = useRouter(); const [stage, setStage] = useState(0);
  const [format, setFormat] = useState<Format>('split_route'); const [mapId, setMapId] = useState<MapId>('sunleaf_passage'); const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'challenge'>('normal');
  const [teamCount, setTeamCount] = useState(2); const [size, setSize] = useState(4); const [names, setNames] = useState(DEFAULT_NAMES); const [minutes, setMinutes] = useState<number>(15); const [perks, setPerks] = useState<Perk[]>([...PERKS]);
  const [lowPressure, setLow] = useState(false); const [readAloud, setRead] = useState(false); const [hideNames, setHide] = useState(false); const [requireApproval, setReq] = useState(false); const [allowReview, setReview] = useState(false);
  const [pre, setPre] = useState<{ key: string; data: Pre | null; err: string }>({ key: '', data: null, err: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const cap = Math.min(5, Math.floor(20 / teamCount)); const sizeOk = Math.min(size, cap); const teamNames = names.slice(0, teamCount);
  const nameCheck = useMemo(() => checkTeamNames(teamNames), [teamNames]);
  const key = JSON.stringify({ quizId, minutes, readAloud, lowPressure, allowReview, format, mapId });
  useEffect(() => {
    if (!signedIn) return undefined; let live = true;
    const t = setTimeout(() => { api<Pre>('/api/quiz/clue/preflight', { method: 'POST', json: { quizId, minutes, readAloud, lowPressure, allowReviewCycle: allowReview, format, mapId } }).then((d) => { if (live) setPre({ key, data: d, err: '' }); }).catch((e) => { if (live) setPre({ key, data: null, err: (e as Error).message }); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [key, quizId, minutes, readAloud, lowPressure, allowReview, format, mapId, signedIn]);
  const plan = pre.key === key ? pre.data?.plan ?? null : null; const checking = pre.key !== key; const short = !!plan && plan.windows < (pre.data?.needsMinimum ?? 3);
  const reason = checking ? 'Checking the quiz…' : pre.err ? pre.err : !plan ? 'Waiting for the quiz check.' : short ? `Only ${plan.windows} question window(s) fit: a hosted race needs at least 3. Choose a shorter length or a longer quiz.` : !nameCheck.ok ? 'Fix the team names.' : !pre.data?.ok ? 'The quiz check did not pass.' : '';
  const launch = async () => {
    setBusy(true); setErr('');
    try {
      const out = await api<{ roomId: string; hostUrl: string }>('/api/quiz/clue/create', { method: 'POST', json: { quizId, format, mapId, minutes, teamCount, teamSizeCap: sizeOk, teamNames: nameCheck.names, difficulty, lowPressure, readAloud, hideNames, requireApproval, allowReviewCycle: allowReview, perks } });
      router.push(out.hostUrl);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not create the room. Try again.'); setBusy(false); }
  };
  if (!signedIn) return (
    <main className="cr narrow"><section className="cr-card"><h1>Sign in to host Clue Racing</h1><p className="cr-note">Hosting saves the race and its results to your account. Students join without one.</p>
      <div className="cr-row"><Link className="cr-btn primary" href={`/quiz/login?next=/quiz/setup/${quizId}/cr`}>Sign in</Link><Link className="cr-btn" href="/quiz/cr/practice">Try the practice first</Link></div></section></main>
  );
  return (
    <main className="cr cr-setup">
      <header><p className="cr-note">Clue Racing · online, one device per student</p><h1>{quizTitle}</h1><p className="cr-note">{questionCount} questions in this quiz.</p></header>
      <ol className="cr-stages" aria-label="Setup stages">{STAGES.map((s, i) => <li key={s}><button type="button" aria-current={stage === i ? 'step' : undefined} data-done={i < stage || undefined} onClick={() => setStage(i)}><span>{i + 1}</span>{s}</button></li>)}</ol>
      <section className="cr-card cr-stage-card" aria-live="polite">
        {stage === 0 && <><h2>1 · Format</h2><div className="cr-choice" role="radiogroup" aria-label="Format">{FORMATS.map((f) => <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)}><FormatIcon format={f} size={30} /><b>{FORMAT_COPY[f].name}</b><span>{FORMAT_COPY[f].blurb}</span></button>)}</div></>}
        {stage === 1 && <><h2>2 · Map &amp; difficulty</h2>
          <div className="cr-maps" role="radiogroup" aria-label="Map">{MAP_IDS.map((m) => <button key={m} type="button" role="radio" aria-checked={mapId === m} onClick={() => setMapId(m)}><MapPoster theme={CR_THEME[m] ?? 'orchard'} seed={MAP_IDS.indexOf(m) + 1} /><b>{MAP_INFO[m].title}</b><span>{MAP_INFO[m].blurb}</span></button>)}</div>
          <p className="cr-note">Every team races the same authored course from the same start, at the same speed.</p>
          <div className="cr-choice" role="radiogroup" aria-label="Difficulty">{(['easy', 'normal', 'challenge'] as const).map((d) => <button key={d} type="button" role="radio" aria-checked={difficulty === d} onClick={() => setDifficulty(d)}><b>{d[0]!.toUpperCase() + d.slice(1)}</b><span>{DIFFICULTY_COPY[d]}</span></button>)}</div></>}
        {stage === 2 && <><h2>3 · Teams</h2>
          <div className="cr-row wrap">
            <label className="cr-field">Teams<select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="cr-field">Students per team<select value={sizeOk} onChange={(e) => setSize(Number(e.target.value))}>{[1, 2, 3, 4, 5].filter((n) => n <= cap).map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          <p className="cr-note">Room for {teamCount * sizeOk} students (never more than 20). A team of one plays the <b>{ROLE_INFO.solo_pathfinder.name}</b>; teams of two to five choose from Scout, Signal Keeper, Cartographer, Trail Maker and Archivist, each at most once.</p>
          <div className="cr-names">{teamNames.map((n, i) => (
            <label key={i} className="cr-field"><span><TeamBadge index={i} size={18} /> Team {i + 1} name</span>
              <input value={n} maxLength={24} style={{ borderColor: TEAM_COLORS[i] }} onChange={(e) => setNames((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} aria-invalid={!!nameCheck.errors[i]} aria-describedby={nameCheck.errors[i] ? `cr-name-err-${i}` : undefined} />
              {nameCheck.errors[i] && <span id={`cr-name-err-${i}`} className="cr-why">{nameCheck.errors[i]}</span>}</label>))}</div></>}
        {stage === 3 && <><h2>4 · Length</h2>
          <label className="cr-field">Target length<select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{DURATION_MINUTES.map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
          <div className="cr-plan" aria-live="polite">
            {checking && <p className="cr-note">Checking the quiz…</p>}{pre.err && !checking && <p className="cr-why">{pre.err}</p>}
            {plan && !checking && <>
              <p><b>{plan.windows} question windows</b> in {plan.legs} legs · about {plan.estimatedMinutes} minutes · up to {plan.legSeconds} s of walking per leg · quiz and review take about {Math.round(plan.quizShare * 100)}% of the time</p>
              <p className="cr-note">Each window uses one distinct question; the quiz has {plan.questionsAvailable}{pre.data ? ` (${Object.entries(pre.data.byKind).map(([k, n]) => `${n} ${KIND[k] ?? k}`).join(', ')})` : ''}. The race never invents questions.</p>
              {plan.notes.includes('shortQuiz') && !allowReview && <p className="cr-note">The quiz is shorter than the time you asked for, so the race will have fewer windows.</p>}
              {plan.notes.includes('timeLimited') && <p className="cr-note">Some questions were left out so the race fits the length you chose.</p>}
              {pre.data && pre.data.questions < 26 && <label className="cr-check"><input type="checkbox" checked={allowReview} onChange={(e) => setReview(e.target.checked)} />Repeat questions once as a labelled review window to fill the time</label>}
              {short && <p className="cr-why">With this quiz and length there would be fewer than {pre.data?.needsMinimum ?? 3} windows. Choose a shorter length or a longer quiz.</p>}
            </>}
          </div></>}
        {stage === 4 && <><h2>5 · Options &amp; perks</h2>
          <div className="cr-opts">{PERKS.map((p) => <label key={p} className="cr-check"><input type="checkbox" checked={perks.includes(p)} onChange={(e) => setPerks((cur) => (e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))} /><PerkIcon perk={p} size={22} /><span><b>{PERK_COPY[p].name}</b> — {PERK_COPY[p].blurb}</span></label>)}</div>
          <p className="cr-note">Perks are small helps bought with quiz points (at most two per leg). None of them can hurt or block another team.</p>
          <div className="cr-opts">
            <label className="cr-check"><input type="checkbox" checked={lowPressure} onChange={(e) => setLow(e.target.checked)} />Gentle timing: longer question time and longer legs</label>
            <label className="cr-check"><input type="checkbox" checked={readAloud} onChange={(e) => setRead(e.target.checked)} />Read-aloud time: adds reading time to every question</label>
            <label className="cr-check"><input type="checkbox" checked={hideNames} onChange={(e) => setHide(e.target.checked)} />Hide student names from rivals and the projector (always on for the projector)</label>
            <label className="cr-check"><input type="checkbox" checked={requireApproval} onChange={(e) => setReq(e.target.checked)} />Approve each student before they join</label>
          </div></>}
        <div className="cr-row">
          {stage > 0 && <button type="button" className="cr-btn" onClick={() => setStage(stage - 1)}>Back</button>}
          {stage < STAGES.length - 1 && <button type="button" className="cr-btn primary" onClick={() => setStage(stage + 1)}>Next: {STAGES[stage + 1]}</button>}
        </div>
      </section>
      {err && <p className="cr-why" role="alert">{err}</p>}
      <div className="cr-row"><button type="button" className="cr-btn primary big" data-testid="cr-launch" disabled={busy || !!reason} aria-describedby="cr-launch-why" onClick={() => void launch()}>{busy ? 'Creating the room…' : 'Create the room'}</button><Link className="cr-btn" href="/quiz/cr/practice">Try it yourself first</Link></div>
      {reason && <p id="cr-launch-why" className="cr-note" role="status">Why the button is off: {reason}</p>}
    </main>
  );
}
