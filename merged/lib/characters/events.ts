/* The 130-event interaction catalogue. Each row: id, scope (a mode or 'global'), tone, priority, whether a line may be spoken.
   The tone decides which family of acting each character reaches for (see interactions.ts); the scope is where it is produced. */
import type { CharacterMode, Priority } from './types';

export type Tone =
  | 'greet' | 'transition' | 'look' | 'idle' | 'curious' | 'poke' | 'special' | 'pickup' | 'work' | 'hover'
  | 'celebrate' | 'big' | 'fail' | 'confused' | 'locked' | 'point' | 'think' | 'hint' | 'question' | 'worry'
  | 'relief' | 'progress' | 'complete' | 'enter' | 'observe' | 'crew-arrive' | 'crew-disagree' | 'crew-compete'
  | 'crew-steal' | 'crew-help' | 'crew-copy' | 'crew-bump' | 'crew-tug' | 'crew-cheer' | 'crew-bye';

export interface EventSpec {
  id: string;
  scope: CharacterMode | 'global';
  tone: Tone;
  priority: Priority;
  speak: boolean;
  /** Needs the real result to be known (never guessed from a click). */
  needsResult?: boolean;
  /** Conditions under which no creature can respond, documented and tested. Empty for all current rows. */
  ineligible?: string;
}

const M = 'main-evolution', S = 'survival', C = 'civilization', A = 'archaeology', E = 'escape-room', D = 'decipher',
  X = 'alien-archaeology', R = 'reverse-evolution', P = 'minimum-path', G = 'global';

type Row = [string, EventSpec['scope'], Tone, Priority, 0 | 1];
const ROWS: Row[] = [
  ['app-enter', G, 'greet', 'normal', 0], ['app-return-focus', G, 'greet', 'ambient', 0], ['mode-switch', G, 'transition', 'normal', 0],
  ['view-switch', M, 'look', 'ambient', 0], ['page-scroll', G, 'idle', 'ambient', 0], ['pointer-near-character', G, 'curious', 'ambient', 0],
  ['pointer-leaves-character', G, 'idle', 'ambient', 0], ['character-click', G, 'poke', 'normal', 1], ['character-double-click', G, 'special', 'normal', 0],
  ['character-keyboard-activate', G, 'poke', 'normal', 1],
  ['inventory-open', M, 'look', 'ambient', 0], ['inventory-close', M, 'idle', 'ambient', 0], ['inventory-pick-item', M, 'pickup', 'ambient', 0],
  ['inventory-drag-item', M, 'pickup', 'ambient', 0], ['inventory-drop-bench', M, 'work', 'ambient', 0], ['inventory-drop-home', M, 'work', 'ambient', 0],
  ['inventory-filter-change', M, 'look', 'ambient', 0], ['inventory-hide-used-toggle', M, 'look', 'ambient', 0], ['bench-item-hover', M, 'hover', 'ambient', 0],
  ['bench-empty-idle', M, 'idle', 'ambient', 0],
  ['bench-two-items-near', M, 'curious', 'ambient', 0], ['bench-cluster-formed', M, 'curious', 'normal', 0], ['craft-valid-new', M, 'big', 'major', 1],
  ['craft-known-route', M, 'celebrate', 'normal', 0], ['craft-invalid-pair', M, 'fail', 'normal', 1], ['craft-locked-era', M, 'locked', 'normal', 0],
  ['craft-locked-tier', M, 'locked', 'normal', 0], ['craft-locked-region', M, 'locked', 'normal', 0], ['technique-selected', M, 'work', 'ambient', 0],
  ['technique-produced', M, 'celebrate', 'normal', 0],
  ['item-inspect', M, 'observe', 'normal', 0], ['item-study', M, 'observe', 'normal', 0], ['hint-request', M, 'hint', 'critical', 1],
  ['hint-dismiss', M, 'idle', 'ambient', 0], ['graph-node-focus', M, 'observe', 'ambient', 0], ['graph-route-follow', M, 'point', 'normal', 0],
  ['archive-search', M, 'look', 'ambient', 0], ['timeline-era-select', M, 'look', 'normal', 0], ['question-open', M, 'question', 'normal', 0],
  ['question-answer-correct-or-wrong', M, 'question', 'major', 1],
  ['survival-camp-enter', S, 'enter', 'normal', 0], ['survival-task-select', S, 'work', 'ambient', 0], ['survival-advance-day', S, 'progress', 'normal', 0],
  ['survival-food-low', S, 'worry', 'major', 1], ['survival-water-low', S, 'worry', 'major', 1], ['survival-weather-shift', S, 'look', 'normal', 0],
  ['survival-member-injured', S, 'worry', 'major', 1], ['survival-member-recovers', S, 'relief', 'normal', 0], ['survival-objective-progress', S, 'progress', 'normal', 0],
  ['survival-run-complete', S, 'complete', 'major', 1],
  ['civilization-enter', C, 'enter', 'normal', 0], ['civilization-entry-choice', C, 'work', 'normal', 0], ['civilization-chapter-select', C, 'look', 'ambient', 0],
  ['civilization-chapter-start', C, 'enter', 'normal', 0], ['civilization-task-assign', C, 'work', 'ambient', 0], ['civilization-resource-change', C, 'progress', 'normal', 0],
  ['civilization-crisis', C, 'worry', 'major', 1], ['civilization-decision', C, 'think', 'normal', 0], ['civilization-chapter-complete', C, 'complete', 'major', 1],
  ['civilization-campaign-complete', C, 'big', 'major', 1],
  ['archaeology-enter', A, 'enter', 'normal', 0], ['archaeology-site-phase', A, 'look', 'normal', 0], ['archaeology-excavate', A, 'work', 'ambient', 0],
  ['archaeology-find-revealed', A, 'curious', 'normal', 0], ['archaeology-find-selected', A, 'observe', 'ambient', 0], ['archaeology-context-recorded', A, 'work', 'normal', 0],
  ['archaeology-hypothesis-added', A, 'think', 'normal', 0], ['archaeology-evidence-linked', A, 'progress', 'normal', 0], ['archaeology-report-submit', A, 'think', 'major', 0],
  ['archaeology-report-complete', A, 'complete', 'major', 1],
  ['escape-enter-room', E, 'enter', 'normal', 0], ['escape-inspect-mechanism', E, 'observe', 'ambient', 0], ['escape-clue-found', E, 'curious', 'normal', 0],
  ['escape-object-collected', E, 'pickup', 'normal', 0], ['escape-object-used', E, 'work', 'normal', 0], ['escape-mechanism-adjusted', E, 'work', 'ambient', 0],
  ['escape-guess-wrong', E, 'fail', 'normal', 1], ['escape-guess-right', E, 'celebrate', 'major', 1], ['escape-door-unlocked', E, 'big', 'major', 1],
  ['escape-episode-complete', E, 'complete', 'major', 1],
  ['decipher-enter', D, 'enter', 'normal', 0], ['decipher-tutorial-step', D, 'look', 'ambient', 0], ['decipher-glyph-inspect', D, 'observe', 'ambient', 0],
  ['decipher-glyph-assigned', D, 'work', 'ambient', 0], ['decipher-assignment-replaced', D, 'confused', 'ambient', 0], ['decipher-check-used', D, 'think', 'normal', 0],
  ['decipher-partial-correct', D, 'progress', 'normal', 0], ['decipher-check-poor', D, 'fail', 'normal', 1], ['decipher-solution-correct', D, 'big', 'major', 1],
  ['decipher-tablet-complete', D, 'complete', 'major', 1],
  ['alien-enter', X, 'enter', 'normal', 0], ['alien-specimen-select', X, 'observe', 'ambient', 0], ['alien-specimen-reveal', X, 'curious', 'normal', 0],
  ['alien-specimen-inspect', X, 'observe', 'normal', 0], ['alien-hypothesis-set', X, 'think', 'normal', 0], ['alien-confidence-adjust', X, 'work', 'ambient', 0],
  ['alien-evidence-conflict', X, 'confused', 'normal', 1], ['alien-model-fit-improves', X, 'progress', 'normal', 0], ['alien-report-submit', X, 'think', 'major', 0],
  ['alien-expedition-complete', X, 'complete', 'major', 1],
  ['reverse-enter', R, 'enter', 'normal', 0], ['reverse-target-select', R, 'look', 'normal', 0], ['reverse-run-start', R, 'enter', 'normal', 0],
  ['reverse-node-expand', R, 'work', 'ambient', 0], ['reverse-option-select', R, 'think', 'ambient', 0], ['reverse-answer-correct', R, 'celebrate', 'normal', 1],
  ['reverse-answer-wrong', R, 'fail', 'normal', 1], ['reverse-answer-reveal', R, 'observe', 'normal', 0], ['reverse-chain-depth', R, 'progress', 'normal', 0],
  ['reverse-run-complete', R, 'complete', 'major', 1],
  ['minpath-enter', P, 'enter', 'normal', 0], ['minpath-open-run', P, 'enter', 'normal', 0], ['minpath-chapter-select', P, 'look', 'ambient', 0],
  ['minpath-mission-select', P, 'look', 'ambient', 0], ['minpath-node-choose', P, 'work', 'ambient', 0], ['minpath-path-backtrack', P, 'confused', 'ambient', 0],
  ['minpath-hint-request', P, 'hint', 'critical', 1], ['minpath-solution-open', P, 'observe', 'normal', 0], ['minpath-optimal-path', P, 'celebrate', 'major', 1],
  ['minpath-mission-complete', P, 'complete', 'major', 1],
  ['crew-arrive-together', G, 'crew-arrive', 'normal', 0], ['crew-disagree', G, 'crew-disagree', 'ambient', 0], ['crew-compete', G, 'crew-compete', 'ambient', 0],
  ['crew-steal-prop', G, 'crew-steal', 'ambient', 0], ['crew-help-fallen-peer', G, 'crew-help', 'ambient', 0], ['crew-copy-move', G, 'crew-copy', 'ambient', 0],
  ['crew-accidental-collision', G, 'crew-bump', 'ambient', 0], ['crew-tug-of-war', G, 'crew-tug', 'ambient', 0], ['crew-group-celebrate', G, 'crew-cheer', 'major', 0],
  ['crew-group-goodbye', G, 'crew-bye', 'normal', 0],
];

export const EVENTS: readonly EventSpec[] = ROWS.map(([id, scope, tone, priority, speak]) => ({
  id, scope, tone, priority, speak: !!speak,
  needsResult: id === 'question-answer-correct-or-wrong' || /correct|wrong|poor|optimal|conflict/.test(id) || undefined,
}));

const BY_ID = new Map(EVENTS.map(e => [e.id, e]));
export const EVENT_IDS: readonly string[] = EVENTS.map(e => e.id);
export const getEvent = (id: string): EventSpec | undefined => BY_ID.get(id);

/** The producer coverage of each mode: which catalogue events its components are instrumented to emit. */
export const EVENTS_OF_MODE = (mode: CharacterMode): EventSpec[] => EVENTS.filter(e => e.scope === mode);
