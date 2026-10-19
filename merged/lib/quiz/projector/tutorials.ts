/** English-only guides for all ten projector games. Each has game-specific steps and a NONPERSISTENT practice turn:
 *  pick an action, answer a sample question, see exactly what would have happened. Nothing here touches a room, score, reward or quiz. */
import type { GameKey } from './types';
export type TutorialStep = { title: string; detail: string; focus: 'scene' | 'question' | 'controls' | 'teams' | 'result' };
export type PracticeChoice = { label: string; setup: string; ifRight: string; ifWrong: string };
export type Practice = { prompt: string; options: readonly string[]; correct: number; why: string; choices: PracticeChoice[] };
export type Tutorial = { objective: string; win: string; steps: TutorialStep[]; practice: Practice; tips: string[] };

const Q = {
  mult: { prompt: 'What is 7 × 8?', options: ['54', '56', '48', '63'], correct: 1, why: '7 × 8 = 56.' },
  planet: { prompt: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], correct: 2, why: 'Mercury orbits closest to the Sun.' },
  seq: { prompt: 'What comes next: 2, 4, 8, 16, …?', options: ['24', '32', '30', '20'], correct: 1, why: 'Each number doubles.' },
  hex: { prompt: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correct: 1, why: 'Hex means six.' },
  div: { prompt: 'What is 15 ÷ 3?', options: ['3', '4', '5', '6'], correct: 2, why: '3 × 5 = 15.' },
  sum: { prompt: 'What is 9 + 6?', options: ['14', '15', '16', '13'], correct: 1, why: '9 + 6 = 15.' },
  min: { prompt: 'How many minutes are in 2 hours?', options: ['100', '90', '120', '180'], correct: 2, why: '2 × 60 = 120.' },
  prime: { prompt: 'Which number is prime?', options: ['9', '15', '17', '21'], correct: 2, why: '17 has no divisors except 1 and itself.' },
  ocean: { prompt: 'Which is the largest ocean?', options: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], correct: 1, why: 'The Pacific covers about a third of Earth.' },
  twelve: { prompt: 'What is 12 × 4?', options: ['44', '46', '48', '52'], correct: 2, why: '12 × 4 = 48.' },
} as const;
const flow = (a: string, b: string, c: string, scene: string): TutorialStep[] => [
  { title: 'Read the scene', detail: scene, focus: 'scene' },
  { title: 'Ask a question', detail: 'The teacher presses an Ask button. The question appears on the big screen and the teams discuss.', focus: 'controls' },
  { title: 'Mark the spoken answer', detail: 'The teacher sees the answer key privately and marks each team. Only a verified mark can earn anything.', focus: 'question' },
  { title: 'Spend what you earned', detail: a, focus: 'controls' },
  { title: 'Watch the consequences', detail: b, focus: 'teams' },
  { title: 'Finish', detail: c, focus: 'result' },
];
export const TUTORIALS: Record<GameKey, Tutorial> = {
  empire_race: {
    objective: 'Hold the most valuable land on the map when the sun sets.', win: 'The team with the most land (plus capital and objectives) wins.',
    steps: flow('Click a zone on the map. Legal zones glow and each button shows its energy cost. Claim, fortify, scout, bridge a river or challenge a rival.', 'Threatened borders are marked. A fortified zone is harder to take; a bridge opens new routes.', 'When the clock ends, the current turn finishes and the land is counted.', 'Zones are the coloured regions. Rivers block movement until a bridge is built. Each team has a capital.'),
    practice: { ...Q.mult, choices: [{ label: 'Claim a neutral zone', setup: 'You pick a zone next to your land.', ifRight: 'The zone turns your colour and your energy drops by the claim cost.', ifWrong: 'No energy is earned, so the claim cannot be paid for. Nothing changes on the map.' }, { label: 'Fortify a border zone', setup: 'You pick a zone a rival is touching.', ifRight: 'The zone gets a wall, so a challenge will be harder.', ifWrong: 'No energy, no wall. The rival may challenge it next turn.' }] },
    tips: ['Spend energy where a rival touches you.', 'A bridge costs energy but can double your options.'],
  },
  boss_battle: {
    objective: 'Work together to break the clockwork boss before it breaks the class.', win: 'Win when boss health reaches zero; lose if the class health does.',
    steps: flow('Pick a role action: Strike, Shield, Repair, Scan or Combine. The preview shows the effect before you commit.', 'The boss shows its next attack. Shields soak damage; a weak-point topic deals bonus damage.', 'Defeat the boss before the clock or class health runs out.', 'The mechanical boss has a health bar, a warning for its next attack and a glowing weak point.'),
    practice: { ...Q.planet, choices: [{ label: 'Strike the boss', setup: 'The boss will attack next turn.', ifRight: 'The boss loses health. If you aimed at the weak point, more.', ifWrong: 'The strike misses. The boss attack lands with no extra shield.' }, { label: 'Shield the class', setup: 'The boss telegraphs a heavy attack.', ifRight: 'A shield absorbs part of the attack.', ifWrong: 'No shield is raised. The class takes full damage.' }] },
    tips: ['Read the telegraph before choosing.', 'Cosmetic choices never change damage.'],
  },
  escape_room: {
    objective: 'Inspect objects, combine clues and get everyone through the last door.', win: 'The class escapes after opening every required lock.',
    steps: flow('Click an object. Inspect puzzles, use notebook items on locks, or spend a hint token if the class is stuck.', 'Solved puzzles add clues and items to the shared notebook; locks consume items and open doors.', 'Open the final door of the last room to finish.', 'Objects you can use are outlined. The notebook lists every clue and item found so far.'),
    practice: { ...Q.seq, choices: [{ label: 'Inspect the desk', setup: 'A drawer is stuck behind a number puzzle.', ifRight: 'The drawer opens: a key goes into the notebook.', ifWrong: 'The drawer stays shut. Try another object or take a hint.' }, { label: 'Use the key on the door', setup: 'You hold the key from the drawer.', ifRight: 'The lock turns and the next room opens.', ifWrong: 'The lock needs a verified puzzle first. Nothing opens.' }] },
    tips: ['Rewards here are information and access, never points.', 'A teacher bypass is logged.'],
  },
  treasure_vault: {
    objective: 'Earn shaped keys, open the right doors and bank the biggest haul.', win: 'The most banked and held treasure wins.',
    steps: flow('Choose a door. Its lock needs certain key shapes. Open it if you can afford it, or bank what you hold to keep it safe.', 'Held treasure can be lost to a checkpoint; banked treasure is safe. Each door has its own mechanism.', 'When the vault closes, banked plus held treasure is counted.', 'Each skill gives one key shape. Doors show which shapes they need.'),
    practice: { ...Q.hex, choices: [{ label: 'Open the bronze door', setup: 'You hold two circle keys.', ifRight: 'You earn a new key piece and the door opens for treasure.', ifWrong: 'No key piece. The door stays locked.' }, { label: 'Bank the treasure', setup: 'You hold 12 treasure.', ifRight: 'Your held treasure is banked and safe.', ifWrong: 'Banking works either way, but the new key piece is lost.' }] },
    tips: ['Bank before a risky door.', 'Different topics give different shapes.'],
  },
  risk_ladder: {
    objective: 'Climb the tower, but bank your points before a fall.', win: 'The highest summit and secured points win.',
    steps: flow('Preview the gain and the fall first. Choose Climb, Bank, or a limited Review for a shield.', 'A wrong climb sends the team back down to its checkpoint. Banked points are never lost.', 'Reach the top with points safely banked.', 'The tower shows steps, checkpoints and routes. Harder questions sit higher.'),
    practice: { ...Q.div, choices: [{ label: 'Climb one step', setup: 'You are 4 points unbanked.', ifRight: 'You move up a step and earn more unbanked points.', ifWrong: 'You fall to the last checkpoint and lose the unbanked points.' }, { label: 'Bank now', setup: 'You are 4 points unbanked.', ifRight: 'Your 4 points become permanent.', ifWrong: 'Banking still works; you simply earned no extra.' }] },
    tips: ['Read what a fall costs.', 'Review can earn a shield.'],
  },
  auction_house: {
    objective: 'Win valuable lots with sealed bids and collect the best prizes.', win: 'Points left plus prizes won, plus collection bonuses, decide the winner.',
    steps: flow('Raise a sealed paddle on a lot. The amount is reserved from your points. When the round ends the gavel falls: highest bid wins, losers are refunded.', 'Lots show an appraisal range, never the true value. Blueprints add income to later answers. One of each kind gives a bonus.', 'The final round settles, and unfinished bids are refunded.', 'Lots sit on the stage with appraisal tags; every team has a paddle.'),
    practice: { ...Q.sum, choices: [{ label: 'Bid 5 on Lot 1', setup: 'Lot 1 is appraised 4–8.', ifRight: 'You earn 6 points, then your sealed paddle holds 5. At the gavel the highest bid wins.', ifWrong: 'You earn nothing new, but a paddle can still be raised with the points you have.' }, { label: 'Pass and save points', setup: 'The lots look too pricey.', ifRight: 'Your points grow and stay safe.', ifWrong: 'You skip bidding. Nothing is lost.' }] },
    tips: ['Bids are sealed until the gavel.', 'Ties rotate in priority.'],
  },
  territory_war: {
    objective: 'Capture, defend and connect squares on the battle grid.', win: 'The team with the most valuable territory wins.',
    steps: flow('Click a square. The preview names the move (capture, breach, seize, fortify), its cost and its result. Outlined squares are legal.', 'Squares cut off from your headquarters are worth 1 until reconnected. Objectives are worth 4. Walls make squares harder to take.', 'When the board fills or time ends, squares and leftover points are counted.', 'Forest and hills cost more. Water blocks. Each team starts at a headquarters.'),
    practice: { ...Q.min, choices: [{ label: 'Capture a square', setup: 'An empty plain square touches your land.', ifRight: 'You earn 5 points, pay 3, and your flag goes down.', ifWrong: 'No points earned, so the capture cannot be paid for.' }, { label: 'Fortify your border', setup: 'A rival touches your square.', ifRight: 'A wall brick makes your square harder to breach.', ifWrong: 'No wall. The rival may breach next turn.' }] },
    tips: ['Keep squares connected.', 'A team with no land can always land a free flag.'],
  },
  lucky_factory: {
    objective: 'Build a production line and ship the most goods over many shifts.', win: 'Goods shipped plus a bonus for parts left over decide the winner.',
    steps: flow('Spend parts to build, upgrade or repair machines. Four different working kinds earn a line bonus. A safety check saves a machine from a breakdown.', 'Every shift event is public three shifts ahead. Goods ship only when the turn ends.', 'After the last shift the total shipped is counted.', 'The conveyor shows each machine, its level, broken ones and the shift forecast.'),
    practice: { ...Q.prime, choices: [{ label: 'Build a press', setup: 'The next shift is a bonus shift.', ifRight: 'You earn 8 parts, pay 7, and the press ships 4 more goods ×1.5.', ifWrong: 'No parts, so no press this turn.' }, { label: 'Run a safety check', setup: 'The forecast says a breakdown is due.', ifRight: 'The check costs 2 and saves your weakest machine.', ifWrong: 'No parts for the check. The machine breaks.' }] },
    tips: ['Read the forecast before spending.', 'Repair costs 3.'],
  },
  pirate_voyage: {
    objective: 'Sail marked routes, load treasure and dock at the home harbour to bank it.', win: 'Banked treasure plus half of cargo on deck wins.',
    steps: flow('Click an island. The preview shows the sailing cost (storms cost more), the chest if charted, and whether docking banks cargo.', 'Cargo on deck can be raided by a rival on the same island; a guard blocks one raid. Banked treasure is safe.', 'Dock home before the voyage ends.', 'Dotted lines are routes. Storm clouds mark costly islands now and next round. A question mark is an unknown chest.'),
    practice: { ...Q.ocean, choices: [{ label: 'Sail to Windward Isle', setup: 'The route is calm.', ifRight: 'You earn 6 points, pay 3 to sail and load the chest.', ifWrong: 'No new points. You may not be able to afford the trip.' }, { label: 'Chart a faraway island', setup: 'You want to see its chest first.', ifRight: 'For 2 points the chest is revealed.', ifWrong: 'No points, no chart. The chest stays a question mark.' }] },
    tips: ['Charting is cheaper than a wasted trip.', 'Dock to bank.'],
  },
  final_showdown: {
    objective: 'Play through qualifiers, pressure, comeback and the final. Nobody is eliminated.', win: 'The highest final score wins.',
    steps: flow('Before each question choose Steady (free), Double (pay 7, double the base score) or Shield (pay 5, cancels a setback).', 'Setbacks only exist in the pressure and final stages. In the comeback stage trailing teams get a bonus.', 'Every lesson ends with a final stage; the scoreboard shows the order.', 'The stage track shows where you are. The scoreboard is live, with shields and the stance each team chose.'),
    practice: { ...Q.twelve, choices: [{ label: 'Steady', setup: 'No cost, no risk.', ifRight: 'You earn the base score for this stage.', ifWrong: 'No points; in the pressure stage you lose 3.' }, { label: 'Double down (7)', setup: 'You pay 7 points first.', ifRight: 'You earn double the base score. The 7 is the price of the bet.', ifWrong: 'You lose the stake and earn nothing.' }] },
    tips: ['A shield is only worth buying before setbacks.', 'Stakes are refunded if a turn is skipped.'],
  },
};
