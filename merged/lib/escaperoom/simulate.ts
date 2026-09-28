import type {
  CodePuzzle, EpisodeEvent, EpisodeState, EscapeRoomEpisode, MatchPuzzle, Puzzle, RatioPuzzle, SequencePuzzle,
} from './types';

/* ============================================================================
   EPISODE STATE MACHINE — pure, deterministic, same discipline as every
   other mode's simulation core. No hidden scoring, no punishment for a
   wrong guess beyond a neutral "not quite" — the puzzle is the point,
   not a timer or a fail state.
   ========================================================================== */

export type EscapeAction =
  | { kind: 'submitRatio'; puzzleId: string; value: number }
  | { kind: 'submitSequence'; puzzleId: string; order: string[] }
  | { kind: 'submitMatch'; puzzleId: string; matches: Record<string, string> }
  | { kind: 'submitCode'; puzzleId: string; code: string }
  | { kind: 'revealHint'; puzzleId: string };

export function blankState(episode: EscapeRoomEpisode): EpisodeState {
  return { episodeId: episode.id, solvedPuzzleIds: [], attempts: {}, hintsRevealed: {}, completed: false, log: [] };
}

function clone(s: EpisodeState): EpisodeState { return JSON.parse(JSON.stringify(s)); }

function findPuzzle(episode: EscapeRoomEpisode, id: string): Puzzle | undefined {
  return episode.puzzles.find(p => p.id === id);
}

function checkRatio(p: RatioPuzzle, value: number): boolean {
  return Math.abs(value - p.correctValue) <= p.tolerance;
}

function checkSequence(p: SequencePuzzle, order: string[]): boolean {
  return order.length === p.correctOrder.length && order.every((id, i) => id === p.correctOrder[i]);
}

function checkMatch(p: MatchPuzzle, matches: Record<string, string>): boolean {
  return p.items.every(item => matches[item.id] === p.correctMatch[item.id]);
}

function normalizeCode(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

function checkCode(p: CodePuzzle, code: string): boolean {
  return normalizeCode(code) === normalizeCode(p.correctCode);
}

export function applyAction(episode: EscapeRoomEpisode, input: EpisodeState, action: EscapeAction): { state: EpisodeState; events: EpisodeEvent[] } {
  const state = clone(input);
  const events: EpisodeEvent[] = [];
  const log = (text: string) => { events.push({ text }); state.log = [...state.log, { text }].slice(-40); };

  if (state.completed) { log('The door is already open.'); return { state, events }; }

  if (action.kind === 'revealHint') {
    state.hintsRevealed[action.puzzleId] = true;
    const p = findPuzzle(episode, action.puzzleId);
    log(p ? `Hint — ${p.title}: ${p.hint}` : 'Unknown station.');
    return { state, events };
  }

  const puzzle = findPuzzle(episode, action.puzzleId);
  if (!puzzle) { log('Unknown station.'); return { state, events }; }
  if (state.solvedPuzzleIds.includes(puzzle.id)) { log(`${puzzle.title} is already solved.`); return { state, events }; }

  if (puzzle.kind === 'code') {
    const missing = puzzle.requires.filter(id => !state.solvedPuzzleIds.includes(id));
    if (missing.length > 0) {
      log('The tray has empty slots still — solve the other stations first.');
      return { state, events };
    }
  }

  state.attempts[puzzle.id] = (state.attempts[puzzle.id] ?? 0) + 1;

  let correct = false;
  if (puzzle.kind === 'ratio' && action.kind === 'submitRatio') correct = checkRatio(puzzle, action.value);
  else if (puzzle.kind === 'sequence' && action.kind === 'submitSequence') correct = checkSequence(puzzle, action.order);
  else if (puzzle.kind === 'match' && action.kind === 'submitMatch') correct = checkMatch(puzzle, action.matches);
  else if (puzzle.kind === 'code' && action.kind === 'submitCode') correct = checkCode(puzzle, action.code);
  else { log('That does not fit this station.'); return { state, events }; }

  if (correct) {
    state.solvedPuzzleIds = [...state.solvedPuzzleIds, puzzle.id];
    if (puzzle.kind !== 'code') log(`${puzzle.title} solved — the tray takes a new mark: "${puzzle.unlockFragment}".`);
    else { log(`${puzzle.title} solved. ${episode.successText}`); state.completed = true; }
  } else {
    log('Not quite — look again.');
  }

  return { state, events };
}
