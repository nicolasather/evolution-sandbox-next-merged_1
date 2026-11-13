import { render } from '@testing-library/react';
import { ModeStage } from '../ModeStage';
import { BACKDROP_ART, STAGE_ART, type StageMode } from '@/lib/modestage/art';

const MODES: StageMode[] = ['minimum-path', 'escape-room', 'decipher', 'reverse-evolution', 'archaeology', 'alien-archaeology'];

describe('ModeStage', () => {
  it.each(MODES)('%s renders its 3D object and a two-plane backdrop of its own world', mode => {
    const { container } = render(<ModeStage mode={mode} title="Title" caption="Caption" />);
    const figure = container.querySelector(`[data-mode-stage="${mode}"]`);
    expect(figure).not.toBeNull();
    const far = figure!.querySelector('.mode-backdrop-far');
    const near = figure!.querySelector('.mode-backdrop-near');
    // the DOM serialises self-closing shapes as open/close pairs, so compare drawn shapes, not raw markup
    const drawn = (s: string) => (s.match(/<(path|circle|ellipse|rect)\b/g) ?? []).length;
    expect(far?.children.length).toBe(drawn(BACKDROP_ART[mode].far));
    expect(near?.children.length).toBe(drawn(BACKDROP_ART[mode].near));
    expect(far!.children.length).toBeGreaterThan(0);
    expect(near!.children.length).toBeGreaterThan(0);
    expect(figure!.querySelector('.mode-backdrop')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the object art and the backdrop distinct per mode', () => {
    const seen = new Set(MODES.map(m => STAGE_ART[m] + BACKDROP_ART[m].far));
    expect(seen.size).toBe(MODES.length);
  });

  it('shows the title and caption to the player', () => {
    const { getByText } = render(<ModeStage mode="decipher" title="Tablet" caption="Read it." />);
    expect(getByText('Tablet')).toBeInTheDocument();
    expect(getByText('Read it.')).toBeInTheDocument();
  });
});
