/* ============================================================================
   TARGET CATALOG — a small, curated shortlist of real, recognisable,
   genuinely deep discoveries from the actual 322-node database (verified
   at authoring time to have real depth and a real recipe) rather than
   letting the player pick any of the 322, most of which are too shallow
   for a satisfying decomposition run.
   ========================================================================== */

export interface ReverseTarget { id: string; blurb: string }

export const TARGETS: ReverseTarget[] = [
  { id: 'smartphone', blurb: 'A pocket computer, a radio, and thirty-one steps of real prerequisite depth behind it.' },
  { id: 'personal_computer', blurb: 'The machine on the desk — trace it back through what actually had to exist first.' },
  { id: 'microprocessor', blurb: 'A single chip, and a long real chain of chemistry and physics underneath it.' },
  { id: 'web_browser', blurb: 'The window onto the web — what two real things had to exist for it to exist at all?' },
  { id: 'video_game', blurb: 'Before the game itself: the graphics, the design discipline, and what those needed.' },
  { id: 'game_console', blurb: 'A video game and a personal computer, fused into one real object — then further back still.' },
  { id: 'grand_theft_auto_vi', blurb: 'The game’s own deepest discovery. Reaching it forward took the longest path in the whole timeline — this traces the same path back down.' },
];
