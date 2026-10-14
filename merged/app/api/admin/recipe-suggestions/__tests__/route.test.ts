/** @jest-environment node */
const TOKEN = 'owner-token-xyz';
const post = (POST: (r: Request) => Promise<Response>, body: unknown, token: string | null = TOKEN) =>
  POST(new Request('http://localhost/api/admin/recipe-suggestions', {
    method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));

function load(env: Record<string, string | undefined>) {
  jest.resetModules();
  for (const k of ['ENABLE_DEV_TOOLS', 'OWNER_REVIEW_TOKEN', 'VERCEL_ENV', 'ALT_AI_URL', 'ALT_AI_KEY', 'ALT_AI_MODEL', 'ALT_AI_RPM', 'ALT_AI_HOURLY']) delete process.env[k];
  Object.assign(process.env, env);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../route') as { POST: (r: Request) => Promise<Response> };
}
const ownerEnv = { ENABLE_DEV_TOOLS: 'true', OWNER_REVIEW_TOKEN: TOKEN };

describe('POST /api/admin/recipe-suggestions', () => {
  afterAll(() => { for (const k of Object.keys(ownerEnv)) delete process.env[k]; });

  it('behaves as if it does not exist when the dev gate is closed', async () => {
    const { POST } = load({ OWNER_REVIEW_TOKEN: TOKEN });
    const r = await post(POST, { targetId: 'axe' });
    expect(r.status).toBe(404); expect(await r.text()).toBe('');
  });
  it('is closed on production even with everything configured', async () => {
    const { POST } = load({ ...ownerEnv, VERCEL_ENV: 'production' });
    expect((await post(POST, { targetId: 'axe' })).status).toBe(404);
  });
  it('401 for a missing or wrong token', async () => {
    const { POST } = load(ownerEnv);
    expect((await post(POST, { targetId: 'axe' }, null)).status).toBe(401);
    expect((await post(POST, { targetId: 'axe' }, 'nope')).status).toBe(401);
  });
  it('valid owner, no AI configured ⇒ 200, outcome none, status none_configured, never cached', async () => {
    const { POST } = load(ownerEnv);
    const r = await post(POST, { targetId: 'axe' });
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('no-store');
    const j = await r.json(); expect(j.outcome).toBe('none'); expect(j.providerStatus).toBe('none_configured');
  });
  it('400 for bad json / missing id, 413 for an oversized body, 404 for an unknown target', async () => {
    const { POST } = load(ownerEnv);
    expect((await post(POST, '{oops')).status).toBe(400);
    expect((await post(POST, {})).status).toBe(400);
    expect((await post(POST, 'x'.repeat(9000))).status).toBe(413);
    expect((await post(POST, { targetId: 'no_such_item_zz' })).status).toBe(404);
  });
  it('rate-limits with 429 + Retry-After once the per-minute budget is spent', async () => {
    const { POST } = load({ ...ownerEnv, ALT_AI_RPM: '2' });
    expect((await post(POST, { targetId: 'axe' })).status).toBe(200);
    expect((await post(POST, { targetId: 'axe' })).status).toBe(200);
    const r = await post(POST, { targetId: 'axe' });
    expect(r.status).toBe(429); expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
  });
  it('an unauthorised caller cannot burn the AI budget', async () => {
    const { POST } = load({ ...ownerEnv, ALT_AI_RPM: '1' });
    for (let i = 0; i < 5; i++) await post(POST, { targetId: 'axe' }, 'wrong');
    expect((await post(POST, { targetId: 'axe' })).status).toBe(200);
  });
  it('the API key never appears in any response', async () => {
    const { POST } = load({ ...ownerEnv, ALT_AI_URL: 'https://127.0.0.1:1/x', ALT_AI_KEY: 'LEAKME-SECRET', ALT_AI_MODEL: 'm', ALT_AI_RPM: '5' });
    const r = await post(POST, { targetId: 'axe' });
    expect(JSON.stringify([r.status, await r.text(), [...r.headers.entries()]])).not.toMatch(/LEAKME/);
  }, 30000);
});
