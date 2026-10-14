import type { Db } from '../types';
import { recipeKey, ITEM_ID_RE, MIN_SLOTS, MAX_SLOTS } from './recipeKey';
import { buildRecipeIndex, type RecipeIndex } from './strictCraft';
import { multiKey } from '../processing/overlay';

/* ============================================================================
   ALTERNATIVE-RECIPE PROPOSALS  (optional, 0..N, never new items)

   A provider (model, mock, or a human) answers for ONE existing target with
   zero or more extra routes, or an explicit NONE. This module is the trust
   boundary: whatever comes back is parsed as plain JSON, checked against the
   allowlist and the existing graph, and only then marked `schema_valid`.
   Schema-valid is NOT approved: owner review (and a versioned release) is.
   Confidence/score is diagnostic only and can never rescue a rejected proposal.
   ========================================================================== */

export const EVIDENCE_CLASSES = ['documented', 'plausible_reconstruction', 'gameplay_only'] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export type RejectCode =
  | 'MALFORMED_JSON' | 'BAD_SCHEMA_VERSION' | 'TARGET_MISMATCH' | 'UNKNOWN_TARGET' | 'BAD_CARDINALITY'
  | 'INGREDIENT_NOT_ALLOWED' | 'BAD_ACTION' | 'EXPLANATION_TOO_SHORT' | 'WEAK_ASSOCIATION' | 'BAD_EVIDENCE_CLASS'
  | 'INFLATED_SOURCES' | 'DUPLICATE_ROUTE_SAME_TARGET' | 'ROUTE_CLAIMED_BY_OTHER_TARGET' | 'SELF_REFERENCE'
  | 'ERA_CONFLICT' | 'UNEXPECTED_FIELD' | 'TOO_MANY_PROPOSALS' | 'NEW_ITEM_ATTEMPT';

export interface RawProposal {
  ingredientIds: string[];
  action?: string;
  explanation: string;
  evidenceClass: EvidenceClass;
  sourceSupportIds?: string[];
}

export interface ProposalResult {
  index: number;
  status: 'schema_valid' | 'rejected';
  reasons: RejectCode[];
  recipeKey?: string;
  proposal?: RawProposal;
}

export interface AltOutcome {
  targetId: string;
  /** 'none' is a first-class, correct answer. */
  outcome: 'none' | 'proposals' | 'rejected_response';
  results: ProposalResult[];
  reasons: RejectCode[];
}

export interface AltContext {
  db: Db;
  /** Ingredient allowlist actually offered to the provider. */
  allowlist: ReadonlySet<string>;
  /** Valid action ids (single source of truth: ActionId in lib/types.ts, passed in by the caller). */
  actions: ReadonlySet<string>;
  /** Ids of sources the batch really has — a proposal can cite these and nothing else. */
  knownSourceIds: ReadonlySet<string>;
  index?: RecipeIndex;
  maxProposals?: number;
}

const WEAK = /\b(symbolic(ally)?|represents?|reminds? of|associated with|theme|thematic|related to|idea of|spirit of|inspired by|magic(al)?|somehow|vibe)\b/i;
const ALLOWED_TOP = new Set(['schemaVersion', 'targetId', 'proposals']);
const ALLOWED_PROP = new Set(['ingredientIds', 'action', 'explanation', 'evidenceClass', 'sourceSupportIds']);

export function validateAltResponse(raw: unknown, requestedTargetId: string, ctx: AltContext): AltOutcome {
  const fail = (reasons: RejectCode[]): AltOutcome => ({ targetId: requestedTargetId, outcome: 'rejected_response', results: [], reasons });
  let data: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 32_000) return fail(['MALFORMED_JSON']);
    try { data = JSON.parse(raw); } catch { return fail(['MALFORMED_JSON']); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail(['MALFORMED_JSON']);
  const o = data as Record<string, unknown>;
  const reasons: RejectCode[] = [];
  if (Object.keys(o).some(k => !ALLOWED_TOP.has(k))) reasons.push('UNEXPECTED_FIELD');
  if (o.schemaVersion !== 1) reasons.push('BAD_SCHEMA_VERSION');
  if (o.targetId !== requestedTargetId) reasons.push('TARGET_MISMATCH');
  const target = ctx.db.nodes.find(n => n.id === requestedTargetId);
  if (!target) reasons.push('UNKNOWN_TARGET');
  if (!Array.isArray(o.proposals)) reasons.push('MALFORMED_JSON');
  if (reasons.length) return fail(reasons);

  const props = o.proposals as unknown[];
  const max = ctx.maxProposals ?? 3;
  if (props.length > max) return fail(['TOO_MANY_PROPOSALS']);
  if (props.length === 0) return { targetId: requestedTargetId, outcome: 'none', results: [], reasons: [] };

  const index = ctx.index ?? buildRecipeIndex(ctx.db);
  const byId = new Map(ctx.db.nodes.map(n => [n.id, n]));
  const eraIdx = new Map(ctx.db.eras.map((e, i) => [e.id, i]));
  const eraOf = (id: string) => { const e = byId.get(id)?.era; return e ? (eraIdx.get(e) ?? 0) : 0; };
  const seenKeys = new Set<string>();
  const results: ProposalResult[] = props.map((p, i) => {
    const rs = new Set<RejectCode>();
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { index: i, status: 'rejected', reasons: ['MALFORMED_JSON'] };
    const q = p as Record<string, unknown>;
    if (Object.keys(q).some(k => !ALLOWED_PROP.has(k))) {
      // any attempt to smuggle in a new item / name / date is its own, loud, code
      rs.add(Object.keys(q).some(k => /^(name|n|canonicalName|itemId|id|date|ds|era|newItem)$/.test(k)) ? 'NEW_ITEM_ATTEMPT' : 'UNEXPECTED_FIELD');
    }
    const ing = q.ingredientIds;
    let key: string | undefined;
    if (!Array.isArray(ing) || ing.length < MIN_SLOTS || ing.length > MAX_SLOTS) rs.add('BAD_CARDINALITY');
    else if (ing.some(x => typeof x !== 'string' || !ITEM_ID_RE.test(x) || !ctx.allowlist.has(x))) rs.add('INGREDIENT_NOT_ALLOWED');
    else {
      const ids = ing as string[];
      key = recipeKey(ids);
      if (ids.includes(requestedTargetId)) rs.add('SELF_REFERENCE');
      const owner = index.get(multiKey(ids));
      if (owner === requestedTargetId) rs.add('DUPLICATE_ROUTE_SAME_TARGET');
      else if (owner) rs.add('ROUTE_CLAIMED_BY_OTHER_TARGET');
      if (key && seenKeys.has(key)) rs.add('DUPLICATE_ROUTE_SAME_TARGET');
      seenKeys.add(key);
      const tIdx = target ? (eraIdx.get(target.era) ?? 0) : 0;
      if (ids.some(i2 => eraOf(i2) > tIdx)) rs.add('ERA_CONFLICT');
    }
    if (q.action !== undefined && (typeof q.action !== 'string' || !ctx.actions.has(q.action))) rs.add('BAD_ACTION');
    const ex = typeof q.explanation === 'string' ? q.explanation.trim() : '';
    if (ex.length < 40) rs.add('EXPLANATION_TOO_SHORT');
    if (WEAK.test(ex)) rs.add('WEAK_ASSOCIATION');
    if (!EVIDENCE_CLASSES.includes(q.evidenceClass as EvidenceClass)) rs.add('BAD_EVIDENCE_CLASS');
    const sup = q.sourceSupportIds;
    if (sup !== undefined && (!Array.isArray(sup) || sup.some(s => typeof s !== 'string' || !ctx.knownSourceIds.has(s)))) rs.add('INFLATED_SOURCES');
    if (q.evidenceClass === 'documented' && !(Array.isArray(sup) && sup.length)) rs.add('INFLATED_SOURCES');
    if (rs.size) return { index: i, status: 'rejected', reasons: [...rs].sort() };
    return { index: i, status: 'schema_valid', reasons: [], recipeKey: key, proposal: q as unknown as RawProposal };
  });
  return {
    targetId: requestedTargetId,
    outcome: results.some(r => r.status === 'schema_valid') ? 'proposals' : 'rejected_response',
    results, reasons: [],
  };
}
