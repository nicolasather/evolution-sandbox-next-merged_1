import { alienArchaeologyStore } from '@/lib/alienarchaeology/store';
import { ALL_AXES, generateSite } from '@/lib/alienarchaeology/generate';
import { applyAction } from '@/lib/alienarchaeology/simulate';
import { summarizeSite } from '@/lib/alienarchaeology/memory';

describe('alien archaeology store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    alienArchaeologyStore.reset();
  });

  it('starts with no active site and no reports', () => {
    expect(alienArchaeologyStore.get().active).toBeNull();
    expect(alienArchaeologyStore.get().reports).toEqual([]);
  });

  it('setActive persists the current site for resume', () => {
    const s = generateSite('resume-check');
    alienArchaeologyStore.setActive(s);
    expect(alienArchaeologyStore.get().active?.seed).toBe('resume-check');
  });

  it('archiveActive clears the active site and adds a report', () => {
    let s = generateSite('archive-check');
    for (const axis of ALL_AXES) {
      s = applyAction(s, { kind: 'setHypothesis', axis, value: s.truth[axis] }).state;
      s = applyAction(s, { kind: 'setConfidence', axis, value: 0.8 }).state;
    }
    s = applyAction(s, { kind: 'submit' }).state;
    alienArchaeologyStore.setActive(s);
    alienArchaeologyStore.archiveActive(summarizeSite(s));
    expect(alienArchaeologyStore.get().active).toBeNull();
    expect(alienArchaeologyStore.get().reports).toHaveLength(1);
  });

  it('reloads across a simulated reload', () => {
    const s = generateSite('reload-check');
    alienArchaeologyStore.setActive(s);
    alienArchaeologyStore.load();
    expect(alienArchaeologyStore.get().active?.seed).toBe('reload-check');
  });
});
