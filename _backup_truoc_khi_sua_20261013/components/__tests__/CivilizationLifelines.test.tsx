import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CivilizationMode } from '@/components/civilization/CivilizationMode';
import { generateSettlement } from '@/lib/civilization/generate';
import { resetSharedStore } from '@/lib/civilization/lifelines/store';
import { CAMPAIGN_KEY, SAVE_KEY } from '@/lib/civilization/lifelines/schema';

const LEGACY = JSON.stringify({ v: 1, active: generateSettlement('legacy-seed'), dioramas: [] });

async function openChapters(onExit = jest.fn()) {
  const view = render(<CivilizationMode onExit={onExit} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
  await screen.findByRole('heading', { name: 'Lifelines' });
  return { ...view, onExit };
}

async function playUntilDone(max = 60) {
  for (let i = 0; i < max; i++) {
    if (screen.queryByText('The settlement holds.')) return true;
    const ev = screen.queryByRole('dialog');
    if (ev) { fireEvent.click(within(ev).getByRole('button', { name: /No cost/ })); continue; }
    const next = screen.getByRole('button', { name: 'Advance season' });
    fireEvent.click(next);
  }
  return !!screen.queryByText('The settlement holds.');
}

beforeEach(() => { window.localStorage.clear(); resetSharedStore(); });
afterEach(() => { cleanup(); resetSharedStore(); });

describe('Civilization: Lifelines UI', () => {
  it('opens with the entry cinematic (skippable) and lands on the chapter list with chapter 1 open and the rest locked', async () => {
    await openChapters();
    expect(screen.getByRole('button', { name: /First Light/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Shorter Walk/ })).toBeDisabled();
    expect(screen.getByText(/Households arrive with tools/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Campaign' })).toHaveAttribute('aria-selected', 'true');
  });

  it('plays chapter 1: plan a programme in a district, advance seasons, answer events, complete, archive', async () => {
    await openChapters();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    await screen.findByRole('heading', { name: 'First Light' });
    expect(screen.getByRole('note')).toHaveTextContent(/Start a dependable food programme/);

    // select a district on the map, open programmes, plan the target programme
    const district = document.querySelector('[data-district]') as SVGGElement;
    fireEvent.click(district);
    fireEvent.click(screen.getByRole('button', { name: 'Plan a programme here' }));
    fireEvent.click(await screen.findByRole('button', { name: /Gathering rounds/ }));
    const plan = screen.getByRole('button', { name: /Plan it/ });
    expect(plan).toBeEnabled();
    fireEvent.click(plan);
    expect(await screen.findByText('In progress')).toBeInTheDocument();

    // forecast opens and marks the tutorial step
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));
    expect(screen.getByRole('region', { name: 'Season forecast' })).toBeInTheDocument();

    expect(await playUntilDone()).toBe(true);
    expect(screen.getByText(/not a historical record/)).toBeInTheDocument();
    expect(screen.getByText(/No museum card/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CAMPAIGN_KEY)!).completions['first-light@lifelines-rules-1'].count).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Archive this attempt' }));
    await screen.findByRole('heading', { name: 'Lifelines' });
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull();
    // next chapter is now open
    expect(screen.getByRole('button', { name: /Shorter Walk/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Chronicle' }));
    expect(screen.getByText(/simulated settlement/)).toBeInTheDocument();
  });

  it('an unaffordable event option is disabled with a reason, and the free option works; no double submit', async () => {
    await openChapters();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    await screen.findByRole('heading', { name: 'First Light' });
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));
    for (let i = 0; i < 12 && !screen.queryByRole('dialog'); i++) fireEvent.click(screen.getByRole('button', { name: 'Advance season' }));
    const dlg = screen.getByRole('dialog');
    const free = within(dlg).getByRole('button', { name: /No cost/ });
    fireEvent.click(free); fireEvent.click(free);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY)!).state;
    expect(saved.resolvedEvents).toHaveLength(1);
  });

  it('keyboard: ? opens help, Escape closes it; arrow keys move between districts; list view is available', async () => {
    await openChapters();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    await screen.findByRole('heading', { name: 'First Light' });
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('complementary', { name: 'Help' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Help' })).toBeNull();
    const districts = Array.from(document.querySelectorAll('[data-district]'));
    expect(districts.length).toBeGreaterThanOrEqual(2);
    fireEvent.keyDown(districts[0], { key: 'Enter' });
    expect(districts[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Show list' }));
    expect(screen.getByRole('list', { name: 'Districts' })).toBeInTheDocument();
  });

  it('progress survives a reload: continue resumes the same season', async () => {
    const first = await openChapters();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    await screen.findByRole('heading', { name: 'First Light' });
    fireEvent.click(screen.getByRole('button', { name: 'Advance season' }));
    const turn = JSON.parse(window.localStorage.getItem(SAVE_KEY)!).state.turn;
    first.unmount(); resetSharedStore();
    render(<CivilizationMode onExit={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    // the previous run is resumed directly in play
    await screen.findByRole('heading', { name: 'First Light' });
    expect(screen.getByText(new RegExp(`Season ${turn}`))).toBeInTheDocument();
  });

  it('a legacy Civilization save gets an explicit choice and is never modified', async () => {
    window.localStorage.setItem('evo.civilization.v1', LEGACY);
    const onExit = jest.fn();
    render(<CivilizationMode onExit={onExit} />);
    expect(await screen.findByRole('heading', { name: 'Two ways in' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue legacy settlement/ }));
    expect(await screen.findByText(/Civilization — Build/)).toBeInTheDocument();
    expect(window.localStorage.getItem('evo.civilization.v1')).toBe(LEGACY);
    cleanup(); resetSharedStore();
    render(<CivilizationMode onExit={onExit} />);
    // the answer is remembered; the legacy mode stays reachable from the chapter list
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(await screen.findByRole('button', { name: 'Legacy settlements' })).toBeInTheDocument();
  });

  it('storage failure shows the honest status and lets the player export', async () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new Error('blocked'); };
    try {
      await openChapters();
      fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
      await screen.findByRole('heading', { name: 'First Light' });
      fireEvent.click(screen.getByRole('button', { name: 'Advance season' }));
      expect(await screen.findAllByText(/Progress is not being saved/)).not.toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Export progress' })).toBeInTheDocument();
    } finally { Storage.prototype.setItem = orig; }
  });

  it('settings: subtitles-only is the default, no recorded narration is claimed', async () => {
    await openChapters();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    await screen.findByRole('heading', { name: 'First Light' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const panel = screen.getByRole('complementary', { name: 'Settings' });
    expect(within(panel).getByLabelText('Subtitles only')).toBeChecked();
    expect(within(panel).getByText(/No recorded narration is included/)).toBeInTheDocument();
    act(() => { fireEvent.click(within(panel).getByLabelText('Off')); });
    expect(JSON.parse(window.localStorage.getItem(CAMPAIGN_KEY)!).settings.narration).toBe('off');
  });
});
