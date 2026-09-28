import type { EscapeRoomEpisode } from '../types';

/* ============================================================================
   "THE FOUNDER'S WORKSHOP" — one complete, hand-authored episode. A late
   Bronze Age bronze-casting workshop, sealed for three thousand years and
   just reopened. Every puzzle answer is real, checkable history (bronze's
   working tin ratio, the real sequence of lost-wax casting, and the real
   function of a crucible and a tuyere) — the brief's "reason through how
   a historical mechanism actually worked", not an arbitrary lock.
   ========================================================================== */

export const BRONZE_WORKSHOP: EscapeRoomEpisode = {
  id: 'bronze-workshop',
  title: "The Founder's Workshop",
  setting: 'A Late Bronze Age foundry, sealed and undisturbed for three thousand years.',
  introText:
    'The door grinds open onto a workshop no one has stood in since before the Iron Age began. ' +
    'A cold hearth. A wall of tools, and a heavy bronze door at the far end that will not move. ' +
    'Whoever worked here left the answer to open it — in the tools themselves, and in how they were used.',
  puzzles: [
    {
      id: 'ratio',
      kind: 'ratio',
      title: 'The Alloy Bench',
      prompt:
        'A weighing scale sits beside two labelled bins: copper, and tin. A scrap of hide reads: ' +
        '"Too little of the grey metal, and the blade bends. Too much, and it shatters like pottery. ' +
        'Get the measure right, or the whole casting is wasted." What percentage of tin, by weight, ' +
        'gives bronze that is hard enough to hold an edge but not so brittle it cracks?',
      unit: '% tin',
      correctValue: 10,
      tolerance: 2,
      hint: 'Real Bronze Age bronze was overwhelmingly copper — roughly nine parts in ten. The tin is the smaller share, but far from a trace.',
      unlockFragment: '10',
    },
    {
      id: 'sequence',
      kind: 'sequence',
      title: "The Founder's Bench",
      prompt:
        'Five scraps of clay tablet, each describing one step of making a cast bronze figure, lie ' +
        'scattered out of order. Put them back in the order the founder actually worked.',
      // Deliberately NOT authored in their correct order — components/
      // escaperoom/EscapeRoomMode.tsx's SequenceStation shows steps in
      // this array's own order by default, so this order IS the puzzle's
      // starting arrangement; correctOrder below is the real answer.
      steps: [
        { id: 'pour', text: 'Pour molten bronze into the empty cavity the wax left behind.' },
        { id: 'break', text: 'Let it cool, then break the clay mould away to free the casting.' },
        { id: 'model', text: 'Carve the figure in wax, exactly as it should finally look.' },
        { id: 'meltout', text: 'Heat the whole mould until the wax inside melts and drains away.' },
        { id: 'mould', text: 'Pack the wax model in clay, left to harden into a mould around it.' },
      ],
      correctOrder: ['model', 'mould', 'meltout', 'pour', 'break'],
      hint: 'This is "lost-wax" casting — the name is the method. Something wax has to be lost before anything bronze can be poured.',
      unlockFragment: '5',
    },
    {
      id: 'match',
      kind: 'match',
      title: 'The Tool Wall',
      prompt:
        'Four tools hang on the wall, unlabelled. Match each to the job it actually did in this workshop.',
      items: [
        { id: 'crucible', label: 'A thick, bowl-shaped fired-clay vessel, scorched black inside.' },
        { id: 'tuyere', label: 'A narrow fired-clay pipe, one end badly charred.' },
        { id: 'ingotmould', label: 'A long stone block with shallow bar-shaped grooves cut into it.' },
        { id: 'anvil', label: 'A squat, heavy block of stone with a flattened, worn top face.' },
      ],
      targets: [
        { id: 'melt', label: 'Held the copper and tin while they were melted together over the fire.' },
        { id: 'air', label: 'Let a bellows force air into the fire, hot enough to melt bronze.' },
        { id: 'store', label: 'Cast surplus bronze into bars, easy to store, weigh and carry to trade.' },
        { id: 'finish', label: 'Gave a hard, flat surface to hammer and finish a casting once it had cooled.' },
      ],
      correctMatch: { crucible: 'melt', tuyere: 'air', ingotmould: 'store', anvil: 'finish' },
      hint: 'The scorched bowl held the metal. The charred pipe fed the fire the air it needed to get hot enough to melt it.',
      unlockFragment: 'CT',
    },
    {
      id: 'exit',
      kind: 'code',
      title: 'The Bronze Door',
      prompt:
        'A shallow tray beside the door holds three carved tallies, waiting to be set: the alloy ' +
        'measure, the count of steps in the casting, and the marks of the two tools that made the ' +
        'fire hot enough to melt metal. Set all three, in order, to open the door.',
      correctCode: '10-5-CT',
      requires: ['ratio', 'sequence', 'match'],
      hint: 'Enter what each of the other three stations already gave you, in the order you solved them here: measure, then count, then marks.',
    },
  ],
  finalPuzzleId: 'exit',
  successText:
    'The bronze door swings inward on a pivot no one has moved in three thousand years. Beyond it: ' +
    'nothing dramatic, just morning light on an empty room, and the quiet, real satisfaction of having ' +
    'actually worked out how someone did their job — not guessed a password, but reconstructed a process.',
};
