/** Swarm Survival — shared domain types and the validated session configuration.
 *  Everything here is plain JSON-serializable (no Map/Set/class instances) so a room can be checkpointed, restored and replayed. */
import { z } from 'zod';

export const PROTOCOL = 'ss/1' as const;
export const ENGINE_VERSION = 1;
export const TICK_HZ = 20;
export const SNAPSHOT_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;
export const MAX_TEAM_SIZE = 5;
export const MAX_TEAMS = 4;
export const MAX_PARTICIPANTS = 20;

export const MODES = ['coop', 'versus'] as const;
export const ROLES = ['guardian', 'striker', 'medic', 'engineer', 'scout'] as const;
export const ENEMY_KINDS = ['mite', 'runner', 'beetle', 'wisp', 'spore', 'brute', 'mirror', 'leech'] as const;
export const BOSS_KINDS = ['marrow_drum', 'glass_heron', 'orchard_engine'] as const;
export const UPGRADES = ['fan_bolts', 'glacier_field', 'beacon_plate', 'mend_garden', 'gear_drone', 'swift_steps', 'ricochet', 'last_stand'] as const;
export const MAP_IDS = ['meadow_circuit', 'paper_quarry', 'frost_conservatory'] as const;
export const PHASES = ['lobby', 'role_pick', 'countdown', 'wave', 'boss_wave', 'freeze', 'question', 'grade', 'upgrade', 'ready', 'ending', 'results'] as const;
export type Mode = (typeof MODES)[number];
export type Role = (typeof ROLES)[number];
export type EnemyKind = (typeof ENEMY_KINDS)[number];
export type BossKind = (typeof BOSS_KINDS)[number];
export type UpgradeKind = (typeof UPGRADES)[number];
export type MapId = (typeof MAP_IDS)[number];
export type Phase = (typeof PHASES)[number];
export type Difficulty = 'easy' | 'normal' | 'challenge';
export type Focus = 'study' | 'balanced' | 'game';

/** The world only advances in these phases. Every other phase leaves every entity, timer and cooldown untouched. */
export const isActivePhase = (p: Phase): boolean => p === 'wave' || p === 'boss_wave';
export const isTerminalPhase = (p: Phase): boolean => p === 'ending' || p === 'results';

export const configSchema = z.object({
  mode: z.enum(MODES),
  teamCount: z.number().int().min(1).max(MAX_TEAMS),
  teamSizeCap: z.number().int().min(1).max(MAX_TEAM_SIZE),
  minutes: z.number().int().min(5).max(45),
  mapId: z.enum(MAP_IDS).default('meadow_circuit'),
  difficulty: z.enum(['easy', 'normal', 'challenge']).default('normal'),
  focus: z.enum(['study', 'balanced', 'game']).default('balanced'),
  lowPressure: z.boolean().default(false),
  hideTeamNames: z.boolean().default(false),
  allowReviewCycle: z.boolean().default(false),
  captainOnlyDraft: z.boolean().default(false),
  allowRespec: z.boolean().default(false),
  /** teacher override of the per-question time; bounded 15–180 s, null = by question kind and focus */
  questionSeconds: z.number().int().min(15).max(180).nullable().default(null),
  teamNames: z.array(z.string().trim().min(1).max(24)).max(MAX_TEAMS).optional(),
  /** a 1-person co-op team is allowed; low pressure also grants a single 1-HP emergency revive to a solo player */
}).superRefine((c, ctx) => {
  if (c.mode === 'coop' && c.teamCount !== 1) ctx.addIssue({ code: 'custom', path: ['teamCount'], message: 'Co-op uses exactly one team.' });
  if (c.mode === 'versus' && c.teamCount < 2) ctx.addIssue({ code: 'custom', path: ['teamCount'], message: 'Versus needs 2–4 teams.' });
  if (c.teamCount * c.teamSizeCap > MAX_PARTICIPANTS) ctx.addIssue({ code: 'custom', path: ['teamSizeCap'], message: `A match holds at most ${MAX_PARTICIPANTS} players.` });
});
export type Config = z.infer<typeof configSchema>;

export type Vec = { x: number; y: number };

// ── entities ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type PlayerEnt = {
  id: string; x: number; y: number; hp: number; maxHp: number;
  ix: number; iy: number;            // last accepted input vector (unit length at most)
  face: number;                      // radians
  fireCd: number; abilityCd: number; abilityMax: number; healCd: number;
  down: boolean; downTicks: number; reviveTicks: number; outWave: boolean;
  shield: number; shieldTicks: number; invuln: number; slowTicks: number; rootTicks: number; burst: number; burstCd: number;
  dashTicks: number; dx: number; dy: number; volleyLeft: number; volleyCd: number;
  lastTarget: number; emergencyUsed: boolean; protectTicks: number;
  damageDealt: number; activeTicks: number; downs: number; revives: number; abilityUses: number; shots: number;
};
export type EnemyState = 'spawn' | 'seek' | 'pre_attack' | 'attack' | 'recover' | 'dead';
export type EnemyEnt = {
  id: number; kind: EnemyKind | BossKind; boss: boolean; x: number; y: number; hp: number; maxHp: number;
  dmg: number; speed: number; radius: number; state: EnemyState; st: number; face: number;
  target: string | null; tx: number; ty: number; flag: number; flag2: number; slow: number; slowTicks: number;
  phase: number; cd: number; cd2: number; idx: number;
};
export type Bullet = { id: number; src: 'player' | 'turret' | 'drone' | 'hazard'; owner: string; x: number; y: number; vx: number; vy: number; dmg: number; ttl: number; r: number; jumps: number; hit: number[]; reflected: boolean };
export type HazardKind = 'arc' | 'ring' | 'beam' | 'root' | 'orb';
export type Hazard = {
  id: number; kind: HazardKind; x: number; y: number;
  /** arc: centre angle + half width; beam: sweep from a0 to a1; ring: radius band, gap centre + width */
  a0: number; a1: number; w: number; r0: number; r1: number; gapA: number; gapW: number;
  telegraph: number; telegraphMax: number; active: number; activeMax: number; t: number; dmg: number; hit: string[]; src: number;
};
export type Turret = { id: number; owner: string; x: number; y: number; ttl: number; fireCd: number };
export type Drone = { id: number; owner: string; ang: number; fireCd: number; x: number; y: number };
export type FxKind = 'hit' | 'kill' | 'heal' | 'pulse' | 'volley' | 'dash' | 'down' | 'revive' | 'beacon_hit' | 'shield' | 'banner' | 'boss_phase' | 'boss_down' | 'mend' | 'turret' | 'reflect';
export type Fx = { k: FxKind; x: number; y: number; n?: number; a?: string };

export type SpawnEvt = { at: number; kind: EnemyKind; x: number; y: number };
export type Arena = {
  teamId: string; nextId: number; rng: number; status: 'alive' | 'fallen' | 'abandoned'; fellAtWave: number | null;
  players: Record<string, PlayerEnt>; enemies: EnemyEnt[]; bullets: Bullet[]; hazards: Hazard[]; turrets: Turret[]; drones: Drone[];
  beacon: { hp: number; max: number; shield: number; shieldTicks: number; repaired: number };
  waveTick: number; waveTicks: number; spawnPlan: SpawnEvt[]; spawnIdx: number; waveClear: boolean; bossId: number; bossDead: boolean; bossCollapse: number;
  threat: number; activeN: number; kills: number; damageTaken: number; enemiesSeen: string[]; fx: Fx[]; idleTicks: number;
};

// ── room-level state ────────────────────────────────────────────────────────────────────────────────────────────────────
export type Participant = {
  id: string; name: string; teamId: string; role: Role; connected: boolean; forfeited: boolean; ready: boolean; captain: boolean;
  joinedMs: number; lastSeenMs: number; protections: number; answered: number; fracSum: number; windows: number; commands: number; moves: number; seq: number; pending: boolean;
};
export type Team = {
  id: string; name: string; wallet: number; earned: number; spent: number; wavesCompleted: number;
  upgrades: Partial<Record<UpgradeKind, number>>; drafts: number; purchases: number; questionsAnswered: number; fracSum: number; eligibleSum: number;
  abandonMs: number;
  offlineSinceMs?: number | null; // wall-clock the team spent with nobody connected (bounded rule, see room.ts)
};
export type PlanWave = { n: number; ticks: number; budget: number; boss: { kind: BossKind; mini: boolean; final: boolean } | null; pattern: 'stream' | 'ring' | 'flank' | 'surround'; newKind: EnemyKind | null; questionsAfter: number; draftAfter: boolean };
export type Plan = { minutes: number; waves: PlanWave[]; questionsTotal: number; drafts: number; estimateSeconds: number; warnings: string[]; reviewCycle: boolean };

/** A synchronized question window. `eligible` is frozen at open: late joins, leaves and reconnects cannot change a denominator. */
export type QuizWindow = {
  id: string; index: number; questionId: string; openedMs: number; deadlineMs: number; extensions: number;
  eligible: Record<string, string[]>; answers: Record<string, { frac: number; correct: boolean; atMs: number }>;
  status: 'open' | 'closed' | 'settled' | 'skipped'; settledTeams: string[]; skipReason: string | null; revealed: boolean;
};
export type Draft = {
  id: string; index: number; offers: Record<string, UpgradeKind[]>; votes: Record<string, Record<string, UpgradeKind>>;
  closesMs: number; resolved: Record<string, { upgrade: UpgradeKind | null; cost: number; walletBefore: number; walletAfter: number; how: 'vote' | 'default' | 'none' }>;
};
export type AuditEntry = { at: number; cmd: string; id: string; by: string; detail?: string };
export type TeamResult = { teamId: string; name: string; rank: number; outcome: 'won' | 'lost' | 'finished'; wavesCompleted: number; beaconPct: number; dmgPerActiveSec: number; accuracyPct: number | null; earned: number; spent: number; players: number; fellAtWave: number | null };
export type Results = { reason: string; outcome: 'won' | 'lost' | 'ended'; standings: TeamResult[]; at: number };

export type Room = {
  v: 1; engine: number; id: string; code: string; config: Config; seed: number;
  phase: Phase; rev: number; serverSeq: number; tick: number; createdMs: number;
  paused: boolean; pausedAtMs: number | null; pauseReason: string | null; locked: boolean;
  wave: number; waveTick: number; breakIndex: number; qPool: { id: string; kind: string; repeat: boolean }[]; lateJoin: boolean; emptySinceMs: number | null; phaseEndsMs: number | null; resumeAtMs: number | null; breakQuestionsLeft: number;
  teams: Record<string, Team>; teamOrder: string[]; arenas: Record<string, Arena>; roster: Record<string, Participant>; rosterOrder: string[];
  plan: Plan; quiz: QuizWindow | null; draft: Draft | null; qUsed: number; settledWindows: string[]; draftsDone: number;
  results: Results | null; hostSeenMs: number; hostPresent: boolean; audit: AuditEntry[]; ledger: string[]; endNonce: { n: string; until: number } | null; log: string[];
  eventSeq: number; events: RoomEvent[];
};
export type RoomEvent = { seq: number; tick: number; k: string; team?: string; pid?: string; a?: Record<string, unknown> };
