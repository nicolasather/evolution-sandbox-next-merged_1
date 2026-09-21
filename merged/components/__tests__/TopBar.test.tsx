import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '@/components/TopBar';

describe('TopBar', () => {
  const mockEngine = {
    stats: () => ({ core: 5, coreTotal: 200, hidden: 2, hiddenTotal: 10, combos: 10, failed: 3, eras: 2 }),
    db: { eras: [{ id: 'e1', name: 'Era1' }, { id: 'e2', name: 'Era2' }], nodes: [] },
    erasReached: () => [{ id: 'e1', name: 'Era1' }],
    currentEra: () => ({ name: 'Era1', id: 'e1' }),
    has: () => true,
    search: () => [],
  } as any;

  it('renders', () => {
    render(
      <TopBar
        engine={mockEngine}
        view="work"
        railOpen={false}
        onView={() => {}}
        onOpen={() => {}}
        onReset={() => {}}
        onMenu={() => {}}
      />
    );
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('search input works', () => {
    render(
      <TopBar
        engine={mockEngine}
        view="work"
        railOpen={false}
        onView={() => {}}
        onOpen={() => {}}
        onReset={() => {}}
        onMenu={() => {}}
      />
    );
    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 'stone' } });
    expect(input).toHaveValue('stone');
  });
});
