/** Projections: what each audience may see. Seeds, answer keys (the relay post / stamp order), other teams' wallets and private answers never appear here, and no field is a client-writable value. */
import { PERK_COST, ROLE_COOLDOWN, TICK_MS } from './balance';
import type { CRState, CRView, FxRec, Format, MapId, OptionId, Perk, Phase, Role, Standing } from './domain';
import { PROTOCOL } from './domain';
import { activeSeats, standingsOf, worldTarget } from './engine';
import { publicEvidence } from './evidence';
import { dist, gateFlipIn, gateOpen } from './maps';
import { geoOf, hasPerk, isIdle, presentIn } from './sim';

export type PubDot = { id: string; teamId: string; x: number; y: number; role: Role; label: string; idle: boolean; mine: boolean; mate: boolean; flag: boolean };
export type PubTeam = { id: string; name: string; slot: number; players: number; score: number; mastery: number | null; route: number; legsDone: number; done: boolean; assisted: boolean; wallet?: number; spent?: number; earned?: number; perks?: Perk[]; votes?: Record<OptionId, number> };
export type CRPublic = {
  view: CRView; protocol: typeof PROTOCOL; phase: Phase; format: Format; mapId: MapId; difficulty: CRState['difficulty']; paused: boolean; locked: boolean; leg: number; legs: number; windows: number;
  serverNow: number; deadlineMs: number | null; phaseStartedMs: number; lowPressure: boolean; teamSizeCap: number; perksOffered: Perk[]; stations: number[];
  teams: PubTeam[]; seats: { id: string; name: string; teamId: string; role: Role; ready: boolean }[]; dots: PubDot[];
  you: { seatId: string; teamId: string; role: Role; ready: boolean; cooldownTicks: number; cooldownMax: number; burstTicks: number; idle: boolean; holdsFlag: boolean; myVote: OptionId | null } | null;
  live: null | {
    tick: number; startTick: number; endTick: number; secondsLeft: number; option: OptionId | null; offered: OptionId[]; objective: { kind: Format; done: boolean; stampIdx: number; stampLockTicks: number; flagHolder: string | null; wrongPosts: number; target: number | null } | null;
    gates: { pair: number; open: boolean; flipInTicks: number }[] | null; bridge: { x: number; y: number; open: boolean; secondsLeft: number; socket: { x: number; y: number } } | null; lamp: { x: number; y: number }[] | null;
    cues: { kind: string; seatId: string; secondsLeft: number; x?: number; y?: number }[]; pinned: { leg: number; text: string } | null; fx: FxRec[]; fold: boolean; sight: boolean; names: string[] | null;
  };
  evidence: { leg: number; text: string }[]; newClue: { leg: number; text: string } | null;
  question: { window: number; position: number; deadlineMs: number; eligible: number; answered: number; settled: boolean; skipped: boolean } | null;
  shop: { wallet: number; owned: Perk[]; slotsLeft: number; items: { id: Perk; cost: number; affordable: boolean }[] } | null;
  finish: { reason: string; tieNote: string | null; standings: (Standing & { name: string })[] } | null; hostKey?: { leg: number; answer: string } | null; log?: string[];
};
const alias = (role: Role, n: number) => `${role === 'solo_pathfinder' ? 'Pathfinder' : role.split('_').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')} ${n}`;

export function project(s: CRState, view: CRView, viewerSeat: string | null, now: number, answered: ReadonlySet<string> = new Set()): CRPublic {
  const me = viewerSeat ? s.seats.find((x) => x.id === viewerSeat && !x.revoked) ?? null : null; const live = s.live; const seats = s.seats.filter((x) => !x.revoked);
  const st = standingsOf(s); const stOf = (id: string) => st.standings.find((x) => x.teamId === id);
  const myTeam = me ? s.teams.find((t) => t.id === me.teamId) ?? null : null; const showWorld = !!live && s.phase !== 'lobby';
  const g = showWorld ? geoOf(s, Math.min(s.leg, s.plan.legs - 1)) : null;
  const teams: PubTeam[] = s.teams.map((t) => {
    const own = view === 'host' || (me && me.teamId === t.id); const row = stOf(t.id);
    const base: PubTeam = { id: t.id, name: t.name, slot: t.slot, players: seats.filter((x) => x.teamId === t.id).length, score: row?.score ?? 0, mastery: t.masteryOf ? Math.round(t.masteryTotal / t.masteryOf / 10) : null, route: row?.route ?? 0, legsDone: t.legsDone, done: !!live && t.obj.done, assisted: !!live && t.obj.assisted };
    if (!own) return base;
    const votes: Record<OptionId, number> = { a: 0, b: 0, c: 0 }; if (s.format === 'split_route') for (const [sid, o] of Object.entries(t.obj.votes)) if (seats.some((x) => x.id === sid && x.teamId === t.id)) votes[o]++;
    return { ...base, wallet: t.wallet, spent: t.spent, earned: t.earned, perks: t.perks.filter((p) => p.leg === s.leg).map((p) => p.id), ...(s.format === 'split_route' ? { votes } : {}) };
  });
  const dots: PubDot[] = (view === 'projector' && s.phase === 'lobby') || !showWorld ? [] : seats.map((x) => {
    const mate = !!me && me.teamId === x.teamId; const mine = x.id === viewerSeat; const idx = seats.filter((q) => q.teamId === x.teamId).findIndex((q) => q.id === x.id) + 1; const named = view === 'host' || mate;
    const t = s.teams.find((q) => q.id === x.teamId)!;
    return { id: named ? x.id : `d${x.id.slice(0, 5)}`, teamId: x.teamId, x: Math.round(x.x * 10) / 10, y: Math.round(x.y * 10) / 10, role: x.role, label: named && view !== 'projector' ? x.name : alias(x.role, idx), idle: !!live && s.phase === 'race' && isIdle(live, x), mine, mate, flag: s.format === 'signal_relay' && t.obj.flagHolder === x.id && !t.obj.done };
  });
  let liveOut: CRPublic['live'] = null;
  if (live && g && myTeam !== undefined) {
    const t = live.tick; const secs = (n: number) => Math.max(0, Math.ceil((n * TICK_MS) / 1000));
    const own = view === 'host' ? (myTeam ?? s.teams[0]!) : myTeam; const leg = Math.min(s.leg, s.plan.legs - 1);
    const cue = (k: string) => !!own && own.cues.some((c) => c.kind === k && c.until > t);
    const echo = !!own && hasPerk(own, 'scout_echo', leg); const fast = !!own && hasPerk(own, 'fast_map', leg); const lampOn = !!own && hasPerk(own, 'route_lamp', leg);
    const sight = view === 'host' || cue('sight') || echo || fast; const fold = view === 'host' || cue('fold') || fast;
    const gated = g.options.filter((o) => o.gates.length).flatMap((o) => o.gates); const gateList = [...new Set(gated)].map((pair) => ({ pair, open: gateOpen(t, pair), flipInTicks: gateFlipIn(t, pair) }));
    const bridgeOpen = !!own && own.bridgeUntil > t; let lamp: { x: number; y: number }[] | null = null;
    if (own && (lampOn || cue('pulse')) && !own.obj.done) {
      const stamp = s.format === 'atlas_circuit' ? s.evidence[live.leg]?.order?.[own.obj.stampIdx] : s.format === 'signal_relay' ? own.obj.legTarget : undefined;
      const sp = stamp !== undefined && stamp >= 0 ? g.spurs[stamp] : undefined; const holder = own.obj.flagHolder ? s.seats.find((x) => x.id === own.obj.flagHolder) : null;
      const from = me ?? holder ?? null; const goal = sp ? sp.end : g.hubB;
      if (from) { const steps = 5; lamp = Array.from({ length: steps }, (_, i) => ({ x: Math.round(from.x + ((goal.x - from.x) * (i + 1)) / (steps + 1)), y: Math.round(from.y + ((goal.y - from.y) * (i + 1)) / (steps + 1)) })); }
    }
    const o = own?.obj;
    liveOut = {
      tick: t, startTick: live.startTick, endTick: live.endTick, secondsLeft: secs(live.endTick - t), option: o ? o.option : null, offered: g.offered,
      objective: o ? { kind: s.format, done: o.done, stampIdx: o.stampIdx, stampLockTicks: Math.max(0, o.stampLockUntil - t), flagHolder: o.flagHolder, wrongPosts: o.wrongPosts, target: view === 'host' && s.format === 'signal_relay' ? o.legTarget : null } : null,
      gates: sight && gateList.length ? gateList : null,
      bridge: g.bridge && (view === 'host' || !!own) ? { x: g.bridge.seg.a.x, y: g.bridge.seg.a.y, open: bridgeOpen, secondsLeft: bridgeOpen ? secs(own!.bridgeUntil - t) : 0, socket: g.bridge.socket } : null,
      lamp, cues: own ? own.cues.filter((c) => c.until > t).map((c) => ({ kind: c.kind, seatId: c.seatId, secondsLeft: secs(c.until - t), ...(c.x !== undefined ? { x: c.x, y: c.y } : {}) })) : [],
      pinned: own?.pinned !== null && own?.pinned !== undefined && s.evidence[Number(own.pinned)] ? { leg: Number(own.pinned), text: s.evidence[Number(own.pinned)]!.text } : null,
      fx: live.fx.filter((f) => t - f.tick <= 40), fold, sight, names: fast || echo || view === 'host' ? g.spurs.map((sp) => sp.name) : null,
    };
  }
  const evidence = s.evidence.slice(0, view === 'host' ? Math.min(s.evidence.length, s.revealedLegs) : s.revealedLegs).map(publicEvidence);
  const newClue = s.phase === 'reveal' || s.phase === 'route_choice' ? evidence[evidence.length - 1] ?? null : null;
  const q = s.question && ['barrier', 'reveal'].includes(s.phase) ? s.question : null; const myElig = me && q ? q.eligible[me.teamId] ?? [] : []; const all = q ? Object.values(q.eligible).flat() : [];
  const owned = myTeam ? myTeam.perks.filter((p) => p.leg === s.leg).map((p) => p.id) : [];
  const hostKey = view === 'host' && s.evidence[s.leg] && s.phase !== 'lobby' ? { leg: s.leg, answer: s.format === 'signal_relay' ? `Post: ${g?.spurs[s.evidence[s.leg]!.postIdx ?? 0]?.name ?? '?'}` : s.format === 'atlas_circuit' ? `Order: ${(s.evidence[s.leg]!.order ?? []).map((i) => g?.spurs[i]?.name).join(' → ')}` : 'Every road reaches the checkpoint' } : null;
  void presentIn; void dist; void worldTarget; void ROLE_COOLDOWN;
  return {
    view, protocol: PROTOCOL, phase: s.phase, format: s.format, mapId: s.mapId, difficulty: s.difficulty, paused: s.paused, locked: s.locked, leg: s.leg, legs: s.plan.legs, windows: s.plan.windows, serverNow: now,
    deadlineMs: s.phase === 'race' && live ? null : s.phaseDeadlineMs, phaseStartedMs: s.phaseStartedMs, lowPressure: s.lowPressure, teamSizeCap: s.teamSizeCap, perksOffered: s.perks, stations: s.plan.stations, teams,
    seats: view === 'projector' ? [] : seats.filter((x) => view === 'host' || (me && x.teamId === me.teamId)).map((x) => ({ id: x.id, name: x.name, teamId: x.teamId, role: x.role, ready: x.ready })), dots,
    you: me ? { seatId: me.id, teamId: me.teamId, role: me.role, ready: me.ready, cooldownTicks: live ? Math.max(0, me.abilityReadyTick - live.tick) : 0, cooldownMax: ROLE_COOLDOWN[me.role], burstTicks: live && myTeam ? Math.max(0, myTeam.burstReadyTick - live.tick) : 0, idle: !!live && s.phase === 'race' && isIdle(live, me), holdsFlag: !!myTeam && myTeam.obj.flagHolder === me.id && !myTeam.obj.done, myVote: myTeam?.obj.votes[me.id] ?? null } : null,
    live: liveOut, evidence, newClue,
    question: q ? { window: q.window, position: q.position, deadlineMs: q.deadlineMs, eligible: view === 'student' ? myElig.length : all.length, answered: view === 'student' ? myElig.filter((id) => answered.has(id)).length : all.filter((id) => answered.has(id)).length, settled: q.settled, skipped: q.skipped } : null,
    shop: s.phase === 'route_choice' && myTeam ? { wallet: myTeam.wallet, owned, slotsLeft: Math.max(0, 2 - owned.length), items: s.perks.map((p) => ({ id: p, cost: PERK_COST[p], affordable: myTeam.wallet >= PERK_COST[p] && !owned.includes(p) && owned.length < 2 })) } : null,
    finish: s.finish ? { reason: s.finish.reason, tieNote: s.finish.tieNote, standings: s.finish.standings.map((x) => ({ ...x, name: s.teams.find((t) => t.id === x.teamId)?.name ?? x.teamId })) } : null,
    ...(view === 'host' ? { hostKey, log: s.log } : {}),
  };
}
export { activeSeats };
