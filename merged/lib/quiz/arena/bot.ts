/** Scripted classmates for Practice and for the fairness simulations. They read the same public state a student would and send the same kind of intent: a direction. */
import type { ArenaState, Intent, SeatRec, Vec } from './domain';
import { HANDOFF_R, MAX_CARRY, VAULT_R, ZONE_R } from './balance';
import { steer, walkDistance } from './maps';
import { geoOf, isIdle, slotOf } from './sim';

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const STOP: Intent = { x: 0, y: 0 };
function toward(s: ArenaState, seat: SeatRec, target: Vec, stopAt = 6): Intent {
  const geo = geoOf(s); const open = s.live && s.live.bridges.length ? new Set(s.live.bridges.map((b) => b.gate)) : null;
  if (dist(seat, target) <= stopAt) return STOP; const v = steer(geo, seat, target, open); return { x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100 };
}
/** What this classmate steers toward right now. Pure and deterministic. */
export function botIntent(s: ArenaState, seatId: string): Intent {
  const seat = s.seats.find((x) => x.id === seatId && !x.revoked); const live = s.live; if (!seat || !live || s.phase !== 'arena_live') return STOP;
  const geo = geoOf(s); const slot = slotOf(s, seat.teamId, live.episode); const vault = geo.vaults[slot]!; const mates = s.seats.filter((x) => !x.revoked && x.teamId === seat.teamId); const myIdx = mates.findIndex((x) => x.id === seat.id);
  if (s.format === 'control') {
    const zones = live.active.map((i) => live.zones[i]!); const wants = zones.filter((z) => z.owner !== seat.teamId); const pool = wants.length ? wants : zones;
    const pick = [...pool].sort((a, b) => walkDistance(geo, seat, a) + (myIdx % pool.length === pool.indexOf(a) ? 0 : 40) - (walkDistance(geo, seat, b) + (myIdx % pool.length === pool.indexOf(b) ? 0 : 40)))[0]; if (!pick) return STOP;
    return toward(s, seat, pick, ZONE_R * 0.4);
  }
  if (s.format === 'relay') {
    const b = live.banner!; const cps = geo.checkpoints[slot]!;
    if (b.carrier === seat.id) return toward(s, seat, b.cp < 3 ? cps[Math.min(2, b.cp)]! : vault, 8);
    const holder = b.carrier ? s.seats.find((x) => x.id === b.carrier) : null;
    if (holder && holder.teamId === seat.teamId) return toward(s, seat, vault, 40); // escort home
    const closest = mates.filter((x) => !isIdle(live, x)).sort((a, c) => dist(a, b) - dist(c, b) || (a.id < c.id ? -1 : 1))[0];
    if (closest?.id === seat.id || !b.carrier) return toward(s, seat, b, 6); return toward(s, seat, geo.banner, 80);
  }
  const hereCrystals = live.crystals; const nearVault = dist(seat, vault) <= VAULT_R * 0.7;
  if (seat.carrying >= MAX_CARRY || (seat.carrying > 0 && (!hereCrystals.length || myIdx % 2 === 0 && seat.carrying >= 2))) return toward(s, seat, vault, 6);
  const pick = [...hereCrystals].sort((a, c) => walkDistance(geo, seat, a) - walkDistance(geo, seat, c) || a.id - c.id)[0];
  if (!pick) return nearVault ? STOP : toward(s, seat, vault, 20); return toward(s, seat, pick, 4);
}
/** Would a classmate press their ability now? (Used by Practice bots; humans decide for themselves.) */
export function botWantsAbility(s: ArenaState, seatId: string): boolean {
  const seat = s.seats.find((x) => x.id === seatId && !x.revoked); const live = s.live; if (!seat || !live || s.phase !== 'arena_live' || live.tick < seat.abilityReadyTick) return false;
  const geo = geoOf(s);
  switch (seat.role) {
    case 'runner': return !seat.banner && live.tick % 40 === 0;
    case 'sentinel': return s.format === 'control' ? live.active.some((i) => dist(live.zones[i]!, seat) <= ZONE_R && live.zones[i]!.owner !== seat.teamId) : seat.banner || seat.carrying > 0;
    case 'builder': return geo.gates.some((g) => dist(g, seat) < 120);
    case 'trickster': return live.tick % 120 === 0;
    case 'navigator': return live.tick % 160 === 0;
  }
}
export const botPassTarget = (s: ArenaState, seatId: string): boolean => {
  const seat = s.seats.find((x) => x.id === seatId); const live = s.live; if (!seat || !live || !seat.banner) return false;
  return s.seats.some((x) => !x.revoked && x.teamId === seat.teamId && x.id !== seat.id && dist(x, seat) <= HANDOFF_R) && live.tick % 200 === 0;
};
