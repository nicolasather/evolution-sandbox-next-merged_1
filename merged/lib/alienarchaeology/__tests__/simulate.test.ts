import { axisOptions, template } from '@/lib/alienarchaeology/catalog';
import { ALL_AXES, generateSite } from '@/lib/alienarchaeology/generate';
import { applyAction } from '@/lib/alienarchaeology/simulate';
import type { AlienSiteState, AxisValue } from '@/lib/alienarchaeology/types';

function revealAll(state: AlienSiteState): AlienSiteState {
  let s = state;
  for (const spec of s.specimens) s = applyAction(s, { kind: 'reveal', specimenId: spec.id }).state;
  return s;
}

/** A reasonable, evidence-weighing policy: tally every revealed specimen's
 *  weight per axis value, hypothesize the highest tally, and set
 *  confidence from how much that value leads the field — never full
 *  certainty, since this mode's whole point is that certainty isn't
 *  available. Stands in for the brief's "simple AI policy" balance check,
 *  adapted to a calibration-scored, not pass/fail, domain. */
function weighEvidencePolicy(state: AlienSiteState): AlienSiteState {
  let s = revealAll(state);
  for (const axis of ALL_AXES) {
    const tally: Record<string, number> = {};
    for (const opt of axisOptions(axis)) tally[opt as string] = 0;
    for (const spec of s.specimens) {
      const t = template(spec.templateId);
      const weights = t.evidence[axis];
      if (!weights) continue;
      for (const [val, w] of Object.entries(weights)) tally[val] = (tally[val] ?? 0) + (w ?? 0);
    }
    const entries = Object.entries(tally);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    entries.sort((a, b) => b[1] - a[1]);
    const [bestValue, bestWeight] = entries[0];
    // Confidence tracks the actual margin — no artificial floor. Reporting
    // high confidence on a genuinely weak axis is exactly the miscalibration
    // this scoring rule is designed to punish; a well-calibrated policy
    // reports LOW confidence when the evidence itself is thin, and that is
    // the mathematically correct choice under a matched?conf:(1-conf) reward.
    const margin = total > 0 ? bestWeight / total : 1 / entries.length;
    const confidence = Math.max(0.05, Math.min(0.95, margin));
    s = applyAction(s, { kind: 'setHypothesis', axis, value: bestValue as AxisValue }).state;
    s = applyAction(s, { kind: 'setConfidence', axis, value: confidence }).state;
  }
  return s;
}

describe('applyAction (alien archaeology)', () => {
  it('does not mutate the input state (pure)', () => {
    const s = generateSite('purity-check');
    const before = JSON.stringify(s);
    applyAction(s, { kind: 'reveal', specimenId: s.specimens[0].id });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('reveal marks a specimen revealed, idempotently', () => {
    let s = generateSite('reveal-check');
    const id = s.specimens[0].id;
    s = applyAction(s, { kind: 'reveal', specimenId: id }).state;
    expect(s.specimens.find(x => x.id === id)!.revealed).toBe(true);
    const r2 = applyAction(s, { kind: 'reveal', specimenId: id });
    expect(r2.events[0].text).toMatch(/already studied/i);
  });

  it('submit refuses until every axis has both a hypothesis and a confidence', () => {
    let s = generateSite('submit-check');
    const r0 = applyAction(s, { kind: 'submit' });
    expect(r0.state.ending).toBe('ongoing');

    s = applyAction(s, { kind: 'setHypothesis', axis: 'limbCount', value: '2' }).state;
    s = applyAction(s, { kind: 'setConfidence', axis: 'limbCount', value: 0.5 }).state;
    const r1 = applyAction(s, { kind: 'submit' });
    expect(r1.state.ending).toBe('ongoing'); // social + purpose still missing
  });

  it('a fully honest, correct, fully-confident report scores perfect calibration', () => {
    let s = generateSite('perfect-check');
    for (const axis of ALL_AXES) {
      s = applyAction(s, { kind: 'setHypothesis', axis, value: s.truth[axis] }).state;
      s = applyAction(s, { kind: 'setConfidence', axis, value: 1 }).state;
    }
    const r = applyAction(s, { kind: 'submit' });
    expect(r.state.ending).toBe('reported');
    expect(r.state.report!.overallCalibration).toBeCloseTo(1, 5);
    expect(r.state.report!.axisResults.every(x => x.matched)).toBe(true);
  });

  it('a confidently WRONG report scores worse than an honestly uncertain wrong report', () => {
    let confident = generateSite('confident-wrong');
    let hedged = generateSite('confident-wrong'); // same seed, same truth
    for (const axis of ALL_AXES) {
      const options = axisOptions(axis).filter(v => v !== confident.truth[axis]);
      const wrongValue = options[0];
      confident = applyAction(confident, { kind: 'setHypothesis', axis, value: wrongValue }).state;
      confident = applyAction(confident, { kind: 'setConfidence', axis, value: 0.95 }).state;
      hedged = applyAction(hedged, { kind: 'setHypothesis', axis, value: wrongValue }).state;
      hedged = applyAction(hedged, { kind: 'setConfidence', axis, value: 0.5 }).state;
    }
    const rc = applyAction(confident, { kind: 'submit' }).state.report!;
    const rh = applyAction(hedged, { kind: 'submit' }).state.report!;
    expect(rc.overallCalibration).toBeLessThan(rh.overallCalibration);
  });

  it('a confidently RIGHT report scores better than an unnecessarily hedged right report', () => {
    let confident = generateSite('confident-right');
    let hedged = generateSite('confident-right');
    for (const axis of ALL_AXES) {
      confident = applyAction(confident, { kind: 'setHypothesis', axis, value: confident.truth[axis] }).state;
      confident = applyAction(confident, { kind: 'setConfidence', axis, value: 0.95 }).state;
      hedged = applyAction(hedged, { kind: 'setHypothesis', axis, value: hedged.truth[axis] }).state;
      hedged = applyAction(hedged, { kind: 'setConfidence', axis, value: 0.5 }).state;
    }
    const rc = applyAction(confident, { kind: 'submit' }).state.report!;
    const rh = applyAction(hedged, { kind: 'submit' }).state.report!;
    expect(rc.overallCalibration).toBeGreaterThan(rh.overallCalibration);
  });

  it('a policy that honestly weighs the revealed evidence scores meaningfully above the uninformative 0.5 floor, on average', () => {
    // Under a matched?conf:(1-conf) reward, reporting confidence equal to
    // your true P(correct) is the mathematically optimal honest strategy,
    // and its expected score only clearly exceeds 0.5 when that true
    // accuracy is well away from a coin flip — this mode's specimens are
    // deliberately noisy (unlike lib/archaeology's or lib/decipher's
    // provably-solvable evidence), so the fair, honest bar here is
    // "meaningfully better than uninformative", not "high in absolute
    // terms" — scoring near-certain would mean the ambiguity this mode
    // is actually about had quietly been engineered away.
    let total = 0;
    const n = 40;
    for (let i = 0; i < n; i++) {
      let s = generateSite(`weigh-check-${i}`);
      s = weighEvidencePolicy(s);
      s = applyAction(s, { kind: 'submit' }).state;
      total += s.report!.overallCalibration;
    }
    expect(total / n).toBeGreaterThan(0.53);
  });

  it('does nothing once the report has already been filed', () => {
    let s = generateSite('closed-check');
    for (const axis of ALL_AXES) {
      s = applyAction(s, { kind: 'setHypothesis', axis, value: s.truth[axis] }).state;
      s = applyAction(s, { kind: 'setConfidence', axis, value: 0.8 }).state;
    }
    s = applyAction(s, { kind: 'submit' }).state;
    const beforeReport = s.report;
    const r = applyAction(s, { kind: 'reveal', specimenId: s.specimens[0].id });
    expect(r.state.report).toEqual(beforeReport);
    expect(r.events[0].text).toMatch(/already been filed/i);
  });
});
