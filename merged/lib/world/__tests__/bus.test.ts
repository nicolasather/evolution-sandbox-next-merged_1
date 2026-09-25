import {
  afterWorld, isWorldBusy, notifyWorldDrained, pingWorld, requestReplay, resetWorldBus, setReplayHandler,
  setWorldBusy, subscribeWorldPings, worldPings,
} from '../bus';

beforeEach(() => { jest.useFakeTimers(); resetWorldBus(); });
afterEach(() => { jest.useRealTimers(); resetWorldBus(); });

describe('afterWorld', () => {
  it('runs at once when the globe is out of the way and nothing is on its way', () => {
    const fn = jest.fn();
    afterWorld(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits for the globe to finish, then runs once', () => {
    const fn = jest.fn();
    setWorldBusy(true);
    afterWorld(fn);
    expect(fn).not.toHaveBeenCalled();
    setWorldBusy(false);
    expect(fn).toHaveBeenCalledTimes(1);
    setWorldBusy(true); setWorldBusy(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits when a moment is expected but has not been picked up yet, until the layer says it has nothing', () => {
    const fn = jest.fn();
    afterWorld(fn, true);
    expect(fn).not.toHaveBeenCalled();
    notifyWorldDrained();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not run on "drained" while the globe is still busy', () => {
    const fn = jest.fn();
    setWorldBusy(true);
    afterWorld(fn, true);
    notifyWorldDrained();
    expect(fn).not.toHaveBeenCalled();
    setWorldBusy(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never swallows the call: a missing layer means it runs after the time limit', () => {
    const fn = jest.fn();
    afterWorld(fn, true, 5000);
    jest.advanceTimersByTime(4999);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2);
    expect(fn).toHaveBeenCalledTimes(1);
    // and is not run a second time when the globe later finishes
    setWorldBusy(true); setWorldBusy(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps the order of what was waiting, and one failing call cannot stop the rest', () => {
    const order: number[] = [];
    setWorldBusy(true);
    afterWorld(() => order.push(1));
    afterWorld(() => { throw new Error('boom'); });
    afterWorld(() => order.push(3));
    expect(() => setWorldBusy(false)).not.toThrow();
    expect(order).toEqual([1, 3]);
  });

  it('reports whether it is busy', () => {
    expect(isWorldBusy()).toBe(false);
    setWorldBusy(true);
    expect(isWorldBusy()).toBe(true);
  });
});

describe('world pings', () => {
  it('counts pings and tells listeners', () => {
    const fn = jest.fn();
    const off = subscribeWorldPings(fn);
    expect(worldPings()).toBe(0);
    pingWorld(); pingWorld();
    expect(worldPings()).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    pingWorld();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('replay', () => {
  it('has nothing to play with until the layer offers a handler', () => {
    expect(requestReplay('fire')).toBe(false);
    const h = jest.fn(() => true);
    setReplayHandler(h);
    expect(requestReplay('fire')).toBe(true);
    expect(h).toHaveBeenCalledWith('fire');
    setReplayHandler(null);
    expect(requestReplay('fire')).toBe(false);
  });
});
