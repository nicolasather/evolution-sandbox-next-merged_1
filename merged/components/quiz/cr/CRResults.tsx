'use client';
/** End of race: team standings from the server's immutable results, the score formula in plain words, the route atlas, then the learning review.
 *  Wording never ranks a student against classmates by name: standings are for teams, the review is for the class. A tie is shown as a tie. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/quiz/client';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { TeamBadge } from './icons';
import { CRCanvas } from './ui';
import { usePrefs } from './prefs';
import type { CRClient, CRSnap } from './useCR';

type Row = { position: number; kind: string; prompt: string; answered: number; correct: number; partial: number; wrong: number; avgPct: number | null; explanation: string | null; byPlayer?: Record<string, string> };
const REASON: Record<string, string> = { completed: 'Every leg was raced.', time_up: 'The time ran out.', host_ended: 'The teacher ended the race.' };
export default function CRResults({ snap, client, practice = false, host = false }: { snap: CRSnap; client: CRClient; practice?: boolean; host?: boolean }) {
  const [review, setReview] = useState<Row[] | null>(null); const [err, setErr] = useState(''); const [prefs, , reduced] = usePrefs();
  useEffect(() => {
    if (practice || client.local) return undefined; let live = true;
    api<{ review: Row[] }>(`/api/quiz/clue/rooms/${snap.room.id}/results${host ? '?view=host' : ''}`).then((d) => { if (live) setReview(d.review); }).catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [practice, client.local, snap.room.id, host]);
  const fin = snap.finish; const st = fin?.standings ?? []; const my = snap.you?.teamId; const mine = st.find((x) => x.teamId === my);
  const headline = practice ? 'Practice complete' : !fin ? 'Race over' : mine ? (mine.rank === 1 ? (mine.tied ? 'Your team shares first place' : 'Your team won') : 'Race complete') : 'Race complete';
  return (
    <main className="cr-results" data-testid="cr-results">
      <section className="cr-card finale">
        <h1>{headline}</h1>
        {fin && <p className="cr-note">{REASON[fin.reason] ?? ''}</p>}
        {fin?.tieNote && <p className="cr-tie" role="status">{fin.tieNote}</p>}
        <ol className="cr-standings">{st.map((s) => { const i = Math.max(0, snap.teams.findIndex((t) => t.id === s.teamId)); return (
          <li key={s.teamId} className={s.teamId === my ? 'mine' : ''}>
            <span className="rank" aria-label={`Rank ${s.rank}${s.tied ? ' (tied)' : ''}`}>{s.rank}{s.tied ? '=' : ''}</span><TeamBadge index={i} size={26} /><b>{s.name}{s.teamId === my ? ' (your team)' : ''}</b><b className="score">Score {s.score}</b>
            <div className="cr-parts" role="img" aria-label={`Mastery ${Math.round(s.mastery / 10)} percent, route ${Math.round(s.route / 10)} percent, teamwork ${Math.round(s.teamwork / 10)} percent`}>
              <span className="m" style={{ width: `${s.mastery * 0.06}%` }}>Mastery {Math.round(s.mastery / 10)}%</span><span className="r" style={{ width: `${s.route * 0.025}%` }}>Route {Math.round(s.route / 10)}%</span><span className="t" style={{ width: `${s.teamwork * 0.015}%` }}>Team {Math.round(s.teamwork / 10)}%</span>
            </div>
            <small>{s.correctSites} correct stamps · {s.retries} retries · {s.spent} points spent · {s.players} player{s.players === 1 ? '' : 's'}</small>
          </li>); })}</ol>
        <p className="cr-note">Score = quiz mastery × 60% + route × 25% + teamwork × 15%, each scaled 0–1000 and independent of team size. Speed is never rewarded: a team that walks slowly scores the same as one that hurries. Equal scores tie on mastery, then route, then teamwork; a tie that remains stays a tie.</p>
        {practice && <p className="cr-note">Practice never saves anything and never awards points.</p>}
      </section>
      <section className="cr-card"><h2>Route atlas</h2><div className="cr-atlas"><CRCanvas client={client} mode="overview" prefs={prefs} reduced={reduced} label="The whole course with every checkpoint" className="atlas" /></div></section>
      <section className="cr-card">
        <h2>What the class answered</h2>
        {practice && <ul className="cr-review">{PRACTICE.slice(0, 3).map((q) => <li key={q.id}><p className="q">{q.prompt}</p>{(q.answerKey as { explanation?: string }).explanation && <p className="cr-note">{(q.answerKey as { explanation?: string }).explanation}</p>}</li>)}</ul>}
        {!practice && !review && !err && <p className="cr-note" role="status">Loading the review…</p>}
        {err && <p className="cr-why">{err}</p>}
        {review && review.length === 0 && <p className="cr-note">No questions were answered in this race.</p>}
        {review && review.length > 0 && <ul className="cr-review">{review.map((q) => (
          <li key={q.position}><p className="q">{q.prompt}</p>
            <div className="cr-bar" role="img" aria-label={`${q.correct} correct, ${q.partial} partly correct, ${q.wrong} wrong`}><span className="c" style={{ flex: q.correct }} /><span className="p" style={{ flex: q.partial }} /><span className="w" style={{ flex: q.wrong }} /></div>
            <p className="cr-note">{q.correct} correct · {q.partial} partly · {q.wrong} wrong{q.avgPct !== null ? ` · class average ${q.avgPct}%` : ''}</p>
            {q.explanation && <p className="cr-explain">{q.explanation}</p>}
            {host && q.byPlayer && <details><summary>By student</summary><ul>{Object.entries(q.byPlayer).map(([id, v]) => <li key={id}>{snap.seats.find((s) => s.id === id)?.name ?? 'Player'}: {v}</li>)}</ul></details>}
          </li>))}</ul>}
      </section>
      <nav className="cr-row end">
        {practice ? <button type="button" className="cr-btn primary" onClick={() => window.location.reload()}>Practice again</button> : <Link className="cr-btn primary" href="/quiz/cr">Clue Racing home</Link>}
        <Link className="cr-btn" href="/quiz/modes">All game modes</Link>
      </nav>
    </main>
  );
}
