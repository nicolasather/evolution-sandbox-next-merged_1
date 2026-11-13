import { fireEvent, render, screen } from '@testing-library/react';
import { MinimumPathMode } from '../MinimumPathMode';
import { DEFAULT_LANG, LANG_KEY, parseLang, t } from '@/lib/minimumpath/i18n';

/* One language per screen: English by default, Vietnamese only when chosen, never a mix. */

beforeEach(() => { window.localStorage.clear(); });

describe('Minimum Path language', () => {
  it('opens in English by default', () => {
    render(<MinimumPathMode onExit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Start / Continue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit mode' })).toBeInTheDocument();
    expect(screen.queryByText(/Bắt đầu/)).toBeNull();
  });

  it('switches the whole screen to Vietnamese and back, without a mix', () => {
    render(<MinimumPathMode onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    expect(screen.getByRole('button', { name: 'Bắt đầu / Tiếp tục' })).toBeInTheDocument();
    expect(screen.queryByText('Start / Continue')).toBeNull();
    expect(screen.queryByText('Exit mode')).toBeNull();
    expect(window.localStorage.getItem(LANG_KEY)).toBe('vi');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'Start / Continue' })).toBeInTheDocument();
    expect(window.localStorage.getItem(LANG_KEY)).toBe('en');
  });

  it('remembers Vietnamese in this browser', () => {
    window.localStorage.setItem(LANG_KEY, 'vi');
    render(<MinimumPathMode onExit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Bắt đầu / Tiếp tục' })).toBeInTheDocument();
  });

  it('marks the document language on the mode root', () => {
    const { container } = render(<MinimumPathMode onExit={() => {}} />);
    expect(container.querySelector('main')).toHaveAttribute('lang', 'en');
  });
});

describe('i18n table', () => {
  it('parses only the two supported languages and falls back to English', () => {
    expect(parseLang('vi')).toBe('vi');
    expect(parseLang('en')).toBe('en');
    expect(parseLang('fr')).toBe(DEFAULT_LANG);
    expect(parseLang(null)).toBe('en');
  });

  it('fills {placeholders} from the variables', () => {
    expect(t('en', 'scores', { yours: 5, optimal: 3, extra: 2 })).toBe('Yours: 5 · Optimal: 3 · Extra: 2 steps.');
    expect(t('vi', 'scores', { yours: 5, optimal: 3, extra: 2 })).toBe('Của bạn: 5 · Tối ưu: 3 · Dư: 2 bước.');
  });
});
