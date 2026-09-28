import { template } from './catalog';
import { FUNCTION_LABEL } from './read';
import type {
  Budgets, Find, FunctionAffinity, ReportVerdict, SiteEvent, SiteFunction, SitePhase, SiteState, Square,
} from './types';

/* ============================================================================
   SITE SIMULATION — the entire pure, deterministic core. Every action is a
   scarce spend against one of three independent budgets (survey, excavate,
   analyze) — no Math.random here; the only randomness in this mode lives at
   generation time (generate.ts). A find only ever becomes usable evidence
   once excavated AND analyzed; an unanalyzed find is just a silhouette.
   ========================================================================== */

export type SiteAction =
  | { kind: 'survey'; x: number; y: number }
  | { kind: 'excavate'; x: number; y: number }
  | { kind: 'analyze'; findId: string }
  | { kind: 'hypothesize'; field: 'function'; value: SiteFunction }
  | { kind: 'hypothesize'; field: 'phase'; value: SitePhase }
  | { kind: 'report' };

const ALL_FUNCTIONS: SiteFunction[] = ['seasonal-camp', 'permanent-settlement', 'workshop', 'ceremonial-site'];

function clone(state: SiteState): SiteState { return JSON.parse(JSON.stringify(state)); }

function squareAt(state: SiteState, x: number, y: number): Square | undefined {
  return state.squares[y]?.[x];
}

/** A find is visible/usable evidence once the layer it sits in has been
 *  excavated — derived from the square's own dig progress, never a
 *  separately stored flag, so it can never drift out of sync. */
export function isFindRevealed(state: SiteState, find: Find): boolean {
  const sq = squareAt(state, find.squareX, find.squareY);
  return !!sq && find.contextIndex < sq.dugContexts;
}

function surveyScore(square: Square): number {
  return square.contexts.reduce((sum, ctx, i) => sum + ctx.findIds.length * (1 / (i + 1)), 0);
}

function budgetOk(spent: Budgets, budgets: Budgets, key: keyof Budgets): boolean {
  return spent[key] < budgets[key];
}

function muteAffinity(affinity: FunctionAffinity, factor: number): FunctionAffinity {
  const out: FunctionAffinity = {};
  for (const fn of ALL_FUNCTIONS) {
    const v = affinity[fn] ?? 0.05;
    out[fn] = 0.25 + (v - 0.25) * factor;
  }
  return out;
}

function buildReport(state: SiteState): ReportVerdict {
  const chosen = state.hypotheses.function;
  const analyzed = state.finds.filter(f => f.analyzed && f.analysis);
  if (!chosen) {
    return {
      evidenceScore: 0, verdict: 'weak', functionMatchedTruth: false, phaseMatchedTruth: false,
      analyzedCount: analyzed.length, reportText: 'No interpretation was recorded.',
    };
  }
  let supportSum = 0;
  let maxSum = 0;
  for (const f of analyzed) {
    const aff = f.analysis!.affinity;
    const vals = ALL_FUNCTIONS.map(fn => aff[fn] ?? 0.05);
    maxSum += Math.max(...vals);
    supportSum += aff[chosen] ?? 0.05;
  }
  const evidenceScore = maxSum > 0 ? supportSum / maxSum : 0;
  const verdict: ReportVerdict['verdict'] =
    analyzed.length >= 3 && evidenceScore >= 0.7 ? 'well-supported'
    : evidenceScore >= 0.4 ? 'plausible'
    : 'weak';
  const functionMatchedTruth = chosen === state.truth.function;
  const phaseMatchedTruth = state.hypotheses.phase != null && state.hypotheses.phase === state.truth.primaryPhase;

  const verdictText = verdict === 'well-supported'
    ? 'The excavated evidence strongly and consistently supports this reading.'
    : verdict === 'plausible'
      ? 'The excavated evidence leans this way, but real gaps remain — a fuller excavation could still change the picture.'
      : analyzed.length === 0
        ? 'No evidence was analyzed before the report was written — this is a guess, not a case.'
        : 'The excavated evidence is too thin or too mixed to really argue for this reading.';
  const truthText = functionMatchedTruth
    ? 'The site’s own generated history agrees with this interpretation.'
    : `The site’s own generated history was actually different (${FUNCTION_LABEL[state.truth.function]}) — a reminder that a thin excavation can support a reasonable case that still turns out wrong.`;

  return {
    evidenceScore, verdict, functionMatchedTruth, phaseMatchedTruth,
    analyzedCount: analyzed.length,
    reportText: `${verdictText} ${truthText}`,
  };
}

export function applyAction(input: SiteState, action: SiteAction): { state: SiteState; events: SiteEvent[] } {
  const state = clone(input);
  const events: SiteEvent[] = [];
  const log = (text: string) => { events.push({ text }); state.log = [...state.log, { text }].slice(-40); };

  if (state.ending !== 'ongoing') { log('The report has already been filed — this dig is closed.'); return { state, events }; }

  switch (action.kind) {
    case 'survey': {
      const sq = squareAt(state, action.x, action.y);
      if (!sq) { log('That square does not exist.'); break; }
      if (sq.surveyHint !== 'unsurveyed') { log(`Square (${action.x}, ${action.y}) has already been surveyed.`); break; }
      if (!budgetOk(state.spent, state.budgets, 'survey')) { log('No survey time left.'); break; }
      const score = surveyScore(sq);
      sq.surveyHint = score >= 1 ? 'strong' : score > 0 ? 'faint' : 'none';
      state.spent.survey += 1;
      log(`Survey of square (${action.x}, ${action.y}): ${sq.surveyHint === 'strong' ? 'a strong surface indication' : sq.surveyHint === 'faint' ? 'a faint surface indication' : 'no surface indication'}.`);
      break;
    }
    case 'excavate': {
      const sq = squareAt(state, action.x, action.y);
      if (!sq) { log('That square does not exist.'); break; }
      if (sq.dugContexts >= sq.contexts.length) { log(`Square (${action.x}, ${action.y}) has reached sterile soil — nothing further here.`); break; }
      if (!budgetOk(state.spent, state.budgets, 'excavate')) { log('No excavation time left.'); break; }
      const contextIndex = sq.dugContexts;
      const ctx = sq.contexts[contextIndex];
      sq.dugContexts += 1;
      state.spent.excavate += 1;
      if (ctx.findIds.length === 0) {
        log(`Square (${action.x}, ${action.y}), ${ctx.soil}: nothing recovered at this depth.`);
      } else {
        for (const id of ctx.findIds) {
          const find = state.finds.find(f => f.id === id);
          if (find) log(`Square (${action.x}, ${action.y}), ${ctx.soil}: a ${template(find.templateId).label.toLowerCase()} emerges.`);
        }
      }
      break;
    }
    case 'analyze': {
      const find = state.finds.find(f => f.id === action.findId);
      if (!find) { log('Unknown find.'); break; }
      if (!isFindRevealed(state, find)) { log('That find has not been excavated yet.'); break; }
      if (find.analyzed) { log('Already analyzed.'); break; }
      if (!budgetOk(state.spent, state.budgets, 'analyze')) { log('No laboratory time left.'); break; }
      const t = template(find.templateId);
      const confidence = find.preservation === 'good' ? 'high' : find.preservation === 'fair' ? 'medium' : 'low';
      const factor = confidence === 'high' ? 1 : confidence === 'medium' ? 0.7 : 0.35;
      find.analyzed = true;
      find.analysis = { material: t.material, likelyFunction: t.commonFunction, phaseEstimate: find.phase, confidence, affinity: muteAffinity(t.affinity, factor) };
      state.spent.analyze += 1;
      log(`Lab analysis — ${t.label}: ${t.commonFunction} (${confidence} confidence).`);
      break;
    }
    case 'hypothesize': {
      state.hypotheses = { ...state.hypotheses, [action.field]: action.value };
      const text = action.field === 'function' ? FUNCTION_LABEL[action.value as SiteFunction] : action.value;
      log(`Working hypothesis (${action.field}): ${text}.`);
      break;
    }
    case 'report': {
      if (!state.hypotheses.function) { log('Select a function hypothesis before writing the report.'); break; }
      const report = buildReport(state);
      state.report = report;
      state.ending = 'reported';
      log('Report filed.');
      break;
    }
  }

  return { state, events };
}
