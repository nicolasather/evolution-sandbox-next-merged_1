/** Projections: what each audience may see. The seed, answer keys and other squads' private economy never appear here. */
import type { Body, OSState, OSView, Perk, Phase, Role, Standing, TeamRec } from './domain';
import { worldTick } from './engine';
import { clearedOf } from './physics';

export type PubSeat = { id: string; name: string; teamId: string; role: Role; ready: boolean };
export type PubDot = { id: string; teamId: string; x: number; y: number; tick: number; stunned: boolean; role: Role; goal: boolean; mine: boolean; mate: boolean };
export type PubTeam = { id: string; name: string; players: number; progress: number; escaped: number; mastery: number; points?: number; perks?: Perk[]; pulses?: TeamRec['pulses']; spent?: number; earned?: number; wasted?: number; chaptersCleared?: number };
export type OSPublic = {
  view: OSView; phase: Phase; format: OSState['format']; paused: boolean; locked: boolean; chapter: number; chapters: number; chapterTicks: number;
  world: { tick: number; freezeTick: number | null; running: boolean }; deadlineMs: number | null; phaseStartedMs: number; serverNow: number;
  teams: PubTeam[]; seats: PubSeat[]; dots: PubDot[];
  you: { seatId: string; teamId: string; role: Role; ready: boolean; tick: number | null } | null;
  barrier: { chapter: number; phaseId: string; deadlineMs: number; position: number; help: boolean; eligible: number; answered: number } | null;
  finish: { reason: string; standings: (Standing & { name: string })[] } | null; limits: number[]; log?: string[];
};

export function project(s: OSState, view: OSView, viewerSeat: string | null, now: number, bodies: Record<string, Body> = {}, answered: ReadonlySet<string> = new Set()): OSPublic {
  const me = viewerSeat ? s.seats.find((x) => x.id === viewerSeat && !x.revoked) ?? null : null;
  const live = s.seats.filter((x) => !x.revoked);
  const teams: PubTeam[] = s.teams.map((t) => {
    const seats = live.filter((x) => x.teamId === t.id); const total = s.plan.totalDist || 1;
    const progress = seats.length ? Math.round(seats.reduce((a, x) => a + Math.min(1000, ((bodies[x.id]?.maxDist ?? 0) * 1000) / total), 0) / seats.length) : 0;
    const base: PubTeam = { id: t.id, name: t.name, players: seats.length, progress, escaped: seats.filter((x) => bodies[x.id]?.goalTick != null).length, mastery: t.masteryOf ? Math.round(t.mastery / t.masteryOf) : 0 };
    const own = view === 'host' || (me && me.teamId === t.id);
    return own ? { ...base, points: t.points, perks: t.perks, pulses: t.pulses, spent: t.spent, earned: t.earned, wasted: t.wasted, chaptersCleared: t.chaptersCleared } : base;
  });
  const seatsOut: PubSeat[] = view === 'projector' ? [] : live.filter((x) => view === 'host' || (me && x.teamId === me.teamId)).map((x) => ({ id: x.id, name: x.name, teamId: x.teamId, role: x.role, ready: x.ready }));
  const dots: PubDot[] = view === 'projector' && s.phase === 'lobby' ? [] : live.flatMap((x) => {
    const b = bodies[x.id]; if (!b) return [];
    return [{ id: view === 'host' || x.id === viewerSeat || (me && me.teamId === x.teamId) ? x.id : `d${x.id.slice(0, 4)}`, teamId: x.teamId, x: b.x, y: b.y, tick: b.tick, stunned: b.stunUntil > b.tick, role: x.role, goal: b.goalTick != null, mine: x.id === viewerSeat, mate: !!me && me.teamId === x.teamId }];
  });
  const b = s.barrier && ['barrier', 'reveal'].includes(s.phase) ? s.barrier : null;
  const myElig = me && b ? (b.eligible[me.teamId] ?? []) : [];
  const nameOf = (id: string) => s.teams.find((t) => t.id === id)?.name ?? id;
  return {
    view, phase: s.phase, format: s.format, paused: s.paused, locked: s.locked, chapter: s.chapter, chapters: s.plan.chapters, chapterTicks: s.plan.chapterTicks,
    world: { tick: worldTick(s, now), freezeTick: s.freezeTick, running: s.clock.running && !s.paused }, deadlineMs: s.phaseDeadlineMs, phaseStartedMs: s.phaseStartedMs, serverNow: now,
    teams, seats: seatsOut, dots,
    you: me ? { seatId: me.id, teamId: me.teamId, role: me.role, ready: me.ready, tick: bodies[me.id]?.tick ?? null } : null,
    barrier: b ? { chapter: b.chapter, phaseId: b.phaseId, deadlineMs: b.deadlineMs, position: b.position, help: !!me && b.help.includes(me.teamId), eligible: view === 'student' ? myElig.length : Object.values(b.eligible).flat().length, answered: view === 'student' ? myElig.filter((id) => answered.has(id)).length : [...answered].length } : null,
    finish: s.finish ? { reason: s.finish.reason, standings: s.finish.standings.map((x) => ({ ...x, name: nameOf(x.teamId) })) } : null,
    limits: s.plan.limitDist.map((v) => (v > 100000 ? -1 : v)),
    ...(view === 'host' ? { log: s.log } : {}),
  };
}
export const accuracyOf = (t: TeamRec) => (t.masteryOf ? Math.round(t.mastery / t.masteryOf / 10) : null);
export { clearedOf };
