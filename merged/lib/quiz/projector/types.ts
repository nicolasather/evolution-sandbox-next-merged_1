/** Shared types for the five projector games. Pure (no server-only imports) so reducers run on server, in tests and in the local practice lab. */
import type { QuestionKind } from '../types';

export const GAME_KEYS = ['empire_race', 'boss_battle', 'escape_room', 'treasure_vault', 'risk_ladder', 'auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown'] as const;
export type GameKey = (typeof GAME_KEYS)[number];
export const LEARNING_FOCUSES = ['study', 'balanced', 'game'] as const;
export type LearningFocus = (typeof LEARNING_FOCUSES)[number];
export type Locale = 'en';
export type L10n = { en: string };
export type Grade = 'correct' | 'partial' | 'wrong';
export type Difficulty = 1 | 2 | 3;

export type TeamRef = { id: string; name: string; order: number };

/** A question as the planner sees it: metadata only, never the answer key. */
export type PoolQuestion = {
  position: number; id: string; kind: QuestionKind;
  topic: string | null; difficulty: Difficulty | null; difficultySource: 'author' | 'format';
  hasExplanation: boolean; repeatOf: number | null;
};

/** Built ONLY on the server from a committed `submissions` row. A client can never construct one. */
export type VerifiedAnswer = {
  submissionId: string; teamId: string; roomQuestionId: string; position: number;
  grade: Grade; fraction: number; kind: QuestionKind; topic: string | null; difficulty: Difficulty | null;
  teacherOverride: boolean;
};

export type AskInfo = {
  position: number; roomQuestionId: string; topic: string | null; difficulty: Difficulty | null; kind: QuestionKind;
  teamIds: string[]; answered: string[]; purpose: string; ref: string | null; topicFallback: boolean; repeat: boolean;
};

export type BossId = 'clockwork_leviathan' | 'library_colossus' | 'storm_engine';
export type CampaignId = 'clockhouse' | 'celestial_archive' | 'glass_garden';
export type EmpireWorld = 'archipelago' | 'river_kingdom' | 'desert_crossing';
export type EmpireObjective = 'territory' | 'capital' | 'expedition';
export type LadderMission = 'highest' | 'first' | 'group';
export type TerritoryBoard = 'frontier' | 'canyon' | 'delta';

export type ProjectorSettings = {
  world?: EmpireWorld; objective?: EmpireObjective; boss?: BossId; campaign?: CampaignId; mission?: LadderMission; board?: TerritoryBoard;
  comeback?: boolean; zoneTopics?: string[];
};
export type ProjectorConfig = {
  v: 1; game: GameKey; focus: LearningFocus; minutes: number | null; seed: string; settings: ProjectorSettings;
  /** accepted only when the teacher ticks it; shortage of questions is handled by labelled repeat cycles */
  allowRepeats?: boolean;
};

export type LogEntry = { n: number; k: string; team?: string; p?: Record<string, string | number> };
export type Evidence = { sub: string; team: string; pos: number; topic: string | null; kind: QuestionKind; grade: Grade; fraction: number; manual: boolean; purpose: string };
export type Standing = { team: string; score: number; rank: number; detail?: Record<string, number> };
export type Finished = { reason: FinishReason; outcome: string; standings: Standing[] };
export type Phase = 'choose' | 'asking' | 'planning' | 'resolution' | 'review' | 'finished';
export type FinishReason = 'objective' | 'turns' | 'time' | 'teacher' | 'defeat';

export type Core = {
  v: 1; game: GameKey; seed: string; focus: LearningFocus; lowPressure: boolean; teams: TeamRef[];
  askMode: 'single' | 'all'; turnBudget: number; turnsUsed: number; round: number; actor: number;
  phase: Phase; ask: AskInfo | null; consumed: string[]; usedPositions: number[];
  evidence: Evidence[]; log: LogEntry[]; seq: number;
  /** Increments for every visible world change; scenes key their animations on it. */
  fx: { n: number; kind: string; team?: string; ref?: string | number } | null;
  finishAfterTurn: boolean; extensions: { minutes: number; reason: string }[];
  finished: Finished | null; skipped: { team: string; reason: string }[]; secondsPerTurn: number;
};

export type GameState<G = unknown> = { core: Core; g: G };

export type GameCommand = { action: string; payload?: Record<string, unknown> };
export type Need =
  | { type: 'ask'; teamIds: string[]; topic: string | null; difficulty: Difficulty | null; purpose: string; ref: string | null }
  | { type: 'grade'; teamId: string }
  | { type: 'reveal' };
export type ReduceOk = { ok: true; state: GameState; need?: Need };
export type ReduceErr = { ok: false; code: string; params?: Record<string, string | number> };
export type ReduceResult = ReduceOk | ReduceErr;
export type Env = { pool: PoolQuestion[]; question?: { position: number; roomQuestionId: string; topic: string | null; difficulty: Difficulty | null; kind: QuestionKind; topicFallback: boolean; repeat: boolean }; answer?: VerifiedAnswer; revealed?: boolean };

export const err = (code: string, params?: Record<string, string | number>): ReduceErr => ({ ok: false, code, params });
