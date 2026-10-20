/** PATCH A acceptance: rapid changes + out-of-order replies can never show a stale plan or unlock "Create game". */
import { act, fireEvent, render, screen } from '@testing-library/react';
import ProjectorSetup from '../ProjectorSetup';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
type Pending = { body: { minutes: number | null }; resolve: (v: unknown) => void };
const pending: Pending[] = [];
jest.mock('@/lib/quiz/client', () => ({
  ApiError: class extends Error { status = 400; },
  api: jest.fn((_url: string, init: { json: { minutes: number | null } }) => new Promise((resolve) => { pending.push({ body: init.json, resolve }); })),
}));

const reply = (minutes: number | null, ok: boolean, turns: number) => ({
  plan: { game: 'boss_battle', minutes, band: 'standard', teams: 3, secondsPerTurn: 85, turnBudget: turns, turnsPerTeam: turns / 3, questionsNeeded: turns + 3, tiles: 13, bossPhases: 2, escapeRooms: 2, escapeMaxTier: 1, vaults: 5, ladderTiers: 7, notes: [] },
  check: { ok, available: 20, needed: turns + 3, shortage: ok ? 0 : 9, repeatsNeeded: 0, maxRepeatable: 0, fitMinutes: null, flags: ok ? [] : ['tooFewQuestions'], topics: 1, bands: { easy: 0, medium: 0, hard: 0, unrated: 20 }, singleBand: true },
  fitTurns: null,
});

beforeEach(() => { jest.useFakeTimers(); pending.length = 0; });
afterEach(() => jest.useRealTimers());

it('only the reply for the CURRENT selection is shown, and launch waits for it', async () => {
  render(<ProjectorSetup quizId="00000000-0000-4000-8000-000000000001" quizTitle="Q" questionCount={20} signedIn initialGame="boss_battle" />);
  // go to the Time step and to the Launch step later
  fireEvent.click(screen.getByText('Next')); // step 2 (time)
  await act(async () => { jest.advanceTimersByTime(350); });
  expect(pending).toHaveLength(1); // 30 min (default for Boss Battle)
  // quickly change the duration twice
  fireEvent.click(screen.getByLabelText(/^10 min$/));
  await act(async () => { jest.advanceTimersByTime(100); });
  fireEvent.click(screen.getByLabelText(/^45 min$/));
  await act(async () => { jest.advanceTimersByTime(350); });
  const latest = pending[pending.length - 1]!;
  expect(latest.body.minutes).toBe(45);
  // the NEWEST answers first (too few questions), then a stale OK for 30 minutes arrives late
  await act(async () => { latest.resolve(reply(45, false, 30)); });
  await act(async () => { pending[0]!.resolve(reply(30, true, 18)); });
  expect(screen.getByText('30')).toBeTruthy(); // turns of the 45-minute plan are shown…
  expect(screen.queryByText('18')).toBeNull(); // …never the stale 30-minute plan
  fireEvent.click(screen.getByText('Next')); fireEvent.click(screen.getByText('Next'));
  expect((screen.getByTestId('pj-launch') as HTMLButtonElement).disabled).toBe(true); // the current answer says the quiz is too short
  // change again: while the new request is pending nothing is "ready"
  fireEvent.click(screen.getByText('Back')); fireEvent.click(screen.getByText('Back'));
  fireEvent.click(screen.getByLabelText(/^15 min$/));
  expect(screen.getByRole('status').textContent).toMatch(/Checking/);
  await act(async () => { jest.advanceTimersByTime(350); });
  await act(async () => { pending[pending.length - 1]!.resolve(reply(15, true, 9)); });
  fireEvent.click(screen.getByText('Next')); fireEvent.click(screen.getByText('Next'));
  expect((screen.getByTestId('pj-launch') as HTMLButtonElement).disabled).toBe(false);
});

it('blank or duplicate team names block launch with an inline reason', async () => {
  render(<ProjectorSetup quizId="00000000-0000-4000-8000-000000000001" quizTitle="Q" questionCount={20} signedIn initialGame="boss_battle" />);
  fireEvent.change(screen.getByLabelText('Team names 2'), { target: { value: ' RED ' } });
  expect(screen.getByText('Team 2 has the same name as team 1.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Team names 3'), { target: { value: '   ' } });
  expect(screen.getByText('Team 3 needs a name.')).toBeTruthy();
});
