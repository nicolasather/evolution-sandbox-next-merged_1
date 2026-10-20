'use client';
/** The battlefield. Canvas 2D draws the map, towers, enemies and effects; real <button>s on top are the pads and towers (keyboard, screen
 *  reader, ≥44 px touch). During a wave the canvas REPLAYS the authoritative simulation (WaveSim, the same code the server ran) tick by tick
 *  from the server clock, so every device shows the same battle. A reconnect fast-forwards silently instead of replaying old effects.
 *  On narrow screens a camera keeps pads at a 44 px target size; a minimap shows the whole lane and moves the camera. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOSSES, ENEMIES, TICK_MS, TOWERS } from '@/lib/quiz/td/balance';
import { INK, PAL } from '@/lib/quiz/td/art';
import { MAPS, mapPath, padCenter } from '@/lib/quiz/td/maps';
import { WaveSim, type SimEvent } from '@/lib/quiz/td/sim';
import type { TDMapId, TDPhase, TDTower, TDTowerKind, TDWaveInput } from '@/lib/quiz/td/domain';
import { boardImg, bossImg, enemyImg, onSpriteLoad, towerImg } from './sprites';

const W = 1280, H = 768, TILE = 64, S = TILE / 1000;
type Fx = { k: string; t0: number; dur: number; x: number; y: number; x2?: number; y2?: number; pts?: [number, number][]; r?: number; text?: string; color?: string; e?: number };
export type WaveSummary = { alive: number; byKind: Record<string, number>; core: number; leaks: number; kills: number; boss: { name: string; hp: number; max: number; warn: string | null } | null; done: boolean };
export type BoardProps = {
  mapId: TDMapId; towers: TDTower[]; phase: TDPhase; waveInput: TDWaveInput | null; waveStartMs: number | null; pausedAtMs: number | null; serverNow: () => number;
  calm: boolean; showPads: boolean; selectedPad: string | null; selectedTower: string | null; ghost: { padId: string; kind: TDTowerKind } | null;
  onSelectPad?: (padId: string) => void; onSelectTower?: (towerId: string) => void; label: string; coreHP: number; maxCoreHP: number;
  reinforced?: string[]; salvo?: number[]; ambient?: boolean; fxSignal?: { n: number; kind: string; ref?: string } | null; onSummary?: (s: WaveSummary) => void; lowFx?: boolean; interactive?: boolean;
};

const towerName = (t: TDTower) => `${TOWERS[t.kind].name} level ${t.level}${t.branch ? ` (${t.branch.replace(/_/g, ' ')})` : ''}`;

export default function Board(p: BoardProps) {
  const wrap = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null); const staticCv = useRef<HTMLCanvasElement | null>(null);
  const [hoverPad, setHoverPad] = useState<string | null>(null); const [viewW, setViewW] = useState(960); const [cam, setCam] = useState({ x: 0, y: 0 }); const [fit, setFit] = useState(p.interactive === false); /* display-only boards show the whole map */ const userPan = useRef(0);
  const map = MAPS[p.mapId]; const path = useMemo(() => mapPath(p.mapId), [p.mapId]);
  // camera: keep a tile at least 44 CSS px wide unless the player asked for the whole map
  const zoom = fit ? 1 : Math.max(1, Math.min(2.6, (44 * 20) / Math.max(320, viewW)));
  const boardW = viewW * zoom, boardH = boardW * (H / W); const viewH = zoom > 1 ? Math.min(boardH, Math.max(260, Math.round(viewW * 1.05))) : boardH;
  const clampCam = useCallback((x: number, y: number) => ({ x: Math.max(0, Math.min(boardW - viewW, x)), y: Math.max(0, Math.min(boardH - viewH, y)) }), [boardW, boardH, viewW, viewH]);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    // a hidden or not-yet-laid-out wrapper reports 0: keep the last real width instead of drawing a 0-pixel board
    const measure = () => { const w = Math.round(el.clientWidth); if (w > 0) setViewW(w); };
    const ro = new ResizeObserver(measure);
    ro.observe(el); measure();
    return () => ro.disconnect();
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the camera inside the board when the size changes
  useEffect(() => { setCam((c) => clampCam(c.x, c.y)); }, [clampCam]);

  // ── static layer (the whole storybook board as one image: ground, lane, props, gate, fort) — redrawn only on map/size change ──
  const drawStatic = useCallback((scale: number) => {
    const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const g = c.getContext('2d')!; g.scale(scale, scale);
    const art = boardImg(map.id);
    if (art) { g.drawImage(art, 0, 0, W, H); return c; }
    // until the image has decoded: plain ground and lane, so the board is never blank
    g.fillStyle = map.palette.ground; g.fillRect(0, 0, W, H);
    const lane = () => { g.beginPath(); path.pts.forEach(([x, y], i) => (i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S))); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    lane(); g.strokeStyle = map.palette.laneEdge; g.lineWidth = 76; g.stroke();
    lane(); g.strokeStyle = map.palette.lane; g.lineWidth = 62; g.stroke();
    (c as HTMLCanvasElement & { pending?: boolean }).pending = true;
    return c;
  }, [map, path]);

  // ── wave replay ──
  const sim = useRef<{ key: string; sim: WaveSim; prev: Map<number, number> } | null>(null);
  const fx = useRef<Fx[]>([]); const fireUntil = useRef(new Map<string, number>()); const numbersPerEnemy = useRef(new Map<number, number>());
  const warn = useRef<{ text: string; until: number } | null>(null); const lastSummary = useRef(''); const hitUntil = useRef(new Map<number, number>()); const seenLevels = useRef<Map<string, number> | null>(null);
  const maxFx = p.lowFx ? 70 : 200;
  const towerPos = useMemo(() => new Map(p.towers.map((t) => { const pad = map.pads.find((x) => x.id === t.padId); return [t.id, pad ? padCenter(pad) : ([0, 0] as const)]; })), [p.towers, map]);

  const onEvents = useCallback((ev: SimEvent[], s: WaveSim, now: number) => {
    if (p.calm) { // reduced motion: only a static ring on hits and the essential text cues
      for (const e of ev) {
        if (e.t === 'leak') fx.current.push({ k: 'text', t0: now, dur: 900, x: path.pts[path.pts.length - 1]![0] * S, y: path.pts[path.pts.length - 1]![1] * S - 46, text: e.blocked ? 'BLOCKED' : `CORE −${e.dmg}`, color: e.blocked ? PAL.blue : PAL.coral });
        if (e.t === 'boss' && e.what.startsWith('warn_')) warn.current = { text: warnText(e.what), until: now + 1100 };
      }
      return;
    }
    for (const e of ev) {
      const add = (f: Fx) => { if (fx.current.length < maxFx) fx.current.push(f); };
      const enemyAt = (id: number) => { const en = s.enemies.find((x) => x.id === id); return en ? s.pos(en) : null; };
      if (e.t === 'fire') {
        fireUntil.current.set(e.tower, now + 160);
        const from = towerPos.get(e.tower); const to = enemyAt(e.target); const kind = p.towers.find((t) => t.id === e.tower)?.kind;
        if (from && to && kind) add({ k: `shot:${kind}`, t0: now, dur: kind === 'thorn' ? 250 : kind === 'ember' ? 200 : 140, x: from[0] * S, y: from[1] * S - 18, x2: to[0] * S, y2: to[1] * S });
      } else if (e.t === 'hit' && e.dmg > 0) {
        const n = numbersPerEnemy.current.get(e.e) ?? 0; const at = enemyAt(e.e);
        hitUntil.current.set(e.e, now + 130);
        if (at && n < 3 && !p.lowFx) { numbersPerEnemy.current.set(e.e, n + 1); add({ k: 'num', t0: now, dur: 520, x: at[0] * S + 8, y: at[1] * S - 22, text: String(e.dmg), e: e.e }); }
        if (at && e.src !== 'poison' && e.src !== 'salvo') add({ k: 'ring', t0: now + 120, dur: 220, x: at[0] * S, y: at[1] * S, color: PAL.gold });
      } else if (e.t === 'hit' && e.blocked) { const at = enemyAt(e.e); if (at) add({ k: 'ring', t0: now, dur: 260, x: at[0] * S, y: at[1] * S, color: PAL.stone }); }
      else if (e.t === 'splash') add({ k: 'burst', t0: now + 150, dur: 260, x: e.at[0] * S, y: e.at[1] * S, r: e.r * S, color: PAL.coral });
      else if (e.t === 'chain') { const pts = e.ids.map((id) => enemyAt(id)).filter(Boolean).map((q) => [q![0] * S, q![1] * S] as [number, number]); const from = towerPos.get(e.tower); if (from && pts.length) add({ k: 'zig', t0: now, dur: 240, x: from[0] * S, y: from[1] * S - 24, pts }); }
      else if (e.t === 'slow') { const at = enemyAt(e.e); if (at) add({ k: 'rings', t0: now + 100, dur: 300, x: at[0] * S, y: at[1] * S, color: PAL.blue }); }
      else if (e.t === 'poison') { const at = enemyAt(e.e); if (at) add({ k: 'leaf', t0: now, dur: 300, x: at[0] * S, y: at[1] * S - 10, color: PAL.green }); }
      else if (e.t === 'kill') { const en = s.enemies.find((x) => x.id === e.e); const at = en ? s.pos(en) : null; if (at) add({ k: 'frag', t0: now, dur: 320, x: at[0] * S, y: at[1] * S, color: en?.boss ? PAL.copper : PAL.paper }); }
      else if (e.t === 'leak') { const [cx, cy] = path.pts[path.pts.length - 1]!; add({ k: 'text', t0: now, dur: 900, x: cx * S, y: cy * S - 48, text: e.blocked ? 'BLOCKED' : `CORE −${e.dmg}`, color: e.blocked ? PAL.blue : PAL.coral }); add({ k: 'ring', t0: now, dur: 380, x: cx * S, y: cy * S - 8, r: 34, color: e.blocked ? PAL.blue : PAL.coral }); }
      else if (e.t === 'jam') { const at = towerPos.get(e.tower); if (at) add({ k: 'text', t0: now, dur: 1300, x: at[0] * S, y: at[1] * S - 46, text: e.purified ? 'PURIFIED' : 'JAMMED', color: e.purified ? PAL.purple : PAL.coral }); }
      else if (e.t === 'salvo') add({ k: 'burst', t0: now, dur: 420, x: e.at[0] * S, y: e.at[1] * S, r: 1500 * S, color: PAL.gold });
      else if (e.t === 'boss') {
        if (e.what.startsWith('warn_')) warn.current = { text: warnText(e.what), until: now + 1100 };
        if (e.what === 'crack' && e.ref) { const at = towerPos.get(e.ref); if (at) add({ k: 'text', t0: now, dur: 1600, x: at[0] * S, y: at[1] * S - 46, text: 'PAD CRACKED', color: PAL.coral }); }
        if (e.what.startsWith('phase')) warn.current = { text: `PHASE ${e.what.slice(5)}`, until: now + 1200 };
      } else if (e.t === 'retreat') add({ k: 'text', t0: now, dur: 1400, x: W / 2, y: 60, text: `${e.count} RETREATED`, color: PAL.paper });
    }
  }, [p.calm, p.towers, p.lowFx, towerPos, path, maxFx]);

  // ── frame ──
  const frame = useCallback(() => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); const scale = (boardW / W) * dpr;
    if (!(W * scale >= 1)) return;
    if (c.width !== Math.round(W * scale)) { c.width = Math.round(W * scale); c.height = Math.round(H * scale); staticCv.current = null; }
    if (!staticCv.current) staticCv.current = drawStatic(scale);
    const g = c.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(staticCv.current, 0, 0); g.setTransform(scale, 0, 0, scale, 0, 0);
    const realNow = performance.now();
    // advance the replay to the server clock
    let s: WaveSim | null = null; let alpha = 1;
    if ((p.phase === 'wave' || p.phase === 'wave_result') && p.waveInput && p.waveStartMs !== null) {
      const key = `${p.waveInput.teamId}:${p.waveInput.wave}:${p.waveStartMs}`;
      if (!sim.current || sim.current.key !== key) { sim.current = { key, sim: new WaveSim(p.waveInput), prev: new Map() }; fx.current = []; numbersPerEnemy.current.clear(); }
      s = sim.current.sim;
      const tf = ((p.pausedAtMs ?? p.serverNow()) - p.waveStartMs) / TICK_MS;
      const behind = tf - s.tick;
      while (!s.done && s.tick <= tf) {
        if (s.tick + 1 > tf) { sim.current.prev = new Map(s.enemies.map((e) => [e.id, e.d])); }
        const ev = s.step();
        if (behind < 12) onEvents(ev, s, realNow); // a reconnect catches up silently
      }
      alpha = s.done ? 1 : Math.max(0, Math.min(1, tf - (s.tick - 1)));
    } else if (sim.current && p.phase !== 'wave_result') { sim.current = null; fx.current = []; }
    // pads: little stone plinths with a plus; the hovered or chosen one lifts and glows
    if (p.showPads) for (const pad of map.pads) {
      if (p.towers.some((t) => t.padId === pad.id)) continue;
      const [x, y] = padCenter(pad); const sel = p.selectedPad === pad.id; const hov = hoverPad === pad.id; const pulse = p.calm ? 0 : (Math.sin(realNow / 260) + 1) / 2;
      const px = x * S, py = y * S - (sel || hov ? 3 : 0);
      g.fillStyle = 'rgba(25,40,58,0.22)'; roundRect(g, px - 25, y * S - 20, 50, 46, 10); g.fill();
      g.lineWidth = sel ? 4 : 3; g.setLineDash(sel ? [] : [7, 6]); g.strokeStyle = sel ? INK : 'rgba(25,40,58,0.62)';
      g.fillStyle = sel ? `rgba(255,201,75,${0.7 + pulse * 0.2})` : hov ? 'rgba(255,243,220,0.8)' : 'rgba(255,243,220,0.5)';
      roundRect(g, px - 26, py - 26, 52, 52, 10); g.fill(); g.stroke(); g.setLineDash([]);
      g.strokeStyle = sel ? INK : 'rgba(25,40,58,0.55)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(px - 8, py); g.lineTo(px + 8, py); g.moveTo(px, py - 8); g.lineTo(px, py + 8); g.stroke();
    }
    // range: the ring AND the stretch of lane it can reach (what a player actually wants to know), with the share of the lane written on it
    const ring = (t: { padId: string; kind: TDTowerKind; level: number; reinforced?: boolean }, ghost: boolean) => {
      const pad = map.pads.find((x) => x.id === t.padId); if (!pad) return; const [x, y] = padCenter(pad);
      const r = TOWERS[t.kind].range * (t.level >= 2 ? 1.1 : 1) * (t.reinforced ? 1.15 : 1);
      g.beginPath(); g.arc(x * S, y * S, r * S, 0, Math.PI * 2); g.fillStyle = ghost ? 'rgba(255,201,75,0.16)' : 'rgba(103,188,217,0.16)'; g.fill();
      g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeStyle = ghost ? '#8A6A12' : '#2E6B80'; g.stroke(); g.setLineDash([]);
      let covered = 0; g.lineWidth = 14; g.lineCap = 'round'; g.strokeStyle = ghost ? 'rgba(255,201,75,0.85)' : 'rgba(103,188,217,0.85)';
      for (let i = 1; i < path.pts.length; i++) {
        const a = path.pts[i - 1]!, b = path.pts[i]!;
        if (Math.hypot(a[0] - x, a[1] - y) <= r && Math.hypot(b[0] - x, b[1] - y) <= r) { covered += path.cum[i]! - path.cum[i - 1]!; g.beginPath(); g.moveTo(a[0] * S, a[1] * S); g.lineTo(b[0] * S, b[1] * S); g.stroke(); }
      }
      const pct = Math.round((covered / Math.max(1, path.length)) * 100); const ty = Math.max(24, y * S - r * S - 10);
      g.font = '700 17px var(--td-display, system-ui)'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = INK; g.strokeText(`Reaches ${pct}% of the lane`, x * S, ty); g.fillStyle = PAL.paper; g.fillText(`Reaches ${pct}% of the lane`, x * S, ty);
    };
    const selT = p.towers.find((t) => t.id === p.selectedTower); if (selT) ring({ ...selT, reinforced: p.reinforced?.includes(selT.id) }, false);
    if (p.ghost) ring({ padId: p.ghost.padId, kind: p.ghost.kind, level: 1 }, true);
    else if (hoverPad && p.showPads && !selT && !p.towers.some((t) => t.padId === hoverPad)) ring({ padId: hoverPad, kind: 'bolt', level: 1 }, true);
    // salvo marks
    for (const m of p.salvo ?? []) { const [x, y] = pointAtPermille(path, m); g.setLineDash([6, 6]); g.lineWidth = 3; g.strokeStyle = PAL.coral; g.beginPath(); g.arc(x * S, y * S, 1500 * S, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    // core: the fort itself is part of the board picture; only its health bar is live
    const [cx, cy] = path.pts[path.pts.length - 1]!; const coreHp = s ? s.core : p.coreHP;
    hpBar(g, cx * S - 34, cy * S + 26, 68, coreHp / Math.max(1, p.maxCoreHP), PAL.gold, 9);
    if (!p.calm && !p.lowFx && p.ambient !== false) ambient(g, map.id, realNow);
    // towers (back to front): idle breathing, a squash when they fire, and a pop when one is built or upgraded
    const simTowers = new Map((s?.towers ?? []).map((t) => [t.id, t]));
    const levels = new Map(p.towers.map((t) => [t.id, t.level]));
    if (seenLevels.current && !p.calm) for (const t of p.towers) { const was = seenLevels.current.get(t.id); if (was === undefined || was < t.level) { const at = towerPos.get(t.id); if (at) fx.current.push({ k: 'pop', t0: realNow, dur: 620, x: at[0] * S, y: at[1] * S - 14, color: was === undefined ? PAL.gold : PAL.green }); } }
    seenLevels.current = levels;
    for (const t of [...p.towers].sort((a, b) => padY(map, a.padId) - padY(map, b.padId))) {
      const pad = map.pads.find((x) => x.id === t.padId); if (!pad) continue; const [x, y] = padCenter(pad);
      const firing = !p.calm && (fireUntil.current.get(t.id) ?? 0) > realNow;
      const im = towerImg(t.kind, t.level, firing); const size = 78;
      const breathe = p.calm ? 0 : Math.sin(realNow / 520 + x) * 0.014; const sy = firing ? 1.07 : 1 + breathe; const sx = firing ? 0.95 : 1 - breathe;
      if (im) { g.save(); g.translate(x * S, y * S + 20); g.scale(sx, sy); g.drawImage(im, -size / 2, -size, size, size); g.restore(); }
      else { g.fillStyle = PAL.gold; g.strokeStyle = INK; g.lineWidth = 3; g.fillRect(x * S - 18, y * S - 30, 36, 36); g.strokeRect(x * S - 18, y * S - 30, 36, 36); }
      const st = simTowers.get(t.id);
      if (st && (st.disabled || (s && s.tick < st.jammedUntil))) { g.strokeStyle = PAL.coral; g.lineWidth = 3; g.setLineDash([5, 4]); g.beginPath(); g.arc(x * S, y * S - 14, 33, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      if (st && st.boostPct > 0 && !p.calm) { g.strokeStyle = PAL.gold; g.lineWidth = 3; g.beginPath(); g.moveTo(x * S - 12, y * S + 26); g.lineTo(x * S + 12, y * S + 26); g.stroke(); }
      if (p.reinforced?.includes(t.id)) { g.fillStyle = PAL.blue; g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.arc(x * S + 26, y * S - 46, 7, 0, Math.PI * 2); g.fill(); g.stroke(); }
      for (let i = 0; i < t.level - 1; i++) pip(g, x * S - 26 + i * 13, y * S - 52);
    }
    // enemies
    let boss: WaveSummary['boss'] = null;
    if (s) {
      const prev = sim.current!.prev;
      const list = [...s.enemies].filter((e) => e.alive).map((e) => { const d0 = prev.get(e.id) ?? e.d; const d = d0 + (e.d - d0) * alpha; return { e, at: pointAtD(path, d) }; }).sort((a, b) => a.at[1] - b.at[1]);
      for (const { e, at } of list) {
        const [x, y] = [at[0] * S, at[1] * S];
        if (e.boss) {
          const final = e.phase >= 3; const im = bossImg(e.boss, final); const size = 92;
          if (im) g.drawImage(im, x - size / 2, y - size + 14, size, size); else { g.fillStyle = PAL.copper; g.fillRect(x - 30, y - 50, 60, 60); }
          if (s.tick < e.immuneUntil || s.tick < e.reduceUntil || s.tick < e.armorUpUntil) { g.strokeStyle = s.tick < e.immuneUntil ? PAL.white : PAL.blue; g.lineWidth = 4; g.beginPath(); g.arc(x, y - 30, 52, 0, Math.PI * 2); g.stroke(); }
          if (e.teleKind) { g.setLineDash([8, 6]); g.strokeStyle = PAL.coral; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 30, 58, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
          boss = { name: BOSSES[e.boss].name, hp: Math.max(0, e.hp), max: e.maxHp, warn: warn.current && warn.current.until > realNow ? warn.current.text : null };
          continue;
        }
        const flash = !p.calm && (hitUntil.current.get(e.id) ?? 0) > realNow;
        const pose = flash ? 'hit' : s.tick % 13 < 6 ? 'idle' : 'move'; const im = enemyImg(e.kind, pose); const size = e.kind === 'bulwark' || e.kind === 'splitter' ? 48 : 42;
        const hop = p.calm ? 0 : e.kind === 'skimmer' ? 8 + Math.sin((s.tick + e.id) / 5) * 3 : Math.abs(Math.sin((s.tick + e.id * 3) / 3)) * 3;
        if (im) g.drawImage(im, x - size / 2, y - size + 10 - hop, size, size); else { g.fillStyle = PAL.coral; g.beginPath(); g.arc(x, y - 8, 14, 0, Math.PI * 2); g.fill(); }
        if (s.tick < e.slowUntil) { g.strokeStyle = PAL.blue; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y + 4, 18, 6, 0, 0, Math.PI * 2); g.stroke(); }
        if (e.poison.length) { g.fillStyle = PAL.green; g.beginPath(); g.ellipse(x + 15, y - 30, 5, 3, -0.6, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); }
        if (e.shield > 0) { g.strokeStyle = PAL.paper; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y - 8, 22, -1, 1); g.stroke(); }
        if (e.hp < e.maxHp) hpBar(g, x - 16, y - size + 4, 32, e.hp / e.maxHp, PAL.coral);
      }
    }
    // effects
    fx.current = fx.current.filter((f) => realNow < f.t0 + f.dur + 30);
    for (const f of fx.current) drawFx(g, f, realNow);
    // boss bar + warning
    if (boss) {
      g.fillStyle = 'rgba(25,40,58,0.86)'; roundRect(g, W / 2 - 230, 14, 460, 46, 6); g.fill();
      g.fillStyle = PAL.paper; g.font = '600 18px var(--td-display, system-ui)'; g.textAlign = 'left'; g.fillText(boss.name, W / 2 - 214, 43);
      hpBar(g, W / 2 - 40, 30, 254, boss.hp / boss.max, PAL.coral, 14);
      if (boss.warn) { g.fillStyle = PAL.coral; roundRect(g, W / 2 - 120, 68, 240, 34, 6); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = INK; g.font = '700 18px var(--td-display, system-ui)'; g.textAlign = 'center'; g.fillText(boss.warn, W / 2, 92); }
    }
    // summary for the accessible unit list (only when it changes)
    if (p.onSummary && s) {
      const byKind: Record<string, number> = {}; for (const e of s.enemies) if (e.alive) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
      const sum: WaveSummary = { alive: s.enemies.filter((e) => e.alive).length, byKind, core: s.core, leaks: s.leaks, kills: s.kills, boss, done: s.done };
      const sig = `${sum.alive}:${sum.core}:${sum.kills}:${sum.done}:${boss ? Math.round(boss.hp / Math.max(1, boss.max) * 10) : ''}`;
      if (sig !== lastSummary.current) { lastSummary.current = sig; p.onSummary(sum); }
    }
  }, [p, boardW, drawStatic, map, path, onEvents]);

  // animate only while something moves; otherwise redraw on change
  useEffect(() => {
    let raf = 0; let alive = true;
    let last = 0;
    const loop = () => { if (!alive) return; const t = performance.now(); if (t - last < 30 && fx.current.length === 0 && p.phase !== 'wave') { raf = requestAnimationFrame(loop); return; } last = t; frame(); const busy = (p.phase === 'wave' && !p.pausedAtMs) || fx.current.length > 0; const idle = !p.calm && !p.lowFx && p.ambient !== false && (p.towers.length > 0 || p.showPads || p.interactive === false);
      if ((busy || idle) && !document.hidden) raf = requestAnimationFrame(loop); };
    loop();
    const vis = () => { if (!document.hidden) { cancelAnimationFrame(raf); loop(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); };
  }, [frame, p.phase, p.pausedAtMs, p.calm, p.towers]);
  // images decode asynchronously: redraw the moment one lands, and a few times early on as a fallback
  useEffect(() => onSpriteLoad(() => { staticCv.current = null; frame(); }), [frame]);
  useEffect(() => { const ids = [100, 400, 1200].map((ms) => setTimeout(() => { staticCv.current = null; frame(); }, ms)); return () => ids.forEach(clearTimeout); }, [frame, p.mapId]);

  // camera follows the lead enemy during a wave unless the player moved it recently
  useEffect(() => {
    if (zoom <= 1 || p.phase !== 'wave') return;
    const h = setInterval(() => {
      if (Date.now() - userPan.current < 4000 || !sim.current) return;
      const lead = [...sim.current.sim.enemies].filter((e) => e.alive).sort((a, b) => b.d - a.d)[0]; if (!lead) return;
      const [x, y] = sim.current.sim.pos(lead); const k = boardW / W;
      setCam(clampCam(x * S * k - viewW / 2, y * S * k - viewH / 2));
    }, 700);
    return () => clearInterval(h);
  }, [zoom, p.phase, boardW, viewW, viewH, clampCam]);

  const k = boardW / W; const tilePx = TILE * k; const camMode = zoom > 1;
  const pan = (dx: number, dy: number) => { userPan.current = Date.now(); setCam((c) => clampCam(c.x + dx * viewW * 0.45, c.y + dy * viewH * 0.45)); };
  const centerOn = (x: number, y: number) => { userPan.current = Date.now(); setCam(clampCam(x * k - viewW / 2, y * k - viewH / 2)); };
  return (
    <div className="td-board" ref={wrap}>
      <div className="td-viewport" style={{ height: camMode ? viewH : undefined }} onKeyDown={(e) => { if (!camMode) return; const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (d && e.altKey) { e.preventDefault(); pan(d[0]!, d[1]!); } }}>
        <div className="td-stage" style={{ width: boardW, height: boardH, transform: camMode ? `translate(${-cam.x}px, ${-cam.y}px)` : undefined }}>
          <canvas ref={cv} style={{ width: boardW, height: boardH }} role="img" aria-label={p.label} />
          {map.pads.map((pad) => {
            const t = p.towers.find((x) => x.padId === pad.id); const [x, y] = padCenter(pad);
            if (!t && !p.showPads) return null;
            const label = t ? `${towerName(t)} on pad ${pad.id.toUpperCase()}` : `Empty pad ${pad.id.toUpperCase()}`;
            const sel = t ? p.selectedTower === t.id : p.selectedPad === pad.id;
            return <button key={pad.id} type="button" className={`td-hit ${t ? 'tower' : 'pad'}`} aria-label={label} aria-pressed={sel} disabled={p.interactive === false}
              style={{ left: x * S * k - Math.max(44, tilePx) / 2, top: y * S * k - Math.max(44, tilePx) / 2 - (t ? tilePx * 0.15 : 0), width: Math.max(44, tilePx), height: Math.max(44, tilePx) }}
              onMouseEnter={() => !t && setHoverPad(pad.id)} onMouseLeave={() => setHoverPad(null)} onFocus={() => !t && setHoverPad(pad.id)} onBlur={() => setHoverPad(null)} onClick={() => (t ? p.onSelectTower?.(t.id) : p.onSelectPad?.(pad.id))} />;
          })}
        </div>
      </div>
      {camMode && (
        <div className="td-camera" role="group" aria-label="Map camera">
          <button type="button" className="td-mini" aria-label="Minimap: tap to move the camera" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); centerOn(((e.clientX - r.left) / r.width) * boardW, ((e.clientY - r.top) / r.height) * boardH); }}>
            <MiniMap mapId={p.mapId} towers={p.towers} cam={{ x: cam.x / boardW, y: cam.y / boardH, w: viewW / boardW, h: viewH / boardH }} />
          </button>
          <div className="td-campad"><button type="button" onClick={() => pan(-1, 0)} aria-label="Move camera left">◀</button><button type="button" onClick={() => pan(0, -1)} aria-label="Move camera up">▲</button><button type="button" onClick={() => pan(0, 1)} aria-label="Move camera down">▼</button><button type="button" onClick={() => pan(1, 0)} aria-label="Move camera right">▶</button></div>
          <button type="button" className="td-btn ghost small" onClick={() => setFit(true)}>Whole map</button>
        </div>
      )}
      {!camMode && fit && viewW < 700 && p.interactive !== false && <button type="button" className="td-btn ghost small td-zoomback" onClick={() => setFit(false)}>Zoom in to build</button>}
    </div>
  );
}

function MiniMap({ mapId, towers, cam }: { mapId: TDMapId; towers: TDTower[]; cam: { x: number; y: number; w: number; h: number } }) {
  const m = MAPS[mapId]; const path = mapPath(mapId);
  const d = path.pts.filter((_, i) => i % 3 === 0 || i === path.pts.length - 1).map(([x, y], i) => `${i ? 'L' : 'M'}${(x / 1000).toFixed(2)} ${(y / 1000).toFixed(2)}`).join(' ');
  return (
    <svg viewBox="0 0 20 12" aria-hidden="true" preserveAspectRatio="none">
      <rect width="20" height="12" fill={m.palette.ground} /><path d={d} fill="none" stroke={m.palette.laneEdge} strokeWidth="1.1" strokeLinecap="round" /><path d={d} fill="none" stroke={m.palette.lane} strokeWidth="0.8" strokeLinecap="round" />
      {towers.map((t) => { const pad = m.pads.find((p) => p.id === t.padId); return pad ? <rect key={t.id} x={pad.x + 0.2} y={pad.y + 0.2} width="0.6" height="0.6" fill={INK} /> : null; })}
      <rect x={cam.x * 20} y={cam.y * 12} width={cam.w * 20} height={cam.h * 12} fill="none" stroke={PAL.gold} strokeWidth="0.25" />
    </svg>
  );
}

// ── drawing helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const warnText = (w: string) => ({ warn_shield: 'SHIELD IN 1s', warn_surge: 'SURGE IN 1s', warn_armor: 'ARMOR UP IN 1s', warn_guard: 'GUARD IN 1s', warn_crack: 'PAD CRACK IN 1s' } as Record<string, string>)[w] ?? 'WARNING';
const padY = (m: (typeof MAPS)[TDMapId], id: string) => m.pads.find((p) => p.id === id)?.y ?? 0;
function pointAtD(path: ReturnType<typeof mapPath>, d: number): [number, number] {
  if (d <= 0) return [path.pts[0]![0], path.pts[0]![1]]; if (d >= path.length) { const l = path.pts[path.pts.length - 1]!; return [l[0], l[1]]; }
  let lo = 0, hi = path.cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path.cum[mid]! <= d) lo = mid; else hi = mid; }
  const a = path.pts[lo]!, b = path.pts[hi]!; const t = (d - path.cum[lo]!) / Math.max(1, path.cum[hi]! - path.cum[lo]!);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
const pointAtPermille = (path: ReturnType<typeof mapPath>, m: number) => pointAtD(path, (path.length * m) / 1000);
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function hpBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string, h = 7) {
  g.fillStyle = INK; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = '#3B4F63'; g.fillRect(x, y, w, h); g.fillStyle = color; g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}
function pip(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = PAL.gold; g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 3.2 : 7.2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
}
/** Quiet life on the board: butterflies and petals (meadow), dust and sparks (quarry), drifting clouds and glints (skyworks). Pure decoration, a few shapes. */
function ambient(g: CanvasRenderingContext2D, id: TDMapId, now: number) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  if (id === 'meadow_circuit') {
    for (let i = 0; i < 4; i++) {
      const t = now / 1000 + i * 7.3; const x = 160 + i * 300 + Math.sin(t * 0.6) * 90, y = 120 + (i % 2) * 330 + Math.cos(t * 0.8) * 50; const flap = Math.abs(Math.sin(t * 9)) * 6 + 2;
      g.fillStyle = i % 2 ? PAL.candy : PAL.sun; g.strokeStyle = INK; g.lineWidth = 1.8;
      g.beginPath(); g.ellipse(x - flap * 0.7, y, flap, 5, -0.4, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.ellipse(x + flap * 0.7, y, flap, 5, 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.fillStyle = 'rgba(255,143,177,0.8)'; for (let i = 0; i < 6; i++) { const t = (now / 5000 + i / 6) % 1; g.beginPath(); g.ellipse(t * 1300 - 10, 80 + ((i * 131) % 600) + Math.sin(t * 14 + i) * 18, 4, 2.4, t * 6, 0, Math.PI * 2); g.fill(); }
  } else if (id === 'coral_quarry') {
    g.fillStyle = 'rgba(255,240,214,0.7)'; for (let i = 0; i < 9; i++) { const t = (now / 7000 + i / 9) % 1; g.beginPath(); g.arc(t * 1300 - 10, 60 + ((i * 97) % 640) + Math.sin(t * 10 + i) * 14, 2.6 + (i % 3), 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 3; i++) { const on = Math.sin(now / 420 + i * 2) > 0.2; if (!on) continue; const x = [150, 790, 1190][i]!, y = [90, 700, 80][i]!; g.strokeStyle = PAL.sun; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); g.stroke(); }
  } else {
    for (let i = 0; i < 3; i++) {
      const t = (now / (26000 + i * 6000) + i / 3) % 1; const x = t * 1500 - 110, y = 70 + i * 250; g.fillStyle = 'rgba(25,40,58,0.10)'; g.beginPath(); g.ellipse(x, y + 26, 54, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.arc(x - 24, y, 18, Math.PI * 0.9, Math.PI * 2.1); g.arc(x, y - 8, 24, Math.PI, Math.PI * 2); g.arc(x + 26, y, 18, Math.PI * 1.1, Math.PI * 2.1); g.closePath(); g.fill(); g.stroke();
    }
    g.strokeStyle = PAL.white; g.lineWidth = 3; for (let i = 0; i < 4; i++) { if (Math.sin(now / 500 + i * 1.7) < 0.3) continue; const x = [210, 640, 980, 1180][i]!, y = [520, 110, 420, 700][i]!; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke(); }
  }
  g.restore();
}
function drawFx(g: CanvasRenderingContext2D, f: Fx, now: number) {
  const t = (now - f.t0) / f.dur; if (t < 0 || t > 1) return;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  switch (f.k) {
    case 'shot:bolt': { const x = f.x + (f.x2! - f.x) * t, y = f.y + (f.y2! - f.y) * t; g.fillStyle = PAL.gold; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 7); g.lineTo(x - 5, y); g.closePath(); g.fill(); g.stroke(); break; }
    case 'shot:frost': { g.strokeStyle = PAL.blue; g.lineWidth = 5; g.globalAlpha = 1 - t * 0.5; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + (f.x2! - f.x) * Math.min(1, t * 1.4), f.y + (f.y2! - f.y) * Math.min(1, t * 1.4)); g.stroke(); g.strokeStyle = PAL.white; g.lineWidth = 1.6; g.stroke(); break; }
    case 'shot:ember': { const x = f.x + (f.x2! - f.x) * t, y = f.y + (f.y2! - f.y) * t - Math.sin(t * Math.PI) * 30; g.fillStyle = PAL.coral; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y + 5); g.lineTo(x - 7, y + 5); g.closePath(); g.fill(); g.stroke(); break; }
    case 'shot:thorn': { const x = f.x + (f.x2! - f.x) * t, y = f.y + (f.y2! - f.y) * t - Math.sin(t * Math.PI) * 40; g.fillStyle = PAL.green; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); g.stroke(); break; }
    case 'shot:arc': break; // arc draws its chain instead
    case 'zig': { const pts = [[f.x, f.y] as [number, number], ...f.pts!]; const upto = Math.max(1, Math.ceil(t * pts.length * 1.3)); g.strokeStyle = PAL.purple; g.lineWidth = 4; g.globalAlpha = 1 - t * 0.6; g.beginPath(); g.moveTo(pts[0]![0], pts[0]![1]); for (let i = 1; i < Math.min(upto, pts.length); i++) { const [ax, ay] = pts[i - 1]!; const [bx, by] = pts[i]!; const mx = (ax + bx) / 2 + (by - ay) * 0.12, my = (ay + by) / 2 - (bx - ax) * 0.12; g.lineTo(mx, my); g.lineTo(bx, by); } g.stroke(); break; }
    case 'ring': { g.strokeStyle = f.color!; g.lineWidth = 3; g.globalAlpha = 0.85 * (1 - t); g.beginPath(); g.arc(f.x, f.y - 8, (f.r ?? 8) + 14 * t, 0, Math.PI * 2); g.stroke(); break; }
    case 'rings': { g.strokeStyle = f.color!; g.lineWidth = 2.5; g.globalAlpha = 1 - t; for (const r of [10, 18]) { g.beginPath(); g.arc(f.x, f.y - 8, r + 10 * t, 0, Math.PI * 2); g.stroke(); } break; }
    case 'burst': { g.fillStyle = f.color!; g.globalAlpha = 0.35 * (1 - t); g.beginPath(); g.arc(f.x, f.y - 6, f.r! * (0.6 + 0.4 * t), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1 - t; g.strokeStyle = f.color!; g.lineWidth = 4; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(f.x + Math.cos(a) * f.r! * 0.45, f.y - 6 + Math.sin(a) * f.r! * 0.45); g.lineTo(f.x + Math.cos(a) * f.r! * (0.6 + 0.4 * t), f.y - 6 + Math.sin(a) * f.r! * (0.6 + 0.4 * t)); g.stroke(); } break; }
    case 'leaf': { g.fillStyle = f.color!; g.globalAlpha = 1 - t; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(f.x - 10 + i * 10, f.y - t * 10, 4, 2.5, -0.6, 0, Math.PI * 2); g.fill(); } break; }
    case 'frag': { g.strokeStyle = INK; g.lineWidth = 1.6; g.globalAlpha = 1 - t; const cols = [f.color!, PAL.sun, PAL.candy, PAL.sky]; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.75; const x = f.x + Math.cos(a) * 28 * t, y = f.y - 12 + Math.sin(a) * 28 * t - 8 * t; g.fillStyle = cols[i % 4]!; g.beginPath(); for (let k = 0; k < 10; k++) { const aa = -Math.PI / 2 + (k * Math.PI) / 5 + t * 2; const r = k % 2 ? 2.4 : 5.4; g.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r); } g.closePath(); g.fill(); g.stroke(); } break; }
    case 'pop': { g.globalAlpha = 1 - t; g.strokeStyle = f.color!; g.lineWidth = 5 * (1 - t) + 1; g.beginPath(); g.arc(f.x, f.y, 14 + 34 * t, 0, Math.PI * 2); g.stroke(); g.fillStyle = f.color!; g.strokeStyle = INK; g.lineWidth = 1.6; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t; const r = 16 + 30 * t; const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r; g.beginPath(); for (let k = 0; k < 10; k++) { const aa = -Math.PI / 2 + (k * Math.PI) / 5; const rr = k % 2 ? 2 : 5; g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); } g.closePath(); g.fill(); g.stroke(); } break; }
    case 'num': { g.globalAlpha = Math.min(1, 2 - t * 2); g.font = '700 17px var(--td-display, system-ui)'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = INK; g.strokeText(f.text!, f.x, f.y - t * 14); g.fillStyle = PAL.paper; g.fillText(f.text!, f.x, f.y - t * 14); break; }
    case 'text': { g.globalAlpha = Math.min(1, 3 - t * 3); g.font = '700 20px var(--td-display, system-ui)'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = INK; g.strokeText(f.text!, f.x, f.y); g.fillStyle = f.color!; g.fillText(f.text!, f.x, f.y); break; }
  }
  g.restore();
}
export { ENEMIES };
