import type { ActionId } from '../types';
import { TUNE } from '../craft/kinds';
import { sortTechniquesChronologically, type TechniqueChronology } from '../chronology';

/* ============================================================================
   TECHNIQUES — the catalogue of things a hand can learn to do. A technique is
   not bought or levelled: it APPEARS the first time the player holds what it
   needs (an edge for Cut, a stick for Dig, a flame for Burn…), and the game
   says so once, with a reveal. Experimenting is the way in; a question can
   also open one (see lib/learn).

   Pure data + one predicate. The engine owns which are known; the Action Rail
   draws them in chronological bands (lib/chronology.ts); `family` is kept as
   secondary metadata for material logic, colours and narrator wording — it no
   longer decides the order techniques appear in.

   CHRONOLOGY — every technique below carries a `chronology` block. `sortDs` is
   a GAMEPLAY anchor for ordering only; `kind` says what claim is actually being
   made (see lib/chronology.ts's ChronologyKind), and the UI must read `kind`
   before ever printing a bare year. Four techniques (`start: true`) have no
   knowable date at all — hands doing the most basic things a hand can do to
   an object predate any surviving evidence — and are marked `foundational`
   rather than given a fake early number. Several others (`split`, `tie`,
   `shape`, `dry`, `cool`) are marked `derived`: their anchor follows directly
   from a prerequisite technique or material and has no archaeological
   signature of its own, so they are placed just after what they need rather
   than dated independently. Where the placement rests on genuinely debated
   evidence (`scrape`), confidence is `provisional` and the note says why.
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
  chronology: TechniqueChronology;
}

const T = (
  id: ActionId, label: string, family: Family, key: string, blurb: string, unlock: UnlockRule, reveal: string,
  chronology: TechniqueChronology,
): Technique => ({ id, label, family, key, blurb, unlock, reveal, chronology });

/** A handful of well-cited anchors this file's `basis` strings lean on, kept in
 *  one place so the same claim is worded the same way everywhere it is used. */
const C = {
  lomekwi: 'percussive stone tool use before the genus Homo (Lomekwi 3, Kenya, ≈3.3 Mya)',
  oldowan: 'the Oldowan flake industry (Gona, Ethiopia, ≈2.6 Mya)',
  acheulean: 'sustained, tool-assisted percussion in Acheulean handaxe knapping (Kokiselei, Kenya, ≈1.76 Mya)',
  hearths: 'the earliest well-evidenced hearths (Gesher Benot Ya’aqov / Qesem, ≈790,000 years — the same milestone this game’s own sourced question on hearths cites)',
  schoningen: 'shaped wooden spears at Schöningen, Germany (≈400,000 years)',
  konigsaue: 'birch-bark adhesive residue at Königsaue, Germany — a genuinely disputed date, cited anywhere from ≈40,000 to ≈200,000 years',
  blombos: 'worked bone tools from Blombos Cave, South Africa (≈70,000–80,000 years)',
  amaras: 'twisted plant-fibre cordage at Abri du Maras, France (≈41,000–52,000 years, made by Neanderthals)',
  pavlov: 'net and textile impressions in fired clay at Pavlov, Czech Republic (≈27,000 years)',
  ohalo: 'grinding stones with starch residue at Ohalo II, Israel (≈23,000 years)',
  earlypottery: 'among the earliest known fired-clay vessel traditions (East Asia, ≈14,000–18,000 years, regionally debated)',
  neolithicPolish: 'the Neolithic ground- and polished-stone tool tradition, distinct from earlier flaked tools (≈9,500 years onward)',
  copperSmelting: 'early copper smelting and annealing in the Balkans (≈6,500 years)',
  moldCasting: 'early copper mould-casting (≈6,000 years)',
  bronzeSaw: 'bronze saw blades in the Near East and Egypt (≈5,000 years) — this technique’s own unlock rule requires `metalblade`, so it is placed at metal sawing, not at the earliest possible stone sawing motion',
};

export const TECHNIQUES: Technique[] = [
  // impact
  T('smash', 'Smash', 'impact', 's', 'Break a hard thing into what it is made of.', { start: true },
    'Hands can break things.',
    { sortDs: -3_300_000, label: 'Foundational', kind: 'foundational', confidence: 'verified',
      basis: `No knowable first moment; ${C.lomekwi} shows the underlying behaviour is at least this old.` }),
  T('hammer', 'Hammer', 'impact', 'h', 'Strike again and again, the way a tool would.', { cap: 'hammer' },
    'A held tool makes every blow count.',
    { sortDs: -1_760_000, label: '≈1.76 Mya', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Repeated, tool-assisted percussion, evidenced by ${C.acheulean}.` }),
  T('split', 'Split', 'impact', 'x', 'One firm blow, along the way a thing wants to part.', { cap: 'hammer', any: ['lumber', 'stone_flake', 'stone_tool'] },
    'Some things part cleanly along a line.',
    { sortDs: -1_500_000, label: 'Follows Hammer', kind: 'derived', confidence: 'provisional',
      basis: 'Needs tool-assisted percussion and a worked blank; splitting itself leaves no separate archaeological signature.' }),
  T('chisel', 'Chisel', 'impact', 'i', 'Small blows with a point, to hollow or shape.', { cap: 'edged', any: ['lumber', 'bone_shards'] },
    'A point and a tap can hollow a thing out.',
    { sortDs: -70_000, label: '≈70,000 BP', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Point-and-tap worked bone/wood tools, evidenced by ${C.blombos}.` }),
  // edge
  T('cut', 'Cut', 'edge', 'c', 'Shape a thing with an edge.', { cap: 'edged' },
    'An edge changes what hands can do.',
    { sortDs: -2_600_000, label: '≈2.6 Mya', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Deliberately produced sharp flakes, evidenced by ${C.oldowan}.` }),
  T('carve', 'Carve', 'edge', 'v', 'A long, slow line — to shape rather than to sever.', { cap: 'edged', all: ['stick'] },
    'A slow blade can shape as well as sever.',
    { sortDs: -400_000, label: '≈400,000 BP', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Deliberately shaped (not just sharpened) wood, evidenced by ${C.schoningen}.` }),
  T('scrape', 'Scrape', 'edge', 'r', 'Drag an edge across a surface to take a layer off.', { cap: 'edged', all: ['bark'] },
    'Dragging an edge takes off a layer.',
    { sortDs: -100_000, label: '≈100,000 BP (debated)', kind: 'debated', confidence: 'provisional',
      basis: `Bark-processing for adhesive use, evidenced by ${C.konigsaue}.`,
      note: 'The residue is real; the date it is stuck to is one of the more contested numbers in this file.' }),
  T('saw', 'Saw', 'edge', 'w', 'Draw a hard edge back and forth to part a thing cleanly.', { cap: 'metalblade' },
    'A harder edge can part what a stone cannot.',
    { sortDs: -5_000, label: '≈5,000 BP', kind: 'earliest_evidence', confidence: 'verified',
      basis: C.bronzeSaw }),
  // material
  T('brush', 'Brush', 'material', 'b', 'Clean a thing to see what is under it.', { start: true },
    'Hands can clean and sweep.',
    { sortDs: -3_300_000, label: 'Foundational', kind: 'foundational', confidence: 'verified',
      basis: 'No knowable first moment — clearing debris by hand needs no tool and predates any tool tradition.' }),
  T('dig', 'Dig', 'material', 'd', 'Uncover what is buried.', { cap: 'digger' },
    'The ground can be opened.',
    { sortDs: -2_000_000, label: '≈2 Mya (approximate)', kind: 'approximate', confidence: 'provisional',
      basis: 'Digging sticks almost never survive; this anchor follows early Homo tool-assisted foraging inferred from wear evidence, not a preserved artefact.',
      note: 'Preservation bias: wood tools this old are lost far more often than they are found.' }),
  T('grind', 'Grind', 'material', 'g', 'Rub hard things against each other until they are fine.', { all: ['seed'] },
    'Small hard things can be worn down to something finer.',
    { sortDs: -23_000, label: '≈23,000 BP', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Grinding stones with starch residue, evidenced by ${C.ohalo}.` }),
  T('mix', 'Mix', 'material', 'm', 'Stir one thing through another until it is even.', { cap: 'wet', all: ['clay'] },
    'With water, some things can be made workable.',
    { sortDs: -14_000, label: '≈14,000 BP (regionally debated)', kind: 'earliest_evidence', confidence: 'provisional',
      basis: `Preparing workable clay paste, evidenced by ${C.earlypottery}.` }),
  T('shape', 'Shape', 'material', 'a', 'Work a soft thing into a form with long strokes.', { all: ['wet_clay'] },
    'A soft thing will hold the shape you give it.',
    { sortDs: -13_500, label: 'Follows Mix', kind: 'derived', confidence: 'provisional',
      basis: 'Needs workable wet clay; modelling it follows immediately and shares the same regional dating debate.' }),
  T('press', 'Press', 'material', 'e', 'Bear down and hold, to flatten or bind.', { cap: 'wet', all: ['strands'] },
    'Weight and water can bind loose fibres.',
    { sortDs: -9_000, label: '≈9,000 BP (approximate)', kind: 'approximate', confidence: 'provisional',
      basis: 'Wet-fibre felting/binding, placed with the broader early Neolithic fibre-working tradition; fibre itself rarely survives to confirm an exact date.' }),
  T('polish', 'Polish', 'material', 'o', 'Rub with something fine until the surface changes.', { all: ['cleaned_stone', 'sand'] },
    'A fine grit can make a surface smooth.',
    { sortDs: -9_500, label: '≈9,500 BP', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Deliberately polished (not merely flaked) stone tools, evidenced by ${C.neolithicPolish}.` }),
  // flexible
  T('separate', 'Separate', 'flexible', 'p', 'Take one thing out of a mixture.', { start: true },
    'Hands can part what grew together.',
    { sortDs: -3_300_000, label: 'Foundational', kind: 'foundational', confidence: 'verified',
      basis: 'No knowable first moment — sorting and pulling apart is older than tool use; even non-human primates do it.' }),
  T('pull', 'Pull', 'flexible', 'u', 'Draw fibres out and along.', { start: true },
    'Fibres come away in the hand.',
    { sortDs: -3_300_000, label: 'Foundational', kind: 'foundational', confidence: 'verified',
      basis: 'No knowable first moment — drawing out plant fibre by hand needs no tool.' }),
  T('twist', 'Twist', 'flexible', 't', 'Turn thin strands round each other until they hold.', { all: ['strands'] },
    'Thin strands can be turned into something strong.',
    { sortDs: -50_000, label: '≈41,000–52,000 BP', kind: 'earliest_evidence', confidence: 'provisional',
      basis: `Twisted plant-fibre cordage, evidenced by ${C.amaras}.`,
      note: 'Fibre technology is the textbook case of preservation bias: the surviving record is almost certainly far younger than the real behaviour.' }),
  T('tie', 'Tie', 'flexible', 'n', 'Loop something round and draw it tight.', { all: ['cordage'] },
    'A cord can hold things together.',
    { sortDs: -48_000, label: 'Follows Twist', kind: 'derived', confidence: 'provisional',
      basis: 'Needs cordage to exist first; tying leaves no separate trace of its own beyond the cordage itself.' }),
  T('stretch', 'Stretch', 'flexible', 'k', 'Draw something out slowly until it opens.', { all: ['rope'] },
    'A stretched cord becomes a mesh.',
    { sortDs: -27_000, label: '≈27,000 BP', kind: 'earliest_evidence', confidence: 'provisional',
      basis: `Net/textile impressions, evidenced by ${C.pavlov}.` }),
  // thermal
  T('burn', 'Burn', 'thermal', 'f', 'Hold a thing in the flame until it changes.', { cap: 'flame' },
    'Fire does not just warm: it changes.',
    { sortDs: -790_000, label: '≈790,000 BP', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Controlled fire, evidenced by ${C.hearths}.`,
      note: 'Some researchers argue for controlled fire use over 1.5 million years ago; this anchor uses the firmer, hearth-based figure.' }),
  T('heat', 'Heat', 'thermal', 'j', 'Hold a thing to steady heat, not to burn it.', { cap: 'flame', any: ['dried_clay', 'copper', 'sand'] },
    'Steady heat can harden and melt.',
    { sortDs: -10_000, label: '≈10,000 BP (approximate)', kind: 'approximate', confidence: 'provisional',
      basis: 'Steady, non-destructive heat — kiln-grade control rather than an open flame — placed with early Neolithic ceramic/kiln practice; this is a coarser claim than "fire exists" (see Burn).' }),
  T('dry', 'Dry', 'thermal', 'y', 'Leave a thing to lose its water.', { any: ['shaped_clay', 'wet_clay'] },
    'Some things must lose their water before they can go further.',
    { sortDs: -9_000, label: 'Follows Shape', kind: 'derived', confidence: 'provisional',
      basis: 'Needs shaped or wet clay to exist first; passive air-drying leaves no trace of its own to date.' }),
  T('cool', 'Cool', 'thermal', 'l', 'Let a hot thing settle.', { any: ['molten_copper', 'poured_copper'] },
    'What was melted can be made to set.',
    { sortDs: -6_500, label: '≈6,500 BP', kind: 'derived', confidence: 'provisional',
      basis: `Needs molten copper to exist first; tied to ${C.copperSmelting}. Letting metal set has no separate archaeological signature of its own.` }),
  T('pour', 'Pour', 'thermal', 'z', 'Tip something molten or liquid into a shape.', { any: ['molten_copper'], cap: 'mold' },
    'Melted metal can take the shape of what holds it.',
    { sortDs: -6_000, label: '≈6,000 BP', kind: 'earliest_evidence', confidence: 'verified',
      basis: `Mould-casting molten copper, evidenced by ${C.moldCasting}. This is casting into a mould, not pouring a liquid generally.` }),
];

export const TECH_BY_ID: Record<ActionId, Technique> =
  Object.fromEntries(TECHNIQUES.map(t => [t.id, t])) as Record<ActionId, Technique>;

/** The catalogue, chronologically — the order Action Rail, hint copy and tests
 *  all read. `family` (below) is preserved for material logic and styling but
 *  no longer decides this order. */
export const TECH_ORDER: ActionId[] = sortTechniquesChronologically(TECHNIQUES).map(t => t.id);

/** Techniques of one family, in chronological order (family is a filter here, not a sort key). */
export const inFamily = (f: Family): Technique[] => TECH_ORDER.map(id => TECH_BY_ID[id]).filter(t => t.family === f);

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
