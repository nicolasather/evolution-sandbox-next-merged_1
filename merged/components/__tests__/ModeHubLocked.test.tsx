import { fireEvent, render, screen } from '@testing-library/react';
import { ModeHub } from '../ModeHub';
import { createEngine } from '@/lib/engine';
import { playDb } from '@/lib/processing';
import type { Unlocks } from '@/lib/unlocks/useUnlocks';

jest.setTimeout(30_000);

/* Locked-but-implemented modes stay visible in the Mode Hub: they show a lock and the requirement, and cannot be launched. */
describe('ModeHub locked wings', () => {
  const nothing: Pick<Unlocks, 'has' | 'fresh' | 'opened'> = { has: () => false, fresh: () => false, opened: () => {} };

  it('keeps the locked Survival card visible with its requirement and no launch', () => {
    const onLaunchMode = jest.fn();
    render(<ModeHub engine={createEngine(playDb)} active onLaunch={() => {}} onLaunchMode={onLaunchMode} unlocks={nothing} />);
    const locked = screen.getAllByTestId('mode-locked');
    expect(locked.length).toBeGreaterThan(0);
    expect(locked[0].textContent).toMatch(/Locked · Make 20 discoveries/);
    const survivalCard = screen.getByText('Survival').closest('.hub-exhibit') as HTMLElement;
    expect(survivalCard.classList.contains('is-locked')).toBe(true);
    const cta = survivalCard.querySelector('button.hub-continue') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    fireEvent.click(cta);
    expect(onLaunchMode).not.toHaveBeenCalled();
  });

  it('shows no lock once the requirement holds', () => {
    render(<ModeHub engine={createEngine(playDb)} active onLaunch={() => {}} unlocks={{ ...nothing, has: () => true }} />);
    expect(screen.queryAllByTestId('mode-locked').length).toBe(0);
  });
});
