import { render, screen } from '@testing-library/react';
import { Ending } from '@/components/Ending';

describe('Ending', () => {
  const mockEngine = {
    stats: () => ({ core: 10, hidden: 2, combos: 20, failed: 5, eras: 3 }),
    lineage: () => [{ id: 'a' }, { id: 'b' }],
  } as any;

  const mockNode = { id: 'n1', n: 'End', l2: 'Note' } as any;

  it('renders', () => {
    render(<Ending engine={mockEngine} node={mockNode} onClose={() => {}} onSeePath={() => {}} />);
    expect(screen.getByText(/And you ended up here\./)).toBeInTheDocument();
  });
});
