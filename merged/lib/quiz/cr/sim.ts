/** The deterministic race world: one fixed 50 ms tick at a time. Only direction intents go in; positions, hand-offs, stamps, arrivals and scores come out.
 *  Teams never collide, so one team can never block another. Nothing here reads a clock; replaying the same intents gives the same match. */
import { ARRIVE_R, HANDOFF_R, IDLE_TICKS, POST_R, RELAY_IDLE_HANDOFF_TICKS, SPEED, STAMP_LOCK_TICKS, STAMP_R, TICK_MS } from './balance';
import type { CRState, FxRec, IntentEntry, LiveRec, OptionId, SeatRec, TeamRec } from './domain';
import { buildCourse, dist, distToPoly, legGeo, resolveMove, ringSpot, walkable, type LegGeo, type Pt, type Seg } from './maps';

export type Timelines = Record<string, readonly IntentEntry[]>;
export const isIdle = (live: LiveRec, seat: SeatRec) => live.tick - seat.seenTick > IDLE_TICKS;
export const courseOf = (s: Pick<CRState, 'mapId' | 'difficulty'>) => buildCourse(s.mapId, s.difficulty);
export const geoOf = (s: CRState, leg = s.leg): LegGeo => legGeo(courseOf(s), s.plan.stations[leg]!, s.plan.stations[leg + 1]!, leg);
export const activeIn = (s: CRState, teamId: string) => s.seats.filter((x) => !x.revoked && x.teamId === teamId);
export const presentIn = (s: CRState, live: LiveRec, teamId: string) => activeIn(s, teamId).filter((x) => !isIdle(live, x));
export const hasPerk = (t: TeamRec, perk: string, leg: number) => t.perks.some((p) => p.id === perk && p.leg === leg);
export const emptyObj = (option: OptionId = 'a'): TeamRec['obj'] => ({ option, done: false, doneTick: null, assisted: false, stampIdx: 0, stampLockUntil: 0, flagHolder: null, lastPost: -1, wrongPosts: 0, holdMoveTick: 0, legTarget: 0, stamps: [], coop: [], votes: {} });
export function pushFx(live: LiveRec, kind: FxRec['kind'], x: number, y: number, teamId?: string, n?: number) {
  live.fx.push({ tick: live.tick, kind, x: Math.round(x), y: Math.round(y), ...(teamId ? { teamId } : {}), ...(n !== undefined ? { n } : {}) }); if (live.fx.length > 40) live.fx.splice(0, live.fx.length - 40);
}
const byJoin = (a: SeatRec, b: SeatRec) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1);

/** Plurality of the team's votes among the roads offered; ties and silence fall back to the Main Road, so there is never an unresolved choice. */
export function chooseOption(offered: readonly OptionId[], votes: Record<string, OptionId>, voters: ReadonlySet<string>): OptionId {
  const tally: Record<string, number> = {}; for (const [id, o] of Object.entries(votes)) if (voters.has(id) && offered.includes(o)) tally[o] = (tally[o] ?? 0) + 1;
  let best: OptionId = 'a', n = 0; for (const o of offered) if ((tally[o] ?? 0) > n) { best = o; n = tally[o] ?? 0; } return best;
}
export function startLeg(s: CRState, leg: number, anchorMs: number): void {
  const g = geoOf(s, leg); const startTick = s.tick; const ticks = Math.round((s.plan.legSeconds * 1000) / TICK_MS);
  s.leg = leg; s.live = { leg, startTick, endTick: startTick + ticks, tick: startTick, anchorMs, anchorTick: startTick, fx: [] };
  for (const t of s.teams) {
    const mates = activeIn(s, t.id).sort(byJoin); const voters = new Set(mates.map((m) => m.id));
    const option = s.format === 'split_route' ? chooseOption(g.offered, t.obj.votes, voters) : 'a';
    t.obj = emptyObj(option); t.bridgeUntil = 0; t.cues = []; t.pinned = null;
    const ev = s.evidence[leg]; t.obj.legTarget = ev?.postIdx ?? -1; t.obj.holdMoveTick = startTick;
    t.obj.flagHolder = s.format === 'signal_relay' ? (mates[0]?.id ?? null) : null;
    mates.forEach((m, i) => { const p = ringSpot(g.hubA, i, mates.length); m.x = p.x; m.y = p.y; m.ix = 0; m.iy = 0; m.seenTick = startTick; m.abilityReadyTick = Math.max(m.abilityReadyTick, startTick); });
  }
}
export const spawnFor = (s: CRState, seat: SeatRec): Pt => {
  const live = s.live; const mate = live ? s.seats.find((x) => !x.revoked && x.teamId === seat.teamId && x.id !== seat.id && !isIdle(live, x)) : null;
  if (mate && s.phase !== 'lobby') return { x: mate.x, y: mate.y };
  const g = geoOf(s, Math.min(s.leg, s.plan.legs - 1)); const n = activeIn(s, seat.teamId).length; return ringSpot(g.hubA, Math.max(0, n - 1), Math.max(1, n));
};

function applyIntents(s: CRState, t: number, lines: Timelines) {
  for (const seat of s.seats) {
    if (seat.revoked) continue; const tl = lines[seat.id]; if (!tl) continue; let pick: IntentEntry | null = null;
    for (const e of tl) if (e.tick <= t && e.seq > seat.seq && (!pick || e.seq > pick.seq)) pick = e;
    if (pick) { let x = Math.max(-1, Math.min(1, Number.isFinite(pick.x) ? pick.x : 0)), y = Math.max(-1, Math.min(1, Number.isFinite(pick.y) ? pick.y : 0)); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } seat.ix = x; seat.iy = y; seat.seq = pick.seq; seat.seenTick = Math.max(seat.seenTick, Math.min(t, pick.tick)); }
  }
}
export const segsFor = (g: LegGeo, t: TeamRec, tick: number): Seg[] => walkable(g, t.obj.option, t.bridgeUntil > tick);
export const handoffRange = (t: TeamRec, leg: number) => HANDOFF_R * (hasPerk(t, 'extra_signal', leg) ? 1.3 : 1);

function award(s: CRState, live: LiveRec, t: TeamRec, credit: number, assisted: boolean) {
  const o = t.obj; if (o.done) return; o.done = true; o.doneTick = live.tick; o.assisted = assisted; t.legsDone++; t.coopTarget += 1; t.coopTotal = Math.round((t.coopTotal + credit) * 1000) / 1000;
  t.doneTicks += live.tick - live.startTick; if (assisted) t.legsAssisted++;
  const g = geoOf(s, live.leg); pushFx(live, assisted ? 'arrive' : 'checkpoint', g.hubB.x, g.hubB.y, t.id);
}
/** Called when the leg timer runs out: the team is carried to the checkpoint by a friendly guide. Half route credit, no teamwork credit, never a penalty beyond that. */
export function assistRemaining(s: CRState): void {
  const live = s.live; if (!live) return;
  for (const t of s.teams) if (!t.obj.done && activeIn(s, t.id).length) { award(s, live, t, 0, true); t.obj.doneTick = live.endTick; }
}
export const allDone = (s: CRState) => { const teams = s.teams.filter((t) => activeIn(s, t.id).length); return teams.length > 0 && teams.every((t) => t.obj.done); };

/** Stamp the landmark `siteId` (Atlas Circuit). Proximity, order and the 1.5 s lock are all decided here. */
export function tryStamp(s: CRState, seat: SeatRec, siteId: number): { ok: boolean; code?: string; message?: string; right?: boolean } {
  const live = s.live; if (!live || s.phase !== 'race') return { ok: false, code: 'WRONG_PHASE', message: 'Stamps work while the race is live.' };
  if (s.format !== 'atlas_circuit') return { ok: false, code: 'WRONG_FORMAT', message: 'This match does not use stamps.' };
  const t = s.teams.find((x) => x.id === seat.teamId)!; const o = t.obj; if (o.done) return { ok: false, code: 'DONE', message: 'Your team already finished this leg.' };
  if (isIdle(live, seat)) return { ok: false, code: 'AWAY', message: 'Move to come back into the round.' };
  if (live.tick < o.stampLockUntil) return { ok: false, code: 'LOCKED', message: `The stamp is resting for ${Math.ceil(((o.stampLockUntil - live.tick) * TICK_MS) / 1000 * 10) / 10}s.` };
  const g = geoOf(s); const site = g.spurs[siteId]; if (!site) return { ok: false, code: 'NO_SITE', message: 'There is no landmark there.' };
  if (dist(site.end, seat) > STAMP_R) return { ok: false, code: 'TOO_FAR', message: `Walk closer to the ${site.name} to stamp it.` };
  const want = s.evidence[live.leg]?.order?.[o.stampIdx];
  if (want === siteId) { o.stamps.push(siteId); o.stampIdx++; t.correctSites++; if (!o.coop.includes(seat.id)) o.coop.push(seat.id); pushFx(live, 'stamp', site.end.x, site.end.y, t.id, o.stampIdx); return { ok: true, right: true }; }
  o.stampLockUntil = live.tick + STAMP_LOCK_TICKS; o.wrongPosts++; t.retries++; pushFx(live, 'wrong', site.end.x, site.end.y, t.id); return { ok: true, right: false };
}
/** Hand the lantern flag to the nearest teammate in range (Signal Relay). */
export function passFlag(s: CRState, seat: SeatRec): { ok: boolean; code?: string; message?: string } {
  const live = s.live; if (!live || s.phase !== 'race' || s.format !== 'signal_relay') return { ok: false, code: 'WRONG_PHASE', message: 'There is no flag to pass right now.' };
  const t = s.teams.find((x) => x.id === seat.teamId)!; if (t.obj.flagHolder !== seat.id) return { ok: false, code: 'NO_FLAG', message: 'You are not carrying the flag.' };
  const r = handoffRange(t, live.leg); const mate = presentIn(s, live, t.id).filter((x) => x.id !== seat.id && dist(x, seat) <= r).sort((a, b) => dist(a, seat) - dist(b, seat) || (a.id < b.id ? -1 : 1))[0];
  if (!mate) return { ok: false, code: 'NO_TEAMMATE', message: 'A teammate has to be right next to you to take the flag.' };
  giveFlag(live, t, seat, mate); return { ok: true };
}
function giveFlag(live: LiveRec, t: TeamRec, from: SeatRec, to: SeatRec) { t.obj.flagHolder = to.id; t.obj.holdMoveTick = live.tick; if (!t.obj.coop.includes(from.id)) t.obj.coop.push(from.id); if (!t.obj.coop.includes(to.id)) t.obj.coop.push(to.id); pushFx(live, 'pass', to.x, to.y, t.id); }

function relayTick(s: CRState, live: LiveRec, g: LegGeo, t: TeamRec) {
  const o = t.obj; if (o.done) return; const mates = presentIn(s, live, t.id).sort(byJoin); if (!mates.length) return;
  let holder = o.flagHolder ? s.seats.find((x) => x.id === o.flagHolder && !x.revoked) ?? null : null;
  if (!holder || isIdle(live, holder)) { const next = mates.find((m) => m.id !== holder?.id) ?? mates[0]!; if (holder) giveFlag(live, t, holder, next); else { o.flagHolder = next.id; o.holdMoveTick = live.tick; } holder = next; }
  if (holder.ix !== 0 || holder.iy !== 0) o.holdMoveTick = live.tick;
  else if (mates.length > 1 && live.tick - o.holdMoveTick >= RELAY_IDLE_HANDOFF_TICKS) { const mate = mates.filter((x) => x.id !== holder!.id).sort((a, b) => dist(a, holder!) - dist(b, holder!) || (a.id < b.id ? -1 : 1))[0]!; giveFlag(live, t, holder, mate); holder = mate; }
  let near = -1; for (const sp of g.spurs) if (dist(sp.end, holder) <= POST_R && distToPoly(holder, sp.pts) <= 40) near = sp.idx;
  if (near < 0) { o.lastPost = -1; return; }
  if (near === o.legTarget) { const need = Math.min(activeIn(s, t.id).length - 1, 2); const credit = need > 0 ? Math.min(1, Math.max(0, o.coop.length - 1) / need) : 1 - Math.min(1, o.wrongPosts * 0.25); award(s, live, t, credit, false); t.correctSites++; return; }
  if (o.lastPost !== near) { o.lastPost = near; o.wrongPosts++; t.retries++; pushFx(live, 'wrong', g.spurs[near]!.end.x, g.spurs[near]!.end.y, t.id); }
}
function tickObjectives(s: CRState, live: LiveRec, g: LegGeo) {
  for (const t of s.teams) {
    const o = t.obj; if (o.done) continue; const mates = activeIn(s, t.id); if (!mates.length) continue;
    if (s.format === 'split_route') { const here = mates.filter((m) => !isIdle(live, m)); if (here.length && here.every((m) => dist(g.hubB, m) <= ARRIVE_R)) award(s, live, t, 1, false); }
    else if (s.format === 'signal_relay') relayTick(s, live, g, t);
    else if (o.stampIdx >= 3) { const need = Math.min(mates.length, 3); award(s, live, t, mates.length > 1 ? Math.min(1, o.coop.length / need) : 1 - Math.min(1, o.wrongPosts * 0.25), false); }
  }
}
/** Advance the live world up to and including `toTick`. Pure given (state, timelines). */
export function simulate(s: CRState, toTick: number, lines: Timelines): void {
  const live = s.live; if (!live) return; const g = geoOf(s, live.leg);
  for (let tk = live.tick + 1; tk <= Math.min(toTick, live.endTick); tk++) {
    live.tick = tk; applyIntents(s, tk, lines);
    for (const t of s.teams) { t.cues = t.cues.filter((c) => c.until > tk); if (t.bridgeUntil && t.bridgeUntil <= tk) t.bridgeUntil = 0; }
    for (const t of s.teams) {
      const segs = segsFor(g, t, tk);
      for (const seat of s.seats) {
        if (seat.revoked || seat.teamId !== t.id) continue; if (isIdle(live, seat)) { seat.ix = 0; seat.iy = 0; }
        if (seat.ix === 0 && seat.iy === 0) continue;
        const [nx, ny] = resolveMove(segs, seat.x, seat.y, seat.x + seat.ix * SPEED, seat.y + seat.iy * SPEED, tk); seat.x = nx; seat.y = ny;
      }
    }
    tickObjectives(s, live, g);
    if (allDone(s)) { live.endTick = tk; break; }
  }
}
