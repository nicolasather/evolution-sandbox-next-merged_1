/** Deterministic game engines for the three action game modes.
 *
 *  The server grades every answer and stays the only source of points (commit_answer). These engines never decide who is right:
 *  they turn the ordered list of graded results (correct / wrong / timed out) into game state, so the same log always yields the
 *  same state on a phone, on the projector, in a replay, and in a test. Points are the only currency; nothing here spends them. */
import type { GameModeId } from '../compatibility';
import type { GameOptions } from '../settings';

export type Result = { correct: boolean; timedOut?: boolean };
export type Outcome = 'playing' | 'won' | 'lost';
export type Pace = GameOptions['pace'];

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Seeded random in [0,1) for step `i`: independent per step, so replaying any prefix is stable. */
export function rand(seed: string, i: number, salt = ''): number {
  const a = (hash32(`${seed}:${salt}:${i}`) + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const paceFactor: Record<Pace, number> = { relaxed: 0.6, normal: 1, fast: 1.5 };

/* ────────────────────────── Tower Defense ────────────────────────── */
export type EnemyKind = 'grunt' | 'brute' | 'swarm';
export const enemyStrength: Record<EnemyKind, number> = { grunt: 1, brute: 2, swarm: 1.5 };
export type TowerDefenseState = {
  mode: 'tower_defense';
  wave: number; lives: number; maxLives: number;
  /** towers on the path (max 8) and total upgrade levels beyond that */
  towers: number; upgrades: number;
  defeated: number; leaked: number;
  /** the wave the player is about to face */
  nextEnemy: EnemyKind; nextStrength: number;
  outcome: Outcome; last: null | { kind: 'built' | 'upgraded' | 'leak'; amount: number; enemy: EnemyKind };
};
const MAX_TOWERS = 8;
const enemyFor = (seed: string, wave: number): EnemyKind => { const r = rand(seed, wave, 'enemy'); return r < 0.45 ? 'grunt' : r < 0.75 ? 'swarm' : 'brute'; };
export const waveStrength = (seed: string, wave: number, pace: Pace) => Math.max(1, Math.round(enemyStrength[enemyFor(seed, wave)] * (1 + wave * 0.18 * paceFactor[pace])));
export const towerPower = (s: Pick<TowerDefenseState, 'towers' | 'upgrades'>) => s.towers + s.upgrades;

/* ────────────────────────── Obstacle Survival ────────────────────────── */
export type HazardKind = 'hurdle' | 'spikes' | 'saw';
export const hazardDamage: Record<HazardKind, number> = { hurdle: 1, spikes: 1, saw: 2 };
export type ObstacleState = {
  mode: 'obstacle_survival';
  step: number; hp: number; maxHp: number; streak: number; best: number;
  cleared: number; hits: number;
  /** distance in lane units; the finish line is `total` */
  distance: number; speed: number;
  nextHazard: HazardKind;
  outcome: Outcome; last: null | { kind: 'cleared' | 'hit'; hazard: HazardKind; damage: number };
};
export const hazardFor = (seed: string, step: number): HazardKind => { const r = rand(seed, step, 'hazard'); return r < 0.4 ? 'hurdle' : r < 0.75 ? 'spikes' : 'saw'; };

/* ────────────────────────── Clue Racing ────────────────────────── */
export type ClueState = {
  mode: 'clue_racing';
  step: number; position: number; trackLength: number; streak: number; stalls: number;
  /** indexes of the picture tiles uncovered so far, in the order they were won */
  revealed: number[];
  /** finish step (0-based question index) when the line was crossed, for race ordering */
  finishedAt: number | null;
  outcome: Outcome; last: null | { kind: 'advanced' | 'boosted' | 'stalled'; moved: number };
};

export type GameState = TowerDefenseState | ObstacleState | ClueState;
export type ActionMode = Exclude<GameModeId, 'classic_quiz'>;
export const isActionMode = (m: GameModeId): m is ActionMode => m !== 'classic_quiz';

export type EngineConfig = { mode: ActionMode; options: GameOptions; seed: string; totalQuestions: number };

export function initGame(cfg: EngineConfig): GameState {
  const { mode, options, seed } = cfg;
  if (mode === 'tower_defense') {
    return { mode, wave: 0, lives: options.lives, maxLives: options.lives, towers: 0, upgrades: 0, defeated: 0, leaked: 0,
      nextEnemy: enemyFor(seed, 0), nextStrength: waveStrength(seed, 0, options.pace), outcome: 'playing', last: null };
  }
  if (mode === 'obstacle_survival') {
    return { mode, step: 0, hp: options.lives, maxHp: options.lives, streak: 0, best: 0, cleared: 0, hits: 0, distance: 0, speed: 1, nextHazard: hazardFor(seed, 0), outcome: 'playing', last: null };
  }
  const trackLength = Math.max(1, Math.min(options.trackLength, Math.max(1, cfg.totalQuestions)));
  return { mode, step: 0, position: 0, trackLength, streak: 0, stalls: 0, revealed: [], finishedAt: null, outcome: 'playing', last: null };
}

/** Apply one graded result. Pure: returns a new state. After the game is decided further results are ignored. */
export function applyResult(state: GameState, res: Result, cfg: EngineConfig): GameState {
  if (state.outcome !== 'playing') return state;
  const ok = res.correct && !res.timedOut;
  const { seed, options } = cfg;
  const total = cfg.totalQuestions;

  if (state.mode === 'tower_defense') {
    const enemy = state.nextEnemy; const strength = state.nextStrength;
    let { towers, upgrades, lives, defeated, leaked } = state;
    let last: TowerDefenseState['last'];
    if (ok) {
      if (towers < MAX_TOWERS) { towers += 1; last = { kind: 'built', amount: 1, enemy }; } else { upgrades += 1; last = { kind: 'upgraded', amount: 1, enemy }; }
      defeated += 1;
    } else {
      // standing towers absorb part of the wave, so early defence pays off later
      const absorbed = Math.floor((towers + upgrades) / 2);
      const dmg = Math.max(1, strength - absorbed);
      lives -= dmg; leaked += 1; last = { kind: 'leak', amount: dmg, enemy };
    }
    const wave = state.wave + 1;
    const outcome: Outcome = lives <= 0 ? 'lost' : wave >= total ? 'won' : 'playing';
    return { ...state, wave, lives: Math.max(0, lives), towers, upgrades, defeated, leaked, last, outcome,
      nextEnemy: enemyFor(seed, wave), nextStrength: waveStrength(seed, wave, options.pace) };
  }

  if (state.mode === 'obstacle_survival') {
    const hazard = state.nextHazard;
    let { hp, streak, cleared, hits, distance, best } = state;
    let last: ObstacleState['last'];
    if (ok) { streak += 1; best = Math.max(best, streak); cleared += 1; distance += 1; last = { kind: 'cleared', hazard, damage: 0 }; }
    else { const dmg = hazardDamage[hazard]; hp -= dmg; streak = 0; hits += 1; distance += 0.35; last = { kind: 'hit', hazard, damage: dmg }; }
    const step = state.step + 1;
    const speed = Math.round((1 + Math.min(streak, 5) * 0.2 * paceFactor[options.pace]) * 10) / 10;
    const outcome: Outcome = hp <= 0 ? 'lost' : step >= total ? 'won' : 'playing';
    return { ...state, step, hp: Math.max(0, hp), streak, best, cleared, hits, distance, speed, last, outcome, nextHazard: hazardFor(seed, step) };
  }

  // clue racing
  let { position, streak, stalls } = state;
  const revealed = [...state.revealed];
  let last: ClueState['last'];
  if (ok) {
    streak += 1;
    const boost = streak > 0 && streak % 3 === 0 ? 1 : 0; // every third correct answer in a row is a boost
    const moved = Math.min(1 + boost, state.trackLength - position);
    for (let k = 0; k < moved; k++) revealed.push(position + k);
    position += moved; last = { kind: boost ? 'boosted' : 'advanced', moved };
  } else { streak = 0; stalls += 1; last = { kind: 'stalled', moved: 0 }; }
  const step = state.step + 1;
  const finished = position >= state.trackLength;
  const outcome: Outcome = finished ? 'won' : step >= total ? 'lost' : 'playing';
  return { ...state, step, position, streak, stalls, revealed, last, outcome, finishedAt: finished ? step - 1 : null };
}

export function replay(cfg: EngineConfig, log: Result[]): GameState {
  return log.reduce<GameState>((s, r) => applyResult(s, r, cfg), initGame(cfg));
}

/** One comparable number for ranking runs of the same game (higher is better): used for tie-breaks and the race board. */
export function progress(state: GameState): number {
  if (state.mode === 'tower_defense') return state.defeated * 100 + state.lives;
  if (state.mode === 'obstacle_survival') return Math.round(state.distance * 100) + state.hp;
  return state.position * 100 - state.stalls;
}

export function summary(state: GameState): string {
  if (state.mode === 'tower_defense') return `${state.defeated} wave${state.defeated === 1 ? '' : 's'} stopped · ${state.leaked} leaked · ${state.lives}/${state.maxLives} health · ${towerPower(state)} tower power`;
  if (state.mode === 'obstacle_survival') return `${state.cleared} hazard${state.cleared === 1 ? '' : 's'} cleared · ${state.hits} hit${state.hits === 1 ? '' : 's'} · ${state.hp}/${state.maxHp} hit points · best streak ${state.best}`;
  return `Checkpoint ${state.position}/${state.trackLength} · ${state.revealed.length} clue piece${state.revealed.length === 1 ? '' : 's'} · ${state.stalls} stall${state.stalls === 1 ? '' : 's'}`;
}

export const outcomeLabel = (o: Outcome, mode: ActionMode) =>
  o === 'playing' ? 'In progress' : o === 'won' ? (mode === 'clue_racing' ? 'Crossed the finish line' : mode === 'tower_defense' ? 'Base defended' : 'Survived the lane') : mode === 'clue_racing' ? 'Ran out of questions' : mode === 'tower_defense' ? 'Base overrun' : 'Knocked out';
