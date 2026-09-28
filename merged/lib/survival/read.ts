/* Collapses 0–1 simulation numbers into the words the UI shows — per the
 * brief, "collapse these into readable qualitative states most of the time
 * ... not seven progress bars above every person." The raw numbers stay
 * internal to lib/survival/simulate.ts. */

export function energyWord(v: number): string {
  if (v > 0.7) return 'rested';
  if (v > 0.4) return 'tired';
  if (v > 0.15) return 'exhausted';
  return 'collapsing';
}

export function warmthWord(v: number): string {
  if (v > 0.7) return 'warm';
  if (v > 0.4) return 'cool';
  if (v > 0.15) return 'cold';
  return 'freezing';
}

export function moraleWord(v: number): string {
  if (v > 0.7) return 'steady';
  if (v > 0.4) return 'uneasy';
  if (v > 0.15) return 'shaken';
  return 'despairing';
}

export const TASK_LABEL: Record<string, string> = {
  'gather-wood': 'Gather wood', 'gather-food': 'Gather food', 'fetch-water': 'Fetch water',
  'tend-fire': 'Tend the fire', 'build-shelter': 'Build shelter', rest: 'Rest', idle: 'Idle',
};
