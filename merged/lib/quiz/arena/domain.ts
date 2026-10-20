/** Arena Clash — domain types (protocol `arena/1`). Pure data: no I/O, no clocks, no randomness.
 *  The world is a 1200×1200 square in integer-friendly units; one tick is 50 ms (20 Hz). Nothing here is a combat concept: roles never attack. */
export const PROTOCOL = 'arena/1' as const;
export type Role = 'runner' | 'sentinel' | 'builder' | 'trickster' | 'navigator';
export const ROLES: readonly Role[] = ['runner', 'sentinel', 'builder', 'trickster', 'navigator'];
export type Format = 'control' | 'relay' | 'crystal';
export const FORMATS: readonly Format[] = ['control', 'relay', 'crystal'];
export type MapId = 'meadow_mosaic' | 'clockwork_carnival' | 'crystal_lagoon';
export const MAP_IDS: readonly MapId[] = ['meadow_mosaic', 'clockwork_carnival', 'crystal_lagoon'];
export type Phase = 'lobby' | 'question_open' | 'reveal' | 'planning' | 'arena_live' | 'episode_result' | 'finished';
export type Helper = 'trail_speed' | 'capture_marker' | 'route_reveal' | 'deposit_guidance';
export const HELPERS: readonly Helper[] = ['trail_speed', 'capture_marker', 'route_reveal', 'deposit_guidance'];
export type Weighting = 'study' | 'balanced' | 'game';

export type Vec = { x: number; y: number };
/** What a student sends: a direction, never a position. Each axis is clamped to [-1, 1] and the vector is normalised server-side. */
export type Intent = { x: number; y: number };
/** One entry of a seat's intent timeline: from `tick` on, the seat steers `x,y`. `hb` entries only keep the seat "present". */
export type IntentEntry = { tick: number; x: number; y: number; seq: number };

export type SeatRec = {
  id: string; name: string; teamId: string; role: Role; ready: boolean; revoked: boolean; joinedAt: number;
  x: number; y: number; ix: number; iy: number; seq: number; seenTick: number; abilityReadyTick: number;
  carrying: number; carryValue: number; banner: boolean; dashUntil: number;
  captures: number; pulses: number; deposits: number; handins: number; assists: number;
};
export type Boost = { kind: Helper; episode: number };
export type TeamRec = {
  id: string; name: string; slot: number; wallet: number; earned: number; spent: number;
  mastery: number; masteryOf: number; objective: number; epObjective: number; pulses: number; captures: number; handins: number; deposited: number;
  boost: Boost | null; boughtInPlanning: boolean; scanUntil: number; awards: number[];
};
export type ZoneRec = { id: string; color: 'gold' | 'coral' | 'sky'; x: number; y: number; owner: string | null; contender: string | null; progress: number; heldTicks: number; pulsed: boolean; idleTicks: number; teamProgress: Record<string, number> };
export type FlagRec = { teamId: string; zone: string | null; x: number; y: number; until: number };
export type BridgeRec = { gate: number; until: number; teamId: string };
export type DecoyRec = { teamId: string; x: number; y: number; until: number };
export type BannerRec = { x: number; y: number; carrier: string | null; teamId: string | null; cp: number; droppedAt: number | null; blockedUntil: number };
export type CrystalRec = { id: number; node: number; x: number; y: number; hot: boolean };
export type FxRec = { tick: number; kind: 'capture' | 'pulse' | 'pickup' | 'handin' | 'deposit' | 'collect' | 'ability' | 'rotate' | 'bridge' | 'drop' | 'reset'; x: number; y: number; teamId?: string; n?: number };

export type LiveRec = {
  episode: number; startTick: number; endTick: number; tick: number; anchorMs: number; anchorTick: number;
  active: number[]; nextActive: number[]; rotateAt: number; rotateEvery: number; format: Format;
  zones: ZoneRec[]; flags: FlagRec[]; bridges: BridgeRec[]; decoys: DecoyRec[]; banner: BannerRec | null; crystals: CrystalRec[]; nodeReady: number[]; nextCrystalId: number;
  fx: FxRec[]; bannerPriority: number;
};
export type PlanRec = {
  cycles: number; episodeSeconds: number; planningSeconds: number; revealSeconds: number; resultSeconds: number; countdownSeconds: number;
  positions: number[]; minutes: number; rotationSeconds: number;
};
export type ArenaConfig = {
  schemaVersion: 1; format: Format; mapId: MapId; seed: string; durationMinutes: number; teamCount: number; teamNames: string[]; teamSizeCap: number;
  weighting: Weighting; lowPressure: boolean; readAloud: boolean; hideNames: boolean; allowReviewCycle: boolean; helpers: Helper[];
};
export type QuestionRec = { cycle: number; position: number; questionId: string | null; openedAtMs: number; deadlineMs: number; eligible: Record<string, string[]>; settled: boolean };
export type Standing = { teamId: string; rank: number; tied: boolean; score: number; quiz: number; objective: number; pulses: number; captures: number; handins: number; deposited: number; spent: number; players: number };
export type Finish = { reason: 'completed' | 'host_ended' | 'time_up'; at: number; standings: Standing[]; tieNote: string | null };
export type ArenaState = {
  rulesVersion: number; protocol: typeof PROTOCOL; phase: Phase; format: Format; mapId: MapId; locked: boolean; paused: boolean; pausedAtMs: number | null;
  tick: number; cycle: number; phaseDeadlineMs: number | null; phaseStartedMs: number;
  seats: SeatRec[]; teams: TeamRec[]; plan: PlanRec; question: QuestionRec | null; live: LiveRec | null; credited: string[]; usedPositions: number[];
  startedAtMs: number | null; finish: Finish | null; log: string[];
  teamSizeCap: number; weighting: Weighting; lowPressure: boolean; readAloud: boolean; helpers: Helper[]; teamCount: number; seed: string;
  lastResult: EpisodeResult | null;
};
export type EpisodeResult = { episode: number; teams: { teamId: string; points: number; captures: number; pulses: number; handins: number; deposited: number }[] };

export type SeatAction =
  | { kind: 'role'; role: Role } | { kind: 'ready'; ready: boolean } | { kind: 'rename'; name: string }
  | { kind: 'buy'; helper: Helper } | { kind: 'ability' } | { kind: 'pass' };
export type HostAction =
  | { kind: 'start' } | { kind: 'pause' } | { kind: 'resume' } | { kind: 'end' } | { kind: 'skip' } | { kind: 'extend' }
  | { kind: 'lock'; locked: boolean } | { kind: 'kick'; seatId: string } | { kind: 'move_seat'; seatId: string; teamId: string };
export type Attempt<T> = { ok: true; state: T; note?: string } | { ok: false; code: string; message: string };
export type ArenaView = 'student' | 'host' | 'projector';

export type CommittedAnswer = { id: string; seatId: string; roomQuestionId: string; correct: boolean; awardedFraction: number };
export type PoolEntry = { position: number; id: string; kind: string; repeat: boolean };
export type RoomEffect = { type: 'start' } | { type: 'open'; position: number } | { type: 'reveal' } | { type: 'pause' } | { type: 'resume' } | { type: 'end' } | { type: 'kick'; seatId: string };
export type Credit = { key: string; teamId: string; amount: number; submissionIds: string[] };
