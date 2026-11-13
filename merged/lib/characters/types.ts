/* Shared types for the character crew. Pure data: nothing here touches a save, the engine or the DOM. */

export type CharacterId = 'kip' | 'vex' | 'orra';
export const CHARACTER_IDS: readonly CharacterId[] = ['kip', 'vex', 'orra'] as const;

export type CharacterMode =
  | 'main-evolution' | 'survival' | 'civilization' | 'archaeology'
  | 'escape-room' | 'decipher' | 'alien-archaeology'
  | 'reverse-evolution' | 'minimum-path';

export const CHARACTER_MODES: readonly CharacterMode[] = [
  'main-evolution', 'survival', 'civilization', 'archaeology', 'escape-room',
  'decipher', 'alien-archaeology', 'reverse-evolution', 'minimum-path',
] as const;

export type EventSource = 'ui' | 'game' | 'guide' | 'scheduler' | 'crew';
export type Payload = Readonly<Record<string, string | number | boolean | null>>;

export interface CharacterEvent {
  id: string;
  mode: CharacterMode;
  source: EventSource;
  payload?: Payload;
  at: number;
}

export type Priority = 'critical' | 'major' | 'normal' | 'ambient';
export const PRIORITY_RANK: Record<Priority, number> = { critical: 3, major: 2, normal: 1, ambient: 0 };

export type CharacterActionId =
  | 'bench.tryRandomMerge' | 'bench.returnItemHome' | 'bench.requestHint'
  | 'mode.requestHint' | 'mode.showGuideTarget' | 'visual.returnOwnedItemProxy';

export const ACTION_ALLOWLIST: readonly CharacterActionId[] = [
  'bench.tryRandomMerge', 'bench.returnItemHome', 'bench.requestHint',
  'mode.requestHint', 'mode.showGuideTarget', 'visual.returnOwnedItemProxy',
] as const;

export interface CharacterResponse {
  eventId: string;
  characterId: CharacterId;
  clipId: string;
  priority: Priority;
  weight: number;
  cooldownMs: number;
  maySpeak: boolean;
  dialogueLineId?: string;
  actionId?: CharacterActionId;
}

/* ── animation clips ─────────────────────────────────────────────────── */

export type Joint = 'root' | 'body' | 'head' | 'eye' | 'armL' | 'armR' | 'legs' | 'tail' | 'prop' | 'fx';
export const JOINTS: readonly Joint[] = ['root', 'body', 'head', 'eye', 'armL', 'armR', 'legs', 'tail', 'prop', 'fx'] as const;

/** Small line-drawn effect marks around the head (stars, tears, zzz, thought bubble…), switched on by a clip while it plays. */
export type FxKind = 'smile' | 'laugh' | 'frown' | 'tears' | 'stars' | 'zzz' | 'bubble' | 'sweat' | 'anger' | 'hearts' | 'question' | 'exclaim' | 'sparkle' | 'swirl' | 'note' | 'blush' | 'dust';

/** x/y in hundredths of the creature's size, r in degrees, sx/sy scale, o opacity. Missing = identity. */
export interface Xf { x?: number; y?: number; r?: number; sx?: number; sy?: number; o?: number }
export type Pose = Partial<Record<Joint, Xf>>;
export interface Keyframe { at: number; pose: Pose }

export type ClipCategory =
  | 'idle' | 'walk' | 'jump' | 'emotion' | 'cheer' | 'guide' | 'object'
  | 'prank' | 'mode' | 'fight' | 'social' | 'entrance';

export type PropKind = 'item' | 'proxy' | 'sticker' | 'pillow' | 'map' | 'slate' | 'blueprint' | 'brush' | 'confetti' | 'portal' | 'cosmetic' | 'marker';

export interface ClipDef {
  id: string;
  category: ClipCategory;
  durationMs: number;
  keyframes: Keyframe[];
  /** Extra roles of a pair / trio clip: played on the same shared timeline as role 0. */
  roles?: Keyframe[][];
  cast: 1 | 2 | 3;
  easing: string;
  loop: boolean;
  interruptible: boolean;
  exitPose: 'idle';
  reducedMotionFallback: { durationMs: number; pose: Pose };
  characters: readonly CharacterId[];
  /** Net horizontal travel in creature widths (committed to the stage position at the end). */
  travel?: number;
  prop?: PropKind;
  /** effect marks shown for the duration of the clip */
  fx?: FxKind[];
  /** the clip ends off-stage / hidden: keep its last pose until the next clip for that creature starts */
  holdEnd?: boolean;
  beats: number;
  description: string;
}

export interface DialogueLine {
  id: string;
  speakerId: CharacterId;
  text: string;
  voiceCueId: string;
}

export interface SpeechRequest {
  speakerId: CharacterId;
  lineId: string;
  text: string;
  priority: Priority;
  expiresAt: number;
  voiceCueId: string;
}

/** The persisted crew save (evo.characters.v1). Plain serialisable data only. */
export interface CrewSettings {
  enabled: boolean;
  perCharacter: Record<CharacterId, boolean>;
  autonomousTurns: boolean;
  objectPranks: boolean;
  answerPranks: boolean;
  ambientSkits: boolean;
  dialogue: boolean;
  /** Never forces motion on: only ever *reduces* it further than the OS preference. */
  reducedMotion: boolean;
}

export interface CrewSave {
  v: 1;
  /** roster unlocks: character id → epoch ms of the unlock ceremony; presence = unlocked and ceremony seen. */
  unlocked: Partial<Record<CharacterId, number>>;
  /** the ceremony has played for this character (so it never plays twice) */
  ceremonySeen: Partial<Record<CharacterId, boolean>>;
  settings: CrewSettings;
  /** the player has read the "the crew may try a real combination" note */
  disclosureSeen: boolean;
  /** cosmetic relationship counters: trust, rivalry, patience, debt per ordered pair key like "kip>vex" */
  affinity: Record<string, { trust: number; rivalry: number; patience: number; debt: number }>;
  counters: Record<string, number>;
}
