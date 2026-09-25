import type { MajorPlanInput, EraPlanInput, PlanInput } from '../choreography';
import { GAP_MS, SKIP_FADE_MS, WorldDirector, type Moment } from '../director';

const majorInput = (o: Partial<MajorPlanInput> = {}): MajorPlanInput => ({
  kind: 'major', tier: 'A', from: { lat: 30, lon: 31, precision: 'site' }, to: { lat: 51, lon: 0, precision: 'site' },
  motion: 'full', quality: 'high', ...o,
});
const eraInput: EraPlanInput = { kind: 'era', points: [{ lat: 10, lon: 20 }], motion: 'full', quality: 'high' };

let n = 0;
const moment = (name: string, build: (backlog: number) => PlanInput = () => majorInput()): Moment<string> => ({ id: ++n, payload: name, build });

function make(opts: ConstructorParameters<typeof WorldDirector<string>>[0] = {}) {
  const log: string[] = [];
  const d = new WorldDirector<string>({
    delay: () => 350,
    onStart: m => log.push(`start:${m.payload}`),
    onEnd: (m, skipped) => log.push(`end:${m.payload}${skipped ? ':skipped' : ''}`),
    onDrop: m => log.push(`drop:${m.payload}`),
    ...opts,
  });
  return { d, log };
}

describe('WorldDirector', () => {
  it('waits out the beat after the craft before the first frame', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 1000);
    expect(d.busy).toBe(true);
    expect(d.playing).toBe(false);
    d.tick(1200);
    expect(log).toEqual([]);
    expect(d.sample(1200)).toBeNull();
    d.tick(1350);
    expect(log).toEqual(['start:a']);
    expect(d.playing).toBe(true);
    expect(d.sample(1350)!.elapsed).toBe(0);
  });

  it('plays the moments one after another, in the order they were found, with a breath between', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0); d.enqueue(moment('b'), 0); d.enqueue(moment('c'), 0);
    d.tick(350);
    const total = d.sample(350)!.plan.total;
    d.tick(350 + total);                      // a ends; b waits a gap
    expect(log).toEqual(['start:a', 'end:a']);
    expect(d.playing).toBe(false);
    d.tick(350 + total + GAP_MS - 1);
    expect(log).toEqual(['start:a', 'end:a']);
    d.tick(350 + total + GAP_MS);
    expect(log).toEqual(['start:a', 'end:a', 'start:b']);
    // run the rest out
    let t = 350 + total + GAP_MS;
    for (let i = 0; i < 200 && d.busy; i++) { t += 100; d.tick(t); }
    expect(log).toEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c']);
    expect(d.busy).toBe(false);
  });

  it('builds each moment as it starts, and tells it how many are still waiting', () => {
    const seen: number[] = [];
    const { d } = make();
    for (let i = 0; i < 3; i++) d.enqueue(moment(`m${i}`, backlog => { seen.push(backlog); return majorInput(); }), 0);
    d.tick(350);
    expect(seen).toEqual([2]);          // built at its own start, not when queued
    expect(d.backlog).toBe(2);
  });

  it('holds the next moment while something else (a dialog) needs the screen', () => {
    let open = true;
    const { d, log } = make({ canStart: () => !open });
    d.enqueue(moment('a'), 0);
    d.tick(2000);
    expect(log).toEqual([]);
    open = false;
    d.tick(2010);
    expect(log).toEqual(['start:a']);
  });

  it('can be closed and opened from outside (the film is on): a closed director holds the moment, and never interrupts one that plays', () => {
    const { d, log } = make({ open: false });
    d.enqueue(moment('a'), 0);
    d.tick(2000);
    expect(log).toEqual([]);
    expect(d.busy).toBe(true);
    d.setOpen(true);
    d.tick(2010);
    expect(log).toEqual(['start:a']);
    d.setOpen(false);                                  // closing again does not cut a moment short
    expect(d.sample(2500)).not.toBeNull();
    expect(d.playing).toBe(true);
  });

  it('honours no skip before the plan allows it — a click that started the moment cannot end it', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0);
    d.tick(350);
    const skipAfter = d.sample(350)!.plan.skipAfter;
    expect(d.sample(350 + skipAfter - 1)!.canSkip).toBe(false);
    expect(d.skip(350 + skipAfter - 1)).toBe(false);
    expect(d.sample(350 + skipAfter)!.canSkip).toBe(true);
    expect(d.skip(350 + skipAfter)).toBe(true);
    expect(log).toEqual(['start:a']);
  });

  it('fades a skipped moment out from where it stopped, then ends it as skipped', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0);
    d.tick(350);
    const at = 350 + d.sample(350)!.plan.skipAfter + 100;
    const before = d.sample(at)!;
    d.skip(at);
    const during = d.sample(at + SKIP_FADE_MS / 2)!;
    expect(during.skipping).toBe(true);
    expect(during.canSkip).toBe(false);
    expect(during.frame.t).toBe(before.frame.t);                 // frozen where it was
    expect(during.frame.veil).toBeCloseTo(before.frame.veil * 0.5, 5);
    expect(d.skip(at + 10)).toBe(false);                          // not skipped twice
    d.tick(at + SKIP_FADE_MS - 1);
    expect(log).toEqual(['start:a']);
    d.tick(at + SKIP_FADE_MS);
    expect(log).toEqual(['start:a', 'end:a:skipped']);
    expect(d.busy).toBe(false);
  });

  it('skips only the current moment by default; the next one still plays', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0); d.enqueue(moment('b'), 0);
    d.tick(350);
    const at = 350 + d.sample(350)!.plan.skipAfter;
    d.skip(at);
    d.tick(at + SKIP_FADE_MS);
    d.tick(at + SKIP_FADE_MS + GAP_MS);
    expect(log).toEqual(['start:a', 'end:a:skipped', 'start:b']);
  });

  it('drops the whole queue when asked to skip all, and says what it dropped', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0); d.enqueue(moment('b'), 0); d.enqueue(moment('c'), 0);
    d.tick(350);
    const at = 350 + d.sample(350)!.plan.skipAfter;
    expect(d.skip(at, true)).toBe(true);
    expect(log).toEqual(['start:a', 'drop:b', 'drop:c']);
    d.tick(at + SKIP_FADE_MS);
    expect(log[log.length - 1]).toBe('end:a:skipped');
    expect(d.busy).toBe(false);
  });

  it('does not drop the queue early: skip all is also held until the skip window opens', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0); d.enqueue(moment('b'), 0);
    d.tick(350);
    expect(d.skip(400, true)).toBe(false);
    expect(log).toEqual(['start:a']);
    expect(d.backlog).toBe(1);
  });

  it('can drop what is waiting even when nothing is playing yet', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0); d.enqueue(moment('b'), 0);
    expect(d.skip(100, true)).toBe(true);
    expect(log).toEqual(['drop:a', 'drop:b']);
    expect(d.busy).toBe(false);
  });

  it('clears everything on a reset — the current moment ends as skipped, the queue is dropped', () => {
    const { d, log } = make();
    d.enqueue(moment('a'), 0); d.enqueue(moment('b'), 0);
    d.tick(350);
    d.clear();
    expect(log).toEqual(['start:a', 'drop:b', 'end:a:skipped']);
    expect(d.busy).toBe(false);
    expect(d.sample(400)).toBeNull();
    // and it can be used again
    d.enqueue(moment('c'), 1000);
    d.tick(1350);
    expect(log[log.length - 1]).toBe('start:c');
  });

  it('plays an era moment like any other', () => {
    const { d, log } = make();
    d.enqueue(moment('era', () => eraInput), 0);
    d.tick(350);
    expect(d.sample(350)!.plan.kind).toBe('era');
    expect(log).toEqual(['start:era']);
  });

  it('tells subscribers when something visible changes, and bumps its version', () => {
    const { d } = make();
    const calls = jest.fn();
    const off = d.subscribe(calls);
    const v0 = d.getVersion();
    d.enqueue(moment('a'), 0);
    d.tick(350);
    expect(calls).toHaveBeenCalled();
    expect(d.getVersion()).toBeGreaterThan(v0);
    const n0 = calls.mock.calls.length;
    off();
    d.clear();
    expect(calls.mock.calls.length).toBe(n0);
  });

  it('a skip while waiting for the first frame does nothing, and never throws', () => {
    const { d } = make();
    d.enqueue(moment('a'), 0);
    expect(d.skip(100)).toBe(false);
    expect(() => d.tick(50)).not.toThrow();
  });
});
