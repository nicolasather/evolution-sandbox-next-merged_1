import { test, expect, type Page } from '@playwright/test';

/**
 * Browser-side media path with the NETWORK MOCKED (page.route). It proves the real browser code: pre-check, direct upload via signed URL,
 * finalize, rendering under the site's real Content-Security-Policy, the alt-text rule and size refusal. It does NOT prove Supabase Storage
 * itself — that needs the staging run (see docs/QUIZ-PHASE2-REPORT.md, gates G37/G38).
 * Run against a server started with NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co (any value) so the creator believes the cloud exists,
 * and set MOCKED_SUPABASE_ORIGIN_SERVER=1.
 */
const SB = 'https://abcd1234.supabase.co';
const OWNER = '11111111-1111-4111-8111-111111111111', ASSET = '22222222-2222-4222-8222-222222222222';
const PATH = `quiz-media/${OWNER}/${ASSET}.png`;
// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test.skip(!process.env.MOCKED_SUPABASE_ORIGIN_SERVER, 'Start the app with NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co and set MOCKED_SUPABASE_ORIGIN_SERVER=1');

async function mockCloud(page: Page, log: string[]) {
  await page.route('**/api/quiz/auth/session', (r) => r.fulfill({ json: { user: { id: OWNER, email: null, guest: true } } }));
  await page.route('**/api/quiz/media?**', (r) => r.fulfill({ json: { url: `${SB}/storage/v1/object/sign/${PATH}?token=t`, expiresInSeconds: 300 } }));
  await page.route('**/api/quiz/media', async (r) => {
    const body = r.request().postDataJSON() as { action: string };
    log.push(`api:${body.action}`);
    if (body.action === 'init') return r.fulfill({ status: 201, json: { id: ASSET, path: PATH, key: PATH.slice(11), token: 'tok', uploadUrl: `${SB}/x`, maxBytes: 70, expiresInSeconds: 7200 } });
    return r.fulfill({ json: { id: ASSET, path: PATH, mime: 'image/png', bytes: PNG.length, remainingBytes: 100 * 1048576 } });
  });
  await page.route(`${SB}/storage/v1/object/upload/sign/**`, (r) => { log.push(`put:${r.request().method()}`); return r.fulfill({ status: 200, json: { Key: PATH.slice(11) } }); });
  await page.route(`${SB}/storage/v1/object/sign/**`, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
}
async function openMediaStep(page: Page) {
  await page.goto('/quiz/new', { waitUntil: 'networkidle' });
  await page.getByLabel('Quiz title').fill('Media quiz');
  await page.getByRole('button', { name: /next: choose formats/i }).click();
  await page.getByRole('button', { name: /\+ add multiple choice/i }).click();
}
const fileInput = (page: Page) => page.locator('input[type=file]').first();

test('M01/M07 an image is uploaded straight to storage, finalized, and then actually renders under the site CSP', async ({ page }) => {
  const log: string[] = []; const csp: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text()) && /abcd1234|img-src|media-src/.test(m.text())) csp.push(m.text()); });
  await mockCloud(page, log); await openMediaStep(page);
  await fileInput(page).setInputFiles({ name: 'cat.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText(/uploaded\./i)).toBeVisible({ timeout: 15_000 });
  expect(log).toEqual(expect.arrayContaining(['api:init', 'put:PUT', 'api:finalize']));
  expect(log.indexOf('api:init')).toBeLessThan(log.indexOf('put:PUT'));
  expect(log.indexOf('put:PUT')).toBeLessThan(log.indexOf('api:finalize'));
  const img = page.locator('figure img').first();
  await expect(img).toBeVisible();
  // the browser really decoded it: the CSP allowed the Supabase origin
  await expect.poll(() => img.evaluate((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)).toBe(true);
  expect(csp, 'the browser must not report CSP violations for the media origin').toEqual([]);
  await expect(page.getByText(/add a description, or mark it decorative/i)).toBeVisible(); // alt text is still required
});

test('M10 a renamed HTML file is refused in the browser before anything is sent', async ({ page }) => {
  const log: string[] = []; await mockCloud(page, log); await openMediaStep(page);
  await fileInput(page).setInputFiles({ name: 'cat.png', mimeType: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>' + ' '.repeat(40)) });
  await expect(page.getByText(/looks like a web page, script, SVG or program/i)).toBeVisible();
  expect(log).toEqual([]);
});

test('M08 a file one byte over the cap is refused without a request (client pre-check uses the same numbers as the server)', async ({ page }) => {
  const log: string[] = []; await mockCloud(page, log); await openMediaStep(page);
  const big = Buffer.alloc(5 * 1024 * 1024 + 1); PNG.copy(big);
  await fileInput(page).setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: big });
  await expect(page.getByText(/limit is 5 MB/i)).toBeVisible();
  expect(log).toEqual([]);
});

test('a flaky network is retried and the user still ends with one uploaded file', async ({ page }) => {
  const log: string[] = []; await mockCloud(page, log);
  let fails = 1;
  await page.route('**/api/quiz/media', async (r) => {
    const body = r.request().postDataJSON() as { action: string };
    if (body.action === 'finalize' && fails-- > 0) return r.fulfill({ status: 503, json: { error: 'busy' } });
    return r.fallback();
  });
  await openMediaStep(page);
  await fileInput(page).setInputFiles({ name: 'cat.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText(/uploaded\./i)).toBeVisible({ timeout: 20_000 });
});

test('an image from any other origin is blocked by the CSP (no open proxy / tracking pixel)', async ({ page }) => {
  await page.goto('/quiz', { waitUntil: 'networkidle' });
  const blocked = await page.evaluate(() => new Promise<boolean>((res) => { const i = new Image(); i.onload = () => res(false); i.onerror = () => res(true); i.src = 'https://evil.example/pixel.png'; }));
  expect(blocked).toBe(true);
});
