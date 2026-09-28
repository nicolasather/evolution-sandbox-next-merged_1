import type { Migratable } from '../save/types';

/* ============================================================================
   HISTORICAL ESCAPE ROOM — "Enter the Past". A fifth genuinely different
   interaction language: no procedural generation at all (unlike every
   other mode so far) — this is hand-authored content, reasoned through by
   understanding how a real historical process actually worked, using a
   generic, reusable puzzle-authoring schema (the brief's own requirement)
   rather than one bespoke React component per puzzle. A second episode
   is future work; this pass ships one real, complete one — see
   docs/ROADMAP-UNIVERSE.md's Phase 10 section.
   ========================================================================== */

export type PuzzleKind = 'ratio' | 'sequence' | 'match' | 'code';

interface PuzzleBase {
  id: string;
  kind: PuzzleKind;
  title: string;
  /** The station's scene-setting prompt — what the player is looking at. */
  prompt: string;
  /** Shown only after the player asks for it — never forced. */
  hint: string;
}

/** "What quantity/measure makes this actually work?" — checked within a
 *  tolerance, since real historical practice was never exact. */
export interface RatioPuzzle extends PuzzleBase {
  kind: 'ratio';
  unit: string;
  correctValue: number;
  tolerance: number;
  /** Revealed once solved — this puzzle's contribution to the final code. */
  unlockFragment: string;
}

/** "In what order did this real process actually happen?" */
export interface SequencePuzzle extends PuzzleBase {
  kind: 'sequence';
  steps: { id: string; text: string }[];
  correctOrder: string[];
  unlockFragment: string;
}

/** "Which real tool did which real job?" */
export interface MatchPuzzle extends PuzzleBase {
  kind: 'match';
  items: { id: string; label: string }[];
  targets: { id: string; label: string }[];
  /** itemId -> targetId */
  correctMatch: Record<string, string>;
  unlockFragment: string;
}

/** The exit: assemble what the other stations revealed into one code. */
export interface CodePuzzle extends PuzzleBase {
  kind: 'code';
  correctCode: string;
  /** Puzzle ids whose unlockFragment must be gathered before this one is
   *  even attemptable — the room's one real gate. */
  requires: string[];
}

export type Puzzle = RatioPuzzle | SequencePuzzle | MatchPuzzle | CodePuzzle;

export interface EscapeRoomEpisode {
  id: string;
  title: string;
  setting: string;
  introText: string;
  puzzles: Puzzle[];
  finalPuzzleId: string;
  successText: string;
}

export interface EpisodeEvent { text: string }

export interface EpisodeState {
  episodeId: string;
  solvedPuzzleIds: string[];
  attempts: Record<string, number>;
  hintsRevealed: Record<string, boolean>;
  completed: boolean;
  log: EpisodeEvent[];
}

export interface EscapeMemory {
  id: string;
  episodeId: string;
  totalAttempts: number;
  hintsUsed: number;
  headline: string;
  completedAt: number;
}

export interface EscapeRoomSave extends Migratable {
  v: 1;
  activeState: EpisodeState | null;
  memories: EscapeMemory[];
}
