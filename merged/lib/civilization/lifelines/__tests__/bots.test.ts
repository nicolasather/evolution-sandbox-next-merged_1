import { createRun, ledgerResidual, validateRunState } from '../engine';
import { cautiousReserve, focusedGrowth, ix, recoveryFromShortage, runBot, variantId } from '../__testing__/helpers';

const chapters = ix.chaptersByOrder;

describe('policy bots through the public command surface', () => {
  it.each(chapters.map(c => [c.order, c.id] as const))('focused-growth bot completes chapter %i (%s)', (_o, id) => {
    const start = createRun(ix, { variantId: variantId(id), runId: `bot-${id}` });
    const horizon = ix.variants.get(variantId(id))!.maxTurns;
    const s = runBot(start, focusedGrowth, horizon);
    expect(validateRunState(ix, s)).toBeNull();
    expect(s.completion.completedAtTurn).not.toBeNull();
    for (const r of s.report?.ledger ?? []) expect(ledgerResidual(r)).toBe(0);
  });

  it.each(chapters.map(c => [c.order, c.id] as const))('cautious-reserve bot keeps a valid state in chapter %i (%s)', (_o, id) => {
    const start = createRun(ix, { variantId: variantId(id), runId: `caut-${id}` });
    const s = runBot(start, cautiousReserve, ix.variants.get(variantId(id))!.maxTurns);
    expect(validateRunState(ix, s)).toBeNull();
    expect(s.completion.completedAtTurn).not.toBeNull();
  });

  it('recovery bot survives shortages without negative stock or collapse, past the horizon', () => {
    for (const c of [chapters[3], chapters[9], chapters[15], chapters[23]]) {
      let s = createRun(ix, { variantId: variantId(c.id), runId: `rec-${c.id}` });
      // let shortages develop untouched, then respond
      for (let i = 0; i < 6; i++) s = runBot(s, () => [], 1);
      s = runBot(s, recoveryFromShortage, 40);
      expect(validateRunState(ix, s)).toBeNull();
      for (const v of Object.values(s.stocks)) expect(v).toBeGreaterThanOrEqual(0);
      expect(s.completion.status).not.toBe('archived');
    }
  });

  it('replay variants of every chapter are playable by the focused bot (spread across 288 variants)', () => {
    const picks = ix.db.variants.filter((_, i) => i % 6 === 0);
    let completed = 0;
    for (const v of picks) {
      const s = runBot(createRun(ix, { variantId: v.id, runId: `rv-${v.id}` }), focusedGrowth, v.maxTurns);
      expect(validateRunState(ix, s)).toBeNull();
      if (s.completion.completedAtTurn !== null) completed++;
    }
    // Replays may be harder in hostile environments, but most must be completable by a simple policy.
    expect(completed / picks.length).toBeGreaterThan(0.8);
  });
});
