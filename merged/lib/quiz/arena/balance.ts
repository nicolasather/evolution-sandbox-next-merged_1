import type { Format, Helper, Role, Weighting } from './domain';
/** Every number that shapes play lives here. One spendable currency: quiz points. Nothing here rewards speed of answering. */
export const RULES_VERSION = 1;
export const TICK_MS = 50;
export const MAX_TEAMS = 4;
export const MAX_SEATS_PER_TEAM = 5;
export const MAX_SEATS_PER_ROOM = 20;
export const WORLD = 1200;
export const CENTER = WORLD / 2;
export const PLAYER_R = 18;
export const SPEED = 8;                      // units per tick = 160 units/s for EVERY role (roles differ by ability, never by baseline speed)
export const CARRY_FACTOR = 0.85;            // banner carry slows by 15%
export const MAX_CARRY = 3;
export const CAPTURE_TICKS = 80;             // 4 s uncontested
export const NEUTRAL_RESET_TICKS = 80;       // an empty zone forgets progress after 4 s
export const PULSE_HOLD_TICKS = 40;          // own a zone 2 s → one capped score pulse per ownership cycle
export const ZONE_R = 40;
export const CP_R = 42; export const BASE_R = 62; export const VAULT_R = 58; export const PICKUP_R = 34;
export const TELEGRAPH_TICKS = 40;           // 2 s warning before the active pair rotates
export const NAV_TELEGRAPH_TICKS = 100;      // Navigator / route reveal: 5 s
export const BANNER_RESET_TICKS = 160;       // a dropped banner returns to the centre after 8 s
export const HANDOFF_R = 90;
export const IDLE_TICKS = 200;               // 10 s without any input heartbeat → no influence on the objective
export const EPISODE_CAP = 100;              // objective points one team can earn in one episode (normalised, anti-snowball)
export const POINTS = { capture: 6, pulse: 10, handin: 25, crystal: 4, hot: 10 } as const;
export const QUESTION_POINTS = 100;
export const CRYSTAL_RESPAWN_TICKS = 220;
export const ROLE_COOLDOWN: Record<Role, number> = { runner: 360, sentinel: 520, builder: 480, trickster: 600, navigator: 480 };
export const ABILITY_TICKS = { dash: 30, shelter: 60, bridge: 140, decoy: 40, scan: 100 } as const;
export const DASH_FACTOR = 1.6;
export const BRIDGE_RANGE = 130;
export const SHELTER_RANGE = 90;
export const WEIGHTS: Record<Weighting, number> = { study: 0.75, balanced: 0.6, game: 0.5 }; // never below 0.5 quiz
export const MIN_QUIZ_WEIGHT = 0.5;
export const HELPER_COST: Record<Helper, number> = { trail_speed: 40, capture_marker: 60, route_reveal: 30, deposit_guidance: 40 };
export const HELPER_COPY: Record<Helper, { name: string; blurb: string; effect: string }> = {
  trail_speed: { name: 'Trail boots', blurb: 'Everyone on your team walks 10% faster for one episode.', effect: '+10% speed' },
  capture_marker: { name: 'Capture marker', blurb: 'Zone captures finish 10% sooner for your team for one episode.', effect: '−10% capture time' },
  route_reveal: { name: 'Route reveal', blurb: 'Your team sees the next zone rotation 5 seconds early for one episode.', effect: '5 s early warning' },
  deposit_guidance: { name: 'Deposit guide', blurb: 'A glowing arrow to your vault, and a 15% wider drop-off ring for one episode.', effect: '+15% drop-off ring' },
};
export const BOOST_SPEED = 1.1; export const BOOST_CAPTURE = 0.9; export const BOOST_DEPOSIT = 1.15;
export const DURATION_MINUTES = [5, 10, 15, 20, 30, 45] as const;
/** Live episode length in seconds, by match length (45–90 s for 15 min, 70–140 s for 30–45 min). */
export const EPISODE_SECONDS: Record<number, number> = { 5: 40, 10: 55, 15: 70, 20: 85, 30: 100, 45: 120 };
export const PLANNING_SECONDS = 18; export const REVEAL_SECONDS = 9; export const RESULT_SECONDS = 7; export const COUNTDOWN_SECONDS = 3;
export const ROTATION_SECONDS = 20;
export const MAX_BATCH = 24;                 // intent entries a student may hold on the server
export const MAX_INPUT_RATE = 14;            // intent writes per second per seat
export const FORMAT_COPY: Record<Format, { name: string; blurb: string }> = {
  control: { name: 'Control Circuit', blurb: 'Stand in glowing zones to claim them. Two of three zones are live at a time and they rotate on a visible countdown.' },
  relay: { name: 'Banner Relay', blurb: 'Carry the banner through three gates and hand it in at your base. Pass it to a teammate to keep it safe.' },
  crystal: { name: 'Crystal Dash', blurb: 'Collect glowing crystals, carry up to three, and drop them at your vault. Middle crystals are worth more.' },
};
export const MAX_NAME = 24;
