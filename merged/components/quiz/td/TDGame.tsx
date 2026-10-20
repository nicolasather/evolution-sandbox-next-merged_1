'use client';
/** The student screen. One layout, three information priorities (reference 12): BUILD puts the map and costs first, ANSWER makes the question the
 *  only thing on screen (the battle is frozen on the server and not drawn), BATTLE puts the enemy flow first. Every action waits for the
 *  server; a refused action says why. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Board, { type WaveSummary } from './Board';
import { Art, BuildMenu, ConnBadge, EnemyLegend, Hud, Opponents, QuestionOverlay, RevealPanel, RolePicker, Ticker, TowerCard, WaveResultPanel, TEAM_SWATCH, useNow } from './parts';
import Results from './Results';
import type { TDClient } from './useTD';
import { ROLES } from '@/lib/quiz/td/balance';
import { roleSVG } from '@/lib/quiz/td/art';
import { MAPS } from '@/lib/quiz/td/maps';
import type { TDSeat, TDState, TDTeam, TDTowerKind } from '@/lib/quiz/td/domain';

type Prefs = { calm: boolean; large: boolean; contrast: boolean };
function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  const [p, set] = useState<Prefs>({ calm: false, large: false, contrast: false });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved preferences after hydration
  useEffect(() => { try { const raw = localStorage.getItem('qz:td:prefs'); const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; set((x) => ({ ...x, ...(raw ? JSON.parse(raw) : {}), calm: raw ? JSON.parse(raw).calm ?? !!reduce : !!reduce })); } catch { /* storage off */ } }, []);
  return [p, (n) => set((cur) => { const v = { ...cur, ...n }; try { localStorage.setItem('qz:td:prefs', JSON.stringify(v)); } catch { /* storage off */ } return v; })];
}

export default function TDGame({ client, practice = false }: { client: TDClient; practice?: boolean }) {
  const { snap } = client; const now = useNow(client.serverNow);
  const [prefs, setPrefs] = usePrefs();
  const [pad, setPad] = useState<string | null>(null); const [tower, setTower] = useState<string | null>(null); const [hover, setHover] = useState<TDTowerKind | null>(null);
  const [moving, setMoving] = useState(false); const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [submittedQ, setSubmittedQ] = useState<string | null>(null); const [personal, setPersonal] = useState<Record<string, unknown> | null>(null); const [personalDone, setPersonalDone] = useState(false);
  const [summary, setSummary] = useState<WaveSummary | null>(null); const [salvoMode, setSalvoMode] = useState(false); const [reinforceMode, setReinforceMode] = useState(false);
  const phase = snap?.phase;
  // a new phase closes stale menus (the board may have changed under them)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per-phase UI
  useEffect(() => { setPad(null); setMoving(false); setSalvoMode(false); setReinforceMode(false); if (phase !== 'wave') setSummary(null); }, [phase, snap?.round]);

  const me: TDSeat | null = useMemo(() => (snap ? (snap.seats.find((s) => s.id === snap.selfSeatId) as unknown as TDSeat) ?? null : null), [snap]);
  const team = useMemo(() => (snap && snap.selfTeamId ? (snap.teams.find((t) => t.id === snap.selfTeamId) as TDTeam) : null), [snap]);
  if (client.fatal) return <main className="td narrow"><section className="td-panel"><h1>Can’t open this match</h1><p className="td-why">{client.error}</p><Link className="td-btn" href="/quiz/td/join">Join with a code</Link></section></main>;
  if (!snap) return <main className="td"><p className="td-note" role="status">Connecting to the match…</p></main>;
  const state = snap as unknown as TDState; // the projection carries the full own-squad state the previews need
  const round = snap.rounds[snap.rounds.length - 1] ?? null;
  const waveInput = team && round?.waveInput ? round.waveInput[team.id] ?? null : null;
  const seatFull = me ? ({ ...me, usedThisWave: me.usedThisWave ?? [], answersThisRound: me.answersThisRound ?? 0, answered: 0, correct: 0, partial: 0, joinedAtMs: 0 } as TDSeat) : null;
  const selTower = team?.towers.find((t) => t.id === tower) ?? null;
  const say = (r: { ok: boolean; message?: string; note?: string }, okText?: string) => setMsg(r.ok ? (okText || r.note ? { text: r.note === 'NEEDS_APPROVAL' ? 'Sent to the teacher for approval.' : okText!, tone: 'ok' } : null) : { text: r.message ?? 'That did not work.', tone: 'err' });
  const act = async (a: Parameters<TDClient['act']>[0], okText?: string) => { const r = await client.act(a); say(r, okText); return r.ok; };

  const onPad = async (padId: string) => {
    if (moving && selTower) { if (await act({ kind: 'move', towerId: selTower.id, padId }, 'Tower moved.')) { setMoving(false); setTower(null); } return; }
    setTower(null); setPad(padId === pad ? null : padId);
  };
  const onTower = async (id: string) => {
    if (reinforceMode) { if (await act({ kind: 'ability', ability: 'reinforce', towerId: id }, 'Reinforced for the next wave (+15% range).')) setReinforceMode(false); return; }
    setPad(null); setTower(id === tower ? null : id); setMoving(false);
  };
  const quizOpen = phase === 'quiz_open' && !!snap.question && !!me?.teamId && submittedQ !== (snap.question?.id as string);
  const showQuestion = phase === 'quiz_open' && !!snap.question && !!me?.teamId;
  const ability = me?.role ? ROLES[me.role].ability : null; const usedAbility = !!(ability && me?.usedThisWave?.includes(ability));
  const independent = snap.config.questionFlow === 'independent';
  const ready = !!me?.ready;
  const lobby = phase === 'lobby' || phase === 'countdown';
  const map = MAPS[snap.config.mapId];

  return (
    <div className={`td ${prefs.large ? 'large' : ''} ${prefs.contrast ? 'contrast' : ''} ${prefs.calm ? 'td-calm' : ''}`} data-phase={phase} style={{ ['--td-map' as string]: map.palette.accent }}>
      <header className="td-top">
        <div className="td-title"><span className="td-squad"><i style={{ background: team ? TEAM_SWATCH[team.colorIndex] : '#999' }} aria-hidden="true" />{team?.name ?? 'Waiting for a squad'}</span>{practice && <span className="td-chip">Practice · nothing is saved</span>}</div>
        <Hud snap={snap} team={team} now={now} />
        <div className="td-prefs" role="group" aria-label="Display">
          <button type="button" className="td-btn ghost small" aria-pressed={prefs.calm} onClick={() => setPrefs({ calm: !prefs.calm })}>Calm</button>
          <button type="button" className="td-btn ghost small" aria-pressed={prefs.large} onClick={() => setPrefs({ large: !prefs.large })}>Large text</button>
          <button type="button" className="td-btn ghost small" aria-pressed={prefs.contrast} onClick={() => setPrefs({ contrast: !prefs.contrast })}>Contrast</button>
        </div>
      </header>
      <ConnBadge conn={client.conn} />
      {snap.paused && <p className="td-banner" role="status">{snap.paused.reason === 'host_offline' ? 'Paused: the teacher’s screen is offline.' : 'The teacher paused the game.'}</p>}
      {msg && <p className={`td-toast ${msg.tone}`} role={msg.tone === 'err' ? 'alert' : 'status'} onAnimationEnd={() => undefined}>{msg.text} <button type="button" className="td-x" onClick={() => setMsg(null)} aria-label="Dismiss">×</button></p>}

      {lobby && me && (
        <main className="td-lobby">
          <section className="td-panel td-joincard">
            <h1>{phase === 'countdown' ? `Starting in ${Math.max(0, Math.ceil(((snap.phaseDeadlineMs ?? now) - now) / 1000))}` : 'Get ready'}</h1>
            <p className="td-note">{snap.config.format === 'coop' ? 'Your class defends one core together.' : `Squads defend identical maps. Waves cleared rank first, then core health, then accuracy.`} {snap.plan.waves} waves · about {snap.plan.minutes} minutes.</p>
            <fieldset className="td-teams"><legend>TEAM</legend>
              {snap.teams.map((t) => { const n = snap.seats.filter((s) => s.teamId === t.id && !s.revoked).length; return (
                <button key={t.id} type="button" className="td-teambtn" aria-pressed={me.teamId === t.id} disabled={client.busy || phase !== 'lobby' || (me.teamId !== t.id && n >= snap.config.teamSizeCap)} onClick={() => void act({ kind: 'team', teamId: t.id })}>
                  <i style={{ background: TEAM_SWATCH[t.colorIndex] }} aria-hidden="true" /><b>{t.name}</b><small>{'players' in t ? (t as { players: number }).players : n} / {snap.config.teamSizeCap}</small></button>); })}
            </fieldset>
            {!me.teamId && <p className="td-why">All squads are full. The teacher will place you.</p>}
            <RolePicker value={me.role} busy={client.busy} onPick={(r) => void act({ kind: 'role', role: r })} />
            <button type="button" className={`td-btn big ${ready ? '' : 'primary'}`} disabled={client.busy || !me.teamId || phase !== 'lobby'} aria-pressed={ready} onClick={() => void act({ kind: 'ready', ready: !ready })}>{ready ? '✓ READY — tap to undo' : 'READY'}</button>
            {practice && <button type="button" className="td-btn primary big" disabled={client.busy} onClick={() => void client.host({ kind: 'start' })}>Start practice</button>}
          </section>
          <section className="td-panel td-mapprev"><h2>{map.title}</h2><Board mapId={snap.config.mapId} towers={[]} phase="lobby" waveInput={null} waveStartMs={null} pausedAtMs={null} serverNow={client.serverNow} calm showPads={false} selectedPad={null} selectedTower={null} ghost={null} label={`${map.title}: the lane runs from the gate on the left to the core on the right.`} coreHP={team?.coreHP ?? 24} maxCoreHP={team?.maxCoreHP ?? 24} interactive={false} />
            <p className="td-note">Answer questions to earn points. Spend points on towers between waves. Enemies walk the lane; protect the core.</p></section>
        </main>
      )}

      {!lobby && phase !== 'finished' && team && (
        <main className={`td-play ${showQuestion ? 'frozen' : ''}`}>
          <div className="td-boardcol">
            {!showQuestion && <Board mapId={snap.config.mapId} towers={team.towers} phase={snap.phase} waveInput={waveInput} waveStartMs={round?.waveStartMs ?? null} pausedAtMs={snap.paused?.atMs ?? null} serverNow={client.serverNow}
              calm={prefs.calm} showPads={phase === 'build'} selectedPad={pad} selectedTower={tower} ghost={pad && hover ? { padId: pad, kind: hover } : null} onSelectPad={(id) => void onPad(id)} onSelectTower={(id) => void onTower(id)}
              label={`${map.title} board, ${team.towers.length} towers. ${phase === 'wave' ? 'A wave is running.' : ''}`} coreHP={team.coreHP} maxCoreHP={team.maxCoreHP} reinforced={team.armed.reinforce} salvo={team.armed.salvo} onSummary={setSummary} lowFx={typeof window !== 'undefined' && window.innerWidth < 700} />}
            {salvoMode && phase === 'build' && (
              <div className="td-salvo" role="group" aria-label="Choose where the salvo lands">
                <p>Mark a spot along the lane (from the gate to the core):</p>
                <div className="td-row">{[150, 300, 450, 600, 750, 900].map((m) => <button key={m} type="button" className="td-btn small" onClick={() => void act({ kind: 'ability', ability: 'salvo', at: m }, 'Salvo marked.').then((ok) => ok && setSalvoMode(false))}>{Math.round(m / 10)}%</button>)}</div>
              </div>
            )}
            {phase === 'wave' && summary && (
              <details className="td-unitlist"><summary>Wave as a list ({summary.alive} enemies on the lane)</summary>
                <p>Core {summary.core} / {team.maxCoreHP}. Defeated {summary.kills}. Reached the core {summary.leaks}.</p>
                <ul>{Object.entries(summary.byKind).map(([k, n]) => <li key={k}>{n} × {k}</li>)}</ul>
                {summary.boss && <p>{summary.boss.name}: {Math.round((summary.boss.hp / summary.boss.max) * 100)}% health{summary.boss.warn ? ` — ${summary.boss.warn}` : ''}</p>}
              </details>
            )}
          </div>
          <aside className="td-rail" aria-label="Your squad">
            {phase === 'build' && seatFull && pad && !moving && <BuildMenu state={state} seat={seatFull} padId={pad} busy={client.busy} onHover={setHover} onBuild={(k) => void act({ kind: 'build', padId: pad, tower: k }, 'Tower built.').then((ok) => ok && setPad(null))} />}
            {seatFull && selTower && <TowerCard state={state} seat={seatFull} tower={selTower} busy={client.busy} moving={moving} onMove={() => setMoving((m) => !m)} onAction={(a) => void act(a, a.kind === 'sell' ? 'Tower sold.' : a.kind === 'upgrade' ? 'Upgraded.' : 'Done.').then((ok) => ok && a.kind === 'sell' && setTower(null))} />}
            {phase === 'build' && !pad && !selTower && (
              <section className="td-panel">
                <h3>BUILD</h3>
                <p className="td-note">Tap an empty pad to build, or a tower to upgrade, sell or move it. {team.points < 120 ? 'Answer correctly to earn more points.' : ''}</p>
                {team.scanned && <><p className="td-note">Scan: the next wave brings</p><EnemyLegend kinds={team.scanned} /></>}
                {round?.wave && <><p className="td-note">This wave:</p><EnemyLegend kinds={round.wave.archetypes} /></>}
              </section>
            )}
            {phase === 'build' && me?.role && ability && (
              <section className="td-panel td-ability">
                <div className="td-row"><Art svg={roleSVG(me.role)} size={36} /><b>{ROLES[me.role].name}</b></div>
                <p className="td-note">{ROLES[me.role].active}</p>
                <button type="button" className="td-btn" disabled={client.busy || usedAbility || (ability === 'reinforce' && !team.towers.length)} onClick={() => {
                  if (ability === 'salvo') setSalvoMode(true); else if (ability === 'reinforce') { setReinforceMode(true); setMsg({ text: 'Tap one of your towers to reinforce it.', tone: 'ok' }); }
                  else void act({ kind: 'ability', ability }, 'Armed for the next wave.');
                }}>{usedAbility ? 'Used this wave' : 'Use ability'}</button>
                {me.role === 'tactician' && <p className="td-note">One free targeting change per wave.</p>}
              </section>
            )}
            {phase === 'build' && (
              <section className="td-panel td-readybox">
                <p className="td-note">{snap.seats.filter((s) => s.teamId === team.id && s.ready && !s.revoked).length} of {snap.seats.filter((s) => s.teamId === team.id && !s.revoked).length} ready. The wave starts when everyone is ready or the time runs out.</p>
                <button type="button" className={`td-btn big ${ready ? '' : 'primary'}`} disabled={client.busy || !!team.pending.length} aria-pressed={ready} onClick={() => void act({ kind: 'ready', ready: !ready })}>{ready ? '✓ READY' : 'READY'}</button>
                {team.pending.length > 0 && <p className="td-why">Waiting for the teacher to approve {team.pending.length} purchase{team.pending.length > 1 ? 's' : ''}.</p>}
                {snap.config.modifiers.includes('secret_wager') && <WagerBox team={team} busy={client.busy} onSet={(n) => void act({ kind: 'wager', amount: n }, n ? `Stake of ${n} set for the next question.` : 'Stake withdrawn.')} />}
              </section>
            )}
            {independent && ['build', 'wave', 'wave_result'].includes(phase ?? '') && (
              <section className="td-panel">
                <h3>YOUR QUESTIONS</h3>
                <p className="td-note">{me?.answersThisRound ?? 0} of {snap.plan.personalCap} this round. Towers keep defending while you answer.</p>
                <button type="button" className="td-btn primary" disabled={client.busy || (me?.answersThisRound ?? 0) >= snap.plan.personalCap && !personal} onClick={async () => { try { setPersonal(await client.openPersonal()); setPersonalDone(false); } catch (e) { setMsg({ text: (e as Error).message, tone: 'err' }); } }}>Answer a question</button>
              </section>
            )}
            {phase === 'reveal' && <RevealPanel snap={snap} question={snap.question} />}
            {phase === 'wave_result' && <WaveResultPanel team={team} />}
            {phase === 'wave' && round?.wave && <section className="td-panel"><h3>WAVE {round.n}</h3><EnemyLegend kinds={round.wave.archetypes} />{round.wave.boss && <p className="td-note">Boss: watch for the warning above it — every effect is announced a second ahead.</p>}</section>}
            <Opponents snap={snap} />
            <section className="td-panel"><h3>SQUAD</h3><ul className="td-roster">{snap.seats.filter((s) => s.teamId === team.id && !s.revoked).map((s) => <li key={s.id}>{s.role ? <Art svg={roleSVG(s.role)} size={22} /> : <span className="td-dot" />}{s.name}{s.id === snap.selfSeatId ? ' (you)' : ''}{phase === 'build' && s.ready ? ' ✓' : ''}</li>)}</ul><Ticker team={team} seats={snap.seats} /></section>
          </aside>
          {showQuestion && snap.question && <QuestionOverlay snap={snap} question={snap.question} now={now} submitted={!quizOpen} onSubmit={async (r) => { const out = await client.answer(String(snap.question!.id), r); if (out.accepted) setSubmittedQ(String(snap.question!.id)); return out; }} />}
          {personal && <QuestionOverlay snap={snap} question={personal} now={now} personal submitted={personalDone} onClose={() => setPersonal(null)} onSubmit={async (r) => { const out = await client.answer(String(personal.id), r); setPersonalDone(true); setMsg({ text: out.correct ? `Correct — +${out.awarded ?? 0} points for your squad.` : 'Not this time. The explanation appears in the review at the end.', tone: 'ok' }); return out; }} />}
        </main>
      )}
      {!lobby && phase !== 'finished' && !team && <main className="td narrow"><section className="td-panel"><h1>Waiting for a squad</h1><p className="td-note">Every squad is full. The teacher can move you into one between waves.</p></section></main>}
      {phase === 'finished' && <Results snap={snap} client={client} practice={practice} />}
    </div>
  );
}

function WagerBox({ team, busy, onSet }: { team: TDTeam; busy: boolean; onSet: (n: number) => void }) {
  const [v, setV] = useState(''); const cap = Math.min(100, team.points); const n = Number(v); const ok = v !== '' && Number.isInteger(n) && n >= 0 && n <= cap;
  return (
    <div className="td-wager"><p className="td-note">Secret Wager: stake 0–{cap} on the next question. At least half of your squad correct wins it; otherwise it is lost.{team.wager > 0 ? ` Current stake: ${team.wager}.` : ''}</p>
      <div className="td-row"><input type="number" min={0} max={cap} value={v} onChange={(e) => setV(e.target.value)} aria-label="Stake in points" /><button type="button" className="td-btn small" disabled={busy || !ok} onClick={() => onSet(n)}>Set stake</button></div></div>
  );
}
