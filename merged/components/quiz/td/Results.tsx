'use client';
/** End of match: the squad standings (from the server's immutable results), then the learning review — each question asked, how the class
 *  did, and its explanation. Students see class counts only; the teacher's view adds who answered what. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/quiz/client';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { TEAM_SWATCH } from './parts';
import type { TDClient, TDSnap } from './useTD';

type ReviewRow = { position: number; kind: string; prompt: string; answered: number; correct: number; partial: number; wrong: number; avgPct: number | null; explanation: string | null; byPlayer?: Record<string, string> };
const REASON: Record<string, string> = { complete: 'Every wave was played.', core: 'A core fell.', time: 'The time ran out.', teacher: 'The teacher ended the match.', questions: 'The quiz ran out of questions.' };
const OUTCOME: Record<string, string> = { victory: 'Victory: the core held to the last wave', partial: 'The core held part of the way', defeat: 'The core fell', ranked: 'Final standings' };

export default function Results({ snap, client, practice = false, host = false }: { snap: TDSnap; client: TDClient; practice?: boolean; host?: boolean }) {
  const [review, setReview] = useState<ReviewRow[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    if (practice || client.local) return;
    let live = true;
    api<{ review: ReviewRow[] }>(`/api/quiz/td/rooms/${snap.room.id}/results${host ? '?view=host' : ''}`)
      .then((d) => { if (live) setReview(d.review); })
      .catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [practice, client.local, snap.room.id, host]);
  const fin = snap.finish; const standings = fin?.standings ?? [];
  const teamOf = (id: string) => snap.teams.find((t) => t.id === id);
  const myTeam = snap.selfTeamId; const seatName = (id: string) => snap.seats.find((s) => s.id === id)?.name ?? 'Player';
  const practiceReview = practice ? PRACTICE.filter((p) => snap.usedPositions.includes(p.position) || snap.usedPositions.includes(p.position + 100)).map((p) => ({ position: p.position, prompt: p.prompt, kind: p.kind, explanation: (p.answerKey as { explanation?: string }).explanation ?? null })) : [];

  return (
    <main className="td-results">
      <section className="td-panel td-finale">
        <h1>{fin ? OUTCOME[fin.outcome] : 'Match over'}</h1>
        {fin && <p className="td-note">{REASON[fin.reason]}</p>}
        <ol className="td-standings">
          {standings.map((s) => { const t = teamOf(s.teamId); return (
            <li key={s.teamId} className={s.teamId === myTeam ? 'mine' : ''}>
              <span className="td-rank">{s.rank}</span><i style={{ background: TEAM_SWATCH[t?.colorIndex ?? 0] }} aria-hidden="true" />
              <b>{t?.name ?? s.teamId}{s.teamId === myTeam ? ' (your squad)' : ''}</b>
              <span>{s.wavesCleared} waves</span><span>core {s.coreHP}/{s.maxCoreHP}</span><span>{s.accuracyPct === null ? 'accuracy —' : `${s.accuracyPct}% accuracy`}</span>
            </li>); })}
        </ol>
        {snap.config.format === 'versus' && <p className="td-note">Ranking: waves cleared, then core health, then answer accuracy.</p>}
      </section>
      <section className="td-panel">
        <h2>What the class answered</h2>
        {practice && <ul className="td-review">{practiceReview.map((q) => <li key={q.position}><p className="q">{q.prompt}</p>{q.explanation && <p className="td-note">{q.explanation}</p>}</li>)}</ul>}
        {!practice && !review && !err && <p className="td-note" role="status">Loading the review…</p>}
        {err && <p className="td-why">{err}</p>}
        {review && review.length === 0 && <p className="td-note">No questions were answered in this match.</p>}
        {review && review.length > 0 && (
          <ul className="td-review">{review.map((q) => (
            <li key={q.position}>
              <p className="q">{q.prompt}</p>
              <div className="td-bar" role="img" aria-label={`${q.correct} correct, ${q.partial} partly correct, ${q.wrong} wrong`}>
                <span className="c" style={{ flex: q.correct }} /><span className="p" style={{ flex: q.partial }} /><span className="w" style={{ flex: q.wrong }} />
              </div>
              <p className="td-note">{q.correct} correct · {q.partial} partly · {q.wrong} wrong{q.avgPct !== null ? ` · class average ${q.avgPct}%` : ''}</p>
              {q.explanation && <p className="td-explain">{q.explanation}</p>}
              {host && q.byPlayer && <details><summary>By student</summary><ul>{Object.entries(q.byPlayer).map(([id, v]) => <li key={id}>{seatName(id)}: {v}</li>)}</ul></details>}
            </li>))}</ul>
        )}
      </section>
      <nav className="td-row td-endnav">
        {practice ? <button type="button" className="td-btn primary" onClick={() => window.location.reload()}>Practice again</button> : <Link className="td-btn primary" href="/quiz/td">Tower Defense home</Link>}
        <Link className="td-btn" href="/quiz/modes">All game modes</Link>
      </nav>
    </main>
  );
}
