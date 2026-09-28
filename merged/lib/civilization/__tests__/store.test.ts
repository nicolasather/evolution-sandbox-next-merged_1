import { civilizationStore } from '@/lib/civilization/store';
import { generateSettlement } from '@/lib/civilization/generate';
import { summarizeSettlement } from '@/lib/civilization/memory';

describe('civilization store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    civilizationStore.reset();
  });

  it('starts with no active settlement and no dioramas', () => {
    expect(civilizationStore.get().active).toBeNull();
    expect(civilizationStore.get().dioramas).toEqual([]);
  });

  it('setActive persists the current run for resume', () => {
    const s = generateSettlement('resume-check');
    civilizationStore.setActive(s);
    expect(civilizationStore.get().active?.seed).toBe('resume-check');
  });

  it('archiveActive clears the active run and adds a diorama', () => {
    const s = generateSettlement('archive-check');
    civilizationStore.setActive(s);
    civilizationStore.archiveActive(summarizeSettlement({ ...s, ending: 'resilient', turn: 14 }));
    expect(civilizationStore.get().active).toBeNull();
    expect(civilizationStore.get().dioramas).toHaveLength(1);
    expect(civilizationStore.get().dioramas[0].ending).toBe('resilient');
  });

  it('reloads across a simulated reload', () => {
    const s = generateSettlement('reload-check');
    civilizationStore.setActive(s);
    civilizationStore.load();
    expect(civilizationStore.get().active?.seed).toBe('reload-check');
  });
});
