'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/quiz/client';
import { SCORE_NOTE } from '@/lib/quiz/report-text';

type Perf = { label: string; answered: number; correct: number; accuracy: number }[];
type Report = {
  title: string; status: string;
  report: { rows: { id: string; name: string; finalPoints: number; academicPoints: number; modifierPoints: number; answered: number; correct: number; firstAttemptAccuracy: number; rank: number; rankWithoutModifiers: number }[]; attendance: number; totalAnswered: number; classAccuracy: number; caveat?: string; teamLevel?: boolean };
  questions: { id: string; position: number; prompt: string; kind: string; answered: number; correct: number; accuracy: number; distribution: { label: string; count: number }[]; commonWrong: { label: string; count: number }[] }[];
  impact: { byReason: { reason: string; uses: number; gained: number; lost: number }[] };
  misconceptions: { objective: string; mistakeRate: number; questionIds: string[] }[];
  byTopic: Perf; byObjective: Perf; byDifficulty: Perf; byKind: Perf;
};
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The host's report: academic results first, point events kept separate, nothing about individuals in a one-device classroom session. */
export default function ReportView({ roomId }: { roomId: string }) {
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [kind, setKind] = useState('');
  const qs = useMemo(() => { const p = new URLSearchParams(); if (topic) p.set('topic', topic); if (difficulty) p.set('difficulty', difficulty); if (kind) p.set('kind', kind); return p; }, [topic, difficulty, kind]);
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  useEffect(() => {
    let live = true;
    api<Report>(`/api/quiz/rooms/${roomId}/report?${qs}`).then((d) => { if (live) { setR(d); setError(''); } }).catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [roomId, qs]);
  const exportQs = (f: 'csv' | 'pdf') => { const p = new URLSearchParams(qs); p.set('format', f); p.set('tz', tz); p.set('lang', (navigator.language || 'en').slice(0, 2)); return `/api/quiz/rooms/${roomId}/report?${p}`; };

  if (error && !r) return <main className="narrow"><section className="panel stack"><h1>No report</h1><p className="error" role="alert">{error}</p><Link className="btn" href="/quiz/my">My Quizzes</Link></section></main>;
  if (!r) return <main className="page"><p className="muted-text" role="status">Loading report…</p></main>;
  const topics = r.byTopic.map((t) => t.label).filter((t) => t && t !== 'Ungrouped');
  return (
    <main className="page" id="main">
      <nav aria-label="Breadcrumb" className="note"><Link href="/quiz">Quiz Studio</Link> › <Link href="/quiz/my">My Quizzes</Link> › Report</nav>
      <header className="page-header"><div><p className="eyebrow">Session report</p><h1>{r.title}</h1></div>
        <div className="row"><a className="btn small ghost" href={exportQs('csv')}>Download CSV</a><a className="btn small ghost" href={exportQs('pdf')}>Download PDF</a><button className="btn small ghost" onClick={() => window.print()}>Print</button></div></header>
      {r.status !== 'ended' && <p className="info" role="status">This game is still running, so numbers may change.</p>}
      {r.report.caveat && <p className="info" role="note">{r.report.caveat}</p>}

      <section className="panel stack" aria-labelledby="sum-h"><h2 id="sum-h">Summary</h2>
        <ul className="row" style={{ listStyle: 'none', padding: 0 }}><li className="pill">{r.report.attendance} {r.report.teamLevel ? 'teams' : 'players'}</li><li className="pill">{r.report.totalAnswered} answers</li><li className="pill">{pct(r.report.classAccuracy)} correct</li></ul>
        <p className="note">{SCORE_NOTE}</p></section>

      <section className="panel stack" aria-labelledby="flt-h"><h2 id="flt-h">Filters</h2>
        <div className="grid2">
          <label>Topic<select value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All</option>{topics.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">All</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label>Format<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All</option><option value="multiple_choice">Multiple Choice</option><option value="answer_forge">Answer Forge</option><option value="connection_rush">Connection Rush</option><option value="truth_hunt">Truth Hunt</option><option value="fill_table">Fill the Table</option></select></label>
        </div></section>

      <section className="panel stack" aria-labelledby="res-h"><h2 id="res-h">{r.report.teamLevel ? 'Teams' : 'Players'}</h2>
        <div className="tablewrap"><table><thead><tr><th>Rank</th><th>Name</th><th>Final</th><th>From answers</th><th>From point events</th><th>Correct</th>{!r.report.teamLevel && <th>First-try accuracy</th>}</tr></thead>
          <tbody>{r.report.rows.sort((a, b) => a.rank - b.rank).map((x) => (
            <tr key={x.id}><td>{x.rank}{x.rank !== x.rankWithoutModifiers ? <span className="note"> (would be {x.rankWithoutModifiers} without events)</span> : null}</td><td>{x.name}</td><td>{x.finalPoints}</td><td>{x.academicPoints}</td><td>{x.modifierPoints}</td><td>{x.correct}/{x.answered}</td>{!r.report.teamLevel && <td>{pct(x.firstAttemptAccuracy)}</td>}</tr>
          ))}</tbody></table></div></section>

      {r.misconceptions.length > 0 && (
        <section className="panel stack" aria-labelledby="mis-h"><h2 id="mis-h">Worth re-teaching</h2>
          <ul>{r.misconceptions.slice(0, 6).map((m) => <li key={m.objective}><strong>{m.objective}</strong> — {pct(m.mistakeRate)} of answers were wrong.</li>)}</ul></section>
      )}

      <section className="panel stack" aria-labelledby="top-h"><h2 id="top-h">By topic and difficulty</h2>
        <div className="tablewrap"><table><thead><tr><th>Group</th><th>Answers</th><th>Correct</th></tr></thead>
          <tbody>{[...r.byTopic.map((x) => ({ ...x, label: `Topic · ${x.label}` })), ...r.byDifficulty.map((x) => ({ ...x, label: `Difficulty · ${x.label}` })), ...r.byKind.map((x) => ({ ...x, label: `Format · ${x.label}` }))].map((x) => <tr key={x.label}><td>{x.label}</td><td>{x.answered}</td><td>{pct(x.accuracy)}</td></tr>)}</tbody></table></div></section>

      <section className="panel stack" aria-labelledby="q-h"><h2 id="q-h">Questions</h2>
        {r.questions.map((q) => (
          <details key={q.id}><summary>{q.position + 1}. {q.prompt.slice(0, 80)} — {pct(q.accuracy)} correct ({q.correct}/{q.answered})</summary>
            {q.distribution.length > 0 && <ul className="note">{q.distribution.map((d) => <li key={d.label}>{d.label}: {d.count}</li>)}</ul>}
            {q.commonWrong.length > 0 && <p className="note">Most common wrong answer: {q.commonWrong[0]!.label} ({q.commonWrong[0]!.count}).</p>}
          </details>
        ))}</section>

      {r.impact.byReason.length > 0 && (
        <section className="panel stack" aria-labelledby="imp-h"><h2 id="imp-h">Point events</h2>
          <div className="tablewrap"><table><thead><tr><th>Event</th><th>Uses</th><th>Points gained</th><th>Points lost</th></tr></thead>
            <tbody>{r.impact.byReason.map((x) => <tr key={x.reason}><td>{x.reason.replace(/_/g, ' ')}</td><td>{x.uses}</td><td>{x.gained}</td><td>{x.lost}</td></tr>)}</tbody></table></div></section>
      )}
    </main>
  );
}
