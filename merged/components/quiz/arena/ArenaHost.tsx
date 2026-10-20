'use client';
/** Teacher console. Before the match: who joined, teams, roles and ready state; move or remove a device, lock the room, open the projector, show the join QR.
 *  During it: the phase clock with pause / skip / extend / end, how many answered (counts, not answers), a private peek at the answer, team scores and a live overview of the arena.
 *  After it: results with the learning review. Ending or pausing is never rate-limited. */
import { useState } from 'react';
import Link from 'next/link';
import { ArenaCanvas, ConnBadge, PHASE_LABEL, RevealPanel, fmt, mapName, useNow } from './ui';
import ArenaResults from './ArenaResults';
import Qr from './Qr';
import { RoleIcon, TeamBadge } from './icons';
import { ROLE_INFO, TEAM_COLORS } from './art';
import { usePrefs } from './prefs';
import { useArenaRemote } from './useArena';
import { api } from '@/lib/quiz/client';
import { FORMAT_COPY, HELPER_COPY } from '@/lib/quiz/arena/balance';
import type { HostAction } from '@/lib/quiz/arena/domain';

export default function ArenaHost({ roomId }: { roomId: string }) {
  const [prefs, , reduced] = usePrefs(); const client = useArenaRemote(roomId, 'host', { reduced }); const { snap } = client; const now = useNow(client.serverNow);
  const [msg, setMsg] = useState(''); const [screen, setScreen] = useState<string | null>(null); const [peek, setPeek] = useState(false); const [confirmEnd, setConfirmEnd] = useState(false);
  if (client.fatal) return <main className="ar narrow"><section className="ar-card"><h1>Can’t open this console</h1><p className="ar-why">{client.error}</p><Link className="ar-btn" href="/quiz/my">My quizzes</Link></section></main>;
  if (!snap) return <main className="ar"><p className="ar-note" role="status">Loading the match…</p></main>;
  const run = async (a: HostAction) => { const r = await client.host(a); setMsg(r.ok ? '' : r.message ?? 'That did not work.'); return r.ok; };
  const lobby = snap.phase === 'lobby'; const left = snap.phase === 'arena_live' ? (snap.live?.secondsLeft ?? 0) * 1000 : snap.deadlineMs !== null ? snap.deadlineMs - now : null; const seats = snap.seats;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/arena/join?code=${snap.room.code}` : '';
  const openScreen = async () => { try { const d = await api<{ url: string }>(`/api/quiz/arena/rooms/${roomId}/screen`, { method: 'POST', json: {} }); setScreen(d.url); window.open(d.url, '_blank', 'noopener'); } catch (e) { setMsg((e as Error).message); } };
  if (snap.phase === 'finished') return <div className="ar"><ArenaResults snap={snap} client={client} host /><p className="ar-note ar-center"><a href={`/api/quiz/arena/rooms/${roomId}/replay`}>Download the event log (JSON)</a></p></div>;
  const ready = seats.filter((s) => s.ready).length; const idle = snap.dots.filter((d) => d.idle).length;
  return (
    <div className="ar ar-host">
      <header className="ar-top">
        <div className="ar-title"><b>Arena Clash</b><span className="ar-chip">{FORMAT_COPY[snap.format].name} · {snap.teams.length} teams · {mapName(snap.mapId)}</span></div>
        <div className="ar-codebox"><span>Join at {joinUrl.replace(/^https?:\/\//, '').split('?')[0]} with code</span><b data-testid="ar-code">{snap.room.code}</b></div>
        <ConnBadge conn={client.conn} />
      </header>
      {msg && <p className="ar-toast err" role="alert">{msg} <button type="button" className="ar-x" onClick={() => setMsg('')} aria-label="Dismiss">×</button></p>}
      <section className="ar-card ar-controls" aria-label="Match controls">
        <div className="ar-clock"><span className="ar-phase">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span>{left !== null && snap.phase !== 'lobby' && <b>{fmt(left)}</b>}<span className="ar-note">Round {Math.min(snap.cycles, snap.cycle + 1)} of {snap.cycles}</span>{idle > 0 && snap.phase === 'arena_live' && <span className="ar-chip warn">{idle} away</span>}</div>
        <div className="ar-row wrap">
          {lobby && <button type="button" className="ar-btn primary big" data-testid="ar-start" disabled={client.busy || seats.length === 0} onClick={() => void run({ kind: 'start' })}>{ready === seats.length && seats.length ? 'Start the match' : `Start now (${ready}/${seats.length} ready)`}</button>}
          {!lobby && (snap.paused ? <button type="button" className="ar-btn primary" disabled={client.busy} onClick={() => void run({ kind: 'resume' })}>Resume</button> : <button type="button" className="ar-btn" disabled={client.busy} onClick={() => void run({ kind: 'pause' })}>Pause</button>)}
          {!lobby && <button type="button" className="ar-btn" disabled={client.busy || snap.paused} onClick={() => void run({ kind: 'skip' })}>Next phase</button>}
          {!lobby && <button type="button" className="ar-btn" disabled={client.busy} onClick={() => void run({ kind: 'extend' })} title="Adds one more question and round, if the quiz has an unused question">Add a round</button>}
          <button type="button" className="ar-btn" aria-pressed={snap.locked} disabled={client.busy} onClick={() => void run({ kind: 'lock', locked: !snap.locked })}>{snap.locked ? 'Room locked — unlock' : 'Lock the room'}</button>
          <button type="button" className="ar-btn" onClick={() => void openScreen()}>Open projector screen</button>
          {!lobby && (confirmEnd ? <span className="ar-row"><button type="button" className="ar-btn danger" disabled={client.busy} onClick={() => void run({ kind: 'end' }).then(() => setConfirmEnd(false))}>End the match now</button><button type="button" className="ar-btn ghost" onClick={() => setConfirmEnd(false)}>Keep playing</button></span> : <button type="button" className="ar-btn ghost" onClick={() => setConfirmEnd(true)}>End match…</button>)}
        </div>
        {snap.paused && <p className="ar-banner" role="status">Game paused. Students and the projector show a pause banner until you resume. The arena clock and every cooldown are frozen.</p>}
        {screen && <p className="ar-note">Projector link opened in a new tab. Opening a new one switches the old link off.</p>}
        <p className="ar-note">Scoring: quiz {Math.round(snap.quizWeight * 100)}% + arena {100 - Math.round(snap.quizWeight * 100)}%. The quiz always counts at least half.</p>
      </section>
      {lobby && <section className="ar-card ar-joincard"><div><h2>Students join here</h2><p className="ar-note">Scan the code or open the link and type <b>{snap.room.code}</b>. No account needed.</p><p className="ar-note">{seats.length} joined · {ready} ready · up to {snap.teams.length * snap.teamSizeCap} seats</p></div>{joinUrl && <Qr value={joinUrl} size={150} />}</section>}
      {['question_open', 'reveal'].includes(snap.phase) && snap.questionView && (
        <section className="ar-card"><h2>Question {Math.min(snap.cycles, snap.cycle + 1)} of {snap.cycles}</h2><p className="ar-prompt">{String(snap.questionView.prompt ?? '')}</p>
          {snap.question && <p className="ar-meter" aria-label={`${snap.question.answered} of ${snap.question.eligible} answered`}><span style={{ width: `${snap.question.eligible ? (snap.question.answered / snap.question.eligible) * 100 : 0}%` }} />{snap.question.answered} / {snap.question.eligible} answered</p>}
          {snap.phase === 'question_open' && <button type="button" className="ar-btn ghost small" aria-expanded={peek} onClick={() => setPeek(!peek)}>{peek ? 'Hide the answer' : 'Peek at the answer (only you see it)'}</button>}
          {(peek || snap.phase === 'reveal') && <RevealPanel snap={snap} />}
        </section>
      )}
      {!lobby && <section className="ar-card ar-overview"><ArenaCanvas client={client} mode="overview" prefs={prefs} reduced={reduced} label="Overview of the whole arena with every player" /></section>}
      <div className="ar-hostgrid">
        {snap.teams.map((t, i) => {
          const members = seats.filter((s) => s.teamId === t.id);
          return (
            <section key={t.id} className="ar-card ar-teamcard" style={{ ['--tm' as string]: TEAM_COLORS[i % 4] }}>
              <header><TeamBadge index={i} size={24} /><h2>{t.name}</h2></header>
              {!lobby && <p className="ar-stats"><span>Score {t.score}</span><span>Quiz {t.quiz ?? 0}%</span><span>Arena {Math.round(t.objective)} pts</span><span>{t.wallet ?? 0} points to spend</span><span>{t.captures} captures</span><span>{t.pulses} pulses</span></p>}
              {!lobby && <div className="ar-progress" role="img" aria-label={`Score ${t.score} of 1000`}><span style={{ width: `${t.score / 10}%` }} /></div>}
              {t.boost && <p className="ar-note">Active helper: {HELPER_COPY[t.boost].name}</p>}
              <ul className="ar-seats">
                {members.length === 0 && <li className="ar-note">Nobody yet.</li>}
                {members.map((s) => <SeatRow key={s.id} seat={s} teams={snap.teams} busy={client.busy} run={run} lobby={lobby} away={snap.dots.find((d) => d.id === s.id)?.idle ?? false} />)}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="ar-note ar-center"><a href={`/api/quiz/arena/rooms/${roomId}/replay`}>Event log (JSON)</a></p>
    </div>
  );
}
function SeatRow({ seat, teams, busy, lobby, run, away }: { seat: { id: string; name: string; teamId: string; role: keyof typeof ROLE_INFO; ready: boolean }; teams: { id: string; name: string }[]; busy: boolean; lobby: boolean; run: (a: HostAction) => Promise<boolean>; away: boolean }) {
  const [sure, setSure] = useState(false);
  return (
    <li>
      <RoleIcon role={seat.role} size={24} /><span className="who">{seat.name} · {ROLE_INFO[seat.role].name}{lobby && seat.ready ? ' ✓' : ''}{away ? ' · away' : ''}</span>
      {lobby && <><label className="ar-sr" htmlFor={`mv-${seat.id}`}>Move {seat.name}</label>
        <select id={`mv-${seat.id}`} value={seat.teamId} disabled={busy} onChange={(e) => void run({ kind: 'move_seat', seatId: seat.id, teamId: e.target.value })}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></>}
      {sure ? <><button type="button" className="ar-btn small danger" disabled={busy} onClick={() => void run({ kind: 'kick', seatId: seat.id })}>Remove</button><button type="button" className="ar-btn small ghost" onClick={() => setSure(false)}>Cancel</button></>
        : <button type="button" className="ar-btn small ghost" onClick={() => setSure(true)} aria-label={`Remove ${seat.name}`}>Remove…</button>}
    </li>
  );
}
