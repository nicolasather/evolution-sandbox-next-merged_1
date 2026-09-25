import type { Discovery } from '../types';
import type { MaterialId, MaterialProps, ToolKind } from './types';

/* ============================================================================
   MATERIALS — what things are made of, and how they behave on the bench.

   Every discovery gets a material. That decides its weight, how it bounces,
   what it sounds like, what dust it leaves and which actions suit it. A new
   material is one entry in MATERIALS; a new item is one id in MATERIAL_OF.
   Anything not listed falls back on its category, so nothing is ever left
   without a body.
   ========================================================================== */

export const MATERIALS: Record<MaterialId, MaterialProps> = {
  // dense, dead, loud on impact
  stone: {
    mass: 2.4, bounce: 0.18, drag: 5.2, hard: 0.85, squash: 0.03, size: 1.0,
    sound: 'clack', dust: 'bone', natural: ['impact', 'strike', 'grind', 'heat'],
  },
  // warm, a little give
  wood: {
    mass: 1.4, bounce: 0.32, drag: 4.0, hard: 0.4, squash: 0.06, size: 1.05,
    sound: 'knock', dust: 'ochre', natural: ['cut', 'align', 'grind', 'heat'],
  },
  // light, brittle, clicky
  bone: {
    mass: 0.9, bounce: 0.42, drag: 3.6, hard: 0.6, squash: 0.03, size: 0.92,
    sound: 'click', dust: 'bone', natural: ['grind', 'strike', 'align'],
  },
  // almost weightless, no bounce, stretches
  fibre: {
    mass: 0.5, bounce: 0.06, drag: 7.5, hard: 0.05, squash: 0.28, size: 0.95,
    sound: 'rustle', dust: 'ochre', natural: ['stretch', 'wrap', 'grind'],
  },
  // heavy, rings, takes heat
  metal: {
    mass: 3.0, bounce: 0.22, drag: 4.6, hard: 0.95, squash: 0.02, size: 0.98,
    sound: 'ring', dust: 'spark', natural: ['heat', 'strike', 'timing'],
  },
  // clay, ash, lime, brick: dull, heavy, dusty
  earth: {
    mass: 1.9, bounce: 0.08, drag: 6.4, hard: 0.35, squash: 0.14, size: 1.0,
    sound: 'thud', dust: 'ochre', natural: ['trace', 'hold', 'heat', 'grind'],
  },
  glass: {
    mass: 1.2, bounce: 0.3, drag: 3.2, hard: 0.7, squash: 0.02, size: 0.95,
    sound: 'tick', dust: 'water', natural: ['heat', 'align', 'timing'],
  },
  // flows, sloshes, drags like water on a table
  liquid: {
    mass: 1.1, bounce: 0.14, drag: 6.8, hard: 0.0, squash: 0.3, size: 0.98,
    sound: 'splash', dust: 'water', natural: ['pour', 'shake', 'keep'],
  },
  // weightless, lively, warm
  fire: {
    mass: 0.6, bounce: 0.5, drag: 2.4, hard: 0.0, squash: 0.2, size: 0.95,
    sound: 'crackle', dust: 'spark', natural: ['heat', 'keep', 'timing'],
  },
  // a made thing you hold and use
  tool: {
    mass: 1.7, bounce: 0.28, drag: 4.4, hard: 0.75, squash: 0.03, size: 1.02,
    sound: 'clack', dust: 'bone', natural: ['strike', 'cut', 'align', 'impact'],
  },
  structure: {
    mass: 3.4, bounce: 0.05, drag: 8.0, hard: 0.6, squash: 0.02, size: 1.12,
    sound: 'thud', dust: 'bone', natural: ['stack', 'assemble', 'align'],
  },
  machine: {
    mass: 2.8, bounce: 0.15, drag: 5.0, hard: 0.8, squash: 0.02, size: 1.08,
    sound: 'ring', dust: 'spark', natural: ['assemble', 'connect', 'timing', 'align'],
  },
  energy: {
    mass: 0.7, bounce: 0.6, drag: 2.0, hard: 0.0, squash: 0.15, size: 0.96,
    sound: 'hum', dust: 'spark', natural: ['connect', 'keep', 'heat', 'timing'],
  },
  signal: {
    mass: 0.55, bounce: 0.7, drag: 1.6, hard: 0.0, squash: 0.08, size: 0.96,
    sound: 'tick', dust: 'water', natural: ['connect', 'route', 'trace', 'keep'],
  },
  // ideas drift: they have almost no weight and glow instead of casting shadows
  idea: {
    mass: 0.4, bounce: 0.55, drag: 1.4, hard: 0.0, squash: 0.06, size: 1.0,
    sound: 'chime', dust: 'ochre', natural: ['connect', 'trace', 'keep', 'timing'],
  },
  life: {
    mass: 1.3, bounce: 0.3, drag: 4.4, hard: 0.2, squash: 0.18, size: 1.02,
    sound: 'thud', dust: 'ochre', natural: ['hold', 'keep', 'route'],
  },
};

/** Which ids are made of what. One line per material; add an id to reshape it. */
const LISTS: Record<MaterialId, string> = {
  stone: `stone sharp_stone stone_flake stone_tool handaxe microblade quarry boiling_stone flint mortar pestle
    anchor weight silicon coal stone_spear scraper hammering sledge cleaned_stone mixed_ore crushed_ore`,
  wood: `wood lumber peg ladder palisade fence wooden_bowl dugout_canoe raft boat bow spear hafted_tool kindling
    plant grass wheel axle lever bow_drill fish_trap weir spit atlatl javelin pike trident harpoon pickaxe mattock hoe
    fishing thatch_roof workshop bullroarer flail tripwire spike_trap hardened_spear barbed_spear scythe stick bark shavings`,
  bone: `bone needle awl bone_saw fishing_hook tattoo_needle dice flute bone_container bone_tent engraver tallies
    cooked_marrow trophy_necklace bone_shards`,
  fibre: `fiber cordage rope net cloth thread_and_needle plant_thread flax_fiber thatch mat snares bundle lashing
    binding sewing clothing weaving_shuttle tapestry embroidery camouflage paper pulp slow_match fishing_line bolas
    retiarius_trap slingshot strands`,
  metal: `copper bronze iron steel bronze_tools ironworking forging casting money compass gear standardized_weights
    machine_tools molten_copper poured_copper`,
  earth: `pottery brick lime ash charcoal kiln gunpowder plastic smokehouse sauna clay sand soil seed wet_clay shaped_clay dried_clay flour`,
  glass: `glass lens optics magnification`,
  liquid: `irrigation chemistry vaccine antibiotics medicine steam water_power fishing_technology water`,
  fire: `fire controlled_fire campfire hearth torch wildfire smoke smudge_fire brand beacon flint_spark heat_treatment
    cooking smelting`,
  tool: `cutting scraping carving_knife axe adze chisel shears composite_tool`,
  structure: `shelter permanent_shelter stone_hut reinforced_shelter moat_wall trench fish_drying_rack construction
    architecture roads urban_planning village settlement town city infrastructure railway`,
  machine: `mechanism engineering steam_engine factory locomotive cart pulley mechanical_advantage clock telescope
    internal_combustion_engine automobile flight electric_motor game_console personal_computer radar satellite`,
  energy: `electricity electrical_generation electric_light wind_power mechanical_power vacuum_tube electronics
    semiconductor transistor integrated_circuit microprocessor`,
  signal: `telegraph telephone radio computer programming memory storage software computer_graphics digital_media
    computer_network internet world_wide_web web_browser digital_communication smartphone cloud_computing
    artificial_intelligence three_d_graphics real_time_rendering physics_engine animation motion_capture game_engine
    procedural_systems virtual_city open_world photorealistic_rendering large_scale_simulation advanced_npc_systems
    gps cinema photography`,
  idea: ``,
  life: `domestication herding hunting agriculture cultivation seed_selection plant_knowledge biology anatomy`,
};

export const MATERIAL_OF: Record<string, MaterialId> = (() => {
  const out: Record<string, MaterialId> = {};
  (Object.keys(LISTS) as MaterialId[]).forEach(m => {
    LISTS[m].split(/\s+/).filter(Boolean).forEach(id => { if (!(id in out)) out[id] = m; });
  });
  return out;
})();

const BY_CATEGORY: Record<string, MaterialId> = {
  material: 'stone', technique: 'tool', technology: 'tool', engineering: 'machine', energy: 'energy',
  computing: 'signal', media: 'signal', culture: 'idea', society: 'idea', knowledge: 'idea',
  science: 'idea', economy: 'idea', biology: 'life',
};

export function materialOf(node: Pick<Discovery, 'id' | 'cat' | 'era'>): MaterialId {
  const hit = MATERIAL_OF[node.id];
  if (hit) return hit;
  if (node.cat === 'technology' && ['industry', 'electric', 'computing', 'network', 'games', 'simulation'].includes(node.era)) {
    return 'machine';
  }
  return BY_CATEGORY[node.cat] ?? 'stone';
}

export function propsOf(m: MaterialId): MaterialProps {
  return MATERIALS[m];
}

/** Items that can be used as a physical tool, and how. */
const TOOL_LISTS: Record<ToolKind, string> = {
  hammer: 'stone stone_tool handaxe hammering sledge mortar pestle weight',
  blade: `sharp_stone stone_flake microblade cutting scraping carving_knife axe adze chisel shears scythe
    scraper stone_spear`,
  drill: 'bow_drill engraver',
  needle: 'needle awl tattoo_needle fishing_hook',
  saw: 'bone_saw',
  pick: 'pickaxe mattock hoe quarry',
};

export const TOOL_OF: Record<string, ToolKind> = (() => {
  const out: Record<string, ToolKind> = {};
  (Object.keys(TOOL_LISTS) as ToolKind[]).forEach(k => {
    TOOL_LISTS[k].split(/\s+/).filter(Boolean).forEach(id => { if (!(id in out)) out[id] = k; });
  });
  return out;
})();

export const toolKindOf = (id: string): ToolKind | null => TOOL_OF[id] ?? null;

/** Register or reshape a material at runtime (a mod, a test, a future era). */
export function registerMaterial(id: MaterialId | string, props: MaterialProps, items: string[] = []) {
  (MATERIALS as Record<string, MaterialProps>)[id] = props;
  items.forEach(i => { MATERIAL_OF[i] = id as MaterialId; });
}
