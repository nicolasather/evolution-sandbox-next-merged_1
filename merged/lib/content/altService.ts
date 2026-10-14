import type { Db } from '../types';
import type { AltProvider } from '../server/aiRecipeProvider';
import { validateAltResponse, type AltOutcome } from './altValidation';
import { buildRecipeIndex } from './strictCraft';
import { ACTIONS_LIST } from './actionList';

export interface AltServiceResult extends AltOutcome { provider: string; error?: 'unknown_target' }

/** Pool offered to the provider: items that exist no later than the target's era (never the target itself). */
export function allowlistFor(db: Db, targetId: string): string[] {
  const t = db.nodes.find(n => n.id === targetId);
  if (!t) return [];
  const eraIdx = new Map(db.eras.map((e, i) => [e.id, i]));
  const lim = eraIdx.get(t.era) ?? 0;
  return db.nodes
    .filter(n => n.id !== targetId && (eraIdx.get(n.era) ?? 0) <= lim && n.ds <= t.ds && !(n.caution ?? '').toLowerCase().includes('placeholder'))
    .map(n => n.id);
}

export async function suggestAlternatives(db: Db, targetId: string, provider: AltProvider): Promise<AltServiceResult> {
  const target = db.nodes.find(n => n.id === targetId);
  if (!target) return { targetId, outcome: 'rejected_response', results: [], reasons: ['UNKNOWN_TARGET'], provider: provider.name, error: 'unknown_target' };
  const allow = allowlistFor(db, targetId);
  const raw = await provider.propose({
    targetId, targetName: target.n, verifiedFacts: [target.l1, target.l2, target.l3].filter(Boolean),
    allowlist: allow, existingRoutes: (target.rec ?? []).map(r => [...r]), actions: [...ACTIONS_LIST],
  });
  const res = validateAltResponse(raw, targetId, {
    db, allowlist: new Set(allow), actions: new Set(ACTIONS_LIST),
    knownSourceIds: new Set(Object.keys(db.sources ?? {})), index: buildRecipeIndex(db),
  });
  return { ...res, provider: provider.name };
}
