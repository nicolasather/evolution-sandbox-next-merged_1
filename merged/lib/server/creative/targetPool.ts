import { createHash } from 'node:crypto';
import type { CreativeCatalog, Profile } from './catalog';
import { MAX_CANDIDATES, type TargetRule } from './types';

/* Ticket 074 — bounded, explainable shortlist of APPROVED targets. Not an embedding search: every inclusion is
   a stated rule about era, material and process. Empty is a valid, common answer and ends the request without
   any model call. Placeholders and pending-evidence entries are never targets. */

export const POOL_RULES_VERSION = 'pool-2';
/** a result may be at most this many ages later than its latest part */
export const MAX_ERA_LEAP = 2;

function flowOk(targetFamily: string, fams: ReadonlySet<string>): boolean {
  const FLOW: Record<string, readonly string[]> = {
    stone: ['stone'], wood: ['wood'], bone: ['bone'], fibre: ['fibre'], earth: ['earth', 'liquid'],
    metal: ['metal', 'stone'], glass: ['glass', 'earth'], liquid: ['liquid'], living: ['wood', 'fibre', 'bone', 'earth', 'living'],
  };
  const need = FLOW[targetFamily];
  if (need) return need.some(f => fams.has(f));
  if (targetFamily === 'made') return fams.size >= 2 || fams.has('made');
  return false;                                  // abstract targets are never produced by working matter
}

export interface Pool { rules: TargetRule[]; fingerprint: string }

export function candidatePool(cat: CreativeCatalog, ids: readonly string[], actionId: string | null, profiles: readonly Profile[]): Pool {
  const fams = new Set(profiles.map(p => p.family));
  const maxEra = Math.max(...profiles.map(p => p.eraRank));
  const idSet = new Set(ids);
  const process = actionId ?? 'assemble';
  const scored: { rule: TargetRule; score: number; id: string }[] = [];
  for (const n of cat.db.nodes) {
    const p = cat.profiles.get(n.id)!;
    if (p.status !== 'verified' || !n.rec?.length || idSet.has(n.id)) continue;
    if (p.eraRank < maxEra || p.eraRank > maxEra + MAX_ERA_LEAP) continue; // chronology: never earlier than a part, never a leap across ages
    if (!flowOk(p.family, fams)) continue;                              // material can actually flow from parts to result
    // the parts must already contain every kind of material of one of the item's own real recipes
    const sharedFamily = n.rec.some(r => r.every(i => fams.has(cat.profiles.get(i)?.family ?? '')));
    if (!sharedFamily) continue;
    // assembled / engineered results must also share at least one real ingredient with a recipe of their own
    if (p.family === 'made' && !n.rec.some(r => r.some(i => idSet.has(i)))) continue;
    const transformMatch = !!actionId && (cat.proc.byOut.get(n.id) ?? []).some(t => t.action === actionId);
    const why = [`${p.family} reachable from ${[...fams].sort().join('+')}`, `era ${p.era} >= parts`, transformMatch ? `${actionId} is a known process for it` : 'shares a material with its own recipe'];
    scored.push({
      id: n.id, score: (transformMatch ? 100 : 0) - (p.eraRank - maxEra),
      rule: { targetId: n.id, processId: process, ingredientIds: [...ids], actionId, rationale: why.join('; ') },
    });
  }
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const rules = scored.slice(0, MAX_CANDIDATES).map(s => s.rule);
  const fingerprint = createHash('sha256').update([POOL_RULES_VERSION, ...rules.map(r => r.targetId)].join('|')).digest('hex').slice(0, 16);
  return { rules, fingerprint };
}
