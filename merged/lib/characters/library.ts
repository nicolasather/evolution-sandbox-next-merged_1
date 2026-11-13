/* The requested 215-animation library, in the player's own numbering and wording. Each entry names the clip that performs it.
   The test in __tests__/library.test.ts proves every entry resolves to a real clip, and that every clip works on all three rigs. */

export interface RequestedAnimation { n: number; name: string; clip: string; group: string }

const G = ['Basic movement', 'Emotional reactions', 'Silly animations', 'Item interactions', 'Crafting and merging', 'Character-to-character', 'Screen and player', 'Mode-specific', 'Advanced'] as const;
const ranges: [number, number, (typeof G)[number]][] = [[1, 20, G[0]], [21, 45, G[1]], [46, 70, G[2]], [71, 95, G[3]], [96, 115, G[4]], [116, 140, G[5]], [141, 160, G[6]], [161, 190, G[7]], [191, 215, G[8]]];
const groupOf = (n: number) => ranges.find(([a, b]) => n >= a && n <= b)![2];

const ROWS: [string, string][] = [
  // 1 Basic movement
  ['Idle breathing', 'idle-breathe'], ['Idle blinking', 'idle-blink-slow'], ['Looking left', 'idle-look-left'], ['Looking right', 'idle-look-right'],
  ['Looking up', 'idle-look-up'], ['Looking down', 'idle-look-down'], ['Walking', 'move-walk'], ['Walking backwards', 'walk-backwards'],
  ['Running', 'walk-hurry'], ['Sprinting', 'move-sprint'], ['Sneaking', 'walk-sneak'], ['Tiptoeing', 'walk-tip-toe'], ['Jumping', 'jump-big'],
  ['Double jumping', 'jump-double'], ['Hopping', 'move-hop'], ['Skipping happily', 'move-skip'], ['Sliding', 'move-slide'], ['Crawling', 'move-crawl'],
  ['Floating', 'move-float'], ['Turning around', 'walk-turn-in-place'],
  // 2 Emotional reactions
  ['Cheering', 'cheer-two-arm'], ['Applauding', 'cheer-applause'], ['Celebrating wildly', 'emote-celebrate-wild'], ['Happy dancing', 'emote-dance-happy'],
  ['Excited bouncing', 'emote-bounce-excited'], ['Laughing', 'emote-laugh'], ['Smiling', 'emote-smile'], ['Waving', 'guide-wave-over'],
  ['Giving thumbs up', 'emote-thumbs-up'], ['Blushing', 'emote-blush'], ['Looking confused', 'emotion-confused'], ['Scratching head', 'emote-scratch-head'],
  ['Tilting head', 'idle-head-tilt-left'], ['Looking suspicious', 'emotion-suspicious'], ['Being shocked', 'emote-shocked'], ['Jumping in surprise', 'emote-jump-surprise'],
  ['Crying', 'emote-cry'], ['Pouting', 'emote-pout'], ['Sulking', 'fight-loser-sulk'], ['Being disappointed', 'emotion-disappointed'], ['Getting angry', 'emote-angry'],
  ['Stomping feet', 'emotion-frustrated'], ['Rolling eyes', 'emote-roll-eyes'], ['Falling asleep', 'emote-fall-asleep'], ['Waking up suddenly', 'emote-wake-up'],
  // 3 Silly animations
  ['Falling upside down', 'fall-upside-down'], ['Spinning uncontrollably', 'silly-spin-out-of-control'], ['Tripping over nothing', 'prank-trip-on-own-feet'],
  ['Slipping and falling', 'silly-slip-fall'], ['Bouncing off the ground', 'silly-bounce-off-ground'], ['Getting stuck upside down', 'silly-stuck-upside-down'],
  ['Walking into a wall', 'silly-walk-into-wall'], ['Hitting their head', 'silly-hit-head'], ['Getting dizzy', 'silly-dizzy'], ['Seeing stars', 'silly-see-stars'],
  ['Shaking their head rapidly', 'silly-shake-head'], ['Doing a backflip', 'jump-backflip-comic'], ['Doing a front flip', 'silly-front-flip'],
  ['Attempting a backflip and failing', 'silly-backflip-fail'], ['Tumbling', 'fall-legs-over-head'], ['Rolling across the screen', 'silly-roll-across'],
  ['Pretending to faint', 'silly-fake-faint'], ['Dramatically collapsing', 'silly-collapse'], ['Freezing like a statue', 'silly-freeze-statue'],
  ['Hiding behind another character', 'pal-hide-behind'], ['Peeking from behind an object', 'prank-hide-behind-item'], ['Making funny faces', 'silly-funny-faces'],
  ['Dancing terribly', 'silly-dance-terribly'], ['Celebrating too early', 'silly-celebrate-early'], ['Getting embarrassed', 'emotion-embarrassed'],
  // 4 Item interactions
  ['Picking up an item', 'object-squat-pickup'], ['Carrying an item', 'object-carry-walk'], ['Carrying an oversized item', 'item-carry-oversized'],
  ['Dragging an item', 'item-drag'], ['Throwing an item', 'object-throw-arc'], ['Tossing an item upwards', 'item-toss-up'], ['Catching an item', 'object-catch'],
  ['Dropping an item', 'object-drop-soft'], ['Accidentally dropping an item', 'item-drop-accident'], ['Kicking an item', 'item-kick'], ['Pushing an item', 'item-push'],
  ['Pulling an item', 'item-pull'], ['Inspecting an item', 'object-inspect-close'], ['Smelling an item', 'object-sniff-test'], ['Tasting an item', 'item-taste'],
  ['Shaking an item', 'object-shake-test'], ['Hitting an item', 'item-hit'], ['Polishing an item', 'object-polish'], ['Cleaning an item', 'object-brush'],
  ['Hugging an item', 'item-hug'], ['Sleeping on an item', 'item-sleep-on'], ['Hiding an item behind their back', 'item-hide-behind-back'],
  ['Stealing an item playfully', 'prank-pocket-item'], ['Returning a stolen item', 'item-return-stolen'], ['Presenting an item to the player', 'item-present'],
  // 5 Crafting and merging
  ['Pointing towards two items', 'craft-point-two'], ['Suggesting two items for merging', 'guide-demonstrate-combine'], ['Picking up the first item', 'craft-pick-first'],
  ['Picking up the second item', 'craft-pick-second'], ['Carrying both items', 'craft-carry-both'], ['Bringing two items together', 'craft-bring-together'],
  ['Combining two items', 'craft-combine'], ['Pushing items together', 'craft-push-together'], ['Struggling to combine heavy items', 'craft-struggle-heavy'],
  ['Successfully completing a merge', 'craft-merge-success'], ['Celebrating a successful merge', 'cheer-hop-clap'], ['Being disappointed by a failed merge', 'craft-merge-fail'],
  ['Scratching head after a failed merge', 'craft-fail-scratch'], ['Randomly selecting items', 'craft-select-random'], ['Secretly swapping items', 'craft-swap-secret'],
  ['Putting an item back', 'craft-put-back'], ['Throwing an item into the backpack', 'prank-return-to-backpack'], ['Searching the backpack', 'craft-search-backpack'],
  ['Finding a hidden item', 'cheer-hidden-find'], ['Pretending to understand a recipe', 'craft-pretend-understand'],
  // 6 Character-to-character
  ['Waving at another character', 'pal-wave-at'], ['Greeting another character', 'pal-greet'], ['High-fiving', 'cheer-high-five'], ['Hugging', 'cheer-hug'],
  ['Shaking hands', 'fight-apology-handshake'], ['Arguing', 'duet-argue-over-map'], ['Pointing fingers at each other', 'pal-point-fingers'], ['Pushing each other', 'pal-push'],
  ['Playfully punching', 'pal-play-punch'], ['Chasing each other', 'pal-chase'], ['Running away', 'pal-run-away'], ['Fighting', 'pal-brawl'], ['Dodging attacks', 'fight-dodge-side'],
  ['Blocking attacks', 'fight-parry-stick'], ['Falling after being hit', 'pal-fall-after-hit'], ['Victory celebration', 'fight-victory-flex'], ['Losing a fight', 'fight-loser-sulk'],
  ['Stealing something from another character', 'pal-steal'], ['Fighting over an item', 'duet-both-grab-item'], ['Sharing an item', 'duet-pass-item'],
  ['Carrying another character', 'pal-carry'], ['Throwing another character', 'pal-throw'], ['Helping another character stand up', 'duet-help-up'],
  ['Laughing at another character', 'pal-laugh-at'], ['Sleeping beside each other', 'pal-sleep-beside'],
  // 7 Screen and player interactions
  ['Appearing on screen', 'entrance-drop-in'], ['Disappearing', 'screen-disappear'], ['Teleporting', 'screen-teleport'], ['Entering from the left', 'entrance-walk-on'],
  ['Entering from the right', 'screen-enter-right'], ['Jumping into the screen', 'screen-leap-in'], ['Peeking from the screen edge', 'entrance-peek-edge'],
  ['Looking directly at the player', 'idle-look-at-user'], ['Pointing at the player', 'screen-point-at-player'], ['Waving at the player', 'screen-wave-player'],
  ['Reacting to a click', 'screen-click-react'], ['Reacting to repeated clicks', 'screen-repeat-clicks'], ['Getting annoyed by repeated clicks', 'screen-annoyed-clicks'],
  ['Following the cursor', 'screen-follow-cursor'], ['Running away from the cursor', 'screen-flee-cursor'], ['Hiding behind UI elements', 'prank-hide-inventory'],
  ['Falling off the screen', 'screen-fall-off'], ['Climbing back onto the screen', 'screen-climb-back'], ['Bringing something back to the player', 'prank-return-with-owned-item'],
  ['Leaving temporarily and returning', 'screen-leave-return'],
  // 8 Mode-specific actions
  ['Giving a hint', 'guide-offer-hint'], ['Pointing towards a clue', 'guide-point-item'], ['Reading a clue', 'act-read-clue'], ['Examining evidence', 'act-examine-evidence'],
  ['Taking notes', 'mode-archaeology-record-note'], ['Writing something', 'act-write'], ['Drawing a diagram', 'act-draw-diagram'], ['Connecting two pieces of evidence', 'act-connect-evidence'],
  ['Solving a puzzle', 'guide-aha'], ['Celebrating a correct answer', 'cheer-rare-find'], ['Suggesting a wrong answer', 'prank-decoy-answer'], ['Looking uncertain about an answer', 'guide-shrug-maybe'],
  ['Pressing a button', 'guide-demonstrate-tap'], ['Turning a lever', 'act-lever'], ['Opening a door', 'act-open-door'], ['Inspecting a map', 'act-inspect-map'], ['Digging', 'act-dig'],
  ['Brushing away dirt', 'mode-archaeology-brush-dust'], ['Examining an archaeological artifact', 'act-examine-artifact'], ['Building something', 'mode-survival-build-shelter'],
  ['Carrying construction materials', 'act-carry-materials'], ['Gathering resources', 'mode-survival-gather'], ['Defending against danger', 'act-defend'],
  ['Running away from danger', 'act-flee-danger'], ['Hiding', 'act-hide'], ['Discovering something', 'act-discover'], ['Examining an alien object', 'mode-alien-scan-specimen'],
  ['Reversing an action', 'act-reverse'], ['Planning a route', 'mode-path-map-route'], ['Celebrating mission completion', 'cheer-parade'],
  // 9 Advanced animations
  ['Squashing and stretching', 'adv-squash-stretch'], ['Anticipation before jumping', 'adv-anticipate-jump'], ['Overshooting a landing', 'adv-overshoot-landing'],
  ['Recoiling from impact', 'adv-recoil'], ['Smooth turning', 'adv-smooth-turn'], ['Staggering', 'adv-stagger'], ['Wobbling', 'adv-wobble'], ['Elastic bouncing', 'adv-elastic-bounce'],
  ['Cartoon-style squash on landing', 'jump-land-heavy'], ['Slow-motion celebration', 'adv-slowmo-celebrate'], ['Dramatic entrance', 'adv-dramatic-entrance'],
  ['Dramatic exit', 'adv-dramatic-exit'], ['Fake dramatic death', 'adv-fake-death'], ['Getting revived', 'adv-revive'], ['Transforming into a different pose', 'transform-alert-mode'],
  ['Morphing facial expressions', 'adv-morph-expressions'], ['Shaking uncontrollably', 'adv-shake-uncontrollably'], ['Rapid spinning', 'cheer-spin-burst'],
  ['Floating while sleeping', 'adv-float-sleep'], ['Dreaming with thought bubbles', 'adv-dream-bubbles'], ['Sneaking around another character', 'pal-sneak-around'],
  ['Coordinated group dance', 'trio-group-dance'], ['Three-character group celebration', 'cheer-group-sync'], ['Three-character synchronized jumping', 'trio-sync-jump'],
  ['All three characters falling simultaneously', 'trio-all-fall'],
];

export const REQUESTED_ANIMATIONS: readonly RequestedAnimation[] = ROWS.map(([name, clip], i) => ({ n: i + 1, name, clip, group: groupOf(i + 1) }));
