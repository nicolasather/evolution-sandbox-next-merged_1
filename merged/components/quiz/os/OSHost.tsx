'use client';
/** Teacher console. Before the match: who joined, squads, roles and ready state; move or remove a device, lock the room, open the projector.
 *  During it: the phase clock with pause / skip / end, how many answered (counts, not answers), a private peek at the answer, squad progress and a live overview of the course.
 *  After it: results with the learning review. Ending or pausing is never rate-limited. */
import { useCallback, useState } from 'react';
import Link from 'next/link';
import World from './World';
import OSResults from './OSResults';
import { ConnBadge, PHASE_LABEL, RevealPanel, fmt, useNow } from './parts';
import { ROLE_INFO, RoleIcon, TEAM_COLORS, TEAM_MARK } from './art';
import { usePrefs } from './prefs';
import { useOSRemote } from './useOS';
import { api } from '@/lib/quiz/client';
import { MAP_INFO } from '@/lib/quiz/os/course';
import { PERK_COPY } from '@/lib/quiz/os/balance';
import type { HostAction } from '@/lib/quiz/os/domain';

export default function OSHost({ roomId }: { roomId: string }) {
  const client = useOSRemote(roomId, 'host'); const { snap } = client; const now = useNow(client.serverNow); const [, , reduced] = usePrefs();
  const [msg, setMsg] = useState(''); const [screen, setScreen] = useState<string | null>(null); const [peek, setPeek] = useState(false); const [confirmEnd, setConfirmEnd] = useState(false);
  const getFrame = useCallback(() => client.frame(), [client]);
  if (client.fatal) return <main className="os narrow"><section className="os-card"><h1>Can’t open this console</h1><p className="os-why">{client.error}</p><Link className="os-btn" href="/quiz/my">My quizzes</Link></section></main>;
  if (!snap) return <main className="os"><p className="os-note" role="status">Loading the match…</p></main>;
  const run = async (a: HostAction) => { const r = await client.host(a); setMsg(r.ok ? '' : r.message ?? 'That did not work.'); return r.ok; };
  const lobby = snap.phase === 'lobby'; const left = snap.deadlineMs !== null ? snap.deadlineMs - now : null; const seats = snap.seats; const mapName = MAP_INFO.find((m) => m.id === snap.course.mapId)?.name ?? '';
  const openScreen = async () => { try { const d = await api<{ url: string }>(`/api/quiz/os/rooms/${roomId}/screen`, { method: 'POST', json: {} }); setScreen(d.url); window.open(d.url, '_blank', 'noopener'); } catch (e) { setMsg((e as Error).message); } };
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/os/join` : '/quiz/os/join';
  if (snap.phase === 'finished') return <div className="os"><OSResults snap={snap} client={client} host /><p className="os-note os-center"><Link href={`/api/quiz/os/rooms/${roomId}/replay`}>Download the event log (JSON)</Link></p></div>;
  const ready = seats.filter((s) => s.ready).length;
  return (
    <div className="os os-host">
      <header className="os-top">
        <div className="os-title"><b>Obstacle Survival</b><span className="os-chip">{snap.format === 'relay_race' ? `Relay · ${snap.teams.length} squads` : 'Cooperative escape'} · {mapName}</span></div>
        <div className="os-codebox"><span>Join at {joinUrl.replace(/^https?:\/\//, '')} with code</span><b data-testid="os-code">{snap.room.code}</b></div>
        <ConnBadge conn={client.conn} />
      </header>
      {msg && <p className="os-toast err" role="alert">{msg} <button type="button" className="os-x" onClick={() => setMsg('')} aria-label="Dismiss">×</button></p>}
      <section className="os-card os-controls" aria-label="Match controls">
        <div className="os-clock"><span className="os-phase">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span>{left !== null && !['traversing', 'lobby'].includes(snap.phase) && <b>{fmt(left)}</b>}<span className="os-note">Chapter {Math.min(snap.chapters, snap.chapter + 1)} of {snap.chapters}</span></div>
        <div className="os-row wrap">
          {lobby && <button type="button" className="os-btn primary big" data-testid="os-start" disabled={client.busy || seats.length === 0} onClick={() => void run({ kind: 'start' })}>{ready === seats.length && seats.length ? 'Start the match' : `Start now (${ready}/${seats.length} ready)`}</button>}
          {!lobby && (snap.paused ? <button type="button" className="os-btn primary" disabled={client.busy} onClick={() => void run({ kind: 'resume' })}>Resume</button> : <button type="button" className="os-btn" disabled={client.busy} onClick={() => void run({ kind: 'pause' })}>Pause</button>)}
          {!lobby && ['barrier', 'reveal', 'build_choice', 'countdown', 'preview'].includes(snap.phase) && <button type="button" className="os-btn" disabled={client.busy || snap.paused} onClick={() => void run({ kind: 'skip' })}>Next phase</button>}
          <button type="button" className="os-btn" aria-pressed={snap.locked} disabled={client.busy} onClick={() => void run({ kind: 'lock', locked: !snap.locked })}>{snap.locked ? 'Room locked — unlock' : 'Lock the room'}</button>
          <button type="button" className="os-btn" onClick={() => void openScreen()}>Open projector screen</button>
          {!lobby && (confirmEnd ? <span className="os-row"><button type="button" className="os-btn danger" disabled={client.busy} onClick={() => void run({ kind: 'end' }).then(() => setConfirmEnd(false))}>End the match now</button><button type="button" className="os-btn ghost" onClick={() => setConfirmEnd(false)}>Keep playing</button></span> : <button type="button" className="os-btn ghost" onClick={() => setConfirmEnd(true)}>End match…</button>)}
        </div>
        {snap.paused && <p className="os-banner" role="status">Game paused. Students and the projector show a pause banner until you resume.</p>}
        {screen && <p className="os-note">Projector link opened in a new tab. Opening a new one switches the old link off.</p>}
      </section>
      {snap.approvals.length > 0 && (
        <section className="os-card os-approvals" aria-label="Purchase requests" data-testid="os-approvals">
          <h2>Purchase requests ({snap.approvals.length})</h2>
          <p className="os-note">Your rule: ask before any purchase of {snap.approvalAbove} points or more. Points are only spent if you approve. Requests close when the shop closes.</p>
          <ul>{snap.approvals.map((a) => (
            <li key={a.id}><span><b>{a.seatName}</b> ({snap.teams.find((t) => t.id === a.teamId)?.name}) wants <b>{PERK_COPY[a.perk].name}</b> for {a.price} points{left !== null ? ` · shop closes in ${fmt(left)}` : ''}</span>
              <span className="os-row"><button type="button" className="os-btn small primary" disabled={client.busy} onClick={() => void run({ kind: 'approve', approvalId: a.id })}>Approve</button><button type="button" className="os-btn small" disabled={client.busy} onClick={() => void run({ kind: 'deny', approvalId: a.id })}>Not now</button></span></li>))}</ul>
        </section>
      )}
      {['barrier', 'reveal'].includes(snap.phase) && snap.question && (
        <section className="os-card"><h2>Question {Math.min(snap.chapters, snap.chapter + 1)} of {snap.chapters}</h2><p className="os-prompt">{String(snap.question.prompt ?? '')}</p>
          {snap.barrier && <p className="os-meter" aria-label={`${snap.barrier.answered} of ${snap.barrier.eligible} answered`}><span style={{ width: `${snap.barrier.eligible ? (snap.barrier.answered / snap.barrier.eligible) * 100 : 0}%` }} />{snap.barrier.answered} / {snap.barrier.eligible} answered</p>}
          {snap.phase === 'barrier' && <button type="button" className="os-btn ghost small" aria-expanded={peek} onClick={() => setPeek(!peek)}>{peek ? 'Hide the answer' : 'Peek at the answer (only you see it)'}</button>}
          {(peek || snap.phase === 'reveal') && <RevealPanel snap={snap} />}
        </section>
      )}
      {!lobby && <section className="os-card os-overview"><World getFrame={getFrame} mode="overview" reduced={reduced} label="Overview of the whole course with every runner" /></section>}
      <div className="os-hostgrid">
        {snap.teams.map((t, i) => {
          const members = seats.filter((s) => s.teamId === t.id);
          return (
            <section key={t.id} className="os-card os-squadcard" style={{ ['--sq' as string]: TEAM_COLORS[i % 4] }}>
              <header><i className="os-swatch" aria-hidden="true" /><h2>{TEAM_MARK[i % 4]} {t.name}</h2></header>
              {!lobby && <p className="os-stats"><span>Progress {Math.round(t.progress / 10)}%</span><span>{t.escaped} of {t.players} at the goal</span><span>Accuracy {Math.round(t.mastery / 10)}%</span><span>{t.points ?? 0} pts</span><span>{t.chaptersCleared ?? 0} gates</span></p>}
              {!lobby && <div className="os-progress" role="img" aria-label={`Progress ${Math.round(t.progress / 10)}%`}><span style={{ width: `${t.progress / 10}%` }} /></div>}
              {(t.perks?.length ?? 0) > 0 && <p className="os-note">Bought: {t.perks!.join(', ').replace(/_/g, ' ')}</p>}
              <ul className="os-seats">
                {members.length === 0 && <li className="os-note">Nobody yet.</li>}
                {members.map((s) => <SeatRow key={s.id} seat={s} squads={snap.teams} busy={client.busy} run={run} lobby={lobby} />)}
              </ul>
            </section>
          );
        })}
      </div>
      {lobby && seats.length === 0 && <p className="os-note os-center">Students join on their own devices at <b>{joinUrl.replace(/^https?:\/\//, '')}</b> with code <b>{snap.room.code}</b>. No account needed.</p>}
    </div>
  );
}
function SeatRow({ seat, squads, busy, lobby, run }: { seat: { id: string; name: string; teamId: string; role: keyof typeof ROLE_INFO; ready: boolean }; squads: { id: string; name: string }[]; busy: boolean; lobby: boolean; run: (a: HostAction) => Promise<boolean> }) {
  const [sure, setSure] = useState(false);
  return (
    <li>
      <RoleIcon role={seat.role} size={24} /><span className="who">{seat.name} · {ROLE_INFO[seat.role].name}{lobby && seat.ready ? ' ✓' : ''}</span>
      <label className="os-sr" htmlFor={`mv-${seat.id}`}>Move {seat.name}</label>
      <select id={`mv-${seat.id}`} value={seat.teamId} disabled={busy} onChange={(e) => void run({ kind: 'move_seat', seatId: seat.id, teamId: e.target.value })}>{squads.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      {sure ? <><button type="button" className="os-btn small danger" disabled={busy} onClick={() => void run({ kind: 'kick', seatId: seat.id })}>Remove</button><button type="button" className="os-btn small ghost" onClick={() => setSure(false)}>Cancel</button></>
        : <button type="button" className="os-btn small ghost" onClick={() => setSure(true)} aria-label={`Remove ${seat.name}`}>Remove…</button>}
    </li>
  );
}
