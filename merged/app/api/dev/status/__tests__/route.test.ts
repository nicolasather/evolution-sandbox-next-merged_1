/** @jest-environment node */
import { GET } from '../route';

const KEYS = ['ENABLE_DEV_TOOLS', 'VERCEL_ENV'] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => KEYS.forEach(k => { saved[k] = process.env[k]; delete process.env[k]; }));
afterEach(() => KEYS.forEach(k => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }));

describe('GET /api/dev/status', () => {
  it('404 by default', async () => {
    const r = GET(); expect(r.status).toBe(404); expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it('404 on production even if the flag is set by mistake', () => {
    process.env.ENABLE_DEV_TOOLS = 'true'; process.env.VERCEL_ENV = 'production';
    expect(GET().status).toBe(404);
  });
  it('404 when the flag is not exactly "true"', () => {
    process.env.ENABLE_DEV_TOOLS = '1'; process.env.VERCEL_ENV = 'preview';
    expect(GET().status).toBe(404);
  });
  it('200 on a preview with the flag', async () => {
    process.env.ENABLE_DEV_TOOLS = 'true'; process.env.VERCEL_ENV = 'preview';
    const r = GET(); expect(r.status).toBe(200);
    expect((await r.json()).enabled).toBe(true);
  });
});
