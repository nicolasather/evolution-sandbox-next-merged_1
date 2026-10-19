'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, readToken } from '@/lib/quiz/client';
import QuestionPlay from './QuestionPlay';
import AnswerView from './AnswerView';
import { fmtClock, useRoomState, useTick } from './useRoomState';
import { modifierLabels, type Modifier } from '@/lib/quiz/types';
import { effectiveSettings, mastery, reviewMistakes, type Attempt } from '@/lib/quiz/learning';
import { announce } from '@/lib/quiz/a11y';
import { iconSvg } from '@/lib/quiz/cosmetics/catalog';

export default function PlayerRoom({ roomId }: { roomId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [calm, setCalm] = useState(false);
  /* reads browser storage, which only exists after hydration */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setToken(readToken(roomId)); try { setCalm(localStorage.getItem('qz:calm') === '1'); } catch { /* ignore */ } setReady(true); }, [roomId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const { state, error: pollError, fatal, refresh, serverNow } = useRoomState(roomId, { token, ready: ready && !!token });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wager, setWager] = useState(0);
  const [flash, setFlash] = useState('');
  const [earned, setEarned] = useState<{ id: string; name: string }[] | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  useTick(250);

  const ended = state?.status === 'ended';
  useEffect(() => {
    if (!ended || !token) return;
    api<{ earned: { id: string; name: string }[]; needsAccount?: boolean }>('/api/quiz/cosmetics/claim', { method: 'POST', json: { roomId, token } })
      .then((r) => { setEarned(r.earned); setNeedsAccount(!!r.needsAccount); }).catch(() => setEarned([]));
  }, [ended, token, roomId]);

  const mistakes = useMemo(() => {
    if (!state?.review) return [];
    const qs = state.review.map((r: any) => ({ kind: r.kind, prompt: r.prompt, payload: r.payload, answerKey: r.answerKey, basePoints: 0 }));
    const answers: Record<number, { response: unknown; correct: boolean }> = {};
    state.review.forEach((r: any, i: number) => { if (r.mine) answers[i] = { response: r.mine.response, correct: r.mine.correct }; });
    return reviewMistakes(qs, answers);
  }, [state?.review]);

  if (!ready) return <main className="page"><p className="muted-text">Loading…</p></main>;
  if (!token) return <main className="narrow"><section className="panel stack"><h1>Join a room first</h1><p className="muted-text">This device isn’t part of that game yet.</p><Link className="btn" href="/quiz/join">Enter a game code</Link></section></main>;
  if (fatal) return <main className="narrow"><section className="panel stack"><h1>Can’t open this game</h1><p className="error">{pollError}</p><Link className="btn" href="/quiz/join">Join another game</Link></section></main>;
  if (!state) return <main className="page"><p className="muted-text" role="status">{pollError || 'Loading game…'}</p></main>;

  const s = state;
  const cfg = s.config as { lowPressure?: boolean; quietClassroom?: boolean; untimed?: boolean; readAloud?: boolean; questionSeconds: number | null };
  const set = effectiveSettings({ lowPressure: cfg.lowPressure, quietClassroom: cfg.quietClassroom, untimed: cfg.untimed });
  const me = s.players.find((p: any) => p.id === s.selfId);
  const mods: Modifier[] = s.config.modifiers;
  const ranking = [...s.players].sort((a: any, b: any) => b.points - a.points);
  const now = s.paused && s.pausedAt ? Date.parse(s.pausedAt) : serverNow(); // server clock, frozen while paused
  const matchLeft = s.expiresAt ? (Date.parse(s.expiresAt) - now) / 1000 : null;
  const limit = cfg.questionSeconds && set.timerEnabled ? cfg.questionSeconds : null;
  const qLeft = limit && s.questionOpenedAt ? (Date.parse(s.questionOpenedAt) + limit * 1000 - now) / 1000 : null;
  const answered = s.selfId && s.answeredActors.includes(s.selfId);
  const solo = s.mode === 'solo';
  const pending = s.selfStatus === 'pending';
  const removed = s.selfStatus === 'removed' || s.selfStatus === 'banned';
  const progress = s.questionCount ? Math.min(100, Math.round(((s.flow === 'independent' ? me?.cursor_index ?? 0 : s.currentIndex + (answered ? 1 : 0)) / s.questionCount) * 100)) : 0;

  async function submit(response: unknown) {
    setBusy(true); setError('');
    try {
      const d = await api<{ correct: boolean; awarded: number }>(`/api/quiz/rooms/${roomId}/submit`, { method: 'POST', json: { roomQuestionId: s.question.id, token, wager, response } });
      setFlash(set.showPoints ? `${d.correct ? 'Correct.' : d.awarded > 0 ? 'Partly correct.' : 'Not correct.'} ${d.awarded >= 0 ? '+' : ''}${d.awarded} points` : d.correct ? 'Correct.' : 'Answer recorded.');
      setWager(0);
      await refresh();
    } catch (e) { setError((e as Error).message); throw e; } finally { setBusy(false); }
  }
  async function hint(): Promise<string | null> {
    const r = await api<{ hint: string | null }>(`/api/quiz/rooms/${roomId}/hint`, { method: 'POST', json: { token, roomQuestionId: s.question.id } });
    return r.hint;
  }
  async function potluck() {
    setBusy(true); setError('');
    try { const d = await api<{ change: number }>(`/api/quiz/rooms/${roomId}/modifier`, { method: 'POST', headers: { 'x-player-token': token! }, json: { kind: 'potluck' } }); setFlash(`Potluck! ${d.change >= 0 ? '+' : ''}${d.change} points`); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const toggleCalm = () => setCalm((v) => { const n = !v; try { localStorage.setItem('qz:calm', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  const attempts: Attempt[] = (s.review ?? []).filter((r: any) => r.mine).map((r: any, i: number) => ({ questionKey: String(i), concept: r.prompt.slice(0, 40), correct: r.mine.correct, attemptNo: 1, at: '' }));
  const m = mastery(attempts);
  const lock = answered ? 'Your answer is locked in.' : s.paused ? 'The game is paused.' : s.revealed ? 'The answer is shown.' : qLeft !== null && qLeft <= 0 ? 'Time is up.' : 'You can answer now.';

  return (
    <main className="page" id="main" data-calm={calm || set.quietClassroom ? 'true' : undefined}>
      <header className="page-header">
        <div><p className="eyebrow">Classic Quiz · {solo ? 'Solo' : 'Online'} · {s.flow.replace('_', ' ')}</p><h1>{solo ? 'Your game' : `Room ${s.code}`}</h1></div>
        <div className="row">
          {matchLeft !== null && s.status === 'active' && set.timerEnabled && <span className={`timer ${matchLeft < 30 ? 'low' : ''}`} aria-label="Match time left">Match {fmtClock(matchLeft)}</span>}
          {me && set.showPoints && <span className="timer" aria-label="Your points">{me.points} pts</span>}
          <button className="btn small ghost" aria-pressed={calm} onClick={toggleCalm} title="Fewer animations and less to look at">Calm mode</button>
        </div>
      </header>

      {removed && <section className="panel stack"><h2>You’re no longer in this game</h2><p className="muted-text">The host removed this device from the room.</p><Link className="btn" href="/quiz/join">Join another game</Link></section>}
      {pending && <section className="panel stack" role="status"><h2>Waiting for the host to let you in…</h2><p className="muted-text">You’re watching only until the host approves your name. Keep this page open.</p></section>}
      {!pending && !removed && s.status === 'waiting' && <section className="panel stack"><h2>Waiting for the host to start…</h2><p className="muted-text">You’re in. This page updates by itself — keep it open.</p></section>}
      {s.paused && s.status === 'active' && <p className="info" role="status">The host has paused the game.</p>}

      {s.status === 'active' && !s.paused && s.finished && !pending && (
        <section className="panel stack"><h2>You’ve answered every question</h2><p className="muted-text">{solo ? 'Finishing up…' : 'Waiting for the others and the host. Final results appear when the match ends.'}</p></section>
      )}

      {s.status === 'active' && s.question && !s.finished && !pending && !removed && (
        <section className="panel stack pop" key={s.question.id}>
          <div className="row spread">
            <p className="note" id="qprogress">Question {Math.min(s.flow === 'independent' ? (me?.cursor_index ?? 0) + 1 : s.currentIndex + 1, s.questionCount)} of {s.questionCount} · {Math.max(0, s.questionCount - (s.flow === 'independent' ? me?.cursor_index ?? 0 : s.currentIndex) - 1)} left</p>
            {qLeft !== null && !answered && <span className={`timer ${qLeft < 8 ? 'low' : ''}`} aria-label="Question time left">{fmtClock(qLeft)}</span>}
          </div>
          <div role="progressbar" aria-labelledby="qprogress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: 8, background: 'var(--qz-field)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: 'var(--qz-cyan)', transition: calm ? 'none' : 'width .3s' }} /></div>
          {qLeft !== null && !answered && limit && (
            <div aria-hidden style={{ height: 10, background: 'var(--qz-field)', borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${Math.max(0, Math.min(100, (qLeft / limit) * 100))}%`, height: '100%', background: qLeft < 8 ? 'var(--qz-coral)' : 'var(--qz-yellow)' }} /></div>
          )}
          <p className="note" role="status" aria-live="polite" data-testid="lock-state">{lock}{s.flow === 'round_robin' ? ' It is a shared turn.' : ''}</p>
          {mods.includes('secret_wager') && !answered && (
            <label>Secret wager (0–{me?.points ?? 0} points). Win it if you’re right, lose it if you’re wrong.
              <input type="number" min={0} max={me?.points ?? 0} value={wager} onChange={(e) => setWager(Math.max(0, Math.min(me?.points ?? 0, Number(e.target.value) || 0)))} /></label>
          )}
          <QuestionPlay question={s.question} busy={busy} readAloud={cfg.readAloud !== false} onHint={hint} disabled={s.paused || s.revealed || !!answered || (qLeft !== null && qLeft <= 0)} onSubmit={submit} />
          {solo && mods.includes('potluck') && <div><button className="btn small ghost" disabled={busy || s.paused} onClick={potluck}>{modifierLabels.potluck} (random −200…+200)</button></div>}
          {answered && s.flow !== 'independent' && <p className="success" role="status">Your answer is locked in. Waiting for the host to continue…</p>}
          {s.revealed && s.question.answerKey && <AnswerView kind={s.question.kind} payload={s.question.payload} answerKey={s.question.answerKey} />}
          {s.revealed && s.aggregate && s.aggregate.total > 0 && (
            <details open><summary>How the class answered (anonymous)</summary>
              <ul className="note">{s.question.payload.options?.map((o: any) => <li key={o.id}>{o.text}: {s.aggregate.counts[o.id] ?? 0} of {s.aggregate.total}</li>)}</ul></details>
          )}
        </section>
      )}

      {s.lastResult && s.status === 'active' && !s.finished && s.flow === 'independent' && s.currentIndex > 0 && (
        <p className={s.lastResult.timeout ? 'info' : s.lastResult.correct ? 'success' : 'error'} role="status">
          Previous question: {s.lastResult.timeout ? 'time ran out' : s.lastResult.correct ? 'correct' : 'not correct'}.
        </p>
      )}
      {flash && s.status === 'active' && <p className="success" role="status">{flash}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="sr-only" role="status" aria-live="polite">{flash ? announce.score(me?.points ?? 0, 0) : ''}</p>

      {s.status === 'ended' && (
        <section className="panel stack"><p className="eyebrow">Game over</p><h2>Your results</h2>
          {me && <p className="prompt">{set.showPoints ? `You scored ${me.points} points. ` : ''}{m.concepts > 0 ? `You got ${m.mastered} of ${m.concepts} questions right on the first try (${m.percent}%).` : ''}</p>}
          {!calm && set.showPodium && <div className="qz-side-art" style={{ marginBottom: 0 }}><Image src="/quiz/art/results-podium.svg" alt="" width={1600} height={520} unoptimized /></div>}
          {earned && earned.length > 0 && (
            <div className="stack" role="status"><h3>New items</h3>
              <ul className="row" style={{ listStyle: 'none', padding: 0 }}>{earned.map((e) => <li key={e.id} className="pill" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{e.id.includes('.') && !/^(border|nameplate|banner)\./.test(e.id) && <span aria-hidden style={{ width: 28, height: 28 }} dangerouslySetInnerHTML={{ __html: iconSvg(e.id, { size: 28 }) }} />}{e.name}</li>)}</ul>
              <Link className="btn small ghost" href="/quiz/collection">Open my collection</Link></div>
          )}
          {needsAccount && <p className="note">Items you earn are saved to an account. <Link href="/quiz/login">Create one</Link> if you want to keep them — this is optional.</p>}
          {mistakes.length > 0 ? (
            <div className="stack"><h3>Questions to look at again ({mistakes.length})</h3>
              {mistakes.map((r) => <div key={r.index} className="stack"><p><strong>{r.index + 1}. {r.prompt}</strong></p><AnswerView kind={s.review[r.index].kind} payload={s.review[r.index].payload} answerKey={s.review[r.index].answerKey} /></div>)}
              <p className="note">Next step: read the explanations above, then try the quiz again whenever you like. There is no need to play again right now.</p></div>
          ) : m.concepts > 0 ? <p className="success">No mistakes to review — nicely done.</p> : null}
          {set.showRank && !solo && <><h3>Standings</h3><ol className="scores" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{ranking.map((p: any, i: number) => <li key={p.id} className={`score ${p.id === s.selfId ? 'me' : ''}`}><strong>{i + 1}. {p.display_name}{p.id === s.selfId ? ' (you)' : ''}</strong><span className="pts">{p.points}</span><span className="note">points</span></li>)}</ol></>}
          {s.review && <details><summary>See every answer</summary>
            {s.review.map((r: any) => <div key={r.id} className="stack" style={{ marginTop: 14 }}><p><strong>{r.position + 1}. {r.prompt}</strong></p><AnswerView kind={r.kind} payload={r.payload} answerKey={r.answerKey} /></div>)}</details>}
          <div className="row"><Link className="btn" href="/quiz/library">Browse quizzes</Link><Link className="btn ghost" href="/quiz/join">Join another game</Link></div>
        </section>
      )}

      {!solo && s.status !== 'ended' && set.showRank && (
        <section className="panel"><h3>Scoreboard</h3>
          <div className="scores">{ranking.map((p: any, i: number) => <div key={p.id} className={`score ${p.id === s.selfId ? 'me' : ''}`}><strong>{i + 1}. {p.display_name}{p.id === s.selfId ? ' (you)' : ''}</strong><span className="pts">{p.points}</span></div>)}</div></section>
      )}
    </main>
  );
}
