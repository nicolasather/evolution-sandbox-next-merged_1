'use client';
/** The classroom projector: read-only, no student names, no per-student data, no host controls. The link's secret travels in the URL fragment (#k=…),
 *  so it never reaches a server log or a Referer header; it is sent only as a request header. */
import { useCallback, useEffect, useState } from 'react';
import World from './World';
import OSResults from './OSResults';
import { ConnBadge, PHASE_LABEL, RevealPanel, fmt, useNow } from './parts';
import { TEAM_COLORS, TEAM_MARK } from './art';
import { useOSRemote } from './useOS';
import { kindLabels } from '@/lib/quiz/types';
import { usePrefs } from './prefs';

function Inner({ roomId, token }: { roomId: string; token: string }) {
  const client = useOSRemote(roomId, 'projector', { screenToken: token }); const { snap } = client; const now = useNow(client.serverNow); const [, , reduced] = usePrefs();
  const getFrame = useCallback(() => client.frame(), [client]);
  if (client.fatal) return <main className="os narrow"><section className="os-card"><h1>This projector link is not valid</h1><p className="os-why" role="alert">{client.error}</p><p>Ask the teacher to open a new one from the console.</p></section></main>;
  if (!snap) return <main className="os screen"><p className="os-note" role="status">Connecting…</p></main>;
  if (snap.phase === 'finished' && snap.finish) return <div className="os screen"><OSResults snap={snap} client={client} /></div>;
  const left = snap.deadlineMs !== null ? snap.deadlineMs - now : null; const q = snap.question;
  return (
    <div className="os screen" data-phase={snap.phase} data-testid="os-screen">
      <header className="os-top"><div className="os-title"><b>Obstacle Survival</b><span className="os-chip">Chapter {Math.min(snap.chapters, snap.chapter + 1)} / {snap.chapters}</span><span className="os-chip">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span></div>
        {snap.phase === 'lobby' && <div className="os-codebox big"><span>Join with code</span><b data-testid="os-code">{snap.room.code}</b></div>}
        {left !== null && ['barrier', 'reveal', 'build_choice', 'countdown', 'preview'].includes(snap.phase) && <span className="os-timer big" role="timer">{fmt(left)}</span>}<ConnBadge conn={client.conn} /></header>
      <div className="os-screenmain">
        <World getFrame={getFrame} mode="overview" reduced={reduced} label="The whole course with every runner shown as a shape" className="big" />
        <aside className="os-board" aria-label="Squads">
          {snap.teams.map((t, i) => <div key={t.id} className="os-squadrow"><b style={{ color: TEAM_COLORS[i % 4] }}>{TEAM_MARK[i % 4]} {t.name}</b><span>{t.players} runner{t.players === 1 ? '' : 's'}</span><div className="os-progress" role="img" aria-label={`${t.name} progress ${Math.round(t.progress / 10)}%`}><span style={{ width: `${t.progress / 10}%`, background: TEAM_COLORS[i % 4] }} /></div><small>{Math.round(t.progress / 10)}% · {t.escaped} at goal · accuracy {Math.round(t.mastery / 10)}%</small></div>)}
        </aside>
      </div>
      {['barrier', 'reveal'].includes(snap.phase) && q && (
        <section className="os-projq"><p className="os-chip">{kindLabels[q.kind as keyof typeof kindLabels]} · course frozen</p><h2>{String(q.prompt)}</h2>{snap.barrier && <p className="os-meter"><span style={{ width: `${snap.barrier.eligible ? (snap.barrier.answered / snap.barrier.eligible) * 100 : 0}%` }} />{snap.barrier.answered} / {snap.barrier.eligible} answered</p>}
          {snap.phase === 'reveal' && <RevealPanel snap={snap} />}</section>
      )}
      {snap.paused && <div className="os-banner pause big" role="alert">Paused by the teacher</div>}
    </div>
  );
}
export default function OSScreen({ roomId }: { roomId: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { const m = /[#&]k=([A-Za-z0-9_-]{8,200})/.exec(window.location.hash); setToken(m?.[1] ?? null); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the fragment
  if (token === undefined) return <main className="os screen"><p className="os-note" role="status">Opening…</p></main>;
  if (!token) return <main className="os narrow"><section className="os-card"><h1>Projector link needed</h1><p>Open the projector screen from the teacher console so it carries its private key.</p></section></main>;
  return <Inner roomId={roomId} token={token} />;
}
