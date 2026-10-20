'use client';
/** The student's screen, for a real match and for Practice. The same component renders both; `client` decides where the world comes from. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArenaCanvas, ConnBadge, Coach, EpisodeResult, Feed, Hud, KeyHelp, ObjectiveStrip, PHASE_LABEL, PlanningBoard, QuestionBreak, RevealPanel, RolePicker, Settings, TouchControls, mapName, useKeyboard, useNow, useToast } from './ui';
import { RoleIcon, TeamBadge as TeamBadgeStub0 } from './icons';
const TeamBadgeStub = ({ index }: { index: number }) => <TeamBadgeStub0 index={index} size={18} />;
import ArenaResults from './ArenaResults';
import { beep, usePrefs } from './prefs';
import { ROLE_INFO } from './art';
import { FORMAT_COPY } from '@/lib/quiz/arena/balance';
import type { ArenaClient } from './useArena';

const COACH_KEY = 'qz:arena:coach';
export default function ArenaGame({ client, practiceBack }: { client: ArenaClient; practiceBack?: boolean }) {
  const { snap } = client; const now = useNow(client.serverNow); const [prefs, setPrefs, reduced] = usePrefs();
  const [coach, setCoach] = useState(false); const [settings, setSettings] = useState(false); const [sent, setSent] = useState(''); const [note, setNote] = useState(''); const [toast, show] = useToast();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the per-device "seen the coach" flag once after mount
  useEffect(() => { try { if (!localStorage.getItem(COACH_KEY)) setCoach(true); } catch { /* no storage: show once per visit */ } }, []);
  const closeCoach = () => { setCoach(false); try { localStorage.setItem(COACH_KEY, '1'); } catch { /* ignore */ } };
  const phase = snap?.phase ?? 'lobby'; const running = phase === 'arena_live' && !snap?.paused && !coach && !settings;
  useKeyboard(client, running, show);
  const cycle = snap?.question?.cycle ?? -1; const qkey = `${snap?.room.id}:${cycle}`;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restores "already answered this question" after a reload
  useEffect(() => { try { setSent(cycle >= 0 && sessionStorage.getItem(`qz:arena:ans:${qkey}`) ? qkey : ''); } catch { setSent(''); } }, [qkey, cycle]);
  const stageTop = useRef<HTMLDivElement>(null);
  // entering a live round puts the whole stage and the controls back on screen, wherever the planning board left the page
  useEffect(() => { if (phase === 'arena_live') stageTop.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior }); }, [phase]);
  const lastFeed = useRef(0);
  useEffect(() => { const f = client.feed[client.feed.length - 1]; if (f && f.id !== lastFeed.current) { lastFeed.current = f.id; beep(f.kind === 'warn' ? 'hit' : 'good', prefs.sound && f.kind === 'good'); } }, [client.feed, prefs.sound]);

  if (client.fatal) return <main className="ar narrow"><section className="ar-card"><h1>Can’t open this match</h1><p className="ar-why" role="alert">{client.error}</p><Link className="ar-btn" href="/quiz/arena/join">Join with a code</Link></section></main>;
  if (!snap) return <main className="ar"><p className="ar-note" role="status">Loading the arena…</p></main>;
  if (!snap.you) return <main className="ar narrow"><section className="ar-card"><h1>No seat in this match</h1><p>Join with the room code first.</p><Link className="ar-btn primary" href="/quiz/arena/join">Join</Link></section></main>;
  const you = snap.you; const mates = snap.seats.filter((s) => s.teamId === you.teamId); const myIdx = Math.max(0, snap.teams.findIndex((t) => t.id === you.teamId)); const team = snap.teams[myIdx];
  const lobby = phase === 'lobby'; const paused = !!snap.paused;
  const answer = async (r: unknown) => {
    try { await client.answer(snap.questionView!.id as string, r); try { sessionStorage.setItem(`qz:arena:ans:${qkey}`, '1'); } catch { /* ignore */ } setSent(qkey); setNote(''); }
    catch (e) { const m = (e as Error).message; if (/already|closed/i.test(m)) setSent(qkey); else setNote(m); throw e; }
  };
  if (phase === 'finished' && snap.finish) return <div className={`ar ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''}`}><ArenaResults snap={snap} client={client} practice={client.local} /></div>;
  const stageMode = phase === 'arena_live' || phase === 'question_open' || phase === 'reveal' ? 'follow' : 'overview';
  return (
    <div className={`ar ar-game ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''} ${reduced ? 'calm' : ''}`} data-phase={phase} data-testid="ar-game">
      <header className={`ar-top ${lobby ? '' : 'compact'}`}>
        <div className="ar-title">{lobby && <b>Arena Clash</b>}<span className="ar-chip"><RoleIcon role={you.role} size={20} /> {ROLE_INFO[you.role].name}</span><span className="ar-chip team"><TeamBadgeStub index={myIdx} /> {team?.name ?? 'Team'}</span>{client.local && <span className="ar-chip practice">Practice</span>}</div>
        <details className="ar-menu"><summary aria-label="Game menu">Menu</summary>
          <div className="ar-menupanel"><button type="button" className="ar-btn small" onClick={() => setCoach(true)}>How to play</button><button type="button" className="ar-btn small" onClick={() => setSettings(true)}>Display &amp; sound</button>{practiceBack && <Link className="ar-btn small ghost" href="/quiz/arena">Leave practice</Link>}</div>
        </details>
      </header>
      <ConnBadge conn={client.conn} />
      {lobby ? (
        <section className="ar-card ar-lobby" data-testid="ar-lobby">
          <h1>Get ready, {snap.seats.find((s) => s.id === you.seatId)?.name ?? 'player'}</h1>
          <p className="ar-note">{client.local ? 'Practice: your team and two rivals run the real arena with sample questions.' : <>Room code <b data-testid="ar-code">{snap.room.code}</b>. The teacher starts the match when everyone is ready.</>}</p>
          <p className="ar-note"><b>{FORMAT_COPY[snap.format].name}</b> on <b>{mapName(snap.mapId)}</b>. {FORMAT_COPY[snap.format].blurb}</p>
          <RolePicker teamSize={mates.length} value={you.role} busy={client.busy} onPick={(r) => void client.act({ kind: 'role', role: r }).then((x) => { if (!x.ok) show(x.message ?? ''); })} />
          <ul className="ar-roster" aria-label="Your team">{mates.map((s) => <li key={s.id}><RoleIcon role={s.role} size={26} /><b>{s.name}</b>{s.id === you.seatId ? ' (you)' : ''}<span>{ROLE_INFO[s.role].name}</span><span className={s.ready ? 'ok' : ''}>{s.ready ? '✓ ready' : 'not ready'}</span></li>)}</ul>
          <div className="ar-row">
            <button type="button" className="ar-btn primary big" aria-pressed={you.ready} disabled={client.busy} onClick={() => void client.act({ kind: 'ready', ready: !you.ready })}>{you.ready ? '✓ Ready — tap to undo' : 'I’m ready'}</button>
            {client.local && <button type="button" className="ar-btn primary big" onClick={() => void client.act({ kind: 'ready', ready: true }).then(() => client.host({ kind: 'start' }))}>Start practice</button>}
            <button type="button" className="ar-btn" onClick={() => setCoach(true)}>How to play</button>
          </div>
        </section>
      ) : (
        <div className="ar-stagewrap" ref={stageTop}>
          <Hud snap={snap} now={now} />
          <ObjectiveStrip snap={snap} />
          <div className="ar-stage" data-phase={phase}>
            <ArenaCanvas client={client} mode={stageMode} prefs={prefs} reduced={reduced} label={`${FORMAT_COPY[snap.format].name} on ${mapName(snap.mapId)}. ${PHASE_LABEL[phase]}. You are the ${you.role}.`} />
            <Feed feed={client.feed} />
            {toast && <div className="ar-banner" role="status">{toast}</div>}
            {phase === 'arena_live' && you.idle && <div className="ar-banner warn" role="status">You look away — move to rejoin the round</div>}
            {paused && <div className="ar-banner pause" role="alert">Paused by the teacher</div>}
            {phase === 'episode_result' && <div className="ar-banner" role="status">Round over — results below</div>}
          </div>
          <KeyHelp />
          <TouchControls client={client} snap={snap} disabled={phase !== 'arena_live' || paused} onResult={show} />
          {phase === 'planning' && <PlanningBoard snap={snap} client={client} now={now} />}
          {phase === 'episode_result' && <EpisodeResult snap={snap} />}
        </div>
      )}
      {phase === 'question_open' && snap.questionView && snap.question && <QuestionBreak snap={snap} now={now} local={client.local} onSubmit={answer} submitted={sent === qkey} />}
      {note && <p className="ar-why" role="alert">{note}</p>}
      {phase === 'reveal' && <div className="ar-revealwrap"><RevealPanel snap={snap} /></div>}
      {coach && <Coach onClose={closeCoach} format={snap.format} />}
      {settings && <Settings prefs={prefs} set={setPrefs} onClose={() => setSettings(false)} />}
    </div>
  );
}
