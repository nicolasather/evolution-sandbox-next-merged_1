'use client';
import type { Loose } from '@/lib/quiz/loose';
/** The screens a student or teacher sees around the arena. Everything shown comes from the server snapshot; buttons send intent and say why they are disabled. */
import { useEffect, useRef, useState } from 'react';
import QuestionPlay, { type PlayQuestion } from '../QuestionPlay';
import AnswerView from '../AnswerView';
import type { SwarmConnection } from '@/lib/swarm/client/connection';
import { ROLES, type Role } from '@/lib/swarm/domain';
import { rolesForSquad, ROLE_REASON } from '@/lib/swarm/balance';
import { ROLE_DEFS, UPGRADE_DEFS } from '@/lib/swarm/balance';
import { drawRole } from '@/lib/swarm/render/sprites';
import { theme } from '@/lib/swarm/render/palette';
import type { UpgradeKind } from '@/lib/swarm/domain';
import type { Prefs } from './prefs';

type A = Record<string, Loose>;
export const fmtClock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const PHASE_LABEL: Record<string, string> = { lobby: 'Lobby', role_pick: 'Choose roles', countdown: 'Get ready', wave: 'Wave', boss_wave: 'Boss wave', freeze: 'Question coming', question: 'Question', grade: 'Answer', upgrade: 'Upgrade', ready: 'Resuming', ending: 'Match over', results: 'Results' };
export const PAUSE_TEXT: Record<string, string> = { teacher: 'The teacher paused the match.', host_away: 'The teacher’s screen disconnected. The match waits for them.', everyone_offline: 'Everyone on this team lost connection, so the match paused.', worker_restarted: 'The game server restarted. The teacher will resume the match.' };

/** a ticking clock that re-reads the server time every 250 ms and holds still while paused */
export function useCountdown(conn: SwarmConnection | null, targetMs: number | null | undefined, paused: boolean): number | null {
  const [, set] = useState(0); const [held, setHeld] = useState<number | null>(null);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), 250); return () => clearInterval(t); }, []);
  useEffect(() => {
    // capture the remaining time at the moment of the pause; clear it when running again
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeld(paused && targetMs != null && conn ? targetMs - conn.serverNow() : null);
  }, [paused, targetMs, conn]);
  if (targetMs == null || !conn) return null;
  if (paused && held !== null) return held;
  return targetMs - conn.serverNow();
}

export function RoleBadge({ role, size = 52, hc = false }: { role: Role; size?: number; hc?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (!c) return; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = size * dpr; c.height = size * dpr; const g = c.getContext('2d')!; g.scale((size * dpr) / 48, (size * dpr) / 48); drawRole(g, theme(hc, true), role, 24, 28, { t: 0, face: 0.3, moving: false, down: false, hit: 0, firing: 0, ability: 0, shield: false, offline: false, protectedUntil: false, revive: 0, downFrac: 0, seed: 1 }, 1); }, [role, size, hc]);
  return <canvas ref={ref} className="sw-badge" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function ConnBadge({ conn }: { conn: SwarmConnection }) {
  const st = conn.status; if (st === 'connected') return null;
  const text: Record<string, string> = { connecting: 'Connecting to the game…', degraded: 'Slow connection — still syncing', reconnecting: 'Connection lost — reconnecting. Your avatar is protected for a few seconds.', replaced: 'This match was opened in another tab. Close this one or reload to take over here.', ended: 'This match has ended.', fatal: conn.lastError || 'Could not stay connected.' };
  return <p className={`sw-conn ${st}`} role="status" data-testid="conn">{text[st] ?? st}{(st === 'replaced' || st === 'fatal') && <> <button type="button" className="sw-btn small" onClick={() => location.reload()}>Reload</button></>}</p>;
}

export function Hud({ conn }: { conn: SwarmConnection }) {
  const m = conn.s.meta as A | undefined; const team = ((conn.s.teams as A[] | undefined) ?? []).find((t) => t.id === (conn.s.me?.team ?? m?.focus)); const arena = conn.s.arena as A | undefined;
  const left = useCountdown(conn, m?.phase === 'ready' || m?.phase === 'countdown' ? m?.resumeAtMs ?? m?.phaseEndsMs : null, !!m?.paused);
  if (!m) return null; const pct = arena ? Math.round((100 * arena.beacon.hp) / Math.max(1, arena.beacon.max)) : 100;
  return (
    <div className="sw-hud" role="group" aria-label="Match status">
      <span className="sw-stat"><b>Wave</b> {Math.max(0, m.wave)} / {m.waves}</span>
      <span className="sw-stat beacon"><b>Beacon</b> {pct}%<span className="sw-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span></span>
      {team?.wallet !== undefined && <span className="sw-stat"><b>Points</b> {team.wallet}</span>}
      <span className="sw-stat" aria-live="polite" data-testid="phase"><b>{PHASE_LABEL[m.phase] ?? m.phase}</b>{left !== null && left > 0 ? ` ${Math.ceil(left / 1000)}` : ''}{m.paused ? ' · paused' : ''}</span>
    </div>
  );
}

export function PauseOverlay({ conn }: { conn: SwarmConnection }) {
  const m = conn.s.meta as A | undefined; if (!m?.paused) return null;
  return <div className="sw-overlay" role="alertdialog" aria-live="assertive" aria-label="Match paused" data-testid="paused"><div className="sw-card"><h2>Paused</h2><p>{PAUSE_TEXT[m.pauseReason as string] ?? 'The match is paused.'}</p><p className="sw-note">Nothing in the arena moves while paused. Your answer time stops too.</p></div></div>;
}

/** Roles and readiness before the match starts. */
export function LobbyPanel({ conn, prefs }: { conn: SwarmConnection; prefs: Prefs }) {
  const m = conn.s.meta as A; const me = conn.s.me as A | undefined; const roster = (conn.s.roster as A[]) ?? []; const lobby = m.phase === 'lobby'; const squad = Math.max(1, roster.length); const open = rolesForSquad(squad);
  return (
    <section className="sw-card" aria-labelledby="sw-lobby-h" data-testid="lobby">
      <h2 id="sw-lobby-h">{lobby ? 'Waiting for the teacher' : 'Choose your role'}</h2>
      <p>{lobby ? 'You are in. Pick a role now or wait for the teacher to open the role screen. Everyone answers questions, whatever the role.' : 'Everyone answers questions and earns points together. Your role is how you move and fight in the arena.'}</p>
      <ul className="sw-roles" role="radiogroup" aria-label="Role">
        {(ROLES.filter((r) => open.includes(r) || me?.role === r)).map((r) => { const d = ROLE_DEFS[r]; const on = me?.role === r; return (
          <li key={r}><button type="button" role="radio" aria-checked={on} className={`sw-role ${on ? 'on' : ''}`} style={{ ['--rc' as string]: d.color }} onClick={() => conn.role(r)} data-testid={`role-${r}`}>
            <RoleBadge role={r} hc={prefs.contrast} /><span><b>{d.label}</b><small>{d.blurb}</small><small className="sw-ab">Ability: {d.ability}</small></span>
          </button></li>); })}
      </ul>
      <p className="sw-note" data-testid="role-reason">{ROLE_REASON[Math.min(5, squad)]}</p>
      <p className="sw-note">Roles are a choice of play style, not a rank. Two people can share a role.</p>
      <h3>Your team ({roster.length})</h3>
      <ul className="sw-roster" aria-label="Team members">{roster.map((p) => <li key={p.id}><RoleBadge role={p.role} size={28} hc={prefs.contrast} /><span>{p.name}{p.id === me?.id ? ' (you)' : ''}{p.cap ? ' · captain' : ''}</span><em className={p.on ? 'on' : 'off'}>{p.on ? (p.ready ? 'ready' : 'online') : 'offline'}</em></li>)}</ul>
      {!lobby && <button type="button" className="sw-btn primary" aria-pressed={!!me?.ready} onClick={() => conn.ready(!me?.ready)} data-testid="ready">{me?.ready ? 'Ready ✓ (tap to undo)' : 'I am ready'}</button>}
      <p className="sw-note" aria-live="polite">{m.hostPresent ? 'The teacher starts the match when everyone is in.' : 'The teacher’s screen is not connected yet.'}</p>
    </section>
  );
}

/** The question window: the world is frozen for everyone while this is on screen. */
export function QuestionPanel({ conn, readAloud }: { conn: SwarmConnection; readAloud: boolean }) {
  const q = conn.s.quiz as A | undefined; const me = conn.s.me as A | undefined; const m = conn.s.meta as A; const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const left = useCountdown(conn, q && q.status === 'open' ? q.deadlineMs : null, !!m.paused);
  if (m.phase === 'freeze') return <section className="sw-card" aria-live="assertive" data-testid="freeze"><h2>Question coming</h2><p>Everything in the arena stands still while the team answers.</p></section>;
  if (!q?.question) return <section className="sw-card" data-testid="question-wait"><h2>Question</h2><p>Loading the question…</p></section>;
  const total = q.eligibleTotal as number, got = q.answeredTotal as number; const reveal = !!q.reveal; const pq = q.question as PlayQuestion & { answerKey?: A };
  const submit = async (response: unknown) => {
    setErr('');
    try { const r = await conn.answer(q.w as string, response); if (!r.ok) { setErr(r.message ?? 'That answer was not accepted.'); throw new Error(r.message); } } catch (e) { if (!err) setErr((e as Error).message); throw e; }
  };
  return (
    <section className="sw-card sw-q" aria-labelledby="sw-q-h" data-testid="question">
      <div className="sw-qhead"><h2 id="sw-q-h">{reveal ? 'Answer' : `Question ${q.index + 1} of ${q.total}`}</h2>
        {!reveal && left !== null && <span className={`sw-timer ${left < 8000 ? 'low' : ''}`} role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>{fmtClock(left)}</span>}
        <span className="sw-note" data-testid="answered-count">{got} of {total} on your team answered</span></div>
      {!reveal && !me?.answered && <QuestionPlay liveRound key={q.w} question={pq} onSubmit={submit} readAloud={readAloud} disabled={!!m.paused || (left !== null && left <= 0)} onHint={(pq as A).hasHint ? async () => { const h = await conn.hint(q.w); setInfo(h ?? ''); return h; } : undefined} />}
      {!reveal && me?.answered && <p className="sw-ok" role="status" data-testid="locked">Answer locked in. Waiting for teammates — the arena stays frozen until everyone answers or time ends.</p>}
      {!reveal && info && <p className="sw-note">Hint: {info}</p>}
      {err && <p className="sw-err" role="alert">{err}</p>}
      {reveal && (
        <div data-testid="reveal">
          {me?.result ? <p className={me.result.correct ? 'sw-ok' : 'sw-warn'} role="status">{me.result.correct ? 'You got it right.' : me.result.frac > 0 ? `Partly right — ${Math.round(me.result.frac * 100)}% credit.` : 'Not this time.'}</p> : <p className="sw-warn" role="status">You did not answer this one.</p>}
          {typeof q.awarded === 'number' && <p className="sw-award" role="status">Your team earned <b>{q.awarded}</b> points.</p>}
          {pq.answerKey && <AnswerView kind={pq.kind} payload={pq.payload} answerKey={pq.answerKey} />}
        </div>
      )}
    </section>
  );
}

const CAT: Record<string, string> = { attack: 'Attack', survival: 'Survival', utility: 'Utility' };
/** Spend the team's points: everyone votes, the server applies the result once. */
export function DraftPanel({ conn, readOnly }: { conn: SwarmConnection; readOnly?: boolean }) {
  const d = conn.s.draft as A | undefined; const m = conn.s.meta as A; const team = ((conn.s.teams as A[]) ?? []).find((t) => t.id === (conn.s.me?.team ?? m.focus)); const left = useCountdown(conn, d && !d.resolved ? d.closesMs : null, !!m.paused);
  if (!d) return <section className="sw-card"><h2>Upgrades</h2><p>Loading offers…</p></section>;
  const wallet = (team?.wallet as number | undefined) ?? 0;
  return (
    <section className="sw-card sw-draft" aria-labelledby="sw-d-h" data-testid="draft">
      <div className="sw-qhead"><h2 id="sw-d-h">Team upgrade</h2>{left !== null && <span className="sw-timer" role="timer">{fmtClock(left)}</span>}<span className="sw-note">Team points: <b>{wallet}</b></span></div>
      {d.resolved ? (
        <p className="sw-ok" role="status" data-testid="draft-result">{d.resolved.upgrade ? `Your team bought ${UPGRADE_DEFS[d.resolved.upgrade as UpgradeKind].label} for ${d.resolved.cost} points.` : 'Your team saved its points this time.'} Points left: {d.resolved.walletAfter}.</p>
      ) : <p>Vote for one upgrade. The most votes wins; ties go to the cheaper one. If nobody can afford any, the points are kept.</p>}
{m.captainOnly && !(conn.s.me as A | undefined)?.cap && <p className="sw-warn" role="status">Only your captain chooses upgrades in this match. You can see the offers.</p>}
      <ul className="sw-offers">
        {(d.offers as A[]).map((o) => { const def = UPGRADE_DEFS[o.id as UpgradeKind]; const need = o.cost - wallet; const mine = d.myVote === o.id; return (
          <li key={o.id}><div className={`sw-offer ${mine ? 'mine' : ''} ${o.affordable ? '' : 'poor'}`}>
            <h3>{def.label}<small>{CAT[def.category]} · level {o.level + 1} of {o.max}</small></h3><p>{def.effect}</p>
            <p className="sw-cost"><b>{o.cost}</b> points{!o.affordable && <span className="sw-need"> · Need {need} more points</span>}</p>
            <p className="sw-note">{o.votes} vote{o.votes === 1 ? '' : 's'}</p>
            {!readOnly && !d.resolved && <button type="button" className="sw-btn" aria-pressed={mine} disabled={!o.affordable || !!m.paused || (!!m.captainOnly && !(conn.s.me as A | undefined)?.cap)} onClick={() => conn.vote(d.id as string, o.id as string)} data-testid={`vote-${o.id}`}>{mine ? 'Your vote ✓' : o.affordable ? 'Vote' : `Need ${need} more points`}</button>}
          </div></li>); })}
      </ul>
      <p className="sw-note">Points come only from correct answers. They are not lost if you wait.</p>
    </section>
  );
}

export function ReadyBanner({ conn }: { conn: SwarmConnection }) {
  const m = conn.s.meta as A; const left = useCountdown(conn, m.phase === 'ready' || m.phase === 'countdown' ? m.resumeAtMs ?? m.phaseEndsMs : null, !!m.paused);
  return <section className="sw-card sw-resume" aria-live="assertive" data-testid="resume"><h2>{m.phase === 'countdown' ? 'The first wave is coming' : `Wave ${m.wave + 1} starts`}</h2><p className="sw-big">{left !== null ? Math.max(1, Math.ceil(left / 1000)) : '…'}</p><p className="sw-note">Get your finger on the stick. The arena stays still until the count ends.</p></section>;
}
