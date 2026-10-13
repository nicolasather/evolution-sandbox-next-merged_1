import { useState } from 'react';
import fs from 'fs';
import path from 'path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuideHint, GuideScope, useGuideController, GUIDE_PAUSE_MS } from '../GuideProvider';
import { guidePrefs } from '@/lib/guide/prefs';
import type { GuideStep } from '@/lib/guide/types';

const STEPS: Record<string, GuideStep> = {
  a: { id: 'a', text: 'CHOOSE A DISTRICT', targets: ['one'], detail: 'Longer explanation.' },
  b: { id: 'b', text: 'OPEN PROGRAMMES', targets: ['two'] },
};

function Harness({ stepId, finished = false, eligible = true }: { stepId: string | null; finished?: boolean; eligible?: boolean }) {
  const guide = useGuideController({ mode: 'civilization', eligible, step: stepId ? STEPS[stepId] : null, finished });
  const [clicks, setClicks] = useState(0);
  return (
    <GuideScope value={guide}>
      <GuideHint />
      <button className={'real ' + guide.glow('one')} onClick={() => setClicks(c => c + 1)}>One</button>
      <button className={'real ' + guide.glow('two')}>Two</button>
      <output data-testid="clicks">{clicks}</output>
    </GuideScope>
  );
}

beforeEach(() => { jest.useFakeTimers(); window.localStorage.clear(); guidePrefs._reset(); });
afterEach(() => { cleanup(); jest.useRealTimers(); });
const pause = () => act(() => { jest.advanceTimersByTime(GUIDE_PAUSE_MS + 20); });

describe('guide layer', () => {
  it('glows the REAL control (no fake button) and shows one short instruction after a brief pause', () => {
    render(<Harness stepId="a" />);
    expect(screen.queryByText('CHOOSE A DISTRICT')).toBeNull(); // pause first
    pause();
    expect(screen.getByText('CHOOSE A DISTRICT')).toBeInTheDocument();
    const one = screen.getByRole('button', { name: 'One' });
    expect(one).toHaveClass('guide-glow');
    expect(screen.getByRole('button', { name: 'Two' })).not.toHaveClass('guide-glow');
    expect(screen.getAllByRole('button', { name: 'One' })).toHaveLength(1); // nothing duplicated on top
  });

  it('never blocks normal clicking', () => {
    render(<Harness stepId="a" />);
    pause();
    fireEvent.click(screen.getByRole('button', { name: 'One' }));
    expect(screen.getByTestId('clicks')).toHaveTextContent('1');
  });

  it('moves on: the old glow stops at once, the next appears after the pause', () => {
    const { rerender } = render(<Harness stepId="a" />);
    pause();
    rerender(<Harness stepId="b" />);
    expect(screen.getByRole('button', { name: 'One' })).not.toHaveClass('guide-glow');
    expect(screen.getByRole('button', { name: 'Two' })).not.toHaveClass('guide-glow');
    pause();
    expect(screen.getByRole('button', { name: 'Two' })).toHaveClass('guide-glow');
    expect(screen.getByText('OPEN PROGRAMMES')).toBeInTheDocument();
  });

  it('keeps the long text one tap away (WHY?), never visible by default', () => {
    render(<Harness stepId="a" />);
    pause();
    expect(screen.queryByText('Longer explanation.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'WHY?' }));
    expect(screen.getByText('Longer explanation.')).toBeInTheDocument();
  });

  it('GUIDE OFF removes glow and text, and is remembered', () => {
    render(<Harness stepId="a" />);
    pause();
    fireEvent.click(screen.getByRole('button', { name: 'GUIDE OFF' }));
    expect(screen.queryByText('CHOOSE A DISTRICT')).toBeNull();
    expect(screen.getByRole('button', { name: 'One' })).not.toHaveClass('guide-glow');
    expect(guidePrefs.get().modes.civilization).toBe('off');
  });

  it('does not run for a non-beginner unless it was switched on', () => {
    render(<Harness stepId="a" eligible={false} />);
    pause();
    expect(screen.queryByText('CHOOSE A DISTRICT')).toBeNull();
    cleanup();
    guidePrefs.enable('civilization');
    render(<Harness stepId="a" eligible={false} />);
    pause();
    expect(screen.getByText('CHOOSE A DISTRICT')).toBeInTheDocument();
  });

  it("finishing says YOU'RE READY briefly, then everything disappears and it never restarts", () => {
    const { rerender } = render(<Harness stepId="a" />);
    pause();
    rerender(<Harness stepId={null} finished />);
    pause();
    expect(screen.getByText("YOU'RE READY")).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(3500); });
    expect(screen.queryByText("YOU'RE READY")).toBeNull();
    expect(guidePrefs.get().modes.civilization).toBe('done');
    rerender(<Harness stepId="a" />);
    pause();
    expect(screen.queryByText('CHOOSE A DISTRICT')).toBeNull();
  });

  it('exposes a fuller description for screen readers while the visible text stays short', () => {
    render(<Harness stepId="a" />);
    pause();
    const status = screen.getAllByRole('status')[0];
    expect(status.textContent).toContain('CHOOSE A DISTRICT');
  });
});

describe('guide styling', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../../app/_guide.css'), 'utf8');
  it('breathes gently (~2.4 s per cycle) and has no rapid flashing', () => {
    expect(css).toMatch(/guideBreathe 2\.4s ease-in-out infinite/);
    expect(css).not.toMatch(/animation:[^;]*0\.[0-5]s[^;]*infinite/);
  });
  it('reduced motion: no pulsing, but a steady visible ring remains', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/\.guide-glow\{animation:none;box-shadow:/);
  });
  it('adds no layout (no position change, margin or size) to the glowing control', () => {
    const rule = css.match(/\.guide-glow\{[^}]*\}/)![0];
    expect(rule).not.toMatch(/margin|padding|width|height|top:|left:/);
  });
});
