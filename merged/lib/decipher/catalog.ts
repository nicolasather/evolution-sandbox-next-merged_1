import type { Rng } from '../seed';
import type { ConceptId, GlyphShape, NounConceptId, NumberConceptId, TemplateId } from './types';

/* ============================================================================
   VOCABULARY + GLYPH-SHAPE GENERATION — the fixed rules every Decipher
   puzzle shares. The six noun concepts and their frequency ranks
   (types.ts's NOUN_FREQUENCY_RANK) never change; what varies per seed is
   which invented shape stands for each one, and how the corpus of
   inscriptions is worded around them.
   ========================================================================== */

export const NOUN_CONCEPTS: NounConceptId[] = ['grain', 'water', 'house', 'cattle', 'king', 'mountain'];
export const NUMBER_CONCEPTS: NumberConceptId[] = ['one', 'two', 'three'];
export const NUMBER_VALUE: Record<NumberConceptId, number> = { one: 1, two: 2, three: 3 };

export const CONCEPT_GLOSS: Record<ConceptId, string> = {
  grain: 'grain', water: 'water', house: 'house', cattle: 'cattle', king: 'king', mountain: 'mountain',
  one: 'one', two: 'two', three: 'three', of: 'of',
};

/** How many noun slots a template fills, and with how many distinct
 *  nouns — used by the corpus generator to hit each concept's target
 *  frequency exactly. */
export const TEMPLATE_NOUN_SLOTS: Record<TemplateId, number> = {
  'number-noun': 1, 'noun-alone': 1, 'noun-of-noun': 2, 'number-noun-of-noun': 2,
};

/** A small fixed grid of anchor points strokes may connect — dense
 *  enough for visually varied invented glyphs, sparse enough that they
 *  stay legible at a glance. */
const POINTS: [number, number][] = [
  [0, 0], [2, 0], [4, 0],
  [0, 2], [2, 2], [4, 2],
  [0, 4], [2, 4], [4, 4],
];

function strokeKey(s: { x1: number; y1: number; x2: number; y2: number }): string {
  const a = `${s.x1},${s.y1}`; const b = `${s.x2},${s.y2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function shapeSignature(shape: GlyphShape): string {
  return shape.strokes.map(strokeKey).sort().join(';');
}

/** Draws one glyph as 2 (particles) or 3-5 (numbers unused here; nouns)
 *  distinct line strokes on the fixed point grid, rejecting a stroke
 *  that duplicates another in the same glyph. Callers dedupe across a
 *  whole alphabet via `shapeSignature`. */
function drawShape(rng: Rng, strokeCount: number): GlyphShape {
  const strokes: GlyphShape['strokes'] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (strokes.length < strokeCount && guard++ < 60) {
    const [x1, y1] = rng.pick(POINTS);
    const [x2, y2] = rng.pick(POINTS);
    if (x1 === x2 && y1 === y2) continue;
    const s = { x1, y1, x2, y2 };
    const key = strokeKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    strokes.push(s);
  }
  return { strokes };
}

/** Builds one glyph shape per noun concept (3-5 strokes, "content-word"
 *  weight) plus the fixed particle glyph (always exactly 2 strokes — a
 *  real, cross-linguistic tendency: grammatical particles are typically
 *  shorter than content words), rejecting any shape whose signature
 *  collides with one already drawn so every glyph in a puzzle reads as
 *  visually distinct. */
export function drawAlphabet(rng: Rng, count: number, strokeCount: number): GlyphShape[] {
  const shapes: GlyphShape[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (shapes.length < count && guard++ < 400) {
    const shape = drawShape(rng, strokeCount);
    const sig = shapeSignature(shape);
    if (shape.strokes.length < strokeCount || seen.has(sig)) continue;
    seen.add(sig);
    shapes.push(shape);
  }
  if (shapes.length < count) throw new Error('drawAlphabet: could not draw enough distinct glyph shapes');
  return shapes;
}
