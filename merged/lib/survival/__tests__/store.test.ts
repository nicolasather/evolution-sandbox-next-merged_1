import { survivalStore } from '@/lib/survival/store';
import { generateCamp } from '@/lib/survival/generate';
import { summarizeCamp } from '@/lib/survival/memory';

describe('survival store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    survivalStore.reset();
  });

  it('starts with no active run and no memories', () => {
    expect(survivalStore.get().active).toBeNull();
    expect(survivalStore.get().memories).toEqual([]);
  });

  it('setActive persists the current run for resume', () => {
    const camp = generateCamp('resume-check');
    survivalStore.setActive(camp);
    expect(survivalStore.get().active?.seed).toBe('resume-check');
  });

  it('archiveActive clears the active run and adds a memory', () => {
    const camp = generateCamp('archive-check');
    survivalStore.setActive(camp);
    survivalStore.archiveActive(summarizeCamp({ ...camp, ending: 'success', day: 7 }));
    expect(survivalStore.get().active).toBeNull();
    expect(survivalStore.get().memories).toHaveLength(1);
    expect(survivalStore.get().memories[0].ending).toBe('success');
  });

  it('caps memory history at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      const camp = generateCamp(`seed-${i}`);
      survivalStore.archiveActive(summarizeCamp({ ...camp, ending: 'failed', day: 2 }));
    }
    expect(survivalStore.get().memories).toHaveLength(20);
  });

  it('reloads across a simulated reload', () => {
    const camp = generateCamp('reload-check');
    survivalStore.setActive(camp);
    survivalStore.load();
    expect(survivalStore.get().active?.seed).toBe('reload-check');
  });
});
