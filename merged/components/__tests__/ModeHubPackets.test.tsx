import { render, screen, waitFor } from '@testing-library/react';
import { ModeHub } from '../ModeHub';
import { createEngine } from '@/lib/engine';
import { playDb } from '@/lib/processing';

/* Ticket 097: with the feature flag off (default) the hub is exactly the Phase 1 hub — no packet note, no fetch. */
describe('ModeHub with mode packets (default OFF)', () => {
  it('renders every card and no AI note when NEXT_PUBLIC_MODE_PACKETS is not "true"', async () => {
    const f = jest.fn(); global.fetch = f as unknown as typeof fetch;
    const { container } = render(<ModeHub engine={createEngine(playDb)} active onLaunch={() => {}} />);
    await waitFor(() => expect(container.querySelectorAll('[data-testid="packet-note"]').length).toBe(0));
    expect(container.textContent).toMatch(/Survival/i);
    expect(screen.queryByTestId('packet-note')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
