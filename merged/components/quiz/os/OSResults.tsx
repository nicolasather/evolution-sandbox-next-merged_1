'use client';
/** End of match: squad standings from the server's immutable results, the relay formula in plain words, then the learning review.
 *  Wording never ranks a student against classmates by name: standings are for squads, the review is for the class. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/quiz/client';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { TEAM_COLORS, TEAM_MARK } from './art';
import type { OSClient, OSSnap } from './useOS';

type Row = { position: number; kind: string; prompt: string; answered: number; correct: number; partial: number; wrong: number; avgPct: number | null; explanation: string | null; byPlayer?: Record<string, string> };
const REASON: Record<string, string> = { escaped: 'The whole squad reached the goal.', time_up: 'The time ran out.', host_ended: 'The teacher ended the match.' };
export default function OSResults({ snap, client, practice = false, host = false }: { snap: OSSnap; client: OSClient; practice?: boolean; host?: boolean }) {
  const [review, setReview] = useState<Row[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    if (practice || client.local) return; let live = true;
    api<{ review: Row[] }>(`/api/quiz/os/rooms/${snap.room.id}/results${host ? '?view=host' : ''}`).then((d) => { if (live) setReview(d.review); }).catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [practice, client.local, snap.room.id, host]);
  const fin = snap.finish; const st = fin?.standings ?? []; const my = snap.you?.teamId; const mine = st.find((x) => x.teamId === my) ?? st[0]; const relay = snap.format === 'relay_race';
  const total = mine?.escaped !== undefined && mine.players ? `${mine.escaped} of ${mine.players} reached the goal` : '';
  const headline = !fin ? 'Match over' : relay ? (mine?.rank === 1 ? 'Your squad led the relay' : 'Relay complete') : mine && mine.players > 0 && mine.escaped === mine.players ? 'The squad escaped!' : 'The squad got this far';
  return (
    <main className="os-results" data-testid="os-results">
      <section className="os-card finale">
        <h1>{practice ? 'Practice run complete' : headline}</h1>
        {fin && <p className="os-note">{REASON[fin.reason]} {total}</p>}
        {!practice && (
          <ol className="os-standings">{st.map((s) => { const i = snap.teams.findIndex((t) => t.id === s.teamId); return (
            <li key={s.teamId} className={s.teamId === my ? 'mine' : ''}>
              <span className="rank">{relay ? s.rank : TEAM_MARK[i % 4]}</span><i style={{ background: TEAM_COLORS[Math.max(0, i) % 4] }} aria-hidden="true" /><b>{s.name}{s.teamId === my ? ' (your squad)' : ''}</b>
              <span>Progress {Math.round(s.progress / 10)}%</span><span>Mastery {Math.round(s.mastery / 10)}%</span><span>Teamwork {Math.round(s.teamwork / 10)}%</span>{relay && <b>Score {s.score}</b>}
              <small>{s.cleared} hazards cleared · {s.hits} hits · {s.assists} assists · {s.spent} points spent</small>
            </li>); })}</ol>)}
        {relay && <p className="os-note">Relay score = 45% progress + 40% mastery (correct answers) + 15% teamwork (rescues and bridges). Within 5% the tie-break is mastery, hazards cleared, fewer hits, fewer assists, then earlier escape.</p>}
        {practice && <p className="os-note">Practice never saves anything and never awards points.</p>}
      </section>
      <section className="os-card">
        <h2>What the class answered</h2>
        {practice && <ul className="os-review">{PRACTICE.slice(0, 6).map((q) => <li key={q.id}><p className="q">{q.prompt}</p>{(q.answerKey as { explanation?: string }).explanation && <p className="os-note">{(q.answerKey as { explanation?: string }).explanation}</p>}</li>)}</ul>}
        {!practice && !review && !err && <p className="os-note" role="status">Loading the review…</p>}
        {err && <p className="os-why">{err}</p>}
        {review && review.length === 0 && <p className="os-note">No questions were answered in this match.</p>}
        {review && review.length > 0 && <ul className="os-review">{review.map((q) => (
          <li key={q.position}><p className="q">{q.prompt}</p>
            <div className="os-bar" role="img" aria-label={`${q.correct} correct, ${q.partial} partly correct, ${q.wrong} wrong`}><span className="c" style={{ flex: q.correct }} /><span className="p" style={{ flex: q.partial }} /><span className="w" style={{ flex: q.wrong }} /></div>
            <p className="os-note">{q.correct} correct · {q.partial} partly · {q.wrong} wrong{q.avgPct !== null ? ` · class average ${q.avgPct}%` : ''}</p>
            {q.explanation && <p className="os-explain">{q.explanation}</p>}
            {host && q.byPlayer && <details><summary>By student</summary><ul>{Object.entries(q.byPlayer).map(([id, v]) => <li key={id}>{snap.seats.find((s) => s.id === id)?.name ?? 'Player'}: {v}</li>)}</ul></details>}
          </li>))}</ul>}
      </section>
      <nav className="os-row end">
        {practice ? <button type="button" className="os-btn primary" onClick={() => window.location.reload()}>Practice again</button> : <Link className="os-btn primary" href="/quiz/os">Obstacle Survival home</Link>}
        <Link className="os-btn" href="/quiz/modes">All game modes</Link>
      </nav>
    </main>
  );
}
