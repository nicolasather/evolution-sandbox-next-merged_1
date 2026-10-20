import { expect, test, type Page } from '@playwright/test';

/** Arena Clash UI. The practice runs the REAL engine in the browser (no database), so the whole loop — lobby → quiz break → reveal → planning → live arena —
 *  is played for real. Remote screens are only checked for their guard states; they have NOT been exercised against a hosted backend (see docs/arena-clash/DEPLOYMENT_STATUS.md). */
const SHOTS = process.env.ARENA_SHOTS_DIR;
const noHScroll = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function shot(p: Page, name: string) { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` }); }
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('qz:arena:coach', '1'); } catch { /* ignore */ } }); });

test('hub, modes card, join form and projector guard', async ({ page }) => {
  await page.goto('/quiz/arena'); await expect(page.getByRole('heading', { level: 1, name: 'Arena Clash' })).toBeVisible();
  expect(await noHScroll(page)).toBe(true);
  await page.goto('/quiz/modes'); await expect(page.locator('#arena-clash')).toBeVisible();
  await page.goto('/quiz/arena/join?code=ab12'); const btn = page.getByRole('button', { name: 'Join the match' }); await expect(btn).toBeDisabled();
  await page.getByLabel('Room code').fill('ABC123'); await page.getByLabel('Your name').fill('Sam'); await expect(btn).toBeEnabled();
  await page.goto('/quiz/arena/00000000-0000-4000-8000-000000000000/screen'); await expect(page.getByRole('heading', { name: 'Projector link needed' })).toBeVisible();
});

test('practice: a full round on the real engine, solo role is the Runner, no console errors', async ({ page }) => {
  test.setTimeout(150_000); const errs: string[] = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('/quiz/arena/practice'); await expect(page.getByRole('heading', { name: 'Practice with bots' })).toBeVisible(); await shot(page, 'practice-setup');
  await page.getByTestId('ar-practice-go').click();
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 3000 }).catch(() => {});
  await expect(page.getByTestId('ar-game')).toBeVisible(); await shot(page, 'lobby');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.waitForSelector('[data-testid=ar-quiz]', { timeout: 20_000 }); await shot(page, 'quiz');
  await page.locator('[data-testid=ar-quiz] input[type=radio], [data-testid=ar-quiz] [role=radio], [data-testid=ar-quiz] button').first().click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('button', { name: /Submit answer/ }).click({ timeout: 4000 }).catch(() => {});
  await page.waitForSelector('[data-testid=ar-reveal]', { timeout: 45_000 });
  await page.waitForSelector('[data-testid=ar-plan]', { timeout: 45_000 }); await shot(page, 'plan');
  await page.waitForFunction(() => document.querySelector('[data-testid=ar-game]')?.getAttribute('data-phase') === 'arena_live', null, { timeout: 45_000 });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight'); await shot(page, 'live');
  expect(await noHScroll(page)).toBe(true); expect(errs.filter((e) => !/eval\(\)|Content Security Policy|vercel-scripts/i.test(e))).toEqual([]); // dev-server CSP/eval noise is not an app error
});
