import type { Migratable } from '../save/types';

/* ============================================================================
   SURVIVAL — data model. A genuinely different core loop from Main
   Evolution: SCOUT → ASSESS → PRIORITIZE → ASSIGN → ADAPT over a small,
   bounded, spatial camp, not a crafting bench. See docs/ROADMAP-UNIVERSE.md
   for how this differs from Main Evolution and why it stays a separate
   save, independent of Engine.found.
   ========================================================================== */

export type TileKind = 'water' | 'woodland' | 'open' | 'rock' | 'camp';

export interface Terrain {
  width: number;
  height: number;
  /** Row-major: tiles[y][x]. */
  tiles: TileKind[][];
  campX: number;
  campY: number;
}

export type Period = 'morning' | 'day' | 'evening' | 'night';

export type TaskKind = 'gather-wood' | 'gather-food' | 'fetch-water' | 'tend-fire' | 'build-shelter' | 'rest' | 'idle';

export interface Task {
  kind: TaskKind;
  /** Tile the task is performed at, when it matters (gathering/fetching). */
  x: number;
  y: number;
}

export type Trait = 'observant' | 'patient-craftsperson' | 'strong-carrier' | 'quick-learner' | 'cautious-explorer';

export interface Member {
  id: string;
  name: string;
  trait: Trait;
  /** 0–1 qualitative state, per the brief's "collapse into readable
   *  qualitative states, not seven progress bars" — see lib/survival/read.ts
   *  for how these become words in the UI. */
  energy: number;
  warmth: number;
  morale: number;
  injured: boolean;
  task: Task | null;
}

export interface FireState {
  lit: boolean;
  /** 0–1. */
  fuel: number;
}

export interface ShelterState {
  /** 0 none, 1 windbreak, 2 lean-to, 3 solid shelter. */
  level: 0 | 1 | 2 | 3;
}

export interface Resources {
  food: number;
  water: number;
  wood: number;
}

export interface Objective {
  kind: 'survive-days';
  targetDay: number;
}

export type CampEnding = 'ongoing' | 'success' | 'failed';

export interface CampEvent {
  day: number;
  period: Period;
  text: string;
}

export interface CampState {
  seed: string;
  day: number;
  period: Period;
  terrain: Terrain;
  members: Member[];
  resources: Resources;
  fire: FireState;
  shelter: ShelterState;
  objective: Objective;
  ending: CampEnding;
  /** Set once, narrated the first time the group succeeds at each —
   *  reuses real canonical discovery text for flavour (see
   *  lib/survival/narrate.ts) without touching Main Evolution's Engine. */
  milestones: Partial<Record<'fire' | 'shelter', true>>;
  log: CampEvent[];
}

export interface CampMemory {
  id: string;
  seed: string;
  ending: 'success' | 'failed';
  days: number;
  /** A short, human line summarising the run's shape — see
   *  lib/survival/memory.ts. Never a real historical claim. */
  headline: string;
  completedAt: number;
}

export interface SurvivalSave extends Migratable {
  v: 1;
  active: CampState | null;
  memories: CampMemory[];
}
