/** Which classic modifiers a projector game accepts. The game is chosen FIRST; only genuinely compatible modifiers are offered.
 *
 *  Principle: a modifier is enabled only where it can run THROUGH the game's own reducer, settle in the game's own score, and be verified
 *  by the teacher on one shared screen. That is true of exactly two modifiers, in exactly the four games whose score is a native, spendable
 *  points balance (Auction House, Territory War, Lucky Factory, Pirate Voyage — they expose `wallet` in their reducer):
 *   - Secret Wager: the team commits up to one standard question's worth of its own points before the question; correct wins it, wrong loses
 *     it (never more than it holds), partial returns it. Off under Low pressure, which promises no losses.
 *   - Steal the Question: in round robin, after a verified WRONG answer the teacher may hand the same open question to one other team for
 *     one try; a correct steal earns what a standard question earns. Needs round robin (in synchronized play every team already answered).
 *  Everything else stays off with the factual reason shown in setup and enforced again on the server (create.ts → assertProjectorModifiers). */
import type { Flow, Modifier } from '../types';
import { MODIFIERS } from '../types';
import type { GameKey, L10n, ProjectorModifier } from './types';
import { PROJECTOR_MODIFIERS } from './types';

export type ModifierRule = { allowed: boolean; reason: L10n; mechanism?: L10n };
export type ModifierContext = { flow?: Flow; lowPressure?: boolean };

const NO_SHARED_DEVICE: L10n = { en: 'Off: on one shared screen the teacher cannot verify which team answered first.' };
const THEFT: L10n = { en: 'Off: moving, wiping or copying points between teams would override what teams earned and bought in this game.' };
const POTLUCK: L10n = { en: 'Off: a random score swing is not explained by anything a team did, and this game ranks teams on its own score.' };
const NO_WALLET: L10n = { en: 'Off: this game has no spendable points balance to wager or reward, so the modifier would have nothing fair to act on.' };
const NATIVE_RISK: L10n = { en: 'Off: this game already has its own stake mechanic, so a wager would double it.' };
const WAGER_ON: L10n = { en: 'Before the question, the team may stake up to one question’s worth of its own points: correct wins the stake, wrong loses it (never more than it holds), partial returns it.' };
const STEAL_ON: L10n = { en: 'After a verified wrong answer, the teacher may give the same question to one other team for one try. A correct steal earns what a standard question earns.' };
const STEAL_NEEDS_RR: L10n = { en: 'Needs round robin: in synchronized play every team already answers each question.' };
const WAGER_LOW_PRESSURE: L10n = { en: 'Off under Low pressure, which promises that nothing can be lost.' };

/** Games whose reducer exposes a native wallet (kept in sync with the reducers by a test). */
export const WALLET_GAMES: readonly GameKey[] = ['auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage'];
const NATIVE_STAKES: readonly GameKey[] = ['risk_ladder', 'final_showdown'];

function baseRule(game: GameKey, m: Modifier): ModifierRule {
  if (m === 'limited_slots') return { allowed: false, reason: NO_SHARED_DEVICE };
  if (m === 'potluck') return { allowed: false, reason: POTLUCK };
  if (m === 'lose_all' || m === 'go_to_first' || m === 'steal_points' || m === 'give_points' || m === 'swap_points') return { allowed: false, reason: THEFT };
  const wallet = WALLET_GAMES.includes(game);
  if (m === 'secret_wager') return wallet ? { allowed: true, reason: WAGER_ON, mechanism: WAGER_ON } : { allowed: false, reason: NATIVE_STAKES.includes(game) ? NATIVE_RISK : NO_WALLET };
  // steal_question
  return wallet ? { allowed: true, reason: STEAL_ON, mechanism: STEAL_ON } : { allowed: false, reason: NO_WALLET };
}

/** The rule for one game + modifier, refined by the chosen flow and pressure setting when they are known. */
export function modifierRule(game: GameKey, m: Modifier, ctx: ModifierContext = {}): ModifierRule {
  const r = baseRule(game, m);
  if (!r.allowed) return r;
  if (m === 'steal_question' && ctx.flow && ctx.flow !== 'round_robin') return { allowed: false, reason: STEAL_NEEDS_RR };
  if (m === 'secret_wager' && ctx.lowPressure) return { allowed: false, reason: WAGER_LOW_PRESSURE };
  return r;
}
export const allowedModifiers = (game: GameKey, ctx: ModifierContext = {}): ProjectorModifier[] =>
  PROJECTOR_MODIFIERS.filter((m) => modifierRule(game, m, ctx).allowed);
export const isProjectorModifier = (m: string): m is ProjectorModifier => (PROJECTOR_MODIFIERS as readonly string[]).includes(m);

/** Throws if any requested modifier is not allowed with the game in this setup. The server calls this; the setup UI shows the same rules. */
export function assertProjectorModifiers(game: GameKey, mods: readonly Modifier[], ctx: ModifierContext = {}): ProjectorModifier[] {
  if (new Set(mods).size !== mods.length) throw new Error('Unknown: duplicate modifier');
  const bad = mods.filter((m) => !modifierRule(game, m, ctx).allowed);
  if (bad.length) throw new Error(`Unknown: ${bad.join(', ')} cannot be combined with this projector game — ${modifierRule(game, bad[0]!, ctx).reason.en}`);
  return mods.filter(isProjectorModifier);
}
export { MODIFIERS };
