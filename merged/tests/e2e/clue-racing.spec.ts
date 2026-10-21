import { expect, test, type Page } from '@playwright/test';

/** Clue Racing UI. The practice runs the REAL engine in the browser (no database), so the whole loop — lobby → countdown → race → checkpoint → clue question → reveal → route board → next leg —
 *  is played for real. Remote screens are only checked for their guard states; they have NOT been exercised against a hosted backend (see docs/clue-racing/IMPLEMENTATION_STATUS.md). */
const SHOTS = process.env.CR_SHOTS_DIR;
const noHScroll = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function shot(p: Page, name: string) { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` }); }
const benign = (e: string) => /eval\(\)|Content Security Policy|vercel-scripts|Failed to load resource/i.test(e);
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('qz:cr:coach', '1'); } catch { /* ignore */ } }); });

test('hub, modes card, join form, setup guard and projector guard', async ({ page }) => {
  await page.goto('/quiz/cr'); await expect(page.getByRole('heading', { level: 1, name: 'Clue Racing' })).toBeVisible();
  expect(await noHScroll(page)).toBe(true); await shot(page, 'hub');
  await page.goto('/quiz/modes'); await expect(page.locator('#clue-racing')).toBeVisible();
  await page.goto('/quiz/cr/join?code=ab12'); const btn = page.getByRole('button', { name: 'Join the race' }); await expect(btn).toBeDisabled();
  await page.getByLabel('Room code').fill('ABC123'); await page.getByLabel('Your name').fill('Sam'); await expect(btn).toBeEnabled();
  await page.goto('/quiz/cr/00000000-0000-4000-8000-000000000000/screen'); await expect(page.getByRole('heading', { name: 'Projector link needed' })).toBeVisible();
  await page.goto('/quiz/cr/not-a-room'); await expect(page.locator('body')).toContainText(/couldn.t find|not found|404/i);
});

test('practice setup lists three formats, four maps and every difficulty', async ({ page }) => {
  await page.goto('/quiz/cr/practice'); await expect(page.getByRole('heading', { name: 'Practice as a Solo Pathfinder' })).toBeVisible();
  for (const n of ['Split-Route Sprint', 'Signal Relay', 'Atlas Circuit', 'Sunleaf Passage', 'Tideglass Harbor', 'Copperwind Borough', 'Starpetal Heights']) await expect(page.getByText(n, { exact: true }).first()).toBeVisible();
  expect(await noHScroll(page)).toBe(true); await shot(page, 'practice-setup');
});

for (const [format, map] of [['Split-Route Sprint', 'Sunleaf Passage'], ['Signal Relay', 'Tideglass Harbor'], ['Atlas Circuit', 'Starpetal Heights']] as const) {
  test(`practice ${format} on ${map}: solo role, full-bleed map, clue question, reveal, route board, no console errors`, async ({ page }) => {
    test.setTimeout(240_000); const errs: string[] = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.clock.install();
    await page.goto('/quiz/cr/practice'); await page.getByText(format, { exact: true }).first().click(); await page.getByText(map, { exact: true }).first().click();
    await page.getByTestId('cr-practice-go').click();
    await expect(page.getByTestId('cr-game')).toBeVisible(); await expect(page.getByText('Solo Pathfinder').first()).toBeVisible(); await shot(page, `${format.split(' ')[0]}-lobby`);
    await page.getByTestId('cr-practice-start').click();
    await page.clock.runFor(11_000);
    await expect(page.getByTestId('cr-game')).toHaveAttribute('data-phase', 'race');
    // the map is the screen: the canvas covers (nearly) the whole viewport, with at most two action buttons and one menu button
    const vp = page.viewportSize()!; const box = (await page.getByTestId('cr-canvas').boundingBox())!;
    expect((box.width * box.height) / (vp.width * vp.height)).toBeGreaterThan(0.8);
    expect(await page.getByTestId('cr-menu').count()).toBe(1);
    expect(await page.locator('.cr-actions button:visible').count()).toBeLessThanOrEqual(2);
    for (const b of await page.locator('.cr-actions button:visible').all()) { const bb = (await b.boundingBox())!; expect(bb.height).toBeGreaterThanOrEqual(56); expect(bb.width).toBeGreaterThanOrEqual(56); }
    await page.keyboard.down('ArrowRight'); await page.clock.runFor(1500); await page.keyboard.up('ArrowRight'); await page.clock.runFor(300);
    // the canvas really drew a scene (not a blank rectangle)
    const sample = () => page.getByTestId('cr-canvas').evaluate((c: HTMLCanvasElement) => { const g = c.getContext('2d')!; const d = g.getImageData(0, 0, c.width, c.height).data; const set = new Set<number>(); for (let i = 0; i < d.length; i += 4 * 97) set.add((d[i]! >> 4) * 256 + (d[i + 1]! >> 4) * 16 + (d[i + 2]! >> 4)); return set.size; });
    let colours = 0; for (let k = 0; k < 8 && colours <= 8; k++) { await page.clock.runFor(100); colours = await sample(); }
    expect(colours).toBeGreaterThan(8); await shot(page, `${format.split(' ')[0]}-race`);
    // the leg ends (auto-assist at worst) → checkpoint → the whole world freezes for the clue question
    await page.clock.runFor(95_000);
    await page.waitForSelector('[data-testid=cr-quiz]', { timeout: 20_000 }); await shot(page, `${format.split(' ')[0]}-quiz`);
    await page.locator('[data-testid=cr-quiz] input[type=radio], [data-testid=cr-quiz] [role=radio], [data-testid=cr-quiz] button').first().click({ timeout: 4000 }).catch(() => {});
    await page.getByRole('button', { name: /Submit answer/ }).click({ timeout: 4000 }).catch(() => {});
    await page.clock.runFor(2000);
    await page.waitForSelector('[data-testid=cr-reveal]', { timeout: 20_000 });
    await expect(page.getByTestId('cr-newclue')).toBeVisible(); await shot(page, `${format.split(' ')[0]}-reveal`);
    await page.clock.runFor(14_000);
    await page.waitForSelector('[data-testid=cr-board]', { timeout: 20_000 }); await shot(page, `${format.split(' ')[0]}-board`);
    if (format === 'Split-Route Sprint') await expect(page.locator('[data-option]').first()).toBeVisible();
    await expect(page.locator('[data-perk]').first()).toBeVisible();
    await page.clock.runFor(30_000);
    await expect(page.getByTestId('cr-game')).toHaveAttribute('data-phase', 'race');
    expect(await noHScroll(page)).toBe(true); expect(errs.filter((e) => !benign(e))).toEqual([]);
  });
}

test('menu opens the clue board and the settings dialog; reduced motion preference is honoured', async ({ page }) => {
  test.setTimeout(60_000); await page.clock.install(); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/quiz/cr/practice'); await page.getByTestId('cr-practice-go').click(); await page.getByTestId('cr-practice-start').click(); await page.clock.runFor(11_000);
  await page.getByTestId('cr-menu').click(); await page.getByRole('menuitem', { name: 'Display & sound' }).click(); await expect(page.getByRole('dialog', { name: 'Display and sound' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click(); await page.getByTestId('cr-menu').click(); await page.getByRole('menuitem', { name: 'Clue board' }).click(); await expect(page.getByTestId('cr-clues')).toBeVisible();
  await page.keyboard.press('Tab'); await shot(page, 'menu');
});
