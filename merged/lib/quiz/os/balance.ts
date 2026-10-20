import type { HazardKind, Perk, Role } from './domain';
/** All costs use the ONE spendable currency: quiz points. There are no gems, keys or coins. */
export const RULES_VERSION = 1;
export const MAX_POINTS = 600;
export const MAX_SQUADS = 4;
export const MAX_SEATS_PER_TEAM = 5;
export const MAX_SEATS_PER_ROOM = 20;
export const TICK_MS = 50;
export const TILE = 1000;
/** units per tick (1000 units = one tile): 80..98 → about 4–5 tiles per second */
export const SPEED: Record<Role, number> = { trailblazer: 94, shieldbearer: 80, bridgewright: 87, pathfinder: 98, medic: 90 };
export const DIAGONAL = 707;
export const HOP_TICKS = 7; export const HOP_COOLDOWN_TICKS = 15;
export const RECOVERY_INVULN_TICKS = 18;
export const ROLE_COOLDOWNS: Record<Role, number> = { trailblazer: 360, shieldbearer: 480, bridgewright: 600, pathfinder: 400, medic: 560 };
export const DASH_TICKS = 14; export const DASH_FACTOR = 1800; // ×1.8
export const GUARD_TICKS = 50;
export const PULSE_TICKS = { plank: 60, surge: 80, recover: 40, survey: 80 } as const;
export const PERKS: Record<Perk, number> = { safety_rail: 80, bridge_socket: 120, checkpoint_beacon: 100, group_recovery: 90, route_peek: 40, team_dash_pad: 70, help_question: 80, safe_gate: 160 };
export const PERK_LIMIT: Record<Perk, number> = { safety_rail: 3, bridge_socket: 1, checkpoint_beacon: 1, group_recovery: 2, route_peek: 1, team_dash_pad: 2, help_question: 2, safe_gate: 1 };
export const PERK_COPY: Record<Perk, { name: string; blurb: string }> = {
  safety_rail: { name: 'Safety rail', blurb: 'Each teammate shrugs off one hazard hit.' },
  bridge_socket: { name: 'Bridge socket', blurb: 'Opens a marked shortcut for the rest of the run.' },
  checkpoint_beacon: { name: 'Checkpoint beacon', blurb: 'A hit sends you to the nearest beacon instead of the last checkpoint.' },
  group_recovery: { name: 'Group recovery', blurb: 'Stuns for the whole squad are cut in half.' },
  route_peek: { name: 'Route peek', blurb: 'Shows the safest lane through the next chapter.' },
  team_dash_pad: { name: 'Team dash pad', blurb: 'Everyone moves 10% faster.' },
  help_question: { name: 'Help question', blurb: 'Adds an explanation hint to the next question. No extra points.' },
  safe_gate: { name: 'Safe gate', blurb: 'Hazards rest for the whole next chapter.' },
};
export const STUN = { default: 9, falling_block: 28, crumble_tile: 18 } as const;
/** Minimum telegraph before a damaging window (ticks). */
export const HAZARD_WARNING_MIN: Record<HazardKind, number> = { swipe_bar: 10, falling_block: 13, rolling_drum: 8, spikes: 16, conveyor: 0, slime: 0, pulse_gate: 14, laser_grid: 18, crumble_tile: 12, wind_fan: 9, bounce_pad: 0, mud_chute: 16 };
/** What a hazard does when it is "on". `damage` kinds stun; the others change movement and never hurt. */
export const DAMAGING: ReadonlySet<HazardKind> = new Set<HazardKind>(['swipe_bar', 'falling_block', 'rolling_drum', 'spikes', 'pulse_gate', 'laser_grid', 'crumble_tile']);
export const OUTCOME: Partial<Record<HazardKind, 'safe' | 'checkpoint'>> = { swipe_bar: 'safe', pulse_gate: 'safe', laser_grid: 'safe', rolling_drum: 'checkpoint' };
export const SOFT = { slime: 500, mud_chute: 400 } as const; // movement factor (per mille) while active
export const PUSH = { conveyor: [30, 0], wind_fan: [0, -24] } as const;
export const DURATION_MINUTES = [10, 15, 20, 30, 45] as const;
export const CHAPTERS_FOR: Record<number, number> = { 10: 4, 15: 6, 20: 8, 30: 12, 45: 17 };
export const TRAVERSE_SECONDS: Record<number, number> = { 10: 14, 15: 15, 20: 16, 30: 16, 45: 16 };
export const BARRIER_LEAD_TICKS = 30; // the warning banner appears 1.5 s before a freeze
export const MAX_BATCH = 48;
export const MAX_AHEAD_TICKS = 6;   // network grace: a seat may be at most this far ahead of the server world tick
export const MAX_LAG_TICKS = 400;   // beyond this the server idle-pads the seat (AFK), deterministically
export const MIN_ELIGIBLE_FRACTION = 0;
