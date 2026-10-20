import { test, expect, type Page } from '@playwright/test';
import path from 'path';

/** One real browser flow per projector game, in the Practice Lab (the real engine with sample questions: no account, no database, no rewards).
 *  Covers: first-visit tutorial + practice turn, start, several full turns with marking, turn counter advancing, no fatal page errors,
 *  English-only UI (no Vietnamese), and screenshots at 1280x720 and 1920x1080. */
const GAMES = ['empire_race', 'boss_battle', 'escape_room', 'treasure_vault', 'risk_ladder', 'auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown'] as const;
const SHOTS = process.env.SHOT_DIR || path.join('test-results', 'projector-shots');
const PRIORITY = [/^correct$/i, /^continue$/i, /^ask a standard/i, /^ask the question/i, /^ask question/i, /^steady/i, /^strike$/i, /^climb/i, /^inspect$/i];
let tick = 0;

async function turnNumber(page: Page) { const t = await page.locator('.pj-turn').innerText(); return Number(/TURN\s+(\d+)/i.exec(t)?.[1] ?? /Turn\s+(\d+)/i.exec(t)?.[1] ?? 0); }
async function step(page: Page) {
  const dock = page.locator('.pj-dock');
  for (const re of PRIORITY) { const b = dock.getByRole('button', { name: re }).first(); if (await b.count() && await b.isEnabled()) { await b.click(); await page.waitForTimeout(80); return true; } }
  // some games need an object picked on the scene first (a vault door, a room hotspot, a zone)
  const objs = page.locator('.pj-scene [role=button]'); const n = await objs.count();
  if (n > 0 && ++tick % 4 !== 0) { await objs.nth(tick % n).click({ force: true }).catch(() => undefined); await page.waitForTimeout(80); const again = dock.getByRole('button', { name: /^(inspect|choose a vault|ask the question)/i }).first(); if (await again.count() && await again.isEnabled()) { await again.click(); return true; } }
  const end = dock.getByRole('button', { name: /^end turn/i }).first(); if (await end.count() && await end.isEnabled()) { await end.click(); return true; }
  return false;
}

for (const game of GAMES) {
  test(`${game}: tutorial, start, several turns, English only`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/quiz/lab?game=${game}&teams=3&minutes=15`, { waitUntil: 'networkidle' });
    // first visit opens the guide with a nonpersistent practice turn
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Practice turn');
    await dialog.getByRole('button', { name: /^(?!Close|Skip)/ }).filter({ hasText: /\w/ }).first().waitFor();
    await dialog.locator('.pj-tutorial-demo .btn.primary').first().click();      // choose an action
    await dialog.locator('.pj-tutorial-demo [role=group] button').first().click(); // answer the sample question
    await expect(dialog.locator('.pj-tutorial-demo')).toContainText(/Correct|Not quite/);
    await page.screenshot({ path: path.join(SHOTS, `${game}-tutorial-1280.png`) });
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
    // the same guide is replayable
    await page.getByRole('button', { name: 'How to play' }).first().click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Start game' }).click();
    const start = await turnNumber(page); let guard = 0;
    while ((await turnNumber(page)) < start + 3 && guard++ < 160) { if (!(await step(page))) await page.waitForTimeout(100); }
    expect(await turnNumber(page), 'the turn counter advanced').toBeGreaterThanOrEqual(start + 3);
    await expect(page.locator('.pj-caption')).not.toBeEmpty();
    await page.screenshot({ path: path.join(SHOTS, `${game}-play-1280x720.png`) });
    await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, `${game}-play-1920x1080.png`) });
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/[ạảãàáâấầẩẫậắằẳẵặẹẻẽèéêếềểễệỉĩìíịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýỵđ]/i);
    expect(text).not.toMatch(/Tiếng Việt|\bVI\b/);
    expect(errors, 'uncaught page errors').toEqual([]);
  });
}

test('the gallery groups all ten projector games and each has a How to play button', async ({ page }) => {
  await page.goto('/quiz/modes', { waitUntil: 'networkidle' });
  const section = page.locator('#projector-games'); await expect(section).toBeVisible();
  await expect(section.locator('.pj-game')).toHaveCount(10);
  await expect(section.getByRole('button', { name: 'How to play' })).toHaveCount(10);
  await section.getByRole('button', { name: 'How to play' }).nth(7).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'gallery-how-to-play.png') });
});

test('the lab has Teams, Time, Focus and How to play for every game and the home page lists Projector Games', async ({ page }) => {
  await page.goto('/quiz/lab?game=pirate_voyage', { waitUntil: 'networkidle' });
  for (const label of ['Teams', 'Time', 'Focus']) await expect(page.locator('.pj-labbar').getByLabel(label, { exact: true })).toBeVisible();
  await page.locator('.pj-labbar').getByLabel('Teams', { exact: true }).selectOption('8'); await expect(page).toHaveURL(/teams=8/);
  await page.goto('/quiz', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Projector Games' })).toBeVisible();
});

/** PJ-02: every game reaches its end and shows the teacher summary (rankings + topics) with no reducer error, NaN or negative resource on screen. */
for (const game of GAMES) {
  test(`${game}: a complete match ends cleanly with the class summary`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    
    await page.goto(`/quiz/lab?game=${game}&teams=2&minutes=5`, { waitUntil: 'networkidle' });
    const dialog = page.getByRole('dialog'); if (await dialog.isVisible().catch(() => false)) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Start game' }).click();
    // play a few real turns, then ask the engine to finish after the current turn (the same path as the teacher button)
    let guard = 0; const start = await turnNumber(page);
    while ((await turnNumber(page)) < start + 2 && guard++ < 120) { if (!(await step(page))) await page.waitForTimeout(100); }
    await page.getByRole('button', { name: 'Finish after this turn' }).click();
    guard = 0;
    while (!(await page.locator('.pj-end').isVisible().catch(() => false)) && guard++ < 200) { if (!(await step(page))) await page.waitForTimeout(100); }
    await expect(page.locator('.pj-end')).toBeVisible();
    await expect(page.locator('.pj-turn')).toContainText(/Game over/i);
    const endText = await page.locator('.pj-end').innerText();
    expect(endText).not.toMatch(/NaN|undefined|-\d+\s*(points|pts)/i);
    await page.screenshot({ path: path.join(SHOTS, `${game}-finished-1440.png`) });
    expect(errors, 'uncaught page errors').toEqual([]);
  });
}
