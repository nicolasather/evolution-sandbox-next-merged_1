/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles are deliberately partial */
import { siteUrl } from '@/lib/site';

describe('siteUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete (process.env as any).NEXT_PUBLIC_SITE_URL;
    delete (process.env as any).VERCEL_PROJECT_PRODUCTION_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns localhost by default', () => {
    expect(siteUrl()).toMatch(/^http:\/\/localhost/);
  });

  it('respects NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/';
    expect(siteUrl()).toBe('https://example.com');
  });
});
