/** Arena Clash canvas renderer: a storybook "toy table" drawn with the shared prop painter (components/quiz/art/props.ts). Original flat shapes, 3 px ink outlines, no faces,
 *  no copied art. The static ground (patchwork, lanes, plaza, bases, vaults) is painted ONCE per map into an offscreen layer; zones, crystals, banner, gates, tokens and effects
 *  are animated on top. Everything drawn is a pure function of (public state, smoothed token positions, ambient time) — the renderer can never change the game. */
import { drawAtmosphere } from '../art/atmosphere';
import { drawProp, hash2, PAL, rr, type PropKind } from '../art/props';
import type { Geometry, Solid } from '@/lib/quiz/arena/maps';
import { MAP_INFO } from '@/lib/quiz/arena/maps';
import type { ArenaPublic } from '@/lib/quiz/arena/public';
import { BASE_R, PLAYER_R, TICK_MS, VAULT_R, WORLD, ZONE_R, CENTER, CP_R } from '@/lib/quiz/arena/balance';
import type { Role } from '@/lib/quiz/arena/domain';
import { glyph, INK, PAPER, ROLE_GLYPH, TEAM_COLORS, TEAM_DARK, TEAM_SHAPE, teamMark } from './art';

export type DrawDot = { id: string; x: number; y: number; vx: number; vy: number; role: Role; team: number; label: string; banner: boolean; carrying: number; dash: boolean; idle: boolean; mine: boolean; mate: boolean };
export type ArenaFrame = { geo: Geometry; pub: ArenaPublic; dots: DrawDot[]; tick: number; teamIndex: (id: string | null | undefined) => number };
export type DrawOpts = { width: number; height: number; mode: 'follow' | 'overview'; center: { x: number; y: number } | null; time: number; reduced: boolean; lowFx: boolean; mini: boolean; contrast: boolean; span?: number };

const SS = 1.5; // static layer supersample
const layers = new Map<string, HTMLCanvasElement>();
const layerKey = (geo: Geometry, contrast: boolean) => `${geo.mapId}|${geo.teamCount}|${contrast ? 1 : 0}`;
const ellipseShadow = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.16) => { g.fillStyle = `rgba(23,37,58,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const outline = (g: CanvasRenderingContext2D, w = 3) => { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; };
const PROP_FOR: Record<string, PropKind> = { tree: 'tree', windmill: 'windmill', flowers: 'flowers', banner: 'banner', sign: 'sign', lantern: 'lantern', reeds: 'reeds', bush: 'bush', hedge: 'bush', bridge: 'bridge', crystalcluster: 'crystal', pennant: 'banner', lilyisle: 'pond' };

function drawDeco(g: CanvasRenderingContext2D, kind: string, x: number, y: number, s: number, rot: number, time: number, pal: { accent: string; lane: string; water: string; ground2: string }) {
  const size = 78 * s;
  if (kind === 'fountain') {
    ellipseShadow(g, x, y + 8, 128, 52, 0.2); outline(g, 4);
    g.fillStyle = PAL.stone; g.beginPath(); g.arc(x, y, 118, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = pal.water; g.beginPath(); g.arc(x, y, 92, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { const r = 24 + i * 22 + Math.sin(time * 1.5 + i) * 3; g.beginPath(); g.arc(x, y, r, 0.4, 2.6); g.stroke(); }
    outline(g, 3); g.fillStyle = PAL.stoneDark; g.beginPath(); rr(g, x - 16, y - 30, 32, 40, 8); g.fill(); g.stroke();
    g.fillStyle = PAL.water; g.beginPath(); g.arc(x, y - 36, 14, 0, Math.PI * 2); g.fill(); g.stroke(); return;
  }
  if (kind === 'stagecenter') {
    ellipseShadow(g, x, y + 10, 130, 54, 0.2); outline(g, 4);
    g.fillStyle = PAL.navy; g.beginPath(); g.arc(x, y, 120, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? pal.accent : PAL.lemon; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 104, (i * Math.PI) / 6 + time * 0.2, ((i + 1) * Math.PI) / 6 + time * 0.2); g.closePath(); g.fill(); }
    g.lineWidth = 3; g.stroke(); g.fillStyle = PAPER; g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill(); g.stroke(); return;
  }
  if (kind === 'crystalhub') {
    ellipseShadow(g, x, y + 10, 124, 50, 0.2); outline(g, 4);
    g.fillStyle = PAL.sand; g.beginPath(); g.arc(x, y, 116, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3 + time * 0.08; drawProp(g, 'crystal', x + Math.cos(a) * 66, y + Math.sin(a) * 66 + 20, 54, time, hash2(i, 3), i); }
    drawProp(g, 'crystal', x, y + 28, 92, time, 0.4, 2); return;
  }
  if (kind === 'turntable' || kind === 'gearmat') {
    const R = kind === 'turntable' ? 64 * s : 54 * s; g.save(); g.translate(x, y); g.rotate(time * (kind === 'turntable' ? 0.35 : -0.25) + rot); outline(g, 3);
    g.fillStyle = kind === 'turntable' ? PAL.brass : PAL.wheat; g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; const r = i % 2 ? R * 0.88 : R; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = PAL.paper; g.beginPath(); g.arc(0, 0, R * 0.36, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); return;
  }
  if (kind === 'stagelight') {
    ellipseShadow(g, x, y + 14, 22, 8); outline(g, 3); g.fillStyle = PAL.slate; g.beginPath(); rr(g, x - 6, y - 40, 12, 54, 4); g.fill(); g.stroke();
    g.fillStyle = pal.accent; g.beginPath(); g.arc(x, y - 44, 16, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,248,200,.2)'; const a = Math.sin(time * 0.9 + x) * 0.5; g.beginPath(); g.moveTo(x, y - 44); g.lineTo(x + Math.cos(a + 1.2) * 150, y - 44 + Math.sin(a + 1.2) * 150); g.lineTo(x + Math.cos(a + 1.9) * 150, y - 44 + Math.sin(a + 1.9) * 150); g.closePath(); g.fill(); return;
  }
  if (kind === 'lightbridge') { g.save(); g.globalAlpha = 0.5; g.strokeStyle = pal.accent; g.lineWidth = 8; g.setLineDash([14, 12]); g.lineDashOffset = -time * 20; g.beginPath(); g.moveTo(x - 80, y); g.lineTo(x + 80, y); g.stroke(); g.restore(); return; }
  drawProp(g, PROP_FOR[kind] ?? 'rock', x, y, size, time, hash2(Math.round(x), Math.round(y)), Math.round(x + y) % 3);
}

/** The static layer: patchwork ground, lanes, plaza, bases and vaults. */
function buildLayer(geo: Geometry, contrast: boolean): HTMLCanvasElement {
  const key = layerKey(geo, contrast); const hit = layers.get(key); if (hit) return hit;
  const pal = MAP_INFO[geo.mapId].palette; const c = document.createElement('canvas'); c.width = c.height = Math.round(WORLD * SS); const g = c.getContext('2d')!; g.scale(SS, SS);
  g.fillStyle = PAL.navy; g.fillRect(0, 0, WORLD, WORLD);
  // patchwork meadow board
  g.save(); g.beginPath(); rr(g, 14, 14, WORLD - 28, WORLD - 28, 46); g.clip();
  g.fillStyle = pal.ground; g.fillRect(0, 0, WORLD, WORLD);
  for (let cy = 0; cy < 12; cy++) for (let cx = 0; cx < 12; cx++) { const h = hash2(cx, cy, 7); if (h > 0.45) { g.fillStyle = pal.ground2; g.globalAlpha = 0.22 + h * 0.26; g.beginPath(); rr(g, cx * 100 + 6, cy * 100 + 6, 88, 88, 18); g.fill(); } }
  g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 230; i++) { const x = hash2(i, 1, 3) * WORLD; const y = hash2(i, 2, 3) * WORLD; g.beginPath(); g.arc(x, y, 2 + hash2(i, 4) * 3, 0, Math.PI * 2); g.fill(); }
  // lanes: base → checkpoints → plaza, one per team
  for (let i = 0; i < geo.bases.length; i++) {
    const pts = [geo.bases[i]!, ...(geo.checkpoints[i] ?? []), { x: CENTER, y: CENTER }]; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(23,37,58,.22)'; g.lineWidth = 70; g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p.x, p.y + 4) : g.moveTo(p.x, p.y + 4))); g.stroke();
    g.strokeStyle = pal.lane; g.lineWidth = 62; g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
    g.strokeStyle = 'rgba(23,37,58,.14)'; g.lineWidth = 3; g.setLineDash([10, 14]); g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.setLineDash([]);
  }
  g.fillStyle = pal.lane; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(CENTER, CENTER, 168, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(23,37,58,.2)'; g.lineWidth = 2; for (let r = 60; r < 168; r += 36) { g.beginPath(); g.arc(CENTER, CENTER, r, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  // frame
  outline(g, 6); g.beginPath(); rr(g, 14, 14, WORLD - 28, WORLD - 28, 46); g.stroke();
  // bases + vaults
  geo.bases.forEach((b, i) => {
    const col = TEAM_COLORS[i % 4]!; const dark = TEAM_DARK[i % 4]!; ellipseShadow(g, b.x, b.y + 8, BASE_R + 10, BASE_R * 0.6, 0.22); outline(g, 4);
    g.fillStyle = col; g.beginPath(); g.arc(b.x, b.y, BASE_R, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = PAPER; g.beginPath(); g.arc(b.x, b.y, BASE_R - 14, 0, Math.PI * 2); g.fill(); g.lineWidth = 2.5; g.stroke();
    g.fillStyle = dark; teamMark(g, TEAM_SHAPE[i % 4]!, b.x, b.y, 20); g.fill(); outline(g, 2.5); g.stroke();
    const v = geo.vaults[i]; if (v) { ellipseShadow(g, v.x, v.y + 12, VAULT_R, VAULT_R * 0.45, 0.2); outline(g, 4); g.fillStyle = PAL.brass; g.beginPath(); rr(g, v.x - 40, v.y - 28, 80, 56, 12); g.fill(); g.stroke(); g.fillStyle = col; g.beginPath(); rr(g, v.x - 40, v.y - 10, 80, 20, 4); g.fill(); g.lineWidth = 2.5; g.stroke(); g.fillStyle = PAPER; g.beginPath(); g.arc(v.x, v.y, 9, 0, Math.PI * 2); g.fill(); g.stroke(); }
  });
  geo.deco.filter((d) => d.z === 0 && !['turntable', 'gearmat', 'stagelight', 'lightbridge', 'fountain', 'stagecenter', 'crystalhub'].includes(d.kind)).forEach((d) => drawDeco(g, d.kind, d.x, d.y, d.s, d.rot, 0, pal));
  if (contrast) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, 0, WORLD, WORLD); }
  layers.set(key, c); return c;
}

const flag = (g: CanvasRenderingContext2D, x: number, y: number, col: string, wave: number, s = 1) => {
  outline(g, 2.5 * s); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 46 * s); g.stroke();
  g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 46 * s); g.quadraticCurveTo(x + 18 * s, y - 52 * s + wave, x + 34 * s, y - 42 * s); g.quadraticCurveTo(x + 18 * s, y - 34 * s - wave, x, y - 28 * s); g.closePath(); g.fill(); g.stroke();
};

export function drawArena(g: CanvasRenderingContext2D, f: ArenaFrame, o: DrawOpts) {
  const { geo, pub } = f; const pal = MAP_INFO[geo.mapId].palette; const t = o.reduced ? 0 : o.time; const W = o.width; const H = o.height;
  g.save(); g.fillStyle = PAL.navy; g.fillRect(0, 0, W, H);
  const span = o.mode === 'follow' ? o.span ?? 640 : WORLD + 40; const sc = Math.min(W, H) / span * (o.mode === 'follow' ? 1 : 1);
  // follow camera: never shows the table edge when the stage is smaller than the world (and centres the axis that fits entirely)
  const vw = W / sc; const vh = H / sc; const lim = (c: number, v: number) => (v >= WORLD + 40 ? CENTER : Math.max(v / 2 - 20, Math.min(WORLD + 20 - v / 2, c)));
  const cx = o.mode === 'follow' && o.center ? lim(o.center.x, vw) : CENTER; const cy = o.mode === 'follow' && o.center ? lim(o.center.y, vh) : CENTER;
  g.translate(W / 2 - cx * sc, H / 2 - cy * sc); g.scale(sc, sc);
  g.drawImage(buildLayer(geo, o.contrast), 0, 0, WORLD, WORLD);
  const live = pub.live; const tick = f.tick;
  // animated decorations that live in the world
  geo.deco.filter((d) => ['turntable', 'gearmat', 'stagelight', 'lightbridge', 'fountain', 'stagecenter', 'crystalhub'].includes(d.kind)).forEach((d) => drawDeco(g, d.kind, d.x, d.y, d.s, d.rot, t, pal));
  // checkpoints (relay): three numbered gates per lane
  if (pub.format === 'relay') geo.checkpoints.forEach((cps, i) => cps.forEach((p, k) => { g.save(); outline(g, 3); g.setLineDash([8, 7]); g.fillStyle = `${TEAM_COLORS[i % 4]}33`; g.beginPath(); g.arc(p.x, p.y, CP_R, 0, Math.PI * 2); g.fill(); g.strokeStyle = TEAM_DARK[i % 4]!; g.stroke(); g.setLineDash([]); g.fillStyle = INK; g.font = '800 15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k + 1), p.x, p.y + 1); g.restore(); }));
  // control zones
  if (live && pub.format === 'control') {
    live.zones.forEach((z) => {
      const own = z.owner ? f.teamIndex(z.owner) : -1; const col = own >= 0 ? TEAM_COLORS[own % 4]! : PAL.stone; const pulse = z.active && !o.reduced ? 1 + Math.sin(t * 4) * 0.04 : 1;
      ellipseShadow(g, z.x, z.y + 6, ZONE_R + 12, ZONE_R * 0.6, 0.18);
      g.save(); g.globalAlpha = z.active ? 1 : 0.5; outline(g, 3.5); if (!z.active) g.setLineDash([9, 8]);
      g.fillStyle = own >= 0 ? `${col}55` : 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(z.x, z.y, ZONE_R * pulse + 8, 0, Math.PI * 2); g.fill(); g.stroke(); g.setLineDash([]);
      g.strokeStyle = z.color === 'gold' ? PAL.lemon : z.color === 'coral' ? PAL.coral : PAL.sky; g.lineWidth = 7; g.beginPath(); g.arc(z.x, z.y, ZONE_R - 6, 0, Math.PI * 2); g.stroke();
      if (z.contender && z.progress > 0) { const ci = f.teamIndex(z.contender); g.strokeStyle = TEAM_COLORS[ci % 4]!; g.lineWidth = 9; g.beginPath(); g.arc(z.x, z.y, ZONE_R + 2, -Math.PI / 2, -Math.PI / 2 + (z.progress / 1000) * Math.PI * 2); g.stroke(); }
      if (own >= 0) { g.fillStyle = TEAM_DARK[own % 4]!; teamMark(g, TEAM_SHAPE[own % 4]!, z.x, z.y, 11); g.fill(); outline(g, 2.5); g.stroke(); }
      if (z.shielded) { g.strokeStyle = 'rgba(107,191,232,.9)'; g.lineWidth = 4; g.setLineDash([6, 5]); g.lineDashOffset = -t * 18; g.beginPath(); g.arc(z.x, z.y, ZONE_R + 20, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    });
    const r = live.rotate;
    if (r?.next) { live.zones.forEach((z, i) => { const will = r.next!.includes(i); const was = r.active.includes(i); if (will === was) return; g.save(); g.strokeStyle = will ? '#2E9E5B' : '#C2492F'; g.lineWidth = 4; g.setLineDash([5, 6]); g.lineDashOffset = -t * 24; g.beginPath(); g.arc(z.x, z.y, ZONE_R + 30, 0, Math.PI * 2); g.stroke(); g.fillStyle = will ? '#2E9E5B' : '#C2492F'; g.font = '800 13px system-ui'; g.textAlign = 'center'; g.fillText(will ? 'OPENING' : 'CLOSING', z.x, z.y - ZONE_R - 38); g.restore(); }); }
  }
  // crystals (+ telegraph)
  if (live) {
    live.nextCrystals?.forEach((n) => { g.save(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.setLineDash([4, 5]); g.beginPath(); g.arc(n.x, n.y, 20, 0, Math.PI * 2); g.stroke(); g.restore(); });
    live.crystals.forEach((c) => { if (c.hot) { g.fillStyle = 'rgba(255,214,102,.45)'; g.beginPath(); g.arc(c.x, c.y, 30 + Math.sin(t * 4) * 3, 0, Math.PI * 2); g.fill(); } drawProp(g, 'crystal', c.x, c.y + 18, c.hot ? 54 : 44, t, hash2(c.id, 5), c.hot ? 1 : 0); });
  }
  // gates: closed = lilac glass, open = light bridge
  const open = new Set(live?.bridges.map((b) => b.gate) ?? []);
  const items: { y: number; draw: () => void }[] = [];
  geo.solids.forEach((s: Solid) => items.push({ y: s.y, draw: () => drawSolid(g, s, pal, t, s.gate !== null && open.has(s.gate)) }));
  geo.deco.filter((d) => d.z === 1).forEach((d) => items.push({ y: d.y, draw: () => drawDeco(g, d.kind, d.x, d.y, d.s, d.rot, t, pal) }));
  live?.bridges.forEach((b) => { g.save(); g.strokeStyle = pal.accent; g.lineWidth = 9; g.setLineDash([16, 10]); g.lineDashOffset = -t * 28; g.beginPath(); g.arc(b.x, b.y, 40, 0, Math.PI * 2); g.stroke(); g.restore(); });
  // banner (relay)
  if (live?.banner && !live.banner.carrier) items.push({ y: live.banner.y, draw: () => { ellipseShadow(g, live.banner!.x, live.banner!.y + 6, 24, 9); flag(g, live.banner!.x, live.banner!.y + 4, live.banner!.cp > 0 ? PAL.lemon : PAL.paper, Math.sin(t * 4) * 4, 1.1); if (live.banner!.resetIn !== null) { g.fillStyle = INK; g.font = '800 13px system-ui'; g.textAlign = 'center'; g.fillText(`returns in ${Math.ceil((live.banner!.resetIn * TICK_MS) / 1000)}s`, live.banner!.x, live.banner!.y + 26); } } });
  // rival pings (decoys / radar blips)
  live?.pings.forEach((p) => { g.save(); g.strokeStyle = p.own ? '#7B5BD0' : 'rgba(23,37,58,.65)'; g.lineWidth = 3; g.setLineDash([3, 5]); const r = 14 + ((t * 20) % 16); g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke(); g.fillStyle = p.own ? '#7B5BD0' : 'rgba(23,37,58,.6)'; g.beginPath(); g.arc(p.x, p.y, 5, 0, Math.PI * 2); g.fill(); g.restore(); });
  // tokens
  f.dots.forEach((d) => items.push({ y: d.y, draw: () => drawToken(g, d, t, o, pub) }));
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
  // vault arrow (deposit guide) and fx
  if (live) live.fx.forEach((e) => { const age = Math.max(0, tick - e.tick) / 20; if (age > 2) return; const col = e.teamId ? TEAM_COLORS[f.teamIndex(e.teamId) % 4]! : PAL.lemon; g.save(); g.globalAlpha = Math.max(0, 1 - age / 2); g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(e.x, e.y, 14 + age * 46, 0, Math.PI * 2); g.stroke(); if (!o.lowFx && !o.reduced) for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + age; g.fillStyle = col; g.beginPath(); g.arc(e.x + Math.cos(a) * (10 + age * 40), e.y + Math.sin(a) * (10 + age * 40), 3, 0, Math.PI * 2); g.fill(); } g.restore(); });
  g.restore();
  if (!o.contrast) drawAtmosphere(g, W, H, o.time, 'stadium', { reduced: o.reduced, lowFx: o.lowFx, seed: 5 });
  if (o.mini && o.mode === 'follow') drawMini(g, f, o, pal);
}

function drawSolid(g: CanvasRenderingContext2D, s: Solid, pal: { accent: string; water: string; lane: string }, t: number, bridged: boolean) {
  const seed = hash2(Math.round(s.x), Math.round(s.y), 9);
  if (s.kind === 'bush') { drawProp(g, 'bush', s.x, s.y + s.r * 0.6, s.r * 2.8, t, seed, Math.floor(seed * 3)); if (s.gate !== null) gateRing(g, s, bridged, pal, t); return; }
  if (s.kind === 'gear') { g.save(); g.translate(s.x, s.y); ellipseShadow(g, 0, s.r * 0.5, s.r * 1.1, s.r * 0.4, 0.2); g.rotate(t * (seed > 0.5 ? 0.5 : -0.5)); outline(g, 3.5); g.fillStyle = s.gate !== null ? PAL.brass : PAL.slate; g.beginPath(); for (let i = 0; i < 20; i++) { const a = (i * Math.PI) / 10; const r = i % 2 ? s.r * 0.86 : s.r * 1.08; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); g.fillStyle = PAL.paper; g.beginPath(); g.arc(0, 0, s.r * 0.34, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); if (s.gate !== null) gateRing(g, s, bridged, pal, t); return; }
  if (s.kind === 'crystal') { drawProp(g, 'crystal', s.x, s.y + s.r * 0.7, s.r * 3, t, seed, 1); return; }
  g.save(); outline(g, 3.5); g.fillStyle = pal.water; g.beginPath(); g.arc(s.x, s.y, s.r + 4, 0, Math.PI * 2); g.fill(); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2.5; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(s.x, s.y, s.r * (0.35 + i * 0.3) + Math.sin(t * 2 + i) * 2, 0.3, 2.4); g.stroke(); } g.restore();
  if (s.gate !== null) gateRing(g, s, bridged, pal, t);
}
function gateRing(g: CanvasRenderingContext2D, s: Solid, bridged: boolean, pal: { accent: string }, t: number) {
  g.save(); if (bridged) { g.globalAlpha = 0.65; g.strokeStyle = pal.accent; g.lineWidth = 5; g.setLineDash([8, 6]); g.lineDashOffset = -t * 20; g.beginPath(); g.arc(s.x, s.y, s.r + 6, 0, Math.PI * 2); g.stroke(); } else { g.strokeStyle = 'rgba(155,123,224,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(s.x, s.y, s.r + 5, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(190,170,240,.35)'; g.beginPath(); g.arc(s.x, s.y, s.r + 5, 0, Math.PI * 2); g.fill(); } g.restore();
}

function drawToken(g: CanvasRenderingContext2D, d: DrawDot, t: number, o: DrawOpts, pub: ArenaPublic) {
  const col = TEAM_COLORS[d.team % 4]!; const dark = TEAM_DARK[d.team % 4]!; const r = PLAYER_R; const alpha = d.idle ? 0.45 : 1;
  g.save(); g.globalAlpha = alpha; ellipseShadow(g, d.x, d.y + r * 0.7, r * 1.05, r * 0.45, 0.22);
  if (d.dash && !o.reduced) { for (let k = 1; k <= 3; k++) { g.fillStyle = `${col}${['66', '44', '22'][k - 1]}`; g.beginPath(); g.arc(d.x - d.vx * k * 6, d.y - d.vy * k * 6, r * (1 - k * 0.15), 0, Math.PI * 2); g.fill(); } }
  if (d.mine) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(d.x, d.y, r + 6 + (o.reduced ? 0 : Math.sin(t * 5) * 1.5), 0, Math.PI * 2); g.stroke(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
  outline(g, 3); g.fillStyle = col; g.beginPath(); g.arc(d.x, d.y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = dark; teamMark(g, TEAM_SHAPE[d.team % 4]!, d.x + r * 0.62, d.y - r * 0.7, 6.2); g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
  glyph(g, ROLE_GLYPH[d.role], d.x, d.y, r * 1.15, '#fff', 4); glyph(g, ROLE_GLYPH[d.role], d.x, d.y, r * 1.15, INK, 2);
  if (d.banner) flag(g, d.x - 4, d.y - r + 2, PAL.lemon, Math.sin(t * 6) * 3, 0.9);
  for (let k = 0; k < d.carrying; k++) drawProp(g, 'crystal', d.x - 12 + k * 12, d.y - r - 12, 22, t, 0.2 + k * 0.2, 1);
  if (d.mate || pub.view !== 'student') { g.font = '700 12px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineWidth = 3.5; g.strokeStyle = PAPER; g.fillStyle = INK; const label = d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label; g.strokeText(label, d.x, d.y + r + 15); g.fillText(label, d.x, d.y + r + 15); }
  if (d.idle) { g.font = '700 11px system-ui'; g.fillStyle = INK; g.fillText('away', d.x, d.y - r - 6); }
  g.restore();
}

function drawMini(g: CanvasRenderingContext2D, f: ArenaFrame, o: DrawOpts, pal: { ground: string }) {
  const S = Math.max(84, Math.min(116, Math.round(Math.min(o.width, o.height) * 0.26))); const x0 = o.width - S - 8; const y0 = 8; const k = S / WORLD;
  g.save(); g.globalAlpha = 0.94; outline(g, 2.5); g.fillStyle = pal.ground; g.beginPath(); rr(g, x0, y0, S, S, 10); g.fill(); g.stroke(); g.clip();
  g.drawImage(buildLayer(f.geo, o.contrast), x0, y0, S, S);
  f.geo.solids.forEach((s) => { g.fillStyle = 'rgba(23,37,58,.5)'; g.beginPath(); g.arc(x0 + s.x * k, y0 + s.y * k, Math.max(1.5, s.r * k), 0, Math.PI * 2); g.fill(); });
  f.pub.live?.zones.forEach((z) => { const own = z.owner ? f.teamIndex(z.owner) : -1; g.fillStyle = own >= 0 ? TEAM_COLORS[own % 4]! : '#fff'; g.globalAlpha = z.active ? 1 : 0.45; g.beginPath(); g.arc(x0 + z.x * k, y0 + z.y * k, 4, 0, Math.PI * 2); g.fill(); g.globalAlpha = 0.94; });
  f.dots.forEach((d) => { if (!d.mate && f.pub.view === 'student') return; g.fillStyle = TEAM_COLORS[d.team % 4]!; g.beginPath(); g.arc(x0 + d.x * k, y0 + d.y * k, d.mine ? 4 : 2.6, 0, Math.PI * 2); g.fill(); if (d.mine) { g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); } });
  g.restore();
}
