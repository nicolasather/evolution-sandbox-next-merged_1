import type { PathModifier } from '../minpath/modifiers';
import type { Migratable } from '../save/types';
import type { TechSudokuPuzzle } from '../techsudoku/generate';

/* ============================================================================
   WEEKLY MEGA CHALLENGE — three real stages, drawn from three already-built,
   already-validated systems (Minimum Path's variant modifiers, Tech Sudoku,
   and a new multiple-choice riddle gauntlet), wrapped in one authored
   scenario identity that changes with the ISO week (lib/seed.ts's
   `weeklyKey`/`weeklyRng`). Nothing here duplicates those systems' own
   generation logic — lib/weekly/generate.ts calls straight into
   pickVariantChallenge and generatePuzzle, namespaced under the
   `weekly-*` seed families so a week's content is stable no matter how
   many times it's regenerated, but independent of the daily/practice
   families those modes use on their own screens.
   ========================================================================== */

export interface WeeklyScenario {
  id: string;
  title: string;
  blurb: string;
}

export interface TraceStage {
  kind: 'trace';
  startId: string;
  targetId: string;
  modifier: PathModifier;
  optimalLength: number;
}

export interface SudokuStage {
  kind: 'sudoku';
  puzzle: TechSudokuPuzzle;
}

export interface GauntletClue {
  targetId: string;
  /** The target's own name (and every word of it) blanked out of its
   *  description — see lib/weekly/riddle.ts. */
  riddle: string;
  /** Includes targetId exactly once, shuffled. */
  optionIds: string[];
}

export interface GauntletStage {
  kind: 'gauntlet';
  /** Exactly three, each about a different real discovery. */
  clues: GauntletClue[];
}

/** Fixed order — trace, then sudoku, then the gauntlet — same every week;
 *  only the content within each stage changes. */
export interface WeeklyChallenge {
  week: string;
  scenario: WeeklyScenario;
  stages: [TraceStage, SudokuStage, GauntletStage];
}

/** How far into *this* week's three stages the player has gotten. Nothing
 *  about an in-progress stage's own clicks/order/answers is persisted —
 *  only completed stages, same as every other mode never persists an
 *  active run's minute-by-minute state, only what's been filed. A stage is
 *  only ever completed in order (see lib/weekly/simulate.ts's guards). */
export interface WeeklyProgress {
  week: string;
  completedStages: 0 | 1 | 2 | 3;
  stageResults: {
    trace?: { clicks: number };
    sudoku?: { checks: number };
    gauntlet?: { correct: number };
  };
  /** Set only once completedStages reaches 3. */
  finishedAt: number | null;
}

export interface WeeklyHistoryEntry {
  week: string;
  scenarioId: string;
  finishedAt: number;
}

export interface WeeklySave extends Migratable {
  v: 1;
  current: WeeklyProgress | null;
  /** Past finished weeks, most recent first, capped. */
  history: WeeklyHistoryEntry[];
}
