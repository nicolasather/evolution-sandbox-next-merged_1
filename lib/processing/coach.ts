import { PROPERTY_WORDS, type MaterialClass, type Physics, type PropertyId } from './physics';

/* ============================================================================
   COACH — the words a hint is made of, decided by what a thing IS (its
   physics) and what the player has been doing. Pure text: the engine decides
   which piece and which route; this says it without saying the answer.

   Hint ladder (the engine climbs it only while the player stays stuck):

     1  vague       an era and a kind of thing
     2  material    what the pieces are like — a property, a riddle, or how a
                    piece behaves (varies by target, so hints are not one shape)
     3  action      the kind of work; leans on what has already been tried
     4  ghost       a faint hand shows the gesture on the piece (or, for an
                    assembly, how many pieces and what kinds)
     5  direct      the piece, named, and the action
   ========================================================================== */

/** The properties worth saying, most telling first. */
const SALIENT: PropertyId[] = ['fluid', 'plastic', 'flammable', 'absorbent', 'sharp', 'brittle', 'hard', 'heavy', 'loose', 'flexible', 'soft'];

const CLASS_WORD: Record<MaterialClass, string> = {
  mineral: 'stone-like', wood: 'woody', bone: 'bony', fibre: 'stringy', earth: 'earthy', liquid: 'runny', flame: 'fiery',
  metal: 'metallic', glass: 'glassy', made: 'made', living: 'living', abstract: 'abstract',
};

/** Two words for what a thing is like, from its physics. */
export function likeWords(ph: Physics): string[] {
  const words = SALIENT.filter(p => ph.properties.includes(p)).map(p => PROPERTY_WORDS[p]);
  return words.length ? words.slice(0, 2) : [CLASS_WORD[ph.materialClass]];
}

/** Level 2, third form: how the piece BEHAVES, not what it is. */
export function behaviourLine(ph: Physics): string | null {
  const has = (p: PropertyId) => ph.properties.includes(p);
  if (has('fluid')) return 'One of the pieces will not hold its own shape.';
  if (has('flammable')) return 'One of the pieces would catch fire easily.';
  if (has('plastic')) return 'One of the pieces is soft enough to take a shape.';
  if (has('absorbent')) return 'One of the pieces would drink water.';
  if (has('brittle')) return 'One of the pieces would break before it bent.';
  if (has('hard') && has('heavy')) return 'One of the pieces is hard, and would not give.';
  if (has('flexible')) return 'One of the pieces bends without breaking.';
  return null;
}

/** Level 2, first form. */
export function likeLine(ph: Physics, worked: boolean): string {
  const w = likeWords(ph);
  const what = w.length === 2 ? `${w[0]} and ${w[1]}` : w[0];
  return worked ? `Think of something ${what} — something that has been worked already.` : `Think of something ${what}.`;
}

/** Which of the three forms of a level-2 hint a target gets: stable per target, so it does not flicker. */
export function level2Form(targetId: string): 0 | 1 | 2 {
  let h = 0;
  for (let i = 0; i < targetId.length; i++) h = (h * 31 + targetId.charCodeAt(i)) >>> 0;
  return (h % 3) as 0 | 1 | 2;
}

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
