/** @jest-environment node */
import { gateFor, hostOk, sameOriginMutation } from '../server';

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe('lab request guards', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('gateFor is closed by default and open only with both flags on a loopback host', () => {
    delete process.env.VISUAL_LAB; delete process.env.ENABLE_DEV_TOOLS;
    expect(gateFor(h({ host: 'localhost:3000' })).open).toBe(false);
    Object.assign(process.env, { VISUAL_LAB: 'true', ENABLE_DEV_TOOLS: 'true', NODE_ENV: 'development' });
    delete process.env.VERCEL; delete process.env.VERCEL_ENV;
    expect(gateFor(h({ host: 'localhost:3000' })).open).toBe(true);
    expect(gateFor(h({ host: 'my-beta.vercel.app' })).open).toBe(false);
  });

  it('mutations need the custom header AND a same-origin loopback Origin', () => {
    const good = { host: 'localhost:3000', origin: 'http://localhost:3000', 'x-visual-lab': '1' };
    expect(sameOriginMutation(h(good))).toBe(true);
    expect(sameOriginMutation(h({ ...good, 'x-visual-lab': '' }))).toBe(false);
    expect(sameOriginMutation(h({ host: 'localhost:3000', 'x-visual-lab': '1' }))).toBe(false);
    expect(sameOriginMutation(h({ ...good, origin: 'https://evil.example' }))).toBe(false);
    expect(sameOriginMutation(h({ ...good, origin: 'http://localhost:4000' }))).toBe(false);
    expect(sameOriginMutation(h({ ...good, origin: 'null' }))).toBe(false);
  });

  it('hostOk accepts loopback only', () => {
    expect(hostOk(h({ host: '127.0.0.1:3000' }))).toBe(true);
    expect(hostOk(h({ host: 'example.com' }))).toBe(false);
  });
});
