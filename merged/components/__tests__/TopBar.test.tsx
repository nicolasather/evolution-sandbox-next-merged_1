/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles are deliberately partial */
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '@/components/TopBar';

describe('TopBar', () => {
  const mockEngine = {
    stats: () => ({ core: 5, coreTotal: 200, hidden: 2, hiddenTotal: 10, combos: 10, failed: 3, eras: 2 }),
    db: { eras: [{ id: 'e1', name: 'Era1' }, { id: 'e2', name: 'Era2' }], nodes: [] },
    erasReached: () => [{ id: 'e1', name: 'Era1' }],
    currentEra: () => ({ name: 'Era1', id: 'e1' }),
    has: () => true,
    eraProgress: (era: string) => ({
      era, index: era === 'e1' ? 0 : 1, name: era === 'e1' ? 'Era1' : 'Era2', required: 3, requiredDone: era === 'e1' ? 1 : 0,
      optional: 0, optionalDone: 0, hidden: 0, hiddenDone: 0, percent: era === 'e1' ? 33 : 0, complete: false, open: era === 'e1',
    }),
    search: () => ({ hits: [], hiddenMatches: 0 }),
  } as any;

  it('renders', () => {
    render(
      <TopBar
        engine={mockEngine}
        view="work"
        onView={() => {}}
        onOpen={() => {}}
        onReset={() => {}}
        onShortcuts={() => {}}
        onJournal={() => {}}
        onWorld={() => {}}
      />
    );
    // the label's characters are split into their own spans for the spatial
    // hover effect, so its accessible name (not a single text node) is what
    // is queried here — see components/fx/ReactiveLabel.
    expect(screen.getByRole('tab', { name: 'Workspace' })).toBeInTheDocument();
  });

  it('shows the era\'s world progress and opens the world panel', () => {
    const onWorld = jest.fn();
    render(
      <TopBar
        engine={mockEngine}
        view="work"
        onView={() => {}}
        onOpen={() => {}}
        onReset={() => {}}
        onShortcuts={() => {}}
        onJournal={() => {}}
        onWorld={onWorld}
      />
    );
    const chip = screen.getByRole('button', { name: /World progress: 1 of 3 required inventions in Era1/ });
    fireEvent.click(chip);
    expect(onWorld).toHaveBeenCalledTimes(1);
  });

  it('search input works', () => {
    render(
      <TopBar
        engine={mockEngine}
        view="work"
        onView={() => {}}
        onOpen={() => {}}
        onReset={() => {}}
        onShortcuts={() => {}}
        onJournal={() => {}}
        onWorld={() => {}}
      />
    );
    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 'stone' } });
    expect(input).toHaveValue('stone');
  });
});
