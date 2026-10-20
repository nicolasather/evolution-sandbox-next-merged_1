/** The registry of the ten projector games: what the gallery, setup wizard and host console show. Pure data, English only. */
import type { GameKey, L10n } from './types';

export type ModeInfo = {
  key: GameKey; name: L10n; /** one functional line: what the teams do (no slogans) */ tagline: L10n; /** the win condition, stated plainly */ objective: L10n; style: L10n; cooperative: boolean;
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
    tagline: { en: 'Answers give energy; spend it to claim, fortify and bridge zones on a hex map.' },
    objective: { en: 'Win: hold the most land when the turns run out.' },
    style: { en: 'Competitive · territory strategy' },
    skillRule: { en: 'Every verified answer is planning energy; the team decides where to spend it.' },
  },
  boss_battle: {
    key: 'boss_battle', cooperative: true, accent: '#ff5d4a', paper: '#2b1d2e', ink: '#fff4d6', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'boss',
    name: { en: 'Boss Battle' },
    tagline: { en: 'All teams fight one boss: choose strike, shield or repair, then answer to make it happen.' },
    objective: { en: 'Win: bring the boss to zero before the class health runs out.' },
    style: { en: 'Cooperative · raid' },
    skillRule: { en: 'Weak-point topics deal bonus damage, so the class learns what the boss is weak to.' },
  },
  escape_room: {
    key: 'escape_room', cooperative: true, accent: '#3ec8e8', paper: '#14313d', ink: '#e9fbff', defaultMinutes: 45, minTeams: 2, maxTeams: 8, art: 'escape',
    name: { en: 'Escape Room' },
    tagline: { en: 'Answers solve puzzles that give items; items open locks and doors.' },
    objective: { en: 'Win: open the last door before time runs out.' },
    style: { en: 'Cooperative · point-and-click puzzle' },
    skillRule: { en: 'Rewards are information and access, never points.' },
  },
  treasure_vault: {
    key: 'treasure_vault', cooperative: false, accent: '#7bd88f', paper: '#1f3a2e', ink: '#f2ffe9', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'vault',
    name: { en: 'Treasure Vault' },
    tagline: { en: 'Answers earn key pieces shaped by topic; matching keys open vault doors.' },
    objective: { en: 'Win: bank the most treasure by the end.' },
    style: { en: 'Competitive · lock and key' },
    skillRule: { en: 'One key shape per skill, so mastery of different topics matters.' },
  },
  risk_ladder: {
    key: 'risk_ladder', cooperative: false, accent: '#b78bff', paper: '#241a3a', ink: '#f6efff', defaultMinutes: 20, minTeams: 2, maxTeams: 8, art: 'ladder',
    name: { en: 'Risk Ladder' },
    tagline: { en: 'Each turn choose climb, bank or review; the cost of a fall is shown first.' },
    objective: { en: 'Win: the most banked points (or the summit, by mission).' },
    style: { en: 'Competitive · push-your-luck' },
    skillRule: { en: 'Harder questions sit higher; a review question can earn a shield.' },
  },
  auction_house: {
    key: 'auction_house', cooperative: false, accent: '#ffc56c', paper: '#402355', ink: '#fff0ce', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'auction',
    name: { en: 'Auction House' },
    tagline: { en: 'Answers earn bid points; teams place sealed bids on lots with hidden values.' },
    objective: { en: 'Win: the highest total of points, prizes and collection bonuses.' },
    style: { en: 'Competitive · sealed bidding' },
    skillRule: { en: 'Correct answers earn bidding points; blueprints add income and a full set of prize kinds earns a bonus.' },
  },
  territory_war: {
    key: 'territory_war', cooperative: false, accent: '#8bdfad', paper: '#204d48', ink: '#ebffe0', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'territory',
    name: { en: 'Territory War' },
    tagline: { en: 'Answers earn supply points; spend them to capture, breach and fortify grid squares.' },
    objective: { en: 'Win: the most valuable territory connected to your headquarters.' },
    style: { en: 'Competitive · grid strategy' },
    skillRule: { en: 'Correct answers become war points; every move shows its cost and result before you commit.' },
  },
  lucky_factory: {
    key: 'lucky_factory', cooperative: false, accent: '#52e6c4', paper: '#244950', ink: '#fff9d4', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'factory',
    name: { en: 'Lucky Factory' },
    tagline: { en: 'Answers earn parts; build and repair machines that ship goods each shift.' },
    objective: { en: 'Win: the most goods shipped.' },
    style: { en: 'Competitive · production line' },
    skillRule: { en: 'Correct answers become parts for machines; four different working kinds earn a line bonus.' },
  },
  pirate_voyage: {
    key: 'pirate_voyage', cooperative: false, accent: '#72d9ff', paper: '#174a6a', ink: '#fff7d4', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'pirate',
    name: { en: 'Pirate Voyage' },
    tagline: { en: 'Answers earn sailing points; sail between islands, load treasure and dock to bank it.' },
    objective: { en: 'Win: the most treasure banked at the home harbour.' },
    style: { en: 'Competitive · sea navigation' },
    skillRule: { en: 'Correct answers become sailing points; cargo is only safe once it is banked at home.' },
  },
  final_showdown: {
    key: 'final_showdown', cooperative: false, accent: '#ff8fba', paper: '#402460', ink: '#fff3da', defaultMinutes: 30, minTeams: 2, maxTeams: 8, art: 'showdown',
    name: { en: 'Final Showdown' },
    tagline: { en: 'Four stages; before each answer choose steady, double or shield. Nobody is eliminated.' },
    objective: { en: 'Win: the highest score after the final stage.' },
    style: { en: 'Competitive · staged tournament' },
    skillRule: { en: 'Correct answers score by stage; bold stakes pay double and shields cancel setbacks.' },
  },
};
export const MODE_LIST: ModeInfo[] = Object.values(MODES);
export const isGameKey = (k: unknown): k is GameKey => typeof k === 'string' && k in MODES;
