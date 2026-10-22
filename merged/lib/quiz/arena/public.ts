/** Projections: what each audience may see. Seeds, answer keys, other teams' wallets and private answers never appear here, and no field is ever a client-writable value. */
import { HELPER_COST, ROLE_COOLDOWN, NAV_TELEGRAPH_TICKS, TELEGRAPH_TICKS, TICK_MS } from './balance';
import type { ArenaState, ArenaView, EpisodeResult, FxRec, Helper, Phase, Role, Standing } from './domain';
import { PROTOCOL } from './domain';
import { standingsOf, quizWeight, worldTarget } from './engine';
import { geoOf, isIdle } from './sim';

export type PubDot = { id: string; teamId: string; x: number; y: number; role: Role; label: string; banner: boolean; carrying: number; dash: boolean; idle: boolean; mine: boolean; mate: boolean };
export type PubTeam = { id: string; name: string; slot: number; players: number; objective: number; quiz: number | null; score: number; wallet?: number; spent?: number; earned?: number; boost?: Helper | null; bought?: boolean; captures: number; pulses: number };
export type PubZone = { id: string; color: string; x: number; y: number; owner: string | null; contender: string | null; progress: number; active: boolean; shielded: boolean };
export type ArenaPublic = {
  view: ArenaView; protocol: typeof PROTOCOL; phase: Phase; format: ArenaState['format']; mapId: ArenaState['mapId']; paused: boolean; locked: boolean; cycle: number; cycles: number;
  serverNow: number; deadlineMs: number | null; phaseStartedMs: number; weighting: ArenaState['weighting']; quizWeight: number; lowPressure: boolean; teamSizeCap: number; helpersOffered: Helper[];
  teams: PubTeam[]; seats: { id: string; name: string; teamId: string; role: Role; ready: boolean }[]; dots: PubDot[];
  you: { seatId: string; teamId: string; role: Role; ready: boolean; cooldownTicks: number; cooldownMax: number; carrying: number; banner: boolean; idle: boolean } | null;
  live: null | {
    tick: number; endTick: number; startTick: number; episode: number; secondsLeft: number; zones: PubZone[]; rotate: { inTicks: number; next: number[] | null; active: number[] } | null;
    banner: { x: number; y: number; carrier: string | null; teamId: string | null; cp: number; resetIn: number | null } | null; crystals: { id: number; x: number; y: number; hot: boolean }[];
    bridges: { gate: number; secondsLeft: number; x: number; y: number }[]; flags: { teamId: string; x: number; y: number; secondsLeft: number }[]; pings: { x: number; y: number; own: boolean; secondsLeft: number }[]; fx: FxRec[];
    nextCrystals?: { x: number; y: number; inTicks: number }[];
  };
  question: { cycle: number; position: number; deadlineMs: number; eligible: number; answered: number; settled: boolean } | null;
  planning: { wallet: number; bought: boolean; helpers: { id: Helper; cost: number; affordable: boolean }[] } | null;
  lastResult: EpisodeResult | null; finish: { reason: string; tieNote: string | null; standings: (Standing & { name: string })[] } | null; log?: string[];
};
const alias = (role: Role, n: number) => `${role[0]!.toUpperCase()}${role.slice(1)} ${n}`;

export function project(s: ArenaState, view: ArenaView, viewerSeat: string | null, now: number, answered: ReadonlySet<string> = new Set()): ArenaPublic {
  const me = viewerSeat ? s.seats.find((x) => x.id === viewerSeat && !x.revoked) ?? null : null; const live = s.live; const seats = s.seats.filter((x) => !x.revoked);
  const st = standingsOf(s); const scoreOf = (id: string) => st.standings.find((x) => x.teamId === id)?.score ?? 0;
  const teams: PubTeam[] = s.teams.map((t) => {
    const own = view === 'host' || (me && me.teamId === t.id);
    const base: PubTeam = { id: t.id, name: t.name, slot: t.slot, players: seats.filter((x) => x.teamId === t.id).length, objective: t.objective + (s.phase === 'arena_live' ? t.epObjective : 0), quiz: t.masteryOf ? Math.round(t.mastery / t.masteryOf / 10) : null, score: scoreOf(t.id), captures: t.captures, pulses: t.pulses };
    return own ? { ...base, wallet: t.wallet, spent: t.spent, earned: t.earned, boost: t.boost && (t.boost.episode === s.cycle) ? t.boost.kind : null, bought: t.boughtInPlanning } : base;
  });
  const myTeam = me ? s.teams.find((t) => t.id === me.teamId)! : null; const geo = geoOf(s);
  const dots: PubDot[] = view === 'projector' && s.phase === 'lobby' ? [] : seats.map((x) => {
    const mate = !!me && me.teamId === x.teamId; const mine = x.id === viewerSeat; const idxInTeam = seats.filter((q) => q.teamId === x.teamId).findIndex((q) => q.id === x.id) + 1; const named = view === 'host' || mate;
    return { id: named ? x.id : `d${x.id.slice(0, 5)}`, teamId: x.teamId, x: Math.round(x.x * 10) / 10, y: Math.round(x.y * 10) / 10, role: x.role, label: named && !(view === 'projector') ? x.name : alias(x.role, idxInTeam), banner: x.banner, carrying: x.carrying, dash: !!live && x.dashUntil > live.tick, idle: !!live && s.phase === 'arena_live' && isIdle(live, x), mine, mate };
  });
  let liveOut: ArenaPublic['live'] = null;
  if (live && ['arena_live', 'episode_result', 'planning', 'question_open', 'reveal'].includes(s.phase)) {
    const t = live.tick; const scanned = !!myTeam && (myTeam.scanUntil > t || (myTeam.boost?.kind === 'route_reveal' && myTeam.boost.episode === live.episode));
    const early = view === 'host' ? NAV_TELEGRAPH_TICKS : scanned ? NAV_TELEGRAPH_TICKS : TELEGRAPH_TICKS; const toRotate = live.rotateAt - t;
    const pings: NonNullable<ArenaPublic['live']>['pings'] = [];
    for (const d of live.decoys) { const own = !!me && me.teamId === d.teamId; if (view === 'projector') continue; if (own || view === 'host') pings.push({ x: d.x, y: d.y, own: true, secondsLeft: Math.max(0, Math.ceil(((d.until - t) * TICK_MS) / 1000)) }); else pings.push({ x: d.x, y: d.y, own: false, secondsLeft: Math.max(0, Math.ceil(((d.until - t) * TICK_MS) / 1000)) }); }
    liveOut = {
      tick: t, endTick: live.endTick, startTick: live.startTick, episode: live.episode, secondsLeft: Math.max(0, Math.ceil(((live.endTick - t) * TICK_MS) / 1000)),
      zones: live.zones.map((z, i) => ({ id: z.id, color: z.color, x: z.x, y: z.y, owner: z.owner, contender: z.contender, progress: Math.min(1000, Math.round((z.progress * 1000) / Math.max(1, 80))), active: s.format === 'control' ? live.active.includes(i) : false, shielded: live.flags.some((f) => f.zone === z.id && f.until > t) })),
      rotate: s.format === 'control' ? { inTicks: Math.max(0, toRotate), next: toRotate <= early ? live.nextActive : null, active: live.active } : null,
      banner: live.banner ? { x: live.banner.x, y: live.banner.y, carrier: live.banner.carrier && (view === 'host' || me?.teamId === live.banner.teamId) ? live.banner.carrier : live.banner.carrier ? `d${live.banner.carrier.slice(0, 5)}` : null, teamId: live.banner.teamId, cp: live.banner.cp, resetIn: live.banner.droppedAt !== null ? Math.max(0, 160 - (t - live.banner.droppedAt)) : null } : null,
      crystals: live.crystals.map((c) => ({ id: c.id, x: c.x, y: c.y, hot: c.hot })),
      bridges: live.bridges.map((b) => { const g = geo.gates.find((q) => q.id === b.gate); return { gate: b.gate, secondsLeft: Math.max(0, Math.ceil(((b.until - t) * TICK_MS) / 1000)), x: g?.x ?? 0, y: g?.y ?? 0 }; }) ,
      flags: live.flags.map((f) => ({ teamId: f.teamId, x: f.x, y: f.y, secondsLeft: Math.max(0, Math.ceil(((f.until - t) * TICK_MS) / 1000)) })), pings,
      fx: live.fx.filter((f) => t - f.tick <= 40),
      ...(s.format === 'crystal' && (scanned || view === 'host') ? { nextCrystals: geo.nodes.map((n, i) => ({ x: n.x, y: n.y, inTicks: Math.max(0, live.nodeReady[i]! - t) })).filter((n) => n.inTicks > 0 && n.inTicks < NAV_TELEGRAPH_TICKS * 3) } : {}),
    };
  }
  const q = s.question && ['question_open', 'reveal'].includes(s.phase) ? s.question : null;
  const myElig = me && q ? q.eligible[me.teamId] ?? [] : [];
  return {
    view, protocol: PROTOCOL, phase: s.phase, format: s.format, mapId: s.mapId, paused: s.paused, locked: s.locked, cycle: s.cycle, cycles: s.plan.cycles, serverNow: now, deadlineMs: s.phase === 'arena_live' && live ? null : s.phaseDeadlineMs, phaseStartedMs: s.phaseStartedMs,
    weighting: s.weighting, quizWeight: quizWeight(s), lowPressure: s.lowPressure, teamSizeCap: s.teamSizeCap, helpersOffered: s.helpers, teams,
    seats: view === 'projector' ? [] : seats.filter((x) => view === 'host' || (me && x.teamId === me.teamId)).map((x) => ({ id: x.id, name: x.name, teamId: x.teamId, role: x.role, ready: x.ready })), dots,
    you: me && live !== undefined ? { seatId: me.id, teamId: me.teamId, role: me.role, ready: me.ready, cooldownTicks: live ? Math.max(0, me.abilityReadyTick - live.tick) : 0, cooldownMax: ROLE_COOLDOWN[me.role], carrying: me.carrying, banner: me.banner, idle: !!live && s.phase === 'arena_live' && isIdle(live, me) } : null,
    live: liveOut,
    question: q ? { cycle: q.cycle, position: q.position, deadlineMs: q.deadlineMs, eligible: view === 'student' ? myElig.length : Object.values(q.eligible).flat().length, answered: view === 'student' ? myElig.filter((id) => answered.has(id)).length : Object.values(q.eligible).flat().filter((id) => answered.has(id)).length, settled: q.settled } : null,
    planning: s.phase === 'planning' && myTeam ? { wallet: myTeam.wallet, bought: myTeam.boughtInPlanning, helpers: s.helpers.map((h) => ({ id: h, cost: HELPER_COST[h], affordable: myTeam.wallet >= HELPER_COST[h] && !myTeam.boughtInPlanning })) } : null,
    lastResult: s.lastResult, finish: s.finish ? { reason: s.finish.reason, tieNote: s.finish.tieNote, standings: s.finish.standings.map((x) => ({ ...x, name: s.teams.find((t) => t.id === x.teamId)?.name ?? x.teamId })) } : null,
    ...(view === 'host' ? { log: s.log } : {}),
  };
}
export { worldTarget };
