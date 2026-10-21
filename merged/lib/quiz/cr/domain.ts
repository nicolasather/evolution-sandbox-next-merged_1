/** Clue Racing — domain types (protocol `cr/1`). Pure data: no I/O, no clocks, no randomness.
 *  The world is a 5200×3300 illustrated course; one tick is 50 ms (20 Hz) and ticks only run in the `race` phase, so every quiz window freezes ALL world time. */
export const PROTOCOL = 'cr/1' as const;
export const FORMATS = ['split_route', 'signal_relay', 'atlas_circuit'] as const;
export type Format = (typeof FORMATS)[number];
export const ROLES = ['solo_pathfinder', 'scout', 'signal_keeper', 'cartographer', 'trail_maker', 'archivist'] as const;
export type Role = (typeof ROLES)[number];
export const MAP_IDS = ['sunleaf_passage', 'tideglass_harbor', 'copperwind_borough', 'starpetal_heights'] as const;
export type MapId = (typeof MAP_IDS)[number];
export type Phase = 'lobby' | 'countdown' | 'race' | 'checkpoint' | 'barrier' | 'reveal' | 'route_choice' | 'finished';
export const PERKS = ['route_lamp', 'fast_map', 'extra_signal', 'scout_echo'] as const;
export type Perk = (typeof PERKS)[number];
export type OptionId = 'a' | 'b' | 'c';

export type IntentEntry = { tick: number; x: number; y: number; seq: number };
export type SeatRec = {
  id: string; name: string; teamId: string; role: Role; ready: boolean; revoked: boolean; joinedAt: number;
  x: number; y: number; ix: number; iy: number; seq: number; seenTick: number; abilityReadyTick: number; joinedLeg: number;
};
export type LegObj = {
  option: OptionId; done: boolean; doneTick: number | null; assisted: boolean; stampIdx: number; stampLockUntil: number; flagHolder: string | null; lastPost: number; wrongPosts: number; holdMoveTick: number; legTarget: number;
  stamps: number[]; coop: string[]; votes: Record<string, OptionId>;
};
export type Cue = { kind: 'pulse' | 'sight' | 'fold' | 'beacon'; seatId: string; until: number; x?: number; y?: number };
export type TeamRec = {
  id: string; name: string; slot: number; wallet: number; earned: number; spent: number; overflow: number;
  masteryTotal: number; masteryOf: number; legsDone: number; legsAssisted: number; correctSites: number; retries: number; doneTicks: number; coopTotal: number; coopTarget: number;
  perks: { id: Perk; leg: number }[]; obj: LegObj; burstReadyTick: number; cues: Cue[]; bridgeUntil: number; pinned: string | null; awards: number[];
};
export type FxRec = { tick: number; kind: 'checkpoint' | 'stamp' | 'wrong' | 'pass' | 'beacon' | 'bridge' | 'pulse' | 'sight' | 'fold' | 'finish' | 'inspect' | 'arrive'; x: number; y: number; teamId?: string; n?: number };
export type LiveRec = { leg: number; startTick: number; endTick: number; tick: number; anchorMs: number; anchorTick: number; fx: FxRec[] };
export type PlanRec = { windows: number; legs: number; legSeconds: number; revealSeconds: number; decisionSeconds: number; countdownSeconds: number; checkpointSeconds: number; minutes: number; stations: number[]; positions: number[] };
export type CRConfig = {
  schemaVersion: 1; format: Format; mapId: MapId; seed: string; durationMinutes: number; teamCount: number; teamNames: string[]; teamSizeCap: number;
  lowPressure: boolean; readAloud: boolean; hideNames: boolean; allowReviewCycle: boolean; perks: Perk[]; difficulty: 'easy' | 'normal' | 'challenge';
};
export type QuestionRec = { window: number; position: number; questionId: string | null; openedAtMs: number; deadlineMs: number; eligible: Record<string, string[]>; settled: boolean; skipped: boolean };
export type EvidenceRec = { leg: number; kind: Format; text: string; postIdx?: number; order?: number[]; revealedWindow: number };
export type Standing = { teamId: string; rank: number; tied: boolean; score: number; mastery: number; route: number; teamwork: number; correctSites: number; retries: number; spent: number; players: number };
export type Finish = { reason: 'completed' | 'host_ended' | 'time_up'; at: number; standings: Standing[]; tieNote: string | null };
export type CRState = {
  rulesVersion: number; protocol: typeof PROTOCOL; phase: Phase; format: Format; mapId: MapId; locked: boolean; paused: boolean; pausedAtMs: number | null;
  tick: number; leg: number; phaseDeadlineMs: number | null; phaseStartedMs: number; extended: number;
  seats: SeatRec[]; teams: TeamRec[]; plan: PlanRec; question: QuestionRec | null; live: LiveRec | null; credited: string[]; usedPositions: number[];
  evidence: EvidenceRec[]; revealedLegs: number; startedAtMs: number | null; finish: Finish | null; log: string[];
  teamSizeCap: number; lowPressure: boolean; readAloud: boolean; perks: Perk[]; teamCount: number; seed: string; difficulty: CRConfig['difficulty'];
};

export type SeatAction =
  | { kind: 'role'; role: Role } | { kind: 'ready'; ready: boolean } | { kind: 'rename'; name: string }
  | { kind: 'vote'; option: OptionId } | { kind: 'ability' } | { kind: 'pass' } | { kind: 'inspect'; siteId: number } | { kind: 'buy'; perk: Perk };
export type HostAction =
  | { kind: 'start' } | { kind: 'pause' } | { kind: 'resume' } | { kind: 'end' } | { kind: 'skip' } | { kind: 'extend' }
  | { kind: 'lock'; locked: boolean } | { kind: 'kick'; seatId: string } | { kind: 'move_seat'; seatId: string; teamId: string };
export type Attempt<T> = { ok: true; state: T; note?: string } | { ok: false; code: string; message: string };
export type CRView = 'student' | 'host' | 'projector';
export type CommittedAnswer = { id: string; seatId: string; roomQuestionId: string; correct: boolean; awardedFraction: number };
export type PoolEntry = { position: number; id: string; kind: string; repeat: boolean };
export type RoomEffect = { type: 'start' } | { type: 'open'; position: number } | { type: 'reveal' } | { type: 'pause' } | { type: 'resume' } | { type: 'end' } | { type: 'kick'; seatId: string };
export type Credit = { key: string; teamId: string; amount: number; submissionIds: string[] };
