'use client';
/** The arena canvas and its controls. It draws what the server last said (interpolated) and sends only intent: a direction and an ability press. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SwarmConnection } from '@/lib/swarm/client/connection';
import { SceneRenderer, type RosterRow } from '@/lib/swarm/render/scene';
import { FxLayer } from '@/lib/swarm/render/fxlayer';
import { InputState, isTypingTarget } from '@/lib/swarm/client/input';
import { ROLES, type MapId, type Role } from '@/lib/swarm/domain';
import { ROLE_DEFS } from '@/lib/swarm/balance';
import type { Prefs } from './prefs';

const ACTIVE = new Set(['wave', 'boss_wave']);
export default function Arena({ conn, interactive, prefs, onCue }: { conn: SwarmConnection; interactive: boolean; prefs: Prefs; onCue?: (k: 'good' | 'bad' | 'down' | 'wave') => void }) {
  const canvas = useRef<HTMLCanvasElement>(null); const wrap = useRef<HTMLDivElement>(null); const input = useRef(new InputState()); const stick = useRef<HTMLDivElement>(null); const knob = useRef<HTMLSpanElement>(null);
  const prefsRef = useRef(prefs); const cueRef = useRef(onCue);
  useEffect(() => { prefsRef.current = prefs; cueRef.current = onCue; });
  const [abilityPct, setAbilityPct] = useState(100); const [abilityName, setAbilityName] = useState('Ability'); const [desc, setDesc] = useState(''); const [touch, setTouch] = useState(false);
  const meId = (conn.s.me as { id?: string } | undefined)?.id ?? conn.welcome?.you.id;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTouch(typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)); }, []);
  useEffect(() => {
    const cv = canvas.current!; const r = new SceneRenderer(cv); const fx = new FxLayer(window.innerWidth < 700 ? 25 : 60); const inp = input.current; let raf = 0; let lastSent = { x: 0, y: 0, at: 0 }; let lastDesc = 0; let lastDown = false; let lastWave = -1;
    const ro = new ResizeObserver(() => r.resize()); ro.observe(wrap.current!); r.resize();
    const kd = (e: KeyboardEvent, down: boolean) => {
      if (!interactive || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (inp.key(e.key, down)) { e.preventDefault(); return; }
      if (down && !e.repeat && (e.code === 'Space' || e.key.toLowerCase() === 'e')) { e.preventDefault(); if (ACTIVE.has(conn.phase)) conn.ability(); }
    };
    const onDown = (e: KeyboardEvent) => kd(e, true), onUp = (e: KeyboardEvent) => kd(e, false); const blur = () => { inp.clear(); conn.move(0, 0); };
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', blur);
    const loop = (nowMs: number) => {
      raf = requestAnimationFrame(loop); const m = conn.s.meta as { phase?: string; map?: MapId; paused?: boolean; wave?: number; waves?: number; boss?: string | null } | undefined; if (!m) return;
      const active = ACTIVE.has(m.phase ?? '') && !m.paused; inp.enabled = interactive && active; const v = inp.vector();
      if (interactive && active) { const moved = Math.abs(v.x - lastSent.x) > 0.02 || Math.abs(v.y - lastSent.y) > 0.02; if (moved || (nowMs - lastSent.at > 60 && (v.x || v.y)) || nowMs - lastSent.at > 500) { if (conn.move(v.x, v.y)) lastSent = { x: v.x, y: v.y, at: nowMs }; } }
      if (conn.fxQueue.length) { fx.add(conn.fxQueue.splice(0) as never[], nowMs / 1000); }
      const roster = ((conn.s.roster as { id: string; name: string; role: Role; on: boolean }[] | undefined) ?? []) as RosterRow[]; const arena = conn.s.arena as { beacon: { hp: number; max: number; shieldOn: boolean }; status: string } | undefined;
      const me = meId ? conn.buffer.latest()?.e.p?.[meId] : undefined;
      r.frame({ mapId: (m.map ?? 'meadow_circuit') as MapId, clientMs: nowMs, buffer: conn.buffer, roster, meId: interactive ? meId : undefined, overview: !interactive, arena, fx, hc: prefsRef.current.contrast, reduced: prefsRef.current.reduced, selfInput: interactive && active ? v : undefined, showNames: prefsRef.current.names, paused: !!m.paused, phone: window.innerWidth < 700 });
      if (me) { const maxCd = me[9] || 1; setAbilityPct((p) => { const n = Math.round(100 * (1 - me[8]! / maxCd)); return Math.abs(n - p) >= 2 || (n === 100) !== (p === 100) ? n : p; }); const role = ROLES[me[6]!]; if (role) setAbilityName((p) => (p === ROLE_DEFS[role].ability ? p : ROLE_DEFS[role].ability)); const down = !!(me[5]! & 2); if (down && !lastDown) cueRef.current?.('down'); lastDown = down; }
      if (m.wave !== lastWave) { if (lastWave !== -1 && ACTIVE.has(m.phase ?? '')) cueRef.current?.('wave'); lastWave = m.wave ?? -1; }
      if (nowMs - lastDesc > 1500) {
        lastDesc = nowMs; const en = Object.values(conn.buffer.latest()?.e.e ?? {}); const pl = Object.values(conn.buffer.latest()?.e.p ?? {}); const boss = en.find((x) => x[0]! >= 8);
        setDesc(`${m.phase === 'wave' || m.phase === 'boss_wave' ? '' : 'Arena paused. '}${SceneRenderer.describe({ enemies: en.length, boss: boss ? (m.boss ?? 'a boss').replace('_', ' ') : null, hp: me?.[2] ?? 0, maxHp: me?.[3] ?? 0, beaconPct: arena ? Math.round((100 * arena.beacon.hp) / Math.max(1, arena.beacon.max)) : 100, down: pl.filter((p) => p[5]! & 2).length, wave: m.wave ?? 0, waves: m.waves ?? 0 })}`);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', blur); if (interactive) conn.move(0, 0); };
  }, [conn, interactive, meId]);

  const sp = useCallback((e: React.PointerEvent) => {
    const el = stick.current!; const b = el.getBoundingClientRect(); const R = b.width / 2; const v = InputState.stickFrom(e.clientX - (b.left + R), e.clientY - (b.top + R), R * 0.8); input.current.stick = v;
    if (knob.current) knob.current.style.transform = `translate(${v.x * R * 0.8}px, ${v.y * R * 0.8}px)`;
  }, []);
  const spEnd = useCallback(() => { input.current.stick = { x: 0, y: 0 }; if (knob.current) knob.current.style.transform = 'translate(0,0)'; }, []);
  const ready = abilityPct >= 100; const canAbility = ACTIVE.has(conn.phase) && !(conn.s.meta as { paused?: boolean } | undefined)?.paused;
  const roleDef = useMemo(() => null, []); void roleDef;
  return (
    <div className="sw-arenawrap" ref={wrap}>
      <canvas ref={canvas} className="sw-canvas" role="img" aria-label={desc || 'Swarm Survival arena'} data-testid="arena" />
      <p className="sw-sr" role="status" aria-live="polite" data-testid="arena-desc">{desc}</p>
      {interactive && (
        <div className={`sw-controls ${touch ? 'touch' : ''}`}>
          <div className="sw-stick" ref={stick} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); sp(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') sp(e); }} onPointerUp={spEnd} onPointerCancel={spEnd} aria-hidden="true" data-testid="stick"><span ref={knob} /></div>
          <button type="button" className={`sw-ability ${ready ? 'ready' : ''}`} disabled={!canAbility || !ready} onClick={() => conn.ability()} aria-label={`${abilityName}: ${ready ? 'ready' : `recharging ${abilityPct} percent`}. Shortcut Space.`} data-testid="ability" style={{ ['--p' as string]: `${abilityPct}%` }}>
            <b>{abilityName}</b><small>{ready ? 'Ready · Space' : `${abilityPct}%`}</small>
          </button>
        </div>
      )}
    </div>
  );
}
