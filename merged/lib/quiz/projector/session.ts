/** Build the initial authoritative state of a projector match. Deterministic for a given (config, teams, pool). */
import './games';
import { initCore, moduleFor } from './engine';
import { planFor, poolKinds, type Plan } from './scale';
import type { GameState, PoolQuestion, ProjectorConfig, TeamRef } from './types';
import type { LearningFocus } from './types';

export const RULES_VERSION = 1;
export type SessionOpts = { lowPressure?: boolean; synchronized?: boolean };

export function createState(cfg: ProjectorConfig, teams: TeamRef[], pool: PoolQuestion[], opts: SessionOpts = {}): { state: GameState; plan: Plan } {
  const kinds = poolKinds(pool);
  const plan = planFor(cfg.game, cfg.minutes, teams.length, cfg.focus, kinds);
  const core = initCore(cfg.game, { seed: cfg.seed, focus: cfg.focus, lowPressure: !!opts.lowPressure, teams, turnBudget: plan.turnBudget, secondsPerTurn: plan.secondsPerTurn, askMode: opts.synchronized ? 'all' : 'single', pool, settings: cfg.settings, plan, mods: cfg.mods ?? [] });
  const g = moduleFor(cfg.game).init(core, { seed: cfg.seed, focus: cfg.focus as LearningFocus, lowPressure: !!opts.lowPressure, teams, turnBudget: plan.turnBudget, secondsPerTurn: plan.secondsPerTurn, askMode: core.askMode, pool, settings: cfg.settings, plan });
  const state: GameState = { core, g };
  moduleFor(cfg.game).onTurnStart?.(state);
  return { state, plan };
}
