/* Real progress, reported by whoever owns the engine (Sandbox). The crew roster is DERIVED from it, never from a timer. */
import { earnedCrew, type CrewProgress } from './registry';
import type { CharacterId } from './types';

let current: CrewProgress = { made: 0, eraIndex: 0 };
const subs = new Set<(p: CrewProgress) => void>();

export const crewProgress = {
  report(p: CrewProgress): void {
    if (p.made === current.made && p.eraIndex === current.eraIndex) return;
    current = { made: p.made, eraIndex: p.eraIndex };
    for (const s of [...subs]) { try { s(current); } catch { /* ignore */ } }
  },
  get: (): CrewProgress => current,
  earned: (): CharacterId[] => earnedCrew(current),
  subscribe(fn: (p: CrewProgress) => void): () => void { subs.add(fn); return () => { subs.delete(fn); }; },
  _reset() { current = { made: 0, eraIndex: 0 }; subs.clear(); },
};
