/** Fixtures and a deterministic bot driver used by tests, the balance tool and load simulations. No network, no clock: virtual time only. */
import type { Config, Role, Room } from './domain';
import { ROLES } from './domain';
import { WORLD } from './balance';
import { createRoom, hostCommand, playerAbility, playerMove, recordAnswer, seat, step, vote, canAnswer } from './room';
import { seedFrom } from './rng';
import { inHazard } from './bosses';

export const KINDS = ['multiple_choice', 'answer_forge', 'truth_hunt', 'connection_rush', 'fill_table'];
export const fixturePool = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `rq${i + 1}`, kind: KINDS[i % KINDS.length]! }));
export type Fixture = { room: Room; ids: string[][]; now: number };
export function mkRoom(o: { mode?: 'coop' | 'versus'; sizes: number[]; minutes?: number; roles?: (Role | 'mix')[]; pool?: number; seed?: number; config?: Partial<Config>; start?: boolean }): Fixture {
  const mode = o.mode ?? (o.sizes.length === 1 ? 'coop' : 'versus'); let now = 1_000_000;
  const cap = Math.max(...o.sizes);
  const room = createRoom({ id: `room-${o.seed ?? 1}`, code: 'ABC123', seed: o.seed ?? 1337, nowMs: now, pool: fixturePool(o.pool ?? 40), config: { mode, teamCount: o.sizes.length, teamSizeCap: cap, minutes: o.minutes ?? 5, ...(o.config ?? {}) } });
  const ids: string[][] = [];
  o.sizes.forEach((n, ti) => {
    const row: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = `p${ti + 1}_${i + 1}`; const wanted = o.roles?.[ti];
      const role = wanted && wanted !== 'mix' ? wanted : ROLES[i % ROLES.length]!;
      const r = seat(room, { id, name: `Kid ${ti + 1}-${i + 1}`, desiredTeam: `t${ti + 1}`, role }, now); if (!r.ok) throw new Error(r.message); row.push(id);
    }
    ids.push(row);
  });
  if (o.start !== false) { hostCommand(room, { cmd: 'start', id: 'c-start' }, now); const b = hostCommand(room, { cmd: 'begin', id: 'c-begin' }, now); if (!b.ok) throw new Error(b.message); }
  return { room, ids, now };
}

export type BotOpts = { accuracy?: number; abilities?: boolean; latencyMs?: number; maxMs?: number; onTick?: (r: Room, now: number) => void; stopAt?: (r: Room) => boolean };
const h01 = (s: string) => (seedFrom(s) % 10000) / 10000;
export function drive(fx: Fixture, o: BotOpts = {}): { ticks: number; room: Room } {
  const { room } = fx; let ticks = 0; const limit = fx.now + (o.maxMs ?? 4 * 60 * 60 * 1000);
  while (room.phase !== 'results' && fx.now < limit) {
    fx.now += 50; room.hostSeenMs = fx.now; room.hostPresent = true;
    bots(room, fx.now, o); step(room, fx.now); ticks++;
    o.onTick?.(room, fx.now); if (o.stopAt?.(room)) break;
  }
  return { ticks, room };
}
function bots(room: Room, now: number, o: BotOpts) {
  const acc = o.accuracy ?? 0.85;
  for (const id of room.rosterOrder) {
    const p = room.roster[id]!; if (!p.connected || p.forfeited) continue;
    if (room.phase === 'wave' || room.phase === 'boss_wave') {
      const a = room.arenas[p.teamId]; const e = a?.players[id]; if (!a || !e || a.status !== 'alive' || e.down) continue;
      // kite: step away from the nearest enemy that is close, otherwise hover near the beacon on a personal orbit
      let near: { x: number; y: number; d: number } | null = null;
      for (const en of a.enemies) { const d = Math.hypot(en.x - e.x, en.y - e.y); if (!near || d < near.d) near = { x: en.x, y: en.y, d }; }
      let vx = 0, vy = 0;
      if (near && near.d < 60) { vx = e.x - near.x; vy = e.y - near.y; }
      else {
        // intercept: stand between the swarm and the beacon, a little off-axis per player so the team spreads out
        let threat: { x: number; y: number } | null = null, td = 1e9;
        for (const en of a.enemies) { const d = Math.hypot(en.x - WORLD.bx, en.y - WORLD.by); if (d < td) { td = d; threat = en; } }
        const off = ((seedFrom(id) % 100) / 100 - 0.5) * 1.0;
        const base = threat ? Math.atan2(threat.y - WORLD.by, threat.x - WORLD.bx) : (seedFrom(id) % 628) / 100;
        const tx = WORLD.bx + Math.cos(base + off) * 92, ty = WORLD.by + Math.sin(base + off) * 92; vx = tx - e.x; vy = ty - e.y;
      }
      // hazards: pick the safest of 8 headings (a telegraphed arc/ring/beam/root tile is avoided before it resolves)
      const live = a.hazards.filter((hz) => Math.hypot(hz.x - e.x, hz.y - e.y) < (hz.r1 || 300) + 120);
      const orbs = a.bullets.filter((b) => b.src === 'hazard' && Math.hypot(b.x - e.x, b.y - e.y) < 80);
      if (live.length || orbs.length) {
        let best = -1, bs = 1e9; const want = Math.atan2(vy, vx);
        for (let k = 0; k < 8; k++) {
          const ang = (k * Math.PI) / 4; const px = e.x + Math.cos(ang) * 70, py = e.y + Math.sin(ang) * 70; let sc = Math.abs(((ang - want + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 4;
          if (px < 20 || px > WORLD.w - 20 || py < 20 || py > WORLD.h - 20) sc += 400;
          for (const hz of live) if (inHazard(hz, px, py, 26)) sc += 1000; for (const b of orbs) if (Math.hypot(b.x + b.vx - px, b.y + b.vy - py) < 40) sc += 600;
          if (sc < bs) { bs = sc; best = k; }
        }
        if (best >= 0) { vx = Math.cos((best * Math.PI) / 4); vy = Math.sin((best * Math.PI) / 4); }
      }
      playerMove(room, id, p.seq + 1, vx, vy);
      if (o.abilities !== false && e.abilityCd === 0 && a.enemies.some((en) => Math.hypot(en.x - e.x, en.y - e.y) < 110)) playerAbility(room, id, `ab${room.tick}`);
    } else if (room.phase === 'question' && room.quiz) {
      const q = room.quiz; if (q.answers[id] || !q.eligible[p.teamId]?.includes(id)) continue;
      if (now - q.openedMs < (o.latencyMs ?? 3000)) continue;
      if (canAnswer(room, id, q.id, now).ok) recordAnswer(room, id, q.id, { frac: h01(`${id}|${q.id}`) < acc ? 1 : 0, correct: h01(`${id}|${q.id}`) < acc }, now);
    } else if (room.phase === 'upgrade' && room.draft) {
      const d = room.draft; const offers = d.offers[p.teamId]; if (!offers || d.votes[p.teamId]?.[id] || d.resolved[p.teamId]) continue;
      const pref = ['beacon_plate', 'mend_garden', 'last_stand', 'fan_bolts', 'gear_drone', 'ricochet', 'glacier_field', 'swift_steps']; const order = [...offers].sort((x, y) => pref.indexOf(x) - pref.indexOf(y)); for (const u of order) if (vote(room, id, d.id, u, `bv-${d.id}-${id}-${u}`).ok) break;
    }
  }
}
