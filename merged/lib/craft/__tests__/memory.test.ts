import { UndoStack, saveBench, loadBench, clearBench } from '../benchMemory';

describe('bench memory', () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } },
    });
  });

  it('undoes step by step, newest first, ignoring repeats', () => {
    const u = new UndoStack();
    u.push([{ id: 'stone', fx: 0.2, fy: 0.5, a: 0 }]);
    u.push([{ id: 'stone', fx: 0.2, fy: 0.5, a: 0 }]);
    u.push([{ id: 'stone', fx: 0.2, fy: 0.5, a: 0 }, { id: 'wood', fx: 0.6, fy: 0.5, a: 0 }]);
    expect(u.size).toBe(2);
    expect(u.pop()!).toHaveLength(2);
    expect(u.pop()!).toHaveLength(1);
    expect(u.pop()).toBeNull();
  });

  it('round-trips and rejects junk', () => {
    saveBench([{ id: 'stone', fx: 0.3, fy: 0.4, a: 0.1 }]);
    expect(loadBench()).toEqual([{ id: 'stone', fx: 0.3, fy: 0.4, a: 0.1 }]);
    store['evo.bench.v1'] = '{"v":1,"items":[{"id":5},{"id":"wood","fx":9,"fy":-2,"a":"x"}]}';
    expect(loadBench()).toEqual([{ id: 'wood', fx: 1, fy: 0, a: 0 }]);
    store['evo.bench.v1'] = 'nope';
    expect(loadBench()).toEqual([]);
    clearBench();
    expect(loadBench()).toEqual([]);
  });
});
