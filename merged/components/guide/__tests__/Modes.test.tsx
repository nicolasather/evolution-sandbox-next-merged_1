import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GUIDE_PAUSE_MS } from '../GuideProvider';
import { guidePrefs } from '@/lib/guide/prefs';
import { PRIMER_KEY } from '@/lib/guide/survivalPrimer';
import { ReverseEvolutionMode } from '@/components/reverseevolution/ReverseEvolutionMode';
import { ArchaeologyMode } from '@/components/archaeology/ArchaeologyMode';
import { DecipherMode } from '@/components/decipher/DecipherMode';
import { EscapeRoomMode } from '@/components/escaperoom/EscapeRoomMode';
import { AlienArchaeologyMode } from '@/components/alienarchaeology/AlienArchaeologyMode';
import { SurvivalMode } from '@/components/survival/SurvivalMode';
import { MinimumPathMode } from '@/components/minimumpath/MinimumPathMode';

beforeEach(() => { jest.useFakeTimers(); window.localStorage.clear(); guidePrefs._reset(); });
afterEach(() => { cleanup(); jest.useRealTimers(); });
const pause = () => act(() => { jest.advanceTimersByTime(GUIDE_PAUSE_MS + 20); });
const noop = () => {};
const glowing = () => Array.from(document.querySelectorAll('.guide-glow'));

describe('guides in the real modes (fresh browser)', () => {
  it('Reverse Evolution: glows a discovery card, then the options, then Submit', () => {
    render(<ReverseEvolutionMode onExit={noop} />);
    pause();
    expect(document.querySelector('[data-guide-callout]')).toHaveTextContent('PICK A DISCOVERY');
    expect(glowing().length).toBeGreaterThan(0);
    fireEvent.click(glowing()[0]); pause();
    expect(document.querySelector('[data-guide-callout]')).toHaveTextContent('TICK WHAT IT WAS MADE FROM');
    fireEvent.click(glowing()[0]); pause();
    expect(document.querySelector('[data-guide-callout]')).toHaveTextContent('SUBMIT YOUR ANSWER');
    expect(glowing()).toHaveLength(1);
    expect(glowing()[0]).toHaveTextContent('Submit');
  });
  it('Archaeologist: starts with one Survey button', () => {
    render(<ArchaeologyMode onExit={noop} />); pause();
    expect(document.querySelector('[data-guide-callout]')).toHaveTextContent('SURVEY A SQUARE');
    expect(glowing()).toHaveLength(1);
    expect(glowing()[0]).toHaveTextContent('Survey');
  });
  it('Decipher: glows the first mystery glyph row', () => {
    render(<DecipherMode onExit={noop} />); pause();
    expect(document.querySelector('[data-guide-callout]')).toHaveTextContent('GIVE THIS GLYPH A MEANING');
    expect(glowing()).toHaveLength(1);
  });
  it('Escape Room: glows one station', () => {
    render(<EscapeRoomMode onExit={noop} />); pause();
    expect(document.querySelector('[data-guide-callout]')).toHaveTextContent('SOLVE THIS STATION');
    expect(glowing()).toHaveLength(1);
  });
  it('Alien Archaeology: glows "Study it" on one specimen', () => {
    render(<AlienArchaeologyMode onExit={noop} />); pause();
    expect(document.querySelector('[data-guide-callout]')).toHaveTextContent('STUDY A SPECIMEN');
    expect(glowing()).toHaveLength(1);
    expect(glowing()[0]).toHaveTextContent('Study it');
  });
  it('Survival: glows one member\'s task row, and "Guide off" removes everything', () => {
    // The on-page tour opens first on a first visit; mark it seen so this test checks the text guide alone.
    window.localStorage.setItem(PRIMER_KEY, 'done');
    render(<SurvivalMode onExit={noop} />); pause();
    expect(screen.getByText('GIVE EACH PERSON A TASK')).toBeInTheDocument();
    expect(glowing()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'GUIDE OFF' })); pause();
    expect(glowing()).toHaveLength(0);
    expect(screen.queryByText('GIVE EACH PERSON A TASK')).toBeNull();
  });
  it('Survival: a first visit opens the tour, and the text guide waits behind it', () => {
    render(<SurvivalMode onExit={noop} />); pause();
    expect(document.querySelector('.sv-primer-card')).not.toBeNull();
    expect(screen.queryByText('GIVE EACH PERSON A TASK')).toBeNull();
    expect(glowing()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' })); pause();
    expect(document.querySelector('.sv-primer-card')).toBeNull();
    expect(window.localStorage.getItem(PRIMER_KEY)).toBe('done');
    expect(screen.getByText('GIVE EACH PERSON A TASK')).toBeInTheDocument();
  });
  it('Minimum Path: glows the start button (Vietnamese text)', () => {
    render(<MinimumPathMode onExit={noop} />); pause();
    // the instruction sits directly above the control it points at, not in a banner
    const callout = document.querySelector('[data-guide-callout]');
    expect(callout).toHaveTextContent('PRESS START');
    expect(callout?.nextElementSibling).toBe(glowing()[0]);
    expect(glowing()[0]).toHaveTextContent('Start');
  });
  it('a player who switched the guide off sees none of it', () => {
    guidePrefs.skip('archaeology');
    render(<ArchaeologyMode onExit={noop} />); pause();
    expect(glowing()).toHaveLength(0);
  });
});
