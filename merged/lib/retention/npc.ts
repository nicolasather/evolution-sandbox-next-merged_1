/* ============================================================================
   37 CAMEOS (#10). Each has hand-drawn portrait art (data/retention/characters/npc/<id>.svg), an era gate, two
   short plain-language notes about their real field, and one quest the player can always finish: look closely at
   something they already hold from that person's field.

   Honesty rules (see the cameo disclaimer in the UI): portraits are stylised interpretations, never authenticated
   likenesses; the notes are captions written by us, never quotations; sources stay "verification required" until a
   specific scholarly source is attached (roster `sourceStatus`) and the card says so.
   ========================================================================== */
import roster from '../../data/retention/npc-roster.json';
import type { EraId } from '../types';
import { eraIndex } from './catalog';

export interface NpcDef {
  id: string; name: string; era: EraId; kind: 'historical' | 'archetype';
  description: string; intro: string; disclaimer: string; sourceStatus: string;
  /** things from their field; holding any one of them makes the encounter possible and the quest finishable */
  items: readonly string[];
  /** 'inspect' = open it in the exhibit; 'study' = keep the exhibit open for a few moments and read */
  quest: 'inspect' | 'study';
  notes: readonly [string, string];
  coins: number;
}

const ITEMS: Record<string, { items: string[]; notes: [string, string] }> = {
  'first-forager': { items: ['fiber', 'wood', 'bone'], notes: ['Early gatherers read the seasons: which plants ripen when, and where.', 'A carrying basket or wrap turns a day of foraging into food for several days.'] },
  'flint-knapper': { items: ['stone_flake', 'flint_piece', 'hand_axe_head'], notes: ['Flint breaks along smooth curved surfaces, so a skilled striker can steer the edge.', 'Flakes and cores left at a site show, step by step, how a tool was made.'] },
  'fire-keeper': { items: ['fire', 'controlled_fire'], notes: ['Carrying and tending fire meant a group could cook, keep warm and work after dark.', 'Hearth layers of ash and charcoal are one of the clearest traces of early fire use.'] },
  'village-builder': { items: ['stone_hut', 'exp26_mortise_and_tenon_joint'], notes: ['Settled life brought durable building: posts, joints and shared work on a frame.', 'A plumb line is just a weight on a string, and it still tells a wall whether it is upright.'] },
  'early-farmer': { items: ['exp26_harvest_sickle_blade', 'anc27_serrated_flint_sickle', 'anc27_raised_timber_granary'], notes: ['Flint-edged sickles reaped grain; wear on the blades shows what they cut.', 'Raised granaries kept stored grain dry and out of reach of pests.'] },
  'river-scribe': { items: ['writing', 'exp26_wax_writing_tablet'], notes: ['Early writing began as record-keeping: counts of grain, goods and days.', 'Wedge-shaped marks pressed into wet clay were quick to make and long to last.'] },
  'market-weigher': { items: ['anc27_standard_stone_weight'], notes: ['Trade needs agreed measures: standard weights let strangers settle a price.', 'A two-pan balance compares an unknown weight against a known one.'] },
  'bronze-smith': { items: ['hammering', 'exp26_hammered_copper_sheet', 'anc27_bronze_ploughshare'], notes: ['Bronze is copper alloyed with tin; it casts well and holds an edge better than copper.', 'Tongs, moulds and hammers made smithing a craft with its own tool kit.'] },
  plato: { items: ['writing', 'astronomy'], notes: ['Plato founded the Academy in Athens (around 387 BCE), among the earliest organised schools.', 'His written dialogues are staged conversations, a way of teaching through questions.'] },
  aristotle: { items: ['writing', 'astronomy'], notes: ['Aristotle studied at Plato\'s Academy and wrote on logic, biology, physics and ethics.', 'He later taught Alexander of Macedon and founded his own school, the Lyceum.'] },
  euclid: { items: ['anc27_euclidean_compass_and_straightedge', 'mathematics'], notes: ['Euclid\'s Elements (around 300 BCE) builds geometry from a few stated assumptions.', 'Many of its constructions need only a compass and an unmarked straightedge.'] },
  archimedes: { items: ['lever', 'exp26_screw_operated_sluice'], notes: ['Archimedes of Syracuse described the law of the lever and the principle of buoyancy.', 'A screw turning inside a tube is traditionally linked with his name as a water-lifting device.'] },
  eratosthenes: { items: ['maps', 'anc27_ancient_celestial_globe'], notes: ['Around 240 BCE Eratosthenes estimated Earth\'s size by comparing noon shadow angles in two cities.', 'He worked at the Library of Alexandria and wrote on geography.'] },
  hypatia: { items: ['astronomy', 'anc27_ancient_celestial_globe'], notes: ['Hypatia taught mathematics and astronomy in Alexandria in late antiquity.', 'She wrote commentaries on earlier mathematical works; little of her own writing survives.'] },
  'zhang-heng': { items: ['anc27_armillary_ring_sphere', 'astronomy'], notes: ['Zhang Heng, a Han-dynasty scholar, is credited with a water-driven armillary sphere.', 'He is also credited with an early seismoscope, built in 132 CE.'] },
  'cai-lun': { items: ['paper', 'writing'], notes: ['Cai Lun, a Han court official, is credited with improving papermaking around 105 CE.', 'Paper made from plant fibre was lighter and cheaper to produce than silk or bamboo strips.'] },
  'al-khwarizmi': { items: ['mathematics', 'anc27_ancient_square_root_algorithm'], notes: ['Working in Baghdad, al-Khwarizmi wrote on solving equations; "algebra" comes from al-jabr in its title.', 'The word "algorithm" is derived from the Latinised form of his name.'] },
  'ibn-al-haytham': { items: ['optics', 'exp26_single_magnifying_lens'], notes: ['Ibn al-Haytham\'s Book of Optics argued that we see because light enters the eye.', 'He tested ideas with controlled experiments, including dark-room pinhole images.'] },
  gutenberg: { items: ['exp26_cast_movable_type', 'writing'], notes: ['Around 1450 in Mainz, Gutenberg combined cast metal type with a press.', 'Identical, reusable letters made many copies of one text practical.'] },
  copernicus: { items: ['astronomy', 'anc27_ancient_celestial_globe'], notes: ['In 1543 Copernicus proposed that the planets, Earth included, circle the Sun.', 'His model was mathematically careful but kept circular orbits.'] },
  galileo: { items: ['telescope', 'optics'], notes: ['In 1609–1610 Galileo turned a telescope to the sky and saw Jupiter\'s four large moons.', 'He also described the Moon\'s mountains and the phases of Venus.'] },
  kepler: { items: ['astronomy', 'telescope'], notes: ['Kepler showed that planets move on ellipses, not circles (published 1609).', 'His three laws of planetary motion later helped Newton\'s theory of gravity.'] },
  newton: { items: ['physics', 'optics', 'exp26_triangular_optical_prism'], notes: ['Newton\'s Principia (1687) set out laws of motion and universal gravitation.', 'With prisms he showed that white light is a mixture of colours.'] },
  leibniz: { items: ['mathematics', 'anc27_sexagesimal_calculation_tablet'], notes: ['Leibniz developed calculus independently of Newton and gave it much of its notation.', 'He described binary arithmetic in 1703, long before electronic computers.'] },
  'james-watt': { items: ['steam_engine', 'exp26_steam_piston'], notes: ['Watt\'s separate condenser (1760s) let a steam engine use far less fuel.', 'The unit of power, the watt, is named after him.'] },
  faraday: { items: ['electricity', 'exp26_electromagnet_core'], notes: ['In 1831 Faraday showed that a changing magnetic field can drive an electric current.', 'That discovery, induction, is the principle behind generators and transformers.'] },
  darwin: { items: ['biology'], notes: ['Darwin\'s On the Origin of Species (1859) set out evolution by natural selection.', 'He built the case from years of observation, collection and correspondence.'] },
  maxwell: { items: ['electricity', 'radio', 'physics'], notes: ['In the 1860s Maxwell wrote equations that tie electricity, magnetism and light together.', 'They predicted electromagnetic waves, which later made radio possible.'] },
  pasteur: { items: ['vaccine', 'medicine', 'biology'], notes: ['Pasteur showed that microbes drive fermentation and spoilage.', 'His work on weakened microbes led to vaccines, including one for rabies (1885).'] },
  'nikola-tesla': { items: ['electricity', 'exp26_alternating_current_generator'], notes: ['In the 1880s Tesla worked on polyphase alternating-current motors and power systems.', 'Alternating current travels long distances more efficiently than early direct-current systems.'] },
  'marie-curie': { items: ['chemistry', 'physics'], notes: ['Marie Curie studied radioactivity and discovered the elements polonium and radium.', 'She won Nobel Prizes in Physics (1903) and Chemistry (1911).'] },
  'ada-lovelace': { items: ['programming', 'computer'], notes: ['In 1843 Ada Lovelace published notes on Babbage\'s Analytical Engine, including a worked algorithm.', 'She saw that a general machine might manipulate symbols, not only numbers.'] },
  'alan-turing': { items: ['computer'], notes: ['Turing\'s 1936 paper defined a simple abstract machine that can compute anything computable.', 'During the Second World War he worked on codebreaking at Bletchley Park.'] },
  'grace-hopper': { items: ['programming', 'computer'], notes: ['Grace Hopper developed one of the first compilers in the early 1950s.', 'She argued that programs should be written in languages closer to English.'] },
  'tim-berners-lee': { items: ['world_wide_web', 'web_browser'], notes: ['In 1989 at CERN, Berners-Lee proposed a linked system of documents: the World Wide Web.', 'The first web browser and server were running by 1990.'] },
  'shigeru-miyamoto': { items: ['video_game', 'game_design', 'game_console'], notes: ['Miyamoto designed Donkey Kong, Super Mario Bros. and The Legend of Zelda at Nintendo.', 'His games are known for tight controls and for teaching through play rather than text.'] },
  'john-carmack': { items: ['three_d_graphics', 'real_time_rendering', 'computer_graphics'], notes: ['Carmack programmed Wolfenstein 3D, Doom and Quake at id Software.', 'Their engines helped make fast, real-time 3D graphics possible on ordinary computers.'] },
};

export const NPCS: readonly NpcDef[] = (roster as unknown as Array<Record<string, string>>).map((r, i) => {
  const x = ITEMS[r.id];
  return {
    id: r.id, name: r.name, era: r.era as EraId, kind: r.kind as NpcDef['kind'],
    description: r.description, intro: r.description, disclaimer: r.disclaimer, sourceStatus: r.sourceStatus,
    items: x?.items ?? [], quest: i % 2 ? 'study' : 'inspect', notes: x?.notes ?? ['', ''], coins: 15 + (eraIndex(r.era) >= 7 ? 10 : 0),
  } as NpcDef;
});
export const NPC_BY_ID: Readonly<Record<string, NpcDef>> = Object.fromEntries(NPCS.map(n => [n.id, n]));

/** Cameos whose era has been reached and whose field the player already holds something from. */
export function eligibleNpcs(eraIdx: number, holds: (id: string) => boolean): NpcDef[] {
  return NPCS.filter(n => eraIndex(n.era) <= eraIdx && n.items.some(holds));
}
