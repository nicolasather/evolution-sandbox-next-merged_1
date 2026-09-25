import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Engine } from '@/lib/engine';
import { playDb, processingData } from '@/lib/processing';
import { WorldDirector } from '@/lib/world/director';
import { eraMoment, inspectMoment, majorMoment, type MomentEnv, type WorldPayload } from '@/lib/world/moments';
import { pingWorld, requestReplay, resetWorldBus, setReplayHandler, isWorldBusy, worldPings } from '@/lib/world/bus';
import { setWorldModePref, worldModePref } from '@/lib/world/prefs';
import { GlobeSequence } from '@/components/world/GlobeSequence';
import { WorldChip } from '@/components/world/WorldChip';
import { WorldLayer } from '@/components/world/WorldLayer';
import { WorldOrigins } from '@/components/world/WorldOrigins';
import { WorldProgressPanel } from '@/components/world/WorldProgressPanel';

jest.mock('@/lib/sound', () => ({ sound: { sfx: jest.fn(), unlock: jest.fn(), enabled: () => false, set: jest.fn(), subscribe: () => () => {}, scene: jest.fn(), tunnel: jest.fn() } }));

const fresh = () => new Engine(playDb);
const env: MomentEnv = { playback: () => ({ enabled: true, motion: 'full', shorten: false }), quality: () => 'low', narrow: () => false };

/** Play everything reachable up to an era (index), with the lock on. */
function craft(e: Engine, maxEra: number): void {
  const idx = new Map(playDb.eras.map((x, i) => [x.id, i]));
  let progress = true, guard = 0;
  while (progress && guard++ < 400) {
    progress = false;
    for (const n of playDb.nodes) {
      if (e.has(n.id) || (idx.get(n.era) ?? 0) > maxEra || !e.isRecipeUnlocked(n.id)) continue;
      const r = n.rec.find(rec => rec.every(i => e.holds(i)));
      if (r && e.combineMany(r).status === 'new') progress = true;
    }
    for (const t of processingData.transforms) {
      if (!e.holds(t.from) || t.out.some(o => (idx.get(playDb.nodes.find(n => n.id === o)?.era as never) ?? -1) > maxEra)) continue;
      const r = e.process(t.from, t.action);
      if (r.status === 'done' && (r.fresh.length || r.discoveries.some(d => d.status === 'new'))) progress = true;
    }
  }
}

beforeEach(() => {
  window.localStorage.clear();
  resetWorldBus();
  // jsdom has no canvas: say so quietly, the way a browser without one would
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { jest.restoreAllMocks(); });

/* ── WorldChip ─────────────────────────────────────────────────────────── */

describe('WorldChip', () => {
  it('shows the era\'s required count and opens the panel', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const onOpen = jest.fn();
    render(<WorldChip engine={e} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: /World progress: 1 of 8 required inventions in Origins/ });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('aria-keyshortcuts', 'M');
  });

  it('pulses when a place is registered, then settles', () => {
    jest.useFakeTimers();
    const e = fresh();
    render(<WorldChip engine={e} onOpen={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-ping', 'off');
    act(() => { pingWorld(); });
    expect(btn).toHaveAttribute('data-ping', 'on');
    act(() => { jest.advanceTimersByTime(1600); });
    expect(btn).toHaveAttribute('data-ping', 'off');
    jest.useRealTimers();
  });
});

/* ── WorldProgressPanel ────────────────────────────────────────────────── */

describe('WorldProgressPanel', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<WorldProgressPanel open={false} engine={fresh()} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states where the era stands, in numbers, and why the next era is locked', () => {
    const e = fresh();
    e.combine('stone', 'stone'); e.combine('stone', 'bone');
    render(<WorldProgressPanel open engine={e} onClose={() => {}} />);
    const dlg = screen.getByRole('dialog', { name: /World progress/ });
    const cur = within(within(dlg).getByRole('region', { name: 'Current era' }));
    expect(cur.getByText('Origins')).toBeInTheDocument();
    expect(cur.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(cur.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '8');
    expect(cur.getByText(/required inventions/)).toBeInTheDocument();
    expect(cur.getByText('Fire & Culture · locked')).toBeInTheDocument();
    expect(cur.getByText('Complete all major world inventions from this era to advance.')).toBeInTheDocument();
    expect(cur.getByText('25% complete')).toBeInTheDocument();
  });

  it('counts regions represented, majors on the map, the required total and the hidden ones remaining', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    render(<WorldProgressPanel open engine={e} onClose={() => {}} />);
    const sum = e.worldSummary();
    const stat = (label: string) => screen.getByText(label).parentElement!.textContent;
    expect(stat('Regions represented')).toContain(`1 / ${sum.regionsTotal}`);
    expect(stat('Majors on the map')).toContain(`1 / ${sum.total}`);
    expect(stat('Required overall')).toContain(`1 / ${sum.requiredTotal}`);
    expect(stat('Hidden majors remaining')).toContain(String(sum.hiddenLeft));
  });

  it('lists the eras and marks the ones still locked', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    render(<WorldProgressPanel open engine={e} onClose={() => {}} />);
    const eras = screen.getByRole('region', { name: 'Eras' });
    expect(within(eras).getByText('Origins').closest('li')).toHaveClass('now');
    expect(within(eras).getByText('Simulation').closest('li')).toHaveClass('locked');
    expect(within(eras).getAllByText('locked').length).toBeGreaterThan(5);
  });

  it('says the next era is open once the era is finished', () => {
    const e = fresh();
    craft(e, 0);
    render(<WorldProgressPanel open engine={e} onClose={() => {}} />);
    const eras = screen.getByRole('region', { name: 'Eras' });
    expect(within(eras).getByText('Origins').closest('li')).toHaveClass('done');
    // Fire & Culture is now the era in focus, and Settlement the one that waits
    const cur = within(screen.getByRole('region', { name: 'Current era' }));
    expect(cur.getByText('Fire & Culture')).toBeInTheDocument();
    expect(cur.getByText('Settlement · locked')).toBeInTheDocument();
    expect(within(eras).getByText('Fire & Culture').closest('li')).toHaveClass('now');
  });

  it('lets the visitor choose how much of the globe to play, and says what each choice means', () => {
    render(<WorldProgressPanel open engine={fresh()} onClose={() => {}} />);
    const group = screen.getByRole('radiogroup');
    const full = within(group).getByRole('radio', { name: 'Full' });
    const quick = within(group).getByRole('radio', { name: 'Quick' });
    expect(full).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(quick);
    expect(worldModePref()).toBe('quick');
    expect(quick).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/shorter reveal every time/)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('radio', { name: 'Off' }));
    expect(worldModePref()).toBe('off');
    expect(screen.getByText(/No globe/)).toBeInTheDocument();
  });

  it('closes with Escape, with M, with the button and by clicking outside; and gives focus back', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener); opener.focus();
    const onClose = jest.fn();
    const { unmount } = render(<WorldProgressPanel open engine={fresh()} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'm' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(4);
    // a click inside the box does not close it
    fireEvent.click(screen.getByText('World progress'));
    expect(onClose).toHaveBeenCalledTimes(4);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});

/* ── WorldOrigins (the archive's tab) ──────────────────────────────────── */

describe('WorldOrigins', () => {
  it('names what was found, with its place and its one-line fact, and leaves the rest closed', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    render(<WorldOrigins engine={e} onOpen={() => {}} />);
    const card = document.querySelector('[data-id="sharp_stone"]') as HTMLElement;
    expect(within(card).getByRole('button', { name: e.world.get('sharp_stone')!.name })).toBeInTheDocument();
    expect(card.textContent).toContain(e.world.get('sharp_stone')!.region);
    expect(card.textContent).toContain(e.world.get('sharp_stone')!.fact);
    const closed = document.querySelector('[data-id="stone_flake"]') as HTMLElement;
    expect(closed).toHaveClass('locked');
    expect(closed.textContent).toContain('Not yet found');
    expect(closed.textContent).not.toContain(e.world.get('stone_flake')!.name);
    expect(closed.textContent).not.toContain(e.world.get('stone_flake')!.region);
  });

  it('shows a hidden major only as a mystery, until it is found', () => {
    const e = fresh();
    render(<WorldOrigins engine={e} onOpen={() => {}} />);
    const hiddenId = e.world.majors.find(m => m.hidden)!.id;
    const card = document.querySelector(`[data-id="${hiddenId}"]`) as HTMLElement;
    expect(card).toHaveClass('mystery');
    expect(card.textContent).toContain('Hidden major');
    expect(card.textContent).not.toContain(e.world.get(hiddenId)!.name);
  });

  it('says which are required, and how far each era is', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    render(<WorldOrigins engine={e} onOpen={() => {}} />);
    const origins = screen.getByRole('region', { name: 'Origins' });
    expect(within(origins).getByText('1 / 8 required')).toBeInTheDocument();
    expect(within(origins).getAllByText('Required').length).toBeGreaterThan(0);
    const fire = screen.getByRole('region', { name: 'Fire & Culture' });
    expect(within(fire).getByText(/locked/)).toBeInTheDocument();
  });

  it('opens the archive entry from the name, and plays the reveal again from "Watch again"', () => {
    const e = fresh();
    e.combine('stone', 'stone');
    const onOpen = jest.fn();
    const handler = jest.fn(() => true);
    setReplayHandler(handler);
    render(<WorldOrigins engine={e} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: e.world.get('sharp_stone')!.name }));
    expect(onOpen).toHaveBeenCalledWith('sharp_stone');
    fireEvent.click(screen.getByRole('button', { name: /Watch .* on the globe again/ }));
    expect(handler).toHaveBeenCalledWith('sharp_stone');
    expect(requestReplay('x')).toBe(true);
  });

  it('is honest about a debated origin', () => {
    const e = fresh();
    e.waiveEraLock();
    e.combine('wood', 'wood');                        // fire — origin debated
    render(<WorldOrigins engine={e} onOpen={() => {}} />);
    const card = document.querySelector('[data-id="fire"]') as HTMLElement;
    expect(card.textContent).toContain('Origin debated');
  });
});

/* ── GlobeSequence ─────────────────────────────────────────────────────── */

describe('GlobeSequence', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  /** A director with one moment queued the way the layer would queue it. */
  function setup(inspect = false) {
    const e = fresh();
    e.combine('stone', 'stone');
    const [ev] = e.takeWorldEvents();
    if (ev.kind !== 'major') throw new Error();
    const d = new WorldDirector<WorldPayload>({ delay: () => 350 });
    const m = inspect ? inspectMoment(e, 'sharp_stone', env)! : majorMoment(e, ev, env)!;
    const onSkip = jest.fn();
    const utils = render(<GlobeSequence director={d} onSkip={onSkip} />);
    return { e, d, m, onSkip, ...utils };
  }
  const run = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  it('is silent and hidden until a moment plays', () => {
    const { container } = setup();
    expect(container.querySelector('.wg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('after the beat, shows the card — name, place, era and the one-line fact — and announces it', () => {
    const { d, m, e } = setup();
    act(() => { d.enqueue(m, performance.now()); });
    run(200);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();      // still in the pause after the craft
    run(400);
    const major = e.world.get('sharp_stone')!;
    expect(screen.getByRole('heading', { level: 2, name: major.name })).toBeInTheDocument();
    expect(screen.getByText('First major invention')).toBeInTheDocument();
    expect(screen.getByText(major.region)).toBeInTheDocument();
    expect(screen.getByText(major.fact)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 8 required · Origins/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Registered · 1 / ${e.world.size}`))).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`Major invention: ${major.name}.`);
    expect(document.querySelector('.wg')).toHaveAttribute('data-on', 'true');
  });

  it('cannot be skipped in the first moments, then can: click, Space, Enter', () => {
    const { d, m, onSkip, container } = setup();
    act(() => { d.enqueue(m, performance.now()); });
    run(600);
    expect(d.playing).toBe(true);
    fireEvent.click(container.querySelector('.wg')!);
    fireEvent.keyDown(window, { key: ' ' });
    expect(d.sample(performance.now())!.skipping).toBe(false);
    expect(onSkip).not.toHaveBeenCalled();
    run(1500);                                                          // the skip window is open now
    fireEvent.keyDown(window, { key: ' ' });
    expect(d.sample(performance.now())!.skipping).toBe(true);
    expect(onSkip).toHaveBeenCalledWith(false);
    run(400);                                                           // the fade is over
    expect(d.busy).toBe(false);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('skips with a click on the layer, and with its Skip button', () => {
    const { d, m, onSkip, container } = setup();
    act(() => { d.enqueue(m, performance.now()); });
    run(2300);
    fireEvent.click(container.querySelector('.wg')!);
    expect(onSkip).toHaveBeenCalledTimes(1);
    run(400);
    act(() => { d.enqueue(m, performance.now()); });
    run(2300);
    fireEvent.click(screen.getByRole('button', { name: 'Skip this scene', hidden: true }));
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('takes Space and Enter for itself while it is up, so the bench underneath does not act on them', () => {
    const { d, m } = setup();
    const under = jest.fn();
    window.addEventListener('keydown', under);
    act(() => { d.enqueue(m, performance.now()); });
    run(700);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(under).not.toHaveBeenCalled();
    window.removeEventListener('keydown', under);
  });

  it('lets keys through when nothing is playing', () => {
    setup();
    const under = jest.fn();
    window.addEventListener('keydown', under);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(under).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', under);
  });

  it('Escape skips this one and drops everything queued behind it', () => {
    const { d, m, e, onSkip } = setup();
    e.combine('stone', 'bone');
    const [ev2] = e.takeWorldEvents();
    if (ev2.kind !== 'major') throw new Error();
    act(() => { d.enqueue(m, performance.now()); d.enqueue(majorMoment(e, ev2, env)!, performance.now()); });
    run(2300);
    expect(d.backlog).toBe(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(d.backlog).toBe(0);
    expect(onSkip).toHaveBeenCalledWith(true);
    run(400);
    expect(d.busy).toBe(false);
  });

  it('shows the archive replay as a lighter "World origins" card', () => {
    const { d, m } = setup(true);
    act(() => { d.enqueue(m, performance.now()); });
    run(700);
    expect(screen.getByText('World origins')).toBeInTheDocument();
    expect(screen.getByText('From your archive')).toBeInTheDocument();
    expect(screen.queryByText(/Registered/)).toBeNull();
  });

  it('marks a debated origin on the card instead of pretending', () => {
    const e = fresh();
    e.waiveEraLock();
    e.combine('wood', 'wood');
    const evs = e.takeWorldEvents();
    const ev = evs.find(x => x.kind === 'major')!;
    if (ev.kind !== 'major') throw new Error();
    const d = new WorldDirector<WorldPayload>({ delay: () => 0 });
    render(<GlobeSequence director={d} />);
    act(() => { d.enqueue(majorMoment(e, ev, env)!, performance.now()); });
    run(700);
    expect(screen.getByText('Origin debated')).toBeInTheDocument();
  });

  it('plays the era-complete moment: era title, what unlocked, counts', () => {
    const e = fresh();
    craft(e, 0);
    const ev = e.takeWorldEvents().find(x => x.kind === 'era_complete')!;
    if (ev.kind !== 'era_complete') throw new Error();
    const d = new WorldDirector<WorldPayload>({ delay: () => 0 });
    render(<GlobeSequence director={d} />);
    act(() => { d.enqueue(eraMoment(e, ev, env), performance.now()); });
    run(700);
    expect(screen.getByText('Era complete')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Origins' })).toBeInTheDocument();
    expect(screen.getByText(/Unlocked · Fire & Culture/)).toBeInTheDocument();
    expect(screen.getByText('8 / 8 required inventions')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Era complete: Origins. Fire & Culture is now open.');
  });

  it('still lands the moment where there is no canvas at all (nothing to draw on, nothing thrown)', () => {
    const { d, m } = setup();
    expect(() => { act(() => { d.enqueue(m, performance.now()); }); run(5000); }).not.toThrow();
    expect(d.busy).toBe(false);
  });
});

/* ── WorldLayer: the engine → the globe ────────────────────────────────── */

describe('WorldLayer', () => {
  beforeEach(() => { jest.useFakeTimers(); setWorldModePref('full'); });
  afterEach(() => { jest.useRealTimers(); });
  const run = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  it('plays a major invention when the engine announces one, and marks it seen when it starts', () => {
    const e = fresh();
    const { rerender } = render(<WorldLayer engine={e} version={0} active />);
    expect(isWorldBusy()).toBe(false);
    e.combine('stone', 'stone');
    rerender(<WorldLayer engine={e} version={1} active />);
    expect(isWorldBusy()).toBe(true);                       // toasts and the ending are asked to wait
    expect(e.hasSeenMajor('sharp_stone')).toBe(false);
    run(700);
    expect(e.hasSeenMajor('sharp_stone')).toBe(true);
    expect(screen.getByRole('heading', { level: 2, name: e.world.get('sharp_stone')!.name })).toBeInTheDocument();
    run(6000);
    expect(isWorldBusy()).toBe(false);
    expect(worldPings()).toBe(1);                           // the top-bar chip is told a place was registered
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('holds the moment while the film or a dialog has the screen, then plays it', () => {
    const e = fresh();
    const { rerender } = render(<WorldLayer engine={e} version={0} active={false} />);
    e.combine('stone', 'stone');
    rerender(<WorldLayer engine={e} version={1} active={false} />);
    run(3000);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(isWorldBusy()).toBe(true);
    rerender(<WorldLayer engine={e} version={2} active />);
    run(700);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('turns two finds in a row into two reveals, one after the other, the second one shorter', () => {
    const e = fresh();
    const { rerender } = render(<WorldLayer engine={e} version={0} active />);
    e.combine('stone', 'stone'); e.combine('stone', 'bone');
    rerender(<WorldLayer engine={e} version={1} active />);
    run(700);
    expect(screen.getByRole('heading', { level: 2, name: e.world.get('sharp_stone')!.name })).toBeInTheDocument();
    run(5200);
    run(700);
    expect(screen.getByRole('heading', { level: 2, name: e.world.get('stone_flake')!.name })).toBeInTheDocument();
    expect(e.hasSeenMajor('stone_flake')).toBe(true);
  });

  it('only pings the chip for a repeat find (a new route): no globe at all', () => {
    const e = fresh();
    e.combine('stone', 'stone'); e.combine('sharp_stone', 'stone');
    e.takeWorldEvents();
    const { rerender } = render(<WorldLayer engine={e} version={0} active />);
    e.combine('stone', 'bone');                             // stone flake by a second way
    rerender(<WorldLayer engine={e} version={1} active />);
    expect(worldPings()).toBe(1);
    expect(isWorldBusy()).toBe(false);
    run(2000);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('with the globe turned off: no picture, but the map and the counters still register everything', () => {
    setWorldModePref('off');
    const e = fresh();
    const { rerender } = render(<WorldLayer engine={e} version={0} active />);
    e.combine('stone', 'stone');
    rerender(<WorldLayer engine={e} version={1} active />);
    expect(isWorldBusy()).toBe(false);
    expect(e.hasSeenMajor('sharp_stone')).toBe(true);
    expect(worldPings()).toBe(1);
    run(1000);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('celebrates a finished era after the invention that finished it', () => {
    const e = fresh();
    const { rerender } = render(<WorldLayer engine={e} version={0} active />);
    craft(e, 0);
    rerender(<WorldLayer engine={e} version={1} active />);
    // ten majors and the era, all queued; Escape drops what is queued once the first has been on for a moment
    run(700);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    let guard = 0;
    while (!screen.queryByText('Era complete') && guard++ < 80) run(1000);
    expect(screen.getByText('Era complete')).toBeInTheDocument();
    expect(screen.getByText(/Unlocked · Fire & Culture/)).toBeInTheDocument();
  });

  it('a reset drops whatever was on its way', () => {
    const e = fresh();
    const { rerender } = render(<WorldLayer engine={e} version={0} active />);
    e.combine('stone', 'stone');
    rerender(<WorldLayer engine={e} version={1} active />);
    run(700);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    e.reset();
    rerender(<WorldLayer engine={e} version={2} active />);
    run(500);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(isWorldBusy()).toBe(false);
  });

  it('plays a major again from the archive in its lighter form, and only for what has been found', () => {
    const e = fresh();
    e.combine('stone', 'stone'); e.takeWorldEvents();
    render(<WorldLayer engine={e} version={0} active />);
    expect(requestReplay('stone_flake')).toBe(false);       // not found yet
    let ok = false;
    act(() => { ok = requestReplay('sharp_stone'); });
    expect(ok).toBe(true);
    run(700);
    expect(screen.getByText('World origins')).toBeInTheDocument();
    expect(screen.getByText('From your archive')).toBeInTheDocument();
  });

  it('leaves the bus clear when the page goes away mid-picture', () => {
    const e = fresh();
    const { rerender, unmount } = render(<WorldLayer engine={e} version={0} active />);
    e.combine('stone', 'stone');
    rerender(<WorldLayer engine={e} version={1} active />);
    expect(isWorldBusy()).toBe(true);
    unmount();
    expect(isWorldBusy()).toBe(false);
    expect(requestReplay('sharp_stone')).toBe(false);
  });
});
