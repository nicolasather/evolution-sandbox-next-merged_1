'use client';
/** The shared projector screen: read-only, opened from a revocable link whose token stays in the URL fragment (never sent as a URL to the
 *  server or its logs). Shows the join code in the lobby, the question while it is open (never the answer before the reveal), every squad's
 *  board during waves, and the standings at the end. No per-student correctness, no stakes. */
import { useEffect, useState } from 'react';
import Board from './Board';
import { fmt, PHASE_LABEL, TEAM_SWATCH, useNow } from './parts';
import { useTDRemote } from './useTD';
import { MAPS } from '@/lib/quiz/td/maps';
import type { TDTeam } from '@/lib/quiz/td/domain';

export default function TDScreen({ roomId }: { roomId: string }) {
  const [token, setToken] = useState<string | null>(null); const [checked, setChecked] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the fragment is only readable after hydration
  useEffect(() => { const m = /k=([A-Za-z0-9_-]+)/.exec(window.location.hash); setToken(m ? m[1]! : null); setChecked(true); }, []);
  if (!checked) return null;
  if (!token) return <main className="td narrow"><section className="td-panel"><h1>Projector link needed</h1><p className="td-note">Open the projector from the teacher console: it creates a private link for this screen.</p></section></main>;
  return <Screen roomId={roomId} token={token} />;
}

function Screen({ roomId, token }: { roomId: string; token: string }) {
  const client = useTDRemote(roomId, 'projector', { screenToken: token }); const { snap } = client; const now = useNow(client.serverNow, 500);
  if (client.fatal) return <main className="td narrow"><section className="td-panel"><h1>This projector link no longer works</h1><p className="td-note">A newer link was opened, or the match ended. Open the projector again from the teacher console.</p></section></main>;
  if (!snap) return <main className="td"><p className="td-note" role="status">Connecting…</p></main>;
  const teams = snap.teams as TDTeam[]; const round = snap.rounds[snap.rounds.length - 1] ?? null;
  const left = snap.phaseDeadlineMs ? (snap.paused ? snap.phaseDeadlineMs - snap.paused.atMs : snap.phaseDeadlineMs - now) : null;
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return (
    <div className="td td-screen" data-phase={snap.phase}>
      <header className="td-top">
        <div className="td-title"><b>Tower Defense</b><span className="td-chip">{MAPS[snap.config.mapId].title}</span>{snap.paused && <span className="td-chip" role="status" style={{ background: 'var(--coral)' }}>PAUSED</span>}</div>
        <div className="td-clock"><span className="td-phase">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span>{left !== null && <b>{fmt(left)}</b>}{snap.round > 0 && <span>Wave {snap.round} of {snap.plan.waves}</span>}</div>
      </header>
      {snap.phase === 'lobby' && (
        <main className="td-screenjoin">
          <p>Join on your device at <b>{host}/quiz/td/join</b></p>
          <p className="td-bigcode" aria-label={`Code ${snap.room.code.split('').join(' ')}`}>{snap.room.code}</p>
          <ul className="td-screenteams">{teams.map((t) => <li key={t.id}><i style={{ background: TEAM_SWATCH[t.colorIndex] }} aria-hidden="true" /><b>{t.name}</b><span>{snap.seats.filter((s) => s.teamId === t.id && !s.revoked).map((s) => s.name).join(', ') || 'nobody yet'}</span></li>)}</ul>
        </main>
      )}
      {snap.phase === 'quiz_open' && snap.question && (
        <main className="td-screenq"><p className="td-qmeta">Question {round?.question ? `${round.question.index} of ${round.question.total}` : ''}{round?.question?.repeat ? ' · review' : ''}</p><h1>{String(snap.question.prompt ?? '')}</h1>
          <ul className="td-answered">{teams.map((t) => <li key={t.id}><i style={{ background: TEAM_SWATCH[t.colorIndex] }} aria-hidden="true" />{t.name}: {round?.submittedCount?.[t.id] ?? 0} / {round?.eligibleCount?.[t.id] ?? 0} answered</li>)}</ul></main>
      )}
      {!['lobby', 'quiz_open', 'finished'].includes(snap.phase) && (
        <main className={`td-screengrid n${teams.length}`}>
          {teams.map((t) => (
            <section key={t.id} className="td-screenboard">
              <h2><i style={{ background: TEAM_SWATCH[t.colorIndex] }} aria-hidden="true" />{t.name}{t.fallen ? ' · core fallen' : ''}<span>Core {t.coreHP}/{t.maxCoreHP} · {t.wavesCleared}/{snap.plan.waves} waves</span></h2>
              <div className="td-bar" role="img" aria-label={`${t.name}: core ${t.coreHP} of ${t.maxCoreHP}`}><span className="c" style={{ flex: t.coreHP }} /><span className="w" style={{ flex: Math.max(0, t.maxCoreHP - t.coreHP) }} /></div>
              <Board mapId={snap.config.mapId} towers={t.towers} phase={snap.phase} waveInput={round?.waveInput?.[t.id] ?? null} waveStartMs={round?.waveStartMs ?? null} pausedAtMs={snap.paused?.atMs ?? null} serverNow={client.serverNow} calm={false} showPads={false} selectedPad={null} selectedTower={null} ghost={null} label={`${t.name} board`} coreHP={t.coreHP} maxCoreHP={t.maxCoreHP} interactive={false} lowFx={teams.length > 2} />
            </section>))}
        </main>
      )}
      {snap.phase === 'finished' && snap.finish && (
        <main className="td-screenend"><h1>Final standings</h1><ol className="td-standings">{snap.finish.standings.map((s) => { const t = teams.find((x) => x.id === s.teamId); return <li key={s.teamId}><span className="td-rank">{s.rank}</span><i style={{ background: TEAM_SWATCH[t?.colorIndex ?? 0] }} aria-hidden="true" /><b>{t?.name}</b><span>{s.wavesCleared} waves</span><span>core {s.coreHP}/{s.maxCoreHP}</span></li>; })}</ol></main>
      )}
    </div>
  );
}
