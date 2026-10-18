import type { Flow, Modifier, PlayMode } from './types';
import { MODIFIERS, modifierLabels } from './types';
import { AppError } from './errors';

/** Four genuinely different game modes. Play methods (solo / classroom / online) and question formats are NOT game modes. */
export const GAME_MODE_IDS = ['classic_quiz', 'tower_defense', 'obstacle_survival', 'clue_racing'] as const;
export type GameModeId = (typeof GAME_MODE_IDS)[number];
export const CLASSIC_GAME_MODE: GameModeId = 'classic_quiz';
export const isGameModeId = (x: unknown): x is GameModeId => typeof x === 'string' && (GAME_MODE_IDS as readonly string[]).includes(x);

/** Which flows each game mode can run for each play method. Data-driven: client UI and server validation read this one table. */
const FLOWS: Record<GameModeId, Record<PlayMode, Flow[]>> = {
  classic_quiz:      { solo: ['independent'], classroom: ['synchronized', 'round_robin'], online: ['synchronized', 'independent'] },
  tower_defense:     { solo: ['independent'], classroom: ['synchronized', 'round_robin'], online: ['synchronized', 'independent'] },
  // Survival is a run: taking turns on one shared lane makes no sense, so classroom teams run side by side.
  obstacle_survival: { solo: ['independent'], classroom: ['synchronized'], online: ['synchronized', 'independent'] },
  clue_racing:       { solo: ['independent'], classroom: ['synchronized', 'round_robin'], online: ['synchronized', 'independent'] },
};

/** Modifiers a game mode refuses outright, with the reason shown to the creator. */
const MODE_BLOCKS: Partial<Record<GameModeId, Partial<Record<Modifier, string>>>> = {
  obstacle_survival: {
    give_points: 'Eliminated runners cannot receive points, so handing points over is not available in Obstacle Survival.',
    swap_points: 'Swapping scores would let an eliminated runner trade places with a survivor.',
  },
};

export function gameModeSupports(mode: GameModeId, method: PlayMode): boolean {
  return FLOWS[mode][method].length > 0;
}

export function allowedFlows(mode: PlayMode, gameMode: GameModeId = CLASSIC_GAME_MODE): Flow[] {
  return FLOWS[gameMode][mode];
}

export function defaultFlow(mode: PlayMode, gameMode: GameModeId = CLASSIC_GAME_MODE): Flow {
  return allowedFlows(mode, gameMode)[0]!;
}

export type Availability = { ok: true } | { ok: false; reason: string };

/** Evaluated AFTER game mode + play method + flow, never before. */
export function modifierAvailability(mode: PlayMode, flow: Flow, modifier: Modifier, gameMode: GameModeId = CLASSIC_GAME_MODE): Availability {
  if (!allowedFlows(mode, gameMode).includes(flow)) return { ok: false, reason: 'This question flow is not available for the chosen play method.' };
  const blocked = MODE_BLOCKS[gameMode]?.[modifier];
  if (blocked) return { ok: false, reason: blocked };
  switch (modifier) {
    case 'limited_slots':
      return flow === 'synchronized' ? { ok: true } : { ok: false, reason: 'Needs one shared question at a time — choose a synchronized flow.' };
    case 'steal_question':
      return mode === 'classroom' && flow === 'round_robin' ? { ok: true } : { ok: false, reason: 'Needs team turns — only Classroom with round robin.' };
    case 'lose_all':
    case 'go_to_first':
    case 'steal_points':
    case 'give_points':
    case 'swap_points':
      return mode === 'solo' ? { ok: false, reason: 'Needs opponents — not available in solo play.' } : { ok: true };
    case 'secret_wager':
    case 'potluck':
      return { ok: true };
  }
}

export function compatibleModifiers(mode: PlayMode, flow: Flow, gameMode: GameModeId = CLASSIC_GAME_MODE): Modifier[] {
  return MODIFIERS.filter((m) => modifierAvailability(mode, flow, m, gameMode).ok);
}

export function assertCompatible(mode: PlayMode, flow: Flow, mods: Modifier[], gameMode: GameModeId = CLASSIC_GAME_MODE) {
  if (!allowedFlows(mode, gameMode).includes(flow)) throw new AppError('Unsupported question flow for the selected play method', 400);
  if (new Set(mods).size !== mods.length) throw new AppError('Duplicate modifier', 400);
  for (const m of mods) {
    const a = modifierAvailability(mode, flow, m, gameMode);
    if (!a.ok) throw new AppError(`Incompatible modifier ${modifierLabels[m]}: ${a.reason}`, 400);
  }
}
