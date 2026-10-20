import { expect, test, type Page } from '@playwright/test';

/** Tower Defense: the offline practice runs the real engine and the real question formats in the browser, so the whole loop
 *  (lobby → question → review → build → wave → result → … → results) can be played end to end without a database. */
const SHOTS = process.env.TD_SHOTS_DIR; // optional: set to save the walkthrough screenshots
const phase = (p: Page) => p.locator('.td').first().getAttribute('data-phase');
async function waitPhase(p: Page, want: string[], ms = 120_000) {
  const t = Date.now();
  while (Date.now() - t < ms) { const ph = await phase(p); if (ph && (want.includes(ph) || ph === 'finished')) return ph; /* a fallen core can end the match from any phase */ await p.waitForTimeout(250); }
  throw new Error(`still in ${await phase(p)}, wanted ${want.join('/')}`);
}
async function shot(p: Page, name: string) { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` }); }
async function answer(p: Page) {
  const q = p.locator('.td-quiz');
  const txt = q.locator('input[type="text"], input:not([type]), textarea');
  if (await txt.count()) { for (let i = 0; i < (await txt.count()); i++) await txt.nth(i).fill('56'); }
  else { const opts = q.locator('button').filter({ hasNotText: /Read aloud|Submit/i }); if (await opts.count()) await opts.last().click({ timeout: 5000 }).catch(() => {}); }
  // some formats need several parts; an incomplete answer keeps Submit disabled and the timer closes the question instead
  await q.getByRole('button', { name: /Submit/i }).click({ timeout: 5000 }).catch(() => {});
}

test('hub, modes card and library entry point at Tower Defense', async ({ page }) => {
  await page.goto('/quiz/td');
  await expect(page.getByRole('heading', { level: 1, name: 'Tower Defense' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practice alone' })).toHaveAttribute('href', '/quiz/td/practice');
  await page.goto('/quiz/modes');
  await expect(page.locator('#tower-defense')).toBeVisible();
  await expect(page.locator('#tower-defense').getByRole('link', { name: 'Pick a quiz' })).toHaveAttribute('href', '/quiz/library?mode=online&game=tower_defense');
});

test('join form validates the code before calling the server', async ({ page }) => {
  await page.goto('/quiz/td/join?code=ab12');
  const btn = page.getByRole('button', { name: 'Join the match' });
  await expect(btn).toBeDisabled();
  await page.getByLabel('Room code').fill('ABC123'); await page.getByLabel('Your name').fill('Sam');
  await expect(btn).toBeEnabled();
});

test('projector page without its private link explains how to open it', async ({ page }) => {
  await page.goto('/quiz/td/00000000-0000-4000-8000-000000000000/screen');
  await expect(page.getByRole('heading', { name: 'Projector link needed' })).toBeVisible();
});

test('practice: a full 10-minute match from lobby to results', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/quiz/td/practice');
  await page.getByTestId('td-practice-go').click();
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await shot(page, '01-lobby');
  await page.getByRole('button', { name: 'Start practice' }).click();
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const ph = await waitPhase(page, ['quiz_open', 'reveal', 'build', 'wave', 'wave_result', 'finished']);
    if (ph === 'finished') break;
    if (ph === 'quiz_open') {
      await expect(page.getByRole('dialog')).toBeVisible();
      if (!seen.has('q')) { seen.add('q'); await shot(page, '02-question'); }
      await answer(page); await waitPhase(page, ['reveal', 'build']); continue;
    }
    if (ph === 'reveal') { if (!seen.has('r')) { seen.add('r'); await shot(page, '03-reveal'); } await waitPhase(page, ['build']); continue; }
    if (ph === 'build') {
      const pads = page.locator('.td-hit.pad');
      if (await pads.count()) {
        await pads.first().click({ timeout: 5000 }).catch(() => {});
        const card = page.locator('.td-towercard:not([disabled])').first();
        if (!seen.has('b')) { seen.add('b'); await shot(page, '04-build'); }
        if (await card.count()) { await card.click({ timeout: 5000 }); await expect(page.locator('.td-toast')).toBeVisible(); }
        // a second tower when the points allow it
        if (await pads.count()) { await pads.nth(Math.min(5, (await pads.count()) - 1)).click({ timeout: 5000 }).catch(() => {}); const c2 = page.locator('.td-towercard:not([disabled])').first(); if (await c2.count()) await c2.click({ timeout: 5000 }).catch(() => {}); }
      }
      // the build timer may run out while we act: every click is bounded so a phase change can never hang the test
      await page.locator('.td-readybox .td-btn').click({ timeout: 5000 }).catch(() => {});
      await waitPhase(page, ['wave']); continue;
    }
    if (ph === 'wave') {
      if (!seen.has('w')) { await page.waitForTimeout(3000); seen.add('w'); await shot(page, '05-wave'); }
      await waitPhase(page, ['wave_result', 'quiz_open', 'finished'], 150_000); continue;
    }
    if (ph === 'wave_result') { if (!seen.has('wr')) { seen.add('wr'); await shot(page, '06-wave-result'); } await waitPhase(page, ['quiz_open', 'build', 'finished']); }
  }
  await expect(page.getByRole('heading', { name: 'What the class answered' })).toBeVisible();
  await shot(page, '07-results');
  expect(seen.has('q') && seen.has('b') && seen.has('w')).toBe(true);
  expect(errors).toEqual([]);
});
