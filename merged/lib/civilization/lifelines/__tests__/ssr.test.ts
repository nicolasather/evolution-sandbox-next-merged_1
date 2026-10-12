/** @jest-environment node */
import { LifelinesStore, lifelinesStore, resetSharedStore } from '../store';
import { readHubSummary } from '../hubSummary';
import { lifelinesRecords } from '../archiveRecords';
import { browserStorage } from '../save';

describe('server-side safety (no window)', () => {
  it('importing and constructing touches no browser API', () => {
    expect(typeof window).toBe('undefined');
    expect(browserStorage()).toBeNull();
    expect(() => lifelinesStore()).not.toThrow();
    resetSharedStore();
    expect(readHubSummary().kind).toBe('none');
    expect(lifelinesRecords()).toEqual([]);
  });
  it('a store without storage still initialises and plays in memory', async () => {
    const ix = (await import('../__testing__/helpers')).ix;
    const st = new LifelinesStore({ storage: null, locks: null, loadContent: async () => ix, onChange: () => undefined });
    await st.init();
    expect(st.getSnapshot().persistence).toBe('memory-only');
    st.detach();
  });
});
