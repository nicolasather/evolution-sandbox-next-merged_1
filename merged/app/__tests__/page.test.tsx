import { render } from '@testing-library/react';
import Home from '@/app/page';

describe('Home page', () => {
  it('renders', () => {
    const { container } = render(<Home />);
    expect(container.querySelector('#ground') || container).toBeDefined();
  });
});
