/** Teacher score adjustments as pure state, so the quick bar, the log and undo all follow one rule.
 *  The server does not store these yet: this state lives in the teacher's console until the backend endpoint is approved. */

export const OVERRIDE_PRESETS = [50, 100, 250, 500, -50, -100] as const;
export const OVERRIDE_REASONS = ['Bonus Insight', 'Partial Credit', 'Teamwork'] as const;
export const CLASS_WIDE_REASON = 'Class-Wide Bonus';
export const MAX_OVERRIDE = 10_000;

export type OverrideEntry = {
  id: string;
  studentIds: string[];
  delta: number;
  reason: string;
  at: number;
  undone: boolean;
};

export type OverrideState = {
  /** Total teacher adjustment per student. Shown on top of the student's earned score. */
  adjust: Record<string, number>;
  /** Newest first. */
  log: OverrideEntry[];
};

export const OVERRIDE_START: OverrideState = { adjust: {}, log: [] };

/** Whole, non-zero points within the cap. Anything else is rejected before it reaches the state. */
export function isValidDelta(n: number): boolean {
  return Number.isInteger(n) && n !== 0 && Math.abs(n) <= MAX_OVERRIDE;
}

export function applyOverride(s: OverrideState, entry: Omit<OverrideEntry, 'undone'>): OverrideState {
  if (!isValidDelta(entry.delta) || entry.studentIds.length === 0) return s;
  const adjust = { ...s.adjust };
  for (const id of entry.studentIds) adjust[id] = (adjust[id] ?? 0) + entry.delta;
  return { adjust, log: [{ ...entry, undone: false }, ...s.log] };
}

/** Reverses one entry once. Undoing an entry twice does nothing. */
export function undoOverride(s: OverrideState, entryId: string): OverrideState {
  const target = s.log.find((e) => e.id === entryId);
  if (!target || target.undone) return s;
  const adjust = { ...s.adjust };
  for (const id of target.studentIds) adjust[id] = (adjust[id] ?? 0) - target.delta;
  return {
    adjust,
    log: s.log.map((e) => (e.id === entryId ? { ...e, undone: true } : e)),
  };
}

/** Earned points plus the teacher's adjustment, for the leaderboard sort. */
export function adjustedScore(earned: number, s: OverrideState, studentId: string): number {
  return earned + (s.adjust[studentId] ?? 0);
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
