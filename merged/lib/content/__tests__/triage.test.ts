import { triageOutcome } from '../altScoring';
import type { AltOutcome, ProposalResult } from '../altValidation';
import { candidatePool, MAX_POOL } from '../candidates';
import { playDb } from '../../processing';

const ok = (i: number, ev: 'documented' | 'plausible_reconstruction' | 'gameplay_only', src: string[]): ProposalResult => ({
  index: i, status: 'schema_valid', reasons: [], recipeKey: `k${i}`,
  proposal: { ingredientIds: ['a', 'b'], explanation: 'x'.repeat(50), evidenceClass: ev, sourceSupportIds: src },
});

describe('alternative triage (package 033)', () => {
  const mk = (results: ProposalResult[]): AltOutcome => ({ targetId: 't', outcome: results.length ? 'proposals' : 'none', results, reasons: [] });
  it('empty proposals is the normal answer: verdict none', () => {
    expect(triageOutcome(mk([]))).toEqual({ targetId: 't', verdict: 'none', proposals: [] });
  });
  it('rejected stays rejected; only documented+sourced is feasible; the rest needs review', () => {
    const rep = triageOutcome(mk([
      { index: 0, status: 'rejected', reasons: ['WEAK_ASSOCIATION'] },
      ok(1, 'documented', ['s1']), ok(2, 'documented', []), ok(3, 'plausible_reconstruction', ['s1']), ok(4, 'gameplay_only', []),
    ]));
    expect(rep.proposals.map(p => p.triage)).toEqual(['hard_reject', 'feasible', 'needs_review', 'needs_review', 'needs_review']);
    expect(rep.verdict).toBe('review');
  });
  it('all rejected ⇒ verdict none', () => {
    expect(triageOutcome(mk([{ index: 0, status: 'rejected', reasons: ['ERA_CONFLICT'] }])).verdict).toBe('none');
  });
});

describe('candidate pool (package 030)', () => {
  const target = playDb.nodes.find(n => n.rec && n.rec.length && playDb.eras.findIndex(e => e.id === n.era) > 2)!;
  it('is bounded, deterministic, era-limited, placeholder-free and never contains the target', () => {
    const a = candidatePool(playDb, target.id), b = candidatePool(playDb, target.id);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(MAX_POOL);
    expect(a).not.toContain(target.id);
    const eraIdx = (id: string) => playDb.eras.findIndex(e => e.id === playDb.nodes.find(n => n.id === id)!.era);
    const tIdx = playDb.eras.findIndex(e => e.id === target.era);
    for (const id of a) {
      expect(eraIdx(id)).toBeLessThanOrEqual(tIdx);
      expect((playDb.nodes.find(n => n.id === id)!.caution ?? '').toLowerCase()).not.toContain('placeholder');
    }
  });
  it('unknown target ⇒ empty pool (no_result before any model call)', () => {
    expect(candidatePool(playDb, 'does_not_exist')).toEqual([]);
  });
});
