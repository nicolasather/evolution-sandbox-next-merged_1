import { getMode } from '@/lib/modes/registry';
import type { SceneId } from './scenes';

/* ============================================================================
   SLIDES — the words that used to sit in a block on each screen, cut into
   one-idea-per-screen slides. They play after the opening title, on Space:

       title (10 s)  →  slide 1  →  slide 2  →  …  →  the real screen

   Nothing is dropped: the sentences are the ones the screens already carried
   (Graph's "Every discovery, by era…", Museum's provenance note, Trade's
   explanation, and so on), split at their natural seams. Minimum Path gets its rules here,
   then plays as its own deck (components/minpath). Modes take theirs
   from lib/modes/registry.ts so the wording can never drift from the Hub card.
   ========================================================================== */

const STATIC: Partial<Record<SceneId, string[]>> = {
  work: [
    'Put things on the ground.',
    'Bring two or more together — or take up a technique and work one.',
    'There are ways of working things you have not found yet. Something you make may show you one.',
  ],
  graph: [
    'Every discovery, by era.',
    'Open one to trace where it came from, and what it led to.',
    'Unfound entries stay unnamed.',
    'Faint means not found yet. ??? is something you could make now.',
  ],
  arch: [
    'Undiscovered entries stay closed: no names, no recipes.',
    'Entries marked source required have no verified subject-level source yet — and none is invented.',
  ],
  time: [
    'Your finds, oldest to newest, by their real recorded date.',
    'Spacing is ordinal, not to scale.',
  ],
  hub: [
    'One coherent universe of discoveries, artifacts and history — entered here, one wing at a time.',
    'Slide along the bar to move from one wing to the next.',
    'Other wings of this museum are in active development. They will open here, alongside these, as each is finished.',
  ],
  museum: [
    'Every major invention you have reached, every camp your Survival runs left behind, every settlement your Civilization runs grew.',
    'Every report your Archaeologist digs filed, every tablet set your Decipher runs read, every Escape Room episode you have opened.',
    'Every field report your Alien Archaeology sites produced, and every discovery your Reverse Evolution runs traced back to its origins.',
    'All of it reconstructed and labelled — never claimed as the object or event itself.',
  ],
  trade: [
    'Discoveries no longer exist everywhere at once. Each one first appears where the record actually places it.',
    'Everywhere else has to reach it by trade, one corridor at a time.',
    'This is an optional layer on top of Main Evolution. It never removes a discovery you already have.',
  ],
  lab: [
    'Heating a material changes its internal structure, not just its temperature.',
    'But how much heat, and for how long, matters. Try a few combinations and watch what actually happens.',
  ],
  minpath: [
    'Click from the start to the target through real connections only.',
    'Fewest clicks wins.',
    'The shortest possible length stays hidden until you arrive.',
  ],
  journal: ['A personal recap of your journey so far.'],
  world: ['Your progress, by era, by region, and by globe reveal.'],
};

/** The slides for a scene ([] = go straight to the screen). */
export function slidesOf(id: SceneId): string[] {
  const fixed = STATIC[id];
  if (fixed) return fixed;
  const mode = getMode(id);
  if (mode) {
    return [
      `${mode.subtitle}.`,
      mode.description,
      'Your progress here is saved apart from every other mode.',
    ];
  }
  return [];
}
