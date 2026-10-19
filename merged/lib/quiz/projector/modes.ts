/** The registry of the ten projector games: what the gallery, setup wizard and host console show. Pure data, English only. */
import type { GameKey, L10n } from './types';

export type ModeInfo = {
  key: GameKey; name: L10n; tagline: L10n; objective: L10n; style: L10n; cooperative: boolean;
  /** palette tokens used by the CSS scene (never random gradients) */
  accent: string; paper: string; ink: string;
  defaultMinutes: number; minTeams: number; maxTeams: number;
  /** what this game rewards the class for knowing */
  skillRule: L10n; art: string;
};
export const MODES: Record<GameKey, ModeInfo> = {
  empire_race: {
    key: 'empire_race', cooperative: false, accent: '#ffd23f', paper: '#f4e3b8', ink: '#2a1b0a', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'empire',
    name: { en: 'Empire Race' },
    tagline: { en: 'Claim the hex map, bridge the rivers, hold your capital.' },
    objective: { en: 'Own the most land when the sun sets.' },
    style: { en: 'Competitive · territory strategy' },
    skillRule: { en: 'Every verified answer is planning energy; the team decides where to spend it.' },
  },
  boss_battle: {
    key: 'boss_battle', cooperative: true, accent: '#ff5d4a', paper: '#2b1d2e', ink: '#fff4d6', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'boss',
    name: { en: 'Boss Battle' },
    tagline: { en: 'The whole class against a clockwork giant. Strike, shield, repair.' },
    objective: { en: 'Break the boss before it breaks the class.' },
    style: { en: 'Cooperative · raid' },
    skillRule: { en: 'Weak-point topics deal bonus damage, so the class learns what the boss is weak to.' },
  },
  escape_room: {
    key: 'escape_room', cooperative: true, accent: '#3ec8e8', paper: '#14313d', ink: '#e9fbff', defaultMinutes: 45, minTeams: 2, maxTeams: 8, art: 'escape',
    name: { en: 'Escape Room' },
    tagline: { en: 'Inspect, combine, unlock. Every answer opens a clue, a lock or a door.' },
    objective: { en: 'Get everyone through the last door.' },
    style: { en: 'Cooperative · point-and-click puzzle' },
    skillRule: { en: 'Rewards are information and access, never points.' },
  },
  treasure_vault: {
    key: 'treasure_vault', cooperative: false, accent: '#7bd88f', paper: '#1f3a2e', ink: '#f2ffe9', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'vault',
    name: { en: 'Treasure Vault' },
    tagline: { en: 'Earn shaped keys for each skill and crack the right door.' },
    objective: { en: 'Bank the biggest haul before the vault closes.' },
    style: { en: 'Competitive · lock and key' },
    skillRule: { en: 'One key shape per skill, so mastery of different topics matters.' },
  },
  risk_ladder: {
    key: 'risk_ladder', cooperative: false, accent: '#b78bff', paper: '#241a3a', ink: '#f6efff', defaultMinutes: 20, minTeams: 2, maxTeams: 8, art: 'ladder',
    name: { en: 'Risk Ladder' },
    tagline: { en: 'Climb, bank or review. You see what a fall costs before you choose.' },
    objective: { en: 'Reach the summit with points safely banked.' },
    style: { en: 'Competitive · push-your-luck' },
    skillRule: { en: 'Harder questions sit higher; a review question can earn a shield.' },
  },
  auction_house: {
    key: 'auction_house', cooperative: false, accent: '#ffc56c', paper: '#402355', ink: '#fff0ce', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'auction',
    name: { en: 'Auction House' },
    tagline: { en: 'Bid sealed paddles on mystery lots. The gavel reveals who paid what.' },
    objective: { en: 'Finish with the most points and prizes.' },
    style: { en: 'Competitive · sealed bidding' },
    skillRule: { en: 'Correct answers earn bidding points; blueprints add income and a full set of prize kinds earns a bonus.' },
  },
  territory_war: {
    key: 'territory_war', cooperative: false, accent: '#8bdfad', paper: '#204d48', ink: '#ebffe0', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'territory',
    name: { en: 'Territory War' },
    tagline: { en: 'Capture squares, breach walls and keep every flag connected to your headquarters.' },
    objective: { en: 'Hold the most valuable connected territory.' },
    style: { en: 'Competitive · grid strategy' },
    skillRule: { en: 'Correct answers become war points; every move shows its cost and result before you commit.' },
  },
  lucky_factory: {
    key: 'lucky_factory', cooperative: false, accent: '#52e6c4', paper: '#244950', ink: '#fff9d4', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'factory',
    name: { en: 'Lucky Factory' },
    tagline: { en: 'Build a production line, read the public shift forecast and ship goods.' },
    objective: { en: 'Ship the most goods.' },
    style: { en: 'Competitive · production line' },
    skillRule: { en: 'Correct answers become parts for machines; four different working kinds earn a line bonus.' },
  },
  pirate_voyage: {
    key: 'pirate_voyage', cooperative: false, accent: '#72d9ff', paper: '#174a6a', ink: '#fff7d4', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'pirate',
    name: { en: 'Pirate Voyage' },
    tagline: { en: 'Chart islands, dodge storms and dock at the home harbour before rivals raid your cargo.' },
    objective: { en: 'Bank the most treasure.' },
    style: { en: 'Competitive · sea navigation' },
    skillRule: { en: 'Correct answers become sailing points; cargo is only safe once it is banked at home.' },
  },
  final_showdown: {
    key: 'final_showdown', cooperative: false, accent: '#ff8fba', paper: '#402460', ink: '#fff3da', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'showdown',
    name: { en: 'Final Showdown' },
    tagline: { en: 'Qualifiers, pressure, comeback and a final. Choose steady, double or shield every turn.' },
    objective: { en: 'Finish with the highest score; nobody is eliminated.' },
    style: { en: 'Competitive · staged tournament' },
    skillRule: { en: 'Correct answers score by stage; bold stakes pay double and shields cancel setbacks.' },
  },
};
export const MODE_LIST: ModeInfo[] = Object.values(MODES);
export const isGameKey = (k: unknown): k is GameKey => typeof k === 'string' && k in MODES;
