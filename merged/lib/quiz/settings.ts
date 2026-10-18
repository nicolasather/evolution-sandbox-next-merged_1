/** Quiz-level settings chosen in the seven-step creator. Pure and shared by client + server (no server-only imports).
 *  Stored in `quiz_settings` (migration 004) and mirrored in the device draft, so an unconnected deployment still works. */
import { z } from 'zod';
import { MODIFIERS, type Flow, type Modifier, type PlayMode } from './types';
import { allowedFlows, defaultFlow, modifierAvailability, type GameModeId, GAME_MODE_IDS, gameModeSupports } from './compatibility';

export const VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const visibilityLabels: Record<Visibility, string> = {
  public: 'Public — listed in Quiz Library',
  unlisted: 'Unlisted — only people with the link',
  private: 'Private — only you',
};

export const COVER_ART = ['arena', 'shelves', 'podium', 'controller', 'media', 'scoreboard'] as const;
export type CoverArt = (typeof COVER_ART)[number];
export const coverArtSrc: Record<CoverArt, string> = {
  arena: '/quiz/art/hero-arena.svg',
  shelves: '/quiz/art/library-shelves.svg',
  podium: '/quiz/art/results-podium.svg',
  controller: '/quiz/art/ref-mode-cards.svg',
  media: '/quiz/art/ref-question-media.svg',
  scoreboard: '/quiz/art/ref-host-scoreboard.svg',
};
export const coverArtLabels: Record<CoverArt, string> = {
  arena: 'Arena', shelves: 'Shelves', podium: 'Podium', controller: 'Controller cases', media: 'Media filmstrip', scoreboard: 'Scoreboard',
};

export const THEMES = ['volt', 'coral-lime', 'violet', 'paper', 'contrast'] as const;
export type ThemeId = (typeof THEMES)[number];
export const themeInfo: Record<ThemeId, { label: string; blurb: string; vars: Record<string, string>; art: string }> = {
  volt: { label: 'Electric Volt', blurb: 'Yellow and cyan on ink.', art: '/quiz/art/theme-volt.svg',
    vars: { '--th-bg': '#0B1018', '--th-panel': '#17202B', '--th-accent': '#FFD52F', '--th-accent2': '#16C9EF', '--th-text': '#F1F4F8', '--th-ink': '#08121C' } },
  'coral-lime': { label: 'Coral & Lime', blurb: 'Warm coral with lime highlights.', art: '/quiz/art/theme-coral.svg',
    vars: { '--th-bg': '#1a0e14', '--th-panel': '#2a1620', '--th-accent': '#FF386A', '--th-accent2': '#B5ED44', '--th-text': '#FFF6E2', '--th-ink': '#08121C' } },
  violet: { label: 'Violet Night', blurb: 'Purple and coral after dark.', art: '/quiz/art/theme-violet.svg',
    vars: { '--th-bg': '#120c24', '--th-panel': '#1d1538', '--th-accent': '#8D5BFF', '--th-accent2': '#FF386A', '--th-text': '#F4F0FF', '--th-ink': '#08121C' } },
  paper: { label: 'Paper Print', blurb: 'Light cream, ink outlines. Good for bright rooms.', art: '/quiz/art/theme-paper.svg',
    vars: { '--th-bg': '#FFF8EA', '--th-panel': '#FFFFFF', '--th-accent': '#FF386A', '--th-accent2': '#16C9EF', '--th-text': '#08121C', '--th-ink': '#08121C' } },
  contrast: { label: 'High Contrast', blurb: 'Black and white with one yellow accent.', art: '/quiz/art/theme-contrast.svg',
    vars: { '--th-bg': '#000000', '--th-panel': '#0a0a0a', '--th-accent': '#FFEB3B', '--th-accent2': '#FFFFFF', '--th-text': '#FFFFFF', '--th-ink': '#000000' } },
};

export type Rules = {
  playMethod: PlayMode;
  flow: Flow;
  /** null = untimed */
  questionSeconds: number | null;
  durationSeconds: number;
  modifiers: Modifier[];
  slotLimit: number;
  teamNames: string[];
  /** default points applied to new questions */
  basePoints: number;
  /** add extra seconds for long prompts / media, per question kind */
  adaptiveTiming: boolean;
  /** play only N questions picked at random from the quiz (per-session seed); 0 = all */
  poolSize: number;
  /** repeatable practice with explanations; never counts toward competitive results */
  practice: boolean;
};

export type GameOptions = {
  /** Tower Defense: base health. Obstacle Survival: hit points. Clue Racing: unused. */
  lives: number;
  /** How quickly hazards / waves escalate. */
  pace: 'relaxed' | 'normal' | 'fast';
  /** Clue Racing: checkpoints on the track. */
  trackLength: number;
};
export const defaultGameOptions = (): GameOptions => ({ lives: 3, pace: 'normal', trackLength: 10 });

export type QuizSettings = {
  v: 1;
  gameMode: GameModeId;
  coverArt: CoverArt;
  coverMediaId?: string;
  coverAlt?: string;
  subject: string;
  grade: string;
  tags: string[];
  visibility: Visibility;
  rules: Rules;
  /** mode-specific tuning; ignored by Classic Quiz */
  gameOptions: GameOptions;
  theme: { id: ThemeId; reducedMotion: boolean; muted: boolean };
  /** remembered per creator; Basic shows only required options */
  advanced: boolean;
};

export function defaultRules(mode: PlayMode = 'online'): Rules {
  return {
    playMethod: mode, flow: defaultFlow(mode), questionSeconds: 30, durationSeconds: 1800, modifiers: [], slotLimit: 3,
    teamNames: mode === 'classroom' ? ['Team 1', 'Team 2'] : [], basePoints: 100, adaptiveTiming: false, poolSize: 0, practice: false,
  };
}

export function defaultSettings(gameMode: GameModeId = 'classic_quiz'): QuizSettings {
  return {
    v: 1, gameMode, coverArt: 'arena', subject: '', grade: '', tags: [], visibility: 'unlisted',
    rules: defaultRules(gameMode === 'classic_quiz' ? 'online' : 'solo'), gameOptions: defaultGameOptions(),
    theme: { id: 'volt', reducedMotion: false, muted: false }, advanced: false,
  };
}

/** Drop everything the chosen game mode / play method cannot use. The same function runs on the client and the server. */
export function normalizeSettings(input: QuizSettings): QuizSettings {
  const s: QuizSettings = { ...input, rules: { ...input.rules } };
  const r = s.rules;
  s.gameOptions = { ...defaultGameOptions(), ...s.gameOptions };
  const methods = (['solo', 'classroom', 'online'] as PlayMode[]).filter((m) => gameModeSupports(s.gameMode, m));
  if (!methods.includes(r.playMethod)) r.playMethod = methods[0] ?? 'solo';
  if (!allowedFlows(r.playMethod, s.gameMode).includes(r.flow)) r.flow = defaultFlow(r.playMethod, s.gameMode);
  r.modifiers = [...new Set(r.modifiers)].filter((m) => modifierAvailability(r.playMethod, r.flow, m, s.gameMode).ok);
  if (r.playMethod === 'classroom') {
    if (r.teamNames.length < 2) r.teamNames = ['Team 1', 'Team 2'];
  } else r.teamNames = [];
  return s;
}

const methodEnum = z.enum(['solo', 'classroom', 'online']);
const flowEnum = z.enum(['synchronized', 'round_robin', 'independent']);
const modifierEnum = z.enum(MODIFIERS as unknown as [Modifier, ...Modifier[]]);
const tag = z.string().trim().min(1).max(30);

export const settingsSchema = z.object({
  v: z.literal(1).default(1),
  gameMode: z.enum(GAME_MODE_IDS as unknown as [GameModeId, ...GameModeId[]]).default('classic_quiz'),
  coverArt: z.enum(COVER_ART).default('arena'),
  coverMediaId: z.string().uuid().optional(),
  coverAlt: z.string().max(300).optional(),
  subject: z.string().trim().max(60).default(''),
  grade: z.string().trim().max(30).default(''),
  tags: z.array(tag).max(8).default([]),
  visibility: z.enum(VISIBILITIES).default('unlisted'),
  rules: z.object({
    playMethod: methodEnum,
    flow: flowEnum,
    questionSeconds: z.number().int().min(5).max(600).nullable(),
    durationSeconds: z.number().int().min(60).max(7200),
    modifiers: z.array(modifierEnum).max(9),
    slotLimit: z.number().int().min(1).max(100),
    teamNames: z.array(z.string().trim().min(1).max(40)).max(8),
    basePoints: z.number().int().min(0).max(10000),
    adaptiveTiming: z.boolean(),
    poolSize: z.number().int().min(0).max(200),
    practice: z.boolean(),
  }).strict(),
  gameOptions: z.object({
    lives: z.number().int().min(1).max(9),
    pace: z.enum(['relaxed', 'normal', 'fast']),
    trackLength: z.number().int().min(5).max(30),
  }).strict().default({ lives: 3, pace: 'normal', trackLength: 10 }),
  theme: z.object({ id: z.enum(THEMES), reducedMotion: z.boolean(), muted: z.boolean() }).strict().default({ id: 'volt', reducedMotion: false, muted: false }),
  advanced: z.boolean().default(false),
}).strict();

/** Parse stored/untrusted settings, falling back to safe defaults rather than throwing (older drafts have none). */
export function parseSettings(raw: unknown): QuizSettings {
  const r = settingsSchema.safeParse(raw);
  if (!r.success) return defaultSettings();
  return normalizeSettings(r.data as QuizSettings);
}

/** What a stranger who opens a published quiz may learn about its settings. Rules that affect play are public by design. */
export function publicSettings(s: QuizSettings) {
  return { gameMode: s.gameMode, coverArt: s.coverArt, subject: s.subject, grade: s.grade, tags: s.tags, theme: s.theme, gameOptions: s.gameOptions, rules: { ...s.rules } };
}
