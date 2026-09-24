import { act, fireEvent, render, screen } from '@testing-library/react';
import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import { InventoryRail } from '../InventoryRail';
import type { Db } from '@/lib/types';

const db = rawDb as unknown as Db;

function setup() {
  const e = new Engine(db);
  const onPick = jest.fn();
  const onInspect = jest.fn();
  const utils = render(
    <InventoryRail
      engine={e} slotA={null} slotB={null} highlightId={null}
      onPick={onPick} onDrop={() => {}} onBenchDrop={() => {}} onContextMenu={() => {}} onInspect={onInspect}
    />,
  );
  return { e, onPick, onInspect, ...utils };
}

describe('InventoryRail (explanations only on request)', () => {
  beforeEach(() => { window.localStorage.clear(); jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('choosing an item never inspects it; only the Inspect button does', () => {
    const { container, onPick, onInspect } = setup();
    const item = container.querySelector<HTMLButtonElement>('.item')!;
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onInspect).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.item-i')!);
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenCalledWith(item.dataset.id);
  });

  it('starts open on the first visit, folds away, and remembers the choice', () => {
    const { container, unmount } = setup();
    const rail = () => container.querySelector('#rail')!;
    expect(rail().getAttribute('data-open')).toBe('true');
    expect(rail().getAttribute('data-wb-avoid')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(rail().getAttribute('data-open')).toBe('false');
    // a folded tray no longer reserves any room on the scenery
    expect(rail().getAttribute('data-wb-avoid')).toBe('off');
    expect(container.querySelector('#rail-tab')).toBeInTheDocument();
    expect(window.localStorage.getItem('evo.inv.open')).toBe('0');

    // the bench is told to re-measure once the tray has moved
    const onLayout = jest.fn();
    window.addEventListener('evo:layout', onLayout);
    act(() => { jest.advanceTimersByTime(400); });
    window.removeEventListener('evo:layout', onLayout);
    expect(onLayout).toHaveBeenCalled();

    // a later visit finds it as the player left it
    unmount();
    const again = setup();
    expect(again.container.querySelector('#rail')!.getAttribute('data-open')).toBe('false');
    fireEvent.click(again.container.querySelector('#rail-tab')!);
    expect(again.container.querySelector('#rail')!.getAttribute('data-open')).toBe('true');
    expect(window.localStorage.getItem('evo.inv.open')).toBe('1');
  });
});
