'use client';
/** The student's screen, for a real match and for practice. The same component renders both; `client` decides where the world comes from. */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import World from './World';
import OSResults from './OSResults';
import { BarrierQuestion, Coach, ConnBadge, Countdown, Feed, Hud, HazardLegend, KeyHelp, PHASE_LABEL, RevealPanel, RolePicker, Settings, Shop, TouchControls, teamIndex, useKeyboard, useNow, fmt } from './parts';
import { RoleIcon, TEAM_COLORS, TEAM_MARK, ROLE_INFO } from './art';
import { beep, usePrefs } from './prefs';
import type { OSClient } from './useOS';

const COACH_KEY = 'qz:os:coach';
export default function OSGame({ client, practiceBack }: { client: OSClient; practiceBack?: boolean }) {
  const { snap } = client; const now = useNow(client.serverNow); const [prefs, setPrefs, reduced] = usePrefs();
  const [coach, setCoach] = useState(false); const [settings, setSettings] = useState(false); const [sent, setSent] = useState<string>(''); const [note, setNote] = useState('');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the per-device "seen the coach" flag once after mount
  useEffect(() => { try { if (!localStorage.getItem(COACH_KEY)) setCoach(true); } catch { /* no storage: show once per visit */ } }, []);
  const closeCoach = () => { setCoach(false); try { localStorage.setItem(COACH_KEY, '1'); } catch { /* ignore */ } };
  const phase = snap?.phase ?? 'lobby'; const running = phase === 'traversing' && !snap?.paused && !coach && !settings;
  useKeyboard(client.input, running);
  const phaseId = snap?.barrier?.phaseId ?? '';
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restores "already answered this question" after a reload
  useEffect(() => { try { setSent(phaseId && sessionStorage.getItem(`qz:os:ans:${snap?.room.id}:${phaseId}`) ? phaseId : ''); } catch { setSent(''); } }, [phaseId, snap?.room.id]);
  const lastFeed = useRef(0);
  useEffect(() => { const f = client.feed[client.feed.length - 1]; if (f && f.id !== lastFeed.current) { lastFeed.current = f.id; beep(f.kind === 'hit' ? 'hit' : f.kind === 'good' ? 'good' : 'tick', prefs.sound && f.kind !== 'info'); } }, [client.feed, prefs.sound]);
  const getFrame = useCallback(() => client.frame(), [client]);

  if (client.fatal) return <main className="os narrow"><section className="os-card"><h1>Can’t open this match</h1><p className="os-why" role="alert">{client.error}</p><Link className="os-btn" href="/quiz/os/join">Join with a code</Link></section></main>;
  if (!snap) return <main className="os"><p className="os-note" role="status">Loading the course…</p></main>;
  if (!snap.you) return <main className="os narrow"><section className="os-card"><h1>No seat in this match</h1><p>Join with the room code first.</p><Link className="os-btn primary" href="/quiz/os/join">Join</Link></section></main>;
  const you = snap.you; const mySquad = teamIndex(snap, you.teamId); const team = snap.teams.find((t) => t.id === you.teamId);
  const lobby = phase === 'lobby'; const paused = !!snap.paused;
  const answer = async (r: unknown) => {
    try { await client.answer(snap.question!.id as string, r); try { sessionStorage.setItem(`qz:os:ans:${snap.room.id}:${phaseId}`, '1'); } catch { /* ignore */ } setSent(phaseId); setNote(''); }
    catch (e) { const m = (e as Error).message; if (/already|closed/i.test(m)) setSent(phaseId); else setNote(m); throw e; }
  };
  if (phase === 'finished' && snap.finish) return <div className={`os ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''}`}><OSResults snap={snap} client={client} practice={client.local} /></div>;
  const stunned = (() => { const f = client.frame(); return !!f?.me && f.me.stunUntil > f.me.tick; })();
  return (
    <div className={`os os-game ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''} ${reduced ? 'calm' : ''}`} data-phase={phase} data-testid="os-game">
      <header className={`os-top ${lobby ? '' : 'compact'}`}>
        <div className="os-title">{lobby && <b>Obstacle Survival</b>}<span className="os-chip"><RoleIcon role={you.role} size={20} /> {ROLE_INFO[you.role].name}</span><span className="os-chip squad" style={{ borderColor: TEAM_COLORS[mySquad % 4] }}>{TEAM_MARK[mySquad % 4]} {team?.name ?? 'Squad'}</span></div>
        <details className="os-menu"><summary aria-label="Game menu">Menu</summary>
          <div className="os-menupanel"><button type="button" className="os-btn small" onClick={() => setCoach(true)}>How to play</button><button type="button" className="os-btn small" onClick={() => setSettings(true)}>Display &amp; sound</button>{practiceBack && <Link className="os-btn small ghost" href="/quiz/os">Leave practice</Link>}</div>
        </details>
      </header>
      <ConnBadge conn={client.conn} />
      {lobby ? (
        <section className="os-card os-lobby" data-testid="os-lobby">
          <h1>Get ready, {snap.seats.find((s) => s.id === you.seatId)?.name ?? 'runner'}</h1>
          <p className="os-note">Room code <b data-testid="os-code">{snap.room.code}</b>. The teacher starts the match when everyone is ready.</p>
          <RolePicker squadSize={snap.seats.filter((x) => x.teamId === you.teamId).length} taken={snap.seats.filter((x) => x.teamId === you.teamId && x.id !== you.seatId).map((x) => x.role)} value={you.role} busy={client.busy} onPick={(r) => void client.act({ kind: 'role', role: r })} />
          <ul className="os-roster" aria-label="Your squad">{snap.seats.filter((s) => s.teamId === you.teamId).map((s) => <li key={s.id}><RoleIcon role={s.role} size={26} /><b>{s.name}</b>{s.id === you.seatId ? ' (you)' : ''}<span>{ROLE_INFO[s.role].name}</span><span className={s.ready ? 'ok' : ''}>{s.ready ? '✓ ready' : 'not ready'}</span></li>)}</ul>
          <div className="os-row"><button type="button" className="os-btn primary big" aria-pressed={you.ready} disabled={client.busy} onClick={() => void client.act({ kind: 'ready', ready: !you.ready })}>{you.ready ? '✓ Ready — tap to undo' : 'I’m ready'}</button><button type="button" className="os-btn" onClick={() => setCoach(true)}>How to play</button></div>
          <HazardLegend />
          {client.local && <p className="os-note">Practice: the same course, offline. Nothing is saved.</p>}
        </section>
      ) : (
        <div className="os-stagewrap">
          <Hud snap={snap} now={now} local={client.local} />
          <div className="os-stage" data-phase={phase}>
            <World getFrame={getFrame} reduced={reduced} lowFx={prefs.lowFx} label={`Course: ${you.role}, chapter ${snap.chapter + 1} of ${snap.chapters}. ${PHASE_LABEL[phase]}.`} />
            <Feed feed={client.feed} />
            {phase === 'preview' && <div className="os-banner" role="status">Course preview — study the route. {snap.deadlineMs !== null && !client.local ? fmt(snap.deadlineMs - now) : ''}</div>}
            {phase === 'traversing' && stunned && <div className="os-banner hit" role="status">Stunned — hold on…</div>}
            {paused && <div className="os-banner pause" role="alert">Paused by the teacher</div>}
            {phase === 'countdown' && <Countdown snap={snap} now={now} />}
          </div>
          <KeyHelp />
          <TouchControls client={client} role={you.role} disabled={phase !== 'traversing' || paused} />
          {phase === 'build_choice' && <Shop snap={snap} client={client} />}
          <HazardLegend />
        </div>
      )}
      {phase === 'barrier' && snap.question && snap.barrier && <BarrierQuestion snap={snap} now={now} local={client.local} onSubmit={answer} submitted={sent === phaseId} />}
      {note && <p className="os-why" role="alert">{note}</p>}
      {phase === 'reveal' && <div className="os-revealwrap"><RevealPanel snap={snap} />{client.local && client.resume && <button type="button" className="os-btn primary" onClick={client.resume}>Keep running</button>}</div>}
      {coach && <Coach onClose={closeCoach} />}
      {settings && <Settings prefs={prefs} set={setPrefs} onClose={() => setSettings(false)} />}
    </div>
  );
}
