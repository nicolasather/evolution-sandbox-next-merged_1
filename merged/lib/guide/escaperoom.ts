import type { EpisodeState, EscapeRoomEpisode } from '@/lib/escaperoom/types';
import type { GuideStep } from './types';

/* ESCAPE ROOM GUIDE — points at the next unsolved station (the exit door only once it can open). */

export const ESCAPE_MODE = 'escape-room';
export const ER_TARGET = { station: (id: string) => `er-station:${id}` } as const;

export interface EscapeGuide { step: GuideStep | null; finished: boolean; eligible: boolean }

export function escapeRoomGuide(episode: EscapeRoomEpisode, state: EpisodeState, hasFinishedBefore: boolean): EscapeGuide {
  const eligible = !hasFinishedBefore;
  if (state.completed) return { step: null, finished: true, eligible };
  const solved = new Set(state.solvedPuzzleIds);
  const open = episode.puzzles.filter(p => !solved.has(p.id) && p.id !== episode.finalPuzzleId);
  const target = open[0] ?? episode.puzzles.find(p => p.id === episode.finalPuzzleId);
  if (!target) return { step: null, finished: false, eligible };
  const isExit = target.id === episode.finalPuzzleId;
  const tried = (state.attempts[target.id] ?? 0) > 0;
  const hinted = !!state.hintsRevealed[target.id];
  if (isExit) {
    return { eligible, finished: false, step: { id: `exit:${tried ? 't' : 'n'}`, text: 'ENTER THE DOOR CODE', targets: [ER_TARGET.station(target.id)], detail: 'Every station you solved revealed a piece of the code. Put the pieces together.' } };
  }
  if (tried && !hinted) {
    return { eligible, finished: false, step: { id: `retry:${target.id}`, text: 'TRY AGAIN OR ASK FOR A HINT', targets: [ER_TARGET.station(target.id)], detail: 'A wrong answer costs nothing. "Show a hint" is always available.' } };
  }
  return { eligible, finished: false, step: { id: `station:${target.id}`, text: 'SOLVE THIS STATION', targets: [ER_TARGET.station(target.id)], detail: 'Read the prompt, answer it, and press the submit button. Stations can be solved in any order; the exit door opens after the others.' } };
}
