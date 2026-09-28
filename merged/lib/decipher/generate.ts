import { createRng, type Rng } from '../seed';
import { drawAlphabet, NOUN_CONCEPTS, NUMBER_CONCEPTS } from './catalog';
import { NOUN_FREQUENCY_RANK } from './types';
import type {
  Anchor, DecipherPuzzle, Glyph, Inscription, NounConceptId, TemplateId,
} from './types';

/* ============================================================================
   PUZZLE GENERATION + SOLVABILITY VALIDATOR — same discipline as
   lib/techsudoku/generate.ts: build a candidate puzzle, then prove
   exhaustively (not just assume) that exactly one assignment of the six
   mystery noun-glyphs to the six noun concepts satisfies every constraint
   the player was actually given. Here that proof is cheap because the
   corpus is *built* to hit each concept's fixed target frequency exactly
   (see NOUN_FREQUENCY_RANK), which by construction makes the frequency
   count of a glyph across the corpus name it uniquely — the validator
   below is the honest check that this held, not a hidden extra rule.
   ========================================================================== */

const ANCHOR_NOTES: Record<NounConceptId, string> = {
  grain: 'Found beside sealed storage jars still holding carbonised grain — one recurring glyph nearby almost certainly names it.',
  water: 'Found near a lined cistern — one glyph appears on every jar associated with drawing water.',
  house: 'A boundary marker glyph, repeated at every threshold this tablet’s findspot shares with neighbouring structures.',
  cattle: 'Found alongside a tally of hoofprints in the same courtyard — one glyph recurs beside every such tally.',
  king: 'This glyph is the only one drawn inside a formal border on every tablet that also names an estate or a decree.',
  mountain: 'This glyph appears exactly once, on a boundary stone facing the only high ground for a day’s walk.',
};

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

export function validateSolvable(puzzle: DecipherPuzzle): { solvable: boolean; solution: Record<string, NounConceptId> | null } {
  const nounGlyphs = puzzle.glyphs.filter(g => g.role === 'noun');
  const freq: Record<string, number> = {};
  for (const g of nounGlyphs) freq[g.id] = 0;
  for (const insc of puzzle.inscriptions) {
    for (const gid of insc.glyphIds) if (gid in freq) freq[gid]++;
  }

  const glyphIds = nounGlyphs.map(g => g.id);
  const solutions: Record<string, NounConceptId>[] = [];
  for (const perm of permutations(NOUN_CONCEPTS)) {
    const assignment: Record<string, NounConceptId> = {};
    glyphIds.forEach((gid, i) => { assignment[gid] = perm[i]; });
    const freqOk = glyphIds.every(gid => freq[gid] === NOUN_FREQUENCY_RANK[assignment[gid]]);
    if (!freqOk) continue;
    const anchorOk = puzzle.anchors.every(a => !nounGlyphs.some(g => g.id === a.glyphId) || assignment[a.glyphId] === a.conceptId);
    if (!anchorOk) continue;
    solutions.push(assignment);
  }
  return { solvable: solutions.length === 1, solution: solutions.length === 1 ? solutions[0] : null };
}

function buildCorpus(rng: Rng, glyphOf: (id: string) => Glyph): Inscription[] {
  const remaining: Record<NounConceptId, number> = { ...NOUN_FREQUENCY_RANK };
  const inscriptions: Inscription[] = [];
  let seq = 0;
  const gid = (concept: string) => glyphOf(concept).id;

  while (Object.values(remaining).some(v => v > 0)) {
    const eligible = NOUN_CONCEPTS.filter(c => remaining[c] > 0);
    let template: TemplateId;
    let nouns: NounConceptId[];
    if (eligible.length === 1 || rng.chance(0.35)) {
      const c = eligible.length === 1 ? eligible[0] : rng.pick(eligible);
      template = rng.chance(0.5) ? 'noun-alone' : 'number-noun';
      nouns = [c];
    } else {
      nouns = rng.shuffle(eligible).slice(0, 2);
      template = rng.chance(0.5) ? 'noun-of-noun' : 'number-noun-of-noun';
    }
    nouns.forEach(c => { remaining[c] -= 1; });

    const glyphIds: string[] = [];
    if (template === 'number-noun') glyphIds.push(gid(rng.pick(NUMBER_CONCEPTS)), gid(nouns[0]));
    else if (template === 'noun-alone') glyphIds.push(gid(nouns[0]));
    else if (template === 'noun-of-noun') glyphIds.push(gid(nouns[0]), gid('of'), gid(nouns[1]));
    else glyphIds.push(gid(rng.pick(NUMBER_CONCEPTS)), gid(nouns[0]), gid('of'), gid(nouns[1]));

    inscriptions.push({ id: `insc_${seq++}`, template, glyphIds });
  }
  return rng.shuffle(inscriptions);
}

function buildGlyphs(rng: Rng): Glyph[] {
  const nounShapes = drawAlphabet(rng, NOUN_CONCEPTS.length, 4);
  const particleShapes = drawAlphabet(rng, 1, 2);
  return [
    ...NOUN_CONCEPTS.map((c, i) => ({ id: `glyph_${c}`, role: 'noun' as const, shape: nounShapes[i], conceptId: c })),
    ...NUMBER_CONCEPTS.map(c => ({ id: `glyph_${c}`, role: 'number' as const, shape: { strokes: [] }, conceptId: c })),
    { id: 'glyph_of', role: 'particle' as const, shape: particleShapes[0], conceptId: 'of' as const },
  ];
}

function buildPuzzle(seed: string, kind: 'tutorial' | 'procedural'): DecipherPuzzle {
  const rng = createRng(seed);
  for (let attempt = 0; attempt < 25; attempt++) {
    const glyphs = buildGlyphs(rng);
    const glyphOf = (concept: string) => glyphs.find(g => g.conceptId === concept)!;
    const inscriptions = buildCorpus(rng, glyphOf);
    const anchorConcept = rng.pick(NOUN_CONCEPTS);
    const anchors: Anchor[] = [{ glyphId: glyphOf(anchorConcept).id, conceptId: anchorConcept, note: ANCHOR_NOTES[anchorConcept] }];
    const puzzle: DecipherPuzzle = {
      id: `dec-${seed}-${attempt}`,
      kind,
      seed,
      glyphs,
      inscriptions,
      anchors,
      introText: 'A set of inventory tablets, in a script no one now reads. Each inscription lists what was counted, stored or owed — numbers and a recurring particle are already understood; six glyphs still name unknown things.',
    };
    if (validateSolvable(puzzle).solvable) return puzzle;
  }
  throw new Error('buildPuzzle: could not produce a solvable puzzle after 25 attempts');
}

export function generatePuzzle(seed: string): DecipherPuzzle {
  return buildPuzzle(seed, 'procedural');
}

/** The tutorial pins one specific seed as its canonical content — same
 *  validated generator, same six concepts every player learns on,
 *  overlaid with hand-authored step-by-step explanatory text (see
 *  lib/decipher/tutorial.ts) rather than a bespoke hand-typed corpus. */
export function generateTutorialPuzzle(): DecipherPuzzle {
  return buildPuzzle('decipher-tutorial-fixed', 'tutorial');
}
