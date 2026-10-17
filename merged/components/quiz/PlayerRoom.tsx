'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, readToken } from '@/lib/quiz/client';
import QuestionPlay from './QuestionPlay';
import AnswerView from './AnswerView';
import { fmtClock, useRoomState, useTick } from './useRoomState';
import { modifierLabels, type Modifier } from '@/lib/quiz/types';

export default function PlayerRoom({ roomId }: { roomId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setToken(readToken(roomId)); setReady(true); }, [roomId]);
  const { state, error: pollError, fatal, refresh, serverNow } = useRoomState(roomId, { token, ready: ready && !!token });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wager, setWager] = useState(0);
  const [flash, setFlash] = useState('');
  useTick(250);

  if (!ready) return <main className="page"><p className="muted-text">Loading…</p></main>;
  if (!token) return <main className="narrow"><section className="panel stack"><h1>Join a room first</h1><p className="muted-text">This device isn’t part of that game yet.</p><Link className="btn" href="/quiz/join">Enter a game code</Link></section></main>;
  if (fatal) return <main className="narrow"><section className="panel stack"><h1>Can’t open this game</h1><p className="error">{pollError}</p><Link className="btn" href="/quiz/join">Join another game</Link></section></main>;
  if (!state) return <main className="page"><p className="muted-text">{pollError || 'Loading game…'}</p></main>;

  const s = state;
  const me = s.players.find((p: any) => p.id === s.selfId);
  const mods: Modifier[] = s.config.modifiers;
  const ranking = [...s.players].sort((a: any, b: any) => b.points - a.points);
  const now = s.paused && s.pausedAt ? Date.parse(s.pausedAt) : serverNow();
  const matchLeft = s.expiresAt ? (Date.parse(s.expiresAt) - now) / 1000 : null;
  const qLeft = s.config.questionSeconds && s.questionOpenedAt ? (Date.parse(s.questionOpenedAt) + s.config.questionSeconds * 1000 - now) / 1000 : null;
  const answered = s.selfId && s.answeredActors.includes(s.selfId);
  const solo = s.mode === 'solo';

  async function submit(response: unknown) {
    setBusy(true); setError('');
    try {
      const d = await api<{ correct: boolean; awarded: number }>(`/api/quiz/rooms/${roomId}/submit`, { method: 'POST', json: { roomQuestionId: s.question.id, token, wager, response } });
      setFlash(`${d.correct ? 'Correct!' : 'Not quite.'} ${d.awarded >= 0 ? '+' : ''}${d.awarded} points`);
      setWager(0);
      await refresh();
    } catch (e) { setError((e as Error).message); throw e; } finally { setBusy(false); }
  }
  async function potluck() {
    setBusy(true); setError('');
    try { const d = await api<{ change: number }>(`/api/quiz/rooms/${roomId}/modifier`, { method: 'POST', headers: { 'x-player-token': token! }, json: { kind: 'potluck' } }); setFlash(`Potluck! ${d.change >= 0 ? '+' : ''}${d.change} points`); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div><p className="eyebrow">Classic Quiz · {solo ? 'Solo' : 'Online'} · {s.flow.replace('_', ' ')}</p><h1>{solo ? 'Your game' : `Room ${s.code}`}</h1></div>
        <div className="row">
          {matchLeft !== null && s.status === 'active' && <span className={`timer ${matchLeft < 30 ? 'low' : ''}`} aria-label="Match time left">⏱ {fmtClock(matchLeft)}</span>}
          {me && <span className="timer" aria-label="Your points">{me.points} pts</span>}
        </div>
      </header>

      {s.status === 'waiting' && <section className="panel stack"><h2>Waiting for the host to start…</h2><p className="muted-text">You’re in. This page updates by itself — keep it open.</p></section>}
      {s.paused && s.status === 'active' && <p className="info" role="status">The host has paused the game.</p>}

      {s.status === 'active' && !s.paused && s.finished && (
        <section className="panel stack"><h2>You’ve answered every question</h2><p className="muted-text">{solo ? 'Finishing up…' : 'Waiting for the others and the host. Final results appear when the match ends.'}</p></section>
      )}

      {s.status === 'active' && s.question && !s.finished && (
        <section className="panel stack pop" key={s.question.id}>
          <div className="row spread">
            <p className="note">Question {s.currentIndex + 1} of {s.questionCount}</p>
            {qLeft !== null && !answered && <span className={`timer ${qLeft < 8 ? 'low' : ''}`} aria-label="Question time left">{fmtClock(qLeft)}</span>}
          </div>
          {mods.includes('secret_wager') && !answered && (
            <label>Secret wager (0–{me?.points ?? 0} points). Win it if you’re right, lose it if you’re wrong.
              <input type="number" min={0} max={me?.points ?? 0} value={wager} onChange={(e) => setWager(Math.max(0, Math.min(me?.points ?? 0, Number(e.target.value) || 0)))} /></label>
          )}
          <QuestionPlay question={s.question} busy={busy} disabled={s.paused || s.revealed || !!answered || (qLeft !== null && qLeft <= 0)} onSubmit={submit} />
          {solo && mods.includes('potluck') && <div><button className="btn small ghost" disabled={busy || s.paused} onClick={potluck}>🎲 {modifierLabels.potluck} (random −200…+200)</button></div>}
          {answered && s.flow !== 'independent' && <p className="success" role="status">Your answer is locked in. Waiting for the host to continue…</p>}
          {s.revealed && s.question.answerKey && <AnswerView kind={s.question.kind} payload={s.question.payload} answerKey={s.question.answerKey} />}
        </section>
      )}

      {s.lastResult && s.status === 'active' && !s.finished && s.flow === 'independent' && s.currentIndex > 0 && (
        <p className={s.lastResult.timeout ? 'info' : s.lastResult.correct ? 'success' : 'error'} role="status">
          Previous question: {s.lastResult.timeout ? 'time ran out' : s.lastResult.correct ? 'correct' : 'not correct'}.
        </p>
      )}
      {flash && s.status === 'active' && <p className="success" role="status">{flash}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {s.status === 'ended' && (
        <section className="panel stack"><p className="eyebrow">Game over</p><h2>Final standings</h2>
          <ol>{ranking.map((p: any) => <li key={p.id}><strong>{p.display_name}{p.id === s.selfId ? ' (you)' : ''}</strong> — {p.points} pts</li>)}</ol>
          {s.review && <details open><summary>Review the answers</summary>
            {s.review.map((r: any) => <div key={r.id} className="stack" style={{ marginTop: 14 }}><p><strong>{r.position + 1}. {r.prompt}</strong></p><AnswerView kind={r.kind} payload={r.payload} answerKey={r.answerKey} /></div>)}</details>}
          <div className="row"><Link className="btn" href="/quiz/library">Browse quizzes</Link><Link className="btn ghost" href="/quiz/join">Join another game</Link></div>
        </section>
      )}

      {!solo && s.status !== 'ended' && (
        <section className="panel"><h3>Scoreboard</h3>
          <div className="scores">{ranking.map((p: any, i: number) => <div key={p.id} className={`score ${p.id === s.selfId ? 'me' : ''}`}><strong>{i + 1}. {p.display_name}{p.id === s.selfId ? ' (you)' : ''}</strong><span className="pts">{p.points}</span></div>)}</div></section>
      )}
    </main>
  );
}
