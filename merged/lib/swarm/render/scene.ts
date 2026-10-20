/** Composes one frame of the arena from the buffered authoritative snapshots. Drawing only: nothing here changes game state. */
import { ENEMY_KINDS, BOSS_KINDS, ROLES, type Role, type EnemyKind, type BossKind, type MapId } from '../domain';
import { ROLE_DEFS, WORLD, BOSS_DEFS } from '../balance';
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
  selfInput?: { x: number; y: number }; interpDelayMs?: number; showNames?: boolean; paused?: boolean; phone?: boolean;
};
type Track = { x: number; y: number; hp: number; hit: number; fire: number; moving: boolean; seen: number };

export class SceneRenderer {
  private ctx: CanvasRenderingContext2D; private back: { key: string; canvas: HTMLCanvasElement } | null = null; private tracks = new Map<string, Track>(); private seenBullets = new Set<number>(); private lastT = 0;
  scale = 1; ox = 0; oy = 0; cssW = 0; cssH = 0;
  constructor(public canvas: HTMLCanvasElement) { const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas is not available'); this.ctx = c; }
  /** Fit the 960×600 logical world into the element (letterboxed), sharp on high-DPI screens. */
  resize() {
    const r = this.canvas.getBoundingClientRect(); const dpr = Math.min(3, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1); const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cssW = r.width; this.cssH = r.height; this.scale = Math.min(w / WORLD.w, h / WORLD.h); this.ox = (w - WORLD.w * this.scale) / 2; this.oy = (h - WORLD.h * this.scale) / 2;
  }
  toWorld(clientX: number, clientY: number): [number, number] { const r = this.canvas.getBoundingClientRect(); const dpr = this.canvas.width / Math.max(1, r.width); return [((clientX - r.left) * dpr - this.ox) / this.scale, ((clientY - r.top) * dpr - this.oy) / this.scale]; }
  private backdrop(mapId: MapId, th: Theme): HTMLCanvasElement {
    const key = `${mapId}:${th.hc}:${Math.round(this.scale * 100)}`; if (this.back?.key === key) return this.back.canvas;
    const c = document.createElement('canvas'); c.width = Math.round(WORLD.w * this.scale); c.height = Math.round(WORLD.h * this.scale); const g = c.getContext('2d')!; g.scale(this.scale, this.scale); renderBackdrop(g, th, mapId); this.back = { key, canvas: c }; return c;
  }
  frame(f: FrameInput) {
    const th = theme(f.hc, f.reduced); const ctx = this.ctx; const t = f.clientMs / 1000; const dt = Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#1D2C35'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.backdrop(f.mapId, th), this.ox, this.oy);
    ctx.save(); ctx.translate(this.ox, this.oy); ctx.scale(this.scale, this.scale); ctx.beginPath(); ctx.rect(0, 0, WORLD.w, WORLD.h); ctx.clip();
    const serverNow = f.clientMs + f.buffer.offset; const delay = f.interpDelayMs ?? 110;
    const s = f.buffer.at(serverNow - delay); const selfS = f.buffer.at(serverNow - 55);
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
        const nm = byId.get(id); if ((f.showNames || mine) && nm) { ctx.font = `700 ${mine ? 13 : 11}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = th.ink; const label = (mine ? 'You · ' : '') + (nm.name.length > 11 ? nm.name.slice(0, 10) + '…' : nm.name) + (fl & OFFLINE ? ' (offline)' : ''); ctx.strokeText(label, a[0]!, by - 5); ctx.fillStyle = mine ? GOLD : PAPER_2; ctx.fillText(label, a[0]!, by - 5); }
        if (fl & DOWN) { ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = th.ink; ctx.strokeText('Down — stay close to revive', a[0]!, a[1]! + 34); ctx.fillStyle = PAPER_2; ctx.fillText('Down — stay close to revive', a[0]!, a[1]! + 34); }
      }
      for (const a of Object.values(B)) drawBullet(ctx, th, a[2]!, a[0]!, a[1]!, a[3]!, a[4]!, a[5]!);
      f.fx.draw(ctx, th, t);
      for (const k of this.tracks.keys()) if (t - this.tracks.get(k)!.seen > 3) this.tracks.delete(k);
    }
    ctx.restore();
  }
  /** a short text description for assistive tech: what is happening in the world right now */
  static describe(f: { enemies: number; boss: string | null; hp: number; maxHp: number; beaconPct: number; down: number; wave: number; waves: number }): string {
    return `Wave ${f.wave} of ${f.waves}. ${f.enemies} enemies. ${f.boss ? `${f.boss} is here. ` : ''}Your health ${f.hp} of ${f.maxHp}. Beacon at ${f.beaconPct} percent.${f.down ? ` ${f.down} teammate${f.down > 1 ? 's' : ''} down.` : ''}`;
  }
}
export { BOSS_DEFS };
