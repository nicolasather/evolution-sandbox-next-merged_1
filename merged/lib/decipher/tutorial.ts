import { generateTutorialPuzzle } from './generate';
import type { DecipherPuzzle } from './types';

/* ============================================================================
   TUTORIAL CHAPTER — hand-authored teaching scaffolding laid over one
   pinned, validated puzzle (see generate.ts's generateTutorialPuzzle).
   Every player sees the same tablets first, in the same order of
   reasoning, before ever meeting a procedural one. This is a deliberately
   scoped first chapter, not the "chapters" (plural) a fuller Decipher
   would eventually author — see docs/ROADMAP-UNIVERSE.md's Phase 9 notes.
   ========================================================================== */

const STEPS: string[] = [
  'These are inventory tablets — lists of what was counted, stored or owed. You already recognise two kinds of glyph: the tally-dot numbers, and one short, frequently repeated particle meaning “of”, marking possession (“house of the king”).',
  'Six other glyphs still hide their meaning: grain, water, house, cattle, king, and mountain. Every one of them is drawn the same way, every time it appears — the script is consistent, even if you cannot read it yet.',
  'Count how often each mystery glyph appears across every tablet below. In an inventory like this, the commodities that were stored and counted constantly — grain, water — turn up far more often than a one-time reference like a distant mountain.',
  'One glyph is already named for you, from context found alongside the tablets — use it to check your counting method actually works before trusting it for the rest.',
  'Assign a meaning to each mystery glyph using the palette below each tablet. “Check” tells you how many of the six you currently have right — never which ones — so keep reasoning from frequency, not trial and error.',
];

export function generateTutorial(): DecipherPuzzle {
  const puzzle = generateTutorialPuzzle();
  return { ...puzzle, tutorialSteps: STEPS };
}
