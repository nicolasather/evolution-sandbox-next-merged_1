/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles are deliberately partial */
import { render, screen, fireEvent } from '@testing-library/react';
import { Landing } from '@/components/Landing';

describe('Landing', () => {
  const mockDb = {
    nodes: [{ rec: [{ id: 'a' }, { id: 'b' }] }],
    counts: { core: 10, hidden: 3 },
    sources: { s1: 'source1', s2: 'source2' },
  } as any;

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
});
