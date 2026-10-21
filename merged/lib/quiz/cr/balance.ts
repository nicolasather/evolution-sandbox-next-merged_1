import type { Perk, Role } from './domain';
/** Every number that shapes play. Quiz points are the only currency and nothing here rewards answering speed. */
export const RULES_VERSION = 1;
export const TICK_MS = 50;
export const MAX_TEAMS = 4; export const MAX_SEATS_PER_TEAM = 5; export const MAX_SEATS_PER_ROOM = 20;
export const WORLD_W = 5200; export const WORLD_H = 3300;
export const STATIONS = 28;                   // 27 course intervals: up to 26 question windows + the finish run
export const SPEED = 7;                       // units per tick = 140 u/s for EVERY role
export const ACTOR_R = 18;
export const ROAD_R = 64; export const HUB_R = 150; export const SPUR_R = 54; export const SITE_R = 84; export const ARRIVE_R = 110;
export const STAMP_R = 120; export const HANDOFF_R = 150; export const POST_R = 84;
export const IDLE_TICKS = 200;                // 10 s without a heartbeat → not counted as present
export const RELAY_IDLE_HANDOFF_TICKS = 100;  // the flag moves on after 5 s of its holder standing still
export const STAMP_LOCK_TICKS = 30;           // a wrong stamp pauses stamping for 1.5 s, never removes points
export const GATE_PERIOD = 160; export const GATE_OPEN = 100;
export const BRIDGE_RANGE = 220;
export const MAX_NAME = 24;
export const WALLET_CAP = 600; export const WINDOW_CREDIT_CAP = 100;
export const PERK_COST: Record<Perk, number> = { route_lamp: 100, fast_map: 150, extra_signal: 125, scout_echo: 75 };
export const MAX_ACTIVE_PERKS = 2;
export const PERK_COPY: Record<Perk, { name: string; blurb: string }> = {
  route_lamp: { name: 'Route Lamp', blurb: 'Lamps light the way to the next objective for one leg.' },
  fast_map: { name: 'Fast Map', blurb: 'The full leg map, every landmark and gate, stays open for one leg.' },
  extra_signal: { name: 'Extra Signal', blurb: 'Role abilities rest 25% less and the relay hand-off ring is 30% wider for one leg.' },
  scout_echo: { name: 'Scout Echo', blurb: 'Shows when each timed gate opens and the names of the next landmarks for one leg.' },
};
export const ROLE_COOLDOWN: Record<Role, number> = { solo_pathfinder: 1200, scout: 1100, signal_keeper: 1200, cartographer: 1300, trail_maker: 1600, archivist: 1500 };
export const TEAM_BURST_TICKS = 300;          // one shared ability per 15 s per team
export const ABILITY = { pulse: 24, sight: 120, beacon: 240, fold: 160, bridge: 400 } as const;
export const ROLE_INFO: Record<Role, { name: string; ability: string; how: string; seconds: number }> = {
  solo_pathfinder: { name: 'Solo Pathfinder', ability: 'Compass Pulse', how: 'A ring marks the next objective for a moment.', seconds: 60 },
  scout: { name: 'Scout', ability: 'Sightline', how: 'Shows every fork ahead and when timed gates open, for 6 seconds.', seconds: 55 },
  signal_keeper: { name: 'Signal Keeper', ability: 'Rally Light', how: 'Plants a lantern beacon your team can see for 12 seconds.', seconds: 60 },
  cartographer: { name: 'Cartographer', ability: 'Map Fold', how: 'Unfolds a zoomed overview of the leg for 8 seconds.', seconds: 65 },
  trail_maker: { name: 'Trail Maker', ability: 'Bridge Strip', how: 'Unrolls a temporary bridge at a marked socket.', seconds: 80 },
  archivist: { name: 'Archivist', ability: 'Evidence Shelf', how: 'Pins the latest revealed clue on every teammate’s screen.', seconds: 75 },
};
export const DURATION_MINUTES = [10, 15, 20, 30, 45] as const;
export const WINDOWS_FOR: Record<number, number> = { 10: 6, 15: 9, 20: 12, 30: 18, 45: 26 };
export const COUNTDOWN_SECONDS = 10; export const CHECKPOINT_SECONDS = 3;
export const MIN_WINDOWS = 3;
export const MAX_BATCH = 24; export const MAX_INPUT_RATE = 14;
export const FORMAT_COPY: Record<import('./domain').Format, { name: string; blurb: string }> = {
  split_route: { name: 'Split-Route Sprint', blurb: 'After every clue the team votes on a road: shorter, steadier or scenic. Every road reaches the checkpoint.' },
  signal_relay: { name: 'Signal Relay', blurb: 'Carry one lantern flag to the relay post the clue names. Hand it to a teammate when you meet.' },
  atlas_circuit: { name: 'Atlas Circuit', blurb: 'Stamp the landmarks in the order the clue gives. A wrong stamp only costs a short pause.' },
};
export const DIFFICULTY_COPY = { easy: 'Easy: signposted forks, no timed gates.', normal: 'Normal: some timed gates that never harm you.', challenge: 'Challenge: more gates and a longer scenic detour.' } as const;
