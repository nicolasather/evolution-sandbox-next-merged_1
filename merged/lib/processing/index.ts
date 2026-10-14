import rawDb from '@/data/db.json';
import processingJson from '@/data/processing.json';
import altRoutesJson from '@/data/verified/alt_routes.json';
import type { Db } from '../types';
import { applyProcessing } from './overlay';
import type { ProcessingData } from './types';

/** An editor-approved extra route to an EXISTING item (never a new item). Written only by the
 *  reviewed publish step (tools/verified_content.py); see docs/VERIFIED_CONTENT_PIPELINE.md. */
export interface ApprovedAltRoute { targetId: string; ingredientIds: string[] }

/** Fold approved alternative routes into the processing overlay as extra recipes. Unknown targets and
 *  malformed rows are skipped, never thrown on: a bad file must not take the game down. */
export function mergeAltRoutes(data: ProcessingData, routes: readonly ApprovedAltRoute[], knownIds: ReadonlySet<string>): ProcessingData {
  const extra = routes.filter(r => r && knownIds.has(r.targetId) && Array.isArray(r.ingredientIds)
    && r.ingredientIds.length >= 2 && r.ingredientIds.length <= 5 && r.ingredientIds.every(i => typeof i === 'string' && knownIds.has(i)));
  if (!extra.length) return data;
  return { ...data, recipes: { ...data.recipes, add: [...data.recipes.add, ...extra.map(r => ({ id: r.targetId, rec: [...r.ingredientIds] }))] } };
}

const rawProcessing = processingJson as unknown as ProcessingData;
const known = new Set<string>([...(rawDb as unknown as Db).nodes.map(n => n.id), ...((rawDb as unknown as Db).states ?? []).map(s => s.id)]);

export const processingData: ProcessingData = mergeAltRoutes(
  rawProcessing, ((altRoutesJson as { routes?: ApprovedAltRoute[] }).routes ?? []), known);

/** The database as the game plays it: authored data plus the processing layer. Built once. */
export const playDb: Db = applyProcessing(rawDb as unknown as Db, processingData);
