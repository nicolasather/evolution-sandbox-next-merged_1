'use client';
/** Shared Arena Clash UI: the canvas stage, controls (keyboard + touch), HUD, the quiz break, the planning board, the role picker, coach and display settings.
 *  Plain DOM around one canvas. Every interactive target is ≥ 44 px; colour is never the only cue (team shape marks, text labels). */
import { useCallback, useEffect, useRef, useState } from 'react';
import QuestionPlay, { type PlayQuestion } from '@/components/quiz/QuestionPlay';
import AnswerView from '@/components/quiz/AnswerView';
import { kindLabels } from '@/lib/quiz/types';
import { FORMAT_COPY, HELPER_COPY, TICK_MS } from '@/lib/quiz/arena/balance';
import { HELPERS, ROLES, type Helper, type Phase, type Role } from '@/lib/quiz/arena/domain';
import { MAP_INFO } from '@/lib/quiz/arena/maps';
import { FormatIcon, HelperIcon, RoleIcon, TeamBadge } from './icons';
import { ROLE_INFO, ROLE_SETS, TEAM_COLORS } from './art';
import { drawArena } from './render';
import type { ArenaClient, ArenaSnap } from './useArena';
import type { Prefs } from './prefs';

export const PHASE_LABEL: Record<Phase, string> = { lobby: 'Lobby', question_open: 'Quiz break', reveal: 'Answer review', planning: 'Planning board', arena_live: 'Arena live', episode_result: 'Round result', finished: 'Finished' };
export const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function useNow(serverNow: () => number, ms = 250) { const [, set] = useState(0); useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]); return serverNow(); }

export function ConnBadge({ conn }: { conn: string }) {
  if (conn === 'connected') return null;
  const text = conn === 'connecting' ? 'Connecting…' : conn === 'degraded' ? 'Slow connection — still syncing' : conn === 'reconnecting' ? 'Reconnecting — your team keeps playing, and your moves resume when you are back' : 'Back online — the arena is refreshed';
  return <p className={`ar-conn ${conn}`} role="status" data-testid="ar-conn">{text}</p>;
}

// ── canvas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function ArenaCanvas({ client, mode, prefs, reduced, label, className = '' }: { client: ArenaClient; mode: 'follow' | 'overview'; prefs: Prefs; reduced: boolean; label: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = box.current; const c = cv.current; if (!el || !c) return undefined; const g = c.getContext('2d'); if (!g) return undefined;
    let w = 0; let h = 0; let raf = 0; let last = 0; let alive = true; let cam: { x: number; y: number } | null = null; const t0 = performance.now();
    const size = () => { const r = el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height)); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); const ro = new ResizeObserver(size); ro.observe(el);
    const loop = (t: number) => {
      if (!alive) return; raf = requestAnimationFrame(loop);
      if (document.hidden || t - last < (reduced || prefs.lowFx ? 50 : 16)) return; last = t;
      const f = client.frame(); if (!f) return; const me = f.dots.find((d) => d.mine);
      const target = mode === 'follow' ? (me ? { x: me.x, y: me.y } : { x: 600, y: 600 }) : null;
      if (target) { if (!cam || reduced || Math.hypot(cam.x - target.x, cam.y - target.y) > 260) cam = { ...target }; else cam = { x: cam.x + (target.x - cam.x) * 0.16, y: cam.y + (target.y - cam.y) * 0.16 }; } else cam = null;
      drawArena(g, f, { width: w, height: h, mode, center: cam, time: (t - t0) / 1000, reduced, lowFx: prefs.lowFx, mini: mode === 'follow', contrast: prefs.contrast });
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [client, mode, reduced, prefs.lowFx, prefs.contrast]);
  return <div ref={box} className={`ar-world ${className}`}><canvas ref={cv} role="img" aria-label={label} data-testid="ar-canvas" /></div>;
}

// ── HUD ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function Hud({ snap, now }: { snap: ArenaSnap; now: number }) {
  const my = snap.teams.find((t) => t.id === snap.you?.teamId); const idx = Math.max(0, snap.teams.findIndex((t) => t.id === my?.id));
  const left = snap.live && snap.phase === 'arena_live' ? snap.live.secondsLeft : snap.deadlineMs !== null ? Math.ceil((snap.deadlineMs - now) / 1000) : null;
  return (
    <div className="ar-hud" role="group" aria-label="Match status">
      <span className="ar-pill team" style={{ borderColor: TEAM_COLORS[idx % 4] }}><TeamBadge index={idx} size={18} /> {my?.name ?? 'Team'}</span>
      <span className="ar-pill"><b>ROUND</b> {Math.min(snap.cycles, snap.cycle + 1)}/{snap.cycles}</span>
      {my && <span className="ar-pill" title="Score so far"><b>SCORE</b> {my.score}</span>}
      {my?.wallet !== undefined && <span className="ar-pill pts"><b>POINTS</b> {my.wallet}</span>}
      <span className="ar-pill phase" aria-live="polite"><b>{PHASE_LABEL[snap.phase]}</b>{left !== null && snap.phase !== 'lobby' && snap.phase !== 'finished' ? ` ${snap.phase === 'arena_live' ? `${left}s` : fmt(left * 1000)}` : ''}{snap.paused ? ' · paused' : ''}</span>
    </div>
  );
}
export function Feed({ feed }: { feed: ArenaClient['feed'] }) { return <ul className="ar-feed" aria-live="polite" aria-atomic="false">{feed.map((f) => <li key={f.id} className={f.kind}>{f.text}</li>)}</ul>; }
/** What the teams stand on right now: two clean lines, never a wall of numbers. */
export function ObjectiveStrip({ snap }: { snap: ArenaSnap }) {
  const l = snap.live; if (!l || snap.phase !== 'arena_live') return null;
  const r = l.rotate; const next = r?.next; const secs = r ? Math.ceil((r.inTicks * TICK_MS) / 1000) : 0;
  const msg = snap.format === 'control' ? (next ? `Zones switch in ${secs}s — get ready to move` : `Hold two live zones. Next switch in ${secs}s`) : snap.format === 'relay' ? (l.banner?.carrier ? 'Banner is carried — pass it or take it home' : l.banner?.resetIn !== null && l.banner ? `Banner dropped — it returns in ${Math.ceil(((l.banner.resetIn ?? 0) * TICK_MS) / 1000)}s` : 'Grab the banner in the middle') : 'Collect crystals, then drop them at your vault';
  return <p className="ar-strip" role="status"><FormatIcon format={snap.format} size={18} /> {msg}<span className="ar-strip-t">{l.secondsLeft}s left</span></p>;
}

// ── controls ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
export function useKeyboard(client: ArenaClient, active: boolean, onResult: (m: string) => void) {
  const { input } = client;
  useEffect(() => {
    if (!active) { input.clear(); return undefined; }
    const down = new Set<string>();
    const apply = () => { const x = (down.has('ArrowRight') || down.has('d') ? 1 : 0) - (down.has('ArrowLeft') || down.has('a') ? 1 : 0); const y = (down.has('ArrowDown') || down.has('s') ? 1 : 0) - (down.has('ArrowUp') || down.has('w') ? 1 : 0); const m = Math.hypot(x, y) || 1; input.set(x / m, y / m); };
    const fire = async (a: 'ability' | 'pass') => { const r = await client.act({ kind: a }); if (!r.ok) onResult(r.message ?? 'Not right now.'); else if (r.note) onResult(r.note); };
    const kd = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { down.add(k); apply(); e.preventDefault(); }
      else if ((k === ' ' || k === 'e') && !e.repeat && !(e.target instanceof HTMLButtonElement)) { void fire('ability'); e.preventDefault(); }
      else if (k === 'f' && !e.repeat) void fire('pass');
    };
    const ku = (e: KeyboardEvent) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (down.delete(k)) apply(); };
    const reset = () => { down.clear(); input.clear(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', reset); input.clear(); };
  }, [client, input, active, onResult]);
}
/** Touch controls: an analog thumb pad on the left, ability (and Pass in the relay) on the right. Every target is at least 56 px. */
export function TouchControls({ client, snap, disabled, onResult }: { client: ArenaClient; snap: ArenaSnap; disabled: boolean; onResult: (m: string) => void }) {
  const pad = useRef<HTMLDivElement>(null); const [knob, setKnob] = useState({ x: 0, y: 0 }); const pid = useRef<number | null>(null); const [cd, setCd] = useState({ left: 0, max: 1 });
  const { cooldown, input } = client; useEffect(() => { const t = setInterval(() => setCd(cooldown()), 100); return () => clearInterval(t); }, [cooldown]);
  const role = snap.you?.role ?? 'runner';
  const move = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect(); let x = e.clientX - (r.left + r.width / 2); let y = e.clientY - (r.top + r.height / 2); const m = r.width / 2; const len = Math.hypot(x, y);
    if (len > m) { x = (x / len) * m; y = (y / len) * m; } setKnob({ x, y }); const dz = m * 0.16; input.set(Math.hypot(x, y) < dz ? 0 : x / m, Math.hypot(x, y) < dz ? 0 : y / m);
  };
  const end = () => { pid.current = null; setKnob({ x: 0, y: 0 }); input.set(0, 0); };
  const fire = async (a: 'ability' | 'pass') => { const r = await client.act({ kind: a }); onResult(r.ok ? r.note ?? '' : r.message ?? 'Not right now.'); };
  const sec = Math.ceil((cd.left * TICK_MS) / 1000);
  return (
    <div className="ar-touch" aria-label="Touch controls" data-disabled={disabled || undefined}>
      <div ref={pad} className="ar-pad" role="group" aria-label="Move pad" style={{ touchAction: 'none' }}
        onPointerDown={(e) => { if (disabled) return; pid.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={(e) => { if (pid.current === e.pointerId) move(e); }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        <span className="ar-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="ar-actions">
        {snap.format === 'relay' && snap.you?.banner && <button type="button" className="ar-control pass" disabled={disabled} onClick={() => void fire('pass')} aria-label="Pass the banner to a teammate next to you">PASS<small>to a mate</small></button>}
        <button type="button" className="ar-control ability" disabled={disabled || sec > 0} onClick={() => void fire('ability')} aria-label={`${ROLE_INFO[role].ability}, ${sec > 0 ? `ready in ${sec} seconds` : 'ready'}`}>
          <RoleIcon role={role} size={24} />{ROLE_INFO[role].ability}<small>{sec > 0 ? `${sec}s` : 'ready'}</small>
          <i className="ar-ring" style={{ ['--p' as string]: `${Math.round((1 - cd.left / Math.max(1, cd.max)) * 100)}%` }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
export function KeyHelp() { return <p className="ar-keys" aria-label="Keyboard controls"><kbd>←↑↓→</kbd> or <kbd>WASD</kbd> move · <kbd>Space</kbd> or <kbd>E</kbd> ability · <kbd>F</kbd> pass the banner</p>; }

// ── lobby ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** One role per student on a team of one (the Runner); bigger teams see all five with the set that fits their size marked. */
export function RolePicker({ value, onPick, busy, teamSize }: { value: Role | null; onPick: (r: Role) => void; busy: boolean; teamSize: number }) {
  const n = Math.max(1, Math.min(5, teamSize)); const rec = ROLE_SETS[n]!;
  if (n === 1) {
    return (
      <fieldset className="ar-roles solo"><legend>YOUR ROLE <small>a team of one plays the Runner — no choices needed</small></legend>
        <div className="ar-rolegrid one"><div className="ar-role" data-role="runner" aria-current="true"><RoleIcon role="runner" size={64} /><b>{ROLE_INFO.runner.name}</b><small>{ROLE_INFO.runner.ability}</small><small className="desc">{ROLE_INFO.runner.how}</small><span className="ar-choose">✓ Your role</span></div></div>
        <p className="ar-note">When a teammate joins, all {ROLES.length} roles unlock and you can switch. Roles never fight: they only help the team reach the goal.</p>
      </fieldset>
    );
  }
  return (
    <fieldset className="ar-roles"><legend>CHOOSE A ROLE <small>{n} on your team: we suggest {rec.map((r) => ROLE_INFO[r].name).join(', ')}</small></legend>
      <div className="ar-rolegrid">
        {ROLES.map((r) => (
          <button key={r} type="button" className="ar-role" data-role={r} data-rec={rec.includes(r) || undefined} aria-pressed={value === r} disabled={busy} onClick={() => onPick(r)}>
            <RoleIcon role={r} size={56} /><b>{ROLE_INFO[r].name}</b><small>{ROLE_INFO[r].ability} · {ROLE_INFO[r].seconds}s rest</small><small className="desc">{ROLE_INFO[r].how}</small>
            <span className="ar-choose">{value === r ? '✓ Chosen' : rec.includes(r) ? 'Suggested for your team' : 'Choose role'}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const COACH = [
  { title: 'Steer with your thumb', body: 'Use the arrow keys or WASD — on a phone, drag the pad. You only choose a direction; the arena moves you, so nobody can cheat their position.' },
  { title: 'The goal depends on the format', body: 'Control Circuit: stand in glowing zones. Banner Relay: carry the banner home through three gates. Crystal Dash: collect crystals and drop them at your vault.' },
  { title: 'Your role helps, never fights', body: 'Each role has one ability with a rest time. Nobody can hurt, block or slow another player — you win by being smarter and by helping your team.' },
  { title: 'Questions freeze everything', body: 'Between rounds the arena freezes for one class question. Correct answers earn team points. At the planning board you spend them on one helper. Speed earns nothing.' },
];
export function Coach({ onClose, format }: { onClose: () => void; format?: ArenaSnap['format'] }) {
  const [i, setI] = useState(0); const ref = useRef<HTMLHeadingElement>(null); useEffect(() => { ref.current?.focus(); }, [i]);
  return (
    <div className="ar-coach" role="dialog" aria-modal="true" aria-labelledby="ar-coach-h">
      <div className="ar-card">
        <p className="ar-step">How to play · {i + 1} of {COACH.length}</p>
        <h2 id="ar-coach-h" ref={ref} tabIndex={-1}>{COACH[i]!.title}</h2><p>{COACH[i]!.body}</p>
        {i === 1 && <ul className="ar-formats">{(['control', 'relay', 'crystal'] as const).map((f) => <li key={f} aria-current={format === f || undefined}><FormatIcon format={f} size={30} /><span><b>{FORMAT_COPY[f].name}</b><small>{FORMAT_COPY[f].blurb}</small></span></li>)}</ul>}
        {i === 2 && <ul className="ar-formats">{ROLES.map((r) => <li key={r}><RoleIcon role={r} size={30} /><span><b>{ROLE_INFO[r].name}</b><small>{ROLE_INFO[r].how}</small></span></li>)}</ul>}
        <div className="ar-row">
          {i > 0 && <button type="button" className="ar-btn" onClick={() => setI(i - 1)}>Back</button>}
          {i < COACH.length - 1 ? <button type="button" className="ar-btn primary" onClick={() => setI(i + 1)}>Next</button> : <button type="button" className="ar-btn primary" onClick={onClose}>Got it</button>}
          <button type="button" className="ar-btn ghost" onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  );
}
function PrefRow({ prefs, set, k, label, hint }: { prefs: Prefs; set: (p: Partial<Prefs>) => void; k: keyof Prefs; label: string; hint: string }) {
  return <label className="ar-switch"><input type="checkbox" checked={prefs[k]} onChange={(e) => set({ [k]: e.target.checked })} /><span><b>{label}</b><small>{hint}</small></span></label>;
}
export function Settings({ prefs, set, onClose }: { prefs: Prefs; set: (p: Partial<Prefs>) => void; onClose: () => void }) {
  return (
    <div className="ar-coach" role="dialog" aria-modal="true" aria-label="Display and sound">
      <div className="ar-card"><h2>Display &amp; sound</h2>
        <PrefRow prefs={prefs} set={set} k="reduceMotion" label="Reduce motion" hint="Stops sway, pulsing and camera ease. Zone changes still show as outlines and text." />
        <PrefRow prefs={prefs} set={set} k="lowFx" label="Simple graphics" hint="Fewer particles. Helps on older phones." />
        <PrefRow prefs={prefs} set={set} k="contrast" label="High contrast" hint="Lighter ground and thicker panels." />
        <PrefRow prefs={prefs} set={set} k="large" label="Larger text" hint="Bigger labels and buttons." />
        <PrefRow prefs={prefs} set={set} k="sound" label="Sound effects" hint="Off by default. Short beeps for good news." />
        <button type="button" className="ar-btn primary" onClick={onClose}>Done</button></div>
    </div>
  );
}

// ── quiz break and review ────────────────────────────────────────────────────────────────────────────────────────────────
export function QuestionBreak({ snap, now, local, onSubmit, submitted }: { snap: ArenaSnap; now: number; local: boolean; onSubmit: (r: unknown) => Promise<unknown>; submitted: boolean }) {
  const q = snap.questionView!; const b = snap.question!; const head = useRef<HTMLHeadingElement>(null); useEffect(() => { head.current?.focus(); }, [b.cycle]);
  const left = b.deadlineMs - now;
  return (
    <div className="ar-quiz" role="dialog" aria-modal="true" aria-labelledby="ar-q-head" data-testid="ar-quiz">
      <div className="ar-quizcard">
        <header className="ar-quizhead">
          <h2 id="ar-q-head" ref={head} tabIndex={-1}>QUESTION {Math.min(snap.cycles, b.cycle + 1)} / {snap.cycles}</h2>
          <span>{kindLabels[q.kind as keyof typeof kindLabels]}</span>
          <span className="ar-freeze">❄ Arena frozen — nobody can move or score</span>
          <span className={`ar-timer ${left < 10_000 ? 'low' : ''}`} role="timer" aria-label={`Time left ${fmt(left)}`}>TIME {fmt(left)}</span>
        </header>
        {snap.tip && <p className="ar-tip"><b>Help:</b> {snap.tip}</p>}
        {submitted ? <div className="ar-submitted" role="status"><p className="big">✓ Answer sent</p><p>{local ? 'Nice. Classmates are answering.' : `The arena stays frozen until your team has answered or time is up. ${b.answered} of ${b.eligible} on your team have answered.`}</p></div>
          : <QuestionPlay question={q as unknown as PlayQuestion} onSubmit={onSubmit} submitLabel="Submit answer" readAloud />}
        <p className="ar-note">Every teammate gets the same time. Speed earns nothing. Your team’s points are the average of everyone’s answer.</p>
      </div>
    </div>
  );
}
export function RevealPanel({ snap }: { snap: ArenaSnap }) {
  const q = snap.questionView; const key = (q as { answerKey?: unknown } | null)?.answerKey; const mine = snap.mine;
  const verdict = mine === null || mine === undefined ? 'You did not answer this one — that is fine. Read the explanation.' : mine >= 1000 ? 'Correct!' : mine > 0 ? `Partly correct (${Math.round(mine / 10)}%).` : 'Not this time — here is why.';
  return (
    <section className="ar-reveal" aria-live="polite" data-testid="ar-reveal">
      <h2>REVIEW ANSWER</h2>
      <p className={`ar-verdict ${mine && mine >= 1000 ? 'good' : 'review'}`}>{verdict}</p>
      {snap.award != null && <p className="ar-award">{snap.award > 0 ? `+${snap.award} points for your team` : 'No points for the team this time'}</p>}
      {q && key ? <AnswerView kind={String(q.kind)} payload={q.payload as never} answerKey={key as never} /> : null}
    </section>
  );
}

// ── planning board (signboards) ──────────────────────────────────────────────────────────────────────────────────────────
const REASONS: Record<string, string> = { INSUFFICIENT_POINTS: 'Not enough points', ONE_PER_ROUND: 'Your team already chose a helper', WRONG_PHASE: 'The board is closed', NOT_OFFERED: 'Your teacher turned this off', STALE_REVISION: 'A teammate just spent points', ALREADY_BOUGHT: 'Your team already chose a helper' };
export function PlanningBoard({ snap, client, now }: { snap: ArenaSnap; client: ArenaClient; now: number }) {
  const p = snap.planning; const [msg, setMsg] = useState(''); const left = snap.deadlineMs !== null ? snap.deadlineMs - now : null; const my = snap.teams.find((t) => t.id === snap.you?.teamId);
  const buy = async (h: Helper) => { const r = await client.act({ kind: 'buy', helper: h }); setMsg(r.ok ? `${HELPER_COPY[h].name} bought for the whole team — it works next round.` : REASONS[r.code ?? ''] ?? r.message ?? 'That did not work.'); };
  if (!p) return null;
  return (
    <section className="ar-plan" aria-label="Planning board" data-testid="ar-plan">
      <header><h2>PLANNING BOARD</h2><p className="ar-points"><b>{p.wallet}</b> team points{left !== null && <span className="ar-timer">next round in {fmt(left)}</span>}</p></header>
      {snap.live && snap.lastResult && <p className="ar-note">Last round: {snap.lastResult.teams.map((t) => `${snap.teams.find((x) => x.id === t.teamId)?.name ?? t.teamId} +${t.points}`).join(' · ')} arena points.</p>}
      <ul className="ar-signs">
        {HELPERS.filter((h) => snap.helpersOffered.includes(h)).map((h) => {
          const info = p.helpers.find((x) => x.id === h)!; const why = p.bought ? 'Team already chose' : !info.affordable ? `Need ${info.cost - p.wallet} more` : null; const chosen = my?.boost === h;
          return (
            <li key={h} className={`${chosen ? 'chosen' : ''} ${why ? 'off' : ''}`}>
              <span className="ar-post" aria-hidden="true" /><HelperIcon helper={h} size={34} />
              <span className="body"><b>{HELPER_COPY[h].name}</b><small>{HELPER_COPY[h].blurb}</small></span>
              <span className="cost">{info.cost} pts</span>
              <button type="button" className="ar-btn small primary" disabled={client.busy || !!why || snap.paused} onClick={() => void buy(h)} aria-describedby={`ar-why-${h}`}>{chosen ? '✓ Bought' : 'Buy'}</button>
              <span id={`ar-why-${h}`} className={`ar-tag ${why ? 'off' : 'ok'}`}>{chosen ? 'Active next round' : why ?? 'Available'}</span>
            </li>);
        })}
      </ul>
      {msg && <p className="ar-note" role="status">{msg}</p>}
      <p className="ar-note">Points are the only currency and come only from correct answers. One helper per team per round; it lasts one round. Helpers are small boosts — never a way to hurt a rival.</p>
    </section>
  );
}
export function EpisodeResult({ snap }: { snap: ArenaSnap }) {
  const r = snap.lastResult; if (!r) return null; const my = snap.you?.teamId;
  return (
    <section className="ar-result" aria-live="polite" data-testid="ar-episode">
      <h2>ROUND {r.episode + 1} RESULT</h2>
      <ul>{r.teams.map((t) => { const team = snap.teams.find((x) => x.id === t.teamId); const i = Math.max(0, snap.teams.findIndex((x) => x.id === t.teamId)); return <li key={t.teamId} className={t.teamId === my ? 'mine' : ''}><TeamBadge index={i} size={20} /><b>{team?.name ?? t.teamId}</b><span>+{t.points} arena points</span></li>; })}</ul>
      <p className="ar-note">Arena points are capped at 100 per round, so one lucky round cannot decide the match. The quiz counts at least half of the final score.</p>
    </section>
  );
}
export const mapName = (id: string) => MAP_INFO[id as keyof typeof MAP_INFO]?.title ?? id;
export const useToast = () => { const [msg, setMsg] = useState(''); const t = useRef<ReturnType<typeof setTimeout>>(undefined); const show = useCallback((m: string) => { setMsg(m); clearTimeout(t.current); if (m) t.current = setTimeout(() => setMsg(''), 2800); }, []); return [msg, show] as const; };
