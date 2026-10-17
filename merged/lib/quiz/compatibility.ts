import type { Flow, Modifier, PlayMode } from './types';
import { MODIFIERS, modifierLabels } from './types';
import { AppError } from './errors';

/** Classic Quiz is the only game mode. Compatibility stays data-driven so future modes can register their own. */
export const CLASSIC_GAME_MODE = 'classic_quiz' as const;

export function allowedFlows(mode: PlayMode): Flow[] {
  return mode === 'classroom' ? ['synchronized', 'round_robin'] : mode === 'online' ? ['synchronized', 'independent'] : ['independent'];
}

export function defaultFlow(mode: PlayMode): Flow {
  return allowedFlows(mode)[0]!;
}

export type Availability = { ok: true } | { ok: false; reason: string };

/** Evaluated AFTER game + play method + flow, never before. */
export function modifierAvailability(mode: PlayMode, flow: Flow, modifier: Modifier): Availability {
  if (!allowedFlows(mode).includes(flow)) return { ok: false, reason: 'This question flow is not available for the chosen play method.' };
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

export function compatibleModifiers(mode: PlayMode, flow: Flow): Modifier[] {
  return MODIFIERS.filter((m) => modifierAvailability(mode, flow, m).ok);
}

export function assertCompatible(mode: PlayMode, flow: Flow, mods: Modifier[]) {
  if (!allowedFlows(mode).includes(flow)) throw new AppError('Unsupported question flow for the selected play method', 400);
  if (new Set(mods).size !== mods.length) throw new AppError('Duplicate modifier', 400);
  for (const m of mods) {
    const a = modifierAvailability(mode, flow, m);
    if (!a.ok) throw new AppError(`Incompatible modifier ${modifierLabels[m]}: ${a.reason}`, 400);
  }
}
