'use client';
/** Teacher setup for an online Obstacle Survival match: format → squads → length (the quiz check runs here with the real question formats) → map → options → create.
 *  Nothing is created until the last button, and the button says what it does. */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import { checkTeamNames } from '@/lib/quiz/projector/team-names';
import { BASE_COURSES, MAP_INFO } from '@/lib/quiz/os/course';
import type { MapId } from '@/lib/quiz/os/domain';
import { TEAM_COLORS, TEAM_MARK } from './art';

const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
type Pre = { plan: { chapters: number; chapterSeconds: number; estimatedMinutes: number; questionsNeeded: number; questionsAvailable: number; reviewCycle: boolean; notes: string[]; minutes: number }; questions: number; byKind: Record<string, number>; ok: boolean };
const KIND: Record<string, string> = { multiple_choice: 'multiple choice', truth_hunt: 'true / false', answer_forge: 'typed answer', connection_rush: 'matching', fill_table: 'table' };

export default function OSSetup({ quizId, quizTitle, questionCount, signedIn }: { quizId: string; quizTitle: string; questionCount: number; signedIn: boolean }) {
  const router = useRouter();
  const [format, setFormat] = useState<'cooperative_escape' | 'relay_race'>('cooperative_escape'); const [teamCount, setTeamCount] = useState(2); const [size, setSize] = useState(4); const [names, setNames] = useState(DEFAULT_NAMES);
  const [minutes, setMinutes] = useState(15); const [mapId, setMapId] = useState<MapId>('chalkyard_circuit'); const [lowPressure, setLow] = useState(false); const [readAloud, setRead] = useState(false); const [hideNames, setHide] = useState(false);
  const [requireApproval, setReq] = useState(false); const [approvalAbove, setApproval] = useState(0); const [allowReview, setReview] = useState(false);
  const [pre, setPre] = useState<{ key: string; data: Pre | null; err: string }>({ key: '', data: null, err: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const squads = format === 'cooperative_escape' ? 1 : teamCount; const cap = Math.min(5, Math.floor(20 / squads)); const sizeOk = Math.min(size, cap);
  const teamNames = names.slice(0, squads); const nameCheck = useMemo(() => (format === 'relay_race' ? checkTeamNames(teamNames) : { ok: true, names: teamNames, errors: [] as (string | null)[] }), [format, teamNames]);
  const key = JSON.stringify({ quizId, minutes, readAloud, lowPressure, allowReview, mapId });
  useEffect(() => {
    if (!signedIn) return; let live = true;
    const t = setTimeout(() => { api<Pre>('/api/quiz/os/preflight', { method: 'POST', json: { quizId, minutes, readAloud, lowPressure, allowReviewCycle: allowReview, mapId } }).then((d) => { if (live) setPre({ key, data: d, err: '' }); }).catch((e) => { if (live) setPre({ key, data: null, err: (e as Error).message }); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [key, quizId, minutes, readAloud, lowPressure, allowReview, mapId, signedIn]);
  const plan = pre.key === key ? pre.data?.plan ?? null : null; const checking = pre.key !== key; const short = !!plan && plan.questionsNeeded > plan.questionsAvailable && !plan.reviewCycle && !allowReview && plan.chapters < 3;
  const launch = async () => {
    setBusy(true); setErr('');
    try {
      const out = await api<{ roomId: string; hostUrl: string }>('/api/quiz/os/create', { method: 'POST', json: { quizId, format, mapId, minutes, teamCount: squads, teamSizeCap: sizeOk, ...(format === 'relay_race' ? { teamNames: nameCheck.names } : {}), lowPressure, readAloud, hideNames, approvalAbove, requireApproval, allowReviewCycle: allowReview } });
      router.push(out.hostUrl);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not create the match. Try again.'); setBusy(false); }
  };
  if (!signedIn) return (
    <main className="os narrow"><section className="os-card"><h1>Sign in to host Obstacle Survival</h1><p className="os-note">Hosting saves the match and its results to your account. Students join without one.</p>
      <div className="os-row"><Link className="os-btn primary" href={`/quiz/login?next=/quiz/setup/${quizId}/os`}>Sign in</Link><Link className="os-btn" href="/quiz/os/practice">Try the practice first</Link></div></section></main>
  );
  return (
    <main className="os os-setup">
      <header><p className="os-note">Obstacle Survival · online, one device per student</p><h1>{quizTitle}</h1><p className="os-note">{questionCount} questions in this quiz.</p></header>
      <ol className="os-steps">
        <li><h2>Format</h2>
          <div className="os-choice" role="radiogroup" aria-label="Format">
            <button type="button" role="radio" aria-checked={format === 'cooperative_escape'} onClick={() => setFormat('cooperative_escape')}><b>Cooperative escape</b><span>One squad of up to 5 crosses the whole course together. Correct answers open the gates.</span></button>
            <button type="button" role="radio" aria-checked={format === 'relay_race'} onClick={() => setFormat('relay_race')}><b>Relay race</b><span>2–4 squads run identical courses. Scored 45% progress, 40% mastery, 15% teamwork. Up to 20 students.</span></button>
          </div>
        </li>
        <li><h2>Squads</h2>
          <div className="os-row wrap">
            {format === 'relay_race' && <label className="os-field">Squads<select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>}
            <label className="os-field">Students per squad<select value={sizeOk} onChange={(e) => setSize(Number(e.target.value))}>{[1, 2, 3, 4, 5].filter((n) => n <= cap).map((n) => <option key={n}>{n}</option>)}</select></label>
            <p className="os-note">Room for {squads * sizeOk} student{squads * sizeOk > 1 ? 's' : ''} (never more than 20).</p>
          </div>
          {format === 'relay_race' && <div className="os-names">{teamNames.map((n, i) => (
            <label key={i} className="os-field"><span><i className="os-swatch" style={{ background: TEAM_COLORS[i] }} aria-hidden="true" />{TEAM_MARK[i]} Squad {i + 1} name</span>
              <input value={n} maxLength={24} onChange={(e) => setNames((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} aria-invalid={!!nameCheck.errors[i]} aria-describedby={nameCheck.errors[i] ? `os-name-err-${i}` : undefined} />
              {nameCheck.errors[i] && <span id={`os-name-err-${i}`} className="os-why">{nameCheck.errors[i]!.replace('Team', 'Squad')}</span>}</label>))}</div>}
        </li>
        <li><h2>Length</h2>
          <label className="os-field">Target length<input type="range" min={10} max={45} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /><output>{minutes} min</output></label>
          <div className="os-plan" aria-live="polite">
            {checking && <p className="os-note">Checking the quiz…</p>}{pre.err && !checking && <p className="os-why">{pre.err}</p>}
            {plan && !checking && <>
              <p><b>{plan.chapters} chapters</b> · about {plan.estimatedMinutes} minutes · {plan.chapterSeconds} s of running between questions</p>
              <p className="os-note">Needs {plan.questionsNeeded} questions; the quiz has {plan.questionsAvailable}{pre.data ? ` (${Object.entries(pre.data.byKind).map(([k, n]) => `${n} ${KIND[k] ?? k}`).join(', ')})` : ''}. The match never invents questions.</p>
              {plan.notes.map((n) => <p key={n} className="os-note">{n}</p>)}
              {plan.questionsNeeded > plan.questionsAvailable && <label className="os-check"><input type="checkbox" checked={allowReview} onChange={(e) => setReview(e.target.checked)} />Repeat questions once as a labelled review round to fill the match</label>}
              {pre.data && !pre.data.ok && <p className="os-why">Obstacle Survival needs a quiz with at least 3 questions.</p>}
            </>}
          </div>
        </li>
        <li><h2>Map</h2>
          <div className="os-maps" role="radiogroup" aria-label="Map">{MAP_INFO.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mapId === m.id} onClick={() => setMapId(m.id)}><b>{m.name}</b><span>{BASE_COURSES[m.id].hazards.length} hazards · {BASE_COURSES[m.id].checkpoints.length} checkpoints</span></button>))}
          </div>
        </li>
        <li><h2>Options</h2>
          <div className="os-opts">
            <label className="os-check"><input type="checkbox" checked={lowPressure} onChange={(e) => setLow(e.target.checked)} />Gentle timing: longer warnings and rests, longer question time</label>
            <label className="os-check"><input type="checkbox" checked={readAloud} onChange={(e) => setRead(e.target.checked)} />Read-aloud time: adds reading time to every question</label>
            <label className="os-check"><input type="checkbox" checked={hideNames} onChange={(e) => setHide(e.target.checked)} />Hide student names on the projector</label>
            <label className="os-check"><input type="checkbox" checked={requireApproval} onChange={(e) => setReq(e.target.checked)} />Approve each student before they join</label>
            <label className="os-field">Ask me before purchases of<select value={approvalAbove} onChange={(e) => setApproval(Number(e.target.value))}><option value={0}>Never ask</option><option value={100}>100 points or more</option><option value={150}>150 points or more</option></select></label>
          </div>
        </li>
      </ol>
      {err && <p className="os-why" role="alert">{err}</p>}
      <div className="os-row"><button type="button" className="os-btn primary big" data-testid="os-launch" disabled={busy || checking || !plan || short || !nameCheck.ok || !(pre.data?.ok)} onClick={() => void launch()}>{busy ? 'Creating the room…' : 'Create the room'}</button><Link className="os-btn" href="/quiz/os/practice">Try it yourself first</Link></div>
    </main>
  );
}
