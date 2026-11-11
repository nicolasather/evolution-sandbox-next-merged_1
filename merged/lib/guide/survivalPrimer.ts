/* ============================================================================
   SURVIVAL PRIMER — the in-page tour of the Survival mode. It points at the real
   controls (by their `data-primer` key) with an arrow and a highlight, and says in
   plain words what each one does. It is shown on the same page, never as a new
   page, and it never changes the game: it only reads the controls it points at.

   The keys below MUST match the `data-primer` attributes in
   components/survival/SurvivalMode.tsx; lib/guide/__tests__ checks that.
   ========================================================================== */

export const PRIMER_KEY = 'evo.survival.primer.v1';

export type PrimerTarget = 'goal' | 'resources' | 'fire' | 'shelter' | 'sky' | 'member' | 'tasks' | 'advance';

export interface PrimerStep {
  id: string;
  target: PrimerTarget;
  title: string;
  /** One to three short sentences, plain English. */
  body: string;
}

export const SURVIVAL_PRIMER_STEPS: PrimerStep[] = [
  {
    id: 'goal',
    target: 'goal',
    title: 'Your goal',
    body: 'Keep your three people alive through the night of day 6. At dawn of day 7 the group holds on and the run is won. The run is lost if everyone is injured, or if morale runs out.',
  },
  {
    id: 'resources',
    target: 'resources',
    title: 'Food, water and wood',
    body: 'Every morning the group eats 0.5 food and drinks 0.6 water per person. Wood is the fuel for the fire and for shelter. Watch the numbers: if food or water runs short, everyone gets more tired and less hopeful.',
  },
  {
    id: 'fire',
    target: 'fire',
    title: 'Light a fire',
    body: 'Tending the fire costs 0.2 wood. A lit fire keeps people warm and steadies morale, but it burns down a little every part of the day. Let it go out and the cold comes back.',
  },
  {
    id: 'shelter',
    target: 'shelter',
    title: 'Build shelter',
    body: 'Each shelter step costs 0.5 wood and makes the camp warmer, up to a solid shelter. It matters most at night, when people lose warmth fastest.',
  },
  {
    id: 'sky',
    target: 'sky',
    title: 'Day and night',
    body: 'The day runs morning, day, evening, night. Food cannot be gathered at night, and people lose warmth about three times faster then. Plan the night before it comes.',
  },
  {
    id: 'member',
    target: 'member',
    title: 'Your people',
    body: 'Each person has energy, warmth and morale, shown as words. A person is good at certain work: strong carriers gather wood fastest, observant ones find food, craftspeople are best at fire and shelter, explorers at water.',
  },
  {
    id: 'tasks',
    target: 'tasks',
    title: 'Give each person a task',
    body: 'Pick one task for each person: Water, Food, Wood, Fire, Shelter or Rest. Rest gives back energy and morale. Anyone you leave without a task just idles this part of the day.',
  },
  {
    id: 'advance',
    target: 'advance',
    title: 'Move time on',
    body: 'Advance runs one part of the day. Everyone does their task at once, and then you see what changed. Then you choose again.',
  },
];

/** The stored flag is per visitor and never part of a run's save. A broken or blocked store reads as "not seen". */
export function primerSeen(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(PRIMER_KEY) === 'done'; } catch { return false; }
}

export function markPrimerSeen(): void {
  try { window.localStorage.setItem(PRIMER_KEY, 'done'); } catch { /* storage blocked: it simply shows again next visit */ }
}
