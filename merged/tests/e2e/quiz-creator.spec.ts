import { test, expect, type Page } from '@playwright/test';

/**
 * Creator journeys that need NO Supabase: guests author on this device (lib/quiz/local-drafts.ts).
 * Everything here writes only to the test browser's own localStorage.
 */
const KINDS = [
  { add: /\+ add multiple choice/i, heading: /question 1 · multiple choice/i },
  { add: /\+ add answer forge/i, heading: /answer forge/i },
  { add: /\+ add connection rush/i, heading: /connection rush/i },
  { add: /\+ add truth hunt/i, heading: /truth hunt/i },
  { add: /\+ add fill the table/i, heading: /fill the table/i },
];

async function startQuiz(page: Page, title: string) {
  await page.goto('/quiz/new', { waitUntil: 'networkidle' });
  await page.getByLabel('Quiz title').fill(title);
  await page.getByRole('button', { name: /next: choose formats/i }).click();
}
const saved = (page: Page) => expect(page.getByText(/saved on this device|saved/i).first()).toBeVisible({ timeout: 8000 });

test('G01/G03 a guest needs no email, and a reload reopens the same device draft instead of a blank editor', async ({ page }) => {
  await startQuiz(page, 'Reload me');
  await page.getByRole('button', { name: /\+ add multiple choice/i }).click();
  await saved(page);
  await expect(page).toHaveURL(/\/quiz\/edit\/local-/); // address now points at the draft
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /new quiz|reload me/i }).first()).toBeVisible();
  await expect(page.getByText(/question 1 · multiple choice/i)).toBeVisible();
  await page.getByRole('button', { name: /^1\. details/i }).click();
  await expect(page.getByLabel('Quiz title')).toHaveValue('Reload me');
});

test('G02 all five question kinds can be added and each opens its own editor', async ({ page }) => {
  await startQuiz(page, 'All five kinds');
  for (const [i, k] of KINDS.entries()) {
    if (i > 0) await page.getByRole('button', { name: /^2\. question formats/i }).click();
    await page.getByRole('button', { name: k.add }).click();
    await expect(page.getByText(k.heading).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^3\. questions\s*5/i })).toBeVisible();
});

test('G03 offline: typing keeps working and the draft survives while the network is down', async ({ page, context }) => {
  await startQuiz(page, 'Offline draft');
  await page.getByRole('button', { name: /\+ add multiple choice/i }).click();
  await context.setOffline(true);
  await page.getByLabel('Question', { exact: true }).fill('What is 2 + 2?');
  // autosave is debounced, so wait for the text to actually reach device storage — while the network is down
  await expect.poll(() => page.evaluate(() => localStorage.getItem('qz:drafts:v1') ?? ''), { timeout: 10_000 }).toContain('What is 2 + 2?');
  await saved(page);
  await context.setOffline(false);
  await page.reload({ waitUntil: 'networkidle' }); // back online: the very same draft reopens
  await expect(page.getByRole('textbox', { name: 'Question', exact: true })).toHaveValue('What is 2 + 2?', { timeout: 15_000 });
});

test('G05 Back and Next keep what was typed', async ({ page }) => {
  await startQuiz(page, 'Back and forth');
  await page.getByRole('button', { name: /← back/i }).click();
  await expect(page.getByLabel('Quiz title')).toHaveValue('Back and forth');
  await page.getByRole('button', { name: /next: choose formats/i }).click();
  await expect(page.getByRole('heading', { name: /question formats/i })).toBeVisible();
});

test('G05 a question can be removed and the removal can be undone', async ({ page }) => {
  await startQuiz(page, 'Undo test');
  await page.getByRole('button', { name: /\+ add multiple choice/i }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: /^remove$/i }).first().click();
  await expect(page.getByRole('button', { name: /^3\. questions\s*0/i })).toBeVisible();
  await page.getByRole('button', { name: /undo/i }).first().click();
  await expect(page.getByRole('button', { name: /^3\. questions\s*1/i })).toBeVisible();
});

test('G10-adjacent publishing is refused for an incomplete quiz and the reasons are listed', async ({ page }) => {
  await startQuiz(page, 'Incomplete');
  await page.getByRole('button', { name: /\+ add multiple choice/i }).click();
  await expect(page.getByText(/every question needs a prompt/i)).toBeVisible();
});

test('G27 the creator scrolls with REAL content on a phone and the page is not scroll-locked', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await startQuiz(page, 'Scroll check');
  await page.getByRole('button', { name: /\+ add multiple choice/i }).click();
  const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, v: window.innerHeight }));
  expect(doc.h, 'the question editor is taller than the screen, so scrolling must work').toBeGreaterThan(doc.v);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await expect(page.getByRole('button', { name: /next: media/i })).toBeVisible();
});

test('G27 no horizontal overflow on the creator at 320 px with a question open', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await startQuiz(page, 'Narrow');
  await page.getByRole('button', { name: /\+ add connection rush/i }).click();
  const w = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, v: document.documentElement.clientWidth }));
  expect(w.d).toBeLessThanOrEqual(w.v + 3);
});

test('G28 the step tabs and the main actions are reachable by keyboard alone', async ({ page }) => {
  await page.goto('/quiz/new', { waitUntil: 'networkidle' });
  await page.getByLabel('Quiz title').focus();
  await page.keyboard.type('Keyboard only');
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    seen.add(await page.evaluate(() => (document.activeElement?.textContent ?? document.activeElement?.getAttribute('aria-label') ?? '').trim().toLowerCase().slice(0, 40)));
  }
  expect([...seen].some((t) => /next: choose formats/.test(t))).toBe(true);
  expect([...seen].some((t) => /save draft/.test(t))).toBe(true);
});

test('G29 the creator and every main quiz route show no uncaught error and no broken same-origin link', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const seen = new Set<string>();
  for (const route of ['/quiz', '/quiz/new', '/quiz/modes', '/quiz/library', '/quiz/join', '/quiz/my', '/quiz/help', '/quiz/collection']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''))) {
      const path = href.split('#')[0]!.split('?')[0]!;
      if (!path || seen.has(path) || path.includes('[')) continue; seen.add(path);
      const r = await request.get(path, { maxRedirects: 5 });
      expect(r.status(), `dead link ${href} on ${route}`).toBeLessThan(400);
    }
  }
  expect(errors).toEqual([]);
});
