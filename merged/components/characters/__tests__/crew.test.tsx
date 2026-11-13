import { act, fireEvent, render, screen } from '@testing-library/react';
import { CharacterStage } from '../CharacterStage';
import { BenchCrewLink } from '../BenchCrewLink';
import { actionRegistry } from '@/lib/characters/actions';
import { playClip } from '@/lib/characters/animator';
import { characterBus } from '@/lib/characters/bus';
import { getClip } from '@/lib/characters/clips';
import { survivalFacts } from '@/lib/characters/facts';
import { crewProgress } from '@/lib/characters/progress';
import { crewStore } from '@/lib/characters/store';
import { retentionBus } from '@/lib/retention/bus';
import type { CampState } from '@/lib/survival/types';
import * as bench from '@/lib/craft/bus';

jest.mock('@/lib/craft/bus', () => ({
  benchCanAct: jest.fn(() => true), benchMergePair: jest.fn(() => true), benchReturnHome: jest.fn(() => 'stone'), benchReturnItems: jest.fn(() => 2),
  benchElement: jest.fn(() => null), benchSpawn: jest.fn(() => true), registerBench: jest.fn(() => () => undefined),
}));

function fakeAnimate() {
  const made: { cancel: jest.Mock; finished: Promise<void>; resolve: () => void; effect: { getComputedTiming: () => { endTime: number } } }[] = [];
  const animate = jest.fn(function () {
    let resolve!: () => void;
    const finished = new Promise<void>(r => { resolve = r; });
    const a = { cancel: jest.fn(), finished, resolve, effect: { getComputedTiming: () => ({ endTime: 1000 }) } };
    made.push(a); return a;
  });
  return { made, animate };
}

function rigDom() {
  const root = document.createElement('div'); root.setAttribute('data-joint', 'root');
  for (const j of ['body', 'head', 'eye', 'armL', 'armR', 'legs', 'tail', 'prop']) { const e = document.createElement('div'); e.setAttribute('data-joint', j); root.appendChild(e); }
  document.body.appendChild(root);
  const fa = fakeAnimate();
  root.animate = fa.animate as never; root.querySelectorAll<HTMLElement>('[data-joint]').forEach(e => { e.animate = fa.animate as never; });
  return { root, ...fa };
}

describe('animator', () => {
  it('plays a clip as native animations on its joints and cancels every one of them', async () => {
    const { root, made, animate } = rigDom();
    const p = playClip(root, getClip('cheer-two-arm')!, { char: 'kip', unit: 84 });
    expect(animate.mock.calls.length).toBeGreaterThan(2);
    p.cancel();
    expect(made.every(a => a.cancel.mock.calls.length >= 1)).toBe(true);
    await expect(p.finished).resolves.toBe('cancelled');
  });
  it('commits travel once and releases the held pose when a walking clip ends', async () => {
    const { root, made } = rigDom();
    const onTravel = jest.fn();
    const p = playClip(root, getClip('walk-short')!, { char: 'vex', unit: 80, dir: -1, onTravel });
    made.forEach(a => a.resolve());
    await expect(p.finished).resolves.toBe('done');
    expect(onTravel).toHaveBeenCalledTimes(1);
    expect(onTravel.mock.calls[0][0]).toBeLessThan(0);
    expect(made.every(a => a.cancel.mock.calls.length >= 1)).toBe(true);
  });
  it('under reduced motion it never travels and uses the short fallback', async () => {
    const { root, made } = rigDom();
    const onTravel = jest.fn();
    const p = playClip(root, getClip('walk-bouncy')!, { char: 'kip', unit: 80, reduced: true, onTravel });
    made.forEach(a => a.resolve()); await p.finished;
    expect(onTravel).not.toHaveBeenCalled();
    const dur = (animate: jest.Mock) => animate.mock.calls.map(c => (c as unknown as [unknown, { duration: number }])[1].duration);
    expect(Math.max(...dur(root.animate as unknown as jest.Mock))).toBeLessThanOrEqual(240);
  });
  it('retargets one clip differently for each creature', () => {
    const a = rigDom(); const b = rigDom();
    playClip(a.root, getClip('jump-big')!, { char: 'vex', unit: 80 }); playClip(b.root, getClip('jump-big')!, { char: 'orra', unit: 80 });
    const first = (m: jest.Mock) => JSON.stringify(m.mock.calls[0]);
    expect(first(a.animate)).not.toEqual(first(b.animate));
  });
  it('is a safe no-op where the browser cannot animate', async () => {
    const el = document.createElement('div');
    await expect(playClip(el, getClip('idle-breathe')!, { char: 'kip', unit: 80 }).finished).resolves.toBe('done');
  });
});

describe('bench actions (the only real things the crew can do)', () => {
  const engine = { found: new Set(['stone', 'wood', 'fibre', 'bone']), holds: (id: string) => ['stone', 'wood', 'fibre', 'bone'].includes(id), db: { eras: [{ id: 'origins' }], primitives: [] }, currentEra: () => ({ id: 'origins' }) } as never;
  const mount = (props: Partial<React.ComponentProps<typeof BenchCrewLink>> = {}) =>
    render(<BenchCrewLink engine={engine} version={1} active mode="main-evolution" busy={false} view="work" advanced {...props} />);
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); actionRegistry._clear(); (bench.benchCanAct as jest.Mock).mockReturnValue(true); });
  afterEach(() => { jest.useRealTimers(); });

  it('plans only a pair the player owns, then asks the Workbench to combine it through the normal path', async () => {
    mount();
    const plan = await actionRegistry.run('main-evolution', 'bench.tryRandomMerge', { phase: 'plan' });
    expect(plan.ok).toBe(true);
    const done = actionRegistry.run('main-evolution', 'bench.tryRandomMerge', { phase: 'run' });
    await Promise.resolve();
    expect(bench.benchMergePair).toHaveBeenCalledTimes(1);
    const [a, b] = (bench.benchMergePair as jest.Mock).mock.calls[0] as [string, string];
    expect(a).not.toBe(b);
    expect(['stone', 'wood', 'fibre', 'bone']).toEqual(expect.arrayContaining([a, b]));
    act(() => retentionBus.emit({ t: 'discovery', id: 'x', status: 'new', newRoute: false, era: 'origins', rar: 'common', hidden: false }));
    const res = await done;
    expect(res.data?.outcome).toBe('new'); // the REAL result, relayed — never decided here
    jest.advanceTimersByTime(5000);
    expect(bench.benchReturnItems).not.toHaveBeenCalled(); // a real discovery consumed the pieces: nothing to put back
  });
  it('on a real failure the pieces are put safely back, and the failure is reported honestly', async () => {
    mount();
    await actionRegistry.run('main-evolution', 'bench.tryRandomMerge', { phase: 'plan' });
    const done = actionRegistry.run('main-evolution', 'bench.tryRandomMerge', { phase: 'run' });
    await Promise.resolve();
    act(() => retentionBus.emit({ t: 'attempt-fail', kind: 'none' }));
    const res = await done;
    expect(res.data?.outcome).toBe('fail');
    jest.advanceTimersByTime(2000);
    expect(bench.benchReturnItems).toHaveBeenCalledTimes(1);
  });
  it('does not chain: a pair is only run once and a stale run is rejected', async () => {
    mount();
    expect((await actionRegistry.run('main-evolution', 'bench.tryRandomMerge', { phase: 'run' })).ok).toBe(false);
    expect(bench.benchMergePair).not.toHaveBeenCalled();
  });
  it('refuses while the player is busy or the bench is not free', async () => {
    mount({ busy: true });
    expect((await actionRegistry.run('main-evolution', 'bench.tryRandomMerge', { phase: 'plan' })).ok).toBe(false);
    expect((await actionRegistry.run('main-evolution', 'bench.returnItemHome')).ok).toBe(false);
    (bench.benchCanAct as jest.Mock).mockReturnValue(false);
    const m = mount();
    expect((await actionRegistry.run('main-evolution', 'bench.returnItemHome')).ok).toBe(false);
    expect(bench.benchReturnHome).not.toHaveBeenCalled();
    m.unmount();
  });
  it('the prank action only returns one piece home and only through the safe bench handle', async () => {
    mount();
    const r = await actionRegistry.run('main-evolution', 'bench.returnItemHome');
    expect(r).toEqual({ ok: true, data: { itemId: 'stone' } });
    expect(bench.benchReturnHome).toHaveBeenCalledTimes(1);
  });
  it('registers nothing until the advanced unlock holds, and unregisters on unmount', () => {
    const off = mount({ advanced: false });
    expect(actionRegistry.has('main-evolution', 'bench.tryRandomMerge')).toBe(false);
    off.unmount();
    const on = mount();
    expect(actionRegistry.has('main-evolution', 'bench.tryRandomMerge')).toBe(true);
    on.unmount();
    expect(actionRegistry.has('main-evolution', 'bench.tryRandomMerge')).toBe(false);
  });
  it('cannot register an action that is not on the allowlist', () => {
    expect(() => actionRegistry.registerMode('survival', { 'selectAnswer': () => ({ ok: true }) } as never)).toThrow();
  });
});

describe('mode facts', () => {
  const camp = (over: Partial<CampState>): CampState => ({
    day: 1, period: 'morning', ending: 'ongoing', resources: { food: 9, water: 9, wood: 5 }, members: [{ injured: false }, { injured: false }],
    ...over,
  } as unknown as CampState);
  it('derives events only from the real before/after of the simulation', () => {
    const a = camp({});
    expect(survivalFacts(a, a)).toEqual([]);
    const b = camp({ day: 2, period: 'day', resources: { food: 1, water: 2, wood: 5 } as never, members: [{ injured: true }, { injured: false }] as never });
    expect(survivalFacts(a, b)).toEqual(expect.arrayContaining(['survival-advance-day', 'survival-weather-shift', 'survival-food-low', 'survival-water-low', 'survival-member-injured']));
    expect(survivalFacts(b, camp({ day: 3, ending: 'success' }))).toEqual(expect.arrayContaining(['survival-member-recovers', 'survival-run-complete']));
  });
});

describe('the stage', () => {
  beforeEach(() => {
    localStorage.clear(); crewStore._reset(); crewProgress._reset();
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as never;
  });

  it('shows only Kip at the start, as one labelled, keyboard-operable button; the drawn creature is hidden from assistive tech', () => {
    const { container } = render(<CharacterStage mode="main-evolution" gate={false} />);
    expect(screen.getAllByRole('button', { name: /Kip/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Vex/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Orra/ })).toBeNull();
    for (const rig of container.querySelectorAll('.crew-rig')) expect(rig.getAttribute('aria-hidden')).toBe('true');
    const heard: string[] = [];
    const off = characterBus.on(e => heard.push(e.id));
    fireEvent.keyDown(screen.getByRole('button', { name: /Kip/ }), { key: 'Enter' });
    expect(heard).toContain('character-keyboard-activate');
    off();
  });
  it('has a settings control available in every mode, with every behaviour toggleable and persisted', () => {
    render(<CharacterStage mode="decipher" gate={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crew settings' }));
    for (const label of ['Show the crew', 'Autonomous bench turns', 'Object pranks', 'Wrong-answer pranks', 'Play and skits', 'Speech bubbles', 'Reduce their motion']) {
      expect(screen.getByLabelText(new RegExp(label))).toBeInTheDocument();
    }
    fireEvent.click(screen.getByLabelText(/Object pranks/));
    expect(crewStore.get().settings.objectPranks).toBe(false);
    fireEvent.click(screen.getByLabelText(/Show the crew/));
    expect(crewStore.get().settings.enabled).toBe(false);
    expect(screen.queryByRole('button', { name: /Kip/ })).toBeNull();
  });
  it('lets the player switch a single character off', () => {
    render(<CharacterStage mode="survival" gate={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crew settings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Kip/ }));
    expect(crewStore.get().settings.perCharacter.kip).toBe(false);
    expect(screen.queryByRole('button', { name: /Kip, / })).toBeNull();
  });
  it('removes every listener on unmount', () => {
    const before = characterBus._size();
    const { unmount } = render(<CharacterStage mode="main-evolution" gate={false} />);
    expect(characterBus._size()).toBeGreaterThan(before);
    unmount();
    expect(characterBus._size()).toBe(before);
  });
  it('brings Vex and Orra in once, from real progress, and remembers it', () => {
    jest.useFakeTimers();
    render(<CharacterStage mode="survival" gate={false} />);
    act(() => crewProgress.report({ made: 25, eraIndex: 0 }));
    act(() => { jest.advanceTimersByTime(1500); });
    expect(screen.getByRole('button', { name: /Vex/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Orra/ })).toBeNull();
    act(() => { jest.advanceTimersByTime(6000); });
    expect(crewStore.get().ceremonySeen.vex).toBe(true);
    const unlockedAt = crewStore.get().unlocked.vex;
    act(() => crewProgress.report({ made: 40, eraIndex: 0 }));
    expect(crewStore.get().unlocked.vex).toBe(unlockedAt);
    jest.useRealTimers();
  });
});
