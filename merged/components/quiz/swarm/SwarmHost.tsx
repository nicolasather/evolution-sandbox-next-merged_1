'use client';
import type { Loose } from '@/lib/quiz/loose';
/** Teacher console. Every button sends one idempotent command that the game server checks; the room's revision is attached so a stale console cannot overwrite a newer decision. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import { wsUrlOf } from '@/lib/swarm/client/urls';
import Arena from './Arena';
import { ConnBadge, Hud, PAUSE_TEXT, PHASE_LABEL, RoleBadge, useCountdown, fmtClock } from './panels';
import { ResultsPanel } from './SwarmResults';
import { PrefsBar } from './SwarmGame';
import { useSwarm } from './useSwarm';
import { usePrefs } from './prefs';
import { ROLES } from '@/lib/swarm/domain';

type A = Record<string, Loose>;
type Tokens = { workerUrl: string; wsUrl: string; joinCode: string; hostToken: string; screenToken: string };
const REPORT_EMPTY = 'No graded answers were recorded for this match.';

function TeacherReport({ roomId }: { roomId: string }) {
  const [rep, setRep] = useState<A | null>(null); const [err, setErr] = useState('');
  useEffect(() => { api<A>(`/api/quiz/swarm/rooms/${roomId}/report`).then(setRep).catch((e) => setErr((e as Error).message)); }, [roomId]);
  const csv = () => {
    const rows = [['Student', 'Team', 'Role', 'Questions answered', 'Accuracy %'], ...((rep?.players as A[]) ?? []).map((p) => [p.name, p.team, p.role, p.answered, p.accuracyPct ?? ''])];
    const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'swarm-survival-students.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  if (err) return <p className="sw-err" role="alert">{err}</p>; if (!rep) return <p className="sw-note" role="status">Loading the teacher summary…</p>;
  return (
    <section className="sw-card" aria-labelledby="sw-rep-h" data-testid="report">
      <h2 id="sw-rep-h">Teacher summary</h2>
      {rep.note && <p>{rep.note}</p>}
      {rep.weakest?.length > 0 && <><h3>Questions to revisit</h3><ol>{(rep.weakest as A[]).map((q) => <li key={q.id}>{q.prompt} — <b>{q.accuracyPct}%</b> correct ({q.answers} answers)</li>)}</ol></>}
      <h3>Students</h3>
      <div className="sw-tablewrap"><table><thead><tr><th>Student</th><th>Team</th><th>Role</th><th>Answered</th><th>Accuracy</th></tr></thead><tbody>{(rep.players as A[]).map((p, i) => <tr key={i}><th scope="row">{p.name}</th><td>{p.team}</td><td>{p.role}</td><td>{p.answered}</td><td>{p.accuracyPct === null ? '–' : `${p.accuracyPct}%`}</td></tr>)}</tbody></table></div>
      <div className="sw-row"><button type="button" className="sw-btn" onClick={csv}>Download students (CSV)</button><button type="button" className="sw-btn" onClick={() => window.print()}>Print</button></div>
      <p className="sw-note">{rep.questions?.length ? 'Built only from answers the game server graded and stored.' : REPORT_EMPTY}</p>
    </section>
  );
}

export default function SwarmHost({ roomId }: { roomId: string }) {
  const [prefs, setPrefs] = usePrefs(); const [tok, setTok] = useState<Tokens | null>(null); const [fatal, setFatal] = useState<{ status: number; message: string } | null>(null);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [reason, setReason] = useState(''); const [endNonce, setEndNonce] = useState<{ n: string; until: number } | null>(null); const [kick, setKick] = useState<string | null>(null);
  const fetchTokens = useCallback(() => api<Tokens>(`/api/quiz/swarm/rooms/${roomId}/token`, { method: 'POST' }), [roomId]);
  useEffect(() => { fetchTokens().then(setTok).catch((e) => setFatal({ status: e instanceof ApiError ? e.status : 0, message: (e as Error).message })); }, [fetchTokens]);
  const opts = useMemo(() => (tok ? { wsUrl: tok.wsUrl ?? wsUrlOf(tok.workerUrl), token: async () => (await fetchTokens()).hostToken, view: 'play' as const } : null), [tok, fetchTokens]);
  const { conn } = useSwarm(opts, tok ? 'host' : 'none'); const [now, setNow] = useState(0); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const m = conn?.s.meta as A | undefined; const roster = ((conn?.s.roster as A[]) ?? []); const teams = ((conn?.s.teams as A[]) ?? []); const q = conn?.s.quiz as A | undefined; const phase = m?.phase as string | undefined;
  const qLeft = useCountdown(conn!, q && q.status === 'open' ? q.deadlineMs : null, !!m?.paused);
  const run = useCallback(async (cmd: Record<string, unknown>, ok?: string) => {
    if (!conn) return null; setBusy(true); setMsg('');
    try { const a = await conn.host(cmd); setMsg(a.ok ? ok ?? '' : a.message ?? 'The server refused that command.'); return a; } catch (e) { setMsg((e as Error).message); return null; } finally { setBusy(false); }
  }, [conn]);
  const focusTeam = (id: string) => conn?.focusTeam(id);
  const copied = useRef<HTMLButtonElement>(null);
  if (fatal) return <main className="sw narrow" id="main"><section className="sw-card"><h1>Teacher console</h1><p className="sw-err" role="alert">{fatal.message}</p>{fatal.status === 401 && <Link className="sw-btn primary" href={`/quiz/login?next=${encodeURIComponent(`/quiz/swarm/${roomId}/host`)}`}>Sign in</Link>}</section></main>;
  if (!tok || !conn || !m) return <main className="sw" id="main"><ConnBadge conn={conn ?? ({ status: 'connecting', lastError: '' } as never)} /><section className="sw-card" role="status"><h2>Opening your console…</h2></section></main>;
  const joinUrl = typeof location !== 'undefined' ? `${location.origin}/quiz/swarm/join?code=${tok.joinCode}` : ''; const online = roster.filter((r) => r.on).length; const running = !['lobby', 'role_pick', 'ending', 'results'].includes(phase ?? '');
  const endLeft = endNonce ? Math.max(0, Math.ceil((endNonce.until - now) / 1000)) : 0; const confirmOpen = endNonce && endLeft > 0;
  return (
    <main className={`sw ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''} ${prefs.reduced ? 'calm' : ''}`} id="main">
      <ConnBadge conn={conn} />
      <header className="sw-card" aria-label="Room">
        <div className="sw-row" style={{ justifyContent: 'space-between' }}>
          <div><p className="sw-note" style={{ margin: 0 }}>Students join at <b>{typeof location !== 'undefined' ? location.host : ''}/quiz/swarm/join</b> with the code</p><span className="sw-code" data-testid="join-code" aria-label={`Room code ${tok.joinCode.split('').join(' ')}`}>{tok.joinCode}</span></div>
          <div className="sw-row"><button type="button" ref={copied} className="sw-btn small" onClick={async () => { try { await navigator.clipboard.writeText(joinUrl); setMsg('Join link copied.'); } catch { setMsg(joinUrl); } }}>Copy join link</button><a className="sw-btn small" href={`/quiz/swarm/${roomId}/screen`} target="_blank" rel="noreferrer">Open projector screen ↗</a></div>
        </div>
        <p className="sw-note" role="status" data-testid="host-status">{PHASE_LABEL[phase ?? ''] ?? phase} · {online} of {roster.length} students online · delay {Math.round(conn.rttMs)} ms{m.locked ? ' · room locked' : ''}</p>
      </header>
      {m.paused && <p className="sw-conn" role="status" data-testid="host-paused">Paused: {PAUSE_TEXT[m.pauseReason as string] ?? 'The match is paused.'}</p>}
      <Hud conn={conn} />
      <div className="sw-hostgrid">
        <div>
          {teams.length > 1 && <div className="sw-row" role="group" aria-label="Watch a team" style={{ marginBottom: 8 }}>{teams.map((t) => <button type="button" key={t.id} className="sw-btn small" aria-pressed={m.focus === t.id} onClick={() => focusTeam(t.id)}>{t.name}</button>)}</div>}
          {phase !== 'lobby' && phase !== 'role_pick' ? <div className="sw-arenabox"><Arena conn={conn} interactive={false} prefs={prefs} /></div> : <section className="sw-card"><h2>{phase === 'lobby' ? 'Waiting for students' : 'Students are choosing roles'}</h2><p>{roster.length === 0 ? 'Nobody has joined yet. Share the code above.' : `${roster.length} student${roster.length === 1 ? '' : 's'} in the room.`}</p></section>}
          <section className="sw-card" aria-labelledby="sw-teams-h" style={{ marginTop: 14 }}><h2 id="sw-teams-h">Teams</h2>
            <ul className="sw-teams">{teams.map((t) => <li key={t.id}><b>{t.name}</b> — {t.size} player{t.size === 1 ? '' : 's'}{t.status !== 'alive' ? ` · ${t.status}` : ''}<br /><span className="sw-note">Beacon {t.beacon}% · waves cleared {t.waves}{t.wallet !== undefined ? ` · ${t.wallet} points` : ''}</span><span className="sw-meter" aria-hidden="true" style={{ display: 'block', width: '100%', marginTop: 4 }}><i style={{ width: `${t.beacon}%` }} /></span></li>)}</ul>
          </section>
        </div>
        <div>
          <section className="sw-card" aria-labelledby="sw-ctl-h" data-testid="controls"><h2 id="sw-ctl-h">Controls</h2>
            {phase === 'lobby' && <><button type="button" className="sw-btn primary big" disabled={busy || roster.length === 0} onClick={() => run({ cmd: 'start' })} data-testid="open-roles">Open role selection</button><p className="sw-note">{roster.length === 0 ? 'Waiting for at least one student.' : 'Students pick a role. You can still let more join.'}</p></>}
            {phase === 'role_pick' && <><button type="button" className="sw-btn primary big" disabled={busy || roster.length === 0} onClick={() => run({ cmd: 'begin' })} data-testid="begin">Start the match</button><p className="sw-note">{roster.filter((r) => r.ready).length} of {roster.length} ready. You can start whenever you like.</p></>}
            {running && <div className="sw-row">
              <button type="button" className="sw-btn" disabled={busy} onClick={() => run({ cmd: m.paused ? 'resume' : 'pause' }, m.paused ? 'Resumed.' : 'Paused.')} data-testid="pause">{m.paused ? 'Resume' : 'Pause'}</button>
              <button type="button" className="sw-btn" disabled={busy || phase !== 'question' || q?.status !== 'open'} onClick={() => run({ cmd: 'extend', seconds: 15 }, 'Added 15 seconds.')}>+15 s on question</button>
              <button type="button" className="sw-btn" disabled={busy || phase !== 'wave'} onClick={() => run({ cmd: 'ask_now' }, 'Question opened.')} title={phase === 'wave' ? '' : 'Only during a wave'}>Ask now</button>
            </div>}
            {running && phase === 'question' && <div style={{ marginTop: 8 }}><label className="sw-field">Skip this question — reason (kept in the log)<input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. the wording was unclear" /></label><button type="button" className="sw-btn" disabled={busy || !reason.trim()} onClick={() => run({ cmd: 'skip', reason: reason.trim() }, 'Question skipped. Nobody is penalised.').then(() => setReason(''))}>{reason.trim() ? 'Skip question' : 'Write a reason to skip'}</button></div>}
            {phase !== 'ending' && phase !== 'results' && <div className="sw-row" style={{ marginTop: 10 }}>
              <button type="button" className="sw-btn small" aria-pressed={!!m.locked} onClick={() => run({ cmd: 'lock', value: !m.locked }, m.locked ? 'Room reopened.' : 'Room locked. Nobody new can join.')}>{m.locked ? 'Unlock room' : 'Lock room'}</button>
              {running && <button type="button" className="sw-btn small" aria-pressed={!!m.lateJoin} onClick={() => run({ cmd: 'late_join', value: !m.lateJoin }, m.lateJoin ? 'Late joining is off.' : 'Students may join between waves.')}>{m.lateJoin ? 'Stop late joining' : 'Allow late joining'}</button>}
            </div>}
            {phase !== 'lobby' && phase !== 'ending' && phase !== 'results' && !confirmOpen && <button type="button" className="sw-btn danger" style={{ marginTop: 10 }} disabled={busy} onClick={async () => { const a = await run({ cmd: 'end_request' }); if (a?.ok && a.nonce) setEndNonce({ n: a.nonce, until: Date.now() + 15000 }); }} data-testid="end-request">End match…</button>}
            {confirmOpen && <div className="sw-confirm" role="alertdialog" aria-label="Confirm ending the match"><p><b>End the match for everyone?</b> Results are calculated from what has happened so far. This cannot be undone. ({endLeft}s)</p><div className="sw-row"><button type="button" className="sw-btn danger" onClick={async () => { await run({ cmd: 'end_confirm', nonce: endNonce!.n }); setEndNonce(null); }} data-testid="end-confirm">Yes, end the match</button><button type="button" className="sw-btn" onClick={() => setEndNonce(null)}>Keep playing</button></div></div>}
            <p className="sw-note" role="status" aria-live="polite" data-testid="host-msg">{msg}</p>
          </section>
          {phase === 'question' && q && <section className="sw-card" aria-labelledby="sw-qm-h"><h2 id="sw-qm-h">Question {q.index + 1} of {q.total}</h2>{qLeft !== null && <p className="sw-timer" style={{ display: 'inline-block' }}>{fmtClock(qLeft)}</p>}<p>{q.question?.prompt}</p><p className="sw-note" data-testid="host-answered">{roster.filter((r) => r.ans).length} of {roster.filter((r) => r.ans !== undefined).length} students answered</p></section>}
          <section className="sw-card" aria-labelledby="sw-ro-h"><h2 id="sw-ro-h">Students ({roster.length})</h2>
            <ul className="sw-roster">{roster.map((p) => (
              <li key={p.id}><RoleBadge role={p.role} size={28} hc={prefs.contrast} /><span>{p.name}<br /><small>{teams.find((t) => t.id === p.team)?.name}{p.cap ? ' · captain' : ''}</small></span>
                <em className={p.on ? 'on' : 'off'}>{p.on ? (p.ans === true ? 'answered' : 'online') : 'offline'}</em>
                {(phase === 'lobby' || phase === 'role_pick') && teams.length > 1 && <select aria-label={`Team for ${p.name}`} value={p.team} onChange={(e) => run({ cmd: 'assign', pid: p.id, teamId: e.target.value })}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
                {(phase === 'lobby' || phase === 'role_pick') && <select aria-label={`Role for ${p.name}`} value={p.role} onChange={(e) => run({ cmd: 'assign', pid: p.id, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>}
                {kick === p.id ? <><button type="button" className="sw-btn small danger" onClick={() => { run({ cmd: 'kick', pid: p.id }, `${p.name} was removed.`); setKick(null); }}>Remove {p.name}?</button><button type="button" className="sw-btn small" onClick={() => setKick(null)}>Cancel</button></> : <button type="button" className="sw-btn small" onClick={() => setKick(p.id)} aria-label={`Remove ${p.name}`}>Remove</button>}
              </li>))}</ul>
            {roster.length === 0 && <p className="sw-note">No students yet.</p>}
          </section>
        </div>
      </div>
      {(phase === 'ending' || phase === 'results') && <><ResultsPanel conn={conn} /><TeacherReport roomId={roomId} /></>}
      <PrefsBar prefs={prefs} set={setPrefs} />
    </main>
  );
}
