import { render, screen, fireEvent } from '@testing-library/react';
import ErrorPage from '@/app/error';

describe('Error page', () => {
  it('renders error message', () => {
    render(<ErrorPage error={new Error('test')} reset={() => {}} />);
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('calls reset on button click', () => {
    const reset = jest.fn();
    render(<ErrorPage error={new Error('test')} reset={reset} />);
    fireEvent.click(screen.getByLabelText(/Try again/i));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
