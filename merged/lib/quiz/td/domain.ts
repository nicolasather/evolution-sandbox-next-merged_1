/** QUIZ STUDIO · TOWER DEFENSE — domain types. Pure (no server-only imports): the same code runs on the server (authoritative),
 *  in tests and in the browser (rendering replay + offline practice). Nothing here makes a browser authoritative. */
import type { QuestionKind } from '../types';

export const TD_FORMATS = ['coop', 'versus'] as const;
export type TDFormat = (typeof TD_FORMATS)[number];
export const TD_PHASES = ['lobby', 'countdown', 'quiz_open', 'reveal', 'build', 'wave', 'wave_result', 'finished'] as const;
export type TDPhase = (typeof TD_PHASES)[number];
export const TD_ROLES = ['architect', 'tactician', 'artillerist', 'alchemist', 'warden'] as const;
export type TDRole = (typeof TD_ROLES)[number];
export const TD_TOWERS = ['bolt', 'frost', 'ember', 'thorn', 'arc', 'beacon'] as const;
export type TDTowerKind = (typeof TD_TOWERS)[number];
export const TD_ENEMIES = ['drifter', 'zipper', 'bulwark', 'skimmer', 'warden', 'splitter', 'sapper', 'colossus'] as const;
export type TDEnemyKind = (typeof TD_ENEMIES)[number];
export const TD_MAPS = ['meadow_circuit', 'coral_quarry', 'skyworks'] as const;
export type TDMapId = (typeof TD_MAPS)[number];
export const TD_BOSSES = ['copper_colossus', 'quarry_crawler', 'skywork_leviathan'] as const;
export type TDBossId = (typeof TD_BOSSES)[number];
export const TD_TARGETING = ['first', 'strongest', 'fastest', 'lowest_health'] as const;
export type TDTargetPolicy = (typeof TD_TARGETING)[number];
export type TDQuestionFlow = 'synchronized' | 'independent';
export type TDFocus = 'study' | 'balanced' | 'game';
export type TDView = 'student' | 'host' | 'projector';
/** Level-3 branch choices, one pair per tower family. A branch can be bought once; it never stacks. */
export const TD_BRANCHES: Record<TDTowerKind, readonly [string, string]> = {
  bolt: ['double_barrel', 'chain_node'],
  frost: ['deep_freeze', 'ice_trail'],
  ember: ['wide_ember', 'armor_melt'],
  thorn: ['vine_spread', 'lasting_sap'],
  arc: ['jump_chain', 'charged_strike'],
  beacon: ['range_aura', 'core_relief'],
};

export type TDConfig = {
  schemaVersion: 1;
  format: TDFormat;
  mapId: TDMapId;
  durationMinutes: number; // 10..45
  questionFlow: TDQuestionFlow;
  focus: TDFocus;
  lowPressure: boolean;
  readAloud: boolean;
  teamSizeCap: number; // 1..5
  teamCount: number; // coop 1, versus 2..4
  teamNames: string[];
  /** host must approve purchases above this many points (0 = off) */
  approvalAbove: number;
  /** hide student names on the shared projector */
  hideNames: boolean;
  /** compatible classic modifiers (see compat.ts) */
  modifiers: ('secret_wager')[];
  /** teacher consent to one labelled review cycle when the quiz is short */
  allowReviewCycle: boolean;
};

export type TDSeat = {
  id: string; // = players.id (room-scoped, server issued)
  teamId: string | null; // null = waiting for a free squad slot
  name: string;
  role: TDRole | null;
  ready: boolean;
  revoked: boolean;
  joinedAtMs: number;
  /** role abilities used this wave (server ledger) */
  usedThisWave: string[];
  /** independent flow: answers opened this round, and the question currently reserved for this seat */
  answersThisRound: number;
  pendingQ?: string | null;
  answered: number; correct: number; partial: number;
};

export type TDTower = {
  id: string; padId: string; kind: TDTowerKind; level: 1 | 2 | 3; branch: string | null;
  spent: number; targeting: TDTargetPolicy; builtBy: string; builtRound: number;
  /** a boss cracked its pad: disabled for the rest of that wave, then free to move once */
  freeMove: boolean;
};

/** Abilities armed during BUILD and resolved deterministically by the next wave. */
export type TDArmed = {
  reinforce: string[]; // tower ids with +15% range for one wave
  salvo: number[]; // path positions (0..1000 per mille of the path) for one artillery strike each
  purify: number; // number of jams to cancel
  protect: number; // number of leaks to block
  scan: boolean; // next wave archetypes revealed to the squad
};

export type TDTeam = {
  id: string; name: string; colorIndex: number;
  points: number; coreHP: number; maxCoreHP: number;
  towers: TDTower[];
  armed: TDArmed;
  fallen: boolean; // core reached zero (versus: the board stops; nobody is eliminated from questions)
  wavesCleared: number; leaks: number; kills: number;
  earned: number; spent: number; refunded: number;
  answered: number; correct: number; partialCredit: number; // fractions in thousandths
  /** pending purchase approvals (approvalAbove) */
  pending: { id: string; seat: string; action: TDBoardAction; cost: number }[];
  comebackKitChapter: number; // last chapter the comeback kit was granted
  comebackKit: boolean; // the next Bolt costs half
  architectDiscountUsed: string[]; // seat ids that used this wave's discount
  freeTargeting: string[]; // tactician seats that used the free change this wave
  log: TDLog[];
  lastWave: TDWaveResult | null;
  /** Secret Wager (competitive only): stake committed for the next question */
  wager: number;
  /** Tactician scan: the archetypes of the coming wave, shown to this squad only */
  scanned: TDEnemyKind[] | null;
};

export type TDLog = { n: number; k: string; seat?: string; p?: Record<string, string | number> };

export type TDBoardAction =
  | { kind: 'build'; padId: string; tower: TDTowerKind }
  | { kind: 'upgrade'; towerId: string; branch?: string }
  | { kind: 'sell'; towerId: string }
  | { kind: 'move'; towerId: string; padId: string }
  | { kind: 'target'; towerId: string; policy: TDTargetPolicy };

export type TDSeatAction =
  | TDBoardAction
  | { kind: 'ability'; ability: 'reinforce' | 'scan' | 'salvo' | 'purify' | 'protect'; towerId?: string; at?: number }
  | { kind: 'ready'; ready: boolean }
  | { kind: 'role'; role: TDRole | null }
  | { kind: 'team'; teamId: string }
  | { kind: 'wager'; amount: number };

export type TDHostAction =
  | { kind: 'start'; override?: boolean }
  | { kind: 'pause' } | { kind: 'resume' }
  | { kind: 'extend'; seconds: number }
  | { kind: 'advance' }
  | { kind: 'end' }
  | { kind: 'kick'; seatId: string }
  | { kind: 'move_seat'; seatId: string; teamId: string | null }
  | { kind: 'lock'; locked: boolean }
  | { kind: 'approve'; teamId: string; pendingId: string; approve: boolean }
  | { kind: 'rename_team'; teamId: string; name: string }
  | { kind: 'hide_names'; hide: boolean };

/** A question opened for the class (synchronized) — public pointer only, never the key. */
export type TDQuestionRef = { roomQuestionId: string; position: number; kind: QuestionKind; index: number; total: number; repeat: boolean };

export type TDWaveSpawn = { id: number; kind: TDEnemyKind; tick: number; hp: number; armor: number; speed: number; boss?: TDBossId; mini?: boolean };
export type TDWavePlan = { wave: number; spawns: TDWaveSpawn[]; boss: TDBossId | null; budget: number; archetypes: TDEnemyKind[] };
export type TDWaveResult = {
  wave: number; outcome: 'cleared' | 'held' | 'fallen'; leaks: number; coreDamage: number; kills: number;
  ticks: number; damageByTower: Record<string, number>; bossDefeated: boolean | null; blocked: number; purified: number;
  /** a boss cracked this tower's pad (Quarry Crawler): it was disabled for the wave and may move once for free */
  cracked: string | null;
};

export type TDRound = {
  n: number; // 1-based
  question: TDQuestionRef | null;
  openedAtMs: number | null; deadlineMs: number | null;
  eligible: Record<string, string[]>; // teamId -> seat ids eligible for the synchronized question
  submitted: string[]; // seat ids that submitted (from committed submissions)
  credited: boolean;
  award: Record<string, number>; // teamId -> points awarded for this round's question
  correctBySeat: Record<string, number>; // seat -> fraction in thousandths (teacher/report only)
  wave: TDWavePlan | null;
  waveStartMs: number | null; waveTicks: number;
  /** frozen board each team fought with (what clients replay) */
  waveInput: Record<string, TDWaveInput> | null;
  /** authoritative outcome per team, computed when the wave starts and APPLIED when it ends (so nobody sees it early on the HUD) */
  results: Record<string, TDWaveResult & { core: number }> | null;
};

/** Everything a deterministic wave simulation needs. Clients receive it at wave start and replay it for rendering. */
export type TDWaveInput = {
  teamId: string; mapId: TDMapId; wave: number;
  towers: { id: string; padId: string; kind: TDTowerKind; level: 1 | 2 | 3; branch: string | null; targeting: TDTargetPolicy; reinforced: boolean }[];
  spawns: TDWaveSpawn[];
  coreHP: number; maxCoreHP: number;
  roleMods: { splashPct: number; statusPct: number };
  armed: { salvo: number[]; purify: number; protect: number };
  lowPressure: boolean;
  boss: TDBossId | null;
};

export type TDState = {
  schemaVersion: 1; rulesVersion: 1;
  phase: TDPhase;
  phaseStartedMs: number; phaseDeadlineMs: number | null;
  paused: { atMs: number; reason: 'teacher' | 'host_offline' } | null;
  pausedTotalMs: number;
  startedMs: number | null; matchEndMs: number | null; // scheduled wall-clock end (moves with pauses)
  locked: boolean; // joins frozen
  config: TDConfig;
  plan: TDPlan;
  teams: TDTeam[];
  seats: TDSeat[];
  round: number; // current round number (0 before the first)
  rounds: TDRound[];
  usedPositions: number[];
  finish: TDFinish | null;
  seq: number;
  /** what changed last (scenes key short animations on it) */
  fx: { n: number; kind: string; team?: string; ref?: string } | null;
  extendedQuestion: boolean; extendedBuild: boolean;
};

export type TDPlan = {
  minutes: number; waves: number; bossWaves: number[]; miniBossWaves: number[];
  questionSeconds: number; revealSeconds: number; buildSeconds: number; resultSeconds: number;
  questionsNeeded: number; questionsAvailable: number; reviewCycle: boolean;
  quizShare: number; notes: string[]; secondsPerRound: number;
  /** independent flow: personal answers allowed per player per round */
  personalCap: number;
};

export type TDStanding = {
  teamId: string; rank: number; wavesCleared: number; coreHP: number; maxCoreHP: number;
  accuracyPct: number | null; answered: number; points: number; outcome: string;
};
export type TDFinish = { atMs: number; reason: 'complete' | 'core' | 'time' | 'teacher' | 'questions'; outcome: 'victory' | 'partial' | 'defeat' | 'ranked'; standings: TDStanding[] };

export type TDErrorCode =
  | 'WRONG_PHASE' | 'NOT_YOUR_TEAM' | 'INSUFFICIENT_POINTS' | 'INVALID_PAD' | 'PAD_OCCUPIED' | 'TOWER_MISSING' | 'MAX_LEVEL'
  | 'INVALID_ACTION' | 'MATCH_FINISHED' | 'SEAT_REVOKED' | 'SEAT_FULL' | 'ROOM_LOCKED' | 'STALE_REVISION' | 'MAX_TOWERS'
  | 'ABILITY_USED' | 'ROLE_REQUIRED' | 'BRANCH_REQUIRED' | 'BRANCH_INVALID' | 'PAUSED' | 'NEEDS_APPROVAL' | 'NOT_READY_YET' | 'NOT_HOST';
export type TDResult = { ok: true; state: TDState; note?: string } | { ok: false; code: TDErrorCode; message: string };
