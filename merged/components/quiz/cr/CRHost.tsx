'use client';
/** Teacher console. Before the race: who joined, teams, roles and ready state; move or remove a device, lock the room, open the projector, show the join QR.
 *  During it: the phase clock with pause / skip / extend / end, how many answered (counts, not answers), a private peek at the answer key, team scores and a live overview map.
 *  After it: results with the learning review. Ending or pausing is never rate-limited. */
import { useState } from 'react';
import Link from 'next/link';
import { CRCanvas, ConnBadge, PHASE_LABEL, RevealPanel, fmt, mapName, useNow } from './ui';
import CRResults from './CRResults';
import Qr from './Qr';
import { RoleIcon, TeamBadge } from './icons';
import { ROLE_INFO, TEAM_COLORS } from './art';
import { usePrefs } from './prefs';
import { useCRRemote } from './useCR';
import { api } from '@/lib/quiz/client';
import { FORMAT_COPY } from '@/lib/quiz/cr/balance';
import type { HostAction } from '@/lib/quiz/cr/domain';

export default function CRHost({ roomId }: { roomId: string }) {
  const [prefs, , reduced] = usePrefs(); const client = useCRRemote(roomId, 'host', { reduced }); const { snap } = client; const now = useNow(client.serverNow);
  const [msg, setMsg] = useState(''); const [screen, setScreen] = useState<string | null>(null); const [peek, setPeek] = useState(false); const [confirmEnd, setConfirmEnd] = useState(false);
  if (client.fatal) return <main className="cr narrow"><section className="cr-card"><h1>Can’t open this console</h1><p className="cr-why">{client.error}</p><Link className="cr-btn" href="/quiz/my">My quizzes</Link></section></main>;
  if (!snap) return <main className="cr"><p className="cr-note" role="status">Loading the race…</p></main>;
  const run = async (a: HostAction) => { const r = await client.host(a); setMsg(r.ok ? '' : r.message ?? 'That did not work.'); return r.ok; };
  const lobby = snap.phase === 'lobby'; const left = snap.phase === 'race' ? (snap.live?.secondsLeft ?? 0) * 1000 : snap.deadlineMs !== null ? snap.deadlineMs - now : null; const seats = snap.seats;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/cr/join?code=${snap.room.code}` : '';
  const openScreen = async () => { try { const d = await api<{ url: string }>(`/api/quiz/clue/rooms/${roomId}/screen`, { method: 'POST', json: {} }); setScreen(d.url); window.open(d.url, '_blank', 'noopener'); } catch (e) { setMsg((e as Error).message); } };
  if (snap.phase === 'finished') return <div className="cr"><CRResults snap={snap} client={client} host /><p className="cr-note cr-center"><a href={`/api/quiz/clue/rooms/${roomId}/replay`}>Download the event log (JSON)</a></p></div>;
  const ready = seats.filter((s) => s.ready).length; const idle = snap.dots.filter((d) => d.idle).length;
  return (
    <div className="cr cr-host">
      <header className="cr-top">
        <div className="cr-title"><b>Clue Racing</b><span className="cr-chip">{FORMAT_COPY[snap.format].name} · {snap.teams.length} teams · {mapName(snap.mapId)}</span></div>
        <div className="cr-codebox"><span>Join at {joinUrl.replace(/^https?:\/\//, '').split('?')[0]} with code</span><b data-testid="cr-code">{snap.room.code}</b></div>
        <ConnBadge conn={client.conn} />
      </header>
      {msg && <p className="cr-toast err" role="alert">{msg} <button type="button" className="cr-x" onClick={() => setMsg('')} aria-label="Dismiss">×</button></p>}
      <section className="cr-card cr-controls" aria-label="Race controls">
        <div className="cr-clock"><span className="cr-phase">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span>{left !== null && snap.phase !== 'lobby' && <b>{fmt(left)}</b>}<span className="cr-note">Leg {Math.min(snap.legs, snap.leg + 1)} of {snap.legs}</span>{idle > 0 && snap.phase === 'race' && <span className="cr-chip warn">{idle} away</span>}</div>
        <div className="cr-row wrap">
          {lobby && <button type="button" className="cr-btn primary big" data-testid="cr-start" disabled={client.busy || seats.length === 0} onClick={() => void run({ kind: 'start' })}>{ready === seats.length && seats.length ? 'Start the race' : `Start now (${ready}/${seats.length} ready)`}</button>}
          {!lobby && (snap.paused ? <button type="button" className="cr-btn primary" disabled={client.busy} onClick={() => void run({ kind: 'resume' })}>Resume</button> : <button type="button" className="cr-btn" disabled={client.busy} onClick={() => void run({ kind: 'pause' })}>Pause</button>)}
          {!lobby && <button type="button" className="cr-btn" disabled={client.busy || snap.paused} onClick={() => void run({ kind: 'skip' })}>Next phase</button>}
          {!lobby && <button type="button" className="cr-btn" disabled={client.busy} onClick={() => void run({ kind: 'extend' })} title="Adds time to the current phase (at most four times)">Add time</button>}
          <button type="button" className="cr-btn" aria-pressed={snap.locked} disabled={client.busy} onClick={() => void run({ kind: 'lock', locked: !snap.locked })}>{snap.locked ? 'Room locked — unlock' : 'Lock the room'}</button>
          <button type="button" className="cr-btn" onClick={() => void openScreen()}>Open projector screen</button>
          {!lobby && (confirmEnd ? <span className="cr-row"><button type="button" className="cr-btn danger" disabled={client.busy} onClick={() => void run({ kind: 'end' }).then(() => setConfirmEnd(false))}>End the race now</button><button type="button" className="cr-btn ghost" onClick={() => setConfirmEnd(false)}>Keep racing</button></span> : <button type="button" className="cr-btn ghost" onClick={() => setConfirmEnd(true)}>End race…</button>)}
        </div>
        {snap.paused && <p className="cr-banner" role="status">Race paused. Students and the projector show a pause banner until you resume. World time and every ability rest are frozen.</p>}
        {screen && <p className="cr-note">Projector link opened in a new tab. Opening a new one switches the old link off.</p>}
        <p className="cr-note">Scoring: quiz mastery 60% + route 25% + teamwork 15%. Speed is never rewarded; ties are shown as ties.</p>
      </section>
      {lobby && <section className="cr-card cr-joincard"><div><h2>Students join here</h2><p className="cr-note">Scan the code or open the link and type <b>{snap.room.code}</b>. No account needed.</p><p className="cr-note">{seats.length} joined · {ready} ready · up to {snap.teams.length * snap.teamSizeCap} seats</p></div>{joinUrl && <Qr value={joinUrl} size={150} />}</section>}
      {['barrier', 'reveal'].includes(snap.phase) && snap.questionView && (
        <section className="cr-card"><h2>Question {Math.min(snap.windows, (snap.question?.window ?? 0) + 1)} of {snap.windows}</h2><p className="cr-prompt">{String(snap.questionView.prompt ?? '')}</p>
          {snap.question && <p className="cr-meter" aria-label={`${snap.question.answered} of ${snap.question.eligible} answered`}><span style={{ width: `${snap.question.eligible ? (snap.question.answered / snap.question.eligible) * 100 : 0}%` }} />{snap.question.answered} / {snap.question.eligible} answered</p>}
          {snap.phase === 'barrier' && <button type="button" className="cr-btn ghost small" aria-expanded={peek} onClick={() => setPeek(!peek)}>{peek ? 'Hide the answer' : 'Peek at the answer (only you see it)'}</button>}
          {(peek || snap.phase === 'reveal') && <RevealPanel snap={snap} />}
        </section>
      )}
      {snap.hostKey && !lobby && <section className="cr-card cr-key"><h2>Answer key for leg {snap.hostKey.leg + 1}</h2><p>{snap.hostKey.answer}</p><p className="cr-note">Only this console sees it. Students and the projector never receive it.</p></section>}
      {!lobby && <section className="cr-card cr-overview"><CRCanvas client={client} mode="overview" prefs={prefs} reduced={reduced} label="Overview of the current leg with every player" /></section>}
      <div className="cr-hostgrid">
        {snap.teams.map((t, i) => {
          const members = seats.filter((s) => s.teamId === t.id);
          return (
            <section key={t.id} className="cr-card cr-teamcard" style={{ ['--tm' as string]: TEAM_COLORS[i % 4] }}>
              <header><TeamBadge index={i} size={24} /><h2>{t.name}</h2></header>
              {!lobby && <p className="cr-stats"><span>Score {t.score}</span><span>Mastery {t.mastery ?? 0}%</span><span>Route {Math.round(t.route / 10)}%</span><span>{t.wallet ?? 0} points to spend</span><span>{t.legsDone} legs done{t.assisted ? ' · guide assist' : ''}</span></p>}
              {!lobby && <div className="cr-progress" role="img" aria-label={`Score ${t.score} of 1000`}><span style={{ width: `${t.score / 10}%` }} /></div>}
              {t.perks && t.perks.length > 0 && <p className="cr-note">Active perks: {t.perks.join(', ')}</p>}
              <ul className="cr-seats">
                {members.length === 0 && <li className="cr-note">Nobody yet.</li>}
                {members.map((s) => <SeatRow key={s.id} seat={s} teams={snap.teams} busy={client.busy} run={run} lobby={lobby} away={snap.dots.find((d) => d.id === s.id)?.idle ?? false} />)}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="cr-note cr-center"><a href={`/api/quiz/clue/rooms/${roomId}/replay`}>Event log (JSON)</a></p>
    </div>
  );
}
function SeatRow({ seat, teams, busy, lobby, run, away }: { seat: { id: string; name: string; teamId: string; role: keyof typeof ROLE_INFO; ready: boolean }; teams: { id: string; name: string }[]; busy: boolean; lobby: boolean; run: (a: HostAction) => Promise<boolean>; away: boolean }) {
  const [sure, setSure] = useState(false);
  return (
    <li>
      <RoleIcon role={seat.role} size={24} /><span className="who">{seat.name} · {ROLE_INFO[seat.role].name}{lobby && seat.ready ? ' ✓' : ''}{away ? ' · away' : ''}</span>
      {lobby && <><label className="cr-sr" htmlFor={`mv-${seat.id}`}>Move {seat.name}</label>
        <select id={`mv-${seat.id}`} value={seat.teamId} disabled={busy} onChange={(e) => void run({ kind: 'move_seat', seatId: seat.id, teamId: e.target.value })}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></>}
      {sure ? <><button type="button" className="cr-btn small danger" disabled={busy} onClick={() => void run({ kind: 'kick', seatId: seat.id })}>Remove</button><button type="button" className="cr-btn small ghost" onClick={() => setSure(false)}>Cancel</button></>
        : <button type="button" className="cr-btn small ghost" onClick={() => setSure(true)} aria-label={`Remove ${seat.name}`}>Remove…</button>}
    </li>
  );
}
