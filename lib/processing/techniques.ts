import type { ActionId } from '../types';
import { TUNE } from '../craft/kinds';

/* ============================================================================
   TECHNIQUES — the catalogue of things a hand can learn to do. A technique is
   not bought or levelled: it APPEARS the first time the player holds what it
   needs (an edge for Cut, a stick for Dig, a flame for Burn…), and the game
   says so once, with a reveal. Experimenting is the way in; a question can
   also open one (see lib/learn).

   Pure data + one predicate. The engine owns which are known; the Action Rail
   draws them grouped by family; the hint ladder and the narrator name them.
   ========================================================================== */

export type Family = 'impact' | 'edge' | 'material' | 'flexible' | 'thermal';

export const FAMILIES: { id: Family; label: string; blurb: string }[] = [
  { id: 'impact',   label: 'Impact',   blurb: 'Force, in a blow.' },
  { id: 'edge',     label: 'Edge',     blurb: 'Working with something sharp.' },
  { id: 'material', label: 'Material', blurb: 'Changing what a thing is made of.' },
  { id: 'flexible', label: 'Flexible', blurb: 'Fibres, cords, things that bend.' },
  { id: 'thermal',  label: 'Thermal',  blurb: 'Heat, cold, dryness and water.' },
];

/** When a technique appears. Every part given must hold. */
export interface UnlockRule {
  /** Known from the very start. */
  start?: true;
  /** All of these held (discoveries or worked states). */
  all?: string[];
  /** At least one of these held. */
  any?: string[];
  /** A capability held (see data/processing.json). */
  cap?: string;
}

export interface Technique {
  id: ActionId;
  label: string;
  family: Family;
  /** Keyboard key on the bench (unique). */
  key: string;
  /** One line on what it is for. */
  blurb: string;
  unlock: UnlockRule;
  /** What the game says when it appears — a hint at use, never a recipe. */
  reveal: string;
}

const T = (id: ActionId, label: string, family: Family, key: string, blurb: string, unlock: UnlockRule, reveal: string): Technique =>
  ({ id, label, family, key, blurb, unlock, reveal });

export const TECHNIQUES: Technique[] = [
  // impact
  T('smash',  'Smash',  'impact', 's', 'Break a hard thing into what it is made of.', { start: true }, 'Hands can break things.'),
  T('hammer', 'Hammer', 'impact', 'h', 'Strike again and again, the way a tool would.', { cap: 'hammer' }, 'A held tool makes every blow count.'),
  T('split',  'Split',  'impact', 'x', 'One firm blow, along the way a thing wants to part.', { cap: 'hammer', any: ['lumber', 'stone_flake', 'stone_tool'] }, 'Some things part cleanly along a line.'),
  T('chisel', 'Chisel', 'impact', 'i', 'Small blows with a point, to hollow or shape.', { cap: 'edged', any: ['lumber', 'bone_shards'] }, 'A point and a tap can hollow a thing out.'),
  // edge
  T('cut',    'Cut',    'edge', 'c', 'Shape a thing with an edge.', { cap: 'edged' }, 'An edge changes what hands can do.'),
  T('carve',  'Carve',  'edge', 'v', 'A long, slow line — to shape rather than to sever.', { cap: 'edged', all: ['stick'] }, 'A slow blade can shape as well as sever.'),
  T('scrape', 'Scrape', 'edge', 'r', 'Drag an edge across a surface to take a layer off.', { cap: 'edged', all: ['bark'] }, 'Dragging an edge takes off a layer.'),
  T('saw',    'Saw',    'edge', 'w', 'Draw a hard edge back and forth to part a thing cleanly.', { cap: 'metalblade' }, 'A harder edge can part what a stone cannot.'),
  // material
  T('brush',  'Brush',  'material', 'b', 'Clean a thing to see what is under it.', { start: true }, 'Hands can clean and sweep.'),
  T('dig',    'Dig',    'material', 'd', 'Uncover what is buried.', { cap: 'digger' }, 'The ground can be opened.'),
  T('grind',  'Grind',  'material', 'g', 'Rub hard things against each other until they are fine.', { all: ['seed'] }, 'Small hard things can be worn down to something finer.'),
  T('mix',    'Mix',    'material', 'm', 'Stir one thing through another until it is even.', { cap: 'wet', all: ['clay'] }, 'With water, some things can be made workable.'),
  T('shape',  'Shape',  'material', 'a', 'Work a soft thing into a form with long strokes.', { all: ['wet_clay'] }, 'A soft thing will hold the shape you give it.'),
  T('press',  'Press',  'material', 'e', 'Bear down and hold, to flatten or bind.', { cap: 'wet', all: ['strands'] }, 'Weight and water can bind loose fibres.'),
  T('polish', 'Polish', 'material', 'o', 'Rub with something fine until the surface changes.', { all: ['cleaned_stone', 'sand'] }, 'A fine grit can make a surface smooth.'),
  // flexible
  T('separate', 'Separate', 'flexible', 'p', 'Take one thing out of a mixture.', { start: true }, 'Hands can part what grew together.'),
  T('pull',   'Pull',   'flexible', 'u', 'Draw fibres out and along.', { start: true }, 'Fibres come away in the hand.'),
  T('twist',  'Twist',  'flexible', 't', 'Turn thin strands round each other until they hold.', { all: ['strands'] }, 'Thin strands can be turned into something strong.'),
  T('tie',    'Tie',    'flexible', 'n', 'Loop something round and draw it tight.', { all: ['cordage'] }, 'A cord can hold things together.'),
  T('stretch', 'Stretch', 'flexible', 'k', 'Draw something out slowly until it opens.', { all: ['rope'] }, 'A stretched cord becomes a mesh.'),
  // thermal
  T('burn',   'Burn',   'thermal', 'f', 'Hold a thing in the flame until it changes.', { cap: 'flame' }, 'Fire does not just warm: it changes.'),
  T('heat',   'Heat',   'thermal', 'j', 'Hold a thing to steady heat, not to burn it.', { cap: 'flame', any: ['dried_clay', 'copper', 'sand'] }, 'Steady heat can harden and melt.'),
  T('dry',    'Dry',    'thermal', 'y', 'Leave a thing to lose its water.', { any: ['shaped_clay', 'wet_clay'] }, 'Some things must lose their water before they can go further.'),
  T('cool',   'Cool',   'thermal', 'l', 'Let a hot thing settle.', { any: ['molten_copper', 'poured_copper'] }, 'What was melted can be made to set.'),
  T('pour',   'Pour',   'thermal', 'z', 'Tip something molten or liquid into a shape.', { any: ['molten_copper'], cap: 'mold' }, 'Melted metal can take the shape of what holds it.'),
];

export const TECH_BY_ID: Record<ActionId, Technique> =
  Object.fromEntries(TECHNIQUES.map(t => [t.id, t])) as Record<ActionId, Technique>;

export const TECH_ORDER: ActionId[] = TECHNIQUES.map(t => t.id);

/** Techniques of one family, in catalogue order. */
export const inFamily = (f: Family): Technique[] => TECHNIQUES.filter(t => t.family === f);

/** Does the rule hold, given what the player has? */
export function ruleHolds(rule: UnlockRule, has: (id: string) => boolean, hasCap: (cap: string) => boolean): boolean {
  if (rule.start) return true;
  if (rule.all && !rule.all.every(has)) return false;
  if (rule.any && !rule.any.some(has)) return false;
  if (rule.cap && !hasCap(rule.cap)) return false;
  return true;
}

/** What the player does for this action (from its gesture tuning). */
export const gestureOf = (id: ActionId): string => TUNE[id].how;
