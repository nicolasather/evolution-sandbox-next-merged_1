import { generatePuzzle } from '@/lib/decipher/generate';
import { assignGlyph, blankAttempt, checkAttempt, revealAnswer } from '@/lib/decipher/simulate';

describe('decipher attempt logic', () => {
  it('blankAttempt starts every noun glyph unassigned', () => {
    const p = generatePuzzle('blank-check');
    const a = blankAttempt(p);
    const nounGlyphIds = p.glyphs.filter(g => g.role === 'noun').map(g => g.id);
    expect(Object.keys(a.assignments).sort()).toEqual(nounGlyphIds.sort());
    expect(Object.values(a.assignments).every(v => v === null)).toBe(true);
  });

  it('assignGlyph does not mutate the input attempt (pure)', () => {
    const p = generatePuzzle('purity-check');
    const a = blankAttempt(p);
    const before = JSON.stringify(a);
    const nounGlyphId = p.glyphs.find(g => g.role === 'noun')!.id;
    assignGlyph(a, nounGlyphId, 'grain');
    expect(JSON.stringify(a)).toBe(before);
  });

  it('assignGlyph enforces a bijection — assigning a concept elsewhere clears its old slot', () => {
    const p = generatePuzzle('bijection-check');
    const [g1, g2] = p.glyphs.filter(g => g.role === 'noun');
    let a = blankAttempt(p);
    a = assignGlyph(a, g1.id, 'grain');
    expect(a.assignments[g1.id]).toBe('grain');
    a = assignGlyph(a, g2.id, 'grain');
    expect(a.assignments[g2.id]).toBe('grain');
    expect(a.assignments[g1.id]).toBeNull();
  });

  it('assignGlyph(..., null) clears a slot without affecting others', () => {
    const p = generatePuzzle('clear-check');
    const [g1, g2] = p.glyphs.filter(g => g.role === 'noun');
    let a = blankAttempt(p);
    a = assignGlyph(a, g1.id, 'grain');
    a = assignGlyph(a, g2.id, 'water');
    a = assignGlyph(a, g1.id, null);
    expect(a.assignments[g1.id]).toBeNull();
    expect(a.assignments[g2.id]).toBe('water');
  });

  it('checkAttempt reports a count, never which glyphs are correct', () => {
    const p = generatePuzzle('check-count');
    let a = blankAttempt(p);
    const nouns = p.glyphs.filter(g => g.role === 'noun');
    // Assign the true answer to 2 of the 6, and a deliberately wrong (but
    // still bijection-valid — nouns[3]'s own concept, unused elsewhere) one to a 3rd.
    a = assignGlyph(a, nouns[0].id, nouns[0].conceptId as never);
    a = assignGlyph(a, nouns[1].id, nouns[1].conceptId as never);
    a = assignGlyph(a, nouns[2].id, nouns[3].conceptId as never);
    const { result } = checkAttempt(p, a);
    expect(result.correctCount).toBe(2);
    expect(result.total).toBe(6);
    expect(result.allCorrect).toBe(false);
    expect(result).not.toHaveProperty('which');
  });

  it('checkAttempt marks the attempt solved once every noun glyph is correctly assigned', () => {
    const p = generatePuzzle('solve-check');
    let a = blankAttempt(p);
    for (const g of p.glyphs.filter(x => x.role === 'noun')) a = assignGlyph(a, g.id, g.conceptId as never);
    const { attempt, result } = checkAttempt(p, a);
    expect(result.allCorrect).toBe(true);
    expect(attempt.solved).toBe(true);
  });

  it('revealAnswer fills every noun glyph with the true concept and flags revealedAnswer', () => {
    const p = generatePuzzle('reveal-check');
    const a = blankAttempt(p);
    const revealed = revealAnswer(p, a);
    for (const g of p.glyphs.filter(x => x.role === 'noun')) expect(revealed.assignments[g.id]).toBe(g.conceptId);
    expect(revealed.revealedAnswer).toBe(true);
  });

  it('checksUsed increments on every check', () => {
    const p = generatePuzzle('checks-used');
    let a = blankAttempt(p);
    a = checkAttempt(p, a).attempt;
    a = checkAttempt(p, a).attempt;
    expect(a.checksUsed).toBe(2);
  });
});
