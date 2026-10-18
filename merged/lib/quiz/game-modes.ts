/** What each game mode is, in plain functional language. Rules about what it may be combined with live in compatibility.ts. */
import { allowedFlows, compatibleModifiers, gameModeSupports, type GameModeId, GAME_MODE_IDS } from './compatibility';
import { flowLabels, modifierLabels, type PlayMode } from './types';

export type GameModeInfo = {
  id: GameModeId; title: string; art: string; accent: string; summary: string;
  /** The core loop, one line per beat. A correct answer is never "just points": it drives the game. */
  loop: string[];
  facts: string[];
  /** What a wrong answer or a timeout does. */
  onWrong: string;
  ends: string;
};

export const GAME_MODES: Record<GameModeId, GameModeInfo> = {
  classic_quiz: {
    id: 'classic_quiz', title: 'Classic Quiz', art: '/quiz/art/game-classic.svg', accent: '#16C9EF',
    summary: 'Answer each question for points. The highest score when the questions or the clock run out wins.',
    loop: ['A question appears', 'Players answer before the timer ends', 'The answer is revealed and points are added'],
    facts: ['All five question formats', 'Points only'],
    onWrong: 'No points for that question.', ends: 'After the last question or when the match clock ends.',
  },
  tower_defense: {
    id: 'tower_defense', title: 'Tower Defense', art: '/quiz/art/game-tower.svg', accent: '#B5ED44',
    summary: 'Enemies walk a path toward your base. Every correct answer builds or upgrades a tower. Every miss lets enemies through.',
    loop: ['A wave of enemies starts down the path', 'You answer a question', 'Correct: a tower is built or upgraded and fires at the wave', 'Wrong or too slow: the wave reaches the base and costs health'],
    facts: ['Waves get harder', 'Health lost on misses', 'Towers stack'],
    onWrong: 'The wave reaches your base and you lose health.', ends: 'When health reaches zero, or after the final wave is survived.',
  },
  obstacle_survival: {
    id: 'obstacle_survival', title: 'Obstacle Survival', art: '/quiz/art/game-obstacle.svg', accent: '#FF386A',
    summary: 'Run a lane full of hurdles, spikes and saws. A correct answer clears the next hazard. A miss means you take the hit.',
    loop: ['The runner moves toward the next hazard', 'You answer a question', 'Correct: the hazard is cleared and you keep your speed', 'Wrong or too slow: you take a hit and slow down'],
    facts: ['Hit points', 'Speed builds with streaks', 'Hazards vary by seed'],
    onWrong: 'The runner is hit and loses a hit point.', ends: 'When hit points run out, or the finish line is reached.',
  },
  clue_racing: {
    id: 'clue_racing', title: 'Clue Racing', art: '/quiz/art/game-clue.svg', accent: '#8D5BFF',
    summary: 'Race along a track of checkpoints. Each correct answer moves you forward and reveals a piece of a hidden clue. Solve it early for a shortcut.',
    loop: ['You sit at a checkpoint', 'You answer a question', 'Correct: advance a checkpoint and uncover a clue piece', 'Wrong or too slow: you stall and the clue stays hidden'],
    facts: ['Checkpoints', 'Clue pieces', 'Positions shown live'],
    onWrong: 'You stall at the checkpoint.', ends: 'When someone crosses the finish line, or the match clock ends.',
  },
};

export const ALL_GAME_MODES: GameModeId[] = [...GAME_MODE_IDS];

export function gameModeDetail(id: GameModeId) {
  const info = GAME_MODES[id];
  const methods = (['solo', 'classroom', 'online'] as PlayMode[]).filter((m) => gameModeSupports(id, m));
  return {
    ...info,
    methods: methods.map((m) => ({
      method: m,
      flows: allowedFlows(m, id).map((f) => ({ flow: f, label: flowLabels[f], modifiers: compatibleModifiers(m, f, id).map((x) => modifierLabels[x]) })),
    })),
  };
}
