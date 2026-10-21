'use client';
/** The student's screen, for a real race and for Practice. The same component renders both; `client` decides where the world comes from.
 *  During play the map fills the viewport. The only always-visible controls are the status bar (with one Menu button), the one-line objective, and at most two action buttons. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CRCanvas, Coach, ClueBoard, ConnBadge, Feed, KeyHelp, ObjectiveStrip, PHASE_LABEL, QuestionBreak, RevealPanel, RolePicker, RouteBoard, Settings, StatusBar, TouchControls, mapName, useKeyboard, useNow, useToast } from './ui';
import { RoleIcon as RoleIconStub, TeamBadge } from './icons';
import CRResults from './CRResults';
import { beep, usePrefs } from './prefs';
import { ROLE_INFO } from './art';
import { FORMAT_COPY } from '@/lib/quiz/cr/balance';
import type { Role } from '@/lib/quiz/cr/domain';
import type { CRClient } from './useCR';

const COACH_KEY = 'qz:cr:coach';
export default function CRGame({ client, practiceBack }: { client: CRClient; practiceBack?: boolean }) {
  const { snap } = client; const now = useNow(client.serverNow); const [prefs, setPrefs, reduced] = usePrefs();
  const [coach, setCoach] = useState(false); const [settings, setSettings] = useState(false); const [clues, setClues] = useState(false); const [menu, setMenu] = useState(false); const [sent, setSent] = useState(''); const [note, setNote] = useState(''); const [toast, show] = useToast();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the per-device "seen the coach" flag once after mount
  useEffect(() => { try { if (!localStorage.getItem(COACH_KEY)) setCoach(true); } catch { /* no storage: show once per visit */ } }, []);
  const closeCoach = () => { setCoach(false); try { localStorage.setItem(COACH_KEY, '1'); } catch { /* ignore */ } };
  const phase = snap?.phase ?? 'lobby'; const modal = coach || settings || clues; const running = phase === 'race' && !snap?.paused && !modal;
  useKeyboard(client, running, show);
  const win = snap?.question?.window ?? -1; const qkey = `${snap?.room.id}:${win}`;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restores "already answered this question" after a reload
  useEffect(() => { try { setSent(win >= 0 && sessionStorage.getItem(`qz:cr:ans:${qkey}`) ? qkey : ''); } catch { setSent(''); } }, [qkey, win]);
  const lastFeed = useRef(0);
  useEffect(() => { const f = client.feed[client.feed.length - 1]; if (f && f.id !== lastFeed.current) { lastFeed.current = f.id; beep(f.kind === 'warn' ? 'hit' : 'good', prefs.sound && f.kind === 'good'); } }, [client.feed, prefs.sound]);

  if (client.fatal) return <main className="cr narrow"><section className="cr-card"><h1>Can’t open this race</h1><p className="cr-why" role="alert">{client.error}</p><Link className="cr-btn" href="/quiz/cr/join">Join with a code</Link></section></main>;
  if (!snap) return <main className="cr"><p className="cr-note" role="status">Loading the course…</p></main>;
  if (!snap.you) return <main className="cr narrow"><section className="cr-card"><h1>No seat in this race</h1><p>Join with the room code first.</p><Link className="cr-btn primary" href="/quiz/cr/join">Join</Link></section></main>;
  const you = snap.you; const mates = snap.seats.filter((s) => s.teamId === you.teamId); const myIdx = Math.max(0, snap.teams.findIndex((t) => t.id === you.teamId)); const team = snap.teams[myIdx];
  const lobby = phase === 'lobby'; const paused = !!snap.paused;
  const answer = async (r: unknown) => {
    try { await client.answer(snap.questionView!.id as string, r); try { sessionStorage.setItem(`qz:cr:ans:${qkey}`, '1'); } catch { /* ignore */ } setSent(qkey); setNote(''); }
    catch (e) { const m = (e as Error).message; if (/already|closed/i.test(m)) setSent(qkey); else setNote(m); throw e; }
  };
  if (phase === 'finished' && snap.finish) return <div className={`cr ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''}`}><CRResults snap={snap} client={client} practice={client.local} /></div>;
  const taken = mates.filter((s) => s.id !== you.seatId).map((s) => s.role) as Role[];
  const countdownLeft = phase === 'countdown' && snap.deadlineMs !== null ? Math.max(0, Math.ceil((snap.deadlineMs - now) / 1000)) : null;
  return (
    <div className={`cr cr-game ${lobby ? 'is-lobby' : 'is-play'} ${prefs.contrast ? 'contrast' : ''} ${prefs.large ? 'large' : ''} ${reduced ? 'calm' : ''}`} data-phase={phase} data-testid="cr-game">
      {lobby ? (
        <>
          <header className="cr-top"><div className="cr-title"><b>Clue Racing</b><span className="cr-chip"><TeamBadge index={myIdx} size={18} /> {team?.name ?? 'Team'}</span>{client.local && <span className="cr-chip practice">Practice</span>}</div></header>
          <ConnBadge conn={client.conn} />
          <section className="cr-card cr-lobby" data-testid="cr-lobby">
            <h1>Get ready, {snap.seats.find((s) => s.id === you.seatId)?.name ?? 'player'}</h1>
            <p className="cr-note">{client.local ? 'Practice: you are the Solo Pathfinder against scripted rivals, with sample questions. Nothing is saved.' : <>Room code <b data-testid="cr-code">{snap.room.code}</b>. The teacher starts the race when everyone is ready.</>}</p>
            <p className="cr-note"><b>{FORMAT_COPY[snap.format].name}</b> on <b>{mapName(snap.mapId)}</b>. {FORMAT_COPY[snap.format].blurb}</p>
            <RolePicker teamSize={mates.length} value={you.role} busy={client.busy} taken={taken} onPick={(r) => void client.act({ kind: 'role', role: r }).then((x) => { if (!x.ok) show(x.message ?? ''); })} />
            <ul className="cr-roster" aria-label="Your team">{mates.map((s) => <li key={s.id}><RoleIconStub role={s.role} size={26} /><b>{s.name}</b>{s.id === you.seatId ? ' (you)' : ''}<span>{ROLE_INFO[s.role].name}</span><span className={s.ready ? 'ok' : ''}>{s.ready ? '✓ ready' : 'not ready'}</span></li>)}</ul>
            {toast && <p className="cr-why" role="status">{toast}</p>}
            <div className="cr-row">
              <button type="button" className="cr-btn primary big" aria-pressed={you.ready} disabled={client.busy} onClick={() => void client.act({ kind: 'ready', ready: !you.ready })}>{you.ready ? '✓ Ready — tap to undo' : 'I’m ready'}</button>
              {client.local && <button type="button" className="cr-btn primary big" data-testid="cr-practice-start" onClick={() => void client.act({ kind: 'ready', ready: true }).then(() => client.host({ kind: 'start' }))}>Start practice</button>}
              <button type="button" className="cr-btn" onClick={() => setCoach(true)}>How to play</button>
            </div>
          </section>
        </>
      ) : (
        <div className="cr-stagewrap">
          <div className="cr-stage" data-phase={phase}>
            <CRCanvas client={client} mode="follow" prefs={prefs} reduced={reduced} label={`${FORMAT_COPY[snap.format].name} on ${mapName(snap.mapId)}. ${PHASE_LABEL[phase]}. You are the ${ROLE_INFO[you.role].name}.`} />
          </div>
          <StatusBar snap={snap} now={now}>
            <button type="button" className="cr-menubtn" aria-expanded={menu} aria-controls="cr-menupanel" onClick={() => setMenu((v) => !v)} data-testid="cr-menu">Menu</button>
          </StatusBar>
          {menu && (
            <div id="cr-menupanel" className="cr-menupanel" role="menu">
              <button type="button" className="cr-btn small" role="menuitem" onClick={() => { setClues(true); setMenu(false); }}>Clue board</button>
              <button type="button" className="cr-btn small" role="menuitem" onClick={() => { setCoach(true); setMenu(false); }}>How to play</button>
              <button type="button" className="cr-btn small" role="menuitem" onClick={() => { setSettings(true); setMenu(false); }}>Display &amp; sound</button>
              {practiceBack && <Link className="cr-btn small ghost" role="menuitem" href="/quiz/cr">Leave practice</Link>}
              <KeyHelp />
            </div>
          )}
          <ConnBadge conn={client.conn} />
          <Feed feed={client.feed} />
          {toast && <div className="cr-banner" role="status">{toast}</div>}
          {phase === 'race' && you.idle && <div className="cr-banner warn" role="status">You look away — move to rejoin the race</div>}
          {paused && <div className="cr-banner pause" role="alert">Paused by the teacher</div>}
          {countdownLeft !== null && <div className="cr-countdown" role="status" aria-live="assertive"><b>{countdownLeft}</b><span>{FORMAT_COPY[snap.format].name} · {mapName(snap.mapId)}</span></div>}
          {phase === 'checkpoint' && <div className="cr-banner good" role="status">Checkpoint! The race freezes for the next clue question.</div>}
          <ObjectiveStrip snap={snap} onOpen={() => setClues(true)} />
          <TouchControls client={client} snap={snap} disabled={phase !== 'race' || paused || modal} onResult={show} />
          {phase === 'reveal' && <div className="cr-sheet"><RevealPanel snap={snap} /></div>}
          {phase === 'route_choice' && <div className="cr-sheet"><RouteBoard snap={snap} client={client} now={now} /></div>}
        </div>
      )}
      {phase === 'barrier' && snap.questionView && snap.question && <QuestionBreak snap={snap} now={now} local={client.local} onSubmit={answer} submitted={sent === qkey} />}
      {note && <p className="cr-why cr-floatwhy" role="alert">{note}</p>}
      {clues && <ClueBoard snap={snap} onClose={() => setClues(false)} />}
      {coach && <Coach onClose={closeCoach} format={snap.format} />}
      {settings && <Settings prefs={prefs} set={setPrefs} onClose={() => setSettings(false)} />}
      
    </div>
  );
}
