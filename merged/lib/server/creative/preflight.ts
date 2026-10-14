import { multiKey } from '@/lib/processing/overlay';
import type { CreativeCatalog } from './catalog';
import { hardGate } from './strictCraftPolicy';
import { candidatePool } from './targetPool';
import type { HardReject, TargetRule, TryRequest } from './types';

/* Tickets 072–074: canonical-first authority, then the impossibility filter, then the bounded pool.
   Pure and synchronous; it cannot reach a database or a provider. */

export const RULES_VERSION = 'rules-1';

export type PreflightResult =
  | { kind: 'invalid'; code: 'UNKNOWN_ITEM' | 'INVALID_INPUT'; detail: string }
  | { kind: 'known'; targetId: string }
  | { kind: 'no_result'; reason: 'causally_impossible' | 'no_eligible_target'; code: HardReject; detail: string }
  | { kind: 'eligible'; candidates: TargetRule[]; fingerprint: string };

export function preflight(cat: CreativeCatalog, req: Pick<TryRequest, 'ingredientIds' | 'actionId'>): PreflightResult {
  const ids = req.ingredientIds;
  for (const id of ids) if (!cat.profiles.has(id)) return { kind: 'invalid', code: 'UNKNOWN_ITEM', detail: id };

  // 1. the game's own recipes win, exactly as the Engine does. Whether it is LOCKED for this player is the
  //    Engine's decision on the client; the server never turns a known recipe into an "unknown" one.
  const owner = cat.recipeIndex.get(multiKey(ids));
  if (owner) return { kind: 'known', targetId: owner };

  // 2. physics / process / chronology of the parts
  const gate = hardGate(cat, ids, req.actionId);
  if (!gate.ok) return { kind: 'no_result', reason: 'causally_impossible', code: gate.code, detail: gate.detail };

  // 3. approved targets that could really come out of these parts
  const pool = candidatePool(cat, ids, req.actionId, gate.profiles);
  if (!pool.rules.length) return { kind: 'no_result', reason: 'no_eligible_target', code: 'NO_ELIGIBLE_TARGET', detail: 'empty pool' };
  return { kind: 'eligible', candidates: pool.rules, fingerprint: pool.fingerprint };
}
