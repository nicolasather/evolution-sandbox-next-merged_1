'use client';
/** End of match: team standings from the server's immutable results, the score formula in plain words, then the learning review.
 *  Wording never ranks a student against classmates by name: standings are for teams, the review is for the class. A tie is shown as a tie. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/quiz/client';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { TeamBadge } from './icons';
import type { ArenaClient, ArenaSnap } from './useArena';

type Row = { position: number; kind: string; prompt: string; answered: number; correct: number; partial: number; wrong: number; avgPct: number | null; explanation: string | null; byPlayer?: Record<string, string> };
const REASON: Record<string, string> = { completed: 'All rounds were played.', time_up: 'The time ran out.', host_ended: 'The teacher ended the match.' };
export default function ArenaResults({ snap, client, practice = false, host = false }: { snap: ArenaSnap; client: ArenaClient; practice?: boolean; host?: boolean }) {
  const [review, setReview] = useState<Row[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    if (practice || client.local) return undefined; let live = true;
    api<{ review: Row[] }>(`/api/quiz/arena/rooms/${snap.room.id}/results${host ? '?view=host' : ''}`).then((d) => { if (live) setReview(d.review); }).catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [practice, client.local, snap.room.id, host]);
  const fin = snap.finish; const st = fin?.standings ?? []; const my = snap.you?.teamId; const mine = st.find((x) => x.teamId === my);
  const headline = practice ? 'Practice complete' : !fin ? 'Match over' : mine ? (mine.rank === 1 ? (mine.tied ? 'Your team shares first place' : 'Your team won') : 'Match complete') : 'Match complete';
  return (
    <main className="ar-results" data-testid="ar-results">
      <section className="ar-card finale">
        <h1>{headline}</h1>
        {fin && <p className="ar-note">{REASON[fin.reason] ?? ''}</p>}
        {fin?.tieNote && <p className="ar-tie" role="status">{fin.tieNote}</p>}
        <ol className="ar-standings">{st.map((s) => { const i = Math.max(0, snap.teams.findIndex((t) => t.id === s.teamId)); return (
          <li key={s.teamId} className={s.teamId === my ? 'mine' : ''}>
            <span className="rank" aria-label={`Rank ${s.rank}${s.tied ? ' (tied)' : ''}`}>{s.rank}{s.tied ? '=' : ''}</span><TeamBadge index={i} size={26} /><b>{s.name}{s.teamId === my ? ' (your team)' : ''}</b>
            <span>Quiz {Math.round(s.quiz / 10)}%</span><span>Arena {Math.round(s.objective / 10)}%</span><b>Score {s.score}</b>
            <small>{s.captures} captures · {s.pulses} score pulses · {s.handins} banner hand-ins · {s.deposited} crystals banked · {s.spent} points spent · {s.players} players</small>
          </li>); })}</ol>
        <p className="ar-note">Score = quiz accuracy × {Math.round(snap.quizWeight * 100)}% + arena objective × {100 - Math.round(snap.quizWeight * 100)}%. Both parts are scaled to 0–1000 and do not depend on team size. Equal scores tie on quiz accuracy, then score pulses; a tie that remains stays a tie.</p>
        {practice && <p className="ar-note">Practice never saves anything and never awards points.</p>}
      </section>
      <section className="ar-card">
        <h2>What the class answered</h2>
        {practice && <ul className="ar-review">{PRACTICE.slice(0, 3).map((q) => <li key={q.id}><p className="q">{q.prompt}</p>{(q.answerKey as { explanation?: string }).explanation && <p className="ar-note">{(q.answerKey as { explanation?: string }).explanation}</p>}</li>)}</ul>}
        {!practice && !review && !err && <p className="ar-note" role="status">Loading the review…</p>}
        {err && <p className="ar-why">{err}</p>}
        {review && review.length === 0 && <p className="ar-note">No questions were answered in this match.</p>}
        {review && review.length > 0 && <ul className="ar-review">{review.map((q) => (
          <li key={q.position}><p className="q">{q.prompt}</p>
            <div className="ar-bar" role="img" aria-label={`${q.correct} correct, ${q.partial} partly correct, ${q.wrong} wrong`}><span className="c" style={{ flex: q.correct }} /><span className="p" style={{ flex: q.partial }} /><span className="w" style={{ flex: q.wrong }} /></div>
            <p className="ar-note">{q.correct} correct · {q.partial} partly · {q.wrong} wrong{q.avgPct !== null ? ` · class average ${q.avgPct}%` : ''}</p>
            {q.explanation && <p className="ar-explain">{q.explanation}</p>}
            {host && q.byPlayer && <details><summary>By student</summary><ul>{Object.entries(q.byPlayer).map(([id, v]) => <li key={id}>{snap.seats.find((s) => s.id === id)?.name ?? 'Player'}: {v}</li>)}</ul></details>}
          </li>))}</ul>}
      </section>
      <nav className="ar-row end">
        {practice ? <button type="button" className="ar-btn primary" onClick={() => window.location.reload()}>Practice again</button> : <Link className="ar-btn primary" href="/quiz/arena">Arena Clash home</Link>}
        <Link className="ar-btn" href="/quiz/modes">All game modes</Link>
      </nav>
    </main>
  );
}
