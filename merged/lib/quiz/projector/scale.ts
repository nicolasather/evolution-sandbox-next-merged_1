/** Duration → game scale. One honest, testable place that turns "15 minutes" into tiles, vaults, rooms, tiers and boss phases.
 *  Question demand is derived from time per assessed question, never from invented filler. */
import type { QuestionKind } from '../types';
import type { GameKey, LearningFocus, PoolQuestion } from './types';

export const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180] as const;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 180;
export const UNTIMED_TURNS = 24;

const KIND_SECONDS: Record<QuestionKind, number> = { multiple_choice: 40, truth_hunt: 55, answer_forge: 60, connection_rush: 70, fill_table: 80 };
const DISCUSS_SECONDS: Record<LearningFocus, number> = { study: 55, balanced: 30, game: 15 };
const ACTION_SECONDS = 15;

/** Average turn length. Pass the kinds of the quiz WITH duplicates (one entry per question): the average is then weighted by how often
 *  each kind really occurs, so a quiz of 39 Fill-the-Table questions and 1 Multiple Choice is planned as a Fill-the-Table lesson. */
export function secondsPerTurn(focus: LearningFocus, kinds: readonly QuestionKind[]): number {
  const avg = kinds.length ? kinds.reduce((a, k) => a + KIND_SECONDS[k], 0) / kinds.length : KIND_SECONDS.multiple_choice;
  return Math.round(avg + DISCUSS_SECONDS[focus] + ACTION_SECONDS);
}
/** One entry per ORIGINAL question (labelled repeats excluded), in pool order: the input `planFor` expects. */
export function poolKinds(pool: readonly PoolQuestion[]): QuestionKind[] {
  return pool.filter((p) => p.repeatOf === null).map((p) => p.kind);
}

export type DurationBand = 'blitz' | 'short' | 'standard' | 'long' | 'campaign';
export function bandFor(minutes: number | null): DurationBand {
  if (minutes === null) return 'standard';
  if (minutes <= 10) return 'blitz';
  if (minutes <= 20) return 'short';
  if (minutes <= 45) return 'standard';
  if (minutes <= 90) return 'long';
  return 'campaign';
}

export type Plan = {
  game: GameKey; minutes: number | null; band: DurationBand; teams: number;
  secondsPerTurn: number; turnBudget: number; turnsPerTeam: number; questionsNeeded: number;
  tiles: number; bossPhases: 1 | 2 | 3; escapeRooms: number; escapeMaxTier: 1 | 2 | 3; vaults: number; ladderTiers: number;
  notes: string[];
};

const TILE_SIZES = [9, 13, 19, 25, 31, 37];

export function clampMinutes(m: number): number { return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(m))); }

export function planFor(game: GameKey, minutesIn: number | null, teams: number, focus: LearningFocus, kinds: readonly QuestionKind[] = ['multiple_choice']): Plan {
  const minutes = minutesIn === null ? null : clampMinutes(minutesIn);
  const spt = secondsPerTurn(focus, kinds);
  const notes: string[] = [];
  let raw = minutes === null ? UNTIMED_TURNS : Math.floor((minutes * 60 * 0.9) / spt);
  if (game === 'risk_ladder') raw = Math.ceil(raw * 1.5); // banking turns need no question
  const floorTurns = Math.max(teams, 2);
  let budget = Math.max(raw, floorTurns);
  if (budget > raw && minutes !== null) notes.push('tooShortForTeams');
  budget = Math.ceil(budget / teams) * teams; // every team gets the same number of turns
  const turnsPerTeam = budget / teams;
  const m = minutes ?? 45;
  const wantTiles = m <= 10 ? 9 : m <= 20 ? 13 : m < 45 ? 19 : m < 60 ? 25 : 31;
  const tiles = TILE_SIZES.find((t) => t >= Math.max(wantTiles, teams * 3 + 1)) ?? 37;
  let bossPhases: 1 | 2 | 3 = m <= 10 ? 1 : m <= 20 ? 2 : 3;
  if (budget < 12 && bossPhases === 3) bossPhases = 2;
  if (budget < 7) bossPhases = 1;
  const roomsByTime = m <= 10 ? 1 : m <= 20 ? 2 : m <= 35 ? 3 : 4;
  const escapeMaxTier: 1 | 2 | 3 = m >= 45 ? 2 : 1;
  const vaultsByTime = m <= 10 ? 3 : m <= 20 ? 5 : m <= 35 ? 8 : m < 60 ? 10 : m <= 90 ? 14 : 16;
  const vaults = Math.max(2, Math.min(vaultsByTime, Math.floor(budget * 0.7)));
  const tiersByTime = m <= 10 ? 5 : m <= 20 ? 7 : m <= 35 ? 10 : m < 60 ? 12 : 15;
  const ladderTiers = Math.max(3, Math.min(tiersByTime, Math.round(turnsPerTeam * 0.85)));
  if (game === 'risk_ladder' && ladderTiers < tiersByTime) notes.push('ladderShortened');
  if (game === 'treasure_vault' && vaults < vaultsByTime) notes.push('vaultsReduced');
  return {
    game, minutes, band: bandFor(minutes), teams, secondsPerTurn: spt, turnBudget: budget, turnsPerTeam,
    questionsNeeded: Math.ceil(budget * 1.2), tiles, bossPhases, escapeRooms: roomsByTime, escapeMaxTier, vaults, ladderTiers, notes,
  };
}

export type PoolCheck = {
  ok: boolean; available: number; needed: number; shortage: number; repeatsNeeded: number; maxRepeatable: number;
  fitMinutes: number | null; flags: string[];
  topics: number; bands: { easy: number; medium: number; hard: number; unrated: number }; singleBand: boolean;
};

/** Honest preview: can this quiz fill this lesson? Never fabricates questions; a repeat cycle is offered only with explicit teacher consent. */
export function checkPool(plan: Plan, pool: readonly PoolQuestion[], focus: LearningFocus): PoolCheck {
  const originals = pool.filter((p) => p.repeatOf === null);
  const available = originals.length;
  const shortage = Math.max(0, plan.questionsNeeded - available);
  const maxRepeatable = available; // at most ONE extra cycle, always labelled as review
  const flags: string[] = [];
  const bands = { easy: 0, medium: 0, hard: 0, unrated: 0 };
  for (const p of originals) { if (p.difficultySource !== 'author' || p.difficulty === null) bands.unrated++; else if (p.difficulty === 1) bands.easy++; else if (p.difficulty === 2) bands.medium++; else bands.hard++; }
  const topics = new Set(originals.map((p) => p.topic).filter(Boolean)).size;
  const rated = bands.easy + bands.medium + bands.hard;
  const nonEmpty = [bands.easy, bands.medium, bands.hard].filter((n) => n > 0).length;
  const singleBand = rated === 0 || nonEmpty <= 1;
  if (shortage > 0) flags.push(shortage <= maxRepeatable ? 'needsRepeatCycle' : 'tooFewQuestions');
  if (plan.game === 'risk_ladder' && singleBand) flags.push('ladderSingleBand');
  if (plan.game === 'risk_ladder' && bands.hard === 0 && rated > 0) flags.push('ladderNoHard');
  if ((plan.game === 'empire_race' || plan.game === 'treasure_vault') && topics < 2) flags.push('fewTopics');
  if (plan.game === 'boss_battle' && plan.bossPhases === 3 && available < 8) flags.push('bossPhasesNeedMore');
  if (focus === 'study' && originals.some((p) => !p.hasExplanation)) flags.push('missingExplanations');
  let fitMinutes: number | null = null;
  if (shortage > 0) {
    const turns = Math.floor((available + (maxRepeatable > 0 ? 0 : 0)) / 1.2);
    fitMinutes = Math.max(MIN_MINUTES, Math.floor((turns * plan.secondsPerTurn) / 0.9 / 60 / 5) * 5);
  }
  return { ok: shortage === 0, available, needed: plan.questionsNeeded, shortage, repeatsNeeded: shortage, maxRepeatable, fitMinutes, flags, topics, bands, singleBand };
}
