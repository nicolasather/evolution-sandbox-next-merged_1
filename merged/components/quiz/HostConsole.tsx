'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/quiz/client';
import QuestionPlay from './QuestionPlay';
import QuestionDisplay from './QuestionDisplay';
import AnswerView from './AnswerView';
import { fmtClock, useRoomState, useTick } from './useRoomState';
import { modifierDescriptions, modifierLabels, type Modifier } from '@/lib/quiz/types';
import { iconSvg } from '@/lib/quiz/cosmetics/catalog';

const INSTANT: Modifier[] = ['lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points', 'potluck'];
const NEEDS_OTHER: Modifier[] = ['steal_points', 'give_points', 'swap_points'];
const NEEDS_AMOUNT: Modifier[] = ['steal_points', 'give_points'];
const TARGET_LABEL: Record<string, [string, string]> = {
  steal_points: ['Thief (gains points)', 'Victim (loses points)'],
  give_points: ['Giver (loses points)', 'Receiver (gains points)'],
  swap_points: ['First', 'Second'],
};

export default function HostConsole({ roomId, projectorOnly = false }: { roomId: string; projectorOnly?: boolean }) {
  const [peek, setPeek] = useState(false);
  const { state: s, error: pollError, fatal, refresh, serverNow } = useRoomState(roomId, { host: true, peek: peek && !projectorOnly, ready: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [team, setTeam] = useState('');
  const [marking, setMarking] = useState<'auto' | 'correct' | 'incorrect'>('auto');
  const [wager, setWager] = useState(0);
  const [projectorState, setProjector] = useState(false);
  const projector = projectorOnly || projectorState;
  const [adjTarget, setAdjTarget] = useState('');
  const [adjDelta, setAdjDelta] = useState(100);
  const [adjReason, setAdjReason] = useState('');
  const [modKind, setModKind] = useState<Modifier>('potluck');
  const [target, setTarget] = useState('');
  const [other, setOther] = useState('');
  const [amount, setAmount] = useState(100);
  const [stealTo, setStealTo] = useState('');
  useTick(250);
  useEffect(() => { if (s && !team) setTeam(s.teams?.[0]?.id ?? ''); }, [s, team]);

  if (fatal) return <main className="narrow"><section className="panel stack"><h1>Can’t open this room</h1><p className="error">{pollError}</p><Link className="btn" href="/quiz/my">My Quizzes</Link></section></main>;
  if (!s) return <main className="page"><p className="muted-text">{pollError || 'Loading room…'}</p></main>;

  const classroom = s.mode === 'classroom';
  const actors: any[] = classroom ? s.teams : s.players;
  const mods: Modifier[] = s.config.modifiers;
  const instant = mods.filter((m) => INSTANT.includes(m));
  const roundRobin = s.flow === 'round_robin';
  const eligible: any[] = classroom
    ? roundRobin ? s.teams.filter((t: any, i: number) => i === s.turnIndex || (s.stealActive && s.stealTarget === t.id)) : s.teams
    : [];
  const activeTeam = eligible.find((t) => t.id === team) ?? eligible[0];
  const hasAnswered = (id?: string) => !!id && s.answeredActors.includes(id);
  const now = s.paused && s.pausedAt ? Date.parse(s.pausedAt) : serverNow();
  const matchLeft = s.expiresAt ? (Date.parse(s.expiresAt) - now) / 1000 : null;
  const qLeft = s.config.questionSeconds && s.questionOpenedAt && s.flow !== 'independent' ? (Date.parse(s.questionOpenedAt) + s.config.questionSeconds * 1000 - now) / 1000 : null;
  const ranking = [...actors].sort((a, b) => (classroom ? 0 : b.points - a.points));
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/join?code=${s.code}` : '';
  const slotLimit = s.config.slotLimit;
  const kind = modKind && instant.includes(modKind) ? modKind : instant[0];

  async function run<T>(fn: () => Promise<T>, ok?: (r: T) => string) {
    setBusy(true); setError('');
    try { const r = await fn(); if (ok) setNotice(ok(r)); await refresh(); } catch (e) { setError((e as Error).message); throw e; } finally { setBusy(false); }
  }
  const control = (action: string) => run(() => api(`/api/quiz/rooms/${roomId}/control`, { method: 'POST', json: { action } }).catch((e) => { throw e; })).catch(() => {});
  const grade = (body: Record<string, unknown>) => run(() => api<{ correct: boolean; awarded: number }>(`/api/quiz/rooms/${roomId}/submit`, { method: 'POST', json: { roomQuestionId: s.question.id, actorId: activeTeam?.id, wager, ...body } }), (d) => `${activeTeam?.display_name}: ${d.correct ? 'correct' : 'incorrect'} (${d.awarded >= 0 ? '+' : ''}${d.awarded} points)`);

  return (
    <main className={`page ${projector ? 'projector' : ''}`} id="main">
      <header className="page-header">
        <div>
          <p className="eyebrow">{classroom ? 'Teacher · classroom projector' : 'Host · online room'} · {s.flow.replace('_', ' ')} · {s.status}{s.paused ? ' · paused' : ''}</p>
          <h1>Classic Quiz</h1>
          {!classroom && s.status !== 'ended' && <p>Players join at <strong>{joinUrl.replace(/^https?:\/\//, '').split('?')[0]}</strong> with code <span className="code">{s.code}</span></p>}
        </div>
        <div className="row">
          {matchLeft !== null && s.status === 'active' && <span className={`timer ${matchLeft < 30 ? 'low' : ''}`} aria-label="Match time left">Match {fmtClock(matchLeft)}</span>}
          {qLeft !== null && s.status === 'active' && !s.revealed && <span className={`timer ${qLeft < 8 ? 'low' : ''}`} aria-label="Question time left">Q {fmtClock(qLeft)}</span>}
          {!projectorOnly && <button className="btn small ghost" onClick={() => setProjector((v) => !v)}>{projector ? 'Teacher view' : 'Projector view'}</button>}
          {!projectorOnly && <button className="btn small ghost" onClick={() => window.open(`/quiz/projector/${roomId}`, 'qz-projector', 'popup,width=1280,height=720')}>Open projector window</button>}
          <button className="btn small ghost" onClick={() => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()); }}>Fullscreen</button>
        </div>
      </header>

      {!projectorOnly && <section className="panel">
        <div className="row">
          <button className="btn" disabled={busy || s.status !== 'waiting'} onClick={() => control('start')}>Start Game</button>
          <button className="btn ghost" disabled={busy || s.status !== 'active'} onClick={() => control(s.paused ? 'resume' : 'pause')}>{s.paused ? 'Resume' : 'Pause'}</button>
          <button className="btn ghost" disabled={busy || s.status !== 'active' || s.paused || s.revealed || s.flow === 'independent'} onClick={() => control('reveal')}>Reveal answer</button>
          <button className="btn ghost" disabled={busy || s.status !== 'active' || s.paused || s.flow === 'independent'} onClick={() => control('next')}>{s.currentIndex + 1 >= s.questionCount ? 'Finish game' : classroom && roundRobin ? 'Next question & turn' : 'Next question'}</button>
          <button className="btn ghost" title="Show the same question again with a fresh timer" disabled={busy || s.status !== 'active' || s.paused || s.flow === 'independent'} onClick={() => { if (confirm('Show this question again with a new timer? Teams that already answered keep their answer.')) void control('replay'); }}>Replay question</button>
          <button className="btn ghost" title="Move on without discussing this question" disabled={busy || s.status !== 'active' || s.paused || s.flow === 'independent' || s.currentIndex + 1 >= s.questionCount} onClick={() => { if (confirm('Skip to the next question?')) void control('skip'); }}>Skip</button>
          <button className="btn danger" disabled={busy || s.status === 'ended'} onClick={() => { if (confirm('End the game for everyone now? Results are kept.')) void control('end'); }}>End Game</button>
          <button className="btn danger" disabled={busy || s.status === 'ended'} onClick={() => { if (confirm('Cancel this game? It ends immediately and is marked as cancelled.')) void control('cancel'); }}>Cancel</button>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Every control is written to the game’s audit log.</p>
        {s.status === 'active' && s.flow !== 'independent' && <p className="note" style={{ marginTop: 10 }}>Question {s.currentIndex + 1} of {s.questionCount}{s.revealed ? ' · answer revealed' : ''}</p>}
        {s.flow === 'independent' && s.status === 'active' && <p className="note" style={{ marginTop: 10 }}>Independent flow: each player progresses on their own. You control the match (pause, end).</p>}
      </section>}

      {!projectorOnly && !classroom && (s.pendingPlayers?.length ?? 0) > 0 && (
        <section className="panel stack" aria-labelledby="pend-h"><h2 id="pend-h">Waiting to join ({s.pendingPlayers.length})</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>{s.pendingPlayers.map((p: any) => (
            <li key={p.id} className="row" style={{ alignItems: 'center' }}><strong>{p.display_name}</strong>
              <button className="btn small" disabled={busy} onClick={() => run(() => api(`/api/quiz/rooms/${roomId}/moderate`, { method: 'POST', json: { playerId: p.id, action: 'approve' } }), () => `${p.display_name} approved.`).catch(() => {})}>Let in</button>
              <button className="btn small ghost" disabled={busy} onClick={() => run(() => api(`/api/quiz/rooms/${roomId}/moderate`, { method: 'POST', json: { playerId: p.id, action: 'remove' } }), () => `${p.display_name} removed.`).catch(() => {})}>Decline</button></li>))}</ul></section>
      )}

      <section className="panel stack">
        <h2>{classroom ? 'Teams' : `Players (${s.players.length})`}</h2>
        {actors.length === 0 ? <p className="muted-text">Waiting for players to join with the code above…</p> : (
          <div className="scores">{ranking.map((a: any, i: number) => (
            <div key={a.id} className={`score ${classroom && roundRobin && i === s.turnIndex && s.status === 'active' ? 'turn' : ''}`}>
              <strong>{a.identity?.icon && <span aria-hidden style={{ display: 'inline-block', width: 26, height: 26, verticalAlign: 'middle', marginRight: 6 }} dangerouslySetInnerHTML={{ __html: iconSvg(a.identity.icon, { size: 26 }) }} />}{a.display_name}</strong><span className="pts">{a.points}</span>
              {!projector && !classroom && s.status !== 'ended' && (
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn small ghost" aria-label={`Remove ${a.display_name}`} onClick={() => { if (confirm(`Remove ${a.display_name} from this game?`)) void run(() => api(`/api/quiz/rooms/${roomId}/moderate`, { method: 'POST', json: { playerId: a.id, action: 'remove' } }), () => `${a.display_name} removed.`).catch(() => {}); }}>Remove</button>
                  <button className="btn small danger" aria-label={`Ban ${a.display_name}`} onClick={() => { if (confirm(`Ban ${a.display_name}? They cannot rejoin this room.`)) void run(() => api(`/api/quiz/rooms/${roomId}/moderate`, { method: 'POST', json: { playerId: a.id, action: 'ban' } }), () => `${a.display_name} banned.`).catch(() => {}); }}>Ban</button>
                </span>)}
              {classroom && roundRobin && i === s.turnIndex && s.status === 'active' && <small className="note">Their turn</small>}
              {classroom && s.stealActive && s.stealTarget === a.id && <small className="note">Steal chance</small>}
              {s.status === 'active' && s.flow !== 'independent' && hasAnswered(a.id) && <small className="note">Answered</small>}
              {!classroom && s.flow === 'independent' && <small className="note">on question {Math.min(a.cursor_index + 1, s.questionCount)}</small>}
            </div>
          ))}</div>
        )}
      </section>

      {s.question && s.flow !== 'independent' && (
        <section className="panel stack pop" key={s.question.id}>
          {s.status === 'waiting' ? <p className="muted-text">The first question appears when you press Start.</p> : <QuestionDisplay q={s.question} />}
          {s.revealed && s.question.answerKey && <AnswerView kind={s.question.kind} payload={s.question.payload} answerKey={s.question.answerKey} />}
          {!projector && s.status === 'active' && s.results?.length > 0 && (
            <p className="note" role="status">Host only — {s.results.filter((r: any) => r.correct).length} of {s.results.length} answers correct so far ({Math.round((s.results.filter((r: any) => r.correct).length / s.results.length) * 100)}%).
              {s.results.length >= 3 && s.results.filter((r: any) => r.correct).length / s.results.length < 0.5 && ' Fewer than half got it — consider explaining before moving on.'}</p>
          )}
          {s.revealed && s.aggregate && s.aggregate.total > 0 && s.question.payload.options && (
            <div className="stack" aria-label="How the class answered">
              {s.question.payload.options.map((o: any) => <div key={o.id} className="row" style={{ alignItems: 'center', flexWrap: 'nowrap' }}><span style={{ flex: '0 0 40%' }}>{o.text}</span><div aria-hidden style={{ flex: 1, background: 'var(--qz-field)', height: 14, borderRadius: 4 }}><div style={{ width: `${Math.round(((s.aggregate.counts[o.id] ?? 0) / s.aggregate.total) * 100)}%`, height: '100%', background: s.question.answerKey?.correctIds?.includes(o.id) ? 'var(--qz-success)' : 'var(--qz-cyan)', borderRadius: 4 }} /></div><span className="note">{s.aggregate.counts[o.id] ?? 0}</span></div>)}
            </div>
          )}
          {mods.includes('limited_slots') && <p className="note">Answer slots used: {s.answeredActors.length} / {slotLimit}</p>}
          {!classroom && s.status === 'active' && <p className="note">{s.answeredActors.length} of {s.players.length} players have answered.</p>}
        </section>
      )}

      {!projector && s.status !== 'ended' && s.question && s.flow !== 'independent' && (
        <section className="panel stack">
          <h2>Teacher notes</h2>
          <label className="inline"><input type="checkbox" checked={peek} onChange={(e) => setPeek(e.target.checked)} /> Show me the answer key (also appears on a projected screen)</label>
          {peek && !s.revealed && s.question.answerKey && <AnswerView kind={s.question.kind} payload={s.question.payload} answerKey={s.question.answerKey} />}
        </section>
      )}

      {!projector && classroom && s.status === 'active' && s.question && (
        <section className="panel stack">
          <h2>{roundRobin ? 'Current turn' : 'Grade a team'}</h2>
          {eligible.length === 0 ? <p className="note">No team is eligible right now.</p> : (
            <>
              <label>Team answering
                <select value={activeTeam?.id ?? ''} onChange={(e) => setTeam(e.target.value)}>
                  {eligible.map((t: any) => <option key={t.id} value={t.id}>{t.display_name}{hasAnswered(t.id) ? ' (already answered)' : ''}</option>)}
                </select></label>
              {mods.includes('secret_wager') && <label>Team’s secret wager (max {activeTeam?.points ?? 0})<input type="number" min={0} max={activeTeam?.points ?? 0} value={wager} onChange={(e) => setWager(Math.max(0, Math.min(activeTeam?.points ?? 0, Number(e.target.value) || 0)))} /></label>}
              <div className="row">
                <button className="btn" disabled={busy || !activeTeam || s.paused || s.revealed || hasAnswered(activeTeam?.id)} onClick={() => grade({ override: true })}>Spoken answer was correct</button>
                <button className="btn danger" disabled={busy || !activeTeam || s.paused || s.revealed || hasAnswered(activeTeam?.id)} onClick={() => grade({ override: false })}>Spoken answer was wrong</button>
              </div>
              <details><summary>Enter the team’s written answer instead (checked automatically)</summary>
                <div className="stack" style={{ marginTop: 12 }}>
                  <label>If the automatic check is wrong, override it
                    <select value={marking} onChange={(e) => setMarking(e.target.value as any)}><option value="auto">Use the automatic result</option><option value="correct">Teacher marks correct</option><option value="incorrect">Teacher marks incorrect</option></select></label>
                  <QuestionPlay key={`${s.question.id}:${activeTeam?.id}`} question={s.question} busy={busy} disabled={s.paused || s.revealed || !activeTeam || hasAnswered(activeTeam?.id)} submitLabel="Check & score this answer"
                    onSubmit={(response) => grade({ response, ...(marking !== 'auto' ? { override: marking === 'correct' } : {}) })} />
                </div></details>
            </>
          )}
          {mods.includes('steal_question') && (
            <div className="stack">
              <h3>Steal the Question</h3><p className="note">{modifierDescriptions.steal_question}</p>
              <div className="row">
                <select aria-label="Team that gets the question" style={{ maxWidth: 260 }} value={stealTo} onChange={(e) => setStealTo(e.target.value)}><option value="">Choose a team…</option>{s.teams.map((t: any) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select>
                <button className="btn ghost" disabled={busy || !stealTo || s.paused || s.revealed} onClick={() => run(() => api(`/api/quiz/rooms/${roomId}/modifier`, { method: 'POST', json: { kind: 'steal_question', target: stealTo } }), () => 'Question handed over for one try.').catch(() => {})}>Give them the question</button>
              </div>
            </div>
          )}
        </section>
      )}

      {!projector && s.status !== 'waiting' && actors.length > 0 && (
        <section className="panel stack" aria-labelledby="adj-h">
          <h2 id="adj-h">Correct a score</h2>
          <p className="note">Add or take away points with a reason. It appears on the score list right away and is saved in the audit log.</p>
          <div className="grid2">
            <label>Who<select value={adjTarget} onChange={(e) => setAdjTarget(e.target.value)}><option value="">Choose…</option>{actors.map((a: any) => <option key={a.id} value={a.id}>{a.display_name} ({a.points})</option>)}</select></label>
            <label>Points (negative to take away)<input type="number" min={-10000} max={10000} value={adjDelta} onChange={(e) => setAdjDelta(Math.max(-10000, Math.min(10000, Math.trunc(Number(e.target.value) || 0))))} /></label>
          </div>
          <label>Reason (required)<input value={adjReason} maxLength={200} onChange={(e) => setAdjReason(e.target.value)} placeholder="For example: answered correctly out loud" /></label>
          <div><button className="btn ghost" disabled={busy || !adjTarget || !adjDelta || adjReason.trim().length < 3} onClick={() => run(() => api<{ newPoints: number }>(`/api/quiz/rooms/${roomId}/adjust`, { method: 'POST', json: { actorType: classroom ? 'team' : 'player', actorId: adjTarget, delta: adjDelta, reason: adjReason.trim() } }), (d) => `Score updated to ${d.newPoints}.`).then(() => setAdjReason('')).catch(() => {})}>Apply correction</button>
            <span className="note"> Use “Undo latest score change” below to reverse the most recent event.</span></div>
        </section>
      )}

      {!projector && s.status === 'active' && (instant.length > 0 || true) && (
        <section className="panel stack">
          <h2>Point events</h2>
          {instant.length === 0 ? <p className="note">No instant point modifiers were selected for this game.</p> : kind && (
            <>
              <label>Modifier<select value={kind} onChange={(e) => setModKind(e.target.value as Modifier)}>{instant.map((m) => <option key={m} value={m}>{modifierLabels[m]}</option>)}</select></label>
              <p className="note">{modifierDescriptions[kind]}</p>
              <div className="grid2">
                <label>{TARGET_LABEL[kind]?.[0] ?? 'Target'}<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose…</option>{actors.map((a: any) => <option key={a.id} value={a.id}>{a.display_name} ({a.points})</option>)}</select></label>
                {NEEDS_OTHER.includes(kind) && <label>{TARGET_LABEL[kind]![1]}<select value={other} onChange={(e) => setOther(e.target.value)}><option value="">Choose…</option>{actors.filter((a: any) => a.id !== target).map((a: any) => <option key={a.id} value={a.id}>{a.display_name} ({a.points})</option>)}</select></label>}
                {NEEDS_AMOUNT.includes(kind) && <label>Up to how many points<input type="number" min={1} max={10000} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} /></label>}
              </div>
              <div className="row">
                <button className="btn" disabled={busy || !target || (NEEDS_OTHER.includes(kind) && !other)} onClick={() => run(() => api<{ change: number }>(`/api/quiz/rooms/${roomId}/modifier`, { method: 'POST', json: { kind, target, other: other || undefined, amount, confirmed: !s.config.fairPlay || confirm(`Use ${modifierLabels[kind]} now? This changes points and is limited by the fair-play rules.`) } }), (d) => `${modifierLabels[kind]} applied (${d.change >= 0 ? '+' : ''}${d.change} to the first).`).catch(() => {})}>Apply {modifierLabels[kind]}</button>
              </div>
            </>
          )}
          <div><button className="btn ghost" disabled={busy} onClick={() => run(() => api(`/api/quiz/rooms/${roomId}/modifier`, { method: 'POST', json: { kind: 'undo' } }), () => 'Latest score change was reversed.').catch(() => {})}>Undo latest score change</button>
            <span className="note"> Reverses the most recent score event (an answer award or a point event).</span></div>
        </section>
      )}

      {s.status === 'ended' && (
        <section className="panel stack"><p className="eyebrow">Game over</p><h2>Final scores</h2>
          <div className="qz-side-art" style={{ marginBottom: 0 }}><Image src="/quiz/art/results-podium.svg" alt="" width={1600} height={520} unoptimized /></div>
          <ol className="scores" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{[...actors].sort((a, b) => b.points - a.points).map((a: any, i: number) => <li key={a.id} className="score"><strong>{i + 1}. {a.display_name}</strong><span className="pts">{a.points}</span><span className="note">points</span></li>)}</ol>
          {s.review && <details><summary>Answer review</summary>{s.review.map((r: any) => <div key={r.id} className="stack" style={{ marginTop: 12 }}><p><strong>{r.position + 1}. {r.prompt}</strong></p><AnswerView kind={r.kind} payload={r.payload} answerKey={r.answerKey} /></div>)}</details>}
          <div className="row">
            {!projectorOnly && <button className="btn cyan" disabled={busy} onClick={() => { void api<{ roomId: string }>(`/api/quiz/rooms/${roomId}/replay`, { method: 'POST', json: {} }).then((d) => { window.location.href = `/quiz/host/${d.roomId}`; }).catch((e) => setError((e as Error).message)); }}>Play again (same settings, new order)</button>}
            {!projectorOnly && <Link className="btn" href={`/quiz/report/${roomId}`}>Full report</Link>}
            <Link className="btn ghost" href="/quiz/my">My Quizzes</Link><Link className="btn ghost" href="/quiz/library">Quiz Library</Link>
          </div>
        </section>
      )}

      {notice && <p className="success" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}
