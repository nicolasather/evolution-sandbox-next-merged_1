import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';

describe('NotFound page', () => {
  it('renders 404 page', () => {
    render(<NotFound />);
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });
});
