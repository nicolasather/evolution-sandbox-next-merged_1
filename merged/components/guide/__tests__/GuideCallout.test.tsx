import { fireEvent, render, screen } from '@testing-library/react';
import { GuideCallout, GuideLive, GuideScope, type GuideCtx } from '../GuideProvider';
import type { GuideStep } from '@/lib/guide/types';

/* The blended callout shows only for its own target, and GuideLive mirrors the step for screen readers. */
const step: GuideStep = { id: 's1', text: 'SOLVE THIS STATION', targets: ['er-station:a'], detail: 'Read the prompt.' };
const ctx = (s: GuideStep | null, ready = false): GuideCtx => ({ mode: 'm', step: s, ready, enabled: true, glow: () => '', skip: () => {} });
const wrap = (value: GuideCtx, node: React.ReactNode) => render(<GuideScope value={value}>{node}</GuideScope>);

describe('GuideCallout', () => {
  it('shows the step text when its exact target is active', () => {
    wrap(ctx(step), <GuideCallout target='er-station:a' />);
    expect(screen.getByText('SOLVE THIS STATION')).toBeInTheDocument();
  });
  it('renders nothing for a different target', () => {
    const { container } = wrap(ctx(step), <GuideCallout target='er-station:b' />);
    expect(container).toBeEmptyDOMElement();
  });
  it('matches by prefix for grid-level targets', () => {
    const survey: GuideStep = { id: 's', text: 'SURVEY A SQUARE', targets: ['arch-survey:1,2'] };
    wrap(ctx(survey), <GuideCallout prefix='arch-survey:' />);
    expect(screen.getByText('SURVEY A SQUARE')).toBeInTheDocument();
  });
  it('does not show for a prefix that does not match', () => {
    const { container } = wrap(ctx(step), <GuideCallout prefix='arch-dig:' />);
    expect(container).toBeEmptyDOMElement();
  });
  it('reveals the detail on WHY and hides it again', () => {
    wrap(ctx(step), <GuideCallout target='er-station:a' />);
    expect(screen.queryByText('Read the prompt.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'WHY?' }));
    expect(screen.getByText('Read the prompt.')).toBeInTheDocument();
  });
  it('renders nothing when no step is active', () => {
    const { container } = wrap(ctx(null), <GuideCallout target='er-station:a' />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('GuideLive', () => {
  it('announces the current step politely', () => {
    wrap(ctx(step), <GuideLive />);
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('SOLVE THIS STATION');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });
});
