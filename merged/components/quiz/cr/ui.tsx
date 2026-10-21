'use client';
/** Shared Clue Racing UI: the full-bleed map stage, controls (keyboard + touch), the slim status bar, objective strip, clue board, quiz break, route board (vote + perk shop),
 *  role picker, coach and display settings. Plain DOM around one canvas. The map is the screen: at most two always-visible action buttons (56 px) and one menu button.
 *  Every interactive target is ≥ 44 px; colour is never the only cue (team shape marks, text labels, icons). */
import { useCallback, useEffect, useRef, useState } from 'react';
import QuestionPlay, { type PlayQuestion } from '@/components/quiz/QuestionPlay';
import AnswerView from '@/components/quiz/AnswerView';
import { kindLabels } from '@/lib/quiz/types';
import { FORMAT_COPY, PERK_COST, PERK_COPY, STAMP_R, TICK_MS } from '@/lib/quiz/cr/balance';
import { ROLES, type Phase, type Perk, type Role } from '@/lib/quiz/cr/domain';
import { dist, legGeo, MAP_INFO, stationName } from '@/lib/quiz/cr/maps';
import { FormatIcon, PerkIcon, RoleIcon, TeamBadge } from './icons';
import { ROLE_INFO, ROLE_SETS, TEAM_COLORS } from './art';
import { drawCR, fitView, legBox, WORLD_BOX, optionLabel, type View } from './render';
import type { CRClient, CRSnap } from './useCR';
import { legOf } from './useCR';
import type { Prefs } from './prefs';

export const PHASE_LABEL: Record<Phase, string> = { lobby: 'Lobby', countdown: 'Get ready', race: 'Race', checkpoint: 'Checkpoint', barrier: 'Clue question', reveal: 'Answer review', route_choice: 'Route board', finished: 'Finished' };
export const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function useNow(serverNow: () => number, ms = 250) { const [, set] = useState(0); useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]); return serverNow(); }
export const mapName = (id: string) => MAP_INFO[id as keyof typeof MAP_INFO]?.title ?? id;
export const useToast = () => { const [msg, setMsg] = useState(''); const t = useRef<ReturnType<typeof setTimeout>>(undefined); const show = useCallback((m: string) => { setMsg(m); clearTimeout(t.current); if (m) t.current = setTimeout(() => setMsg(''), 2800); }, []); return [msg, show] as const; };

export function ConnBadge({ conn }: { conn: string }) {
  if (conn === 'connected') return null;
  const text = conn === 'connecting' ? 'Connecting…' : conn === 'degraded' ? 'Slow connection — still syncing' : conn === 'reconnecting' ? 'Reconnecting — the race waits for no one, but your moves resume when you are back' : 'Back online — the map is refreshed';
  return <p className={`cr-conn ${conn}`} role="status" data-testid="cr-conn">{text}</p>;
}

// ── canvas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function CRCanvas({ client, mode, prefs, reduced, label, className = '' }: { client: CRClient; mode: 'follow' | 'overview'; prefs: Prefs; reduced: boolean; label: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = box.current; const c = cv.current; if (!el || !c) return undefined; const g = c.getContext('2d'); if (!g) return undefined;
    let w = 0; let h = 0; let raf = 0; let last = 0; let alive = true; let cam: View | null = null; const t0 = performance.now();
    const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches; const frameMs = reduced || prefs.lowFx ? 66 : coarse ? 33 : 16;
    const size = () => { const r = el.getBoundingClientRect(); const dpr = Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1); w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height)); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); const ro = new ResizeObserver(size); ro.observe(el);
    const loop = (t: number) => {
      if (!alive) return; raf = requestAnimationFrame(loop);
      if (document.hidden || t - last < frameMs) return; last = t;
      const f = client.frame(); if (!f) return; const me = f.dots.find((d) => d.mine); const live = f.pub.live;
      let target: View;
      if (mode === 'follow') {
        const base = Math.max(0.5, Math.min(1.25, w / (w < 700 ? 820 : 1180)));
        if (live?.fold && f.geo) target = fitView(w, h, legBox(f.geo), 120);
        else target = { cx: me?.x ?? f.geo?.hubA.x ?? 700, cy: me?.y ?? f.geo?.hubA.y ?? 700, scale: base };
      } else target = f.geo && f.pub.phase !== 'lobby' && f.pub.phase !== 'finished' ? fitView(w, h, legBox(f.geo), 170) : fitView(w, h, WORLD_BOX, 60);
      if (!cam || reduced || Math.hypot(cam.cx - target.cx, cam.cy - target.cy) > 700) cam = { ...target };
      else { const k = mode === 'follow' ? 0.16 : 0.08; cam = { cx: cam.cx + (target.cx - cam.cx) * k, cy: cam.cy + (target.cy - cam.cy) * k, scale: cam.scale + (target.scale - cam.scale) * 0.1 }; }
      drawCR(g, f, { width: w, height: h, view: cam, time: (t - t0) / 1000, reduced, lowFx: prefs.lowFx, contrast: prefs.contrast, mini: mode === 'follow', showNames: mode === 'overview', focus: mode === 'follow' ? 'race' : 'overview' });
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [client, mode, reduced, prefs.lowFx, prefs.contrast]);
  return <div ref={box} className={`cr-world ${className}`}><canvas ref={cv} role="img" aria-label={label} data-testid="cr-canvas" /></div>;
}

// ── status bar and objective ───────────────────────────────────────────────────────────────────────────────────────────────
/** One slim bar: team + role on the left, leg pips and clock in the middle, wallet on the right. The menu button is added by the caller so it stays the only button here. */
export function StatusBar({ snap, now, children }: { snap: CRSnap; now: number; children?: React.ReactNode }) {
  const my = snap.teams.find((t) => t.id === snap.you?.teamId); const idx = Math.max(0, snap.teams.findIndex((t) => t.id === my?.id)); const you = snap.you;
  const left = snap.phase === 'race' && snap.live ? snap.live.secondsLeft : snap.deadlineMs !== null ? Math.ceil((snap.deadlineMs - now) / 1000) : null;
  return (
    <div className="cr-statusbar" role="group" aria-label="Race status">
      <span className="cr-pill team" style={{ borderColor: TEAM_COLORS[idx % 4] }}><TeamBadge index={idx} size={18} /> {my?.name ?? 'Team'}{you && <RoleIcon role={you.role} size={18} />}</span>
      <span className="cr-pips" role="img" aria-label={`Leg ${Math.min(snap.legs, legOf(snap) + 1)} of ${snap.legs}`}>{Array.from({ length: snap.legs }, (_, i) => <i key={i} className={i < (my?.legsDone ?? 0) ? 'done' : i === legOf(snap) ? 'now' : ''} />)}</span>
      <span className="cr-pill phase" aria-live="polite">{PHASE_LABEL[snap.phase]}{left !== null && snap.phase !== 'lobby' && snap.phase !== 'finished' ? ` ${snap.phase === 'race' ? `${left}s` : fmt(left * 1000)}` : ''}{snap.paused ? ' · paused' : ''}</span>
      {my?.wallet !== undefined && <span className="cr-pill pts" title="Team points to spend"><b>★</b> {my.wallet}</span>}
      {children}
    </div>
  );
}
export function Feed({ feed }: { feed: CRClient['feed'] }) { return <ul className="cr-feed" aria-live="polite" aria-atomic="false">{feed.map((f) => <li key={f.id} className={f.kind}>{f.text}</li>)}</ul>; }
/** What to do right now, in one line; tapping it opens the clue board. */
export function ObjectiveStrip({ snap, onOpen }: { snap: CRSnap; onOpen: () => void }) {
  const l = snap.live; if (!l || snap.phase !== 'race') return null; const o = l.objective; const geoName = stationName(snap.mapId, snap.stations[legOf(snap) + 1] ?? 27);
  let msg: string;
  if (o?.done) msg = 'Your team is at the checkpoint — waiting for the others';
  else if (snap.format === 'split_route') msg = `Follow the ${l.option ? optionLabel(l.option) : 'road'} to ${geoName}`;
  else if (snap.format === 'signal_relay') msg = snap.you?.holdsFlag ? 'You hold the lantern flag — carry it to the relay post in the clue' : 'A teammate holds the flag — stay near them for the hand-off';
  else msg = o && o.stampLockTicks > 0 ? 'Short pause after a wrong stamp — then try the next landmark' : `Stamp landmark ${Math.min(3, (o?.stampIdx ?? 0) + 1)} of 3 in the clue’s order`;
  return <button type="button" className="cr-strip" onClick={onOpen} aria-label={`${msg}. Open the clue board.`}><FormatIcon format={snap.format} size={18} /><span>{msg}</span><span className="cr-strip-t">{l.secondsLeft}s</span><span className="cr-strip-clue" aria-hidden="true">Clue ▸</span></button>;
}
export function ClueBoard({ snap, onClose }: { snap: CRSnap; onClose: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null); useEffect(() => { ref.current?.focus(); }, []);
  const list = [...snap.evidence].reverse(); const pin = snap.live?.pinned;
  return (
    <div className="cr-coach" role="dialog" aria-modal="true" aria-labelledby="cr-clue-h" data-testid="cr-clues">
      <div className="cr-card cr-clues">
        <h2 id="cr-clue-h" ref={ref} tabIndex={-1}>Clue board</h2>
        {pin && <p className="cr-pinned"><b>📌 Pinned by your Archivist (leg {pin.leg + 1}):</b> {pin.text}</p>}
        {list.length === 0 && <p className="cr-note">No clue yet. Answer the first question and a clue unfolds.</p>}
        <ol className="cr-cluelist">{list.map((e, i) => <li key={e.leg} className={i === 0 ? 'newest' : ''}><small>{i === 0 ? 'Newest · ' : ''}Leg {e.leg + 1}</small><p>{e.text}</p></li>)}</ol>
        <p className="cr-note">Clues come from the quiz: every correct answer by the class brings the next clue closer. Only your teacher’s screen knows the full answer.</p>
        <button type="button" className="cr-btn primary" onClick={onClose}>Back to the map</button>
      </div>
    </div>
  );
}

// ── controls ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
/** The landmark site you are standing closest to (inside the stamp ring), or null. */
export function nearestSite(client: CRClient): number | null {
  const f = client.frame(); if (!f?.geo) return null; const me = f.dots.find((d) => d.mine); if (!me) return null;
  let best: number | null = null; let bd = STAMP_R; f.geo.spurs.forEach((sp, i) => { const d = dist(sp.end, me); if (d <= bd) { bd = d; best = i; } }); return best;
}
export function useKeyboard(client: CRClient, active: boolean, onResult: (m: string) => void) {
  const { input } = client;
  useEffect(() => {
    if (!active) { input.clear(); return undefined; }
    const down = new Set<string>();
    const apply = () => { const x = (down.has('ArrowRight') || down.has('d') ? 1 : 0) - (down.has('ArrowLeft') || down.has('a') ? 1 : 0); const y = (down.has('ArrowDown') || down.has('s') ? 1 : 0) - (down.has('ArrowUp') || down.has('w') ? 1 : 0); const m = Math.hypot(x, y) || 1; input.set(x / m, y / m); };
    const fire = async (a: 'ability' | 'pass' | 'inspect') => {
      const r = a === 'inspect' ? await (async () => { const site = nearestSite(client); return site === null ? { ok: false, message: 'Walk to a landmark first.' } : client.act({ kind: 'inspect', siteId: site }); })() : await client.act({ kind: a });
      if (!r.ok) onResult((r as { message?: string }).message ?? 'Not right now.'); else if ((r as { note?: string }).note) onResult((r as { note?: string }).note!);
    };
    const kd = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { down.add(k); apply(); e.preventDefault(); }
      else if ((k === ' ' || k === 'e') && !e.repeat && !(e.target instanceof HTMLButtonElement)) { void fire('ability'); e.preventDefault(); }
      else if (k === 'f' && !e.repeat) void fire('pass');
      else if ((k === 'g' || k === 'Enter') && !e.repeat && !(e.target instanceof HTMLButtonElement)) void fire('inspect');
    };
    const ku = (e: KeyboardEvent) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (down.delete(k)) apply(); };
    const reset = () => { down.clear(); input.clear(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', reset); input.clear(); };
  }, [client, input, active, onResult]);
}
/** Touch controls: an analog thumb pad on the left; on the right at most TWO buttons, each 56 px or larger: the role ability, and the one format action (Pass the flag or Stamp). */
export function TouchControls({ client, snap, disabled, onResult }: { client: CRClient; snap: CRSnap; disabled: boolean; onResult: (m: string) => void }) {
  const pad = useRef<HTMLDivElement>(null); const [knob, setKnob] = useState({ x: 0, y: 0 }); const pid = useRef<number | null>(null); const [cd, setCd] = useState({ left: 0, max: 1 }); const [site, setSite] = useState<number | null>(null);
  const { cooldown, input } = client; useEffect(() => { const t = setInterval(() => { setCd(cooldown()); setSite(snap.format === 'atlas_circuit' ? nearestSite(client) : null); }, 120); return () => clearInterval(t); }, [cooldown, client, snap.format]);
  const role = snap.you?.role ?? 'solo_pathfinder';
  const move = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect(); let x = e.clientX - (r.left + r.width / 2); let y = e.clientY - (r.top + r.height / 2); const m = r.width / 2; const len = Math.hypot(x, y);
    if (len > m) { x = (x / len) * m; y = (y / len) * m; } setKnob({ x, y }); const dz = m * 0.16; input.set(Math.hypot(x, y) < dz ? 0 : x / m, Math.hypot(x, y) < dz ? 0 : y / m);
  };
  const end = () => { pid.current = null; setKnob({ x: 0, y: 0 }); input.set(0, 0); };
  const fire = async (a: 'ability' | 'pass') => { const r = await client.act({ kind: a }); onResult(r.ok ? r.note ?? '' : r.message ?? 'Not right now.'); };
  const stamp = async () => { const s = nearestSite(client); if (s === null) { onResult('Walk to a landmark first.'); return; } const r = await client.act({ kind: 'inspect', siteId: s }); onResult(r.ok ? r.note ?? '' : r.message ?? 'Not right now.'); };
  const sec = Math.ceil((cd.left * TICK_MS) / 1000);
  return (
    <div className="cr-touch" aria-label="Touch controls" data-disabled={disabled || undefined}>
      <div ref={pad} className="cr-pad" role="group" aria-label="Move pad" style={{ touchAction: 'none' }}
        onPointerDown={(e) => { if (disabled) return; pid.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={(e) => { if (pid.current === e.pointerId) move(e); }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        <span className="cr-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="cr-actions">
        {snap.format === 'signal_relay' && snap.you?.holdsFlag && snap.seats.filter((x) => x.teamId === snap.you?.teamId).length > 1 && <button type="button" className="cr-control pass" disabled={disabled} onClick={() => void fire('pass')} aria-label="Hand the lantern flag to a teammate next to you">HAND OVER<small>to a mate</small></button>}
        {snap.format === 'atlas_circuit' && <button type="button" className="cr-control stamp" disabled={disabled || site === null} onClick={() => void stamp()} aria-label="Stamp the landmark you are standing at" data-testid="cr-stamp">STAMP<small>{site === null ? 'go to a landmark' : snap.live?.names?.[site] ?? 'ready'}</small></button>}
        <button type="button" className="cr-control ability" disabled={disabled || sec > 0} onClick={() => void fire('ability')} aria-label={`${ROLE_INFO[role].ability}, ${sec > 0 ? `ready in ${sec} seconds` : 'ready'}`} data-testid="cr-ability">
          <RoleIcon role={role} size={24} />{ROLE_INFO[role].ability}<small>{sec > 0 ? `${sec}s` : 'ready'}</small>
          <i className="cr-ring" style={{ ['--p' as string]: `${Math.round((1 - cd.left / Math.max(1, cd.max)) * 100)}%` }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
export function KeyHelp() { return <p className="cr-keys" aria-label="Keyboard controls"><kbd>←↑↓→</kbd> or <kbd>WASD</kbd> move · <kbd>Space</kbd> ability · <kbd>F</kbd> hand over the flag · <kbd>G</kbd> stamp</p>; }

// ── lobby ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A team of one plays the Solo Pathfinder; teams of two to five choose each of the five team roles at most once, and the set that fits the team size is marked. */
export function RolePicker({ value, onPick, busy, teamSize, taken }: { value: Role | null; onPick: (r: Role) => void; busy: boolean; teamSize: number; taken: Role[] }) {
  const n = Math.max(1, Math.min(5, teamSize)); const rec = ROLE_SETS[n]!;
  if (n === 1) {
    return (
      <fieldset className="cr-roles solo"><legend>YOUR ROLE <small>a team of one plays the Solo Pathfinder — no choices needed</small></legend>
        <div className="cr-rolegrid one"><div className="cr-role" data-role="solo_pathfinder" aria-current="true"><RoleIcon role="solo_pathfinder" size={64} /><b>{ROLE_INFO.solo_pathfinder.name}</b><small>{ROLE_INFO.solo_pathfinder.ability}</small><small className="desc">{ROLE_INFO.solo_pathfinder.how}</small><span className="cr-choose">✓ Your role</span></div></div>
        <p className="cr-note">When a teammate joins, the five team roles unlock and you can pick one. Roles never fight: they only help the team reach the checkpoint.</p>
      </fieldset>
    );
  }
  const team = ROLES.filter((r) => r !== 'solo_pathfinder');
  return (
    <fieldset className="cr-roles"><legend>CHOOSE A ROLE <small>{n} on your team: we suggest {rec.map((r) => ROLE_INFO[r].name).join(', ')}</small></legend>
      <div className="cr-rolegrid">
        {team.map((r) => { const other = taken.includes(r) && value !== r; return (
          <button key={r} type="button" className="cr-role" data-role={r} data-rec={rec.includes(r) || undefined} aria-pressed={value === r} disabled={busy || other} onClick={() => onPick(r)}>
            <RoleIcon role={r} size={56} /><b>{ROLE_INFO[r].name}</b><small>{ROLE_INFO[r].ability} · {ROLE_INFO[r].seconds}s rest</small><small className="desc">{ROLE_INFO[r].how}</small>
            <span className="cr-choose">{value === r ? '✓ Chosen' : other ? 'A teammate has this role' : rec.includes(r) ? 'Suggested for your team' : 'Choose role'}</span>
          </button>); })}
      </div>
    </fieldset>
  );
}

export const COACH = [
  { title: 'Steer with your thumb', body: 'Use the arrow keys or WASD — on a phone, drag the pad. You only choose a direction; the course moves you along the path, so nobody can cheat their position. Everyone walks at the same speed.' },
  { title: 'Clues come from the quiz', body: 'The race freezes for one class question at every checkpoint. The class’s answers earn team points and unfold the next clue. Speed earns nothing: take your time.' },
  { title: 'Three ways to race', body: 'Pick the road that suits your team, carry one lantern flag to the right post, or stamp three landmarks in the order the clue gives. Every format has the same friendly rules.' },
  { title: 'Roles help, never fight', body: 'Each role has one ability with a rest time. Nobody can hurt, block or slow another team. Between legs you can spend team points on a small perk.' },
];
export function Coach({ onClose, format }: { onClose: () => void; format?: CRSnap['format'] }) {
  const [i, setI] = useState(0); const ref = useRef<HTMLHeadingElement>(null); useEffect(() => { ref.current?.focus(); }, [i]);
  return (
    <div className="cr-coach" role="dialog" aria-modal="true" aria-labelledby="cr-coach-h">
      <div className="cr-card">
        <p className="cr-step">How to play · {i + 1} of {COACH.length}</p>
        <h2 id="cr-coach-h" ref={ref} tabIndex={-1}>{COACH[i]!.title}</h2><p>{COACH[i]!.body}</p>
        {i === 2 && <ul className="cr-formats">{(['split_route', 'signal_relay', 'atlas_circuit'] as const).map((f) => <li key={f} aria-current={format === f || undefined}><FormatIcon format={f} size={30} /><span><b>{FORMAT_COPY[f].name}</b><small>{FORMAT_COPY[f].blurb}</small></span></li>)}</ul>}
        {i === 3 && <ul className="cr-formats">{ROLES.map((r) => <li key={r}><RoleIcon role={r} size={30} /><span><b>{ROLE_INFO[r].name}</b><small>{ROLE_INFO[r].how}</small></span></li>)}</ul>}
        <div className="cr-row">
          {i > 0 && <button type="button" className="cr-btn" onClick={() => setI(i - 1)}>Back</button>}
          {i < COACH.length - 1 ? <button type="button" className="cr-btn primary" onClick={() => setI(i + 1)}>Next</button> : <button type="button" className="cr-btn primary" onClick={onClose}>Got it</button>}
          <button type="button" className="cr-btn ghost" onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  );
}
function PrefRow({ prefs, set, k, label, hint }: { prefs: Prefs; set: (p: Partial<Prefs>) => void; k: keyof Prefs; label: string; hint: string }) {
  return <label className="cr-switch"><input type="checkbox" checked={prefs[k]} onChange={(e) => set({ [k]: e.target.checked })} /><span><b>{label}</b><small>{hint}</small></span></label>;
}
export function Settings({ prefs, set, onClose }: { prefs: Prefs; set: (p: Partial<Prefs>) => void; onClose: () => void }) {
  return (
    <div className="cr-coach" role="dialog" aria-modal="true" aria-label="Display and sound">
      <div className="cr-card"><h2>Display &amp; sound</h2>
        <PrefRow prefs={prefs} set={set} k="reduceMotion" label="Reduce motion" hint="Stops sway, drifting particles and camera ease. Effects still show as outlines and text." />
        <PrefRow prefs={prefs} set={set} k="lowFx" label="Simple graphics" hint="Fewer particles and effects. Helps on older phones." />
        <PrefRow prefs={prefs} set={set} k="contrast" label="High contrast" hint="Lighter ground and thicker panels." />
        <PrefRow prefs={prefs} set={set} k="large" label="Larger text" hint="Bigger labels and buttons." />
        <PrefRow prefs={prefs} set={set} k="sound" label="Sound effects" hint="Off by default. Short beeps for good news." />
        <button type="button" className="cr-btn primary" onClick={onClose}>Done</button></div>
    </div>
  );
}

// ── quiz break and review ────────────────────────────────────────────────────────────────────────────────────────────────
export function QuestionBreak({ snap, now, local, onSubmit, submitted }: { snap: CRSnap; now: number; local: boolean; onSubmit: (r: unknown) => Promise<unknown>; submitted: boolean }) {
  const q = snap.questionView!; const b = snap.question!; const head = useRef<HTMLHeadingElement>(null); useEffect(() => { head.current?.focus(); }, [b.window]);
  const left = b.deadlineMs - now;
  return (
    <div className="cr-quiz" role="dialog" aria-modal="true" aria-labelledby="cr-q-head" data-testid="cr-quiz">
      <div className="cr-quizcard">
        <header className="cr-quizhead">
          <h2 id="cr-q-head" ref={head} tabIndex={-1}>CLUE QUESTION {Math.min(snap.windows, b.window + 1)} / {snap.windows}</h2>
          <span>{kindLabels[q.kind as keyof typeof kindLabels]}</span>
          <span className="cr-freeze">❄ Race frozen — nobody moves, no time passes</span>
          <span className={`cr-timer ${left < 10_000 ? 'low' : ''}`} role="timer" aria-label={`Time left ${fmt(left)}`}>TIME {fmt(left)}</span>
        </header>
        {snap.tip && <p className="cr-tip"><b>Help:</b> {snap.tip}</p>}
        {submitted ? <div className="cr-submitted" role="status"><p className="big">✓ Answer sent</p><p>{local ? 'Nice. Classmates are answering.' : `The race stays frozen until your team has answered or time is up. ${b.answered} of ${b.eligible} on your team have answered.`}</p></div>
          : <QuestionPlay question={q as unknown as PlayQuestion} onSubmit={onSubmit} submitLabel="Submit answer" readAloud />}
        <p className="cr-note">Every teammate gets the same time. Speed earns nothing. Your team’s points are the average of everyone’s answer.</p>
      </div>
    </div>
  );
}
export function RevealPanel({ snap }: { snap: CRSnap }) {
  const q = snap.questionView; const key = (q as { answerKey?: unknown } | null)?.answerKey; const mine = snap.mine;
  const verdict = mine === null || mine === undefined ? 'You did not answer this one — that is fine. Read the explanation.' : mine >= 1000 ? 'Correct!' : mine > 0 ? `Partly correct (${Math.round(mine / 10)}%).` : 'Not this time — here is why.';
  return (
    <section className="cr-reveal" aria-live="polite" data-testid="cr-reveal">
      <h2>REVIEW ANSWER</h2>
      <p className={`cr-verdict ${mine && mine >= 1000 ? 'good' : 'review'}`}>{verdict}</p>
      {snap.award != null && <p className="cr-award">{snap.award > 0 ? `+${snap.award} points for your team` : 'No points for the team this time'}</p>}
      {snap.newClue && <p className="cr-unfold" data-testid="cr-newclue"><b>New clue unfolds:</b> {snap.newClue.text}</p>}
      {q && key ? <AnswerView kind={String(q.kind)} payload={q.payload as never} answerKey={key as never} /> : null}
    </section>
  );
}

// ── route board (road vote + perk shop) ────────────────────────────────────────────────────────────────────────────────────
const REASONS: Record<string, string> = { INSUFFICIENT_POINTS: 'Not enough points', ALREADY_OWNED: 'Your team already has this for the leg', PERK_LIMIT: 'At most two perks per leg', WRONG_PHASE: 'The board is closed', NOT_OFFERED: 'Your teacher turned this off', STALE_REVISION: 'A teammate just spent points', PAUSED: 'The game is paused' };
const LENGTH_WORD = (len: number, min: number, max: number) => (max - min < 30 ? 'about the same length' : len === min ? 'shortest' : len === max ? 'longest' : 'in between');
export function RouteBoard({ snap, client, now }: { snap: CRSnap; client: CRClient; now: number }) {
  const [msg, setMsg] = useState(''); const left = snap.deadlineMs !== null ? snap.deadlineMs - now : null; const my = snap.teams.find((t) => t.id === snap.you?.teamId); const shop = snap.shop;
  const course = client.course; const a = snap.stations[legOf(snap)]; const b = snap.stations[legOf(snap) + 1];
  const geo = course && a !== undefined && b !== undefined ? legGeo(course, a, b, legOf(snap)) : null; const lens = geo ? geo.options.filter((o) => geo.offered.includes(o.id)).map((o) => o.length) : [];
  const vote = async (o: 'a' | 'b' | 'c') => { const r = await client.act({ kind: 'vote', option: o }); setMsg(r.ok ? 'Vote counted. You can change it until the timer ends.' : REASONS[r.code ?? ''] ?? r.message ?? 'That did not work.'); };
  const buy = async (p: Perk) => { const r = await client.act({ kind: 'buy', perk: p }); setMsg(r.ok ? `${PERK_COPY[p].name} bought for the whole team — it works on the next leg.` : REASONS[r.code ?? ''] ?? r.message ?? 'That did not work.'); };
  return (
    <section className="cr-board" aria-label="Route board" data-testid="cr-board">
      <header><h2>ROUTE BOARD</h2><p className="cr-points"><b>{shop?.wallet ?? my?.wallet ?? 0}</b> team points{left !== null && <span className="cr-timer">next leg in {fmt(left)}</span>}</p></header>
      {snap.format === 'split_route' && geo && (
        <><h3>Choose the road to {stationName(snap.mapId, b ?? 27)}</h3>
          <ul className="cr-roads">{geo.options.filter((o) => geo.offered.includes(o.id)).map((o) => { const count = my?.votes?.[o.id] ?? 0; const mineVote = snap.you?.myVote === o.id; return (
            <li key={o.id} className={mineVote ? 'chosen' : ''} data-option={o.id}>
              <span className="body"><b>{optionLabel(o.id)}</b><small>{LENGTH_WORD(o.length, Math.min(...lens), Math.max(...lens))}{o.gates.length ? ' · has a timed gate (never harmful)' : ''}{o.landmark ? ` · passes the ${o.landmark}` : ''}</small></span>
              <span className="cr-votes" aria-label={`${count} votes`}>{count} vote{count === 1 ? '' : 's'}</span>
              <button type="button" className="cr-btn small primary" disabled={client.busy || snap.paused} aria-pressed={mineVote} onClick={() => void vote(o.id)}>{mineVote ? '✓ Voted' : 'Vote'}</button>
            </li>); })}</ul>
          <p className="cr-note">The road with the most votes wins; a tie goes to the first road listed. Every road reaches the checkpoint — the choice changes the walk, never your score.</p></>
      )}
      {snap.format !== 'split_route' && <p className="cr-note">Next stop: <b>{stationName(snap.mapId, b ?? 27)}</b>. Read the new clue on the clue board, then spend points if you like.</p>}
      {shop && (
        <><h3>Perks <small>bought with team points · one leg only · at most two per leg</small></h3>
          <ul className="cr-signs">{shop.items.map((it) => { const owned = shop.owned.includes(it.id); const why = owned ? null : shop.slotsLeft === 0 ? 'Two perks already' : !it.affordable ? `Need ${it.cost - shop.wallet} more` : null; return (
            <li key={it.id} className={`${owned ? 'chosen' : ''} ${why ? 'off' : ''}`} data-perk={it.id}>
              <PerkIcon perk={it.id} size={34} /><span className="body"><b>{PERK_COPY[it.id].name}</b><small>{PERK_COPY[it.id].blurb}</small></span><span className="cost">{PERK_COST[it.id]} pts</span>
              <button type="button" className="cr-btn small primary" disabled={client.busy || owned || !!why || snap.paused} onClick={() => void buy(it.id)}>{owned ? '✓ Bought' : 'Buy'}</button>
              <span className={`cr-tag ${why ? 'off' : 'ok'}`}>{owned ? 'Active next leg' : why ?? 'Available'}</span>
            </li>); })}</ul></>
      )}
      {msg && <p className="cr-note" role="status">{msg}</p>}
      <p className="cr-note">Points come only from correct answers. Perks are small helps — never a way to hurt another team.</p>
    </section>
  );
}
export { WORLD_BOX };
