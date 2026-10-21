'use client';
/** The classroom projector: read-only, no student names, no wallets, no pings, no host controls, no answer key. The link's secret travels in the URL fragment (#k=…),
 *  so it never reaches a server log or a Referer header; it is sent only as a request header. */
import { useEffect, useState } from 'react';
import { CRCanvas, ConnBadge, PHASE_LABEL, RevealPanel, fmt, mapName, useNow } from './ui';
import CRResults from './CRResults';
import Qr from './Qr';
import { TeamBadge } from './icons';
import { TEAM_COLORS } from './art';
import { useCRRemote } from './useCR';
import { usePrefs } from './prefs';
import { FORMAT_COPY } from '@/lib/quiz/cr/balance';
import { kindLabels } from '@/lib/quiz/types';

function Inner({ roomId, token }: { roomId: string; token: string }) {
  const [prefs, , reduced] = usePrefs(); const client = useCRRemote(roomId, 'projector', { screenToken: token, reduced }); const { snap } = client; const now = useNow(client.serverNow);
  if (client.fatal) return <main className="cr narrow"><section className="cr-card"><h1>This projector link is not valid</h1><p className="cr-why" role="alert">{client.error}</p><p>Ask the teacher to open a new one from the console.</p></section></main>;
  if (!snap) return <main className="cr screen"><p className="cr-note" role="status">Connecting…</p></main>;
  if (snap.phase === 'finished' && snap.finish) return <div className="cr screen"><CRResults snap={snap} client={client} /></div>;
  const left = snap.phase === 'race' ? (snap.live?.secondsLeft ?? 0) * 1000 : snap.deadlineMs !== null ? snap.deadlineMs - now : null; const q = snap.questionView;
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/cr/join?code=${snap.room.code}` : '';
  return (
    <div className="cr screen" data-phase={snap.phase} data-testid="cr-screen">
      <header className="cr-top"><div className="cr-title"><b>Clue Racing</b><span className="cr-chip">{FORMAT_COPY[snap.format].name} · {mapName(snap.mapId)}</span><span className="cr-chip">Leg {Math.min(snap.legs, snap.leg + 1)} / {snap.legs}</span><span className="cr-chip">{PHASE_LABEL[snap.phase]}{snap.paused ? ' · paused' : ''}</span></div>
        {left !== null && snap.phase !== 'lobby' && <span className="cr-timer big" role="timer">{fmt(left)}</span>}<ConnBadge conn={client.conn} /></header>
      {snap.phase === 'lobby' ? (
        <section className="cr-card cr-joinboard" data-testid="cr-screen-lobby">
          <div><h1>Join Clue Racing</h1><p className="cr-note">Open <b>{joinUrl.replace(/^https?:\/\//, '').split('?')[0]}</b> and type the code, or scan.</p><p className="cr-bigcode" data-testid="cr-code">{snap.room.code}</p>
            <ul className="cr-teamlist">{snap.teams.map((t, i) => <li key={t.id}><TeamBadge index={i} size={26} /><b style={{ color: TEAM_COLORS[i % 4] }}>{t.name}</b><span>{t.players} player{t.players === 1 ? '' : 's'} joined</span></li>)}</ul></div>
          {joinUrl && <Qr value={joinUrl} size={220} />}
        </section>
      ) : (
        <div className="cr-screenmain">
          <CRCanvas client={client} mode="overview" prefs={prefs} reduced={reduced} label="The current leg of the course with every team’s players shown as shapes" className="big" />
          <aside className="cr-board-side" aria-label="Teams">
            {snap.teams.map((t, i) => <div key={t.id} className="cr-teamrow"><b style={{ color: TEAM_COLORS[i % 4] }}><TeamBadge index={i} size={22} /> {t.name}</b><span>{t.players} player{t.players === 1 ? '' : 's'}</span>
              <div className="cr-progress" role="img" aria-label={`${t.name} score ${t.score} of 1000`}><span style={{ width: `${t.score / 10}%`, background: TEAM_COLORS[i % 4] }} /></div><small>Score {t.score} · mastery {t.mastery ?? 0}% · {t.legsDone} leg{t.legsDone === 1 ? '' : 's'} done{t.done ? ' · at the checkpoint' : ''}</small></div>)}
            {snap.evidence.length > 0 && snap.phase !== 'barrier' && <p className="cr-clue-side"><b>Latest clue</b> {snap.evidence[snap.evidence.length - 1]!.text}</p>}
          </aside>
        </div>
      )}
      {['barrier', 'reveal'].includes(snap.phase) && q && (
        <section className="cr-projq"><p className="cr-chip">{kindLabels[q.kind as keyof typeof kindLabels]} · race frozen</p><h2>{String(q.prompt)}</h2>{snap.question && <p className="cr-meter"><span style={{ width: `${snap.question.eligible ? (snap.question.answered / snap.question.eligible) * 100 : 0}%` }} />{snap.question.answered} / {snap.question.eligible} answered</p>}
          {snap.phase === 'reveal' && <RevealPanel snap={snap} />}</section>
      )}
      {snap.phase === 'route_choice' && <section className="cr-projq"><h2>Route board</h2><p className="cr-note">Teams are choosing a road and spending points on perks. The next leg starts when the timer ends.</p></section>}
      {snap.paused && <div className="cr-banner pause big" role="alert">Paused by the teacher</div>}
    </div>
  );
}
export default function CRScreen({ roomId }: { roomId: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { const m = /[#&]k=([A-Za-z0-9_-]{8,200})/.exec(window.location.hash); setToken(m?.[1] ?? null); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the fragment
  if (token === undefined) return <main className="cr screen"><p className="cr-note" role="status">Opening…</p></main>;
  if (!token) return <main className="cr narrow"><section className="cr-card"><h1>Projector link needed</h1><p>Open the projector screen from the teacher console so it carries its private key.</p></section></main>;
  return <Inner roomId={roomId} token={token} />;
}
