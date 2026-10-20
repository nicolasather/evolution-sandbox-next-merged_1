/** Per-viewer projections. The browser only ever receives one of these, never the stored state.
 *   student   — own squad in full; other squads as a compact summary (wave, core, accuracy, state): no points, towers, spending or names
 *   projector — every board (the teacher's shared screen), names hidden on request, no per-student correctness, stakes hidden
 *   host      — everything in the state (the seed is never in the state: it lives in its own column on the server)
 *  Answer keys are not part of the state at all: the question is attached separately by the server through publicQuestionView. */
import type { TDRound, TDSeat, TDState, TDTeam, TDView } from './domain';

export type TeamSummary = Pick<TDTeam, 'id' | 'name' | 'colorIndex' | 'coreHP' | 'maxCoreHP' | 'wavesCleared' | 'fallen'> & { accuracyPct: number | null; players: number };
export type PublicSeat = Pick<TDSeat, 'id' | 'teamId' | 'role' | 'ready' | 'revoked'> & { name: string; usedThisWave?: string[]; answersThisRound?: number };
export type PublicRound = Omit<TDRound, 'eligible' | 'submitted' | 'correctBySeat' | 'results' | 'waveInput'> & {
  eligibleCount: Record<string, number>; submittedCount: Record<string, number>; mine?: number | null;
  waveInput: TDRound['waveInput']; correctBySeat?: Record<string, number>; eligible?: Record<string, string[]>; submitted?: string[];
};
export type TDPublic = Omit<TDState, 'teams' | 'seats' | 'rounds'> & {
  view: TDView; selfSeatId: string | null; selfTeamId: string | null;
  teams: (TDTeam | (TeamSummary & { summary: true }))[];
  seats: PublicSeat[];
  rounds: PublicRound[];
  serverNow: number;
};

export const accuracyOf = (t: Pick<TDTeam, 'answered' | 'partialCredit'>) => (t.answered >= 3 ? Math.round(t.partialCredit / t.answered / 10) : null);
const summary = (s: TDState, t: TDTeam): TeamSummary & { summary: true } => ({
  id: t.id, name: t.name, colorIndex: t.colorIndex, coreHP: t.coreHP, maxCoreHP: t.maxCoreHP, wavesCleared: t.wavesCleared, fallen: t.fallen, accuracyPct: accuracyOf(t),
  players: s.seats.filter((x) => x.teamId === t.id && !x.revoked).length, summary: true,
});

export function project(state: TDState, view: TDView, selfSeatId: string | null, now: number): TDPublic {
  const s = JSON.parse(JSON.stringify(state)) as TDState;
  const self = selfSeatId ? s.seats.find((x) => x.id === selfSeatId) ?? null : null;
  const myTeam = self?.teamId ?? null;
  const keep = s.rounds.slice(-2); // the current and the previous round are enough for every screen
  const rounds: PublicRound[] = keep.map((r) => {
    const { eligible, submitted, correctBySeat, results, waveInput, ...rest } = r; void results;
    const base: PublicRound = {
      ...rest, waveInput: null,
      eligibleCount: Object.fromEntries(Object.entries(eligible).map(([k, v]) => [k, v.length])),
      submittedCount: Object.fromEntries(s.teams.map((t) => [t.id, submitted.filter((id) => s.seats.find((x) => x.id === id)?.teamId === t.id).length])),
    };
    if (view === 'host') return { ...base, waveInput, correctBySeat, eligible, submitted };
    if (view === 'projector') return { ...base, waveInput };
    // student: only their own squad's frozen board, and only their own correctness (after the reveal)
    return { ...base, waveInput: waveInput && myTeam && waveInput[myTeam] ? { [myTeam]: waveInput[myTeam]! } : null, mine: self && r.credited ? correctBySeat[self.id] ?? null : null };
  });
  let teams: TDPublic['teams'];
  if (view === 'host') teams = s.teams;
  else if (view === 'projector') teams = s.teams.map((t) => ({ ...t, wager: t.wager > 0 ? -1 : 0, pending: t.pending.map((p) => ({ ...p, seat: '' })), log: t.log.map((l) => ({ ...l, seat: undefined })) }));
  else teams = s.teams.map((t) => (t.id === myTeam ? t : summary(s, t)));
  const hide = view === 'projector' && s.config.hideNames;
  const seats: PublicSeat[] = s.seats
    .filter((x) => view !== 'student' || x.teamId === myTeam || x.id === selfSeatId)
    .map((x, i) => ({ id: x.id, teamId: x.teamId, role: x.role, ready: x.ready, revoked: x.revoked, name: hide ? `Player ${i + 1}` : x.name, ...(view !== 'projector' ? { usedThisWave: x.usedThisWave, answersThisRound: x.answersThisRound } : {}) }));
  const { teams: _t, seats: _s, rounds: _r, ...rest } = s; void _t; void _s; void _r;
  return { ...rest, view, selfSeatId: self?.id ?? null, selfTeamId: myTeam, teams, seats, rounds, serverNow: now };
}
