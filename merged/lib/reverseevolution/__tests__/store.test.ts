import { reverseEvolutionStore } from '@/lib/reverseevolution/store';
import { generateRun } from '@/lib/reverseevolution/generate';
import { applyAction } from '@/lib/reverseevolution/simulate';
import { summarizeRun } from '@/lib/reverseevolution/memory';
import { playDb } from '@/lib/processing';

describe('reverse evolution store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    reverseEvolutionStore.reset();
  });

  it('starts with no active run and no memories', () => {
    expect(reverseEvolutionStore.get().active).toBeNull();
    expect(reverseEvolutionStore.get().runs).toEqual([]);
  });

  it('setActive persists the current run for resume', () => {
    const s = generateRun(playDb, 'resume-check', 'smartphone');
    reverseEvolutionStore.setActive(s);
    expect(reverseEvolutionStore.get().active?.seed).toBe('resume-check');
  });

  it('archiveActive clears the active run and adds a memory', () => {
    let s = generateRun(playDb, 'archive-check', 'smartphone');
    s = applyAction(playDb, s, { kind: 'reveal' }).state;
    reverseEvolutionStore.setActive(s);
    reverseEvolutionStore.archiveActive(summarizeRun(playDb, s));
    expect(reverseEvolutionStore.get().active).toBeNull();
    expect(reverseEvolutionStore.get().runs).toHaveLength(1);
  });

  it('reloads across a simulated reload', () => {
    const s = generateRun(playDb, 'reload-check', 'smartphone');
    reverseEvolutionStore.setActive(s);
    reverseEvolutionStore.load();
    expect(reverseEvolutionStore.get().active?.seed).toBe('reload-check');
  });
});
