import type { ActionId } from '../types';

/* ============================================================================
   KINDS — how each technique is PERFORMED. Twenty-five actions, but the hand
   has only a handful of things it can physically do: strike, sweep, draw a
   line, pull, scoop, go round, hold. Each action names the gesture it uses and
   tunes it (how many blows, how long a sweep, how many turns). Pure data: the
   gesture (lib/craft/gesture.ts) and the hand (lib/craft/hand.ts) read it.
   ========================================================================== */

export type GestureKind = 'brush' | 'smash' | 'cut' | 'separate' | 'dig' | 'circle' | 'hold';
/** The five poses the hand rig has. */
export type HandKind = 'brush' | 'smash' | 'cut' | 'separate' | 'dig';

export interface Tune {
  kind: GestureKind;
  /** smash: blows needed (default 2, 3 for hard things). */
  need?: number;
  /** brush / cut: how far to go, as a multiple of the usual. */
  reach?: number;
  /** brush: direction changes needed (default 2). */
  sweeps?: number;
  /** circle: full turns needed. */
  turns?: number;
  /** hold: seconds to hold. */
  secs?: number;
  /** smash: the shortest time between two blows, seconds (default 0.16). */
  gap?: number;
  /** What the player does, in a line. */
  how: string;
}

export const TUNE: Record<ActionId, Tune> = {
  brush:    { kind: 'brush',    how: 'Sweep back and forth' },
  smash:    { kind: 'smash',    how: 'Strike hard, once or twice' },
  cut:      { kind: 'cut',      how: 'Draw a line across it' },
  separate: { kind: 'separate', how: 'Pull apart from the middle' },
  dig:      { kind: 'dig',      how: 'Scoop down and out' },
  carve:    { kind: 'cut',      reach: 1.6, how: 'Draw a long, slow line' },
  scrape:   { kind: 'brush',    reach: 1.15, how: 'Drag across it, again and again' },
  grind:    { kind: 'brush',    reach: 2, how: 'Rub back and forth, longer' },
  pull:     { kind: 'separate', how: 'Take hold and draw it out' },
  twist:    { kind: 'circle',   turns: 1.25, how: 'Go round and round' },
  tie:      { kind: 'circle',   turns: 0.9, how: 'Loop once around it' },
  stretch:  { kind: 'separate', how: 'Take hold and draw it out, slowly' },
  mix:      { kind: 'circle',   turns: 1.6, how: 'Stir round and round' },
  shape:    { kind: 'brush',    reach: 1.5, sweeps: 3, how: 'Smooth it with long strokes' },
  pour:     { kind: 'dig',      how: 'Tip it out in one sweep' },
  heat:     { kind: 'hold',     secs: 2.6, how: 'Hold it to the heat' },
  cool:     { kind: 'hold',     secs: 1.8, how: 'Hold it and let it cool' },
  dry:      { kind: 'hold',     secs: 3.2, how: 'Hold it in the air and wait' },
  burn:     { kind: 'hold',     secs: 2.2, how: 'Hold it in the flame' },
  hammer:   { kind: 'smash',    need: 3, gap: 0.22, how: 'Strike, and strike again' },
  split:    { kind: 'smash',    need: 2, gap: 0.3, how: 'One firm blow along the grain' },
  press:    { kind: 'hold',     secs: 2, how: 'Press down and hold' },
  saw:      { kind: 'brush',    reach: 1.4, sweeps: 3, how: 'Draw back and forth in one line' },
  chisel:   { kind: 'smash',    need: 4, gap: 0.24, how: 'Tap, tap, tap along it' },
  polish:   { kind: 'brush',    reach: 2.2, sweeps: 4, how: 'Rub in long even strokes' },
};

export const kindOf = (a: ActionId): GestureKind => TUNE[a].kind;

/** Which of the five hand poses performs a gesture. */
export function handKindOf(a: ActionId): HandKind {
  const k = TUNE[a].kind;
  return k === 'circle' ? 'separate' : k === 'hold' ? 'dig' : k;
}
