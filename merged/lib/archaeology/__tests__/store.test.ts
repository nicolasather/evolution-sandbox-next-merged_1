import { archaeologyStore } from '@/lib/archaeology/store';
import { generateSite } from '@/lib/archaeology/generate';
import { applyAction } from '@/lib/archaeology/simulate';
import { summarizeSite } from '@/lib/archaeology/memory';

describe('archaeology store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    archaeologyStore.reset();
  });

  it('starts with no active dig and no reports', () => {
    expect(archaeologyStore.get().active).toBeNull();
    expect(archaeologyStore.get().reports).toEqual([]);
  });

  it('setActive persists the current dig for resume', () => {
    const s = generateSite('resume-check');
    archaeologyStore.setActive(s);
    expect(archaeologyStore.get().active?.seed).toBe('resume-check');
  });

  it('archiveActive clears the active dig and adds a report', () => {
    let s = generateSite('archive-check');
    s = applyAction(s, { kind: 'hypothesize', field: 'function', value: s.truth.function }).state;
    s = applyAction(s, { kind: 'report' }).state;
    archaeologyStore.setActive(s);
    archaeologyStore.archiveActive(summarizeSite(s));
    expect(archaeologyStore.get().active).toBeNull();
    expect(archaeologyStore.get().reports).toHaveLength(1);
    expect(archaeologyStore.get().reports[0].functionLabel).toBe(s.truth.function);
  });

  it('reloads across a simulated reload', () => {
    const s = generateSite('reload-check');
    archaeologyStore.setActive(s);
    archaeologyStore.load();
    expect(archaeologyStore.get().active?.seed).toBe('reload-check');
  });
});
