/** EN + VI strings for every projector screen. One flat table; `fmt` fills {placeholders}. Vietnamese diacritics are real text, never images. */
import type { Locale } from '@/lib/quiz/projector/types';

type Row = { en: string };
export const STR = {
  start: { en: 'Start game' }, pause: { en: 'Pause' }, resume: { en: 'Resume' },
  extend: { en: 'Add {n} min' }, finishTurn: { en: 'Finish after this turn' }, endNow: { en: 'End now' },
  endConfirm: { en: 'End the game for everyone now? The result is kept.' },
  openProjector: { en: 'Open projector window' }, teacherView: { en: 'Teacher view' },
  time: { en: 'Time' }, untimed: { en: 'No clock' }, paused: { en: 'Paused' }, lastTurn: { en: 'Last turn' }, overtime: { en: 'Time is up: finishing this turn' },
  round: { en: 'Turn {n} of {m}' }, yourTurn: { en: '{team}’s turn' }, allTeams: { en: 'All teams answer' },
  askQuestion: { en: 'Ask the question' }, correct: { en: 'Correct' }, wrong: { en: 'Not correct' },
  markFor: { en: 'Mark {team}’s spoken answer' }, answerKey: { en: 'Answer (teacher only)' },
  continueBtn: { en: 'Continue' }, endTurn: { en: 'End turn' }, undo: { en: 'Undo choice' },
  teams: { en: 'Teams' }, energy: { en: 'Energy' }, score: { en: 'Score' },
  finished: { en: 'Game over' }, victory: { en: 'Victory!' }, defeat: { en: 'Not this time' }, result: { en: 'Result' },
  waiting: { en: 'Ready to start. The teacher presses Start.' }, loading: { en: 'Loading the game…' }, offline: { en: 'Connection lost: retrying. Nothing is lost.' },
  conflict: { en: 'The screen was out of date and has been refreshed. Try again.' },
  language: { en: 'Language' }, sound: { en: 'Sound' }, captions: { en: 'Captions' }, largePrint: { en: 'Large print' }, highContrast: { en: 'High contrast' }, calm: { en: 'Reduce motion' },
  review: { en: 'Review' }, whyAnswer: { en: 'Why' }, repeatLabel: { en: 'Review question (repeated)' }, topicFallback: { en: 'No question left on that topic: using another.' },
  topic: { en: 'Topic' }, difficulty: { en: 'Level' }, easy: { en: 'Easy' }, medium: { en: 'Medium' }, hard: { en: 'Hard' },
  // empire
  claim: { en: 'Claim' }, fortify: { en: 'Fortify' }, research: { en: 'Scout' }, bridge: { en: 'Build bridge' }, challenge: { en: 'Challenge' }, chooseZone: { en: 'Pick a zone for the question' },
  tile: { en: 'Zone {n}' }, capital: { en: 'Capital' }, owner: { en: 'Held by {team}' }, unclaimed: { en: 'Unclaimed' },
  // boss
  strike: { en: 'Strike' }, defend: { en: 'Shield' }, repair: { en: 'Repair' }, scan: { en: 'Scan' }, combine: { en: 'Combine' },
  bossHp: { en: 'Boss' }, classHp: { en: 'Class' }, shield: { en: 'Shield' }, phase: { en: 'Phase {n}' }, weakPoint: { en: 'Weak point: {t}' }, telegraph: { en: 'Next: {k}' },
  aimWeak: { en: 'Aim at weak point' }, partner: { en: 'Partner' },
  // escape
  inspect: { en: 'Inspect' }, unlock: { en: 'Use items' }, hint: { en: 'Hint' }, trade: { en: 'Trade item' }, bypass: { en: 'Skip puzzle (teacher)' },
  room: { en: 'Room {n} of {m}' }, inventory: { en: 'Notebook' }, hintTokens: { en: 'Hints left: {n}' }, needs: { en: 'Needs: {i}' }, locked: { en: 'Locked' }, opened: { en: 'Open' }, solved: { en: 'Solved' },
  escaped: { en: 'Everyone is through the last door.' },
  // vault
  openVault: { en: 'Open vault' }, bank: { en: 'Bank keys' }, share: { en: 'Share a key' }, grand: { en: 'Grand vault' }, held: { en: 'In hand' }, banked: { en: 'Banked' }, chooseVault: { en: 'Choose a vault' }, requires: { en: 'Needs' },
  // ladder
  climb: { en: 'Climb' }, bankPts: { en: 'Bank points' }, reviewBtn: { en: 'Review for a shield' }, summit: { en: 'Summit' }, atRisk: { en: 'At risk: {n}' }, fallsTo: { en: 'A fall lands on step {n}' }, gain: { en: 'Gain {n}' },
  steady: { en: 'Steady route' }, steep: { en: 'Steep route' }, normalRoute: { en: 'Main route' },
  // setup
  chooseGame: { en: 'Choose a game' }, chooseTime: { en: 'How long is the lesson?' }, minutes: { en: '{n} min' }, launch: { en: 'Create the game' },
  // report
  report: { en: 'Class report' }, byTopic: { en: 'By topic' }, answered: { en: '{n} answered' }, accuracy: { en: '{p}% correct' }, needsRevisit: { en: 'Worth revisiting' }, gotItRight: { en: 'Strong topics' },
} satisfies Record<string, Row>;
export type Key = keyof typeof STR;

export function tr(_locale: Locale, key: Key, vars?: Record<string, string | number>): string {
  const s = STR[key].en;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s;
}
export const L = (_locale: Locale, v: { en: string }) => v.en;

const ERR: Record<string, Row> = {
  wrongPhase: { en: 'That cannot be done right now.' }, noEnergy: { en: 'Not enough energy ({have} of {need}).' },
  notYourTurn: { en: 'It is not that team’s turn.' }, notAdjacent: { en: 'That zone is not next to your land.' }, tileTaken: { en: 'Someone already holds that zone.' },
  duelOpen: { en: 'Finish the duel first.' }, needItems: { en: 'You need the right items first.' }, missingKeys: { en: 'The right keys are missing.' },
  cooldown: { en: 'Still recharging ({turns} turns).' }, noQuestions: { en: 'No questions are left, so the game ends here.' },
  tooFewQuestions: { en: 'This quiz is {n} questions short for that length. Pick a shorter lesson or allow a labelled review cycle.' },
  revisionConflict: { en: 'The screen was out of date and has been refreshed. Try again.' }, notRunning: { en: 'Press Start first.' }, paused: { en: 'The game is paused.' },
  needVerdict: { en: 'Mark the answer correct or not correct.' }, finished: { en: 'The game is over.' }, reasonRequired: { en: 'Give a short reason first.' },
  alreadyBid: { en: 'That team already has a paddle up.' }, badLot: { en: 'That lot is not on the stage.' }, badAmount: { en: 'Enter a bid of at least 1.' }, insufficientPoints: { en: 'Not enough points ({have} of {need}).' },
  notReachable: { en: 'That square cannot be reached from your land.' }, wrongAction: { en: 'That move does not fit this square.' }, badCell: { en: 'Pick a square on the map.' }, badTeam: { en: 'Pick a team.' }, badAction: { en: 'That choice is not available.' },
  noFreeSlot: { en: 'Every machine slot is in use ({n}).' }, repairFirst: { en: 'Repair that machine first.' }, maxLevel: { en: 'That machine is already at the top level.' }, notBroken: { en: 'That machine is working.' }, noBreakdownDue: { en: 'No breakdown is due this shift.' },
  alreadyInspected: { en: 'The safety check is already done this shift.' }, nothingToProtect: { en: 'There is no working machine to protect.' }, badMachine: { en: 'Pick a machine on the line.' },
  badIsland: { en: 'Pick an island on the chart.' }, alreadyCharted: { en: 'That island is already charted.' }, alreadyGuarded: { en: 'A guard is already posted.' }, notSameIsland: { en: 'That ship is not anchored here.' }, safeHarbour: { en: 'No raiding in the home harbour.' },
  nothingToTake: { en: 'That ship has no cargo to take.' }, badRaid: { en: 'Pick a rival ship.' }, alreadyChosen: { en: 'A stance is already chosen. Undo it first.' }, shieldFull: { en: 'The shield limit is {n}.' }, nothingToUndo: { en: 'There is nothing to undo.' },
  chooseAction: { en: 'Every team must choose a stance first.' }, unknownAction: { en: 'That action is not available.' },
  combineLocked: { en: 'Combos unlock in the boss’s second phase.' }, badPartner: { en: 'Pick a partner team.' }, noSynergy: { en: 'These two teams have no combo to share.' }, sameTopicSynergy: { en: 'Partners need different strengths to combine.' },
  badTile: { en: 'Pick a zone on the map.' }, badEdge: { en: 'There is no river crossing there.' }, notBlocked: { en: 'That crossing is already open.' }, alreadyBridged: { en: 'That river already has a bridge.' }, bridgeNeedsOwned: { en: 'Build bridges from a zone you hold.' },
  notOwned: { en: 'That zone is not yours.' }, alreadyFort: { en: 'That zone is already fortified.' }, nothingHidden: { en: 'Nothing is hidden there.' }, notEnemy: { en: 'Pick a zone held by another team.' },
  chooseHotspot: { en: 'Click an object in the room first.' }, tierLocked: { en: 'That object unlocks later.' }, alreadySolved: { en: 'That puzzle is already solved.' }, needsItems: { en: 'You need the right items first.' }, badHotspot: { en: 'Pick an object in the room.' },
  noMoreHints: { en: 'No more hints for that puzzle.' }, noHintTokens: { en: 'The class has no hints left.' }, alreadyOpen: { en: 'That is already open.' }, sharedInventory: { en: 'The notebook is shared, so there is nothing to trade.' }, badTrade: { en: 'That trade is not possible.' },
  reviewSingleOnly: { en: 'Review questions are for one team at a time.' }, atSummit: { en: 'This team is already at the summit.' }, nothingToBank: { en: 'There are no points to bank.' }, reviewLimit: { en: 'The review limit has been reached.' }, noBranch: { en: 'That route is not available on this step.' },
  practiceAfterMiss: { en: 'Practice is offered after a missed question.' }, practiceUsed: { en: 'Practice was already used.' }, chooseVault: { en: 'Pick a door first.' }, vaultOpen: { en: 'That door is already open.' }, badVault: { en: 'Pick a door on the wall.' },
  scannerCost: { en: 'A scanner costs {cost} key pieces.' }, noScanner: { en: 'No scanner is ready.' }, checkpointClosed: { en: 'The checkpoint is closed.' }, noFragment: { en: 'That key piece is not available.' }, grandLocked: { en: 'The grand vault is still locked.' },
};
/** Turn an API/reducer error ("projector:code:param") into a sentence the class can read. */
export function errText(_locale: Locale, message: string): string {
  const m = /^projector:([A-Za-z]+)(?::(.*))?$/.exec(message);
  if (!m) return message;
  const row = ERR[m[1]!]; if (!row) return message;
  let vars: Record<string, string | number> = {};
  const tail = m[2];
  if (tail) { try { vars = JSON.parse(tail) as Record<string, number>; } catch { vars = { n: tail }; } }
  return row.en.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
/** English only: the browser language is deliberately ignored. */
export const detectLocale = (): Locale => 'en';

const LOG: Record<string, Row> = {
  asked: { en: '{team} gets a question' }, claim: { en: '{team} claimed zone {tile}' }, fortify: { en: '{team} fortified zone {tile}' },
  challenge: { en: '{team} challenges zone {tile}' }, duelHeld: { en: '{team} held zone {tile}' }, research: { en: '{team} scouted zone {tile} (+{pts})' },
  bridge: { en: '{team} built a bridge' }, zoneChosen: { en: '{team} picked zone {tile}' }, comeback: { en: 'Comeback boost for {team}' },
  chose: { en: '{team} chose {action}' }, role: { en: '{team} is now on {role}' }, defend: { en: '{team} added {amount} shield' }, repair: { en: '{team} repaired {amount}' },
  bossAttack: { en: 'The boss hits for {dmg} (shield soaked {soaked})' }, bossAttackSoft: { en: 'The boss swings and the shield holds' }, bossPhase: { en: 'The boss enters phase {phase}' },
  bossWeak: { en: 'The weak point is exposed' }, bossBarrier: { en: 'The boss raises a barrier' }, bossSurge: { en: 'The boss surges' }, scan: { en: '{team} scanned the boss' }, scanned: { en: '{team} scanned the boss' },
  inspect: { en: '{team} inspects {hs}' }, hint: { en: '{team} used a hint' }, trade: { en: '{team} passed {item}' }, roomEntered: { en: '{team} entered room {room}' }, miss: { en: '{team} did not get it' },
  chooseVault: { en: '{team} eyes vault {vault}' }, vaultOpened: { en: '{team} opened vault {vault} (+{reward})' }, grandOpened: { en: '{team} opened the grand vault (+{reward})' }, banked: { en: '{team} banked {pts}' }, scannerBought: { en: '{team} bought a scanner' }, shared: { en: '{team} shared a key with {to}' },
  bank: { en: '{team} banked {pts} at step {tier}' }, climb: { en: '{team} climbed to step {tier}' }, climbBridge: { en: '{team} reached step {tier}' }, fall: { en: '{team} slipped from {from} to {to}' }, shieldGained: { en: '{team} earned a shield' }, shieldUsed: { en: '{team}’s shield absorbed a fall' }, reviewDone: { en: '{team} finished a review' }, halfStep: { en: '{team} gained a half step' },
  practiceMiss: { en: '{team} practised a miss' }, practiceStar: { en: '{team} earned a practice star' },
  revealed: { en: 'Answer revealed' }, extended: { en: 'Time extended by {minutes} min' }, finishTurnSet: { en: 'The game ends after this turn' }, timeUpFinishTurn: { en: 'Time is up: ending after this turn' }, turnSkipped: { en: '{team}’s turn was skipped' }, undo: { en: 'Choice undone' }, finished: { en: 'The game is over' },
  // newer games
  earned: { en: '{team} earned {n} points' }, paddleRaised: { en: '{team} raised a sealed paddle' }, paddleLowered: { en: '{team} lowered their paddle and got the points back' }, bidPassed: { en: '{team} passed this round' },
  lotWon: { en: '{team} won {lot} for {price} (worth {value})' }, lotUnsold: { en: 'No bids on {lot}: it returns to the vault' }, collectionBonus: { en: '{team} completed a collection (+{n})' },
  capture: { en: '{team} captured square {cell}' }, landing: { en: '{team} planted a flag on square {cell}' }, breach: { en: '{team} breached the wall on square {cell}' }, seize: { en: '{team} seized square {cell}' }, seizeHq: { en: '{team} seized a headquarters on square {cell}' },
  machineBroke: { en: '{team}’s machine {n} broke down' }, checkSavedMachine: { en: '{team}’s safety check saved a machine' }, production: { en: '{team} shipped {n} goods' }, builtMachine: { en: '{team} built a {kind}' },
  upgradedMachine: { en: '{team} upgraded machine {n} to level {level}' }, repairedMachine: { en: '{team} repaired machine {n}' }, safetyCheck: { en: '{team} ran a safety check' },
  sail: { en: '{team} sailed to {island} and loaded {n}' }, sailHome: { en: '{team} sailed home to the harbour' }, dock: { en: '{team} docked and banked {n}' }, guard: { en: '{team} posted a guard' }, raid: { en: '{team} raided a rival ship and took {n}' }, raidBlocked: { en: '{team}’s raid was blocked by a guard' },
  showdownAnswer: { en: '{team} scored {n}' }, showdownChoice: { en: '{team} chose to play {choice}' }, stageStart: { en: 'New stage: {stage}' },
  ans_correct: { en: '{team} answered correctly' }, ans_wrong: { en: '{team}’s answer was not correct' }, strike: { en: '{team} struck the boss for {amount}' }, solved: { en: '{team} solved a puzzle' }, frag_correct: { en: '{team} earned a key piece' }, chart: { en: '{team} charted {island}' },
};
export function logText(_locale: Locale, e: { k: string; team?: string; p?: Record<string, string | number> }, teamName: (id?: string) => string): string {
  const row = LOG[e.k]; if (!row) return e.k;
  return row.en.replace(/\{(\w+)\}/g, (_, k) => (k === 'team' ? teamName(e.team) : String(e.p?.[k] ?? '')));
}
