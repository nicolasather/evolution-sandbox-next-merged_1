/** The deterministic world: one fixed 50 ms tick at a time. Only direction intents go in; positions, captures, carries and scores come out.
 *  Nothing here reads a clock or a random source except the seeded stream below, so replaying the same intents gives the same match. */
import type { ArenaState, CrystalRec, IntentEntry, LiveRec, SeatRec, TeamRec, ZoneRec } from './domain';
import {
  BANNER_RESET_TICKS, BASE_R, BOOST_CAPTURE, BOOST_DEPOSIT, BOOST_SPEED, CAPTURE_TICKS, CARRY_FACTOR, CP_R, CRYSTAL_RESPAWN_TICKS, DASH_FACTOR, EPISODE_CAP, IDLE_TICKS, MAX_CARRY, NEUTRAL_RESET_TICKS,
  PICKUP_R, POINTS, PULSE_HOLD_TICKS, SPEED, TICK_MS, VAULT_R, ZONE_R,
} from './balance';
import { geometryFor, resolve, type Geometry } from './maps';

export const PAIRS: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 0]];
export type Timelines = Record<string, readonly IntentEntry[]>;
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const isIdle = (live: LiveRec, seat: SeatRec) => live.tick - seat.seenTick > IDLE_TICKS;
export const slotOf = (s: Pick<ArenaState, 'teams'>, teamId: string, episode: number) => { const i = s.teams.findIndex((t) => t.id === teamId); return (i + episode) % s.teams.length; };
/** who wins a simultaneous touch: priority rotates every episode so nobody is permanently favoured */
export const priorityOf = (s: Pick<ArenaState, 'teams'>, teamId: string, episode: number) => { const i = s.teams.findIndex((t) => t.id === teamId); const n = s.teams.length; return (((i - episode) % n) + n) % n; };
export const geoOf = (s: Pick<ArenaState, 'mapId' | 'teams'>): Geometry => geometryFor(s.mapId, s.teams.length);
export const spawnFor = (s: ArenaState, seat: SeatRec, episode: number) => {
  const geo = geoOf(s); const slot = slotOf(s, seat.teamId, episode); const mates = s.seats.filter((x) => !x.revoked && x.teamId === seat.teamId); const k = Math.max(0, mates.findIndex((x) => x.id === seat.id));
  return geo.spawns[slot]![k % 5]!;
};
export function addObjective(t: TeamRec, pts: number) { const room = Math.max(0, EPISODE_CAP - t.epObjective); const take = Math.min(room, pts); t.epObjective += take; return take; }
const boostOf = (t: TeamRec, episode: number) => (t.boost && t.boost.episode === episode ? t.boost.kind : null);
export const speedOf = (s: ArenaState, seat: SeatRec, live: LiveRec) => {
  const t = s.teams.find((x) => x.id === seat.teamId)!; let v = SPEED;
  if (boostOf(t, live.episode) === 'trail_speed') v *= BOOST_SPEED;
  if (seat.dashUntil > live.tick && !seat.banner) v *= DASH_FACTOR;
  if (seat.banner) v *= CARRY_FACTOR; return v;
};

/** Build a fresh episode: neutral zones, banner at the hub, every node full, everybody back on their (rotated) base. Mutates `s`. */
export function startEpisode(s: ArenaState, episode: number, anchorMs: number): void {
  const geo = geoOf(s); const ticks = s.plan.episodeSeconds * 1000 / TICK_MS; const p0 = hash(`${s.seed}:${episode}:pairs`) % 3;
  const rotateEvery = Math.max(200, Math.min(s.plan.rotationSeconds * 20, Math.floor(ticks / 3)));
  const startTick = s.tick;
  const zones: ZoneRec[] = geo.zones.map((z) => ({ id: z.id, color: z.color, x: z.x, y: z.y, owner: null, contender: null, progress: 0, heldTicks: 0, pulsed: false, idleTicks: 0, teamProgress: {} }));
  s.live = {
    episode, startTick, endTick: startTick + ticks, tick: startTick, anchorMs, anchorTick: startTick, format: s.format,
    active: [...PAIRS[p0]!], nextActive: [...PAIRS[(p0 + 1) % 3]!], rotateAt: startTick + rotateEvery, rotateEvery,
    zones, flags: [], bridges: [], decoys: [], banner: s.format === 'relay' ? { x: geo.banner.x, y: geo.banner.y, carrier: null, teamId: null, cp: 0, droppedAt: null, blockedUntil: startTick + 40 } : null,
    crystals: [], nodeReady: geo.nodes.map(() => startTick), nextCrystalId: 1, fx: [], bannerPriority: 0,
  };
  for (const t of s.teams) { t.epObjective = 0; t.scanUntil = 0; t.slot = slotOf(s, t.id, episode); }
  for (const seat of s.seats) { if (seat.revoked) continue; const sp = spawnFor(s, seat, episode); seat.x = sp.x; seat.y = sp.y; seat.ix = 0; seat.iy = 0; seat.carrying = 0; seat.carryValue = 0; seat.banner = false; seat.dashUntil = 0; seat.abilityReadyTick = startTick; seat.seenTick = startTick; }
}

function fx(live: LiveRec, kind: LiveRec['fx'][number]['kind'], x: number, y: number, teamId?: string, n?: number) { live.fx.push({ tick: live.tick, kind, x: Math.round(x), y: Math.round(y), ...(teamId ? { teamId } : {}), ...(n !== undefined ? { n } : {}) }); if (live.fx.length > 40) live.fx.splice(0, live.fx.length - 40); }
export { fx as pushFx };

function applyIntents(s: ArenaState, t: number, lines: Timelines) {
  for (const seat of s.seats) {
    if (seat.revoked) continue; const tl = lines[seat.id]; if (!tl) continue; let pick: IntentEntry | null = null;
    for (const e of tl) if (e.tick <= t && e.seq > seat.seq && (!pick || e.seq > pick.seq)) pick = e;
    if (pick) { let x = Math.max(-1, Math.min(1, Number.isFinite(pick.x) ? pick.x : 0)), y = Math.max(-1, Math.min(1, Number.isFinite(pick.y) ? pick.y : 0)); const m = Math.sqrt(x * x + y * y); if (m > 1) { x /= m; y /= m; } seat.ix = x; seat.iy = y; seat.seq = pick.seq; seat.seenTick = Math.max(seat.seenTick, Math.min(t, pick.tick)); }
  }
}
function openGates(live: LiveRec): ReadonlySet<number> | null { return live.bridges.length ? new Set(live.bridges.map((b) => b.gate)) : null; }
function dropCarried(live: LiveRec, seat: SeatRec) {
  if (seat.banner && live.banner && live.banner.carrier === seat.id) { live.banner = { ...live.banner, x: Math.round(seat.x), y: Math.round(seat.y), carrier: null, teamId: null, cp: 0, droppedAt: live.tick, blockedUntil: live.tick }; fx(live, 'drop', seat.x, seat.y); }
  seat.banner = false; if (seat.carrying) { fx(live, 'drop', seat.x, seat.y, seat.teamId, seat.carrying); } seat.carrying = 0; seat.carryValue = 0;
}

/** Advance the live world up to and including `toTick`. Pure given (state, timelines). */
export function simulate(s: ArenaState, toTick: number, lines: Timelines): void {
  const live = s.live; if (!live) return; const geo = geoOf(s);
  for (let t = live.tick + 1; t <= Math.min(toTick, live.endTick); t++) {
    live.tick = t; applyIntents(s, t, lines);
    // rotation (control zones): telegraphed in the projection, applied here
    if (s.format === 'control' && t >= live.rotateAt) {
      live.active = [...live.nextActive]; const i = PAIRS.findIndex((p) => p[0] === live.nextActive[0] && p[1] === live.nextActive[1]); live.nextActive = [...PAIRS[(i + 1) % 3]!]; live.rotateAt += live.rotateEvery;
      for (const z of live.zones) if (!live.active.includes(live.zones.indexOf(z))) { z.owner = null; z.contender = null; z.progress = 0; z.heldTicks = 0; z.pulsed = false; z.idleTicks = 0; z.teamProgress = {}; }
      fx(live, 'rotate', geo.banner.x, geo.banner.y);
    }
    live.flags = live.flags.filter((f) => f.until > t); live.bridges = live.bridges.filter((b) => b.until > t); live.decoys = live.decoys.filter((d) => d.until > t);
    const open = openGates(live);
    // drop what an idle/away seat holds: an away student must never block a banner or hoard crystals
    for (const seat of s.seats) if (!seat.revoked && (isIdle(live, seat) || false)) { seat.ix = 0; seat.iy = 0; if (seat.banner || seat.carrying) dropCarried(live, seat); }
    for (const seat of s.seats) {
      if (seat.revoked) continue; if (seat.ix === 0 && seat.iy === 0) continue; const v = speedOf(s, seat, live);
      const [nx, ny] = resolve(geo, seat.x + seat.ix * v, seat.y + seat.iy * v, open); seat.x = nx; seat.y = ny;
    }
    if (s.format === 'control') controlTick(s, live, t); else if (s.format === 'relay') relayTick(s, live, geo, t); else crystalTick(s, live, geo, t);
  }
}
const present = (s: ArenaState, live: LiveRec) => s.seats.filter((x) => !x.revoked && !isIdle(live, x));
function controlTick(s: ArenaState, live: LiveRec, t: number) {
  const seats = present(s, live); const lowPressure = s.lowPressure;
  live.active.forEach((zi) => {
    const z = live.zones[zi]!; const here = seats.filter((x) => Math.hypot(x.x - z.x, x.y - z.y) <= ZONE_R); let teams = [...new Set(here.map((x) => x.teamId))];
    const flag = live.flags.find((f) => f.zone === z.id && f.until > t && teams.includes(f.teamId));
    if (flag) teams = [flag.teamId]; // Shelter Flag: friendly presence cannot be interrupted for its few seconds
    const need = (tid: string) => { const tm = s.teams.find((x) => x.id === tid)!; return Math.round(CAPTURE_TICKS * (boostOf(tm, live.episode) === 'capture_marker' ? BOOST_CAPTURE : 1)); };
    const complete = (tid: string) => {
      z.owner = tid; z.contender = null; z.progress = 0; z.heldTicks = 0; z.pulsed = false; z.idleTicks = 0; z.teamProgress = {};
      const tm = s.teams.find((x) => x.id === tid)!; addObjective(tm, POINTS.capture); tm.captures++; const who = here.filter((x) => x.teamId === tid).sort((a, b) => (a.id < b.id ? -1 : 1))[0]; if (who) who.captures++; fx(live, 'capture', z.x, z.y, tid);
    };
    if (lowPressure) {
      // every team fills its OWN meter; simultaneous contact never blocks anyone. Same capture time, same cap.
      const done: string[] = [];
      for (const tm of s.teams) { const mine = teams.includes(tm.id); const cur = z.teamProgress[tm.id] ?? 0; const next = mine && z.owner !== tm.id ? cur + 1 : Math.max(0, cur - 2); if (next) z.teamProgress[tm.id] = next; else delete z.teamProgress[tm.id]; if (next >= need(tm.id) && z.owner !== tm.id) done.push(tm.id); }
      if (done.length) { done.sort((a, b) => priorityOf(s, a, live.episode) - priorityOf(s, b, live.episode)); complete(done[0]!); }
      const own = z.owner && teams.includes(z.owner); z.progress = Math.max(0, ...Object.values(z.teamProgress)); z.contender = Object.entries(z.teamProgress).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      if (own) z.heldTicks++;
    } else if (teams.length === 1) {
      const tid = teams[0]!; z.idleTicks = 0;
      if (z.owner === tid) { z.heldTicks++; z.contender = null; z.progress = 0; }
      else { if (z.contender !== tid) { z.contender = tid; z.progress = 0; } z.progress++; if (z.progress >= need(tid)) complete(tid); }
    } else if (teams.length > 1) { z.idleTicks = 0; if (z.owner && teams.includes(z.owner)) z.heldTicks++; /* contested: the meter holds still */ }
    else { z.idleTicks++; if (z.idleTicks >= NEUTRAL_RESET_TICKS) { z.progress = 0; z.contender = null; z.teamProgress = {}; } }
    if (z.owner && !z.pulsed && z.heldTicks >= PULSE_HOLD_TICKS) {
      z.pulsed = true; const tm = s.teams.find((x) => x.id === z.owner)!; const got = addObjective(tm, POINTS.pulse); tm.pulses++; const who = seats.filter((x) => x.teamId === z.owner && Math.hypot(x.x - z.x, x.y - z.y) <= ZONE_R)[0]; if (who) who.pulses++; fx(live, 'pulse', z.x, z.y, z.owner, got);
    }
  });
}
function relayTick(s: ArenaState, live: LiveRec, geo: Geometry, t: number) {
  const b = live.banner!; const seats = present(s, live);
  if (b.carrier) {
    const c = s.seats.find((x) => x.id === b.carrier);
    if (!c || c.revoked || !c.banner) { live.banner = { ...b, carrier: null, teamId: null, cp: 0, droppedAt: t, blockedUntil: t }; return; }
    b.x = Math.round(c.x); b.y = Math.round(c.y); const slot = slotOf(s, c.teamId, live.episode); const cps = geo.checkpoints[slot]!;
    if (b.cp < 3) { const p = cps[b.cp]!; if (Math.hypot(c.x - p.x, c.y - p.y) <= CP_R) { b.cp++; fx(live, 'pickup', p.x, p.y, c.teamId, b.cp); } }
    else { const v = geo.vaults[slot]!; if (Math.hypot(c.x - v.x, c.y - v.y) <= BASE_R) {
      const tm = s.teams.find((x) => x.id === c.teamId)!; addObjective(tm, POINTS.handin); tm.handins++; c.handins++; c.banner = false; fx(live, 'handin', v.x, v.y, tm.id);
      live.banner = { x: geo.banner.x, y: geo.banner.y, carrier: null, teamId: null, cp: 0, droppedAt: null, blockedUntil: t + 40 }; } }
    return;
  }
  if (b.droppedAt !== null && t - b.droppedAt >= BANNER_RESET_TICKS) { live.banner = { x: geo.banner.x, y: geo.banner.y, carrier: null, teamId: null, cp: 0, droppedAt: null, blockedUntil: t }; fx(live, 'reset', geo.banner.x, geo.banner.y); return; }
  if (t < b.blockedUntil) return;
  const near = seats.filter((x) => Math.hypot(x.x - b.x, x.y - b.y) <= PICKUP_R);
  if (!near.length) return;
  // a Shelter Flag decides a tie in its team's favour; otherwise the rotating priority does
  const flagged = (x: SeatRec) => live.flags.some((f) => f.teamId === x.teamId && f.until > t && Math.hypot(f.x - x.x, f.y - x.y) <= 100);
  near.sort((a, c) => Number(flagged(c)) - Number(flagged(a)) || priorityOf(s, a.teamId, live.episode) - priorityOf(s, c.teamId, live.episode) || (a.id < c.id ? -1 : 1));
  const w = near[0]!; w.banner = true; live.banner = { ...b, carrier: w.id, teamId: w.teamId, cp: 0, droppedAt: null, blockedUntil: t }; fx(live, 'pickup', b.x, b.y, w.teamId);
}
function crystalTick(s: ArenaState, live: LiveRec, geo: Geometry, t: number) {
  const seats = present(s, live);
  geo.nodes.forEach((n, i) => { if (live.nodeReady[i]! <= t && !live.crystals.some((c) => c.node === i)) live.crystals.push({ id: live.nextCrystalId++, node: i, x: n.x, y: n.y, hot: n.hot } as CrystalRec); });
  for (const c of [...live.crystals]) {
    const near = seats.filter((x) => x.carrying < MAX_CARRY && Math.hypot(x.x - c.x, x.y - c.y) <= PICKUP_R); if (!near.length) continue;
    const flagged = (x: SeatRec) => live.flags.some((f) => f.teamId === x.teamId && f.until > t && Math.hypot(f.x - x.x, f.y - x.y) <= 100);
    near.sort((a, b) => Number(flagged(b)) - Number(flagged(a)) || priorityOf(s, a.teamId, live.episode) - priorityOf(s, b.teamId, live.episode) || Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y) || (a.id < b.id ? -1 : 1));
    const w = near[0]!; w.carrying++; w.carryValue += c.hot ? POINTS.hot : POINTS.crystal; live.crystals.splice(live.crystals.indexOf(c), 1); live.nodeReady[c.node] = t + (c.hot ? Math.round(CRYSTAL_RESPAWN_TICKS * 1.5) : CRYSTAL_RESPAWN_TICKS); fx(live, 'collect', c.x, c.y, w.teamId);
  }
  for (const seat of seats) {
    if (!seat.carrying) continue; const slot = slotOf(s, seat.teamId, live.episode); const v = geo.vaults[slot]!; const tm = s.teams.find((x) => x.id === seat.teamId)!;
    const r = VAULT_R * (boostOf(tm, live.episode) === 'deposit_guidance' ? BOOST_DEPOSIT : 1);
    if (Math.hypot(seat.x - v.x, seat.y - v.y) <= r) { addObjective(tm, seat.carryValue); tm.deposited += seat.carrying; seat.deposits += seat.carrying; fx(live, 'deposit', v.x, v.y, tm.id, seat.carrying); seat.carrying = 0; seat.carryValue = 0; }
  }
}
