/** One central balance registry. Numbers are initial targets from the design docs, tuned by `tools/swarm/balance.ts` bot runs
 *  (see docs/swarm-survival/BALANCE_REPORT.md). Nothing in the simulation hard-codes a stat outside this file. */
import type { BossKind, EnemyKind, Role, UpgradeKind } from './domain';

/** The arena is 1920×1200 (4× the old 960×600 floor). Clients see a VIEW-sized window that follows their avatar; the host/projector can show everything. */
export const VIEW = { w: 960, h: 600 } as const;
export const WORLD = { w: 1920, h: 1200, bx: 960, by: 600, beaconR: 32, playerR: 16, spawnRing: 65, noSpawnNearPlayer: 85 } as const;
export const DT = 0.05;

export type RoleDef = {
  hp: number; speed: number; dmg: number; fireEvery: number; range: number; bulletSpeed: number; bulletR: number; abilityCd: number; color: string; accent: string; label: string; ability: string; blurb: string;
};
export const ROLE_DEFS: Record<Role, RoleDef> = {
  guardian: { hp: 145, speed: 74, dmg: 20, fireEvery: 17, range: 130, bulletSpeed: 300, bulletR: 7, abilityCd: 500, color: '#3C7BD9', accent: '#FFFBF1', label: 'Guardian', ability: 'Barrier Pulse', blurb: 'Tough. Shields friends and the beacon.' },
  striker: { hp: 92, speed: 92, dmg: 10, fireEvery: 12, range: 160, bulletSpeed: 380, bulletR: 5, abilityCd: 440, color: '#F77765', accent: '#FFFBF1', label: 'Striker', ability: 'Volley', blurb: 'Fast twin bolts. Fragile, hits hard.' },
  medic: { hp: 100, speed: 84, dmg: 12, fireEvery: 14, range: 142, bulletSpeed: 340, bulletR: 5, abilityCd: 520, color: '#5CBBA0', accent: '#FFFBF1', label: 'Medic', ability: 'Mend Circle', blurb: 'Heals the team. Plus-shaped, never faces.' },
  engineer: { hp: 108, speed: 78, dmg: 15, fireEvery: 15, range: 148, bulletSpeed: 340, bulletR: 5, abilityCd: 540, color: '#FFCD55', accent: '#1D2C35', label: 'Engineer', ability: 'Pocket Turret', blurb: 'Drops a short-lived turret.' },
  scout: { hp: 89, speed: 104, dmg: 13, fireEvery: 11, range: 150, bulletSpeed: 400, bulletR: 4, abilityCd: 400, color: '#9A6BD8', accent: '#FFFBF1', label: 'Scout', ability: 'Slip Step', blurb: 'Quickest. Dashes through danger.' },
};
export const ROLE_PRIORITY: Role[] = ['guardian', 'medic', 'engineer', 'striker', 'scout']; // deterministic draft tie-break

export const ABILITY = {
  guardian: { radius: 96, shieldTicks: 40, absorbFracOfBase: 0.30, beaconShield: 30 },
  striker: { bolts: 6, spreadTicks: 3 },
  medic: { radius: 110, heal: 18, beaconRepair: 16, beaconRepairCapFrac: 0.3 },
  engineer: { ttl: 180, fireEvery: 12, dmg: 10, range: 150, maxDist: 60 },
  scout: { dash: 84, ticks: 4, invuln: 5 },
} as const;
export const PASSIVE = {
  guardianDR: 0.15, guardianBeaconDR: 0.30, guardianBeaconRange: 100,
  strikerRetargetCd: 0.9,
  medicHealEvery: 140, medicHeal: 3, medicRange: 130, medicBeaconMend: 4,
  scoutBurstTicks: 30, scoutBurstBonus: 0.25, scoutBurstCd: 120,
} as const;

export const REVIVE = { rescueTicks: 160, needTicks: 50, range: 55, hpFrac: 0.4, returnHpFrac: 0.6 } as const;
export const DISCONNECT = { protectTicks: 160, maxProtections: 3, graceMs: 20000, hostAbsenceMs: 8000, abandonMs: 60000 } as const;
export const CAPS = { enemies: 90, bullets: 220, hazards: 24, drones: 2, turretPerEngineer: 1, shieldFracOfBase: 0.35, damageMultCap: 2.0, enemySlowFloor: 0.4 } as const;

export type EnemyDef = { hp: number; speed: number; dmg: number; radius: number; windup: number; recover: number; fly: boolean; cost: number; color: string; shape: string; label: string; note: string };
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  mite: { hp: 40, speed: 56, dmg: 8, radius: 12, windup: 6, recover: 24, fly: false, cost: 1, color: '#F77765', shape: 'bean', label: 'Pebble Mite', note: 'Basic swarmer' },
  runner: { hp: 29, speed: 94, dmg: 5, radius: 13, windup: 4, recover: 20, fly: false, cost: 1.2, color: '#F2A93B', shape: 'triangle', label: 'Needle Runner', note: 'Bursts forward every 4 s' },
  beetle: { hp: 118, speed: 32, dmg: 15, radius: 19, windup: 8, recover: 28, fly: false, cost: 2.6, color: '#3C7BD9', shape: 'square', label: 'Plate Beetle', note: 'Front armor blocks 35%' },
  wisp: { hp: 49, speed: 77, dmg: 7, radius: 14, windup: 5, recover: 20, fly: true, cost: 1.6, color: '#9A6BD8', shape: 'diamond', label: 'Kite Wisp', note: 'Glides over debris' },
  spore: { hp: 80, speed: 27, dmg: 4, radius: 17, windup: 6, recover: 26, fly: false, cost: 2, color: '#5CBBA0', shape: 'spiky', label: 'Spore Nest', note: 'Splits into two mites' },
  brute: { hp: 225, speed: 38, dmg: 24, radius: 26, windup: 26, recover: 40, fly: false, cost: 5, color: '#F08A2C', shape: 'hex', label: 'Drum Brute', note: 'Telegraphed charge' },
  mirror: { hp: 61, speed: 67, dmg: 10, radius: 15, windup: 6, recover: 22, fly: false, cost: 2, color: '#4FC3D9', shape: 'rhombus', label: 'Mirror Shard', note: 'Reflects weak bolts' },
  leech: { hp: 64, speed: 60, dmg: 6, radius: 15, windup: 6, recover: 22, fly: false, cost: 1.7, color: '#8E4B7D', shape: 'crescent', label: 'Lantern Leech', note: 'Slows you briefly' },
};
export const ENEMY_UNLOCK_ORDER: EnemyKind[] = ['mite', 'runner', 'beetle', 'wisp', 'spore', 'brute', 'mirror', 'leech'];
export const ENEMY_SPECIAL = {
  runnerBurstEvery: 80, runnerBurstTicks: 12, runnerBurstMult: 1.8,
  beetleFrontArc: Math.cos((70 * Math.PI) / 180), beetleArmor: 0.35,
  bruteChargeSpeed: 190, bruteChargeTicks: 11,
  mirrorEvery: 60, mirrorTicks: 16, mirrorMaxDmg: 12,
  leechSlowPct: 0.35, leechSlowTicks: 40,
  sporeSplit: 2,
} as const;

export type BossDef = { hp: number; radius: number; speed: number; color: string; accent: string; label: string; summary: string };
export const BOSS_DEFS: Record<BossKind, BossDef> = {
  marrow_drum: { hp: 1100, radius: 62, speed: 20, color: '#2F5FA8', accent: '#F4DDB0', label: 'The Marrow Drum', summary: 'Shockwave arcs: find the gap.' },
  glass_heron: { hp: 1000, radius: 56, speed: 24, color: '#A9D6E8', accent: '#FFCD55', label: 'The Glass Heron', summary: 'Sweeping beams: step out of the bright line.' },
  orchard_engine: { hp: 1250, radius: 70, speed: 14, color: '#4E9A62', accent: '#F4DDB0', label: 'The Orchard Engine', summary: 'Rings with gaps and rooted tiles.' },
};
export const bossScale = (players: number): number => 0.72 + 0.28 * Math.min(5, Math.max(1, players));
export const BOSS = {
  telegraph: { arc: 20, beam: 17, ring: 24, root: 22 }, recover: 30,
  drum: { arcCount: 3, arcHalfDeg: 20, arcReach: 300, arcDmg: 14, ringDmg: 12, ringGapDeg: 30, summonEvery: 100, summonCount: 2 },
  heron: { beamLen: 520, beamHalf: 14, sweepDegA: 60, sweepDegC: 90, sweepTicks: 50, beamDmg: 16, summonEvery: 120 },
  engine: { orbCount: 12, orbGaps: 2, orbSpeed: 70, orbDmg: 10, rootR: 40, rootDmg: 12, pulseEvery: 54, pulseDmg: 12 },
  collapseTicks: 20, miniScale: 0.55,
  /** a boss wave never lasts forever: a mini boss retreats at this cap, the final boss ends the arena (hard session time) */
  capTicksMini: 1800, capTicksFinal: 3000,
} as const;

export type UpgradeDef = { base: number; perLevel: number; maxLevel: number; category: 'attack' | 'survival' | 'utility'; label: string; effect: string; motion: string };
export const UPGRADE_DEFS: Record<UpgradeKind, UpgradeDef> = {
  fan_bolts: { base: 90, perLevel: 50, maxLevel: 3, category: 'attack', label: 'Fan Bolts', effect: '+1 bolt per shot (max 4), each smaller', motion: 'three parallel arrowheads' },
  glacier_field: { base: 75, perLevel: 35, maxLevel: 3, category: 'utility', label: 'Glacier Field', effect: 'A chilly ring slows nearby enemies', motion: 'thin pale-blue double ring' },
  beacon_plate: { base: 85, perLevel: 45, maxLevel: 3, category: 'survival', label: 'Beacon Plate', effect: '+12 beacon max HP and repairs 8', motion: 'gold plate drop' },
  mend_garden: { base: 80, perLevel: 40, maxLevel: 3, category: 'survival', label: 'Mend Garden', effect: 'Allies near the beacon heal +3 over time', motion: 'green dashed ring' },
  gear_drone: { base: 110, perLevel: 60, maxLevel: 2, category: 'attack', label: 'Gear Drone', effect: '+1 small helper drone (max 2)', motion: 'two-tooth rotor' },
  swift_steps: { base: 70, perLevel: 45, maxLevel: 3, category: 'utility', label: 'Swift Steps', effect: '+4% movement speed', motion: 'three chevron trail' },
  ricochet: { base: 95, perLevel: 55, maxLevel: 2, category: 'attack', label: 'Ricochet', effect: 'Bolts jump to one more enemy', motion: 'one-frame rebound ray' },
  last_stand: { base: 120, perLevel: 65, maxLevel: 2, category: 'survival', label: 'Last Stand', effect: 'A temporary barrier in the last third', motion: 'solid shield arc' },
};
export const UP = {
  fanExtraDmg: 0.33, glacierRadius: 64, glacierRadiusStep: 12, glacierSlow: 0.10, glacierSlowStep: 0.06,
  plateHp: 12, plateRepair: 8, gardenHeal: 3, gardenEvery: 80, gardenRange: 120, droneDmg: 7, droneEvery: 16, droneRange: 130,
  swiftStep: 0.04, ricochetDmg: 0.6, ricochetRange: 110, lastStandBase: 15, lastStandStep: 5, lastStandTicks: 200,
} as const;
export function upgradeCost(kind: UpgradeKind, level: number): number {
  const u = UPGRADE_DEFS[kind];
  if (!Number.isInteger(level) || level < 0 || level >= u.maxLevel) return Infinity;
  return u.base + u.perLevel * level;
}

export const ECONOMY = { baseAward: 100, grade: { study: 8, balanced: 5, game: 3 }, draftSeconds: 12, countdownSeconds: 8, resumeSeconds: 3, freezeMs: 200 } as const;
export const QUESTION_SECONDS: Record<string, number> = { multiple_choice: 30, answer_forge: 40, truth_hunt: 45, connection_rush: 60, fill_table: 75 };
export const FOCUS_Q_MULT = { study: 1.5, balanced: 1, game: 0.8 } as const;
export const DIFFICULTY = { easy: { hp: 0.8, dmg: 0.8, budget: 0.85 }, normal: { hp: 1, dmg: 1, budget: 1 }, challenge: { hp: 1.25, dmg: 1.15, budget: 1.2 } } as const;
export const LOW_PRESSURE = { telegraph: 1.5, dmg: 0.75, collision: 0.8 } as const;
export const beaconHp = (n: number) => 100 + 25 * (Math.max(1, n) - 1);
export const threatCoef = (n: number) => 0.65 + 0.35 * Math.max(1, n);

export const WAVE_START = { playerHeal: 0.25, beaconRepair: 0.08, returnHpFrac: 0.6, spawnWindow: 0.7, firstWaveSpawnAt: 20 } as const;

/** Wave budget tuning (cost units before the team-size threat coefficient). */
export const TUNE = { hpBase: 0.55, b1: 2.2, b0: 3, bs: 1.7, hpProgress: 0.6, hpTeam: 0.2, dmgProgress: 0.3, beaconDmg: 0.5, smallTeamAssist: { 1: 1.35, 2: 1.2, 3: 1.1, 4: 1.04, 5: 1 } as Record<number, number> } as const;

/** Roles open to a squad of a given size. A solo player gets ONE all-rounder (no choice to get wrong); each extra seat unlocks the next role, so a small squad
 *  is never asked to cover jobs it has no people for. Everyone still answers every question. */
export const SOLO_ROLE: Role = 'engineer';
export const ROLES_BY_SIZE: Record<number, readonly Role[]> = {
  1: ['engineer'],
  2: ['striker', 'guardian'],
  3: ['striker', 'guardian', 'medic'],
  4: ['striker', 'guardian', 'medic', 'engineer'],
  5: ['striker', 'guardian', 'medic', 'engineer', 'scout'],
};
export const rolesForSquad = (size: number): readonly Role[] => ROLES_BY_SIZE[Math.max(1, Math.min(5, Math.floor(size) || 1))]!;
export const ROLE_REASON: Record<number, string> = {
  1: 'Playing solo: you get one all-rounder. The Engineer shoots and drops a turret to help hold the beacon.',
  2: 'A pair: one fighter and one tank. Pick the one your partner is not.',
  3: 'Three players: a healer joins the fighter and tank.',
  4: 'Four players: an engineer adds turrets to the mix.',
  5: 'A full squad of five: every role is open, including the fast Scout.',
};
