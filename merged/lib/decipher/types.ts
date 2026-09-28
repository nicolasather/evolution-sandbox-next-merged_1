import type { Migratable } from '../save/types';

/* ============================================================================
   DECIPHER — "Read the Lost". A fourth genuinely different interaction
   language: no crafting, no allocation, no spatial grid, no excavation
   budgets. The player is given a fixed corpus of short inscriptions in an
   invented writing system and has to work out which invented glyph means
   which real-world concept, using exactly the kind of evidence real
   epigraphy actually uses — a handful of directly-given context anchors,
   and each glyph's own frequency across the corpus (administrative/
   inventory texts, the genre this mode always generates, give common
   commodities a far higher sign-frequency than rare, name-like
   references — the same reasoning Kober and Ventris actually used on
   Linear B). See docs/ROADMAP-UNIVERSE.md's Phase 9 section for what this
   slice does and does not attempt.

   Every puzzle is procedurally generated and entirely fictional — an
   invented script for an invented culture, never a real one. See
   lib/museum/types.ts's ExhibitProvenance.
   ========================================================================== */

export type GlyphRole = 'noun' | 'number' | 'particle';

/** The six mystery concepts every puzzle uses, in a fixed, honest
 *  frequency order (rank 6 = appears most often in an inventory text,
 *  rank 1 = rarest) — this ordering is a property of the *concept*, not
 *  the puzzle, so it is a genuinely learnable, consistent rule across
 *  every generated puzzle, the same way a logic-puzzle genre's rules
 *  stay fixed while its instances vary. */
export type NounConceptId = 'grain' | 'water' | 'house' | 'cattle' | 'king' | 'mountain';

export const NOUN_FREQUENCY_RANK: Record<NounConceptId, number> = {
  grain: 6, water: 5, house: 4, cattle: 3, king: 2, mountain: 1,
};

export type NumberConceptId = 'one' | 'two' | 'three';
export type ConceptId = NounConceptId | NumberConceptId | 'of';

export interface GlyphStroke { x1: number; y1: number; x2: number; y2: number }
export interface GlyphShape { strokes: GlyphStroke[] }

export interface Glyph {
  id: string;
  role: GlyphRole;
  shape: GlyphShape;
  /** Ground truth — never read by the UI for rendering, only by the
   *  scoring/validation functions and the reveal path. */
  conceptId: ConceptId;
}

export type TemplateId = 'number-noun' | 'noun-of-noun' | 'noun-alone' | 'number-noun-of-noun';

/** One inscription: an ordered sequence of glyph ids. `template` is kept
 *  alongside for the tutorial's explanatory copy; the corpus itself
 *  carries no other hidden structure the solver could exploit beyond
 *  what a player can also see (glyph shapes, order, and repetition). */
export interface Inscription {
  id: string;
  template: TemplateId;
  glyphIds: string[];
}

export interface Anchor {
  glyphId: string;
  conceptId: ConceptId;
  /** The in-fiction reason this one glyph is already known — always a
   *  plausible, honestly-labelled context clue (a findspot, an
   *  iconographic pairing), never "because the answer key says so". */
  note: string;
}

export interface DecipherPuzzle {
  id: string;
  kind: 'tutorial' | 'procedural';
  seed?: string;
  glyphs: Glyph[];
  inscriptions: Inscription[];
  anchors: Anchor[];
  /** Tutorial-only: a short ordered sequence of explanatory beats shown
   *  alongside the corpus, teaching the frequency+anchor method step by
   *  step. Absent for procedural puzzles, which trust the player to
   *  apply what the tutorial taught. */
  tutorialSteps?: string[];
  introText: string;
}

export interface DecipherAttempt {
  puzzleId: string;
  /** Player's current guess per NOUN glyph id only — numbers and the
   *  particle are always given, never part of the puzzle. A bijection is
   *  enforced by lib/decipher/simulate.ts's assignGlyph, exactly like a
   *  cryptogram: assigning a concept to a new glyph clears it from
   *  wherever it was previously assigned. */
  assignments: Record<string, NounConceptId | null>;
  checksUsed: number;
  solved: boolean;
  revealedAnswer: boolean;
}

export interface DecipherMemory {
  id: string;
  puzzleId: string;
  seed?: string;
  outcome: 'solved' | 'revealed';
  checksUsed: number;
  headline: string;
  completedAt: number;
}

export interface DecipherSave extends Migratable {
  v: 1;
  activePuzzle: DecipherPuzzle | null;
  activeAttempt: DecipherAttempt | null;
  tutorialCompleted: boolean;
  memories: DecipherMemory[];
}
