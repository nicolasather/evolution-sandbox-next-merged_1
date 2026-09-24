import { render } from '@testing-library/react';
import { Sandbox } from '@/components/Sandbox';

describe('Sandbox', () => {
  it('renders without crashing', () => {
    const { container } = render(<Sandbox />);
    expect(container.querySelector('#ground')).toBeInTheDocument();
  });

  it('the explanation drawer starts fully closed: hidden from sight and from assistive tech', () => {
    const { container } = render(<Sandbox />);
    const panel = container.querySelector('#panel');
    expect(panel).toBeInTheDocument();
    expect(panel).not.toHaveClass('open');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('#v-work')).toBeInTheDocument();
  });
});
