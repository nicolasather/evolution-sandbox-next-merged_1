import { test, expect } from '@playwright/test';

/**
 * These are safe, NON-WRITING browser smoke tests. They do not certify game
 * hosting, room joining, media upload or earned rewards. Claude must add full
 * seeded journeys on isolated staging after inspecting the UI and APIs.
 */
const paths = ['/quiz', '/quiz/library', '/quiz/new', '/quiz/join', '/quiz/modes'];

for (const route of paths) {
  test(`${route} has a real accessible page and no fatal JS errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route} HTTP status`).toBeLessThan(400);
    await expect(page.locator('main').first()).toBeVisible();
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
    const text = (await page.locator('body').innerText()).trim();
    expect(text.length).toBeGreaterThan(20);
    expect(pageErrors, `Uncaught browser errors in ${route}`).toEqual([]);
  });
}

test('/quiz/new can be opened without email sign-in', async ({ page }) => {
  await page.goto('/quiz/new');
  await expect(page).not.toHaveURL(/\/quiz\/login/);
  await expect(page.locator('main').first()).toBeVisible();
  // Extend after reading QuizEditor markup: enter question title, save locally,
  // reload and assert same data; verify export/import if cloud is unavailable.
});

test('quiz page can scroll even when sandbox CSS locks html/body', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 660 });
  await page.goto('/quiz/new', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main').first()).toBeVisible();
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.id = 'e2e-temporary-scroll-spacer';
    spacer.style.cssText = 'height:2500px;width:1px;pointer-events:none;';
    document.body.appendChild(spacer);
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const overflow = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowY,
    body: getComputedStyle(document.body).overflowY,
  }));
  expect(overflow.html, 'html overflow').not.toBe('hidden');
  expect(overflow.body, 'body overflow').not.toBe('hidden');
});

test('no horizontal overflow at narrow mobile size', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const route of ['/quiz', '/quiz/new', '/quiz/library', '/quiz/join']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const bounds = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(bounds.documentWidth, `Horizontal overflow in ${route}`).toBeLessThanOrEqual(bounds.viewportWidth + 3);
  }
});

test('no focus-trapping overlay on the creator landing', async ({ page }) => {
  await page.goto('/quiz/new');
  await page.keyboard.press('Tab');
  const focusable = await page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    return e && ['A','BUTTON','INPUT','TEXTAREA','SELECT'].includes(e.tagName);
  });
  expect(focusable).toBeTruthy();
});
