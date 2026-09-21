import { render, screen } from '@testing-library/react';
import { StaticPage } from '@/components/StaticPage';

describe('StaticPage', () => {
  it('renders', () => {
    render(
      <StaticPage eyebrow="FAQ" title="Questions">
        <p>Content</p>
      </StaticPage>
    );
    expect(screen.getAllByText('FAQ')[0]).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
