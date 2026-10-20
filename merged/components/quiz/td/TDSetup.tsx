'use client';
/** Teacher setup for an online Tower Defense match, in the order the decisions depend on each other:
 *  format → squads → length and pacing (the quiz check runs here, with the real question formats) → options → create.
 *  Nothing is created until the last button, and the button says what it does. */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import { MAPS } from '@/lib/quiz/td/maps';
import { BOSSES } from '@/lib/quiz/td/balance';
import { TD_MAPS, type TDMapId, type TDPlan } from '@/lib/quiz/td/domain';
import { checkTeamNames } from '@/lib/quiz/projector/team-names';
import { TEAM_SWATCH } from './parts';

const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
type Pre = { plan: TDPlan; questions: number; byKind: Record<string, number>; ok: boolean };
const KIND: Record<string, string> = { multiple_choice: 'multiple choice', truth_hunt: 'true / false', answer_forge: 'typed answer', connection_rush: 'matching', fill_table: 'table' };

export default function TDSetup({ quizId, quizTitle, questionCount, signedIn }: { quizId: string; quizTitle: string; questionCount: number; signedIn: boolean }) {
  const router = useRouter();
  const [format, setFormat] = useState<'coop' | 'versus'>('coop');
  const [teamCount, setTeamCount] = useState(2); const [size, setSize] = useState(4);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [minutes, setMinutes] = useState(20); const [flow, setFlow] = useState<'synchronized' | 'independent'>('synchronized');
  const [focus, setFocus] = useState<'study' | 'balanced' | 'game'>('balanced'); const [mapId, setMapId] = useState<TDMapId>('meadow_circuit');
  const [lowPressure, setLow] = useState(false); const [readAloud, setRead] = useState(false); const [hideNames, setHide] = useState(false);
  const [approvalAbove, setApproval] = useState(0); const [requireApproval, setReqApproval] = useState(false); const [wager, setWager] = useState(false);
  const [allowReview, setAllowReview] = useState(false);
  const [pre, setPre] = useState<{ key: string; data: Pre | null; err: string }>({ key: '', data: null, err: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  const squads = format === 'coop' ? 1 : teamCount;
  const cap = Math.min(5, Math.floor(20 / squads));
  const sizeOk = Math.min(size, cap);
  const teamNames = names.slice(0, squads);
  const nameCheck = useMemo(() => (format === 'versus' ? checkTeamNames(teamNames) : { ok: true, names: teamNames, errors: [] as (string | null)[] }), [format, teamNames]);
  const key = JSON.stringify({ quizId, minutes, flow, focus, readAloud, allowReview });

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const t = setTimeout(() => {
      api<Pre>('/api/quiz/td/preflight', { method: 'POST', json: { quizId, minutes, flow, focus, readAloud, allowReviewCycle: allowReview } })
        .then((d) => { if (live) setPre({ key, data: d, err: '' }); })
        .catch((e) => { if (live) setPre({ key, data: null, err: (e as Error).message }); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [key, quizId, minutes, flow, focus, readAloud, allowReview, signedIn]);
  const plan = pre.key === key ? pre.data?.plan ?? null : null;
  const checking = pre.key !== key;
  const short = plan ? plan.questionsNeeded > plan.questionsAvailable && !plan.reviewCycle : false;

  const launch = async () => {
    setBusy(true); setErr('');
    try {
      const out = await api<{ roomId: string; hostUrl: string }>('/api/quiz/td/create', { method: 'POST', json: {
        quizId, format, teamCount: squads, teamSizeCap: sizeOk, ...(format === 'versus' ? { teamNames: nameCheck.names } : {}), minutes, flow, mapId, focus, lowPressure, readAloud,
        approvalAbove, hideNames, requireApproval, modifiers: format === 'versus' && wager ? ['secret_wager'] : [], allowReviewCycle: allowReview,
      } });
      router.push(out.hostUrl);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not create the match. Try again.'); setBusy(false); }
  };

  if (!signedIn) return (
    <main className="td narrow"><section className="td-panel"><h1>Sign in to host Tower Defense</h1><p className="td-note">Hosting saves the match and its results to your account. Students join without one.</p>
      <div className="td-row"><Link className="td-btn primary" href={`/quiz/login?next=/quiz/setup/${quizId}/td`}>Sign in</Link><Link className="td-btn" href="/quiz/td/practice">Try the practice first</Link></div></section></main>
  );
  return (
    <main className="td td-setup">
      <header className="td-setuphead"><p className="td-note">Tower Defense · online, one device per student</p><h1>{quizTitle}</h1><p className="td-note">{questionCount} questions in this quiz.</p></header>
      <ol className="td-steps">
        <li>
          <h2>Format</h2>
          <div className="td-choice" role="radiogroup" aria-label="Format">
            <button type="button" role="radio" aria-checked={format === 'coop'} onClick={() => setFormat('coop')}><b>Co-op</b><span>The whole class defends one core. Up to 5 students build together.</span></button>
            <button type="button" role="radio" aria-checked={format === 'versus'} onClick={() => setFormat('versus')}><b>Competitive squads</b><span>2–4 squads defend identical maps with identical waves. Up to 20 students.</span></button>
          </div>
        </li>
        <li>
          <h2>Squads</h2>
          <div className="td-row wrap">
            {format === 'versus' && <label className="td-field">Squads<select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>}
            <label className="td-field">Students per squad<select value={sizeOk} onChange={(e) => setSize(Number(e.target.value))}>{[1, 2, 3, 4, 5].filter((n) => n <= cap).map((n) => <option key={n}>{n}</option>)}</select></label>
            <p className="td-note">Room for {squads * sizeOk} student{squads * sizeOk > 1 ? 's' : ''}. Late joiners wait until the teacher moves them in.</p>
          </div>
          {format === 'versus' && (
            <div className="td-names">{teamNames.map((n, i) => (
              <label key={i} className="td-field"><span><i className="td-swatch" style={{ background: TEAM_SWATCH[i] }} aria-hidden="true" />Squad {i + 1} name</span>
                <input value={n} maxLength={24} onChange={(e) => setNames((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} aria-invalid={!!nameCheck.errors[i]} aria-describedby={nameCheck.errors[i] ? `td-name-err-${i}` : undefined} />
                {nameCheck.errors[i] && <span id={`td-name-err-${i}`} className="td-why">{nameCheck.errors[i]!.replace('Team', 'Squad')}</span>}</label>))}</div>
          )}
        </li>
        <li>
          <h2>Length and pacing</h2>
          <div className="td-row wrap">
            <label className="td-field">Minutes<input type="range" min={10} max={45} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /><output>{minutes} min</output></label>
            <label className="td-field">Questions<select value={flow} onChange={(e) => setFlow(e.target.value as typeof flow)}><option value="synchronized">Together: one question for everyone before each build</option><option value="independent">At their own pace: students open questions while towers defend</option></select></label>
            <label className="td-field">Balance<select value={focus} onChange={(e) => setFocus(e.target.value as typeof focus)}><option value="study">More questions, shorter waves</option><option value="balanced">Balanced</option><option value="game">Fewer questions, longer waves</option></select></label>
          </div>
          <div className="td-plan" aria-live="polite">
            {checking && <p className="td-note">Checking the quiz…</p>}
            {pre.err && !checking && <p className="td-why">{pre.err}</p>}
            {plan && !checking && <>
              <p><b>{plan.waves} waves</b> in about {plan.minutes} minutes · {plan.questionSeconds} s per question · {plan.buildSeconds} s to build · bosses on wave {plan.bossWaves.join(' and ') || '—'}</p>
              <p className="td-note">Needs {plan.questionsNeeded} questions; the quiz has {plan.questionsAvailable}{pre.data ? ` (${Object.entries(pre.data.byKind).map(([k, n]) => `${n} ${KIND[k] ?? k}`).join(', ')})` : ''}.</p>
              {plan.notes.map((n) => <p key={n} className="td-note">{n}</p>)}
              {(plan.questionsNeeded > plan.questionsAvailable) && (
                <label className="td-check"><input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} />Repeat questions once as a labelled review round to fill the match</label>
              )}
              {short && <p className="td-why">Shorten the match, or allow one review round.</p>}
              {pre.data && !pre.data.ok && <p className="td-why">Tower Defense needs a quiz with at least 3 questions.</p>}
            </>}
          </div>
        </li>
        <li>
          <h2>Map</h2>
          <div className="td-maps" role="radiogroup" aria-label="Map">
            {TD_MAPS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mapId === m} onClick={() => setMapId(m)} style={{ ['--map' as string]: MAPS[m].palette.ground, ['--lane' as string]: MAPS[m].palette.lane }}>
                <span className="swatch" aria-hidden="true" /><b>{MAPS[m].title}</b><span>{MAPS[m].materials.replace(/ · /g, ', ')}. Boss: {BOSSES[MAPS[m].boss].name}.</span></button>))}
          </div>
        </li>
        <li>
          <h2>Options</h2>
          <div className="td-opts">
            <label className="td-check"><input type="checkbox" checked={lowPressure} onChange={(e) => setLow(e.target.checked)} />Low pressure: longer timers, a core that cannot fall to zero</label>
            <label className="td-check"><input type="checkbox" checked={readAloud} onChange={(e) => setRead(e.target.checked)} />Read-aloud time: adds reading time to every question</label>
            <label className="td-check"><input type="checkbox" checked={hideNames} onChange={(e) => setHide(e.target.checked)} />Hide student names on the projector</label>
            <label className="td-check"><input type="checkbox" checked={requireApproval} onChange={(e) => setReqApproval(e.target.checked)} />Approve each student before they join</label>
            <label className="td-field">Ask me before purchases above<select value={approvalAbove} onChange={(e) => setApproval(Number(e.target.value))}><option value={0}>Never ask</option><option value={150}>150 points</option><option value={250}>250 points</option></select></label>
            {format === 'versus' && <label className="td-check"><input type="checkbox" checked={wager} onChange={(e) => setWager(e.target.checked)} />Secret Wager: squads may stake points on the next question</label>}
          </div>
        </li>
      </ol>
      {err && <p className="td-why" role="alert">{err}</p>}
      <div className="td-row td-launch">
        <button type="button" className="td-btn primary big" data-testid="td-launch" disabled={busy || checking || !plan || short || !nameCheck.ok || !(pre.data?.ok)} onClick={() => void launch()}>{busy ? 'Creating the room…' : 'Create the room'}</button>
        <Link className="td-btn" href="/quiz/td/practice">Try it yourself first</Link>
      </div>
    </main>
  );
}
