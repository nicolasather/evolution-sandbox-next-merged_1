import { expect, test, type Page } from '@playwright/test';
import { ROOM, SEAT, build, snapshot, type Scene } from './os-fixtures';
import { applyBatch, type Ctx } from '@/lib/quiz/os/physics';
import type { Body } from '@/lib/quiz/os/domain';

/** Obstacle Survival UI, against engine-built snapshots served through route mocks (no database, no hosted server).
 *  It proves the screens render every phase for the student, teacher and projector at the required widths, that the keyboard and touch controls send
 *  contiguous input batches, and that there is no horizontal scroll or console error. It does NOT prove the hosted deployment. */
const SHOTS = process.env.OS_SHOTS_DIR; const WIDTHS: [string, number, number][] = [['360', 360, 780], ['390', 390, 844], ['768', 768, 1024], ['1280', 1280, 720], ['1440', 1440, 900], ['1920', 1920, 1080]];
async function shot(p: Page, name: string) { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); }
const noHScroll = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function serve(page: Page, scene: Scene, view: 'student' | 'host' | 'projector', o: Parameters<typeof build>[0] = {}) {
  const b = build(o); const posts: { fromTick: number; samples: { dx: number; dy: number; hop: boolean }[] }[] = [];
  // a miniature server: it keeps the student's body and advances it with the SAME applyBatch the real server uses, so rejected or gapped batches would show up here
  const first = snapshot(b, scene, view, view === 'student' ? SEAT : null); let body: Body | null = first.body as Body | null; const t0 = Date.now(); const base = first.world.tick;
  const wt = () => base + Math.floor((Date.now() - t0) / 50);
  const ctx = (): Ctx => ({ idx: b.idx, role: 'trailblazer', perks: {}, pulses: [], limits: first.limits.map((v: number) => (v < 0 ? Infinity : v)), chapterTicks: first.chapterTicks, seatId: SEAT });
  await page.route(`**/api/quiz/os/rooms/${ROOM}/state*`, (r) => { const s = snapshot(b, scene, view, view === 'student' ? SEAT : null); const live = scene === 'traversing'; r.fulfill({ json: live ? { ...s, serverNow: Date.now(), world: { ...s.world, tick: wt(), running: true }, body } : s }); });
  await page.route(`**/api/quiz/os/rooms/${ROOM}/input`, async (r) => {
    const j = r.request().postDataJSON(); posts.push(j); const res = body ? applyBatch(body, j.fromTick, j.samples, ctx(), wt() + 6) : null;
    if (!res || !res.ok) { await r.fulfill({ status: 400, json: { error: res && !res.ok ? res.message : 'no seat', code: res && !res.ok ? res.code : 'X' } }); return; }
    body = res.state.body; await r.fulfill({ json: { ok: true, tick: body.tick, accepted: j.samples.length, denied: res.state.out.denied, hits: body.hits, revision: 1, replayed: false } });
  });
  await page.route(`**/api/quiz/os/rooms/${ROOM}/action`, (r) => r.fulfill({ json: { ok: true, revision: 2, replayed: false, state: snapshot(b, scene, view, SEAT) } }));
  await page.route(`**/api/quiz/os/rooms/${ROOM}/answer`, (r) => r.fulfill({ json: { accepted: true, private: true } }));
  await page.route(`**/api/quiz/os/rooms/${ROOM}/results*`, (r) => r.fulfill({ json: { results: [], review: [{ position: 0, kind: 'answer_forge', prompt: 'What is 7 × 8?', answered: 4, correct: 3, partial: 0, wrong: 1, avgPct: 75, explanation: '7 × 8 = 56.' }], finish: null } }));
  return { posts, b };
}
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('qz:os:coach', '1'); } catch { /* ignore */ } }); });

test('hub, modes card, join and practice entry points', async ({ page }) => {
  await page.goto('/quiz/os'); await expect(page.getByRole('heading', { level: 1, name: 'Obstacle Survival' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practice alone' })).toHaveAttribute('href', '/quiz/os/practice');
  await page.goto('/quiz/modes'); await expect(page.locator('#obstacle-survival').getByRole('link', { name: 'Pick a quiz' })).toHaveAttribute('href', '/quiz/library?mode=online&game=obstacle_survival');
  await page.goto('/quiz/os/join?code=ab12'); const btn = page.getByRole('button', { name: 'Join the match' }); await expect(btn).toBeDisabled();
  await page.getByLabel('Room code').fill('ABC123'); await page.getByLabel('Your name').fill('Sam'); await expect(btn).toBeEnabled();
  await page.goto('/quiz/os/00000000-0000-4000-8000-000000000000/screen'); await expect(page.getByRole('heading', { name: 'Projector link needed' })).toBeVisible();
});

for (const [name, w, h] of WIDTHS) {
  test(`student screens at ${name}px`, async ({ page }) => {
    test.setTimeout(90_000); const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); await page.setViewportSize({ width: w, height: h });
    for (const scene of ['lobby', 'preview', 'traversing', 'barrier', 'reveal', 'build_choice', 'countdown', 'finished'] as Scene[]) {
      await page.unroute(`**/api/quiz/os/rooms/${ROOM}/state*`).catch(() => undefined); await serve(page, scene, 'student');
      await page.goto(`/quiz/os/${ROOM}`); await page.waitForSelector(`[data-testid="os-game"], [data-testid="os-results"]`, { timeout: 20_000 }); await page.waitForTimeout(500);
      expect(await noHScroll(page), `no horizontal scroll in ${scene}`).toBe(true);
      if (scene === 'lobby') await expect(page.getByTestId('os-lobby')).toBeVisible(); if (scene === 'barrier') await expect(page.getByTestId('os-barrier')).toBeVisible();
      if (scene === 'reveal') await expect(page.getByTestId('os-reveal')).toBeVisible(); if (scene === 'build_choice') await expect(page.getByTestId('os-shop')).toBeVisible(); if (scene === 'finished') await expect(page.getByTestId('os-results')).toBeVisible();
      await shot(page, `student-${scene}-${name}`);
    }
    expect(errors).toEqual([]);
  });
}
test('teacher console and projector render at 1440 and 360', async ({ page }) => {
  for (const [w, h] of [[1440, 900], [360, 780]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const scene of ['lobby', 'traversing', 'barrier', 'finished'] as Scene[]) {
      await page.unroute(`**/api/quiz/os/rooms/${ROOM}/state*`).catch(() => undefined); await serve(page, scene, 'host', { format: 'relay_race', squads: 3, players: 6 });
      await page.goto(`/quiz/os/${ROOM}/host`); await page.waitForSelector('.os-host, [data-testid="os-results"]', { timeout: 20_000 }); await page.waitForTimeout(400);
      expect(await noHScroll(page)).toBe(true); await shot(page, `host-${scene}-${w}`);
    }
    for (const scene of ['lobby', 'traversing', 'barrier'] as Scene[]) {
      await page.unroute(`**/api/quiz/os/rooms/${ROOM}/state*`).catch(() => undefined); await serve(page, scene, 'projector', { format: 'relay_race', squads: 3, players: 6 });
      await page.goto(`/quiz/os/${ROOM}/screen#k=abcdefgh12345678`); await page.waitForSelector('[data-testid="os-screen"]', { timeout: 20_000 }); await page.waitForTimeout(400);
      await expect(page.locator('body')).not.toContainText('Ada'); // the projector never shows student names
      await shot(page, `projector-${scene}-${w}`);
    }
  }
});
test('keyboard movement sends contiguous input batches; hop and ability are one-shot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); const { posts } = await serve(page, 'traversing', 'student'); await page.goto(`/quiz/os/${ROOM}`); await page.waitForSelector('[data-testid="os-canvas"]');
  await page.waitForTimeout(600); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.press('Space'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(500);
  expect(posts.length).toBeGreaterThan(2); let expected = posts[0].fromTick;
  for (const b of posts) { expect(b.fromTick).toBe(expected); expected += b.samples.length; expect(b.samples.length).toBeLessThanOrEqual(48); } // contiguous, none rejected by the mini-server
  const all = posts.flatMap((b) => b.samples); expect(all.some((s) => s.dx === 1)).toBe(true); expect(all.filter((s) => s.hop).length).toBe(1);
});
test('touch controls appear on a phone and the pad moves the runner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const { posts } = await serve(page, 'traversing', 'student'); await page.goto(`/quiz/os/${ROOM}`); await page.waitForSelector('.os-pad');
  const pad = await page.locator('.os-pad').boundingBox(); expect(pad!.width).toBeGreaterThanOrEqual(100); for (const sel of ['.os-control.hop', '.os-control.ability']) { const bb = await page.locator(sel).boundingBox(); expect(bb!.width).toBeGreaterThanOrEqual(44); expect(bb!.height).toBeGreaterThanOrEqual(44); }
  await page.locator('.os-pad').scrollIntoViewIfNeeded(); const pad2 = (await page.locator('.os-pad').boundingBox())!; await page.mouse.move(pad2.x + pad2.width / 2, pad2.y + pad2.height / 2); await page.mouse.down(); await page.mouse.move(pad2.x + pad2.width - 8, pad2.y + pad2.height / 2, { steps: 4 }); await page.waitForTimeout(800); await page.mouse.up(); await page.waitForTimeout(400);
  const seen = posts.flatMap((b) => b.samples); expect(seen.some((s) => s.dx === 1 && s.dy === 0), `samples: ${JSON.stringify(seen.slice(0, 12))}`).toBe(true);
});
test('practice runs on its own: movement, and every hazard guide is reachable by keyboard', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); await page.goto('/quiz/os/practice'); await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.getByTestId('os-canvas')).toBeVisible(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
  await page.getByText('Hazard guide (12)').first().click(); await expect(page.locator('.os-legend li')).toHaveCount(12); expect(errors).toEqual([]);
});
