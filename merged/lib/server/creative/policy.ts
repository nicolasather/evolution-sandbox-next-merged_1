import type { CreativeCatalog } from './catalog';
import { hardGate } from './strictCraftPolicy';
import { MAX_ERA_LEAP } from './targetPool';
import { multiKey } from '@/lib/processing/overlay';
import type { TargetRule } from './types';

/* Ticket 085 — the independent validator. It re-derives the facts from the server's own catalogue and does not look at
   anything the model said except the (already allow-listed) target id. A model's prose or "confidence" cannot change it. */

export type Verdict = { ok: true } | { ok: false; reason: string };

export function validateProposal(cat: CreativeCatalog, ingredientIds: readonly string[], actionId: string | null, rule: TargetRule): Verdict {
  const target = cat.profiles.get(rule.targetId);
  if (!target || !target.isNode) return { ok: false, reason: 'unknown_target' };
  if (target.status !== 'verified') return { ok: false, reason: 'unverified_target' };
  if (ingredientIds.includes(rule.targetId)) return { ok: false, reason: 'self_reference' };
  if (cat.recipeIndex.has(multiKey(ingredientIds))) return { ok: false, reason: 'canonical_collision' };
  const gate = hardGate(cat, ingredientIds, actionId);
  if (!gate.ok) return { ok: false, reason: `gate:${gate.code}` };
  const maxEra = Math.max(...gate.profiles.map(p => p.eraRank));
  if (target.eraRank < maxEra) return { ok: false, reason: 'target_earlier_than_part' };
  if (target.eraRank > maxEra + MAX_ERA_LEAP) return { ok: false, reason: 'era_leap' };
  return { ok: true };
}
