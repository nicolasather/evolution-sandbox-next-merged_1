'use client';
/** Five steps, in the order the decisions depend on each other: quiz → format and teams → length and difficulty (with the real preflight) → map and accessibility → summary and create.
 *  Nothing is created until the last button, and that button says what it does. */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import { checkTeamNames } from '@/lib/quiz/projector/team-names';
import { MAP_IDS, MAX_PARTICIPANTS, type MapId } from '@/lib/swarm/domain';
import { BOSS_DEFS } from '@/lib/swarm/balance';

const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
const MAP_LABEL: Record<MapId, { title: string; note: string }> = { meadow_circuit: { title: 'Meadow Circuit', note: 'Open grass with a looping path. The friendliest map.' }, paper_quarry: { title: 'Paper Quarry', note: 'Cream cliffs and tight corners that funnel enemies.' }, frost_conservatory: { title: 'Frost Conservatory', note: 'Glass panes and pale ice. Cool colours, more wisps.' } };
const KIND: Record<string, string> = { multiple_choice: 'multiple choice', truth_hunt: 'true / false', answer_forge: 'typed answer', connection_rush: 'matching', fill_table: 'table' };
type Pre = { ok: boolean; questions: number; byKind: Record<string, number>; workerConfigured: boolean; plan: { waves: number; questionsTotal: number; drafts: number; bosses: string[]; estimateSeconds: number; warnings: string[]; reviewCycle: boolean } };
const STEPS = ['Quiz', 'Format and teams', 'Length and difficulty', 'Map and access', 'Create'];

export default function SwarmSetup({ quizId, quizTitle, questionCount, signedIn }: { quizId: string; quizTitle: string; questionCount: number; signedIn: boolean }) {
  const router = useRouter(); const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'coop' | 'versus'>('coop'); const [teamCount, setTeamCount] = useState(2); const [size, setSize] = useState(4); const [names, setNames] = useState(DEFAULT_NAMES);
  const [minutes, setMinutes] = useState(15); const [focus, setFocus] = useState<'study' | 'balanced' | 'game'>('balanced'); const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'challenge'>('normal');
  const [mapId, setMapId] = useState<MapId>('meadow_circuit'); const [lowPressure, setLow] = useState(false); const [hideTeamNames, setHide] = useState(false); const [review, setReview] = useState(false); const [captainOnly, setCaptain] = useState(false); const [respec, setRespec] = useState(false); const [qSeconds, setQSeconds] = useState<number | ''>('');
  const [pre, setPre] = useState<{ key: string; data: Pre | null; err: string }>({ key: '', data: null, err: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const teams = mode === 'coop' ? 1 : teamCount; const cap = Math.min(5, Math.floor(MAX_PARTICIPANTS / teams)); const sizeOk = Math.min(size, cap); const teamNames = names.slice(0, teams);
  const nameCheck = useMemo(() => (mode === 'versus' ? checkTeamNames(teamNames) : { ok: true, names: teamNames, errors: [] as (string | null)[] }), [mode, teamNames]);
  const key = JSON.stringify({ quizId, minutes, focus, difficulty, review });
  useEffect(() => {
    if (!signedIn) return; let live = true;
    const t = setTimeout(() => { api<Pre>('/api/quiz/swarm/preflight', { method: 'POST', json: { quizId, minutes, focus, difficulty, allowReviewCycle: review } }).then((d) => { if (live) setPre({ key, data: d, err: '' }); }).catch((e) => { if (live) setPre({ key, data: null, err: (e as Error).message }); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [key, quizId, minutes, focus, difficulty, review, signedIn]);
  const plan = pre.key === key ? pre.data : null; const checking = pre.key !== key;
  const stepOk = [true, nameCheck.ok, !!plan?.ok && !checking, true, true][step] ?? true;
  const launch = async () => {
    setBusy(true); setErr('');
    try {
      const config = { mode, teamCount: teams, teamSizeCap: sizeOk, minutes, mapId, difficulty, focus, lowPressure, hideTeamNames, allowReviewCycle: review, captainOnlyDraft: captainOnly, allowRespec: respec, questionSeconds: qSeconds === '' ? null : qSeconds, ...(mode === 'versus' ? { teamNames: nameCheck.names } : {}) };
      const out = await api<{ roomId: string; hostUrl: string }>('/api/quiz/swarm/create', { method: 'POST', json: { quizId, config } });
      router.push(out.hostUrl);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not create the room. Try again.'); setBusy(false); }
  };
  if (!signedIn) return <main className="sw narrow" id="main"><section className="sw-card"><h1>Sign in to host</h1><p>Hosting needs a teacher account so only you can run the match. Students join without any account.</p><Link className="sw-btn primary" href={`/quiz/login?next=${encodeURIComponent(`/quiz/setup/${quizId}/swarm`)}`}>Sign in</Link></section></main>;
  return (
    <main className="sw narrow" id="main">
      <h1>Host Swarm Survival</h1>
      <ol className="sw-steps" aria-label="Setup steps">{STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined}>{i + 1}. {s}</li>)}</ol>
      <section className="sw-card" aria-live="polite">
        {step === 0 && <>
          <h2>Your quiz</h2><p><b>{quizTitle}</b> — {questionCount} question{questionCount === 1 ? '' : 's'}.</p>
          <p>Every student answers the same question at the same time. The game never invents questions: a short quiz makes a shorter match, and a quiz with fewer than 3 questions cannot be used.</p>
          <p className="sw-note">Not the right quiz? <Link href="/quiz/library?mode=online&game=swarm_survival">Choose another</Link>.</p>
        </>}
        {step === 1 && <>
          <h2>Format and teams</h2>
          <div className="sw-choice" role="radiogroup" aria-label="Format">
            <button type="button" role="radio" aria-checked={mode === 'coop'} onClick={() => setMode('coop')}><b>Co-op</b><small>The whole class is one team defending one beacon.</small></button>
            <button type="button" role="radio" aria-checked={mode === 'versus'} onClick={() => setMode('versus')}><b>Versus</b><small>2–4 teams on identical arenas and identical waves. Ranked, never head-to-head fighting.</small></button>
          </div>
          {mode === 'versus' && <label className="sw-field">Number of teams<select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n} teams</option>)}</select></label>}
          <label className="sw-field">Maximum players per team<select value={sizeOk} onChange={(e) => setSize(Number(e.target.value))}>{Array.from({ length: cap }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <p className="sw-note">{teams} team{teams > 1 ? 's' : ''} × up to {sizeOk} = up to {teams * sizeOk} students (the limit is {MAX_PARTICIPANTS}). A team of one is allowed. Smaller teams get a gentler beacon, enemy count and boss, so size never decides the ranking.</p>
          {mode === 'versus' && teamNames.map((n, i) => <label className="sw-field" key={i}>Team {i + 1} name<input value={n} maxLength={24} onChange={(e) => setNames((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} aria-invalid={!!nameCheck.errors[i]} />{nameCheck.errors[i] && <span className="sw-warn" role="alert">{nameCheck.errors[i]}</span>}</label>)}
        </>}
        {step === 2 && <>
          <h2>Length and difficulty</h2>
          <label className="sw-field">Match length<select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[5, 10, 15, 20, 30, 45].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label>
          <label className="sw-field">Learning focus<select value={focus} onChange={(e) => setFocus(e.target.value as typeof focus)}><option value="study">Study — more questions, gentler fights</option><option value="balanced">Balanced</option><option value="game">Game — more action, fewer questions</option></select></label>
          <label className="sw-field">Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="challenge">Challenge</option></select></label>
          <label className="sw-check"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /> Allow a review cycle (repeat missed topics) if the quiz is short</label>
          <div aria-live="polite" data-testid="preflight">
            {checking && <p className="sw-note">Checking your quiz…</p>}
            {pre.err && !checking && <p className="sw-err" role="alert">{pre.err}</p>}
            {plan && !checking && <>
              <div className="sw-facts"><div><b>{plan.plan.waves}</b>waves</div><div><b>{plan.plan.questionsTotal}</b>questions in the match</div><div><b>{plan.plan.drafts}</b>upgrade votes</div><div><b>≈{Math.round(plan.plan.estimateSeconds / 60)} min</b>estimated</div></div>
              <p className="sw-note">Your quiz has {plan.questions} questions: {Object.entries(plan.byKind).map(([k, n]) => `${n} ${KIND[k] ?? k}`).join(', ')}.</p>
              {plan.plan.bosses.length > 0 && <p className="sw-note">Bosses: {plan.plan.bosses.map((b) => BOSS_DEFS[b as keyof typeof BOSS_DEFS]?.label ?? b).join(', ')}.</p>}
              {plan.plan.warnings.map((w) => <p key={w} className="sw-warn" role="status">{w}</p>)}
              {!plan.ok && <p className="sw-err" role="alert">This quiz needs at least 3 questions for Swarm Survival.</p>}
              {!plan.workerConfigured && <p className="sw-warn" role="status">The game server is not configured on this site yet, so a room cannot be created. See swarm-server/README.md.</p>}
            </>}
          </div>
        </>}
        {step === 3 && <>
          <h2>Map and accessibility</h2>
          <div className="sw-choice" role="radiogroup" aria-label="Map">{MAP_IDS.map((m) => <button type="button" role="radio" aria-checked={mapId === m} key={m} onClick={() => setMapId(m)}><b>{MAP_LABEL[m].title}</b><small>{MAP_LABEL[m].note}</small></button>)}</div>
          <label className="sw-check"><input type="checkbox" checked={lowPressure} onChange={(e) => setLow(e.target.checked)} /> Low pressure: longer warnings, gentler hits, one emergency revive for solo players</label>
          <label className="sw-check"><input type="checkbox" checked={hideTeamNames} onChange={(e) => setHide(e.target.checked)} /> Hide team names on the projector screen</label>
          <label className="sw-check"><input type="checkbox" checked={captainOnly} onChange={(e) => setCaptain(e.target.checked)} /> Only the captain votes on upgrades</label>
          <label className="sw-check"><input type="checkbox" checked={respec} onChange={(e) => setRespec(e.target.checked)} /> Let students change role between waves</label>
          <label className="sw-field">Seconds per question (optional)<input type="number" min={15} max={180} placeholder="Automatic, by question type" value={qSeconds} onChange={(e) => setQSeconds(e.target.value === '' ? '' : Math.max(15, Math.min(180, Number(e.target.value))))} /></label>
          <p className="sw-note">Students can also turn on reduced motion, high contrast and larger text on their own device. Read-aloud is built into every question.</p>
        </>}
        {step === 4 && <>
          <h2>Ready to create</h2>
          <ul className="sw-list">
            <li><b>{quizTitle}</b>, {mode === 'coop' ? 'co-op' : `versus with ${teams} teams (${nameCheck.names.join(', ')})`}.</li>
            <li>Up to {sizeOk} players per team, {teams * sizeOk} in total.</li>
            <li>{minutes} minutes, {difficulty}, {focus} focus, {MAP_LABEL[mapId].title}.</li>
            {plan && <li>{plan.plan.waves} waves, {plan.plan.questionsTotal} questions, {plan.plan.drafts} upgrade votes.</li>}
            <li>{lowPressure ? 'Low pressure on.' : 'Standard pressure.'} {captainOnly ? 'Captain votes on upgrades.' : 'Everyone votes on upgrades.'}</li>
          </ul>
          <p className="sw-note">Creating the room gives you a 6-letter code and opens your teacher console. Students open the join page on their own devices and enter the code. Nothing starts until you press Start.</p>
          {err && <p className="sw-err" role="alert" data-testid="create-error">{err}</p>}
          <button type="button" className="sw-btn primary big" onClick={launch} disabled={busy || !plan?.ok} data-testid="create">{busy ? 'Creating…' : 'Create the room'}</button>
        </>}
        <div className="sw-row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="sw-btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>Back</button>
          {step < 4 && <button type="button" className="sw-btn primary" onClick={() => setStep((s) => s + 1)} disabled={!stepOk} data-testid="next">{stepOk ? 'Next' : step === 2 ? 'Checking quiz…' : 'Fix names to continue'}</button>}
        </div>
      </section>
    </main>
  );
}
