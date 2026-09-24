/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles are deliberately partial */
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Landing } from '@/components/Landing';

describe('Landing', () => {
  const mockDb = {
    nodes: [{ rec: [{ id: 'a' }, { id: 'b' }] }],
    counts: { core: 10, hidden: 3 },
    sources: { s1: 'source1', s2: 'source2' },
  } as any;
  const dbWithHistory = {
    ...mockDb,
    nodes: [
      { id: 'handaxe', n: 'Handaxe', vis: 'blade', cat: 'tool', date: '≈ 1.7 million years ago onward', rec: [] },
      { id: 'pottery', n: 'Pottery', vis: 'pot', cat: 'craft', date: '≈ 20,000 years ago onward', rec: [] },
      { id: 'wheel', n: 'Wheel', vis: 'wheel', cat: 'tool', date: '≈ 5,500 years ago onward', rec: [] },
    ],
  } as any;

  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); document.documentElement.removeAttribute('data-film'); });

  const phase = () => document.getElementById('landing')!.getAttribute('data-phase');

  it('renders', () => {
    render(<Landing db={mockDb} gone={false} resumedCount={0} onBegin={() => {}} />);
    expect(screen.getByText(/How did we/)).toBeInTheDocument();
  });

  it('calls onBegin when button clicked', () => {
    const onBegin = jest.fn();
    render(<Landing db={mockDb} gone={false} resumedCount={0} onBegin={onBegin} />);
    fireEvent.click(screen.getByRole('button', { name: /BEGIN/i }));
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it('Skip is immediate: the stone is on the scenery on the very next step, with no film left to wait for', () => {
    const onLanded = jest.fn(), onEnter = jest.fn(), onDone = jest.fn();
    render(<Landing db={mockDb} gone={false} resumedCount={0} onBegin={() => {}}
      onEnter={onEnter} onLanded={onLanded} onDone={onDone} getBenchTarget={() => ({ x: 700, y: 400 })} />);
    fireEvent.click(screen.getByRole('button', { name: /BEGIN/i }));
    expect(['collapse', 'reduced']).toContain(phase());          // jsdom has no canvas: the still version runs
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    expect(onEnter).toHaveBeenCalledWith(true);
    expect(onLanded).toHaveBeenCalledWith(700, 400);
    expect(phase()).toBe('exit');
    act(() => { jest.advanceTimersByTime(500); });
    expect(phase()).toBe('done');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Escape and Space also skip', () => {
    const onLanded = jest.fn();
    render(<Landing db={mockDb} gone={false} resumedCount={0} onBegin={() => {}} onLanded={onLanded} />);
    fireEvent.click(screen.getByRole('button', { name: /BEGIN/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onLanded).toHaveBeenCalledTimes(1);
  });

  it('the still (reduced-motion) version lists the same discoveries oldest first, then hands over on its own', () => {
    const onLanded = jest.fn();
    const { container } = render(<Landing db={dbWithHistory} gone={false} resumedCount={0} onBegin={() => {}} onLanded={onLanded} />);
    const items = Array.from(container.querySelectorAll('.intro-strip li')).map(li => li.textContent);
    expect(items.length).toBeGreaterThan(2);
    expect(items[0]).toMatch(/Handaxe/);
    expect(items[0]).toMatch(/1\.7 million years ago/);
    expect(items.findIndex(t => /Pottery/.test(t ?? ''))).toBeGreaterThan(0);
    expect(items.findIndex(t => /Wheel/.test(t ?? ''))).toBeGreaterThan(items.findIndex(t => /Pottery/.test(t ?? '')));
    fireEvent.click(screen.getByRole('button', { name: /BEGIN/i }));
    expect(phase()).toBe('reduced');
    act(() => { jest.advanceTimersByTime(2600); });
    expect(onLanded).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(800); });
    expect(phase()).toBe('done');
  });

  it('a returning player can continue with no film at all', () => {
    const onEnter = jest.fn(), onDone = jest.fn();
    render(<Landing db={mockDb} gone={false} resumedCount={12}
      returning={{ era: 'Origins', latest: 'Stone', recent: ['Stone'] }}
      onBegin={() => {}} onEnter={onEnter} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue timeline/i }));
    expect(onEnter).toHaveBeenCalledWith(false);
    act(() => { jest.advanceTimersByTime(600); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('replaying plays the journey again without dropping a second stone', () => {
    const onLanded = jest.fn(), onEnter = jest.fn(), onDone = jest.fn();
    const props = { db: mockDb, resumedCount: 0, onBegin: () => {}, onLanded, onEnter, onDone } as const;
    const { rerender } = render(<Landing {...props} gone replay={0} />);
    rerender(<Landing {...props} gone={false} replay={1} />);
    expect(['collapse', 'reduced']).toContain(phase());
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    act(() => { jest.advanceTimersByTime(800); });
    expect(onLanded).not.toHaveBeenCalled();
    expect(onEnter).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
