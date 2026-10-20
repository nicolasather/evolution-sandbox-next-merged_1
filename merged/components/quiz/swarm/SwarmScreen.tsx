'use client';
import type { Loose } from '@/lib/quiz/loose';
/** Projector view: read-only, large type. It shows the arena of one team at a time (auto-cycling in versus), the join code while students gather, the question and the reveal. It cannot send any command. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/quiz/client';
import { wsUrlOf } from '@/lib/swarm/client/urls';
import AnswerView from '../AnswerView';
import Arena from './Arena';
import { ConnBadge, Hud, PAUSE_TEXT, RoleBadge, useCountdown, fmtClock } from './panels';
import { ResultsPanel } from './SwarmResults';
import { useSwarm } from './useSwarm';
import { usePrefs } from './prefs';
import { UPGRADE_DEFS } from '@/lib/swarm/balance';
import type { UpgradeKind } from '@/lib/swarm/domain';

type A = Record<string, Loose>;
export default function SwarmScreen({ roomId }: { roomId: string }) {
  const [prefs] = usePrefs(); const [tok, setTok] = useState<{ workerUrl: string; wsUrl?: string; joinCode: string; screenToken: string } | null>(null); const [fatal, setFatal] = useState<{ status: number; message: string } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null); const [auto, setAuto] = useState(0);
  useEffect(() => { api<NonNullable<typeof tok>>(`/api/quiz/swarm/rooms/${roomId}/token`, { method: 'POST' }).then(setTok).catch((e) => setFatal({ status: e instanceof ApiError ? e.status : 0, message: (e as Error).message })); }, [roomId]);
  const opts = useMemo(() => (tok ? { wsUrl: tok.wsUrl ?? wsUrlOf(tok.workerUrl), token: async () => (await api<{ screenToken: string }>(`/api/quiz/swarm/rooms/${roomId}/token`, { method: 'POST' })).screenToken, view: 'screen' as const } : null), [tok, roomId]);
  const { conn } = useSwarm(opts, tok ? 'screen' : 'none');
  const teamsRaw = conn?.s.teams as A[] | undefined; const teams = useMemo(() => teamsRaw ?? [], [teamsRaw]); const m = conn?.s.meta as A | undefined; const phase = m?.phase as string | undefined;
  useEffect(() => { if (teams.length < 2 || pinned) return; const t = setInterval(() => setAuto((n) => n + 1), 12000); return () => clearInterval(t); }, [teams.length, pinned]);
  const focusId = pinned ?? teams[auto % Math.max(1, teams.length)]?.id;
  useEffect(() => { if (focusId && conn && m?.focus !== focusId) conn.focusTeam(focusId); }, [focusId, conn, m?.focus, conn?.version]);
  useEffect(() => { const k = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= teams.length) setPinned(teams[n - 1].id); if (e.key === '0') setPinned(null); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [teams]);
  const q = conn?.s.quiz as A | undefined; const roster = ((conn?.s.roster as A[]) ?? []); const d = conn?.s.draft as A | undefined;
  const qLeft = useCountdown(conn!, q && q.status === 'open' ? q.deadlineMs : null, !!m?.paused);
  if (fatal) return <main className="sw narrow" id="main"><section className="sw-card"><h1>Projector screen</h1><p className="sw-err" role="alert">{fatal.message}</p>{fatal.status === 401 && <Link className="sw-btn primary" href={`/quiz/login?next=${encodeURIComponent(`/quiz/swarm/${roomId}/screen`)}`}>Sign in as the teacher</Link>}</section></main>;
  if (!conn || !m || !tok) return <main className="sw sw-screen" id="main"><section className="sw-card" role="status"><h2>Connecting the projector…</h2></section></main>;
  const joinHost = typeof location !== 'undefined' ? location.host : '';
  return (
    <main className={`sw sw-screen large ${prefs.contrast ? 'contrast' : ''}`} id="main" data-phase={phase}>
      <ConnBadge conn={conn} />
      {(phase === 'lobby' || phase === 'role_pick') ? (
        <section className="sw-card" style={{ textAlign: 'center' }} data-testid="screen-lobby">
          <p>Join on your own device at <b>{joinHost}/quiz/swarm/join</b></p><p className="sw-bigcode" aria-label={`Room code ${tok.joinCode.split('').join(' ')}`}>{tok.joinCode}</p>
          <p>{roster.length} player{roster.length === 1 ? '' : 's'} in the room{phase === 'role_pick' ? ' · choosing roles' : ''}</p>
          <ul className="sw-roster" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', display: 'grid' }}>{roster.map((p) => <li key={p.id}><RoleBadge role={p.role} size={32} hc={prefs.contrast} /><span>{p.name}</span><em className={p.on ? 'on' : 'off'}>{teams.find((t) => t.id === p.team)?.name}</em></li>)}</ul>
        </section>
      ) : (
        <>
          <div className="sw-teamrows" aria-label="Teams">{teams.map((t, i) => <div key={t.id} style={{ outline: t.id === focusId ? '4px solid var(--gold)' : undefined }}><b>{t.name}</b>{t.status !== 'alive' ? ` · ${t.status}` : ''}<br /><span>Beacon {t.beacon}% · waves {t.waves}</span><span className="sw-meter" aria-hidden="true" style={{ display: 'block', width: '100%', marginTop: 4 }}><i style={{ width: `${t.beacon}%` }} /></span>{teams.length > 1 && <button type="button" className="sw-btn small" style={{ marginTop: 4 }} onClick={() => setPinned(t.id)} aria-label={`Show ${t.name} (key ${i + 1})`}>Show</button>}</div>)}</div>
          <Hud conn={conn} />
          {(phase === 'ending' || phase === 'results') ? <ResultsPanel conn={conn} /> : (
            <div className="sw-hostgrid">
              <div className="sw-arenabox"><Arena conn={conn} interactive={false} prefs={prefs} />{m.paused && <div className="sw-overlay" role="status"><div className="sw-card"><h2>Paused</h2><p>{PAUSE_TEXT[m.pauseReason as string] ?? 'The match is paused.'}</p></div></div>}</div>
              <div>
                {(phase === 'freeze' || phase === 'question' || phase === 'grade') && q?.question && (
                  <section className="sw-card" data-testid="screen-question"><div className="sw-qhead"><h2>{q.reveal ? 'Answer' : `Question ${q.index + 1} of ${q.total}`}</h2>{!q.reveal && qLeft !== null && <span className="sw-timer">{fmtClock(qLeft)}</span>}</div>
                    <p style={{ fontSize: '1.3em' }}>{q.question.prompt}</p>
                    {!q.reveal && q.question.kind === 'multiple_choice' && <ol type="A">{(q.question.payload.options as A[]).map((o) => <li key={o.id}>{o.text}</li>)}</ol>}
                    <p className="sw-note">{q.answeredTotal} of {q.eligibleTotal} answered on this team</p>
                    {q.reveal && q.question.answerKey && <AnswerView kind={q.question.kind} payload={q.question.payload} answerKey={q.question.answerKey} />}
                  </section>)}
                {phase === 'upgrade' && d && <section className="sw-card" data-testid="screen-draft"><h2>Team upgrade</h2><ul className="sw-list">{(d.offers as A[]).map((o) => <li key={o.id}><b>{UPGRADE_DEFS[o.id as UpgradeKind].label}</b> — {o.votes} vote{o.votes === 1 ? '' : 's'} · {o.cost} points</li>)}</ul>{d.resolved && <p className="sw-ok">{d.resolved.upgrade ? `Bought ${UPGRADE_DEFS[d.resolved.upgrade as UpgradeKind].label}.` : 'Points saved.'}</p>}</section>}
                {(phase === 'wave' || phase === 'boss_wave' || phase === 'countdown' || phase === 'ready') && <section className="sw-card"><h2>{phase === 'boss_wave' ? 'Boss wave' : phase === 'wave' ? 'Defend the beacon' : 'Get ready'}</h2><ul className="sw-roster">{roster.filter((r) => r.team === focusId).map((p) => <li key={p.id}><RoleBadge role={p.role} size={32} hc={prefs.contrast} /><span>{p.name}</span><em className={p.on ? 'on' : 'off'}>{p.on ? 'online' : 'offline'}</em></li>)}</ul></section>}
              </div>
            </div>
          )}
        </>
      )}
      <p className="sw-sr">Press a number key to show a team, 0 to cycle automatically.</p>
    </main>
  );
}
