'use client';
/** Teacher console. Before the match: who joined, which squad, roles and ready state; move or remove a device, lock the room, rename
 *  squads, open the projector. During it: the phase clock with pause / +time / next phase / end, how many answered per squad (counts, not
 *  answers), purchase approvals, a private peek at the current answer, connection health. After it: results with the learning review. */
import { useState } from 'react';
import Link from 'next/link';
import Board from './Board';
import Results from './Results';
import { ConnBadge, fmt, PHASE_LABEL, RevealPanel, TEAM_SWATCH, useNow } from './parts';
import { useTDRemote } from './useTD';
import { api } from '@/lib/quiz/client';
import { MAPS } from '@/lib/quiz/td/maps';
import type { TDHostAction, TDTeam } from '@/lib/quiz/td/domain';

export default function TDHost({ roomId }: { roomId: string }) {
  const client = useTDRemote(roomId, 'host'); const { snap } = client; const now = useNow(client.serverNow);
  const [msg, setMsg] = useState(''); const [screen, setScreen] = useState<string | null>(null); const [peek, setPeek] = useState(false);
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null); const [confirmEnd, setConfirmEnd] = useState(false);
  if (client.fatal) return <main className="td narrow"><section className="td-panel"><h1>Can’t open this console</h1><p className="td-why">{client.error}</p><Link className="td-btn" href="/quiz/my">My quizzes</Link></section></main>;
  if (!snap) return <main className="td"><p className="td-note" role="status">Loading the match…</p></main>;
  const run = async (a: TDHostAction) => { const r = await client.host(a); setMsg(r.ok ? '' : r.message ?? 'That did not work.'); return r.ok; };
  const teams = snap.teams as TDTeam[];
  const round = snap.rounds[snap.rounds.length - 1] ?? null;
  const seats = snap.seats.filter((s) => !s.revoked);
  const waiting = seats.filter((s) => !s.teamId);
  const allReady = seats.length > 0 && seats.every((s) => s.ready || !s.teamId);
  const left = snap.phaseDeadlineMs ? (snap.paused ? snap.phaseDeadlineMs - snap.paused.atMs : snap.phaseDeadlineMs - now) : null;
  const matchLeft = snap.matchEndMs ? (snap.paused ? snap.matchEndMs - snap.paused.atMs : snap.matchEndMs - now) : null;
  const lobby = snap.phase === 'lobby';
  const openScreen = async () => { try { const d = await api<{ url: string }>(`/api/quiz/td/rooms/${roomId}/screen`, { method: 'POST', json: {} }); setScreen(d.url); window.open(d.url, '_blank', 'noopener'); } catch (e) { setMsg((e as Error).message); } };
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/td/join` : '/quiz/td/join';

  if (snap.phase === 'finished') return <div className="td td-host"><Results snap={snap} client={client} host /><p className="td-note td-center"><Link href={`/api/quiz/td/rooms/${roomId}/replay`}>Download the event log (JSON)</Link></p></div>;
  return (
    <div className="td td-host">
      <header className="td-top">
        <div className="td-title"><b>Tower Defense</b><span className="td-chip">{snap.config.format === 'coop' ? 'Co-op' : `${teams.length} squads`} · {MAPS[snap.config.mapId].title}</span></div>
        <div className="td-codebox"><span>Join at {joinUrl.replace(/^https?:\/\//, '')} with code</span><b data-testid="td-code">{snap.room.code}</b></div>
        <ConnBadge conn={client.conn} />
      </header>
      {msg && <p className="td-toast err" role="alert">{msg} <button type="button" className="td-x" onClick={() => setMsg('')} aria-label="Dismiss">×</button></p>}
      <section className="td-panel td-controls" aria-label="Match controls">
        <div className="td-clock"><span className="td-phase">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span>{left !== null && <b>{fmt(left)}</b>}{matchLeft !== null && !lobby && <span className="td-note">Match: {fmt(matchLeft)} left · wave {snap.round} of {snap.plan.waves}</span>}</div>
        <div className="td-row wrap">
          {lobby && <button type="button" className="td-btn primary big" disabled={client.busy || !seats.some((s) => s.teamId)} onClick={() => void run({ kind: 'start', override: !allReady })}>{allReady ? 'Start the match' : `Start now (${seats.filter((s) => s.ready).length}/${seats.filter((s) => s.teamId).length} ready)`}</button>}
          {!lobby && (snap.paused ? <button type="button" className="td-btn primary" disabled={client.busy} onClick={() => void run({ kind: 'resume' })}>Resume</button> : <button type="button" className="td-btn" disabled={client.busy} onClick={() => void run({ kind: 'pause' })}>Pause</button>)}
          {!lobby && ['quiz_open', 'build'].includes(snap.phase) && <button type="button" className="td-btn" disabled={client.busy || !!snap.paused} onClick={() => void run({ kind: 'extend', seconds: 20 })}>+20 seconds</button>}
          {!lobby && ['quiz_open', 'reveal', 'build', 'wave_result', 'countdown'].includes(snap.phase) && <button type="button" className="td-btn" disabled={client.busy || !!snap.paused} onClick={() => void run({ kind: 'advance' })}>Next phase</button>}
          <button type="button" className="td-btn" aria-pressed={snap.locked} disabled={client.busy} onClick={() => void run({ kind: 'lock', locked: !snap.locked })}>{snap.locked ? 'Room locked — unlock' : 'Lock the room'}</button>
          <button type="button" className="td-btn" aria-pressed={snap.config.hideNames} disabled={client.busy} onClick={() => void run({ kind: 'hide_names', hide: !snap.config.hideNames })}>{snap.config.hideNames ? 'Names hidden on projector' : 'Hide names on projector'}</button>
          <button type="button" className="td-btn" onClick={() => void openScreen()}>Open projector screen</button>
          {!lobby && (confirmEnd
            ? <span className="td-row"><button type="button" className="td-btn danger" disabled={client.busy} onClick={() => void run({ kind: 'end' }).then(() => setConfirmEnd(false))}>End the match now</button><button type="button" className="td-btn ghost" onClick={() => setConfirmEnd(false)}>Keep playing</button></span>
            : <button type="button" className="td-btn ghost" onClick={() => setConfirmEnd(true)}>End match…</button>)}
        </div>
        {screen && <p className="td-note">Projector link opened in a new tab. Opening a new one switches the old link off.</p>}
        {snap.paused?.reason === 'host_offline' && <p className="td-banner">The match paused while this console was offline. Resume when you are ready.</p>}
      </section>

      {['quiz_open', 'reveal'].includes(snap.phase) && snap.question && (
        <section className="td-panel">
          <h2>Question {round?.question ? `${round.question.index} of ${round.question.total}` : ''}{round?.question?.repeat ? ' · review' : ''}</h2>
          <p className="td-prompt">{String(snap.question.prompt ?? '')}</p>
          {snap.phase === 'quiz_open' && <button type="button" className="td-btn ghost small" aria-expanded={peek} onClick={() => setPeek(!peek)}>{peek ? 'Hide the answer' : 'Peek at the answer (only you see it)'}</button>}
          {(peek || snap.phase === 'reveal') && <RevealPanel snap={snap} question={snap.question} />}
        </section>
      )}

      <div className="td-hostgrid">
        {teams.map((t) => {
          const members = seats.filter((s) => s.teamId === t.id);
          const sub = round?.submittedCount?.[t.id] ?? 0; const elig = round?.eligibleCount?.[t.id] ?? members.length;
          return (
            <section key={t.id} className="td-panel td-squadcard" style={{ ['--sq' as string]: TEAM_SWATCH[t.colorIndex] }}>
              <header>
                <i className="td-swatch" aria-hidden="true" />
                {rename?.id === t.id
                  ? <form className="td-row" onSubmit={(e) => { e.preventDefault(); void run({ kind: 'rename_team', teamId: t.id, name: rename.name }).then((ok) => ok && setRename(null)); }}><input aria-label="Squad name" value={rename.name} maxLength={24} onChange={(e) => setRename({ id: t.id, name: e.target.value })} /><button className="td-btn small" type="submit">Save</button></form>
                  : <><h2>{t.name}</h2>{lobby && <button type="button" className="td-btn ghost small" onClick={() => setRename({ id: t.id, name: t.name })}>Rename</button>}</>}
              </header>
              {!lobby && <p className="td-stats"><span>Core {t.coreHP}/{t.maxCoreHP}</span><span>{t.points} pts</span><span>{t.wavesCleared} waves</span><span>{t.towers.length} towers</span>{t.fallen && <b>fallen</b>}</p>}
              {snap.phase === 'quiz_open' && <p className="td-meter" aria-label={`${sub} of ${elig} answered`}><span style={{ width: `${elig ? (sub / elig) * 100 : 0}%` }} />{sub} / {elig} answered</p>}
              {!lobby && <div className="td-minboard"><Board mapId={snap.config.mapId} towers={t.towers} phase={snap.phase} waveInput={round?.waveInput?.[t.id] ?? null} waveStartMs={round?.waveStartMs ?? null} pausedAtMs={snap.paused?.atMs ?? null} serverNow={client.serverNow} calm showPads={false} selectedPad={null} selectedTower={null} ghost={null} label={`${t.name} board`} coreHP={t.coreHP} maxCoreHP={t.maxCoreHP} interactive={false} lowFx /></div>}
              {t.pending.length > 0 && (
                <ul className="td-approvals">{t.pending.map((p) => (
                  <li key={p.id}><span>{snap.seats.find((s) => s.id === p.seat)?.name ?? 'A student'} wants to {p.action.kind} ({p.cost} pts)</span>
                    <button type="button" className="td-btn small primary" disabled={client.busy} onClick={() => void run({ kind: 'approve', teamId: t.id, pendingId: p.id, approve: true })}>Allow</button>
                    <button type="button" className="td-btn small" disabled={client.busy} onClick={() => void run({ kind: 'approve', teamId: t.id, pendingId: p.id, approve: false })}>Refuse</button></li>))}</ul>
              )}
              <ul className="td-seats">
                {members.length === 0 && <li className="td-note">Nobody yet.</li>}
                {members.map((s) => <SeatRow key={s.id} seat={s} teams={teams} busy={client.busy} lobby={lobby} run={run} />)}
              </ul>
            </section>
          );
        })}
      </div>
      {waiting.length > 0 && <section className="td-panel"><h2>Waiting for a squad</h2><ul className="td-seats">{waiting.map((s) => <SeatRow key={s.id} seat={s} teams={teams} busy={client.busy} lobby={lobby} run={run} />)}</ul></section>}
      {lobby && seats.length === 0 && <p className="td-note td-center">Students join on their own devices at <b>{joinUrl.replace(/^https?:\/\//, '')}</b> with code <b>{snap.room.code}</b>. No account needed.</p>}
    </div>
  );
}

function SeatRow({ seat, teams, busy, lobby, run }: { seat: { id: string; name: string; teamId: string | null; role: string | null; ready: boolean }; teams: TDTeam[]; busy: boolean; lobby: boolean; run: (a: TDHostAction) => Promise<boolean> }) {
  const [sure, setSure] = useState(false);
  return (
    <li>
      <span className="who">{seat.name}{seat.role ? ` · ${seat.role}` : ''}{lobby && seat.ready ? ' ✓' : ''}</span>
      <label className="td-sr" htmlFor={`mv-${seat.id}`}>Move {seat.name}</label>
      <select id={`mv-${seat.id}`} value={seat.teamId ?? ''} disabled={busy} onChange={(e) => void run({ kind: 'move_seat', seatId: seat.id, teamId: e.target.value || null })}>
        <option value="">Waiting</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {sure ? <><button type="button" className="td-btn small danger" disabled={busy} onClick={() => void run({ kind: 'kick', seatId: seat.id })}>Remove</button><button type="button" className="td-btn small ghost" onClick={() => setSure(false)}>Cancel</button></>
        : <button type="button" className="td-btn small ghost" onClick={() => setSure(true)} aria-label={`Remove ${seat.name}`}>Remove…</button>}
    </li>
  );
}
