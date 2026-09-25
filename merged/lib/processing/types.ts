import type { ActionId, Category, EraId } from '../types';

/** Something a player can HOLD that lets their hands do more (an edge, a digger, a flame, a hammer…).
 *  Not an item on the bench: the set of items that give it is data (`capabilities` in processing.json). */
export type Capability = string;

/** A worked or offered form of a resource: Stick, Clay, Sand… Held and used like a discovery,
 *  never counted or shown in the archive. */
export interface StateDef {
  id: string;
  n: string;
  era: EraId;
  cat?: Category;
  l1: string;
  l2?: string;
  /** Glyph key; defaults to the id. */
  vis?: string;
  tags?: string[];
  /** Craft material (weight, sound, dust). */
  material?: string;
}

/** Working ONE resource with ONE action. */
export interface TransformDef {
  from: string;
  action: ActionId;
  /** Everything it yields, in order. Discoveries and states may mix. */
  out: string[];
  /** A held capability the hands need for this. */
  needs?: Capability;
  /** Shown when the work succeeds. */
  say?: string;
}

/** Holding `when` makes the world offer `give` (Soil after the first Stick). */
export interface UnlockDef {
  when: string[];
  /** true: any of `when` is enough. false/omitted: all of them. */
  any?: boolean;
  give: string;
  say: string;
}

/** What a resource is, when its tags do not say enough. */
export interface PhysicsOverride {
  shape?: string;
  material?: string;
  props?: string[];
  /** Extra states it can be in (wet, dry, hot…) beyond what its tags imply. */
  mods?: string[];
}

export interface RecipeEdit { id: string; rec: string[] }

export interface ProcessingData {
  capabilities: Record<Capability, string[]>;
  /** Physical overrides by id (shape, extra properties) — the rest is worked out from tags (physics.ts). */
  physics?: Record<string, PhysicsOverride>;
  /** Default tags by craft material. */
  materialTags: Record<string, string[]>;
  /** Extra tags by item id. */
  tags: Record<string, string[]>;
  states: StateDef[];
  transforms: TransformDef[];
  unlocks: UnlockDef[];
  recipes: { add: RecipeEdit[]; retire: RecipeEdit[] };
  /** Action-like discoveries shown as the tangible thing they leave behind. */
  objectify: Record<string, { n: string; l1?: string }>;
}

/** What the engine carries at run time. */
export interface Processing extends ProcessingData {
  /** state id → def, for quick lookup. */
  stateIds: Set<string>;
  /** from id → its transforms. */
  byFrom: Map<string, TransformDef[]>;
  /** result id → transforms that yield it. */
  byOut: Map<string, TransformDef[]>;
  capSet: Record<Capability, Set<string>>;
}
