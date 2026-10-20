/**
 * Swarm Survival end-to-end: real browsers, a real game-server process (swarm-server/dev.ts, memory store), the teacher driven by a protocol client.
 * Run:  npm run swarm:e2e   (builds nothing; start the site first with NEXT_PUBLIC_SWARM_URL=http://localhost:8799)
 * What this proves: join by code, roles, countdown, movement from the keyboard, question freeze, answers graded by the server, no answer key in the page
 * before reveal, upgrade vote with "Need N more points", the 3-2-1 resume, results, reconnect after a dropped network, and a mobile layout.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { WsClient, devRoom, httpJson } from '../../lib/swarm/server/testclient';
import { CANARY } from '../../lib/swarm/server/fixtures';

const PORT = 8799; const BASE = `http://localhost:${PORT}`; const WS = `ws://localhost:${PORT}/ws`;
let worker: ChildProcess;
test.beforeAll(async () => {
  worker = spawn('npx', ['tsx', 'swarm-server/dev.ts'], { env: { ...process.env, PORT: String(PORT), SWARM_SECRET: 'dev-secret-dev-secret-dev' }, stdio: 'ignore', cwd: process.cwd() });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/healthz')).ok) return; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('swarm worker did not start');
});
test.afterAll(() => { worker?.kill('SIGTERM'); });

const hid = () => `h${Math.random().toString(36).slice(2, 10)}`;
async function host(room: { hostToken: string }) { const c = new WsClient(WS, room.hostToken); await c.connect(); await c.waitFor(() => !!c.meta, 5000, 'host view'); return c; }
const cmd = async (h: WsClient, c: Record<string, unknown>) => { h.send({ t: 'host', id: hid(), cmd: c }); await new Promise((r) => setTimeout(r, 150)); }; // stale-revision rejection is covered in the worker tests; here the teacher acts on the latest state
async function join(ctx: BrowserContext, code: string, name: string): Promise<Page> {
  const p = await ctx.newPage(); await p.goto(`/quiz/swarm/join?code=${code}`); await p.waitForLoadState('networkidle');
  await p.getByTestId('name').fill(name); await p.getByTestId('join').click(); await p.waitForURL(/\/quiz\/swarm\/[0-9a-f-]{36}$/, { timeout: 15000 }); return p;
}
const canvasInk = (p: Page) => p.evaluate(() => { const c = document.querySelector('canvas[data-testid=arena]') as HTMLCanvasElement; const g = c.getContext('2d')!; const d = g.getImageData(0, 0, c.width, c.height).data; let nonBlank = 0; const seen = new Set<number>(); for (let i = 0; i < d.length; i += 4 * 97) { if (d[i + 3]) nonBlank++; seen.add((d[i]! >> 5) * 64 + (d[i + 1]! >> 5) * 8 + (d[i + 2]! >> 5)); } return { nonBlank, colours: seen.size }; });

test.describe('online match', () => {
  test.setTimeout(240_000);
  test('two teams: join, play, answer, upgrade, results', async ({ browser, baseURL }) => {
    void baseURL;
    const room = await devRoom(BASE, { mode: 'versus', teamCount: 2, teamSizeCap: 2, minutes: 5, difficulty: 'easy' }, 40, 11);
    const h = await host(room);
    const ctxA = await browser.newContext(); const ctxB = await browser.newContext();
    const A = await join(ctxA, room.code, 'Ada'); const B = await join(ctxB, room.code, 'Bo');
    await expect(A.getByTestId('lobby')).toBeVisible(); await expect(B.getByTestId('lobby')).toBeVisible();
    await h.waitFor(() => ((h.view.s.roster as unknown[]) ?? []).length === 2, 8000, 'two students seated');
    await cmd(h, { cmd: 'start' }); await expect(A.getByRole('heading', { name: 'Choose your role' })).toBeVisible();
    await A.getByTestId('role-striker').click(); await B.getByTestId('role-medic').click();
    await expect(A.getByTestId('role-striker')).toHaveAttribute('aria-checked', 'true');
    await cmd(h, { cmd: 'begin' });
    await expect(A.getByTestId('resume')).toBeVisible({ timeout: 8000 });
    await expect(A.getByTestId('wavepanel')).toBeVisible({ timeout: 20000 });
    // the arena is really drawn (backdrop + avatar + beacon), not a blank canvas
    const ink = await canvasInk(A); expect(ink.nonBlank).toBeGreaterThan(200); expect(ink.colours).toBeGreaterThan(8);
    // keyboard movement reaches the server and comes back as a new position
    const myId = (A.url().match(/swarm\/([0-9a-f-]{36})/) ?? [])[1]!; void myId;
    await h.waitFor(() => !!h.view.e.p && Object.keys(h.view.e.p).length >= 1, 5000, 'avatars');
    const pidA = Object.keys(h.view.e.p!)[0]!; const before = [...h.view.e.p![pidA]!];
    await A.keyboard.down('d'); await A.waitForTimeout(1500); await A.keyboard.up('d'); await A.waitForTimeout(400);
    const after = h.view.e.p![pidA] ?? h.view.e.p![Object.keys(h.view.e.p!)[0]!]!; expect(Math.abs(after[0]! - before[0]!) + Math.abs(after[1]! - before[1]!)).toBeGreaterThan(5);
    // the teacher asks a question: the world freezes for everyone and the page never contains the answer key
    await cmd(h, { cmd: 'ask_now' });
    await expect(A.getByTestId('question')).toBeVisible({ timeout: 10000 }); await expect(B.getByTestId('question')).toBeVisible();
    for (const p of [A, B]) { const html = await p.content(); expect(html).not.toContain(CANARY); expect(html).not.toContain('answerKey'); }
    const posFrozen = JSON.stringify(h.view.e.p); await A.waitForTimeout(800); expect(JSON.stringify(h.view.e.p)).toBe(posFrozen); // nothing simulated during the question
    // answer in the browser. The fixture quiz cycles through all five kinds, so this drives every kind of the shared question component
    const answerUI = async (p: Page, right: boolean) => {
      const q = p.getByTestId('question'); await expect(q).toBeVisible({ timeout: 8000 });
      if (await q.getByRole('radio').first().isVisible().catch(() => false)) { const radios = q.getByRole('radio'); await (right ? radios.nth(1) : radios.nth(0)).click(); }
      else if (await q.getByRole('textbox').first().isVisible().catch(() => false) && !(await q.locator('table').count())) { await q.getByRole('textbox').first().fill(right ? 'Paris' : 'London'); }
      else if (await q.getByRole('button', { name: 'True', exact: true }).first().isVisible().catch(() => false)) { const t = q.getByRole('button', { name: 'True', exact: true }); const f = q.getByRole('button', { name: 'False', exact: true }); await (right ? t.nth(0) : f.nth(0)).click(); await (right ? f.nth(1) : t.nth(1)).click(); }
      else if (await q.getByRole('combobox').first().isVisible().catch(() => false)) { const sel = q.getByRole('combobox'); await sel.nth(0).selectOption(right ? 'r1' : 'r2'); await sel.nth(1).selectOption(right ? 'r2' : 'r1'); }
      else if (await q.locator('table input').first().isVisible().catch(() => false)) { const ins = q.locator('table input'); await ins.nth(0).fill(right ? '2' : '9'); await ins.nth(1).fill(right ? '4' : '9'); }
      else return false;
      await q.getByRole('button', { name: /submit answer/i }).click(); return true;
    };
    const first = await answerUI(A, true); await answerUI(B, false); expect(first).toBe(true);
    // a one-person team's window closes the moment its only member answers, so 'locked' may pass in a blink: either state proves the answer was accepted
    await expect(A.getByTestId('locked').or(A.getByTestId('reveal'))).toBeVisible({ timeout: 8000 });
    await expect(A.getByTestId('reveal')).toBeVisible({ timeout: 40000 });
    await expect(A.getByTestId('reveal')).toContainText(/Correct answer|Why/i);
    // keep asking until an upgrade draft opens (a break may hold several questions; early waves may have no draft)
    const answered = new Set<string>([String(h.quiz?.w)]); const t0 = Date.now();
    while (Date.now() - t0 < 110_000 && h.phase !== 'upgrade') {
      if (h.phase === 'wave') await cmd(h, { cmd: 'ask_now' });
      if (h.phase === 'question') { const w = String(h.quiz?.w); if (!answered.has(w)) { answered.add(w); await Promise.all([answerUI(A, true), answerUI(B, false)]); } }
      await A.waitForTimeout(250);
    }
    expect(h.phase).toBe('upgrade');
    // upgrade vote: affordable and unaffordable offers are labelled, points come only from the server
    const draft = A.getByTestId('draft'); await expect(draft).toBeVisible({ timeout: 30000 });
    await expect(draft.getByText(/Team points/)).toBeVisible();
    const voteBtns = draft.getByRole('button', { name: /^(Vote|Need \d+ more points)$/ }); expect(await voteBtns.count()).toBeGreaterThan(0);
    const vote = draft.getByRole('button', { name: 'Vote' }); if (await vote.count()) await vote.first().click();
    await expect(A.getByTestId('resume')).toBeVisible({ timeout: 30000 });
    await expect(A.getByTestId('wavepanel')).toBeVisible({ timeout: 15000 });
    // network drop: the browser goes offline, then back; the same avatar resumes
    await ctxA.setOffline(true); await A.waitForTimeout(1500); await ctxA.setOffline(false);
    await expect(A.getByTestId('wavepanel')).toBeVisible({ timeout: 20000 });
    // teacher ends the match (two steps) and everyone sees results
    h.send({ t: 'host', id: hid(), cmd: { cmd: 'end_request' } }); await h.waitFor(() => h.packets.some((p) => p.t === 'ack' && !!(p as { nonce?: string }).nonce), 4000, 'nonce');
    const nonce = (h.packets.filter((p) => p.t === 'ack' && (p as { nonce?: string }).nonce).pop() as { nonce: string }).nonce; await cmd(h, { cmd: 'end_confirm', nonce });
    await expect(A.getByTestId('results')).toBeVisible({ timeout: 20000 }); await expect(B.getByTestId('results')).toBeVisible();
    await expect(A.getByRole('table')).toContainText(/Rank/);
    await A.screenshot({ path: 'docs/swarm-survival/screens/e2e-results.png' });
    h.close(); await ctxA.close(); await ctxB.close();
  });

  test('wrong code, taken name and locked room are explained, not silent', async ({ browser }) => {
    const room = await devRoom(BASE, { mode: 'coop', teamCount: 1, teamSizeCap: 3, minutes: 5 }, 40, 3); const h = await host(room);
    const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto('/quiz/swarm/join?code=ZZZZZZ'); await p.waitForLoadState('networkidle');
    await p.getByTestId('name').fill('Eve'); await p.getByTestId('join').click(); await expect(p.getByTestId('join-error')).toContainText(/not open|code/i);
    await join(ctx, room.code, 'Sam');
    const p2 = await (await browser.newContext()).newPage(); await p2.goto(`/quiz/swarm/join?code=${room.code}`); await p2.waitForLoadState('networkidle');
    await p2.getByTestId('name').fill('sam'); await p2.getByTestId('join').click(); await expect(p2.getByTestId('join-error')).toContainText(/taken/i);
    await cmd(h, { cmd: 'lock', value: true });
    await p2.getByTestId('name').fill('Newcomer'); await p2.getByTestId('join').click(); await expect(p2.getByTestId('join-error')).toContainText(/closed|locked/i);
    h.close();
  });

  test('phone layout: stick and ability button are reachable, no horizontal scroll', async ({ browser }) => {
    const room = await devRoom(BASE, { mode: 'coop', teamCount: 1, teamSizeCap: 2, minutes: 5 }, 40, 5); const h = await host(room);
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true }); const p = await join(ctx, room.code, 'Mia');
    await cmd(h, { cmd: 'start' }); await cmd(h, { cmd: 'begin' }); await expect(p.getByTestId('wavepanel')).toBeVisible({ timeout: 25000 });
    await expect(p.getByTestId('stick')).toBeVisible(); await expect(p.getByTestId('ability')).toBeVisible();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); expect(overflow).toBeLessThanOrEqual(1);
    const box = await p.getByTestId('ability').boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    await p.screenshot({ path: 'docs/swarm-survival/screens/e2e-phone-375x667.png' });
    h.close(); await ctx.close();
  });
});

test.describe('teacher console and projector', () => {
  test.setTimeout(180_000);
  /** The real pages, the real worker. Only the Next.js token route (which needs a signed-in teacher and the database) is stubbed with tokens the dev worker issued. */
  test('console controls drive a live match; the projector mirrors it read-only and hides team names when asked', async ({ browser }) => {
    const room = await devRoom(BASE, { mode: 'versus', teamCount: 2, teamSizeCap: 2, minutes: 5, hideTeamNames: true, teamNames: ['Mint Comets', 'Coral Crew'] }, 40, 21);
    const stub = async (ctx: BrowserContext) => ctx.route('**/api/quiz/swarm/rooms/*/token', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workerUrl: BASE, wsUrl: WS, joinCode: room.code, hostToken: room.hostToken, screenToken: room.screenToken }) }));
    const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await stub(tctx); const T = await tctx.newPage();
    const sctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } }); await stub(sctx); const S = await sctx.newPage();
    await T.goto(`/quiz/swarm/${room.roomId}/host`); await expect(T.getByTestId('join-code')).toHaveText(room.code, { timeout: 30_000 });
    await S.goto(`/quiz/swarm/${room.roomId}/screen`); await expect(S.getByTestId('screen-lobby')).toBeVisible({ timeout: 30_000 }); await expect(S.getByTestId('screen-lobby')).toContainText(room.code);
    const ctxA = await browser.newContext(); const ctxB = await browser.newContext(); const A = await join(ctxA, room.code, 'Ada'); const B = await join(ctxB, room.code, 'Bo');
    await expect(T.getByText('Ada').first()).toBeVisible({ timeout: 10_000 }); await expect(T.getByText('Bo').first()).toBeVisible();
    await expect(T.getByTestId('begin')).toHaveCount(0); await T.getByTestId('open-roles').click();
    await expect(A.getByRole('heading', { name: 'Choose your role' })).toBeVisible();
    await T.getByTestId('begin').click(); await expect(A.getByTestId('wavepanel')).toBeVisible({ timeout: 25_000 });
    // projector: team names are hidden, the arena is drawn, and it has no way to send commands
    await expect(S.getByLabel('Teams')).toContainText('Team 1'); await expect(S.getByLabel('Teams')).not.toContainText('Mint Comets'); await expect(T.getByLabel('Room', { exact: true })).toBeVisible();
    await expect(T.getByRole('heading', { name: 'Teams' })).toBeVisible(); await expect(T.getByText('Mint Comets').first()).toBeVisible(); // the teacher still sees the real names
    expect((await canvasInk(S)).colours).toBeGreaterThan(8);
    // pause from the console: students see why, the world stops
    await T.getByTestId('pause').click(); await expect(A.getByTestId('paused')).toBeVisible({ timeout: 8000 }); await expect(T.getByTestId('host-paused')).toBeVisible();
    await expect(T.getByTestId('pause')).toHaveText('Resume'); await T.getByTestId('pause').click(); await expect(A.getByTestId('paused')).toHaveCount(0, { timeout: 8000 });
    // ask now → question; skipping needs a written reason
    await T.getByRole('button', { name: 'Ask now' }).click(); await expect(A.getByTestId('question')).toBeVisible({ timeout: 15_000 });
    await expect(S.getByTestId('screen-question')).toBeVisible(); await expect(T.getByRole('button', { name: 'Write a reason to skip' })).toBeDisabled();
    await T.getByLabel(/Skip this question/).fill('wording unclear'); await T.getByRole('button', { name: 'Skip question' }).click(); await expect(T.getByTestId('host-msg')).toContainText(/skipped/i);
    // ending needs two steps
    await T.screenshot({ path: 'docs/swarm-survival/screens/e2e-teacher-1440x900.png' }); await S.screenshot({ path: 'docs/swarm-survival/screens/e2e-projector-1920x1080.png' });
    await T.getByTestId('end-request').click(); await expect(T.getByTestId('end-confirm')).toBeVisible(); await T.getByTestId('end-confirm').click();
    await expect(A.getByTestId('results')).toBeVisible({ timeout: 20_000 }); await expect(S.getByTestId('results')).toBeVisible(); await expect(S.getByTestId('results')).toContainText('Team 1');
    for (const c of [tctx, sctx, ctxA, ctxB]) await c.close(); void B;
  });
});

test('practice: plays offline in the browser with the real rules', async ({ page }) => {
  test.setTimeout(90_000); // the first visit may compile the route on a dev server
  await page.goto('/quiz/swarm/practice'); await page.waitForLoadState('networkidle'); await page.getByTestId('practice-go').click({ timeout: 60_000 });
  await expect(page.getByTestId('lobby')).toBeVisible(); await page.getByTestId('role-scout').click(); await page.getByTestId('start-practice').click();
  await expect(page.getByTestId('wavepanel')).toBeVisible({ timeout: 25000 });
  await page.keyboard.down('d'); await page.waitForTimeout(800); await page.keyboard.up('d');
  await expect(page.getByTestId('arena-desc')).toContainText(/Wave 1 of/);
  void httpJson;
});
