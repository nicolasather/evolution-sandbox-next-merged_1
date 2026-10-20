/** Obstacle Survival — domain types. Pure data: no I/O, no clocks, no randomness. Everything the server stores or sends is described here.
 *  Coordinates are signed integers; one map tile is 1000 units; one tick is 50 ms (20 Hz). */
export type Role = 'trailblazer' | 'shieldbearer' | 'bridgewright' | 'pathfinder' | 'medic';
export const ROLES: readonly Role[] = ['trailblazer', 'shieldbearer', 'bridgewright', 'pathfinder', 'medic'];
export type HazardKind = 'swipe_bar' | 'falling_block' | 'rolling_drum' | 'spikes' | 'conveyor' | 'slime' | 'pulse_gate' | 'laser_grid' | 'crumble_tile' | 'wind_fan' | 'bounce_pad' | 'mud_chute';
export const HAZARD_KINDS: readonly HazardKind[] = ['swipe_bar', 'falling_block', 'rolling_drum', 'spikes', 'conveyor', 'slime', 'pulse_gate', 'laser_grid', 'crumble_tile', 'wind_fan', 'bounce_pad', 'mud_chute'];
export type Format = 'cooperative_escape' | 'relay_race';
export type Phase = 'lobby' | 'preview' | 'traversing' | 'barrier' | 'reveal' | 'build_choice' | 'countdown' | 'finished';
export type MapId = 'chalkyard_circuit' | 'paperfold_canyon' | 'lantern_harbor' | 'clockwork_commons';
export const MAP_IDS: readonly MapId[] = ['chalkyard_circuit', 'paperfold_canyon', 'lantern_harbor', 'clockwork_commons'];
export type Perk = 'safety_rail' | 'bridge_socket' | 'checkpoint_beacon' | 'group_recovery' | 'route_peek' | 'team_dash_pad' | 'help_question' | 'safe_gate';
export const PERK_IDS: readonly Perk[] = ['safety_rail', 'bridge_socket', 'checkpoint_beacon', 'group_recovery', 'route_peek', 'team_dash_pad', 'help_question', 'safe_gate'];

export type Vec = { x: number; y: number };
export type Cell = [number, number];
export type Input = { dx: -1 | 0 | 1; dy: -1 | 0 | 1; hop: boolean; ability?: boolean };
export type InputBatch = { commandId: string; fromTick: number; samples: Input[] };

export type Schedule = { periodTicks: number; warningTicks: number; activeTicks: number; phaseOffsetTicks: number };
export type Hazard = { id: string; kind: HazardKind; tile: Cell; schedule: Schedule; safeBypass: boolean; maxHitCost: number };
export type Course = {
  schemaVersion: number; mapId: MapId; displayName: string; size: [number, number]; biomeIndex: number;
  start: Cell; goal: Cell; routeWaypoints: Cell[]; expandedSafePath: Cell[]; walkableCells: Cell[]; checkpoints: Cell[];
  hazards: Hazard[]; optionalBridgeSockets: Cell[];
};

/** One student's body. Stored per seat (its own row/revision), advanced only by validated input batches. */
export type Body = {
  x: number; y: number; tick: number;
  checkpoint: number;          // index of the next checkpoint to reach (== number reached)
  stunUntil: number; invincibleUntil: number; hopUntil: number; hopReadyTick: number; abilityReadyTick: number;
  dashUntil: number; guardUntil: number;
  shieldUsed: number;          // safety-rail charges this seat has consumed
  safeX: number; safeY: number; // last position on a tile that was not a hazard (for bounce-back outcomes)
  hits: number;                // damaging hazards that actually landed
  crossed: number; hitMask: number; // bit i = hazard i entered / hit
  maxDist: number;             // furthest walk-distance reached from the start (progress)
  goalTick: number | null;     // tick at which the goal tile was first reached
  afkTicks: number;            // ticks the server had to idle-pad for this seat
  rescues: number;             // teammates helped (medic pulses)
};
export type PulseKind = 'plank' | 'surge' | 'recover' | 'survey';
/** A short team-wide window created by a Bridgewright/Pathfinder/Medic ability or the safe gate. Pure data; physics reads it. */
export type Pulse = { kind: PulseKind | 'safe'; from: number; to: number; seatId: string; at?: Cell };

export type SeatRec = { id: string; name: string; teamId: string; role: Role; ready: boolean; revoked: boolean; joinedAt: number };
export type TeamRec = {
  id: string; name: string; points: number; earned: number; spent: number; wasted: number; mastery: number; masteryOf: number;
  perks: Perk[]; pulses: Pulse[]; assists: number; chaptersCleared: number; barrierAwards: number[];
};
/** A purchase that waits for the teacher (OS-F03). Points are NOT taken until the teacher approves; `price` is checked again at that moment. */
export type Approval = { id: string; seatId: string; teamId: string; perk: Perk; price: number; requestedMs: number };
export type Roster = Record<string, string[]>; // teamId -> eligible seat ids frozen when a barrier opens
export type BarrierRec = {
  chapter: number; phaseId: string; position: number; questionId: string | null; openedAtMs: number; deadlineMs: number; eligible: Roster; settled: boolean; help: string[];
};

export type PlanRec = {
  chapters: number; chapterTicks: number; limitDist: number[]; totalDist: number;
  readSeconds: number; barrierSeconds: number; revealSeconds: number; buildSeconds: number; countdownSeconds: number; previewSeconds: number;
  positions: number[]; minutes: number;
};
export type OSConfig = {
  schemaVersion: 1; format: Format; mapId: MapId; courseSeed: string; durationMinutes: number; teamCount: number; teamNames: string[]; teamSizeCap: number;
  lowPressure: boolean; readAloud: boolean; hideNames: boolean; approvalAbove: number; allowReviewCycle: boolean;
};
export type Clock = { running: boolean; anchorMs: number; anchorTick: number };
export type Finish = { reason: 'escaped' | 'time_up' | 'host_ended'; at: number; standings: Standing[] };
export type Standing = {
  teamId: string; rank: number; outcome: 'escaped' | 'partial' | 'winner' | 'finished'; progress: number; mastery: number; teamwork: number; score: number;
  hits: number; cleared: number; assists: number; spent: number; players: number; escaped: number;
};
export type OSState = {
  rulesVersion: number; phase: Phase; format: Format; locked: boolean; paused: boolean; pausedAtMs: number | null;
  chapter: number; clock: Clock; freezeTick: number | null; phaseDeadlineMs: number | null; phaseStartedMs: number;
  seats: SeatRec[]; teams: TeamRec[]; plan: PlanRec; barrier: BarrierRec | null; credited: string[]; usedPositions: number[];
  startedAtMs: number | null; finish: Finish | null; log: string[];
  /** Trusted room settings mirrored into the state from `os_sessions.config` (OS-F01/F02/F03). Optional only so sessions created before them still load; `hydrateConfig` fills them. */
  teamSizeCap?: number; readAloud?: boolean; lowPressure?: boolean; approvalAbove?: number; approvals?: Approval[]; approvalSeq?: number;
};

export type SeatAction = { kind: 'role'; role: Role } | { kind: 'ready'; ready: boolean } | { kind: 'purchase'; perk: Perk } | { kind: 'rename'; name: string };
export type HostAction =
  | { kind: 'start' } | { kind: 'pause' } | { kind: 'resume' } | { kind: 'end' } | { kind: 'lock'; locked: boolean }
  | { kind: 'skip' } | { kind: 'kick'; seatId: string } | { kind: 'move_seat'; seatId: string; teamId: string }
  | { kind: 'approve'; approvalId: string } | { kind: 'deny'; approvalId: string };
export type Attempt<T> = { ok: true; state: T; note?: string } | { ok: false; code: string; message: string };
export type OSView = 'student' | 'host' | 'projector';

export type CommittedAnswer = { id: string; seatId: string; roomQuestionId: string; correct: boolean; awardedFraction: number };
export type PoolEntry = { position: number; id: string; kind: string; repeat: boolean };
export type RoomEffect = { type: 'start' } | { type: 'open'; position: number } | { type: 'reveal' } | { type: 'pause' } | { type: 'resume' } | { type: 'end' } | { type: 'kick'; seatId: string };
export type Credit = { key: string; teamId: string; amount: number; submissionIds: string[] };
