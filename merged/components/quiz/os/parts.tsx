'use client';
/** Shared Obstacle Survival UI pieces: HUD, connection badge, controls (keyboard + touch), role cards, the barrier question, the reveal, the checkpoint shop,
 *  the first-time coach and the display settings. Plain DOM; the only canvas is the course itself (World.tsx). */
import { useEffect, useMemo, useRef, useState } from 'react';
import QuestionPlay, { type PlayQuestion } from '@/components/quiz/QuestionPlay';
import AnswerView from '@/components/quiz/AnswerView';
import { kindLabels } from '@/lib/quiz/types';
import { PERKS, PERK_COPY, PERK_LIMIT, ROLE_COOLDOWNS, TICK_MS } from '@/lib/quiz/os/balance';
import { PERK_IDS, ROLES, type Perk, type Phase, type Role } from '@/lib/quiz/os/domain';
import { HazardIcon, KIND_NAME, KIND_NOTE, PERK_ICON, ROLE_INFO, RoleIcon, TEAM_COLORS, TEAM_MARK } from './art';
import type { OSClient, OSSnap } from './useOS';
import type { Prefs } from './prefs';
import { HAZARD_KINDS } from '@/lib/quiz/os/domain';

export const PHASE_LABEL: Record<Phase, string> = { lobby: 'Lobby', preview: 'Course preview', traversing: 'Run', barrier: 'Question', reveal: 'Review', build_choice: 'Checkpoint shop', countdown: 'Get ready', finished: 'Finished' };
export const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function useNow(serverNow: () => number, ms = 250) { const [, set] = useState(0); useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]); return serverNow(); }
export const teamIndex = (snap: OSSnap, id: string | undefined) => Math.max(0, snap.teams.findIndex((t) => t.id === id));

export function ConnBadge({ conn }: { conn: string }) {
  if (conn === 'connected') return null;
  const text = conn === 'connecting' ? 'Connecting…' : conn === 'degraded' ? 'Slow connection — still syncing' : conn === 'reconnecting' ? 'Reconnecting — your moves are saved on this device until it is back' : 'Back online — the course is refreshed';
  return <p className={`os-conn ${conn}`} role="status" data-testid="os-conn">{text}</p>;
}
export function Hud({ snap, now, local }: { snap: OSSnap; now: number; local?: boolean }) {
  const left = !local && snap.deadlineMs !== null ? snap.deadlineMs - now : null; const team = snap.teams.find((t) => t.id === snap.you?.teamId);
  return (
    <div className="os-hud" role="group" aria-label="Match status">
      <span className="os-stat"><b>CHAPTER</b> {Math.min(snap.chapters, Math.max(1, snap.chapter + (snap.phase === 'traversing' ? 1 : 0)))} / {snap.chapters}</span>
      {team && <span className="os-stat"><b>SQUAD</b> {team.name}</span>}
      {team?.points !== undefined && <span className="os-stat points"><b>POINTS</b> {team.points}</span>}
      {team && <span className="os-stat"><b>PROGRESS</b> {Math.round(team.progress / 10)}%</span>}
      <span className="os-stat phase" aria-live="polite"><b>{PHASE_LABEL[snap.phase]}</b>{left !== null && snap.phase !== 'finished' && snap.phase !== 'traversing' && snap.phase !== 'lobby' ? ` ${fmt(left)}` : ''}{snap.paused ? ' · paused' : ''}</span>
    </div>
  );
}
export function Feed({ feed }: { feed: OSClient['feed'] }) {
  return <ul className="os-feed" aria-live="polite" aria-atomic="false">{feed.map((f) => <li key={f.id} className={f.kind}>{f.text}</li>)}</ul>;
}

// ── controls ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
export function useKeyboard(input: OSClient['input'], active: boolean) {
  useEffect(() => {
    if (!active) { input.clear(); return undefined; }
    const down = new Set<string>();
    const apply = () => { const dx = (down.has('ArrowRight') || down.has('d') ? 1 : 0) - (down.has('ArrowLeft') || down.has('a') ? 1 : 0); const dy = (down.has('ArrowDown') || down.has('s') ? 1 : 0) - (down.has('ArrowUp') || down.has('w') ? 1 : 0); input.set(dx as -1 | 0 | 1, dy as -1 | 0 | 1); };
    const kd = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { down.add(k); apply(); e.preventDefault(); }
      else if (k === ' ' && !(e.target instanceof HTMLButtonElement)) { if (!e.repeat) input.hop(); e.preventDefault(); }
      else if ((k === 'e' || k === 'Shift') && !e.repeat) { input.ability(); }
    };
    const ku = (e: KeyboardEvent) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (down.delete(k)) apply(); };
    const reset = () => { down.clear(); input.clear(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', reset); input.clear(); };
  }, [input, active]);
}
/** Touch controls: a thumb pad on the left (8 directions, dead zone), Hop and Ability on the right. Every target is at least 56 px. */
export function TouchControls({ client, role, disabled }: { client: OSClient; role: Role; disabled: boolean }) {
  const pad = useRef<HTMLDivElement>(null); const [knob, setKnob] = useState({ x: 0, y: 0 }); const id = useRef<number | null>(null);
  const [cd, setCd] = useState({ hop: 0, ability: 0 }); const { cooldowns, input } = client; useEffect(() => { const t = setInterval(() => setCd(cooldowns()), 100); return () => clearInterval(t); }, [cooldowns]);
  const move = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; let x = e.clientX - cx; let y = e.clientY - cy; const m = r.width / 2; const len = Math.hypot(x, y);
    if (len > m) { x = (x / len) * m; y = (y / len) * m; } setKnob({ x, y }); const dz = m * 0.22; const dx = Math.abs(x) > dz ? (x > 0 ? 1 : -1) : 0; const dy = Math.abs(y) > dz ? (y > 0 ? 1 : -1) : 0;
    // a mostly-horizontal push does not drift vertically (and vice versa)
    const ax = Math.abs(x); const ay = Math.abs(y); const mx = ay > ax * 2.5 ? 0 : dx; const my = ax > ay * 2.5 ? 0 : dy; input.set(mx as -1 | 0 | 1, my as -1 | 0 | 1);
  };
  const end = () => { id.current = null; setKnob({ x: 0, y: 0 }); input.set(0, 0); };
  const sec = (t: number) => (t > 0 ? `${Math.ceil((t * TICK_MS) / 1000)}s` : 'ready');
  return (
    <div className="os-touch" aria-label="Touch controls" data-disabled={disabled || undefined}>
      <div ref={pad} className="os-pad" role="group" aria-label="Move pad" style={{ touchAction: 'none' }}
        onPointerDown={(e) => { if (disabled) return; id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={(e) => { if (id.current === e.pointerId) move(e); }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        <span className="os-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="os-actions">
        <button type="button" className="os-control hop" disabled={disabled} onPointerDown={(e) => { e.preventDefault(); input.hop(); }} aria-label={`Hop, ${sec(cd.hop)}`}>HOP<small>{sec(cd.hop)}</small></button>
        <button type="button" className="os-control ability" disabled={disabled} onPointerDown={(e) => { e.preventDefault(); input.ability(); }} aria-label={`${ROLE_INFO[role].ability}, ${sec(cd.ability)}`}><RoleIcon role={role} size={22} />{ROLE_INFO[role].ability}<small>{sec(cd.ability)}</small></button>
      </div>
    </div>
  );
}
export function KeyHelp() { return <p className="os-keys" aria-label="Keyboard controls"><kbd>←↑↓→</kbd> or <kbd>WASD</kbd> move · <kbd>Space</kbd> hop · <kbd>E</kbd> ability</p>; }

// ── lobby ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Recommended role sets by squad size (OS-F05). One student gets ONE balanced solo kit; larger squads see every role with the ones that complement their size marked. */
export const SOLO_ROLE: Role = 'trailblazer';
export const ROLE_SETS: Record<number, readonly Role[]> = { 1: [SOLO_ROLE], 2: ['trailblazer', 'medic'], 3: ['trailblazer', 'medic', 'shieldbearer'], 4: ['trailblazer', 'medic', 'shieldbearer', 'bridgewright'], 5: ROLES };
export function RolePicker({ value, onPick, busy, squadSize = 5 }: { value: Role | null; onPick: (r: Role) => void; busy: boolean; squadSize?: number }) {
  const n = Math.max(1, Math.min(5, squadSize)); const rec = ROLE_SETS[n];
  if (n === 1) {
    return (
      <fieldset className="os-roles solo"><legend>YOUR RUNNER <small>a balanced solo kit — no choices needed</small></legend>
        <div className="os-rolegrid one">
          <div className="os-role" data-role={SOLO_ROLE} aria-current="true"><RoleIcon role={SOLO_ROLE} size={64} /><b>{ROLE_INFO[SOLO_ROLE].name}</b><small>{ROLE_INFO[SOLO_ROLE].ability}</small><small className="desc">{ROLE_INFO[SOLO_ROLE].short}</small><span className="os-choose">✓ Your kit</span></div>
        </div>
        <p className="os-note">Teammates unlock more roles: with 2 or more students in a squad you can pick from {ROLES.length - 1} team roles that cover for each other.</p>
        {value !== SOLO_ROLE && <button type="button" className="os-btn small" disabled={busy} onClick={() => onPick(SOLO_ROLE)}>Use the solo kit</button>}
      </fieldset>
    );
  }
  return (
    <fieldset className="os-roles"><legend>CHOOSE A ROLE <small>{n} in your squad: we suggest {rec.map((r) => ROLE_INFO[r].name).join(', ')}</small></legend>
      <div className="os-rolegrid">
        {ROLES.map((r) => (
          <button key={r} type="button" className="os-role" data-role={r} data-rec={rec.includes(r) || undefined} aria-pressed={value === r} disabled={busy} onClick={() => onPick(r)}>
            <RoleIcon role={r} size={56} /><b>{ROLE_INFO[r].name}</b><small>{ROLE_INFO[r].ability}</small><small className="desc">{ROLE_INFO[r].short}</small>
            <span className="os-choose">{value === r ? '✓ Chosen' : rec.includes(r) ? 'Suggested for your squad' : 'Choose role'}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export const COACH = [
  { title: 'Move', body: 'Use the arrow keys or WASD — on a phone, drag the pad. Stay on the path.' },
  { title: 'Watch the warning', body: 'A dashed outline and “!” mean “about to hurt”. A solid shape means “hurts now”. Wait, then go.' },
  { title: 'Hop to dodge', body: 'Hop (Space or the HOP button) lifts you over a hazard for a moment. It needs a short rest between hops.' },
  { title: 'Questions freeze the world', body: 'At each gate the world freezes and the class answers one question. Speed earns nothing; correct answers earn points to spend at the checkpoint shop.' },
];
export function Coach({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0); const ref = useRef<HTMLHeadingElement>(null); useEffect(() => { ref.current?.focus(); }, [i]);
  return (
    <div className="os-coach" role="dialog" aria-modal="true" aria-labelledby="os-coach-h">
      <div className="os-card">
        <p className="os-step">How to play · {i + 1} of {COACH.length}</p>
        <h2 id="os-coach-h" ref={ref} tabIndex={-1}>{COACH[i].title}</h2><p>{COACH[i].body}</p>
        {i === 1 && <div className="os-icons">{(['spikes', 'swipe_bar', 'laser_grid'] as const).map((k) => <span key={k}><HazardIcon kind={k} size={40} state="warn" /><small>warning</small><HazardIcon kind={k} size={40} state="active" /><small>now</small></span>)}</div>}
        <div className="os-row">
          {i > 0 && <button type="button" className="os-btn" onClick={() => setI(i - 1)}>Back</button>}
          {i < COACH.length - 1 ? <button type="button" className="os-btn primary" onClick={() => setI(i + 1)}>Next</button> : <button type="button" className="os-btn primary" onClick={onClose}>Got it</button>}
          <button type="button" className="os-btn ghost" onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  );
}
export function HazardLegend() {
  return (
    <details className="os-legend"><summary>Hazard guide (12)</summary>
      <ul>{HAZARD_KINDS.map((k) => <li key={k}><HazardIcon kind={k} size={34} /><span><b>{KIND_NAME[k]}</b> {KIND_NOTE[k]}</span></li>)}</ul>
    </details>
  );
}
function PrefRow({ prefs, set, k, label, hint }: { prefs: Prefs; set: (p: Partial<Prefs>) => void; k: keyof Prefs; label: string; hint: string }) {
  return <label className="os-switch"><input type="checkbox" checked={prefs[k]} onChange={(e) => set({ [k]: e.target.checked })} /><span><b>{label}</b><small>{hint}</small></span></label>;
}
export function Settings({ prefs, set, onClose }: { prefs: Prefs; set: (p: Partial<Prefs>) => void; onClose: () => void }) {
  return (
    <div className="os-coach" role="dialog" aria-modal="true" aria-label="Display and sound">
      <div className="os-card"><h2>Display &amp; sound</h2>
        <PrefRow prefs={prefs} set={set} k="reduceMotion" label="Reduce motion" hint="Stops wobble, blinking and camera ease. Warnings still show as outlines." />
        <PrefRow prefs={prefs} set={set} k="lowFx" label="Simple graphics" hint="Draws fewer decorations. Helps on older phones." />
        <PrefRow prefs={prefs} set={set} k="contrast" label="High contrast" hint="Black outlines on white panels." />
        <PrefRow prefs={prefs} set={set} k="large" label="Larger text" hint="Bigger labels and buttons." />
        <PrefRow prefs={prefs} set={set} k="sound" label="Sound effects" hint="Off by default. Short beeps for hits and good news." />
        <button type="button" className="os-btn primary" onClick={onClose}>Done</button></div>
    </div>
  );
}

// ── question barrier ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function BarrierQuestion({ snap, now, local, onSubmit, submitted }: { snap: OSSnap; now: number; local: boolean; onSubmit: (r: unknown) => Promise<unknown>; submitted: boolean }) {
  const q = snap.question!; const b = snap.barrier!; const head = useRef<HTMLHeadingElement>(null); useEffect(() => { head.current?.focus(); }, [b.phaseId]);
  const left = local ? null : b.deadlineMs - now;
  return (
    <div className="os-quiz" role="dialog" aria-modal="true" aria-labelledby="os-q-head" data-testid="os-barrier">
      <div className="os-quizcard">
        <header className="os-quizhead">
          <h2 id="os-q-head" ref={head} tabIndex={-1}>QUESTION {Math.min(snap.chapters, snap.chapter + 1)} / {snap.chapters}</h2>
          <span>{kindLabels[q.kind as keyof typeof kindLabels]}</span>
          <span className="os-freeze">❄ Course frozen — nobody can be hurt</span>
          {left !== null && <span className={`os-timer ${left < 10_000 ? 'low' : ''}`} role="timer" aria-label={`Time left ${fmt(left)}`}>TIME {fmt(left)}</span>}
        </header>
        {snap.tip && <p className="os-tip"><b>Help:</b> {snap.tip}</p>}
        {submitted ? <div className="os-submitted" role="status"><p className="big">✓ Answer sent</p><p>{local ? 'Nice.' : `The course stays frozen until everyone has answered or time is up. ${b.answered} of ${b.eligible} in your squad have answered.`}</p></div>
          : <QuestionPlay question={q as unknown as PlayQuestion} onSubmit={onSubmit} submitLabel="Submit answer" readAloud />}
        <p className="os-note">Every teammate gets the same reading time. Speed earns nothing. Only your own answer counts toward your squad’s points.</p>
      </div>
    </div>
  );
}
export function RevealPanel({ snap }: { snap: OSSnap }) {
  const q = snap.question; const key = (q as { answerKey?: unknown } | null)?.answerKey; const mine = snap.mine;
  const verdict = mine === null || mine === undefined ? 'You did not answer this one — that is fine. Read the explanation.' : mine >= 1000 ? 'Correct!' : mine > 0 ? `Partly correct (${Math.round(mine / 10)}%).` : 'Not this time — here is why.';
  return (
    <section className="os-reveal" aria-live="polite" data-testid="os-reveal">
      <h2>REVIEW ANSWER</h2>
      <p className={`os-verdict ${mine && mine >= 1000 ? 'good' : 'review'}`}>{verdict}</p>
      {snap.award != null && <p className="os-award">{snap.award > 0 ? `+${snap.award} points for your squad` : 'No points for the squad this time'}</p>}
      {q && key ? <AnswerView kind={String(q.kind)} payload={q.payload as never} answerKey={key as never} /> : null}
    </section>
  );
}

// ── shop ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const REASONS: Record<string, string> = { APPROVAL_PENDING: 'Waiting for your teacher to answer your last request',  INSUFFICIENT_POINTS: 'Not enough points', PERK_LIMIT: 'Limit reached', WRONG_PHASE: 'Shop is closed', STALE_REVISION: 'A teammate just spent points' };
export function Shop({ snap, client }: { snap: OSSnap; client: OSClient }) {
  const team = snap.teams.find((t) => t.id === snap.you?.teamId); const points = team?.points ?? 0; const owned = snap.perks ?? {}; const [msg, setMsg] = useState('');
  const waiting = snap.approvals ?? []; const askAt = snap.approvalAbove ?? 0;
  const buy = async (perk: Perk) => { const r = await client.act({ kind: 'purchase', perk }); setMsg(r.ok ? (r.note === 'approval_requested' ? `Asked your teacher about ${PERK_COPY[perk].name}. Points are only spent if they say yes.` : `${PERK_COPY[perk].name} bought for the whole squad.`) : (REASONS[r.code ?? ''] ?? r.message ?? 'That did not work.')); };
  return (
    <section className="os-shop" aria-label="Checkpoint shop" data-testid="os-shop">
      <header><h2>CHECKPOINT SHOP</h2><p className="os-points"><b>{points}</b> points to spend — shared by your squad</p></header>
      <ul>
        {PERK_IDS.map((p) => { const n = owned[p] ?? 0; const full = n >= PERK_LIMIT[p]; const poor = points < PERKS[p]; const why = full ? 'Limit reached' : poor ? `Need ${PERKS[p] - points} more points` : null;
          return (
            <li key={p} className={full ? 'full' : poor ? 'poor' : ''}>
              <span className="os-perkicon" aria-hidden="true">{PERK_ICON[p]}</span>
              <span className="body"><b>{PERK_COPY[p].name}</b><small>{PERK_COPY[p].blurb}</small><small>Owned {n} of {PERK_LIMIT[p]}</small></span>
              <span className="cost">{PERKS[p]} pts</span>
              <button type="button" className="os-btn small primary" disabled={client.busy || !!why} onClick={() => void buy(p)} aria-describedby={`why-${p}`}>{askAt > 0 && PERKS[p] >= askAt ? 'Ask teacher' : 'Buy'}</button>
              <span id={`why-${p}`} className={`os-tag ${full ? 'taken' : poor ? 'points' : 'ok'}`}>{why ?? 'Available'}</span>
            </li>); })}
      </ul>
      {waiting.length > 0 && <ul className="os-waiting" aria-label="Requests waiting for the teacher">{waiting.map((w) => <li key={w.id}>{w.seatName || 'A teammate'} asked for <b>{PERK_COPY[w.perk].name}</b> ({w.price} pts) — waiting for the teacher</li>)}</ul>}
      {msg && <p className="os-note" role="status">{msg}</p>}
      <p className="os-note">Points are the only currency. Spending is final and the same for every squadmate.</p>
    </section>
  );
}
export function Countdown({ snap, now }: { snap: OSSnap; now: number }) {
  const left = snap.deadlineMs !== null ? Math.max(0, Math.ceil((snap.deadlineMs - now) / 1000)) : 0;
  return <div className="os-countdown" role="status" aria-live="assertive" data-testid="os-countdown"><span>{left > 0 ? left : 'GO'}</span><small>Next chapter</small></div>;
}
export const roleName = (r: Role) => ROLE_INFO[r].name;
export const squadMark = (i: number) => ({ color: TEAM_COLORS[i % TEAM_COLORS.length], mark: TEAM_MARK[i % TEAM_MARK.length] });
export const useCooldownSeconds = (ticks: number) => useMemo(() => Math.ceil((ticks * TICK_MS) / 1000), [ticks]);
export const ROLE_COOLDOWN_SECONDS = Object.fromEntries(ROLES.map((r) => [r, Math.round((ROLE_COOLDOWNS[r] * TICK_MS) / 1000)])) as Record<Role, number>;
