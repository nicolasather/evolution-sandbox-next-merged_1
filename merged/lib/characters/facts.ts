/* Pure "what just happened" helpers: given the state BEFORE and AFTER a real transition, which catalogued events are true.
   The modes call these after their own logic has produced the new state, so the crew only ever hears results, never guesses. */
import type { CampState } from '@/lib/survival/types';

const LOW = 3;

export function survivalFacts(prev: CampState, next: CampState): string[] {
  const out: string[] = [];
  if (next.day > prev.day) { out.push('survival-advance-day', 'survival-objective-progress'); }
  if (next.period !== prev.period) out.push('survival-weather-shift');
  if (next.resources.food < LOW && prev.resources.food >= LOW) out.push('survival-food-low');
  if (next.resources.water < LOW && prev.resources.water >= LOW) out.push('survival-water-low');
  const hurt = (c: CampState) => c.members.filter(m => m.injured).length;
  if (hurt(next) > hurt(prev)) out.push('survival-member-injured');
  if (hurt(next) < hurt(prev)) out.push('survival-member-recovers');
  if (next.ending !== 'ongoing') out.push('survival-run-complete');
  return out;
}
