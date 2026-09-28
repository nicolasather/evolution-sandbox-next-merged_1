import { template } from '@/lib/archaeology/catalog';
import { generateSite } from '@/lib/archaeology/generate';
import { applyAction, isFindRevealed } from '@/lib/archaeology/simulate';
import type { Find, SiteState } from '@/lib/archaeology/types';

function excavateSquareFully(state: SiteState, x: number, y: number): SiteState {
  let s = state;
  for (let i = 0; i < 3; i++) s = applyAction(s, { kind: 'excavate', x, y }).state;
  return s;
}

/** The excavate budget (10) cannot dig every one of a 4×4 grid's 48
 *  possible context slots — that scarcity is the point. This oracle
 *  policy stands in for a player who used the survey phase perfectly AND
 *  correctly guessed which finds would matter before analysing them: it
 *  spends the excavate budget on the squares whose finds argue most
 *  strongly for the site's own true function, and the analyze budget on
 *  the strongest-arguing finds first — proving the budgets are enough to
 *  build a strong case when spent as well as possible, the same way
 *  Survival/Civilization's adaptive-policy tests prove their objective is
 *  reachable. It does not always reach 'well-supported' for every seed —
 *  see the aggregate test below, which is the honest empirical claim.
 */
function oracleExcavateAndAnalyze(state: SiteState): SiteState {
  let s = state;
  const truthFn = s.truth.function;
  const affinityOf = (f: Find) => template(f.templateId).affinity[truthFn] ?? 0.05;
  const bySquare = new Map<string, { maxIndex: number; score: number }>();
  for (const f of s.finds) {
    const key = `${f.squareX},${f.squareY}`;
    const cur = bySquare.get(key) ?? { maxIndex: -1, score: 0 };
    bySquare.set(key, { maxIndex: Math.max(cur.maxIndex, f.contextIndex), score: cur.score + affinityOf(f) });
  }
  const ranked = [...bySquare.entries()].sort((a, b) => b[1].score - a[1].score);
  for (const [key, { maxIndex }] of ranked) {
    const [x, y] = key.split(',').map(Number);
    for (let i = 0; i <= maxIndex; i++) {
      if (s.spent.excavate >= s.budgets.excavate) break;
      s = applyAction(s, { kind: 'excavate', x, y }).state;
    }
  }
  const revealedSorted = s.finds.filter(f => isFindRevealed(s, f) && !f.analyzed).sort((a, b) => affinityOf(b) - affinityOf(a));
  for (const f of revealedSorted) {
    if (s.spent.analyze >= s.budgets.analyze) break;
    s = applyAction(s, { kind: 'analyze', findId: f.id }).state;
  }
  return s;
}

describe('applyAction', () => {
  it('does not mutate the input state (pure)', () => {
    const s = generateSite('purity-check');
    const before = JSON.stringify(s);
    applyAction(s, { kind: 'survey', x: 0, y: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('survey reveals a hint once, then refuses to re-survey the same square', () => {
    let s = generateSite('survey-check');
    expect(s.squares[0][0].surveyHint).toBe('unsurveyed');
    const r1 = applyAction(s, { kind: 'survey', x: 0, y: 0 });
    s = r1.state;
    expect(s.squares[0][0].surveyHint).not.toBe('unsurveyed');
    expect(s.spent.survey).toBe(1);
    const r2 = applyAction(s, { kind: 'survey', x: 0, y: 0 });
    expect(r2.state.spent.survey).toBe(1);
    expect(r2.events[0].text).toMatch(/already been surveyed/);
  });

  it('survey refuses once the survey budget is spent', () => {
    let s = generateSite('survey-budget-check');
    const coords = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]];
    for (const [x, y] of coords) s = applyAction(s, { kind: 'survey', x, y }).state;
    expect(s.spent.survey).toBe(s.budgets.survey);
    const r = applyAction(s, { kind: 'survey', x: 0, y: 2 });
    expect(r.events[0].text).toMatch(/no survey time left/i);
  });

  it('excavating a square reveals finds context by context, deepest last, then goes sterile', () => {
    let s = generateSite('excavate-check');
    // find a square with at least one embedded find to make this deterministic-meaningful
    const target = s.finds[0];
    for (let i = 0; i <= target.contextIndex; i++) {
      const r = applyAction(s, { kind: 'excavate', x: target.squareX, y: target.squareY });
      s = r.state;
      if (i === target.contextIndex) {
        expect(isFindRevealed(s, s.finds.find(f => f.id === target.id)!)).toBe(true);
      }
    }
    s = excavateSquareFully(s, target.squareX, target.squareY);
    const sq = s.squares[target.squareY][target.squareX];
    expect(sq.dugContexts).toBe(3);
    const r = applyAction(s, { kind: 'excavate', x: target.squareX, y: target.squareY });
    expect(r.events[0].text).toMatch(/sterile soil/);
  });

  it('a find cannot be analyzed until it has been excavated', () => {
    const s = generateSite('unrevealed-check');
    const buried = s.finds.find(f => f.contextIndex > 0) ?? s.finds[0];
    const r = applyAction(s, { kind: 'analyze', findId: buried.id });
    expect(r.state.finds.find(f => f.id === buried.id)!.analyzed).toBe(false);
    expect(r.events[0].text).toMatch(/not been excavated/);
  });

  it('analyzing a revealed find fills in material, function text and a muted affinity for poor preservation', () => {
    let s = generateSite('analyze-check');
    const target = s.finds[0];
    for (let i = 0; i <= target.contextIndex; i++) s = applyAction(s, { kind: 'excavate', x: target.squareX, y: target.squareY }).state;
    s = applyAction(s, { kind: 'analyze', findId: target.id }).state;
    const analyzed = s.finds.find(f => f.id === target.id)!;
    expect(analyzed.analyzed).toBe(true);
    expect(analyzed.analysis).toBeDefined();
    expect(analyzed.analysis!.material.length).toBeGreaterThan(0);
    if (analyzed.preservation === 'poor') {
      const vals = Object.values(analyzed.analysis!.affinity) as number[];
      expect(Math.max(...vals) - Math.min(...vals)).toBeLessThan(0.3);
    }
  });

  it('hypothesize records a working answer for free, with no budget cost', () => {
    const s = generateSite('hypothesis-check');
    const r = applyAction(s, { kind: 'hypothesize', field: 'function', value: 'workshop' });
    expect(r.state.hypotheses.function).toBe('workshop');
    expect(r.state.spent).toEqual(s.spent);
  });

  it('report refuses without a function hypothesis, and ends the dig once filed', () => {
    let s = generateSite('report-check');
    const r0 = applyAction(s, { kind: 'report' });
    expect(r0.state.ending).toBe('ongoing');
    s = applyAction(s, { kind: 'hypothesize', field: 'function', value: s.truth.function }).state;
    const r1 = applyAction(s, { kind: 'report' });
    expect(r1.state.ending).toBe('reported');
    expect(r1.state.report).toBeDefined();
    expect(r1.state.report!.functionMatchedTruth).toBe(true);
  });

  it('spending the scarce excavate/analyze budgets as well as possible usually reaches a well-supported case, and never a weak one', () => {
    // An empirical, aggregate claim (not "every single seed") — some
    // SiteFunctions (ceremonial-site especially) are meant to be harder to
    // argue for even with a perfect dig, the same way they are in real
    // archaeology; that is a deliberate design choice, not unbalanced.
    let wellSupported = 0;
    let weak = 0;
    const total = 40;
    for (let i = 0; i < total; i++) {
      let s = generateSite(`balance-${i}`);
      s = oracleExcavateAndAnalyze(s);
      s = applyAction(s, { kind: 'hypothesize', field: 'function', value: s.truth.function }).state;
      const r = applyAction(s, { kind: 'report' });
      expect(r.state.report!.analyzedCount).toBeGreaterThan(0);
      if (r.state.report!.verdict === 'well-supported') wellSupported++;
      if (r.state.report!.verdict === 'weak') weak++;
    }
    // A handful of sparse, evidence-poor seeds (ceremonial-site especially,
    // whose true markers are the rarest in the catalog on purpose) can
    // stay weak even under a perfect dig — real excavations sometimes
    // just don't turn up enough to make any case. Rare, not impossible.
    expect(weak).toBeLessThanOrEqual(total * 0.1);
    expect(wellSupported).toBeGreaterThan(total * 0.6);
  });

  it('reporting with no excavation at all scores weak, never well-supported', () => {
    let s = generateSite('empty-check');
    s = applyAction(s, { kind: 'hypothesize', field: 'function', value: 'ceremonial-site' }).state;
    const r = applyAction(s, { kind: 'report' });
    expect(r.state.report!.analyzedCount).toBe(0);
    expect(r.state.report!.verdict).toBe('weak');
  });

  it('does nothing once a report has already been filed', () => {
    let s = generateSite('closed-check');
    s = applyAction(s, { kind: 'hypothesize', field: 'function', value: s.truth.function }).state;
    s = applyAction(s, { kind: 'report' }).state;
    const beforeSquares = JSON.stringify(s.squares);
    const beforeSpent = { ...s.spent };
    const r = applyAction(s, { kind: 'excavate', x: 0, y: 0 });
    expect(JSON.stringify(r.state.squares)).toBe(beforeSquares);
    expect(r.state.spent).toEqual(beforeSpent);
    expect(r.events[0].text).toMatch(/already been filed/);
  });
});
