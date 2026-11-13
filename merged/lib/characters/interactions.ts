/* The response mappings: for each of the 130 events, a character-specific clip, priority, weight, cooldown, optional line and
   optional (allowlisted) action. 130 × 3 = 390 records, built from explicit per-character acting pools keyed by tone, with
   hand-written overrides for the moments that matter. Nothing here decides a game result. */
import { EVENTS, type EventSpec, type Tone } from './events';
import { LINE_BY_TONE } from './dialogue';
import { CHARACTER_IDS, type CharacterActionId, type CharacterId, type CharacterMode, type CharacterResponse } from './types';
import { CHARACTERS } from './registry';
import { MODE_EVENT_CLIPS } from './modeEvents';


type Pool = Partial<Record<Tone, string[]>>;

const KIP: Pool = {
  greet: ['emotion-delighted', 'entrance-small-hop', 'cheer-one-arm', 'idle-look-at-user'],
  transition: ['walk-short', 'idle-look-right', 'entrance-peek-edge'],
  look: ['idle-look-left', 'idle-look-right', 'idle-curious-cock', 'idle-look-up'],
  idle: ['idle-blink-slow', 'idle-foot-tap', 'idle-shell-adjust', 'idle-rocking'],
  curious: ['emotion-curious', 'idle-head-tilt-left', 'object-spot'],
  poke: ['emotion-delighted', 'jump-small', 'cheer-one-arm', 'idle-startle-ready'],
  special: ['jump-spin', 'cheer-spin-burst', 'jump-double'],
  pickup: ['object-spot', 'object-approach', 'guide-point-item'],
  work: ['object-inspect-close', 'object-tap-test', 'guide-demonstrate-combine', 'object-polish'],
  hover: ['idle-curious-cock', 'emotion-curious', 'object-spot'],
  celebrate: ['cheer-two-arm', 'cheer-hop-clap', 'cheer-applause'],
  big: ['cheer-running-circle', 'cheer-hop-clap', 'cheer-two-arm'],
  fail: ['emotion-confused', 'emotion-apologetic', 'fall-forward-safe'],
  confused: ['emotion-confused', 'emotion-deep-confused'],
  locked: ['emotion-disappointed', 'guide-shrug-maybe', 'emotion-worried'],
  point: ['guide-point-path', 'guide-point-right', 'guide-point-item'],
  think: ['guide-think-pose', 'guide-count-on-fingers'],
  hint: ['guide-demonstrate-tap', 'guide-point-button'],
  question: ['emotion-curious', 'guide-shrug-maybe', 'idle-curious-cock'],
  worry: ['emotion-worried', 'emotion-apologetic'],
  relief: ['emotion-relieved', 'cheer-quiet-pride'],
  progress: ['cheer-one-arm', 'guide-nod-correct', 'emotion-proud'],
  complete: ['cheer-parade', 'cheer-victory-pose', 'jump-triple'],
  enter: ['entrance-walk-on', 'idle-look-left', 'jump-small'],
  observe: ['object-inspect-close', 'emotion-curious', 'idle-look-down'],
  'crew-arrive': ['entrance-drop-in'], 'crew-disagree': ['duet-shared-confusion'], 'crew-compete': ['duet-both-grab-item'],
  'crew-steal': ['duet-both-grab-item'], 'crew-help': ['duet-help-up'], 'crew-copy': ['duet-copycat'], 'crew-bump': ['fight-bonk-shell'],
  'crew-tug': ['fight-tug-of-war'], 'crew-cheer': ['cheer-group-sync'], 'crew-bye': ['exit-wave'],
};

const VEX: Pool = {
  greet: ['prank-vanish-pop', 'entrance-slide-in', 'prank-pop-from-inventory', 'entrance-intro-spin'],
  transition: ['walk-hurry', 'prank-hide-behind-item', 'entrance-peek-edge'],
  look: ['idle-look-left', 'emotion-suspicious', 'idle-look-up', 'idle-listen'],
  idle: ['emotion-bored', 'emotion-impatient', 'idle-foot-tap', 'idle-sleepy-dip', 'idle-random-fidget'],
  curious: ['emotion-scheming', 'emotion-suspicious', 'walk-sneak'],
  poke: ['prank-fake-out', 'prank-innocent-whistle', 'idle-startle-ready', 'emotion-suspicious'],
  special: ['jump-backflip-comic', 'jump-sideflip', 'fall-upside-down'],
  pickup: ['walk-sneak', 'object-spot', 'prank-pocket-item'],
  work: ['object-shake-test', 'object-sniff-test', 'prank-fake-out', 'object-throw-arc'],
  hover: ['prank-pocket-item', 'emotion-scheming', 'walk-sneak'],
  celebrate: ['prank-tiny-victory-dance', 'fight-victory-flex', 'jump-pogo'],
  big: ['walk-stop-skid', 'prank-tiny-victory-dance', 'jump-spin'],
  fail: ['prank-innocent-whistle', 'emotion-scheming', 'prank-trip-on-own-feet', 'emotion-guilty'],
  confused: ['emotion-suspicious', 'prank-fake-serious'],
  locked: ['emotion-bored', 'emotion-frustrated', 'prank-fake-serious'],
  point: ['prank-wrong-point', 'guide-point-left', 'guide-point-up'],
  think: ['emotion-scheming', 'prank-fake-serious'],
  hint: ['prank-decoy-answer', 'prank-wrong-point'],
  question: ['prank-decoy-answer', 'prank-wrong-point', 'emotion-scheming'],
  worry: ['walk-retreat-peek', 'emotion-guilty'],
  relief: ['prank-innocent-whistle', 'emotion-relieved'],
  progress: ['jump-small', 'fight-feint-left', 'emotion-proud'],
  complete: ['prank-tiny-victory-dance', 'fight-victory-flex', 'jump-big'],
  enter: ['entrance-slide-in', 'prank-pop-from-inventory', 'walk-zigzag'],
  observe: ['walk-around-item', 'object-turn-over', 'emotion-suspicious'],
  'crew-arrive': ['entrance-slide-in'], 'crew-disagree': ['trio-pass-the-blame'], 'crew-compete': ['fight-face-off'],
  'crew-steal': ['prank-swap-places'], 'crew-help': ['fight-stumble-stack'], 'crew-copy': ['duet-mirror-moves'], 'crew-bump': ['fight-stumble-stack'],
  'crew-tug': ['duet-tug-and-release'], 'crew-cheer': ['cheer-relay'], 'crew-bye': ['exit-hide-behind-edge'],
};

const ORRA: Pool = {
  greet: ['guide-nod-correct', 'entrance-walk-on', 'idle-look-at-user'],
  transition: ['walk-heavy', 'idle-look-left', 'transform-focus-mode'],
  look: ['idle-look-right', 'idle-look-down', 'transform-focus-mode', 'idle-listen'],
  idle: ['idle-tail-sway', 'idle-breathe', 'idle-blink-double', 'idle-shell-adjust'],
  curious: ['emotion-curious', 'object-inspect-close', 'idle-curious-cock'],
  poke: ['guide-nod-correct', 'emotion-suspicious', 'idle-look-at-user'],
  special: ['mode-record-discovery', 'transform-costume-reveal', 'cheer-quiet-pride'],
  pickup: ['object-spot', 'object-measure', 'guide-point-item'],
  work: ['object-measure', 'mode-archaeology-record-note', 'object-turn-over', 'object-polish'],
  hover: ['object-measure', 'object-inspect-close', 'idle-curious-cock'],
  celebrate: ['cheer-quiet-pride', 'guide-nod-correct', 'emotion-proud'],
  big: ['cheer-quiet-pride', 'cheer-silent-clap', 'cheer-rare-find'],
  fail: ['guide-think-pose', 'emotion-suspicious', 'guide-gently-correct'],
  confused: ['guide-think-pose', 'emotion-confused'],
  locked: ['guide-gently-correct', 'guide-point-up', 'mode-civilization-blueprint'],
  point: ['guide-point-path', 'guide-point-right', 'mode-path-map-route'],
  think: ['guide-think-pose', 'guide-aha', 'guide-count-on-fingers'],
  hint: ['guide-point-button', 'guide-offer-hint'],
  question: ['guide-point-up', 'guide-think-pose', 'idle-listen'],
  worry: ['emotion-worried', 'guide-gently-correct'],
  relief: ['emotion-relieved', 'cheer-quiet-pride'],
  progress: ['guide-nod-correct', 'cheer-quiet-pride', 'mode-path-count-steps'],
  complete: ['cheer-silent-clap', 'cheer-quiet-pride', 'emotion-proud'],
  enter: ['entrance-walk-on', 'transform-focus-mode', 'idle-look-right'],
  observe: ['object-inspect-close', 'object-measure', 'guide-think-pose'],
  'crew-arrive': ['entrance-walk-on'], 'crew-disagree': ['guide-think-pose'], 'crew-compete': ['cheer-silent-clap'],
  'crew-steal': ['guide-gently-correct'], 'crew-help': ['fight-peacemaker-separate'], 'crew-copy': ['duet-copycat'], 'crew-bump': ['emotion-embarrassed'],
  'crew-tug': ['fight-peacemaker-separate'], 'crew-cheer': ['cheer-silent-clap'], 'crew-bye': ['trio-group-bow'],
};

const POOLS: Record<CharacterId, Pool> = { kip: KIP, vex: VEX, orra: ORRA };

/** Mode flavour: workaday events in a mode use that mode's acting, one clip per character. */
export const MODE_ACT: Partial<Record<CharacterMode, Record<CharacterId, string[]>>> = {
  survival: {
    kip: ['mode-survival-gather', 'mode-survival-build-shelter', 'act-carry-materials', 'act-dig', 'mode-survival-warm-hands'],
    vex: ['prank-hide-behind-item', 'walk-sneak', 'act-hide', 'act-flee-danger', 'item-kick'],
    orra: ['mode-survival-scan-horizon', 'mode-survival-warm-hands', 'act-inspect-map', 'act-defend'],
  },
  civilization: {
    kip: ['mode-civilization-assign-task', 'act-carry-materials', 'act-draw-diagram', 'guide-point-item'],
    vex: ['walk-around-item', 'prank-steal-spotlight', 'item-hide-behind-back', 'act-open-door'],
    orra: ['mode-civilization-blueprint', 'act-write', 'act-draw-diagram', 'act-inspect-map'],
  },
  archaeology: {
    kip: ['mode-archaeology-brush-dust', 'act-dig', 'object-brush', 'act-examine-artifact'],
    vex: ['prank-hide-behind-item', 'act-discover', 'item-hide-behind-back', 'emotion-scheming'],
    orra: ['mode-archaeology-record-note', 'act-write', 'act-examine-evidence', 'act-examine-artifact'],
  },
  'escape-room': {
    kip: ['mode-escape-turn-crank', 'act-lever', 'act-open-door', 'object-tap-test'],
    vex: ['mode-escape-listen-wall', 'act-lever', 'object-shake-test', 'act-open-door'],
    orra: ['act-read-clue', 'act-examine-evidence', 'mode-escape-listen-wall', 'act-connect-evidence'],
  },
  decipher: {
    kip: ['mode-decipher-trace-glyph', 'act-write', 'idle-curious-cock', 'act-read-clue'],
    vex: ['mode-decipher-compare-glyphs', 'prank-wrong-point', 'emote-roll-eyes', 'act-draw-diagram'],
    orra: ['mode-decipher-compare-glyphs', 'mode-decipher-trace-glyph', 'act-read-clue', 'act-connect-evidence'],
  },
  'alien-archaeology': {
    kip: ['mode-alien-scan-specimen', 'emotion-awe', 'act-examine-artifact', 'act-discover'],
    vex: ['emotion-suspicious', 'walk-around-item', 'act-hide', 'act-flee-danger'],
    orra: ['mode-alien-scan-specimen', 'mode-alien-circle-evidence', 'act-connect-evidence', 'act-examine-evidence'],
  },
  'reverse-evolution': {
    kip: ['mode-reverse-unpack', 'act-reverse', 'object-turn-over', 'act-carry-materials'],
    vex: ['prank-wrong-point', 'object-shake-test', 'act-reverse', 'silly-spin-out-of-control'],
    orra: ['mode-reverse-trace-dependency', 'mode-record-discovery', 'act-draw-diagram', 'act-reverse'],
  },
  'minimum-path': {
    kip: ['mode-path-count-steps', 'guide-point-path', 'act-inspect-map', 'move-skip'],
    vex: ['walk-zigzag', 'prank-wrong-point', 'move-sprint', 'act-inspect-map'],
    orra: ['mode-path-map-route', 'mode-path-count-steps', 'act-inspect-map', 'act-draw-diagram'],
  },
};
const MODE_TONES = new Set<Tone>(['work', 'observe', 'enter', 'look', 'progress', 'think']);

/** Hand-written overrides for the events that carry the most meaning: [eventId][character] → clipId. */
const OVERRIDE: Record<string, Partial<Record<CharacterId, string>>> = {
  'craft-valid-new': { kip: 'cheer-running-circle', vex: 'walk-stop-skid', orra: 'cheer-quiet-pride' },
  'craft-known-route': { kip: 'cheer-hop-clap', vex: 'fight-feint-left', orra: 'guide-point-path' },
  'craft-invalid-pair': { kip: 'emotion-confused', vex: 'prank-innocent-whistle', orra: 'guide-think-pose' },
  'question-open': { kip: 'idle-curious-cock', vex: 'prank-wrong-point', orra: 'guide-point-up' },
  'question-answer-correct-or-wrong': { kip: 'guide-nod-correct', vex: 'prank-fake-serious', orra: 'guide-nod-correct' },
  'app-enter': { kip: 'entrance-small-hop', vex: 'prank-vanish-pop', orra: 'entrance-walk-on' },
  'character-double-click': { kip: 'jump-spin', vex: 'jump-backflip-comic', orra: 'transform-costume-reveal' },
  'craft-locked-era': { kip: 'emotion-disappointed', vex: 'emotion-bored', orra: 'guide-point-up' },
  'survival-food-low': { kip: 'emotion-worried', vex: 'walk-retreat-peek', orra: 'mode-survival-scan-horizon' },
  'survival-water-low': { kip: 'emotion-worried', vex: 'walk-retreat-peek', orra: 'mode-survival-scan-horizon' },
  'civilization-campaign-complete': { kip: 'cheer-major-unlock', vex: 'cheer-victory-pose', orra: 'cheer-new-era' },
  'archaeology-find-revealed': { kip: 'mode-archaeology-brush-dust', vex: 'emotion-suspicious', orra: 'object-inspect-close' },
  'minpath-optimal-path': { kip: 'cheer-hop-clap', vex: 'fight-victory-flex', orra: 'cheer-silent-clap' },
  'reverse-chain-depth': { kip: 'mode-reverse-unpack', vex: 'object-turn-over', orra: 'mode-reverse-trace-dependency' },
  'escape-door-unlocked': { kip: 'act-open-door', vex: 'jump-big', orra: 'cheer-quiet-pride' },
  'escape-clue-found': { kip: 'act-read-clue', vex: 'emotion-suspicious', orra: 'act-examine-evidence' },
  'survival-member-injured': { kip: 'emotion-worried', vex: 'act-flee-danger', orra: 'act-defend' },
  'survival-run-complete': { kip: 'cheer-parade', vex: 'silly-celebrate-early', orra: 'adv-slowmo-celebrate' },
  'archaeology-excavate': { kip: 'act-dig', vex: 'item-hide-behind-back', orra: 'act-write' },
  'archaeology-context-recorded': { kip: 'act-write', vex: 'emote-roll-eyes', orra: 'act-draw-diagram' },
  'archaeology-evidence-linked': { kip: 'act-connect-evidence', vex: 'emotion-suspicious', orra: 'act-connect-evidence' },
  'alien-specimen-reveal': { kip: 'act-examine-artifact', vex: 'act-hide', orra: 'mode-alien-scan-specimen' },
  'alien-evidence-conflict': { kip: 'emote-scratch-head', vex: 'emote-laugh', orra: 'act-examine-evidence' },
  'decipher-solution-correct': { kip: 'cheer-hidden-find', vex: 'silly-celebrate-early', orra: 'cheer-rare-find' },
  'decipher-check-poor': { kip: 'emote-scratch-head', vex: 'emote-roll-eyes', orra: 'guide-think-pose' },
  'reverse-answer-wrong': { kip: 'emote-scratch-head', vex: 'silly-slip-fall', orra: 'act-reverse' },
  'reverse-answer-correct': { kip: 'emote-thumbs-up', vex: 'emote-laugh', orra: 'cheer-quiet-pride' },
  'minpath-path-backtrack': { kip: 'act-reverse', vex: 'silly-walk-into-wall', orra: 'act-reverse' },
  'minpath-mission-complete': { kip: 'cheer-parade', vex: 'silly-dance-terribly', orra: 'adv-slowmo-celebrate' },
  'civilization-crisis': { kip: 'act-defend', vex: 'act-flee-danger', orra: 'act-inspect-map' },
  'civilization-chapter-complete': { kip: 'cheer-parade', vex: 'move-skip', orra: 'act-draw-diagram' },
  'crew-arrive-together': { kip: 'entrance-drop-in', vex: 'entrance-slide-in', orra: 'entrance-walk-on' },
  'crew-group-celebrate': { kip: 'cheer-group-sync', vex: 'cheer-relay', orra: 'cheer-silent-clap' },
  'crew-group-goodbye': { kip: 'exit-group-parade', vex: 'exit-hide-behind-edge', orra: 'trio-group-bow' },
};

const ACTION: Record<string, Partial<Record<CharacterId, CharacterActionId>>> = {
  'bench-empty-idle': { kip: 'bench.tryRandomMerge' },
  'bench-item-hover': { vex: 'bench.returnItemHome' },
  'hint-request': { orra: 'mode.showGuideTarget' },
  'minpath-hint-request': { orra: 'mode.showGuideTarget' },
  'app-return-focus': { vex: 'visual.returnOwnedItemProxy' },
};

const COOLDOWN = { critical: 2000, major: 6000, normal: 12000, ambient: 25000 } as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function clipFor(ev: EventSpec, c: CharacterId): string {
  // what just happened in this mode decides the acting (the main bench keeps its hand-written celebrations)
  const mc = MODE_EVENT_CLIPS[ev.id];
  if (mc && (ev.scope !== 'main-evolution' || !OVERRIDE[ev.id]?.[c])) return mc[(hash(ev.id) + CHARACTER_IDS.indexOf(c)) % mc.length];
  const o = OVERRIDE[ev.id]?.[c];
  if (o) return o;
  if (ev.scope !== 'global' && MODE_TONES.has(ev.tone)) {
    const m = MODE_ACT[ev.scope]?.[c];
    if (m && hash(ev.id + c) % 5 !== 0) return m[hash(ev.id + c + 'm') % m.length];
  }
  const pool = POOLS[c][ev.tone];
  if (!pool?.length) throw new Error(`no ${c} pool for tone ${ev.tone}`);
  return pool[hash(ev.id + c) % pool.length];
}

export function buildInteractions(): CharacterResponse[] {
  const out: CharacterResponse[] = [];
  for (const ev of EVENTS) {
    for (const c of CHARACTER_IDS) {
      const aff = CHARACTERS[c].affinity[ev.tone] ?? 1;
      const line = ev.speak ? LINE_BY_TONE[c][ev.tone] : undefined;
      const actionId = ACTION[ev.id]?.[c];
      const r: CharacterResponse = {
        eventId: ev.id, characterId: c, clipId: clipFor(ev, c), priority: ev.priority,
        weight: Math.round(aff * 100) / 100,
        cooldownMs: actionId === 'bench.returnItemHome' ? 120_000 : COOLDOWN[ev.priority] + (c === 'orra' ? 3000 : 0),
        maySpeak: !!line, dialogueLineId: line, actionId,
      };
      out.push(r);
    }
  }
  return out;
}

export const INTERACTIONS: readonly CharacterResponse[] = buildInteractions();
const INDEX = new Map(INTERACTIONS.map(r => [`${r.eventId}|${r.characterId}`, r]));
export const responseFor = (eventId: string, c: CharacterId): CharacterResponse | undefined => INDEX.get(`${eventId}|${c}`);

/** The acting pool a character reaches for in a tone (used to pick a fresh clip when the first choice was just played). */
export const poolFor = (tone: Tone, c: CharacterId): readonly string[] => POOLS[c][tone] ?? [];
