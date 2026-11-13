/* How each mode's own events are acted out. For every event a mode produces there is a short list of clips that logically match what
   just happened in that mode's design (a wrong Reverse Evolution answer re-assembles the gadget; a Decipher check holds its breath).
   The three creatures take different entries from the same list, so the same event looks different on each. */
import { CLIPS } from './clips';
import type { CharacterMode, Payload } from './types';

export const MODE_EVENT_CLIPS: Record<string, string[]> = {
  /* Survival: scout, assess, prioritise, assign, advance */
  'survival-camp-enter': ['sv-dawn-stretch', 'sv-scan-water', 'sv-sunset-gaze'],
  'survival-task-select': ['sv-chop-wood', 'sv-gather-berries', 'sv-fetch-water-carry'],
  'survival-advance-day': ['sv-dawn-stretch', 'sv-night-watch', 'sv-sunset-gaze'],
  'survival-food-low': ['sv-hungry-belly', 'sv-forage-ground', 'sv-gather-berries'],
  'survival-water-low': ['sv-thirsty-pant', 'sv-scan-water', 'sv-fetch-water-carry'],
  'survival-weather-shift': ['sv-cover-from-rain', 'sv-shiver-cold', 'sv-sunset-gaze'],
  'survival-member-injured': ['sv-tend-injured', 'sv-fire-out-panic', 'sv-night-watch'],
  'survival-member-recovers': ['sv-warm-by-fire', 'sv-dawn-stretch', 'sv-camp-cheer'],
  'survival-objective-progress': ['sv-stack-wood', 'sv-test-shelter', 'sv-warm-by-fire'],
  'survival-run-complete': ['sv-camp-cheer', 'sv-sunset-gaze', 'sv-rest-sleep'],
  /* Civilization (Lifelines): districts, programmes, services, links, seasons, crises, decisions */
  'civilization-enter': ['cv-survey-district', 'cv-unfurl-chapter', 'cv-read-forecast'],
  'civilization-entry-choice': ['cv-decide-choice', 'cv-weigh-resources', 'cv-study-scroll'],
  'civilization-chapter-select': ['cv-study-scroll', 'cv-unfurl-chapter', 'cv-survey-district'],
  'civilization-chapter-start': ['cv-unfurl-chapter', 'cv-lay-foundation', 'cv-survey-district'],
  'civilization-task-assign': ['cv-queue-programme', 'cv-hammer-build', 'cv-route-service'],
  'civilization-resource-change': ['cv-weigh-resources', 'cv-turn-season', 'cv-hand-out-food'],
  'civilization-crisis': ['cv-crisis-alarm', 'cv-read-forecast', 'cv-weigh-resources'],
  'civilization-decision': ['cv-decide-choice', 'cv-set-policy', 'cv-study-scroll'],
  'civilization-chapter-complete': ['cv-settlement-cheer', 'cv-unfurl-chapter', 'cv-trade-handshake'],
  'civilization-campaign-complete': ['cv-settlement-cheer', 'cv-trade-handshake', 'cv-unfurl-chapter'],
  /* Archaeology: grid, survey, excavate, find, record context, analyse, hypothesise, report */
  'archaeology-enter': ['ar-stake-grid', 'ar-survey-square', 'ar-dust-off-hat'],
  'archaeology-site-phase': ['ar-date-phase', 'ar-record-stratigraphy', 'ar-compare-parallels'],
  'archaeology-excavate': ['ar-trowel-scrape', 'ar-excavate-layer', 'ar-sieve-soil'],
  'archaeology-find-revealed': ['ar-spot-find', 'ar-brush-clean-find', 'ar-lift-find-gently'],
  'archaeology-find-selected': ['ar-analyze-lens', 'ar-measure-context', 'ar-sketch-artifact'],
  'archaeology-context-recorded': ['ar-label-bag', 'ar-photograph-find', 'ar-measure-context'],
  'archaeology-hypothesis-added': ['ar-hypothesize-function', 'ar-date-phase', 'ar-compare-parallels'],
  'archaeology-evidence-linked': ['ar-link-evidence', 'ar-analyze-lens', 'ar-compare-parallels'],
  'archaeology-report-submit': ['ar-write-report', 'ar-submit-report', 'ar-budget-worry'],
  'archaeology-report-complete': ['ar-submit-report', 'ar-dust-off-hat', 'ar-carry-finds-tray'],
  /* Historical Escape Room: stations (ratio, sequence, match, code), hints, the final door */
  'escape-enter-room': ['er-look-around-room', 'er-read-inscription', 'er-light-torch'],
  'escape-inspect-mechanism': ['er-inspect-gears', 'er-trace-mechanism', 'er-listen-wall'],
  'escape-clue-found': ['er-read-inscription', 'er-peek-hint', 'er-collect-key'],
  'escape-object-collected': ['er-collect-key', 'er-match-item-target', 'er-lift-together'],
  'escape-object-used': ['er-match-item-target', 'er-keypad-code', 'er-reorder-steps'],
  'escape-mechanism-adjusted': ['er-turn-gear', 'er-reorder-steps', 'er-pull-lever'],
  'escape-guess-wrong': ['er-buzzer-flinch', 'er-pace-and-think', 'er-rattle-door'],
  'escape-guess-right': ['er-click-solved', 'er-stamp-station-solved', 'er-turn-gear'],
  'escape-door-unlocked': ['er-door-opens', 'er-pull-lever', 'er-keypad-code'],
  'escape-episode-complete': ['er-escape-run-out', 'er-door-opens', 'er-stamp-station-solved'],
  /* Decipher: count glyphs, compare, anchor on the clue, assign meanings, check */
  'decipher-enter': ['dc-study-tablet', 'dc-rubbing', 'dc-rotate-tablet'],
  'decipher-tutorial-step': ['dc-tutorial-nod', 'dc-read-line', 'dc-context-anchor'],
  'decipher-glyph-inspect': ['dc-trace-glyph', 'dc-tally-frequency', 'dc-compare-glyphs'],
  'decipher-glyph-assigned': ['dc-assign-meaning', 'dc-pick-concept', 'dc-jot-notes'],
  'decipher-assignment-replaced': ['dc-replace-assignment', 'dc-lose-track', 'dc-pick-concept'],
  'decipher-check-used': ['dc-hold-breath-check', 'dc-peek-answer', 'dc-count-dots'],
  'decipher-partial-correct': ['dc-partial-nod', 'dc-spot-pattern', 'dc-compare-notes'],
  'decipher-check-poor': ['dc-poor-wince', 'dc-lose-track', 'dc-peek-answer'],
  'decipher-solution-correct': ['dc-read-aloud-solved', 'dc-spot-pattern', 'dc-assign-meaning'],
  'decipher-tablet-complete': ['dc-read-aloud-solved', 'dc-jot-notes', 'dc-compare-notes'],
  /* Alien Archaeology: crated specimens, hypotheses on axes, a calibrated confidence slider, a field report */
  'alien-enter': ['al-open-crate', 'al-awe-structure', 'al-listen-to-hum'],
  'alien-specimen-select': ['al-weigh-in-hands', 'al-measure-specimen', 'al-compare-anatomy'],
  'alien-specimen-reveal': ['al-open-crate', 'al-awe-structure', 'al-flinch-from-glow'],
  'alien-specimen-inspect': ['al-study-specimen', 'al-scan-wand', 'al-sniff-sample'],
  'alien-hypothesis-set': ['al-set-axis-dial', 'al-suspect-truth', 'al-sketch-xeno-form'],
  'alien-confidence-adjust': ['al-confidence-slide-right', 'al-confidence-slide-left', 'al-calibrate-balance'],
  'alien-evidence-conflict': ['al-evidence-clash', 'al-revise-theory', 'al-suspect-truth'],
  'alien-model-fit-improves': ['al-model-fit-click', 'al-calibrate-balance', 'al-overconfident-puff'],
  'alien-report-submit': ['al-file-field-report', 'al-await-verdict', 'al-underconfident-shrink'],
  'alien-expedition-complete': ['al-awe-structure', 'al-debate-theory', 'al-model-fit-click'],
  /* Reverse Evolution: take a complex object apart, node by node, down to raw materials */
  'reverse-enter': ['re-ponder-target', 're-hold-up-gadget', 're-ask-what-made-this'],
  'reverse-target-select': ['re-hold-up-gadget', 're-ponder-target', 're-examine-circuit'],
  'reverse-run-start': ['re-unscrew', 're-pry-casing', 're-peel-layer'],
  'reverse-node-expand': ['re-expand-node', 're-pull-component', 're-descend-tree'],
  'reverse-option-select': ['re-tap-option', 're-pick-several', 're-examine-circuit'],
  'reverse-answer-correct': ['re-correct-drop-down', 're-pull-component', 're-submit-answer'],
  'reverse-answer-wrong': ['re-wrong-reassemble', 're-show-me', 're-ask-what-made-this'],
  'reverse-answer-reveal': ['re-show-me', 're-trace-line-down', 're-peel-layer'],
  'reverse-chain-depth': ['re-descend-tree', 're-count-chain-depth', 're-trace-line-down'],
  'reverse-run-complete': ['re-reach-raw-material', 're-complete-bow', 're-smelt-mime'],
  /* Minimum Path: a graph of discoveries; choose each next node, count steps, backtrack, compare with the shortest route */
  'minpath-enter': ['mp-read-map', 'mp-plant-start-flag', 'mp-browse-missions'],
  'minpath-open-run': ['mp-read-map', 'mp-plant-start-flag', 'mp-plant-target-flag'],
  'minpath-chapter-select': ['mp-flip-chapter-page', 'mp-browse-missions', 'mp-read-map'],
  'minpath-mission-select': ['mp-browse-missions', 'mp-plant-target-flag', 'mp-flip-chapter-page'],
  'minpath-node-choose': ['mp-weigh-neighbours', 'mp-step-to-node', 'mp-walk-the-edge'],
  'minpath-path-backtrack': ['mp-backtrack-step', 'mp-dead-end', 'mp-detour-groan'],
  'minpath-hint-request': ['mp-squint-at-hint', 'mp-trace-path-finger', 'mp-count-edges'],
  'minpath-solution-open': ['mp-compare-with-solution', 'mp-compare-lengths', 'mp-trace-path-finger'],
  'minpath-optimal-path': ['mp-optimal-flourish', 'mp-wave-the-flag', 'mp-race-to-flag'],
  'minpath-mission-complete': ['mp-wave-the-flag', 'mp-reached-but-long', 'mp-export-save'],
  /* Main Evolution's bench: rail, techniques, exhibit drawer, graph, archive, timeline, the corner question */
  'inventory-open': ['me-browse-inventory', 'me-filter-search', 'me-browse-inventory'],
  'inventory-pick-item': ['me-drag-from-rail', 'craft-pick-first', 'craft-pick-second'],
  'inventory-drag-item': ['me-drag-from-rail', 'craft-select-random', 'me-drag-from-rail'],
  'inventory-drop-bench': ['me-drop-on-bench', 'craft-put-back', 'me-drop-on-bench'],
  'inventory-filter-change': ['me-filter-search', 'craft-search-backpack', 'me-filter-search'],
  'inventory-hide-used-toggle': ['me-browse-inventory', 'craft-search-backpack', 'me-filter-search'],
  'bench-two-items-near': ['craft-bring-together', 'craft-push-together', 'craft-point-two'],
  'bench-cluster-formed': ['craft-struggle-heavy', 'craft-combine', 'craft-pretend-understand'],
  'technique-selected': ['me-pick-technique', 'me-smash-stone', 'me-brush-surface'],
  'technique-produced': ['me-smash-stone', 'me-pull-fibre', 'me-separate-pieces'],
  'item-inspect': ['me-open-exhibit', 'craft-pretend-understand', 'me-open-exhibit'],
  'item-study': ['me-open-exhibit', 'me-read-hint-line', 'me-open-exhibit'],
  'graph-node-focus': ['me-follow-graph-edge', 'me-follow-graph-edge', 'me-follow-graph-edge'],
  'graph-route-follow': ['me-follow-graph-edge', 'craft-point-two', 'me-follow-graph-edge'],
  'archive-search': ['me-filter-search', 'craft-search-backpack', 'me-filter-search'],
  'timeline-era-select': ['me-scrub-timeline', 'me-scrub-timeline', 'me-scrub-timeline'],
  'craft-invalid-pair': ['craft-fail-scratch', 'craft-swap-secret', 'craft-merge-fail'],
  'craft-known-route': ['craft-point-two', 'craft-bring-together', 'craft-merge-success'],
};

/** Events whose exact meaning depends on what the player just did: the clip follows the payload. */
export function payloadClip(eventId: string, payload?: Payload): string | null {
  const p = payload ?? {};
  if (eventId === 'survival-task-select') {
    return ({ 'fetch-water': 'sv-fetch-water-carry', 'gather-food': 'sv-gather-berries', 'gather-wood': 'sv-chop-wood', 'tend-fire': 'sv-tend-fire', 'build-shelter': 'sv-build-leanto', rest: 'sv-rest-sleep' } as Record<string, string>)[String(p.task)] ?? null;
  }
  if (eventId === 'civilization-task-assign') {
    return ({ 'queue-programme': 'cv-raise-wall', gather: 'cv-harvest-sweep', 'set-policies': 'cv-set-policy', 'set-routing': 'cv-route-service', 'build-link': 'cv-build-link', 'repair-link': 'cv-repair-link' } as Record<string, string>)[String(p.command)] ?? null;
  }
  if (eventId === 'archaeology-hypothesis-added') return p.field === 'phase' ? 'ar-date-phase' : 'ar-hypothesize-function';
  if (eventId === 'archaeology-excavate' || eventId === 'archaeology-context-recorded') return null;
  return null;
}

const PREFIXES: Record<CharacterMode, string[]> = {
  survival: ['sv-'], civilization: ['cv-', 'me-', 'craft-'], archaeology: ['ar-'], 'escape-room': ['er-'], decipher: ['dc-'],
  'alien-archaeology': ['al-'], 'reverse-evolution': ['re-'], 'minimum-path': ['mp-'], 'main-evolution': ['me-', 'craft-'],
};

/** Every clip that is the acting of this mode (what the crew does there when left alone, and what its events draw from). */
export const modeOwnClips = (mode: CharacterMode): string[] => CLIPS.filter(c => PREFIXES[mode].some(p => c.id.startsWith(p))).map(c => c.id);
