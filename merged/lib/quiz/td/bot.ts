/** A simple, deterministic "squad bot" used by balance tests, the replay fixtures and the offline practice demo. It plays through the real
 *  engine only (the same reduceSeat calls a student makes), so anything it can do a student can do. */
import { rngFrom } from '../projector/rng';
import { TOWERS } from './balance';
import { previewBoard, upgradeCost, type CommittedAnswer } from './engine';
import type { TDSeat, TDState, TDTowerKind } from './domain';
import { MAPS, mapPath, padCenter } from './maps';
import { reduceSeat } from './engine';

/** Pads ordered by how much lane they cover (within 3.2 tiles), best first. */
export function padsByCoverage(mapId: TDState['config']['mapId']): string[] {
  const path = mapPath(mapId);
  const score = (c: readonly [number, number]) => path.pts.filter((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) <= 3200).length;
  return [...MAPS[mapId].pads].sort((a, b) => score(padCenter(b)) - score(padCenter(a)) || (a.id < b.id ? -1 : 1)).map((p) => p.id);
}
const ROTATION: TDTowerKind[] = ['bolt', 'bolt', 'ember', 'thorn', 'bolt', 'arc', 'frost', 'ember', 'bolt', 'beacon'];

/** Spend the squad's points like a sensible class would: build along the best pads, then upgrade. Returns the new state. */
export function botBuild(state: TDState, seatId: string, opts: { onlyBolts?: boolean } = {}): TDState {
  let s = state; const seat = s.seats.find((x) => x.id === seatId) as TDSeat; const team = () => s.teams.find((t) => t.id === seat.teamId)!;
  const order = padsByCoverage(s.config.mapId);
  for (let guard = 0; guard < 30; guard++) {
    const t = team(); const free = order.filter((p) => !t.towers.some((x) => x.padId === p));
    const nextKind = opts.onlyBolts ? 'bolt' : ROTATION[t.towers.length % ROTATION.length]!;
    const wantBuild = t.towers.length < 6 || (t.towers.length < 12 && t.towers.filter((x) => x.level === 1).length <= 2);
    if (wantBuild && free.length) {
      const pv = previewBoard(s, seat, { kind: 'build', padId: free[0]!, tower: nextKind });
      if (pv.ok) { const r = reduceSeat(s, seatId, { kind: 'build', padId: free[0]!, tower: nextKind }); if (r.ok) { s = r.state; continue; } }
    }
    const up = [...t.towers].filter((x) => upgradeCost(x) !== null).sort((a, b) => upgradeCost(a)! - upgradeCost(b)!)[0];
    if (up) {
      const r = reduceSeat(s, seatId, { kind: 'upgrade', towerId: up.id, branch: up.level === 2 ? undefinedBranch(up.kind) : undefined });
      if (r.ok) { s = r.state; continue; }
    }
    if (free.length && t.points >= TOWERS.bolt.cost) { const r = reduceSeat(s, seatId, { kind: 'build', padId: free[0]!, tower: 'bolt' }); if (r.ok) { s = r.state; continue; } }
    break;
  }
  return s;
}
const undefinedBranch = (k: TDTowerKind) => ({ bolt: 'double_barrel', frost: 'deep_freeze', ember: 'armor_melt', thorn: 'lasting_sap', arc: 'jump_chain', beacon: 'range_aura' } as const)[k];

/** Answers for the open question: each eligible seat answers correctly with probability `accuracy` (seeded). */
export function botAnswers(s: TDState, accuracy: number, seed: string): CommittedAnswer[] {
  const r = s.rounds.find((x) => x.n === s.round); if (!r?.question) return [];
  const rng = rngFrom(`${seed}:${r.n}`);
  return Object.values(r.eligible).flat().map((seatId, i) => {
    const x = rng.next(); const frac = x < accuracy ? 1000 : x < accuracy + 0.08 ? 500 : 0;
    return { id: `sub-${r.n}-${i}`, seatId, roomQuestionId: r.question!.roomQuestionId, correct: frac === 1000, awardedFraction: frac };
  });
}
