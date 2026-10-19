/** Which classic modifiers a projector game accepts. The game is chosen FIRST; only genuinely compatible modifiers are offered.
 *  This phase ships zero cross-mode modifiers: every game has native mechanics instead (energy, hints, keys, banking). */
import type { Modifier } from '../types';
import { MODIFIERS } from '../types';
import type { GameKey, L10n } from './types';

export type ModifierRule = { allowed: boolean; reason: L10n };
const NO_SHARED_DEVICE: L10n = { en: 'The teacher cannot verify who answered first on one shared screen.', vi: 'Giáo viên không thể xác minh đội nào trả lời trước trên một màn hình chung.' };
const THEFT: L10n = { en: 'Taking or moving points clashes with this game’s goal.', vi: 'Lấy hoặc chuyển điểm mâu thuẫn với mục tiêu của trò chơi này.' };
const NATIVE: L10n = { en: 'This game has its own risk mechanic built in, so a classic modifier would double up.', vi: 'Trò chơi này đã có cơ chế rủi ro riêng, thêm modifier cổ điển sẽ bị trùng.' };
const NOT_YET: L10n = { en: 'Compatible in design, but not enabled in this release; the game’s native mechanics are used instead.', vi: 'Về thiết kế thì tương thích nhưng bản này chưa bật; thay vào đó dùng cơ chế riêng của trò chơi.' };

const RULES: Record<GameKey, Record<Modifier, ModifierRule>> = {
  empire_race: { limited_slots: { allowed: false, reason: NO_SHARED_DEVICE }, secret_wager: { allowed: false, reason: NOT_YET }, steal_question: { allowed: false, reason: NOT_YET }, lose_all: { allowed: false, reason: THEFT }, go_to_first: { allowed: false, reason: THEFT }, steal_points: { allowed: false, reason: THEFT }, give_points: { allowed: false, reason: THEFT }, swap_points: { allowed: false, reason: THEFT }, potluck: { allowed: false, reason: NOT_YET } },
  boss_battle: { limited_slots: { allowed: false, reason: NO_SHARED_DEVICE }, secret_wager: { allowed: false, reason: NATIVE }, steal_question: { allowed: false, reason: THEFT }, lose_all: { allowed: false, reason: THEFT }, go_to_first: { allowed: false, reason: THEFT }, steal_points: { allowed: false, reason: THEFT }, give_points: { allowed: false, reason: THEFT }, swap_points: { allowed: false, reason: THEFT }, potluck: { allowed: false, reason: NOT_YET } },
  escape_room: { limited_slots: { allowed: false, reason: NO_SHARED_DEVICE }, secret_wager: { allowed: false, reason: NATIVE }, steal_question: { allowed: false, reason: NOT_YET }, lose_all: { allowed: false, reason: THEFT }, go_to_first: { allowed: false, reason: THEFT }, steal_points: { allowed: false, reason: THEFT }, give_points: { allowed: false, reason: THEFT }, swap_points: { allowed: false, reason: THEFT }, potluck: { allowed: false, reason: NATIVE } },
  treasure_vault: { limited_slots: { allowed: false, reason: NO_SHARED_DEVICE }, secret_wager: { allowed: false, reason: NOT_YET }, steal_question: { allowed: false, reason: NOT_YET }, lose_all: { allowed: false, reason: THEFT }, go_to_first: { allowed: false, reason: THEFT }, steal_points: { allowed: false, reason: THEFT }, give_points: { allowed: false, reason: THEFT }, swap_points: { allowed: false, reason: THEFT }, potluck: { allowed: false, reason: NOT_YET } },
  risk_ladder: { limited_slots: { allowed: false, reason: NO_SHARED_DEVICE }, secret_wager: { allowed: false, reason: NATIVE }, steal_question: { allowed: false, reason: NOT_YET }, lose_all: { allowed: false, reason: THEFT }, go_to_first: { allowed: false, reason: THEFT }, steal_points: { allowed: false, reason: THEFT }, give_points: { allowed: false, reason: THEFT }, swap_points: { allowed: false, reason: THEFT }, potluck: { allowed: false, reason: NATIVE } },
};
export const modifierRule = (game: GameKey, m: Modifier): ModifierRule => RULES[game][m];
export const allowedModifiers = (game: GameKey): Modifier[] => MODIFIERS.filter((m) => RULES[game][m].allowed);
/** Throws if any requested modifier is not allowed with the game. */
export function assertProjectorModifiers(game: GameKey, mods: readonly Modifier[]) {
  const bad = mods.filter((m) => !RULES[game][m].allowed);
  if (bad.length) throw new Error(`Unknown: ${bad.join(', ')} cannot be combined with this projector game`);
}
