import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GUIDE_PAUSE_MS } from '../GuideProvider';
import { guidePrefs } from '@/lib/guide/prefs';
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
    expect(screen.getByText('PICK A DISCOVERY')).toBeInTheDocument();
    expect(glowing().length).toBeGreaterThan(0);
    fireEvent.click(glowing()[0]); pause();
    expect(screen.getByText('TICK WHAT IT WAS MADE FROM')).toBeInTheDocument();
    fireEvent.click(glowing()[0]); pause();
    expect(screen.getByText('SUBMIT YOUR ANSWER')).toBeInTheDocument();
    expect(glowing()).toHaveLength(1);
    expect(glowing()[0]).toHaveTextContent('Submit');
  });
  it('Archaeologist: starts with one Survey button', () => {
    render(<ArchaeologyMode onExit={noop} />); pause();
    expect(screen.getByText('SURVEY A SQUARE')).toBeInTheDocument();
    expect(glowing()).toHaveLength(1);
    expect(glowing()[0]).toHaveTextContent('Survey');
  });
  it('Decipher: glows the first mystery glyph row', () => {
    render(<DecipherMode onExit={noop} />); pause();
    expect(screen.getByText('GIVE THIS GLYPH A MEANING')).toBeInTheDocument();
    expect(glowing()).toHaveLength(1);
  });
  it('Escape Room: glows one station', () => {
    render(<EscapeRoomMode onExit={noop} />); pause();
    expect(screen.getByText('SOLVE THIS STATION')).toBeInTheDocument();
    expect(glowing()).toHaveLength(1);
  });
  it('Alien Archaeology: glows "Study it" on one specimen', () => {
    render(<AlienArchaeologyMode onExit={noop} />); pause();
    expect(screen.getByText('STUDY A SPECIMEN')).toBeInTheDocument();
    expect(glowing()).toHaveLength(1);
    expect(glowing()[0]).toHaveTextContent('Study it');
  });
  it('Survival: glows one member\'s task row, and "Guide off" removes everything', () => {
    render(<SurvivalMode onExit={noop} />); pause();
    expect(screen.getByText('GIVE EACH PERSON A TASK')).toBeInTheDocument();
    expect(glowing()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'GUIDE OFF' })); pause();
    expect(glowing()).toHaveLength(0);
    expect(screen.queryByText('GIVE EACH PERSON A TASK')).toBeNull();
  });
  it('Minimum Path: glows the start button (Vietnamese text)', () => {
    render(<MinimumPathMode onExit={noop} />); pause();
    expect(screen.getByText('BẤM BẮT ĐẦU')).toBeInTheDocument();
    expect(glowing()[0]).toHaveTextContent('Bắt đầu');
  });
  it('a player who switched the guide off sees none of it', () => {
    guidePrefs.skip('archaeology');
    render(<ArchaeologyMode onExit={noop} />); pause();
    expect(glowing()).toHaveLength(0);
  });
});
