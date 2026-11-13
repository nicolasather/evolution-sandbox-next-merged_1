import { beforeEach, expect, jest, test } from '@jest/globals';
import { TextEncoder } from 'node:util';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MinimumPathMode } from '@/components/minimumpath/MinimumPathMode';
import { content, graph } from '@/lib/minimumpath/content';
import { shortest } from '@/lib/minimumpath/engine';
import { SAVE_KEY } from '@/lib/minimumpath/save';
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, callback: () => unknown) => callback(),
  } });
});
async function saved() { await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull()); }
test('E2E component: enter → mission → legal moves → result → save → remount → resume → exit', async () => {
  const exit = jest.fn(); const ui = render(<MinimumPathMode onExit={exit} />);
  fireEvent.click(screen.getByText('Start / Continue'));
  fireEvent.click(screen.getByText('Start selected mission')); await saved();
  const path = shortest(graph, content.missions[0])!;
  for (const id of path.slice(1)) {
    fireEvent.click(screen.getByRole('button', { name: `Go to ${graph.items.get(id)!.name}` })); await saved();
  }
  expect(screen.getByText('Found the optimal route')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).records).toHaveLength(1);
  ui.unmount(); render(<MinimumPathMode onExit={exit} />);
  fireEvent.click(screen.getByText('Start / Continue'));
  expect(screen.getByText('Found the optimal route')).toBeTruthy();
  fireEvent.click(screen.getByText('Exit mode')); expect(exit).toHaveBeenCalledTimes(1);
});
test('hint marks assisted and corrupt save stays untouched through play', async () => {
  localStorage.setItem(SAVE_KEY, 'unreadable');
  render(<MinimumPathMode onExit={() => undefined} />);
  fireEvent.click(screen.getByText('Start / Continue'));
  fireEvent.click(screen.getByText('Start selected mission')); await saved();
  fireEvent.click(screen.getByText('Hint: next step')); await saved();
  expect(screen.getByText('Assisted')).toBeTruthy();
  expect(localStorage.getItem(SAVE_KEY)).toBe('unreadable');
  expect(screen.getByText(/Try going to/)).toBeTruthy();
});
test('missing Web Locks permits play without overwriting stored data', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  render(<MinimumPathMode onExit={() => undefined} />);
  fireEvent.click(screen.getByText('Start / Continue'));
  fireEvent.click(screen.getByText('Start selected mission')); await saved();
  expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  expect(screen.getByText(/Session only/)).toBeTruthy();
});
test('other tab conflict preserves remote save and reports memory-only mode', async () => {
  render(<MinimumPathMode onExit={() => undefined} />);
  fireEvent.click(screen.getByText('Start / Continue'));
  localStorage.setItem(SAVE_KEY, 'remote-change');
  fireEvent.click(screen.getByText('Start selected mission')); await saved();
  expect(localStorage.getItem(SAVE_KEY)).toBe('remote-change');
  expect(screen.getByText(/Another tab changed the save/)).toBeTruthy();
});
