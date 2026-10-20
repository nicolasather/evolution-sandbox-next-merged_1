'use client';
/** Teacher setup for an online Arena Clash match: format → teams → length (the quiz check runs here with the real question formats) → map → scoring → helpers → options → create.
 *  Nothing is created until the last button, and the button says what it does. */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import { checkTeamNames } from '@/lib/quiz/projector/team-names';
import { FORMAT_COPY, HELPER_COPY, DURATION_MINUTES, WEIGHTS } from '@/lib/quiz/arena/balance';
import { FORMATS, HELPERS, MAP_IDS, type Format, type Helper, type MapId, type Weighting } from '@/lib/quiz/arena/domain';
import { MAP_INFO } from '@/lib/quiz/arena/maps';
import { FormatIcon, HelperIcon, TeamBadge } from './icons';
import { TEAM_COLORS } from './art';

const DEFAULT_NAMES = ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'];
type Pre = { plan: { cycles: number; episodeSeconds: number; estimatedMinutes: number; questionsAvailable: number; reviewCycle: boolean; notes: string[]; minutes: number; quizShare: number }; questions: number; byKind: Record<string, number>; ok: boolean };
const KIND: Record<string, string> = { multiple_choice: 'multiple choice', truth_hunt: 'true / false', answer_forge: 'typed answer', connection_rush: 'matching', fill_table: 'table' };
const WEIGHT_COPY: Record<Weighting, { name: string; blurb: string }> = { study: { name: 'Study focus', blurb: 'Quiz counts 75%, arena 25%.' }, balanced: { name: 'Balanced', blurb: 'Quiz counts 60%, arena 40%.' }, game: { name: 'Game focus', blurb: 'Quiz counts 50%, arena 50%. The quiz never counts less.' } };

export default function ArenaSetup({ quizId, quizTitle, questionCount, signedIn }: { quizId: string; quizTitle: string; questionCount: number; signedIn: boolean }) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>('control'); const [teamCount, setTeamCount] = useState(2); const [size, setSize] = useState(4); const [names, setNames] = useState(DEFAULT_NAMES);
  const [minutes, setMinutes] = useState<number>(15); const [mapId, setMapId] = useState<MapId>('meadow_mosaic'); const [weighting, setWeighting] = useState<Weighting>('balanced'); const [helpers, setHelpers] = useState<Helper[]>([...HELPERS]);
  const [lowPressure, setLow] = useState(false); const [readAloud, setRead] = useState(false); const [hideNames, setHide] = useState(false); const [requireApproval, setReq] = useState(false); const [allowReview, setReview] = useState(false);
  const [pre, setPre] = useState<{ key: string; data: Pre | null; err: string }>({ key: '', data: null, err: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const cap = Math.min(5, Math.floor(20 / teamCount)); const sizeOk = Math.min(size, cap); const teamNames = names.slice(0, teamCount);
  const nameCheck = useMemo(() => checkTeamNames(teamNames), [teamNames]);
  const key = JSON.stringify({ quizId, minutes, readAloud, lowPressure, allowReview, format, mapId });
  useEffect(() => {
    if (!signedIn) return undefined; let live = true;
    const t = setTimeout(() => { api<Pre>('/api/quiz/arena/preflight', { method: 'POST', json: { quizId, minutes, readAloud, lowPressure, allowReviewCycle: allowReview, format, mapId } }).then((d) => { if (live) setPre({ key, data: d, err: '' }); }).catch((e) => { if (live) setPre({ key, data: null, err: (e as Error).message }); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [key, quizId, minutes, readAloud, lowPressure, allowReview, format, mapId, signedIn]);
  const plan = pre.key === key ? pre.data?.plan ?? null : null; const checking = pre.key !== key; const short = !!plan && plan.cycles < 3;
  const launch = async () => {
    setBusy(true); setErr('');
    try {
      const out = await api<{ roomId: string; hostUrl: string }>('/api/quiz/arena/create', { method: 'POST', json: { quizId, format, mapId, minutes, teamCount, teamSizeCap: sizeOk, teamNames: nameCheck.names, weighting, lowPressure, readAloud, hideNames, requireApproval, allowReviewCycle: allowReview, helpers } });
      router.push(out.hostUrl);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not create the match. Try again.'); setBusy(false); }
  };
  if (!signedIn) return (
    <main className="ar narrow"><section className="ar-card"><h1>Sign in to host Arena Clash</h1><p className="ar-note">Hosting saves the match and its results to your account. Students join without one.</p>
      <div className="ar-row"><Link className="ar-btn primary" href={`/quiz/login?next=/quiz/setup/${quizId}/arena`}>Sign in</Link><Link className="ar-btn" href="/quiz/arena/practice">Try the practice first</Link></div></section></main>
  );
  return (
    <main className="ar ar-setup">
      <header><p className="ar-note">Arena Clash · online, one device per student</p><h1>{quizTitle}</h1><p className="ar-note">{questionCount} questions in this quiz.</p></header>
      <ol className="ar-steps">
        <li><h2>Format</h2>
          <div className="ar-choice" role="radiogroup" aria-label="Format">{FORMATS.map((f) => <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)}><FormatIcon format={f} size={30} /><b>{FORMAT_COPY[f].name}</b><span>{FORMAT_COPY[f].blurb}</span></button>)}</div>
        </li>
        <li><h2>Teams</h2>
          <div className="ar-row wrap">
            <label className="ar-field">Teams<select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="ar-field">Students per team<select value={sizeOk} onChange={(e) => setSize(Number(e.target.value))}>{[1, 2, 3, 4, 5].filter((n) => n <= cap).map((n) => <option key={n}>{n}</option>)}</select></label>
            <p className="ar-note">Room for {teamCount * sizeOk} students (never more than 20). A team of one plays the Runner; teams of 2 or more unlock all five roles. Every team gets an identical start.</p>
          </div>
          <div className="ar-names">{teamNames.map((n, i) => (
            <label key={i} className="ar-field"><span><TeamBadge index={i} size={18} /> Team {i + 1} name</span>
              <input value={n} maxLength={24} style={{ borderColor: TEAM_COLORS[i] }} onChange={(e) => setNames((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} aria-invalid={!!nameCheck.errors[i]} aria-describedby={nameCheck.errors[i] ? `ar-name-err-${i}` : undefined} />
              {nameCheck.errors[i] && <span id={`ar-name-err-${i}`} className="ar-why">{nameCheck.errors[i]}</span>}</label>))}</div>
        </li>
        <li><h2>Length</h2>
          <label className="ar-field">Target length<select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{DURATION_MINUTES.map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></label>
          <div className="ar-plan" aria-live="polite">
            {checking && <p className="ar-note">Checking the quiz…</p>}{pre.err && !checking && <p className="ar-why">{pre.err}</p>}
            {plan && !checking && <>
              <p><b>{plan.cycles} rounds</b> · about {plan.estimatedMinutes} minutes · {plan.episodeSeconds} s of live play per round · quiz and review take about {Math.round(plan.quizShare * 100)}% of the time</p>
              <p className="ar-note">Each round uses one distinct question; the quiz has {plan.questionsAvailable}{pre.data ? ` (${Object.entries(pre.data.byKind).map(([k, n]) => `${n} ${KIND[k] ?? k}`).join(', ')})` : ''}. The match never invents questions.</p>
              {plan.notes.includes('shortQuiz') && !allowReview && <p className="ar-note">The quiz is shorter than the time you asked for, so the match will have fewer rounds.</p>}
              {pre.data && pre.data.questions < plan.cycles + 1 && <label className="ar-check"><input type="checkbox" checked={allowReview} onChange={(e) => setReview(e.target.checked)} />Repeat questions once as a labelled review round to fill the time</label>}
              {short && <p className="ar-why">With this quiz and length there would be fewer than 3 rounds. Choose a shorter length or a longer quiz.</p>}
            </>}
          </div>
        </li>
        <li><h2>Map</h2>
          <div className="ar-maps" role="radiogroup" aria-label="Map">{MAP_IDS.map((m) => <button key={m} type="button" role="radio" aria-checked={mapId === m} onClick={() => setMapId(m)}><i className="ar-swatch big" style={{ background: `linear-gradient(135deg, ${MAP_INFO[m].palette.ground} 55%, ${MAP_INFO[m].palette.ground2} 55%)`, borderColor: MAP_INFO[m].palette.accent }} aria-hidden="true" /><b>{MAP_INFO[m].title}</b><span>{MAP_INFO[m].blurb}</span></button>)}</div>
          <p className="ar-note">All maps are built from one sector turned around the middle, so every team has the same distances, shortcuts and start.</p>
        </li>
        <li><h2>Scoring</h2>
          <div className="ar-choice" role="radiogroup" aria-label="Scoring">{(Object.keys(WEIGHTS) as Weighting[]).map((w) => <button key={w} type="button" role="radio" aria-checked={weighting === w} onClick={() => setWeighting(w)}><b>{WEIGHT_COPY[w].name}</b><span>{WEIGHT_COPY[w].blurb}</span></button>)}</div>
        </li>
        <li><h2>Planning-board helpers</h2>
          <div className="ar-opts">{HELPERS.map((h) => <label key={h} className="ar-check"><input type="checkbox" checked={helpers.includes(h)} onChange={(e) => setHelpers((cur) => (e.target.checked ? [...cur, h] : cur.filter((x) => x !== h)))} /><HelperIcon helper={h} size={22} /><span><b>{HELPER_COPY[h].name}</b> — {HELPER_COPY[h].blurb}</span></label>)}</div>
          <p className="ar-note">Helpers are small boosts bought with quiz points (one per team per round). None of them can hurt or block a rival.</p>
        </li>
        <li><h2>Options</h2>
          <div className="ar-opts">
            <label className="ar-check"><input type="checkbox" checked={lowPressure} onChange={(e) => setLow(e.target.checked)} />Gentle timing: longer question time</label>
            <label className="ar-check"><input type="checkbox" checked={readAloud} onChange={(e) => setRead(e.target.checked)} />Read-aloud time: adds reading time to every question</label>
            <label className="ar-check"><input type="checkbox" checked={hideNames} onChange={(e) => setHide(e.target.checked)} />Hide student names from rivals and the projector (always on for the projector)</label>
            <label className="ar-check"><input type="checkbox" checked={requireApproval} onChange={(e) => setReq(e.target.checked)} />Approve each student before they join</label>
          </div>
        </li>
      </ol>
      {err && <p className="ar-why" role="alert">{err}</p>}
      <div className="ar-row"><button type="button" className="ar-btn primary big" data-testid="ar-launch" disabled={busy || checking || !plan || short || !nameCheck.ok || !(pre.data?.ok)} onClick={() => void launch()}>{busy ? 'Creating the room…' : 'Create the room'}</button><Link className="ar-btn" href="/quiz/arena/practice">Try it yourself first</Link></div>
    </main>
  );
}
