'use client';
import type { Loose } from '@/lib/quiz/loose';
import { useState } from 'react';
import Link from 'next/link';
import AnswerView from '../AnswerView';
import { api } from '@/lib/quiz/client';
import type { SwarmConnection } from '@/lib/swarm/client/connection';
import type { PlayQuestion } from '../QuestionPlay';

type A = Record<string, Loose>;
const REASON: Record<string, string> = { beacon_fallen: 'The beacon fell.', all_waves_cleared: 'Every wave was cleared.', teacher_ended: 'The teacher ended the match.', all_fallen: 'Every team’s beacon fell.', quiz_exhausted: 'The questions ran out.', time: 'Time ran out.' };

export function ResultsPanel({ conn, roomId, token, practice }: { conn: SwarmConnection; roomId?: string; token?: string; practice?: { again: () => void } }) {
  const r = conn.s.results as A | undefined; const [review, setReview] = useState<A | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!r || !r.standings?.length) return <section className="sw-card" data-testid="ending"><h2>Match over</h2><p>Counting up the results…</p></section>;
  const me = conn.s.me as A | undefined; const mine = (r.standings as A[]).find((s) => s.teamId === me?.team); const versus = (conn.s.meta as A).mode === 'versus';
  const load = async () => { setBusy(true); setErr(''); try { setReview(await api<A>(`/api/quiz/swarm/rooms/${roomId}/review`, { method: 'POST', json: { token } })); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  return (
    <section className="sw-card sw-results" aria-labelledby="sw-r-h" data-testid="results">
      <h2 id="sw-r-h">{versus ? (mine?.rank === 1 ? 'Your team came first' : `Your team finished #${mine?.rank ?? '–'}`) : r.outcome === 'won' ? 'You held the beacon!' : r.outcome === 'lost' ? 'The beacon fell' : 'Match over'}</h2>
      <p>{REASON[r.reason as string] ?? 'The match is over.'} {r.outcome === 'lost' && !versus && 'Every answer you gave still counted toward what you learned — look at the review below.'}</p>
      <div className="sw-tablewrap"><table><caption className="sw-sr">Final standings</caption>
        <thead><tr><th>Rank</th><th>Team</th><th>Waves</th><th>Beacon</th><th>Damage / s</th><th>Accuracy</th><th>Points earned</th></tr></thead>
        <tbody>{(r.standings as A[]).map((s) => <tr key={s.teamId} className={s.teamId === me?.team ? 'me' : ''}><td>{s.rank}</td><th scope="row">{s.name}</th><td>{s.wavesCompleted}</td><td>{s.beaconPct}%</td><td>{s.dmgPerActiveSec}</td><td>{s.accuracyPct === null ? '–' : `${s.accuracyPct}%`}</td><td>{s.earned}</td></tr>)}</tbody></table></div>
      <p className="sw-note">Ranking: waves cleared, then beacon health, then damage per active second, then answer accuracy. Speed of answering never counts.</p>
      <div className="sw-row">
        {practice && <button type="button" className="sw-btn primary" onClick={practice.again}>Practice again</button>}
        {!practice && roomId && token && !review && <button type="button" className="sw-btn primary" onClick={load} disabled={busy}>{busy ? 'Loading…' : 'Review my answers'}</button>}
        <Link className="sw-btn" href="/quiz/swarm">Back to Swarm Survival</Link>
      </div>
      {err && <p className="sw-err" role="alert">{err}</p>}
      {review && (
        <div className="sw-review" data-testid="review"><h3>Your answers: {review.correct} of {review.total} correct</h3>
          <ol>{(review.items as A[]).map((it, i) => (
            <li key={i}><p><b>{(it.question as PlayQuestion).prompt}</b></p><p className={it.mine.correct ? 'sw-ok' : 'sw-warn'}>{it.mine.correct ? 'Correct' : it.mine.fraction > 0 ? `Partly right (${Math.round(it.mine.fraction * 100)}%)` : 'Not correct'}</p>
              {it.question.answerKey && <AnswerView kind={it.question.kind} payload={it.question.payload} answerKey={it.question.answerKey} />}</li>))}</ol>
          {review.total === 0 && <p>No answers were recorded for you.</p>}
        </div>
      )}
    </section>
  );
}
