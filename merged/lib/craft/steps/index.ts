import type { StepDef, StepKind } from '../types';
import { buildSteps } from './build';
import { contactSteps } from './contact';
import { controlSteps } from './control';
import { motionSteps } from './motion';
import { pathSteps } from './path';

/* ============================================================================
   STEP REGISTRY — every interaction kind a recipe can name.

   To add one: write a `StepDef` (kind, verb, estimate, create), add its name
   to `StepKind` in ../types.ts, and `registerStep()` it (or list it below).
   Recipes then use it by name in data: `{ kind: 'yours', ...params }`.
   ========================================================================== */

const REGISTRY = new Map<StepKind, StepDef>();

export function registerStep(def: StepDef) { REGISTRY.set(def.kind, def); }

for (const d of [...contactSteps, ...motionSteps, ...controlSteps, ...pathSteps, ...buildSteps]) registerStep(d);

export function stepDef(kind: StepKind): StepDef | undefined { return REGISTRY.get(kind); }
export function stepKinds(): StepKind[] { return [...REGISTRY.keys()]; }

/** One line that says what the hands do, shown the first few times a kind of step appears. */
const HINTS: Record<StepKind, string> = {
  touch: 'Bring them together',
  impact: 'Hold to lift, release to drop',
  hold: 'Press and hold · Space',
  strike: 'Swing on the beat · click or Space',
  grind: 'Rub back and forth',
  shake: 'Shake it side to side',
  stretch: 'Pull the ends apart',
  separate: 'Pull the halves apart',
  align: 'Drag it into place · turn with R or the wheel',
  wrap: 'Circle around the joint',
  pour: 'Move sideways to tilt',
  heat: 'Hold to feed the fire, ease off to hold the heat',
  trace: 'Follow the line',
  connect: 'Link the matching ends',
  route: 'Guide it along the channel',
  keep: 'Keep it inside the ring',
  timing: 'Click as the needle crosses the mark · Space',
  assemble: 'Fit every piece into its place',
  stack: 'Stack from the bottom up',
  cut: 'Swipe across the line',
  place: 'Carry it to the station',
};
export const stepHint = (kind: StepKind): string => HINTS[kind] ?? '';
