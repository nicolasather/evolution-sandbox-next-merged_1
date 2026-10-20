/** Composes one frame of the arena from the buffered authoritative snapshots. Drawing only: nothing here changes game state. */
import { ENEMY_KINDS, BOSS_KINDS, ROLES, type Role, type EnemyKind, type BossKind, type MapId } from '../domain';
import { ROLE_DEFS, WORLD, VIEW, BOSS_DEFS } from '../balance';
import { MAPS, regionAt } from '../maps';
import { drawLandmark, drawAmbient } from './landmarks';
import { SnapshotBuffer, sampleGroup } from './interp';
import { renderBackdrop } from './backdrop';
import { drawRole, drawEnemy, drawBoss, drawBeacon, drawTurret, drawDrone, drawBullet, ROLE_SCALE, type RoleState } from './sprites';
import { decodeHazard, drawHazard } from './hazards';
import { FxLayer } from './fxlayer';
import { theme, GOLD, SAFE, WARN, PAPER_2, type Theme } from './palette';

const TAU = Math.PI * 2;
const OFFLINE = 1, DOWN = 2, SHIELD = 4, DASH = 8, PROT = 16;
export type RosterRow = { id: string; name: string; role: Role; on: boolean };
export type ArenaInfo = { beacon: { hp: number; max: number; shieldOn: boolean }; status: string };
export type FrameInput = {
  mapId: MapId; clientMs: number; buffer: SnapshotBuffer; roster: RosterRow[]; meId?: string; arena?: ArenaInfo; fx: FxLayer; hc: boolean; reduced: boolean;
  selfInput?: { x: number; y: number }; /** show the whole arena (host / projector / teacher) instead of following one avatar */ overview?: boolean; interpDelayMs?: number; showNames?: boolean; paused?: boolean; phone?: boolean;
};
type Track = { x: number; y: number; hp: number; hit: number; fire: number; moving: boolean; seen: number };

export class SceneRenderer {
  private ctx: CanvasRenderingContext2D; private back: { key: string; canvas: HTMLCanvasElement } | null = null; private tracks = new Map<string, Track>(); private seenBullets = new Set<number>(); private lastT = 0;
  scale = 1; ox = 0; oy = 0; cssW = 0; cssH = 0; private base = 1; private fit = 1; private cx: number = WORLD.bx; private cy: number = WORLD.by; private camInit = false; private regionId = ''; private regionAge = 99; private regionName = '';
  /** the world rectangle currently on screen (for the minimap and culling) */
  view: { x0: number; y0: number; x1: number; y1: number } = { x0: 0, y0: 0, x1: WORLD.w, y1: WORLD.h };
  constructor(public canvas: HTMLCanvasElement) { const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas is not available'); this.ctx = c; }
  /** Size the canvas sharply for high-DPI screens; the camera shows a 960×600-sized window of the 1920×1200 world (or all of it in overview). */
  resize() {
    const r = this.canvas.getBoundingClientRect(); const dpr = Math.min(3, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1); const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cssW = r.width; this.cssH = r.height; this.base = Math.min(w / VIEW.w, h / VIEW.h); this.fit = Math.min(w / WORLD.w, h / WORLD.h); this.scale = this.base; this.ox = 0; this.oy = 0;
  }
  toWorld(clientX: number, clientY: number): [number, number] { const r = this.canvas.getBoundingClientRect(); const dpr = this.canvas.width / Math.max(1, r.width); return [((clientX - r.left) * dpr - this.ox) / this.scale, ((clientY - r.top) * dpr - this.oy) / this.scale]; }
  private backdrop(mapId: MapId, th: Theme): HTMLCanvasElement {
    const key = `${mapId}:${th.hc}`; if (this.back?.key === key) return this.back.canvas; const q = 1.25;
    const c = document.createElement('canvas'); c.width = Math.round(WORLD.w * q); c.height = Math.round(WORLD.h * q); const g = c.getContext('2d')!; g.scale(q, q); renderBackdrop(g, th, mapId); this.back = { key, canvas: c }; return c;
  }
  frame(f: FrameInput) {
    const th = theme(f.hc, f.reduced); const ctx = this.ctx; const t = f.clientMs / 1000; const dt = Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#1D2C35'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const serverNow = f.clientMs + f.buffer.offset; const delay = f.interpDelayMs ?? 110;
    const s = f.buffer.at(serverNow - delay); const selfS = f.buffer.at(serverNow - 55);
    // ---- camera: follow your avatar (or the squad's centre when spectating); overview shows the whole arena ----
    const sc = f.overview ? this.fit : this.base; this.scale = sc; const vw = this.canvas.width / sc, vh = this.canvas.height / sc;
    let tx: number = WORLD.bx, ty: number = WORLD.by;
    if (!f.overview && selfS) {
      const mine = f.meId ? sampleGroup('p', selfS)[f.meId] : undefined;
      if (mine) { tx = mine[0]!; ty = mine[1]!; } else { const all = Object.values(sampleGroup('p', selfS)); if (all.length) { tx = all.reduce((n, a) => n + a[0]!, 0) / all.length; ty = all.reduce((n, a) => n + a[1]!, 0) / all.length; } }
    }
    if (!this.camInit || f.reduced) { this.cx = tx; this.cy = ty; this.camInit = true; } else { const k = 1 - Math.exp(-dt * 7); this.cx += (tx - this.cx) * k; this.cy += (ty - this.cy) * k; }
    const camX = vw >= WORLD.w ? (WORLD.w - vw) / 2 : Math.min(WORLD.w - vw, Math.max(0, this.cx - vw / 2)); const camY = vh >= WORLD.h ? (WORLD.h - vh) / 2 : Math.min(WORLD.h - vh, Math.max(0, this.cy - vh / 2));
    this.ox = -camX * sc; this.oy = -camY * sc; this.view = { x0: camX, y0: camY, x1: camX + vw, y1: camY + vh };
    const mapDef = MAPS[f.mapId];
    ctx.drawImage(this.backdrop(f.mapId, th), this.ox, this.oy, WORLD.w * sc, WORLD.h * sc);
    ctx.save(); ctx.translate(this.ox, this.oy); ctx.scale(sc, sc); ctx.beginPath(); ctx.rect(0, 0, WORLD.w, WORLD.h); ctx.clip();
    for (const lm of mapDef.landmarks) if (lm.x > this.view.x0 - 160 && lm.x < this.view.x1 + 160 && lm.y > this.view.y0 - 160 && lm.y < this.view.y1 + 160) drawLandmark(ctx, th, lm, f.reduced ? 0 : t);
    drawAmbient(ctx, th, mapDef, t, this.view);
    if (s) {
      const P = sampleGroup('p', s), E = sampleGroup('e', s), B = sampleGroup('b', s), T = sampleGroup('t', s), D = sampleGroup('d', s);
      if (selfS && f.meId) { const mine = sampleGroup('p', selfS)[f.meId]; if (mine) { const m = mine.slice(); if (f.selfInput && !f.paused && !(m[5]! & DOWN)) { const age = Math.min(0.09, Math.max(0, (f.clientMs - (f.buffer.latest()?.arrived ?? f.clientMs)) / 1000)) ; const sp = ROLE_DEFS[ROLES[m[6]!] ?? 'scout'].speed; m[0] = Math.min(WORLD.w - 16, Math.max(16, m[0]! + f.selfInput.x * sp * age)); m[1] = Math.min(WORLD.h - 16, Math.max(16, m[1]! + f.selfInput.y * sp * age)); } P[f.meId] = m; } }
      const latest = f.buffer.latest()!;
      // hazards: ground layer, from authoritative numbers
      for (const [id, a] of Object.entries(latest.e.h ?? {})) drawHazard(ctx, th, decodeHazard(a, Number(id)), t);
      for (const [id, a] of Object.entries(T)) drawTurret(ctx, th, a[0]!, a[1]!, (a[2] ?? 0) / 70, t + Number(id));
      const beacon = f.arena?.beacon; drawBeacon(ctx, th, WORLD.bx, WORLD.by, beacon ? beacon.hp / Math.max(1, beacon.max) : 1, !!beacon?.shieldOn, t);
      // track hits and fire pulses from authoritative state changes
      for (const [id, a] of Object.entries(P)) { const tr = this.tracks.get(`p${id}`) ?? { x: a[0]!, y: a[1]!, hp: a[2]!, hit: 0, fire: 0, moving: false, seen: t }; if (a[2]! < tr.hp) tr.hit = 1; tr.moving = Math.hypot(a[0]! - tr.x, a[1]! - tr.y) > 0.4; tr.x = a[0]!; tr.y = a[1]!; tr.hp = a[2]!; tr.seen = t; tr.hit = Math.max(0, tr.hit - dt / 0.09); tr.fire = Math.max(0, tr.fire - dt / 0.1); this.tracks.set(`p${id}`, tr); }
      for (const [id, a] of Object.entries(B)) { const n = Number(id); if (!this.seenBullets.has(n)) { this.seenBullets.add(n); if (a[2] === 0) for (const [pid, p] of Object.entries(P)) if (Math.hypot(p[0]! - a[0]!, p[1]! - a[1]!) < 34) this.tracks.get(`p${pid}`)!.fire = 1; } }
      if (this.seenBullets.size > 600) this.seenBullets = new Set([...this.seenBullets].slice(-200));
      // enemies sorted by y so lower ones overlap higher ones
      const en = Object.entries(E).sort((a, b) => a[1][2]! - b[1][2]!); let boss: number[] | null = null;
      for (const [id, a] of en) {
        const ki = a[0]!; const tr = this.tracks.get(`e${id}`) ?? { x: a[1]!, y: a[2]!, hp: a[3]!, hit: 0, fire: 0, moving: false, seen: t }; if (a[3]! < tr.hp) tr.hit = 1; tr.hp = a[3]!; tr.hit = Math.max(0, tr.hit - dt / 0.09); tr.seen = t; this.tracks.set(`e${id}`, tr);
        if (ki >= ENEMY_KINDS.length) { boss = a; drawBoss(ctx, th, BOSS_KINDS[ki - ENEMY_KINDS.length]! as BossKind, a[1]!, a[2]!, a[7]!, { t, face: a[6]! / 100, phase: a[8]!, hit: tr.hit, inhale: Math.max(0, Math.sin(t * 1.3)) }); }
        else drawEnemy(ctx, th, ENEMY_KINDS[ki]! as EnemyKind, a[1]!, a[2]!, a[7]!, { t, face: a[6]! / 100, state: a[5]!, hp: a[3]!, maxHp: a[4]!, hit: tr.hit, seed: Number(id), dying: a[5] === 0 ? Math.min(1, (a[9] ?? 0) / 8) : 0 });
      }
      void boss;
      // drones, then avatars on top of enemies so your own avatar never disappears under a crowd
      for (const [id, a] of Object.entries(D)) drawDrone(ctx, th, a[0]!, a[1]!, t + Number(id));
      const byId = new Map(f.roster.map((r) => [r.id, r])); const ps = Object.entries(P).sort((a, b) => a[1][1]! - b[1][1]!);
      for (const [id, a] of ps) {
        const role = ROLES[a[6]!]!; const fl = a[5]!; const tr = this.tracks.get(`p${id}`)!; const mine = id === f.meId;
        if (mine) { ctx.save(); ctx.beginPath(); ctx.arc(a[0]!, a[1]!, 16 * ROLE_SCALE + 10, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = PAPER_2; ctx.stroke(); ctx.restore(); }
        const st: RoleState = { t, face: a[4]! / 100, moving: tr.moving, down: !!(fl & DOWN), hit: tr.hit, firing: tr.fire, ability: 0, shield: !!(fl & SHIELD) || a[7]! > 0, offline: !!(fl & OFFLINE), protectedUntil: !!(fl & PROT), revive: (fl & DOWN) ? Math.min(1, (a[11] ?? 0) / 160) : 0, downFrac: Math.min(1, (a[10] ?? 0) / 600), seed: id.charCodeAt(0) + id.charCodeAt(id.length - 1) };
        if (fl & DASH && !th.reduced) { for (let i = 1; i <= 3; i++) { ctx.save(); ctx.globalAlpha = 0.35 - i * 0.08; drawRole(ctx, th, role, a[0]! - Math.cos(st.face) * i * 9, a[1]! - Math.sin(st.face) * i * 9, { ...st, moving: false }); ctx.restore(); } }
        drawRole(ctx, th, role, a[0]!, a[1]!, st);
        const hpf = a[2]! / Math.max(1, a[3]!); const bw = 34; const by = a[1]! - 16 * ROLE_SCALE - 14; ctx.fillStyle = 'rgba(29,44,53,0.88)'; ctx.fillRect(a[0]! - bw / 2 - 1.5, by - 1.5, bw + 3, 8); ctx.fillStyle = (fl & DOWN) ? '#7A7A7A' : hpf > 0.5 ? SAFE : hpf > 0.25 ? GOLD : WARN; ctx.fillRect(a[0]! - bw / 2, by, bw * Math.max(0, hpf), 5);
        const nm = byId.get(id); if ((f.showNames || mine) && nm) { ctx.font = `700 ${mine ? 13 : 11}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = th.ink; const short = nm.name.length > 11 ? nm.name.slice(0, 10) + '…' : nm.name; const label = (mine ? (nm.name.toLowerCase() === 'you' ? 'You' : 'You · ' + short) : short) + (fl & OFFLINE ? ' (offline)' : ''); ctx.strokeText(label, a[0]!, by - 5); ctx.fillStyle = mine ? GOLD : PAPER_2; ctx.fillText(label, a[0]!, by - 5); }
        if (fl & DOWN) { ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = th.ink; ctx.strokeText('Down — stay close to revive', a[0]!, a[1]! + 34); ctx.fillStyle = PAPER_2; ctx.fillText('Down — stay close to revive', a[0]!, a[1]! + 34); }
      }
      for (const a of Object.values(B)) drawBullet(ctx, th, a[2]!, a[0]!, a[1]!, a[3]!, a[4]!, a[5]!);
      f.fx.draw(ctx, th, t);
      for (const k of this.tracks.keys()) if (t - this.tracks.get(k)!.seen > 3) this.tracks.delete(k);
    }
    ctx.restore();
    if (s) this.overlay(f, th, s, mapDef, dt);
  }
  /** screen-space aids for the big arena: beacon pointer when it is off screen, a small minimap, and the "you entered …" region banner */
  private overlay(f: FrameInput, th: Theme, s: NonNullable<ReturnType<SnapshotBuffer['at']>>, map: (typeof MAPS)[MapId], dt: number) {
    const ctx = this.ctx; const W = this.canvas.width, H = this.canvas.height; const u = Math.max(1, Math.min(W / 960, H / 600)); const v = this.view; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const P = sampleGroup('p', s), E = sampleGroup('e', s);
    if (!f.overview) {
      // beacon pointer
      if (WORLD.bx < v.x0 || WORLD.bx > v.x1 || WORLD.by < v.y0 || WORLD.by > v.y1) {
        const sx = WORLD.bx * this.scale + this.ox, sy = WORLD.by * this.scale + this.oy; const ccx = W / 2, ccy = H / 2; const ang = Math.atan2(sy - ccy, sx - ccx); const m = 34 * u;
        const k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(Math.cos(ang))), (H / 2 - m) / Math.max(1e-3, Math.abs(Math.sin(ang)))); const px = ccx + Math.cos(ang) * k, py = ccy + Math.sin(ang) * k;
        ctx.translate(px, py); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(16 * u, 0); ctx.lineTo(-10 * u, -11 * u); ctx.lineTo(-4 * u, 0); ctx.lineTo(-10 * u, 11 * u); ctx.closePath(); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = 3 * u; ctx.lineJoin = 'round'; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.rotate(-ang); ctx.translate(-px, -py);
      }
      // region banner
      const me = f.meId ? P[f.meId] : undefined; const rg = me ? regionAt(map, me[0]!, me[1]!) : null;
      if ((rg?.id ?? '') !== this.regionId) { this.regionId = rg?.id ?? ''; if (rg) { this.regionName = rg.name; this.regionAge = 0; } }
      this.regionAge += dt;
      if (this.regionAge < 2.6 && this.regionName) { const a = Math.min(1, (2.6 - this.regionAge) / 0.8, this.regionAge / 0.25); ctx.globalAlpha = a; ctx.font = `800 ${15 * u}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 5 * u; ctx.strokeStyle = th.ink; ctx.strokeText(this.regionName, W / 2, 56 * u); ctx.fillStyle = PAPER_2; ctx.fillText(this.regionName, W / 2, 56 * u); ctx.globalAlpha = 1; }
      // minimap
      const mw = Math.round(W < 700 ? 96 * u : 150 * u), mh = mw * (WORLD.h / WORLD.w), mx = 10 * u, my = 10 * u; const kx = mw / WORLD.w, ky = mh / WORLD.h;
      ctx.globalAlpha = 0.92; ctx.fillStyle = map.ground; ctx.fillRect(mx, my, mw, mh); ctx.globalAlpha = 0.55; for (const r of map.regions) { ctx.fillStyle = r.tint; ctx.fillRect(mx + r.x * kx, my + r.y * ky, r.w * kx, r.h * ky); } ctx.globalAlpha = 1;
      ctx.fillStyle = th.ink; for (const o of map.obstacles) { if (o.kind === 'circle') { ctx.beginPath(); ctx.arc(mx + o.x * kx, my + o.y * ky, Math.max(1.5, o.r * kx), 0, TAU); ctx.fill(); } else ctx.fillRect(mx + o.x * kx, my + o.y * ky, Math.max(2, o.w * kx), Math.max(2, o.h * ky)); }
      ctx.fillStyle = '#F77765'; for (const a of Object.values(E)) ctx.fillRect(mx + a[1]! * kx - 1, my + a[2]! * ky - 1, 2.2 * u, 2.2 * u);
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(mx + WORLD.bx * kx, my + WORLD.by * ky, 3.2 * u, 0, TAU); ctx.fill(); ctx.lineWidth = 1.4 * u; ctx.strokeStyle = th.ink; ctx.stroke();
      for (const [id, a] of Object.entries(P)) { ctx.fillStyle = id === f.meId ? '#FFFFFF' : '#3FBF8A'; ctx.beginPath(); ctx.arc(mx + a[0]! * kx, my + a[1]! * ky, (id === f.meId ? 3.4 : 2.6) * u, 0, TAU); ctx.fill(); ctx.lineWidth = 1.2 * u; ctx.strokeStyle = th.ink; ctx.stroke(); }
      ctx.lineWidth = 1.6 * u; ctx.strokeStyle = PAPER_2; ctx.strokeRect(mx + v.x0 * kx, my + v.y0 * ky, (v.x1 - v.x0) * kx, (v.y1 - v.y0) * ky);
      ctx.lineWidth = 2.4 * u; ctx.strokeStyle = th.ink; ctx.strokeRect(mx, my, mw, mh);
    }
    ctx.restore();
  }
  /** a short text description for assistive tech: what is happening in the world right now */
  static describe(f: { enemies: number; boss: string | null; hp: number; maxHp: number; beaconPct: number; down: number; wave: number; waves: number }): string {
    return `Wave ${f.wave} of ${f.waves}. ${f.enemies} enemies. ${f.boss ? `${f.boss} is here. ` : ''}Your health ${f.hp} of ${f.maxHp}. Beacon at ${f.beaconPct} percent.${f.down ? ` ${f.down} teammate${f.down > 1 ? 's' : ''} down.` : ''}`;
  }
}
export { BOSS_DEFS };
