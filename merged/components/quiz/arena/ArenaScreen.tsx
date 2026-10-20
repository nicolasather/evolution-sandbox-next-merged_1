'use client';
/** The classroom projector: read-only, no student names, no wallets, no pings, no host controls. The link's secret travels in the URL fragment (#k=…),
 *  so it never reaches a server log or a Referer header; it is sent only as a request header. */
import { useEffect, useState } from 'react';
import { ArenaCanvas, ConnBadge, PHASE_LABEL, RevealPanel, fmt, mapName, useNow } from './ui';
import ArenaResults from './ArenaResults';
import Qr from './Qr';
import { TeamBadge } from './icons';
import { TEAM_COLORS } from './art';
import { useArenaRemote } from './useArena';
import { usePrefs } from './prefs';
import { FORMAT_COPY } from '@/lib/quiz/arena/balance';
import { kindLabels } from '@/lib/quiz/types';

function Inner({ roomId, token }: { roomId: string; token: string }) {
  const [prefs, , reduced] = usePrefs(); const client = useArenaRemote(roomId, 'projector', { screenToken: token, reduced }); const { snap } = client; const now = useNow(client.serverNow);
  if (client.fatal) return <main className="ar narrow"><section className="ar-card"><h1>This projector link is not valid</h1><p className="ar-why" role="alert">{client.error}</p><p>Ask the teacher to open a new one from the console.</p></section></main>;
  if (!snap) return <main className="ar screen"><p className="ar-note" role="status">Connecting…</p></main>;
  if (snap.phase === 'finished' && snap.finish) return <div className="ar screen"><ArenaResults snap={snap} client={client} /></div>;
  const left = snap.phase === 'arena_live' ? (snap.live?.secondsLeft ?? 0) * 1000 : snap.deadlineMs !== null ? snap.deadlineMs - now : null; const q = snap.questionView; const live = snap.live; const r = live?.rotate;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/arena/join?code=${snap.room.code}` : '';
  return (
    <div className="ar screen" data-phase={snap.phase} data-testid="ar-screen">
      <header className="ar-top"><div className="ar-title"><b>Arena Clash</b><span className="ar-chip">{FORMAT_COPY[snap.format].name} · {mapName(snap.mapId)}</span><span className="ar-chip">Round {Math.min(snap.cycles, snap.cycle + 1)} / {snap.cycles}</span><span className="ar-chip">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span></div>
        {left !== null && snap.phase !== 'lobby' && <span className="ar-timer big" role="timer">{fmt(left)}</span>}<ConnBadge conn={client.conn} /></header>
      {snap.phase === 'lobby' ? (
        <section className="ar-card ar-joinboard" data-testid="ar-screen-lobby">
          <div><h1>Join Arena Clash</h1><p className="ar-note">Open <b>{joinUrl.replace(/^https?:\/\//, '').split('?')[0]}</b> and type the code, or scan.</p><p className="ar-bigcode" data-testid="ar-code">{snap.room.code}</p>
            <ul className="ar-teamlist">{snap.teams.map((t, i) => <li key={t.id}><TeamBadge index={i} size={26} /><b style={{ color: TEAM_COLORS[i % 4] }}>{t.name}</b><span>{t.players} player{t.players === 1 ? '' : 's'} joined</span></li>)}</ul></div>
          {joinUrl && <Qr value={joinUrl} size={220} />}
        </section>
      ) : (
        <div className="ar-screenmain">
          <ArenaCanvas client={client} mode="overview" prefs={prefs} reduced={reduced} label="The whole arena with every team’s players shown as shapes" className="big" />
          <aside className="ar-board" aria-label="Teams">
            {snap.teams.map((t, i) => <div key={t.id} className="ar-teamrow"><b style={{ color: TEAM_COLORS[i % 4] }}><TeamBadge index={i} size={22} /> {t.name}</b><span>{t.players} player{t.players === 1 ? '' : 's'}</span>
              <div className="ar-progress" role="img" aria-label={`${t.name} score ${t.score} of 1000`}><span style={{ width: `${t.score / 10}%`, background: TEAM_COLORS[i % 4] }} /></div><small>Score {t.score} · quiz {t.quiz ?? 0}% · arena {Math.round(t.objective)} pts · {t.pulses} pulses</small></div>)}
            {snap.phase === 'arena_live' && snap.format === 'control' && r && <p className="ar-telegraph" role="status">{r.next ? 'Zones are about to switch!' : `Next zone switch in ${Math.ceil((r.inTicks * 50) / 1000)}s`}</p>}
          </aside>
        </div>
      )}
      {['question_open', 'reveal'].includes(snap.phase) && q && (
        <section className="ar-projq"><p className="ar-chip">{kindLabels[q.kind as keyof typeof kindLabels]} · arena frozen</p><h2>{String(q.prompt)}</h2>{snap.question && <p className="ar-meter"><span style={{ width: `${snap.question.eligible ? (snap.question.answered / snap.question.eligible) * 100 : 0}%` }} />{snap.question.answered} / {snap.question.eligible} answered</p>}
          {snap.phase === 'reveal' && <RevealPanel snap={snap} />}</section>
      )}
      {snap.phase === 'planning' && <section className="ar-projq"><h2>Planning board</h2><p className="ar-note">Teams are choosing helpers with their quiz points. The next round starts when the timer ends.</p></section>}
      {snap.paused && <div className="ar-banner pause big" role="alert">Paused by the teacher</div>}
    </div>
  );
}
export default function ArenaScreen({ roomId }: { roomId: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { const m = /[#&]k=([A-Za-z0-9_-]{8,200})/.exec(window.location.hash); setToken(m?.[1] ?? null); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the fragment
  if (token === undefined) return <main className="ar screen"><p className="ar-note" role="status">Opening…</p></main>;
  if (!token) return <main className="ar narrow"><section className="ar-card"><h1>Projector link needed</h1><p>Open the projector screen from the teacher console so it carries its private key.</p></section></main>;
  return <Inner roomId={roomId} token={token} />;
}
