import { decipherStore } from '@/lib/decipher/store';
import { generatePuzzle } from '@/lib/decipher/generate';
import { blankAttempt } from '@/lib/decipher/simulate';
import { summarizeAttempt } from '@/lib/decipher/memory';
import { checkAttempt, assignGlyph } from '@/lib/decipher/simulate';

describe('decipher store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    decipherStore.reset();
  });

  it('starts with no active puzzle, tutorial not completed, no memories', () => {
    expect(decipherStore.get().activePuzzle).toBeNull();
    expect(decipherStore.get().activeAttempt).toBeNull();
    expect(decipherStore.get().tutorialCompleted).toBe(false);
    expect(decipherStore.get().memories).toEqual([]);
  });

  it('setActive persists the current puzzle+attempt for resume', () => {
    const p = generatePuzzle('resume-check');
    const a = blankAttempt(p);
    decipherStore.setActive(p, a);
    expect(decipherStore.get().activePuzzle?.seed).toBe('resume-check');
    expect(decipherStore.get().activeAttempt?.puzzleId).toBe(p.id);
  });

  it('markTutorialCompleted flips the flag and persists', () => {
    decipherStore.markTutorialCompleted();
    expect(decipherStore.get().tutorialCompleted).toBe(true);
    decipherStore.load();
    expect(decipherStore.get().tutorialCompleted).toBe(true);
  });

  it('archiveActive clears the active puzzle and adds a memory', () => {
    const p = generatePuzzle('archive-check');
    let a = blankAttempt(p);
    for (const g of p.glyphs.filter(x => x.role === 'noun')) a = assignGlyph(a, g.id, g.conceptId as never);
    a = checkAttempt(p, a).attempt;
    decipherStore.setActive(p, a);
    decipherStore.archiveActive(summarizeAttempt(p, a));
    expect(decipherStore.get().activePuzzle).toBeNull();
    expect(decipherStore.get().memories).toHaveLength(1);
    expect(decipherStore.get().memories[0].outcome).toBe('solved');
  });

  it('reloads across a simulated reload', () => {
    const p = generatePuzzle('reload-check');
    const a = blankAttempt(p);
    decipherStore.setActive(p, a);
    decipherStore.load();
    expect(decipherStore.get().activePuzzle?.seed).toBe('reload-check');
  });
});
