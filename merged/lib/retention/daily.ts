/* ============================================================================
   DAILY OBJECTIVES (#7) — three small, attainable goals a day, picked from 30
   authored objectives with the shared seed service (lib/seed.ts), so everyone
   sees the same three on the same UTC date. They live inside the existing modes
   (the bench, the exhibit panel, the museum, the scene picker, Minimum Path) —
   there is no new mode. Nothing expires harshly and there is no streak:
   missing a day costs nothing.
   ========================================================================== */
import { createRng, dailyKey } from '../seed';
import type { Engine } from '../engine';
import { progressOf } from '../unlocks/useUnlocks';
import { unlockedFor } from '../unlocks/registry';
import { profile } from '../profile/store';
import { DAILY, DAILY_BY_ID, eraIndex, type DailyDef, type DailyKind } from './catalog';
import type { DailyState } from './store';

/** Hand-written names and lines for the 30 objectives (the catalogue only has placeholders). */
export const DAILY_COPY: Record<string, { name: string; line: string }> = {
  'daily-micro-01': { name: 'First Light', line: 'Make one discovery you have never made before.' },
  'daily-micro-02': { name: 'A Quiet Hall', line: 'Open an exhibit in the Museum that you have unlocked.' },
  'daily-micro-03': { name: 'Another Road', line: 'Find a second way to make something you already own.' },
  'daily-micro-04': { name: 'Close Look', line: 'Inspect one of your discoveries up close.' },
  'daily-micro-05': { name: 'Practiced Hands', line: 'Work a piece with a technique you have learned.' },
  'daily-micro-06': { name: 'The Evidence', line: 'Stay with the evidence of a discovery you own for a few moments.' },
  'daily-micro-07': { name: 'Change of Scenery', line: 'Choose a different backdrop for your era.' },
  'daily-micro-08': { name: 'Feel the Weight', line: 'Shake, spin, swirl or throw a piece on the bench.' },
  'daily-micro-09': { name: 'A Visitor', line: 'Meet a figure who belongs to your era.' },
  'daily-micro-10': { name: 'Shortest Way', line: 'Solve a Minimum Path puzzle.' },
  'daily-micro-11': { name: 'Something New', line: 'Make one discovery you have never made before.' },
  'daily-micro-12': { name: 'Museum Stroll', line: 'Open an exhibit in the Museum that you have unlocked.' },
  'daily-micro-13': { name: 'Second Thoughts', line: 'Find a second way to make something you already own.' },
  'daily-micro-14': { name: 'Turn It Over', line: 'Inspect one of your discoveries up close.' },
  'daily-micro-15': { name: 'Steady Technique', line: 'Work a piece with a technique you have learned.' },
  'daily-micro-16': { name: 'How We Know', line: 'Stay with the evidence of a discovery you own for a few moments.' },
  'daily-micro-17': { name: 'Another View', line: 'Choose a different backdrop for your era.' },
  'daily-micro-18': { name: 'Hands On', line: 'Shake, spin, swirl or throw a piece on the bench.' },
  'daily-micro-19': { name: 'A Conversation', line: 'Meet a figure who belongs to your era.' },
  'daily-micro-20': { name: 'Tidy Route', line: 'Solve a Minimum Path puzzle.' },
  'daily-micro-21': { name: 'The Next Step', line: 'Make one discovery you have never made before.' },
  'daily-micro-22': { name: 'Curator’s Hour', line: 'Open an exhibit in the Museum that you have unlocked.' },
  'daily-micro-23': { name: 'Patient Hands', line: 'Find a second way to make something you already own.' },
  'daily-micro-24': { name: 'Two Good Looks', line: 'Inspect two of your discoveries up close.' },
  'daily-micro-25': { name: 'Twice Worked', line: 'Work two pieces with techniques you have learned.' },
  'daily-micro-26': { name: 'Reading Room', line: 'Stay with the evidence of a discovery you own for a few moments.' },
  'daily-micro-27': { name: 'Wander', line: 'Choose a different backdrop for your era.' },
  'daily-micro-28': { name: 'Test the Grain', line: 'Shake, spin, swirl or throw a piece on the bench.' },
  'daily-micro-29': { name: 'Company', line: 'Meet a figure who belongs to your era.' },
  'daily-micro-30': { name: 'Clean Line', line: 'Solve a Minimum Path puzzle.' },
};
export const dailyName = (d: DailyDef) => DAILY_COPY[d.id]?.name ?? d.name;
export const dailyLine = (d: DailyDef) => DAILY_COPY[d.id]?.line ?? d.description;

/** Which kinds can really be done right now for this player. Never offers the impossible. */
export function feasibleKinds(engine: Engine): Set<DailyKind> {
  const out = new Set<DailyKind>(['change-scene', 'interact-physics']);
  const prim = new Set(engine.db.primitives);
  const made = [...engine.found].filter(id => !prim.has(id) && !engine.get(id)?.state);
  if (engine.withinReach(false).length > 0) out.add('discover-new');
  if (made.length >= 2) { out.add('inspect-object'); out.add('study-history'); }
  if (engine.known.length > 0) out.add('try-technique');
  if (profile.get().museum.length > 0) out.add('visit-museum');
  if (unlockedFor(progressOf(engine)).has('minpath')) out.add('solve-small-path');
  out.add('inspect-npc');
  // a second route exists only where an owned item has more recipes than it has been made by
  if (made.some(id => { const r = engine.routeCount(id); return r.total > r.found && r.total > 1; })) out.add('new-route');
  return out;
}

/** The day's three objectives: one per kind, chosen by the seed service from what is feasible. */
export function pickForDay(day: string, engine: Engine): string[] {
  const feasible = feasibleKinds(engine);
  const rng = createRng(`retention-daily|${day}`);
  const kinds = rng.shuffle([...feasible]);
  const picks: string[] = [];
  for (const kind of kinds) {
    if (picks.length >= 3) break;
    const pool = DAILY.filter(d => d.kind === kind);
    if (pool.length) picks.push(rng.pick(pool).id);
  }
  return picks;
}

export function emptyDay(picks: string[]): DailyState {
  return { picks, progress: {}, done: [], seen: [] };
}
export const todayKey = () => dailyKey();
export { DAILY_BY_ID, eraIndex };
