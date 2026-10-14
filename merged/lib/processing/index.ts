import rawDb from '@/data/db.json';
import processingJson from '@/data/processing.json';
import altRoutesJson from '@/data/verified/alt_routes.json';
import type { Db } from '../types';
import { applyProcessing, multiKey } from './overlay';
import type { ProcessingData } from './types';

/** An editor-approved extra route to an EXISTING item (never a new item). Written only by the
 *  reviewed publish step (tools/verified_content.py); see docs/VERIFIED_CONTENT_PIPELINE.md. */
export interface ApprovedAltRoute { targetId: string; ingredientIds: string[] }

/** Fold approved alternative routes into the processing overlay as extra recipes. Unknown targets and
 *  malformed rows are skipped, never thrown on: a bad file must not take the game down. */
export function mergeAltRoutes(data: ProcessingData, routes: readonly ApprovedAltRoute[], knownIds: ReadonlySet<string>, taken: ReadonlySet<string> = new Set()): ProcessingData {
  const seen = new Set<string>(taken);                 // an existing (canonical) recipe ALWAYS wins; first approved route wins among alts
  const extra = routes.filter(r => r && knownIds.has(r.targetId) && Array.isArray(r.ingredientIds)
    && r.ingredientIds.length >= 2 && r.ingredientIds.length <= 5 && r.ingredientIds.every(i => typeof i === 'string' && knownIds.has(i))
    && !r.ingredientIds.includes(r.targetId))
    .filter(r => { const k = multiKey(r.ingredientIds); if (seen.has(k)) return false; seen.add(k); return true; });
  if (!extra.length) return data;
  return { ...data, recipes: { ...data.recipes, add: [...data.recipes.add, ...extra.map(r => ({ id: r.targetId, rec: [...r.ingredientIds] }))] } };
}

const rawProcessing = processingJson as unknown as ProcessingData;
const known = new Set<string>([...(rawDb as unknown as Db).nodes.map(n => n.id), ...((rawDb as unknown as Db).states ?? []).map(s => s.id)]);

/** every recipe the game already owns (authored + processing), by multiset key */
const takenKeys = (() => {
  const t = new Set<string>();
  const retired = new Set(rawProcessing.recipes.retire.map(e => `${e.id}|${multiKey(e.rec)}`));
  for (const n of (rawDb as unknown as Db).nodes) for (const r of n.rec) if (!retired.has(`${n.id}|${multiKey(r)}`)) t.add(multiKey(r));
  for (const e of rawProcessing.recipes.add) t.add(multiKey(e.rec));
  return t;
})();

export const altRoutesFile = altRoutesJson as unknown as { schemaVersion: number; routes?: ApprovedAltRoute[]; manifestSha256?: string };

/** The game exactly as shipped BEFORE any approved alternative route (used to compile and certify releases). */
export const baseProcessingData: ProcessingData = rawProcessing;
export const baseKnownIds: ReadonlySet<string> = known;
export const baseTakenKeys: ReadonlySet<string> = takenKeys;

export const processingData: ProcessingData = mergeAltRoutes(
  rawProcessing, (altRoutesFile.routes ?? []), known, takenKeys);

/** The database as the game plays it: authored data plus the processing layer. Built once. */
export const playDb: Db = applyProcessing(rawDb as unknown as Db, processingData);
