import { ACTIONS } from '../processing/actions';

/** Actions a recipe or a proposal may name: every hand action, plus `assemble` (joining finished parts).
 *  Mirrors tools/content/causal.py::allowed_actions; a test keeps the two lists equal. */
export const ACTIONS_LIST: readonly string[] = [...Object.keys(ACTIONS), 'assemble'];
