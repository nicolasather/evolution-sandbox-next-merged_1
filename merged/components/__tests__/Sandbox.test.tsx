import { render } from '@testing-library/react';
import { Sandbox } from '@/components/Sandbox';

describe('Sandbox', () => {
  it('renders without crashing', () => {
    const { container } = render(<Sandbox />);
    expect(container.querySelector('#ground')).toBeInTheDocument();
  });
});
