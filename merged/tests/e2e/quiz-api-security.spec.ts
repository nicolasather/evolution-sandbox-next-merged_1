import { test, expect, type APIResponse } from '@playwright/test';

/** These checks need a configured Supabase backend. Against an unconfigured server (HTTP 503 "not configured") they are BLOCKED, never passed. */
function blockedWhenUnconfigured(res: APIResponse) { test.skip(res.status() === 503, 'BLOCKED: this server has no Supabase configuration, so the API cannot be exercised.'); }

/** Public READ-ONLY checks; safe on staging and public deployment. No user data changes. */
const fakeId = '00000000-0000-4000-8000-000000000000';

test('public listing never exposes answer keys', async ({ request }) => {
  const res = await request.get('/api/quiz/quizzes');
  blockedWhenUnconfigured(res);
  expect(res.status()).toBe(200);
  const payload = await res.json();
  expect(payload).toBeTruthy();
  // Do NOT scan description or arbitrary user content for English words;
  // inspect structured keys recursively to avoid false positives.
  const suspiciousPaths: string[] = [];
  const seen = new WeakSet<object>();
  function walk(value: unknown, pointer = '$') {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(answerKey|answer_key|correctIds|correct_ids)$/i.test(k)) suspiciousPaths.push(`${pointer}.${k}`);
      walk(v, `${pointer}.${k}`);
    }
  }
  walk(payload);
  expect(suspiciousPaths).toEqual([]);
});

test('anonymous visitor cannot read an arbitrary private draft', async ({ request }) => {
  const res = await request.get(`/api/quiz/quizzes/${fakeId}`);
  blockedWhenUnconfigured(res);
  expect([401, 403, 404]).toContain(res.status());
  const body = await res.text();
  expect(body).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service_role.*eyJ/i);
});

test('arbitrary room id does not reveal player/host state', async ({ request }) => {
  const res = await request.get(`/api/quiz/rooms/${fakeId}/state`);
  blockedWhenUnconfigured(res);
  expect([400, 401, 403, 404]).toContain(res.status());
  const body = await res.text();
  expect(body).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service_role.*eyJ/i);
});

test('quiz route does not redirect guest creator to email login', async ({ request }) => {
  const res = await request.get('/quiz/new', { maxRedirects: 0 });
  expect(res.status()).toBeLessThan(400);
  expect(res.headers().location || '').not.toContain('/quiz/login');
});

/* ── Media access (matrix M02–M04, M16): read-only, no data created ─────────────────────────────────────────────────── */
const guessed = 'quiz-media/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000001.png';
test('an unauthenticated visitor guessing a media path learns nothing (same answer as a missing file)', async ({ request }) => {
  const a = await request.get(`/api/quiz/media?path=${encodeURIComponent(guessed)}`);
  blockedWhenUnconfigured(a);
  expect(a.status()).toBe(404);
  const b = await request.get(`/api/quiz/media?path=${encodeURIComponent(guessed.replace('0001.png', '0002.png'))}`);
  expect(await a.text()).toBe(await b.text());
});
test('malformed, traversal and external media paths are rejected before any lookup', async ({ request }) => {
  for (const bad of ['', '../../etc/passwd', 'https://evil.example/x.png', 'quiz-media/a/b.svg']) {
    const r = await request.get(`/api/quiz/media?path=${encodeURIComponent(bad)}`);
    blockedWhenUnconfigured(r);
    expect(r.status()).toBe(400);
  }
});
test('uploading requires a signed-in session', async ({ request }) => {
  const r = await request.post('/api/quiz/media', { data: { action: 'init', size: 100, ext: 'png' } });
  blockedWhenUnconfigured(r);
  expect([401, 403]).toContain(r.status());
});
test('the private bucket is not publicly readable by URL guessing (M16)', async ({ request }) => {
  const base = process.env.SUPABASE_URL_FOR_TESTS;
  test.skip(!base, 'BLOCKED: set SUPABASE_URL_FOR_TESTS to the staging project URL (no key needed) to run this check.');
  const r = await request.get(`${base}/storage/v1/object/public/quiz-media/${guessed.slice('quiz-media/'.length)}`);
  expect([400, 401, 403, 404]).toContain(r.status());
});
