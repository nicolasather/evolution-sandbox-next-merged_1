import { NOUN_CONCEPTS } from '@/lib/decipher/catalog';
import { generatePuzzle, validateSolvable } from '@/lib/decipher/generate';
import { generateTutorial } from '@/lib/decipher/tutorial';
import { NOUN_FREQUENCY_RANK } from '@/lib/decipher/types';

describe('generatePuzzle', () => {
  it('is deterministic for the same seed', () => {
    const a = generatePuzzle('repeat-check');
    const b = generatePuzzle('repeat-check');
    expect(a).toEqual(b);
  });

  it('produces a different corpus for a different seed', () => {
    const a = generatePuzzle('seed-a');
    const b = generatePuzzle('seed-b');
    expect(a.inscriptions).not.toEqual(b.inscriptions);
  });

  it('draws exactly 6 distinct noun glyphs, 3 number glyphs and 1 particle glyph', () => {
    const p = generatePuzzle('alphabet-check');
    const nouns = p.glyphs.filter(g => g.role === 'noun');
    const numbers = p.glyphs.filter(g => g.role === 'number');
    const particles = p.glyphs.filter(g => g.role === 'particle');
    expect(nouns).toHaveLength(6);
    expect(numbers).toHaveLength(3);
    expect(particles).toHaveLength(1);
    expect(new Set(nouns.map(g => g.conceptId))).toEqual(new Set(NOUN_CONCEPTS));
    // Every DRAWN glyph (nouns + the particle) has a distinct shape signature.
    // Numbers deliberately share an (unused) empty shape — they render as
    // dot-tallies instead, since their identity is given, not a mystery.
    const drawn = p.glyphs.filter(g => g.role !== 'number');
    const sigs = drawn.map(g => g.shape.strokes.map(s => `${s.x1},${s.y1},${s.x2},${s.y2}`).sort().join(';'));
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it('every noun concept appears in the corpus exactly its target frequency-rank number of times', () => {
    const p = generatePuzzle('frequency-check');
    for (const g of p.glyphs.filter(x => x.role === 'noun')) {
      const count = p.inscriptions.reduce((n, insc) => n + insc.glyphIds.filter(id => id === g.id).length, 0);
      expect(count).toBe(NOUN_FREQUENCY_RANK[g.conceptId as keyof typeof NOUN_FREQUENCY_RANK]);
    }
  });

  it('is provably uniquely solvable, exhaustively checked, across many seeds', () => {
    for (let i = 0; i < 25; i++) {
      const p = generatePuzzle(`solvable-check-${i}`);
      const { solvable, solution } = validateSolvable(p);
      expect(solvable).toBe(true);
      // The proven solution must agree with the puzzle's own ground truth.
      for (const g of p.glyphs.filter(x => x.role === 'noun')) {
        expect(solution![g.id]).toBe(g.conceptId);
      }
    }
  });

  it('the single anchor is always consistent with the puzzle\'s own ground truth', () => {
    const p = generatePuzzle('anchor-check');
    expect(p.anchors).toHaveLength(1);
    const anchor = p.anchors[0];
    const glyph = p.glyphs.find(g => g.id === anchor.glyphId)!;
    expect(glyph.conceptId).toBe(anchor.conceptId);
  });
});

describe('generateTutorial', () => {
  it('is pinned to a fixed, always-solvable puzzle with hand-authored steps', () => {
    const t1 = generateTutorial();
    const t2 = generateTutorial();
    expect(t1.inscriptions).toEqual(t2.inscriptions);
    expect(t1.kind).toBe('tutorial');
    expect(t1.tutorialSteps!.length).toBeGreaterThan(0);
    expect(validateSolvable(t1).solvable).toBe(true);
  });
});
