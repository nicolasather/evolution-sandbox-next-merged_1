import { materialOf } from '../craft/materials';
import type { MaterialId } from '../craft/types';
import type { Discovery } from '../types';
import { tagsOf } from './tags';
import type { Processing } from './types';

/* ============================================================================
   PHYSICS — what a resource physically IS, worked out ONCE from the tags and
   material the game already keeps, so nothing has to be written per item:

     materialClass   what it is made of (mineral, wood, fibre, earth, liquid…)
     shapeClass      what form it takes (chunk, rod, sheet, strand, grain, pile…)
     properties      hard, brittle, flammable, absorbent, plastic, loose…
     stateModifiers  the conditions it can be in (wet, dry, heated, burnt…)

   Everything that has to decide "how would this behave?" — the bench's motion
   and looks, environment (fire, water, wind), failure copy, hints and
   questions — reads this one record. data/processing.json `physics` overrides a
   shape or adds a property where the tags do not say enough.
   ========================================================================== */

export type MaterialClass =
  | 'mineral' | 'wood' | 'bone' | 'fibre' | 'earth' | 'liquid' | 'flame' | 'metal' | 'glass' | 'made' | 'living' | 'abstract';

export type ShapeClass =
  | 'chunk' | 'rod' | 'sheet' | 'strand' | 'grain' | 'pile' | 'liquid' | 'flame' | 'shard' | 'block' | 'vessel' | 'abstract';

export type PropertyId =
  | 'hard' | 'brittle' | 'heavy' | 'soft' | 'flexible' | 'plastic' | 'loose' | 'fluid' | 'hot'
  | 'flammable' | 'absorbent' | 'sharp' | 'wet' | 'dry' | 'buoyant' | 'porous';

export type StateMod = 'wet' | 'dry' | 'heated' | 'burnt' | 'broken' | 'shaped' | 'polished' | 'molten';

export interface Physics {
  materialClass: MaterialClass;
  shapeClass: ShapeClass;
  properties: PropertyId[];
  stateModifiers: StateMod[];
}

const CLASS_OF: Record<MaterialId, MaterialClass> = {
  stone: 'mineral', wood: 'wood', bone: 'bone', fibre: 'fibre', metal: 'metal', earth: 'earth', glass: 'glass',
  liquid: 'liquid', fire: 'flame', tool: 'made', structure: 'made', machine: 'made', energy: 'abstract',
  signal: 'abstract', idea: 'abstract', life: 'living',
};

const SHAPE_OF: Record<MaterialClass, ShapeClass> = {
  mineral: 'chunk', wood: 'rod', bone: 'rod', fibre: 'strand', earth: 'pile', liquid: 'liquid', flame: 'flame',
  metal: 'block', glass: 'shard', made: 'block', living: 'chunk', abstract: 'abstract',
};

const cache = new WeakMap<Processing, Map<string, Physics>>();
const bare = new Map<string, Physics>();

/** The physical record of one resource. Cached per processing table. */
export function physicsOf(proc: Processing | undefined, node: Pick<Discovery, 'id' | 'cat' | 'era'> | undefined): Physics {
  if (!node) return { materialClass: 'abstract', shapeClass: 'abstract', properties: [], stateModifiers: [] };
  let m = proc ? cache.get(proc) : bare;
  if (!m) { m = new Map(); cache.set(proc!, m); }
  const hit = m.get(node.id);
  if (hit) return hit;

  const tags = tagsOf(proc, node);
  const over = proc?.physics?.[node.id];
  const mat = materialOf(node);
  const materialClass = (over?.material as MaterialClass | undefined) ?? CLASS_OF[mat];
  const shapeClass = (over?.shape as ShapeClass | undefined) ?? SHAPE_OF[materialClass];

  const p = new Set<PropertyId>();
  const has = (...t: string[]) => t.some(x => tags.has(x));
  if (has('hard')) p.add('hard');
  if (has('brittle')) p.add('brittle');
  if (has('heavy')) p.add('heavy');
  if (has('soft', 'plastic')) p.add('soft');
  if (has('plastic')) p.add('plastic');
  if (has('loose')) p.add('loose');
  if (has('fluid')) { p.add('fluid'); p.add('wet'); }
  if (has('hot')) p.add('hot');
  if (has('woody', 'fibrous', 'burnable') && !has('made')) p.add('flammable');
  if (has('fibrous', 'living', 'woven')) p.add('flexible');
  if (has('earthy', 'fibrous', 'loose', 'woody') && !has('glassy')) p.add('absorbent');
  if (has('woody', 'fibrous')) p.add('buoyant');
  if (has('woody', 'earthy', 'organic') && !has('made')) p.add('porous');
  if (proc?.capSet.edged?.has(node.id)) p.add('sharp');
  if (has('wet')) p.add('wet');
  if (has('dry')) p.add('dry');
  over?.props?.forEach(x => p.add(x as PropertyId));

  const mods = new Set<StateMod>();
  if (p.has('absorbent')) mods.add('wet');
  if (p.has('wet') && !p.has('fluid')) mods.add('dry');
  if (p.has('flammable')) mods.add('burnt');
  if (p.has('hard') || p.has('brittle')) mods.add('broken');
  if (p.has('plastic')) mods.add('shaped');
  if (materialClass === 'metal') { mods.add('heated'); mods.add('molten'); mods.add('polished'); }
  if (materialClass === 'mineral' || materialClass === 'glass' || materialClass === 'earth') mods.add('heated');
  if (materialClass === 'mineral' || materialClass === 'glass') mods.add('polished');
  over?.mods?.forEach(x => mods.add(x as StateMod));

  const out: Physics = { materialClass, shapeClass, properties: [...p], stateModifiers: [...mods] };
  m.set(node.id, out);
  return out;
}

/** The words a coach may use for a property, by kind — never the answer, only what the thing is like. */
export const PROPERTY_WORDS: Record<PropertyId, string> = {
  hard: 'hard', brittle: 'brittle', heavy: 'heavy', soft: 'soft', flexible: 'bendy', plastic: 'workable when soft',
  loose: 'loose', fluid: 'runny', hot: 'hot', flammable: 'quick to burn', absorbent: 'thirsty', sharp: 'edged',
  wet: 'wet', dry: 'dry', buoyant: 'light on water', porous: 'full of tiny holes',
};

/** What the environment does to something, by what it is. Kept as data so one loop can drive it. */
export interface EnvReaction {
  /** Fire nearby: warms it (all), and this many seconds of heat begins to char it (flammable only). */
  chars: boolean;
  /** Water nearby soaks it. */
  soaks: boolean;
  /** Wind stirs it. 0 = not at all, 1 = a leaf. */
  windy: number;
}
export function envOf(ph: Physics): EnvReaction {
  const has = (x: PropertyId) => ph.properties.includes(x);
  const light = ph.shapeClass === 'strand' || ph.shapeClass === 'sheet' || ph.shapeClass === 'grain';
  return {
    chars: has('flammable'),
    soaks: has('absorbent'),
    windy: has('heavy') || has('hard') ? 0 : light ? 1 : has('flexible') ? 0.6 : has('loose') ? 0.3 : 0,
  };
}
