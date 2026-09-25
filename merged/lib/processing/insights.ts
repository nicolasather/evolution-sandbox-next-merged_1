import type { ActionId } from '../types';
import type { PropertyId } from './physics';

/* ============================================================================
   INSIGHTS — the smallest kind of discovery. Working a thing, or failing to,
   shows what it is LIKE: stone is hard, clay drinks water, fibre is strong
   along its length. Each is noticed once, in a line, and remembered. The chain
   the game runs on is:

       a property  →  an observation  →  a technique  →  an item

   so the observation is the first link: it names the property that the next
   technique, question or hint will lean on. Never a recipe, never a name of
   what comes next.
   ========================================================================== */

export interface Insight {
  id: string;
  /** What was done, and to what. */
  from: string;
  action: ActionId;
  /** When it is noticed: by the work succeeding, or by it being refused. */
  on: 'done' | 'nothing';
  /** The property it teaches. */
  property: PropertyId;
  text: string;
}

const I = (from: string, action: ActionId, on: Insight['on'], property: PropertyId, text: string): Insight =>
  ({ id: `${from}.${action}.${on}`, from, action, on, property, text });

export const INSIGHTS: Insight[] = [
  I('stone', 'smash', 'done', 'brittle', 'Stone is hard, and it breaks along an edge.'),
  I('stone', 'brush', 'done', 'hard', 'Under the dust, stone shows a bright, glassy seam.'),
  I('wood', 'smash', 'done', 'flammable', 'Wood snaps along its grain. It is made of fibres.'),
  I('wood', 'brush', 'done', 'flammable', 'The outer layer of a branch comes away dry and light.'),
  I('bone', 'smash', 'done', 'brittle', 'Bone splinters. Some of the pieces come to a point.'),
  I('fiber', 'pull', 'done', 'flexible', 'Fibre is strong along its length, and weak across it.'),
  I('strands', 'twist', 'done', 'flexible', 'Strands turned round each other hold what one alone cannot.'),
  I('seed', 'grind', 'done', 'hard', 'Grinding turns hard little grains into something soft and fine.'),
  I('clay', 'mix', 'done', 'absorbent', 'Clay drinks water, and turns soft.'),
  I('wet_clay', 'shape', 'done', 'plastic', 'Wet clay keeps the shape you give it.'),
  I('shaped_clay', 'dry', 'done', 'porous', 'The water leaves. What is left is stiff, and brittle.'),
  I('dried_clay', 'heat', 'done', 'hard', 'Fire turns clay into something like stone.'),
  I('wood', 'burn', 'done', 'flammable', 'With little air, burning wood turns black and light.'),
  I('sand', 'heat', 'nothing', 'loose', 'Sand glows in the fire, but the fire is not hot enough to change it.'),
  I('copper', 'heat', 'done', 'hard', 'Metal, hot enough, runs like water.'),
  I('copper', 'hammer', 'done', 'hard', 'Metal hardens as it is worked.'),
  I('glass', 'polish', 'done', 'brittle', 'A smooth, curved surface bends light.'),
  I('water', 'smash', 'nothing', 'fluid', 'Water cannot be broken. It closes around whatever tries.'),
  I('water', 'cut', 'nothing', 'fluid', 'A liquid keeps no shape but the one it is held in.'),
  I('stone', 'cut', 'nothing', 'hard', 'An edge of stone cannot cut stone.'),
  I('stone', 'burn', 'nothing', 'hard', 'Stone does not burn.'),
  I('clay', 'shape', 'nothing', 'plastic', 'Clay, dry and stiff, will not take a shape. It wants something first.'),
  I('fiber', 'smash', 'nothing', 'flexible', 'Fibre only flattens, then springs back.'),
];

const byKey = new Map<string, Insight>(INSIGHTS.map(i => [i.id, i]));

/** The insight, if any, that working `from` with `action` teaches with this outcome. */
export const insightFor = (from: string, action: ActionId, on: Insight['on']): Insight | undefined =>
  byKey.get(`${from}.${action}.${on}`);
