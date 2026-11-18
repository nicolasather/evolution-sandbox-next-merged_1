
/* ============================================================================
   COACH — the words a hint is made of, decided by what a thing IS (its
   physics) and what the player has been doing. Pure text: the engine decides
   which piece and which route; this says it without saying the answer.

   Hint ladder (the engine climbs it only while the player stays stuck):

     1  vague       an era and a kind of thing
     2  craft       the combination itself, named outright
     3  action      the kind of work; leans on what has already been tried
     4  ghost       a faint hand shows the gesture on the piece (or, for an
                    assembly, how many pieces and what kinds)
     5  direct      the piece, named, and the action
   ========================================================================== */

/** Level 3 for a way of working, leaning on what the player has already tried on that piece. */
export function actionLine(label: string, triedLabels: string[]): string {
  if (triedLabels.length) {
    const list = triedLabels.length === 1 ? triedLabels[0] : `${triedLabels.slice(0, -1).join(', ')} and ${triedLabels[triedLabels.length - 1]}`;
    return `You have tried ${list} on it. It answers to another kind of work: think ${label}.`;
  }
  return `This is done with your hands, not put together. Think: ${label}.`;
}

/** The nudge when the player has been stuck for a while and no hint is open — about how they are playing, not what to make. */
export function coachLine(o: { triedAnyWork: boolean; lockedLeft: number; failedInARow: number; stuckAfter: number }): string | null {
  if (o.failedInARow < o.stuckAfter) return null;
  if (!o.triedAnyWork) return 'Not everything is made by putting things together. Pick a technique and work one thing with your hands.';
  if (o.lockedLeft > 0) return 'There are ways of working things you have not found yet. Something you make may show you one.';
  return null;
}
