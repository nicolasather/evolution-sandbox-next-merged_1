/** Shared helpers for TD tests and the balance report: play a whole match through the real engine with bot squads. */
import { advance, addSeat, createMatch, reduceHost, reduceSeat, type CommittedAnswer, type PoolEntry } from './engine';
import { botAnswers, botBuild } from './bot';
import type { TDConfig, TDMapId, TDState } from './domain';
import type { QuestionKind } from '../types';

export const KINDS: QuestionKind[] = ['multiple_choice', 'answer_forge', 'connection_rush', 'truth_hunt', 'fill_table'];
export const pool = (n: number, kinds: QuestionKind[] = KINDS): PoolEntry[] => Array.from({ length: n }, (_, i) => ({ position: i, id: `rq-${i}`, kind: kinds[i % kinds.length]!, repeat: false }));
export function cfg(o: Partial<TDConfig> = {}): TDConfig {
  const format = o.format ?? 'coop'; const teamCount = o.teamCount ?? (format === 'coop' ? 1 : 2);
  return { schemaVersion: 1, format, mapId: 'meadow_circuit', durationMinutes: 15, questionFlow: 'synchronized', focus: 'balanced', lowPressure: false, readAloud: false, teamSizeCap: 5, teamCount, teamNames: Array.from({ length: teamCount }, (_, i) => ['Mint Comets', 'Coral Crew', 'Blue Orbits', 'Golden Gears'][i]!), approvalAbove: 0, hideNames: false, modifiers: [], allowReviewCycle: false, ...o };
}
export type PlayOpts = { config?: Partial<TDConfig>; seatsPerTeam?: number; accuracy?: number | number[]; seed?: string; map?: TDMapId; questions?: number; t0?: number; stepMs?: number; onlyBolts?: boolean; roles?: (string | null)[] };
export function playMatch(o: PlayOpts = {}): { state: TDState; transitions: number } {
  const c = cfg({ ...(o.config ?? {}), ...(o.map ? { mapId: o.map } : {}) });
  const p = pool(o.questions ?? 60); const seed = o.seed ?? 'match-seed'; let now = o.t0 ?? 1_700_000_000_000;
  let s = createMatch(c, p, c.teamNames.map((_, i) => `team-${i}`), now);
  const per = o.seatsPerTeam ?? 1;
  for (let t = 0; t < c.teamCount; t++) for (let k = 0; k < per; k++) { const r = addSeat(s, `seat-${t}-${k}`, `P${t}${k}`, now, `team-${t}`); if (!r.ok) throw new Error(r.message); s = r.state; }
  if (o.roles) s.seats.forEach((seat, i) => { const role = o.roles![i % o.roles!.length]; if (role) { const r = reduceSeat(s, seat.id, { kind: 'role', role: role as never }); if (r.ok) s = r.state; } });
  const st = reduceHost(s, { kind: 'start' }, now); if (!st.result.ok) throw new Error(st.result.message); s = st.result.state;
  let transitions = 0; const step = o.stepMs ?? 500; let answers: CommittedAnswer[] = []; let lastRound = -1;
  for (let guard = 0; guard < 20_000 && s.phase !== 'finished'; guard++) {
    now += step;
    if (s.phase === 'quiz_open' && lastRound !== s.round) {
      lastRound = s.round; answers = [];
      s.teams.forEach((team, ti) => { const acc = Array.isArray(o.accuracy) ? o.accuracy[ti]! : o.accuracy ?? 0.65; answers.push(...botAnswers(s, acc, `${seed}:${team.id}`).filter((a) => s.seats.find((x) => x.id === a.seatId)?.teamId === team.id)); });
    }
    if (s.phase === 'build') {
      for (const team of s.teams) { const first = s.seats.find((x) => x.teamId === team.id && !x.revoked); if (first && !first.ready) s = botBuild(s, first.id, { onlyBolts: o.onlyBolts }); }
      for (const seat of s.seats) if (!seat.ready && seat.teamId) { const r = reduceSeat(s, seat.id, { kind: 'ready', ready: true }); if (r.ok) s = r.state; }
    }
    const r = advance(s, { now, seed, pool: p, answers });
    if (r.changed) transitions++;
    s = r.state;
  }
  return { state: s, transitions };
}
