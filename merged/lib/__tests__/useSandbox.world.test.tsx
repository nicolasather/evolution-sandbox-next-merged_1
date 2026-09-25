import { act, renderHook } from '@testing-library/react';
import { processingData } from '@/lib/processing';
import { useSandbox } from '@/lib/useSandbox';
import { resetWorldBus, setWorldBusy } from '@/lib/world/bus';

/**
 * A major invention plays the globe, and the small toasts (a tier opening, "try it again", a new
 * material) wait for it instead of landing on top of the picture. Probes on a new game:
 *   bone + fiber   → a plain discovery that makes the world offer something (a "world" toast)
 *   wood + wood    → turned away too early; once Origins is finished it works, and "Try it again" is said
 */
describe('useSandbox with the globe', () => {
  beforeEach(() => { jest.useFakeTimers(); window.localStorage.clear(); resetWorldBus(); });
  afterEach(() => { jest.useRealTimers(); resetWorldBus(); });

  const kinds = (h: { result: { current: ReturnType<typeof useSandbox> } }) => h.result.current.toasts.map(t => t.kind);

  /** Finish the era Origins through the hook, the way the bench does. */
  function finishOrigins(h: ReturnType<typeof renderHook<ReturnType<typeof useSandbox>, unknown>>) {
    let guard = 0;
    while (!h.result.current.engine.isEraOpen('fire') && guard++ < 200) {
      const { engine } = h.result.current;
      for (const n of engine.db.nodes) {
        if (engine.has(n.id) || n.era !== 'origins' || !engine.isRecipeUnlocked(n.id)) continue;
        const r = n.rec.find(rec => rec.every(i => engine.holds(i)));
        if (r) act(() => { h.result.current.fireMany(r, false); });
      }
      for (const t of processingData.transforms) {
        if (!engine.holds(t.from) || engine.isEraOpen('fire')) continue;
        if (t.out.some(o => engine.db.nodes.find(n => n.id === o)?.era !== 'origins' && engine.db.nodes.some(n => n.id === o))) continue;
        act(() => { h.result.current.processOnBench(t.from, t.action); });
      }
    }
  }

  it('shows a plain discovery\'s toast at once when the globe is not playing', () => {
    const h = renderHook(() => useSandbox());
    act(() => { h.result.current.fire('bone', 'fiber', false); });
    expect(h.result.current.engine.peekWorldEvents()).toBe(0);
    expect(kinds(h)).toContain('world');
  });

  it('holds even a plain discovery\'s toast while the globe is playing', () => {
    const h = renderHook(() => useSandbox());
    act(() => { setWorldBusy(true); });
    act(() => { h.result.current.fire('bone', 'fiber', false); });
    expect(kinds(h)).toEqual([]);
    act(() => { setWorldBusy(false); });
    expect(kinds(h)).toContain('world');
  });

  it('holds "Try it again" — said when a finished era opens — until the globe is done, then says it', () => {
    const h = renderHook(() => useSandbox());
    act(() => { h.result.current.fire('wood', 'wood', false); });          // too early: remembered
    expect(h.result.current.engine.has('fire')).toBe(false);
    act(() => { setWorldBusy(true); });                                    // the globe has the screen from here on
    finishOrigins(h);
    expect(h.result.current.engine.isEraOpen('fire')).toBe(true);
    expect(kinds(h)).not.toContain('reopen');
    act(() => { jest.advanceTimersByTime(3000); });
    expect(kinds(h)).not.toContain('reopen');
    act(() => { setWorldBusy(false); });
    expect(kinds(h)).toContain('reopen');
  });

  it('never swallows a toast if the globe layer is missing: it comes after the time limit', () => {
    const h = renderHook(() => useSandbox());
    act(() => { h.result.current.fire('wood', 'wood', false); });
    finishOrigins(h);                                                      // majors were announced; no layer picks them up
    expect(h.result.current.engine.peekWorldEvents()).toBeGreaterThan(0);
    act(() => { jest.advanceTimersByTime(14100); });
    expect(kinds(h)).toContain('reopen');
  });
});
