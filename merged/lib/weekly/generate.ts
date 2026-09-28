import type { Db } from '../types';
import type { Rng } from '../seed';
import { weeklyKey, weeklyRng } from '../seed';
import { type ModifierKind } from '../minpath/modifiers';
import { pickVariantChallenge } from '../minpath/variantChallenge';
import { generatePuzzle } from '../techsudoku/generate';
import { riddleOf } from './riddle';
import { SCENARIOS } from './scenarios';
import type { GauntletClue, GauntletStage, SudokuStage, TraceStage, WeeklyChallenge } from './types';

/* ============================================================================
   WEEKLY MEGA CHALLENGE — GENERATION. Every stage is namespaced under its
   own `weekly-*` seed family (lib/seed.ts's weeklyRng), so this week's trace
   modifier, sudoku puzzle and gauntlet riddles are each independently
   deterministic — the same for every player, stable across reloads, and
   never sharing a random sequence with the daily/practice versions of the
   same underlying systems.
   ========================================================================== */

const MODIFIER_KINDS: ModifierKind[] = ['no-backtracking', 'chronological-only', 'exactly-n-clicks', 'visit-an-era'];

function buildGauntlet(db: Pick<Db, 'nodes'>, rng: Rng): GauntletStage | null {
  const eligible = db.nodes.filter(n => !n.hidden && !n.primitive && n.l1 && n.n);
  if (eligible.length < 12) return null; // three targets, each needs 3 real distractors, no reuse

  const chosen = rng.shuffle(eligible).slice(0, 3);
  const usedIds = new Set(chosen.map(n => n.id));
  const clues: GauntletClue[] = [];
  for (const target of chosen) {
    const sameEra = eligible.filter(n => n.era === target.era && !usedIds.has(n.id));
    const pool = sameEra.length >= 3 ? sameEra : eligible.filter(n => !usedIds.has(n.id));
    const distractors = rng.shuffle(pool).slice(0, 3);
    const optionIds = rng.shuffle([target.id, ...distractors.map(d => d.id)]);
    clues.push({ targetId: target.id, riddle: riddleOf(target), optionIds });
  }
  return { kind: 'gauntlet', clues };
}

/** This week's challenge, or null if the database is too small to build it
 *  (never happens against the real 322-node database — only a concern for a
 *  tiny test fixture). Fully deterministic and side-effect-free: safe to
 *  call on every render, exactly like lib/minpath/daily.ts's dailyChallenge. */
export function generateWeeklyChallenge(db: Pick<Db, 'nodes'>, date: Date = new Date()): WeeklyChallenge | null {
  const week = weeklyKey(date);
  const scenario = weeklyRng('weekly-scenario', date).pick(SCENARIOS);

  const traceModifierKind = weeklyRng('weekly-trace-kind', date).pick(MODIFIER_KINDS);
  const trace = pickVariantChallenge(db, weeklyRng('weekly-trace', date), traceModifierKind);
  if (!trace) return null;

  const puzzle = generatePuzzle(db, weeklyRng('weekly-sudoku', date));
  if (!puzzle) return null;

  const gauntlet = buildGauntlet(db, weeklyRng('weekly-gauntlet', date));
  if (!gauntlet) return null;

  const traceStage: TraceStage = {
    kind: 'trace', startId: trace.startId, targetId: trace.targetId, modifier: trace.modifier, optimalLength: trace.optimalLength,
  };
  const sudokuStage: SudokuStage = { kind: 'sudoku', puzzle };

  return { week, scenario, stages: [traceStage, sudokuStage, gauntlet] };
}
