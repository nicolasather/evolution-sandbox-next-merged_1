/** Authoritative-event feedback. Every effect is created by a server fx event (never guessed), is time-boxed, and is capped (60 particles desktop, 25 phone).
 *  Reduced motion replaces motion with a static outline icon and a number held for 700 ms. Damage numbers are aggregated in 180 ms windows. */
import type { Fx } from '../domain';
import { SAFE, WARN, GOLD, PAPER_2, type Theme } from './palette';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
type P = { k: Fx['k']; x: number; y: number; born: number; life: number; n?: number; a?: string; dir: number };
const LIFE: Record<Fx['k'], number> = { hit: 0.06, kill: 0.16, heal: 0.33, pulse: 0.45, volley: 0.2, dash: 0.2, down: 0.26, revive: 0.47, beacon_hit: 0.3, shield: 0.4, banner: 0, boss_phase: 0.5, boss_down: 1, mend: 0.6, turret: 0.2, reflect: 0.1 };

export class FxLayer {
  private ps: P[] = []; private nums = new Map<string, { x: number; y: number; n: number; at: number; col: string; last: number }>();
  constructor(public cap = 60) {}
  add(evts: Fx[], now: number) {
    for (const e of evts) {
      if (e.k === 'banner') continue;
      if ((e.k === 'hit' || e.k === 'heal' || e.k === 'beacon_hit') && e.n) { const key = `${e.k}:${Math.round(e.x / 30)}:${Math.round(e.y / 30)}`; const cur = this.nums.get(key); if (cur && now - cur.at < 0.18) { cur.n += e.n; cur.last = now; } else this.nums.set(key, { x: e.x, y: e.y, n: e.n, at: now, col: e.k === 'heal' ? SAFE : e.k === 'beacon_hit' ? WARN : PAPER_2, last: now }); }
      if (this.ps.length >= this.cap) this.ps.shift();
      this.ps.push({ k: e.k, x: e.x, y: e.y, born: now, life: LIFE[e.k] ?? 0.3, n: e.n, a: e.a, dir: (e.x * 0.37 + e.y * 0.11) % TAU });
    }
  }
  get count() { return this.ps.length; }
  draw(ctx: C, th: Theme, now: number) {
    this.ps = this.ps.filter((p) => now - p.born < Math.max(p.life, th.reduced ? 0.7 : 0));
    for (const p of this.ps) {
      const age = now - p.born; const u = Math.min(1, age / Math.max(0.001, p.life)); ctx.save(); ctx.translate(p.x, p.y); ctx.lineCap = 'round';
      if (th.reduced) { this.icon(ctx, th, p); ctx.restore(); continue; }
      switch (p.k) {
        case 'hit': for (let i = 0; i < 4; i++) { const a = p.dir + (i / 4) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * (9 + 5 * u), Math.sin(a) * (9 + 5 * u)); ctx.strokeStyle = PAPER_2; ctx.lineWidth = 2.6; ctx.globalAlpha = 1 - u; ctx.stroke(); } break;
        case 'kill': ctx.globalAlpha = 0.7 * (1 - u); ctx.beginPath(); ctx.ellipse(0, 4 * u, 14 * (1 + u * 0.6), 14 * (1 - u * 0.7), 0, 0, TAU); ctx.fillStyle = PAPER_2; ctx.fill(); break;
        case 'heal': case 'mend': { const r = (p.k === 'mend' ? 40 : 18) * (0.9 + 0.25 * u); ctx.globalAlpha = 0.9 * (1 - u * 0.8); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.strokeStyle = SAFE; ctx.lineWidth = 3; ctx.stroke(); break; }
        case 'pulse': case 'shield': { const r = (p.n && p.n > 20 ? p.n : 70) * u; ctx.globalAlpha = 0.8 * (1 - u); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = th.ink; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = p.k === 'shield' ? '#BFD9FF' : PAPER_2; ctx.stroke(); break; }
        case 'dash': for (let i = 0; i < 3; i++) { ctx.globalAlpha = (0.5 - i * 0.15) * (1 - u); ctx.beginPath(); ctx.arc(-i * 9, 0, 14, 0, TAU); ctx.fillStyle = '#9A6BD8'; ctx.fill(); } break;
        case 'volley': case 'turret': ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.arc(0, 0, 8 + 14 * u, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke(); break;
        case 'down': ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.arc(0, 0, 26 * (0.6 + u * 0.6), 0, TAU); ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.strokeStyle = WARN; ctx.stroke(); ctx.setLineDash([]); break;
        case 'revive': ctx.globalAlpha = 1 - u * 0.5; ctx.beginPath(); ctx.arc(0, 0, 28 * (0.6 + 0.4 * Math.min(1, u * 2)), 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = SAFE; ctx.stroke(); break;
        case 'beacon_hit': ctx.globalAlpha = 0.9 * (1 - u); ctx.beginPath(); ctx.arc(0, 0, 44 + 6 * u, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = WARN; ctx.stroke(); break;
        case 'boss_phase': ctx.globalAlpha = 0.8 * (1 - u); ctx.beginPath(); ctx.arc(0, 0, 80 + 90 * u, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = '#F08A2C'; ctx.stroke(); break;
        case 'boss_down': for (let i = 0; i < 4; i++) { const k = Math.min(1, Math.max(0, (u - i * 0.2) / 0.3)); ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(Math.cos(i * 1.6) * 30, Math.sin(i * 1.6) * 26, 16 + 40 * k, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = GOLD; ctx.stroke(); } break;
        case 'reflect': ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.lineWidth = 3; ctx.strokeStyle = '#4FC3D9'; ctx.stroke(); break;
      }
      ctx.restore();
    }
    ctx.save(); ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const [key, v] of this.nums) { const age = now - v.last; const hold = th.reduced ? 0.7 : 0.55; if (age > hold) { this.nums.delete(key); continue; } const yy = v.y - 18 - (th.reduced ? 0 : age * 26); ctx.globalAlpha = Math.min(1, (hold - age) / 0.2); const txt = `${key.startsWith('heal') ? '+' : '−'}${Math.round(v.n)}`; ctx.lineWidth = 4; ctx.strokeStyle = th.ink; ctx.strokeText(txt, v.x, yy); ctx.fillStyle = v.col; ctx.fillText(txt, v.x, yy); }
    ctx.restore();
  }
  /** Reduced motion: a static outline mark. Meaning stays (shape + number), motion goes. */
  private icon(ctx: C, th: Theme, p: P) {
    ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.strokeStyle = th.ink;
    if (p.k === 'heal' || p.k === 'mend' || p.k === 'revive') { ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.strokeStyle = SAFE; ctx.stroke(); }
    else if (p.k === 'down' || p.k === 'beacon_hit' || p.k === 'boss_phase') { ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.strokeStyle = WARN; ctx.stroke(); }
    else if (p.k === 'shield' || p.k === 'pulse') { ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.strokeStyle = '#BFD9FF'; ctx.stroke(); }
  }
}
