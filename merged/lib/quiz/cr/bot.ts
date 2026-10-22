/** Scripted classmates for Practice and the fairness simulations. They read the same state a player could and send the same kind of intent: a direction (and, rarely, an action). */
import { ARRIVE_R, HANDOFF_R, STAMP_R } from './balance';
import type { CRState, OptionId, SeatAction } from './domain';
import { dist, goalPath, type Pt } from './maps';
import { activeIn, geoOf, isIdle } from './sim';

export type Intent = { x: number; y: number };
export const STOP: Intent = { x: 0, y: 0 };
function segD(p: Pt, a: Pt, b: Pt) { const vx = b.x - a.x, vy = b.y - a.y; const l2 = vx * vx + vy * vy; const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0; return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t)); }
/** Follow a polyline: aim at the end of the furthest segment the body is already on. */
export function along(poly: readonly Pt[], p: Pt, stopAt = 10): Intent {
  if (poly.length < 2) return STOP; let seg = -1, best = Infinity, bestI = 0;
  for (let i = 1; i < poly.length; i++) { const d = segD(p, poly[i - 1]!, poly[i]!); if (d < 24) seg = i; if (d < best) { best = d; bestI = i; } }
  const i = seg >= 0 ? seg : bestI; let target = poly[i]!; if (dist(target, p) < stopAt && i + 1 < poly.length) target = poly[i + 1]!; else if (dist(target, p) < stopAt) return STOP;
  const d = dist(target, p) || 1; return { x: Math.round(((target.x - p.x) / d) * 100) / 100, y: Math.round(((target.y - p.y) / d) * 100) / 100 };
}
/** Polyline from wherever the body is to the end of spur `site` at the leg's destination hub. */
function pathToSite(s: CRState, p: Pt, site: number, option: OptionId): Pt[] {
  const g = geoOf(s); const target = g.spurs[site]!; const opt = goalPath(g, option);
  const onSpur = g.spurs.find((sp) => dist(p, g.hubB) > 150 && sp.pts.slice(1).some((q, i) => segD(p, sp.pts[i]!, q) < 62));
  if (dist(p, g.hubB) <= 150) return [p, ...target.pts];
  if (onSpur) return [p, ...[...onSpur.pts].reverse(), ...target.pts.slice(1)];
  return [...opt, ...target.pts.slice(1)];
}
export function botIntent(s: CRState, seatId: string): Intent {
  const seat = s.seats.find((x) => x.id === seatId && !x.revoked); const live = s.live; if (!seat || !live || s.phase !== 'race') return STOP;
  const team = s.teams.find((t) => t.id === seat.teamId)!; if (team.obj.done) return STOP;
  const g = geoOf(s); const path = goalPath(g, team.obj.option); const mates = activeIn(s, team.id).filter((m) => !isIdle(live, m)).sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
  if (s.format === 'split_route') return dist(seat, g.hubB) < ARRIVE_R * 0.5 ? STOP : along([...path], seat, 14);
  if (s.format === 'signal_relay') {
    if (team.obj.flagHolder === seat.id) return along(pathToSite(s, seat, Math.max(0, team.obj.legTarget), team.obj.option), seat, 8);
    return dist(seat, g.hubB) < HANDOFF_R * 0.6 ? STOP : along([...path], seat, 14);
  }
  const want = s.evidence[live.leg]?.order?.[team.obj.stampIdx]; if (want === undefined) return STOP;
  const who = mates[team.obj.stampIdx % Math.max(1, mates.length)];
  if (who?.id === seat.id) return dist(seat, g.spurs[want]!.end) < STAMP_R * 0.5 ? STOP : along(pathToSite(s, seat, want, team.obj.option), seat, 8);
  return dist(seat, g.hubB) < HANDOFF_R * 0.6 ? STOP : along([...path], seat, 14);
}
/** An action a classmate would take this tick (hand-offs, stamps, abilities), or null. */
export function botAction(s: CRState, seatId: string): SeatAction | null {
  const seat = s.seats.find((x) => x.id === seatId && !x.revoked); const live = s.live; if (!seat || !live || s.phase !== 'race') return null;
  const team = s.teams.find((t) => t.id === seat.teamId)!; if (team.obj.done) return null; const g = geoOf(s);
  if (s.format === 'signal_relay' && team.obj.flagHolder === seat.id && team.obj.coop.length < 3 && live.tick % 60 === 0 && dist(seat, g.hubB) > 500) {
    if (activeIn(s, team.id).some((m) => m.id !== seat.id && !isIdle(live, m) && dist(m, seat) <= HANDOFF_R * 0.9)) return { kind: 'pass' };
  }
  if (s.format === 'atlas_circuit') { const want = s.evidence[live.leg]?.order?.[team.obj.stampIdx]; if (want !== undefined && dist(g.spurs[want]!.end, seat) <= STAMP_R * 0.8 && live.tick >= team.obj.stampLockUntil) return { kind: 'inspect', siteId: want }; }
  if (live.tick >= seat.abilityReadyTick && live.tick >= team.burstReadyTick && live.tick % 80 === 0) {
    if (seat.role === 'trail_maker') return g.bridge && dist(g.bridge.socket, seat) < 200 ? { kind: 'ability' } : null; if (seat.role === 'archivist') return null; return { kind: 'ability' };
  }
  return null;
}
