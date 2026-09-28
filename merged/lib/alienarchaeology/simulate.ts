import { template } from './catalog';
import { ALL_AXES } from './generate';
import type {
  AlienSiteState, AxisId, AxisResult, AxisValue, FieldReport, SiteEvent,
} from './types';

/* ============================================================================
   FIELD REPORT LOGIC — the entire pure, deterministic core. No budgets to
   spend (reveal freely — the interesting decision here is what you
   conclude, not what you can afford to look at). Scoring is calibration,
   never correctness: `matched ? confidence : (1 - confidence)` per axis,
   the textbook Brier-style reward for honest uncertainty — a confident
   wrong guess scores worse than a hedged one, and a confident right guess
   scores better than a hedged one, exactly rewarding calibrated belief.
   ========================================================================== */

export type AlienAction =
  | { kind: 'reveal'; specimenId: string }
  | { kind: 'setHypothesis'; axis: AxisId; value: AxisValue }
  | { kind: 'setConfidence'; axis: AxisId; value: number }
  | { kind: 'submit' };

function clone(state: AlienSiteState): AlienSiteState { return JSON.parse(JSON.stringify(state)); }

function buildReport(state: AlienSiteState): FieldReport {
  const axisResults: AxisResult[] = ALL_AXES.map(axis => {
    const hypothesis = state.hypotheses[axis]!;
    const confidence = state.confidences[axis]!;
    const truth = state.truth[axis];
    const matched = hypothesis === truth;
    const calibrationScore = matched ? confidence : (1 - confidence);
    return { axis, hypothesis, confidence, truth, matched, calibrationScore };
  });
  const overallCalibration = axisResults.reduce((a, r) => a + r.calibrationScore, 0) / axisResults.length;
  const matchedCount = axisResults.filter(r => r.matched).length;
  const reportText = overallCalibration >= 0.75
    ? `A well-calibrated report: where you were confident, you were usually right, and where you hedged, you were right to. ${matchedCount} of 3 readings matched the expedition's own best current interpretation — itself never claimed as certain.`
    : overallCalibration >= 0.5
      ? `A middling report: confidence and accuracy did not consistently line up. ${matchedCount} of 3 readings matched the expedition's own best current interpretation.`
      : `A poorly calibrated report: confident claims did not hold up, or real uncertainty went unacknowledged. ${matchedCount} of 3 readings matched the expedition's own best current interpretation — which itself may not be the whole truth.`;
  return { axisResults, overallCalibration, reportText };
}

export function applyAction(input: AlienSiteState, action: AlienAction): { state: AlienSiteState; events: SiteEvent[] } {
  const state = clone(input);
  const events: SiteEvent[] = [];
  const log = (text: string) => { events.push({ text }); state.log = [...state.log, { text }].slice(-40); };

  if (state.ending !== 'ongoing') { log('The field report has already been filed.'); return { state, events }; }

  switch (action.kind) {
    case 'reveal': {
      const spec = state.specimens.find(s => s.id === action.specimenId);
      if (!spec) { log('Unknown specimen.'); break; }
      if (spec.revealed) { log('Already studied.'); break; }
      spec.revealed = true;
      const t = template(spec.templateId);
      log(`Specimen studied: ${t.description}`);
      break;
    }
    case 'setHypothesis': {
      state.hypotheses = { ...state.hypotheses, [action.axis]: action.value };
      log(`Working reading (${action.axis}) recorded.`);
      break;
    }
    case 'setConfidence': {
      const clamped = Math.max(0, Math.min(1, action.value));
      state.confidences = { ...state.confidences, [action.axis]: clamped };
      break;
    }
    case 'submit': {
      const missing = ALL_AXES.filter(a => state.hypotheses[a] == null || state.confidences[a] == null);
      if (missing.length > 0) { log('Set a reading and a confidence for all three questions before filing.'); break; }
      const report = buildReport(state);
      state.report = report;
      state.ending = 'reported';
      log('Field report filed.');
      break;
    }
  }

  return { state, events };
}
