import { act, fireEvent, render, screen } from '@testing-library/react';
import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { guideDone, clearGuideDone } from '@/lib/sandbox/guideStore';
import { SandboxGuide } from '../sandbox/SandboxGuide';
import { SandboxHelp } from '../sandbox/SandboxHelp';
import { EmoteTray } from '../sandbox/EmoteTray';
import { InventoryRail } from '../InventoryRail';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

describe('Sandbox guide', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('skip ends the guide and remembers it across visits', () => {
    const onFinish = jest.fn();
    render(<SandboxGuide onFinish={onFinish} combineKey={0} lastResult={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(guideDone()).toBe(true);
  });

  it('replay clears the saved completion', () => {
    window.localStorage.setItem('evo.sandbox.guide', 'done');
    clearGuideDone();
    expect(guideDone()).toBe(false);
  });

  it('moves on from a picked material on the rail', () => {
    const { container } = render(<SandboxGuide onFinish={() => {}} combineKey={0} lastResult={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // step 1 → 2 is by pick, step 1 is a Continue step
    const stepAfterIntro = container.querySelector('.sx-guide')!.getAttribute('data-step');
    expect(stepAfterIntro).toBe('1');
    const rail = document.createElement('div');
    rail.id = 'rail';
    rail.innerHTML = '<button data-id="stone"></button>';
    document.body.appendChild(rail);
    fireEvent.click(rail.querySelector('[data-id="stone"]')!);
    expect(container.querySelector('.sx-guide')!.getAttribute('data-step')).toBe('2');
    rail.remove();
  });
});

describe('Sandbox help', () => {
  it('opens for the player and closes again', () => {
    const onClose = jest.fn();
    const onReplay = jest.fn();
    const { rerender } = render(<SandboxHelp open onClose={onClose} onReplayGuide={onReplay} />);
    expect(screen.getByRole('dialog', { name: 'Help' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replay the introduction' }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    rerender(<SandboxHelp open={false} onClose={onClose} onReplayGuide={onReplay} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Emote tray', () => {
  it('speaks one short line when an expression is chosen', () => {
    jest.useFakeTimers();
    render(<EmoteTray />);
    fireEvent.click(screen.getByRole('button', { name: 'Expressions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eureka' }));
    expect(screen.getByRole('status')).toHaveTextContent('That works!');
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.queryByRole('status')).toBeNull();
    jest.useRealTimers();
  });
});

describe('Inventory cap', () => {
  it('shows every item while the inventory is small, so nothing is hidden early', () => {
    window.localStorage.clear();
    const e = new Engine(db);
    const { container } = render(
      <InventoryRail engine={e} slotA={null} slotB={null} highlightId={null}
        onPick={() => {}} onDrop={() => {}} onBenchDrop={() => {}} onContextMenu={() => {}} onInspect={() => {}} />,
    );
    expect(e.inventory().length).toBeLessThanOrEqual(12);
    expect(container.querySelectorAll('.item').length).toBe(e.inventory().length);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });
});
