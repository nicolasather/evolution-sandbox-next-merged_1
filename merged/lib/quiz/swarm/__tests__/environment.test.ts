/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../supabase', () => ({ serviceDB: () => { throw new Error('no db in this test'); } }));
import { swarmEnv, requireSwarm, workerHealth } from '../server';

const KEYS = ['SWARM_SECRET', 'SWARM_URL', 'NEXT_PUBLIC_SWARM_URL', 'VERCEL_ENV', 'SWARM_DEV'] as const;
const saved: Record<string, string | undefined> = {};
const setEnv = (o: Partial<Record<(typeof KEYS)[number] | 'NODE_ENV', string>>) => { for (const k of [...KEYS, 'NODE_ENV'] as const) { if (k in o) (process.env as Record<string, string | undefined>)[k] = o[k]; else delete (process.env as Record<string, string | undefined>)[k]; } };
beforeEach(() => { for (const k of [...KEYS, 'NODE_ENV']) saved[k] = process.env[k]; });
afterEach(() => { for (const k of [...KEYS, 'NODE_ENV']) { if (saved[k] === undefined) delete (process.env as Record<string, string | undefined>)[k]; else (process.env as Record<string, string | undefined>)[k] = saved[k]; } });
const S32 = 's'.repeat(32);
const res = (status: number, body: unknown): Response => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('swarmEnv / requireSwarm', () => {
  it('a valid hosted configuration', () => {
    setEnv({ NODE_ENV: 'production', SWARM_SECRET: S32, NEXT_PUBLIC_SWARM_URL: 'https://w.example.com' });
    expect(swarmEnv()).toMatchObject({ secret: S32, url: 'https://w.example.com', problems: [] }); expect(requireSwarm()).toEqual({ secret: S32, url: 'https://w.example.com' });
  });
  it('SW-F02: a wss:// address is a configuration error with a helpful message, not a broken fetch', () => {
    setEnv({ NODE_ENV: 'production', SWARM_SECRET: S32, NEXT_PUBLIC_SWARM_URL: 'wss://w.example.com' });
    const e = swarmEnv(); expect(e.url).toBeUndefined(); expect(e.problems.join(' ')).toMatch(/https origin/);
    expect(() => requireSwarm()).toThrow(/misconfigured/);
  });
  it('SW-F04: a 20-character secret is refused in production on the Next side too, without echoing it', () => {
    const s20 = 'k'.repeat(20); setEnv({ NODE_ENV: 'production', SWARM_SECRET: s20, SWARM_URL: 'https://w.example.com' });
    const e = swarmEnv(); expect(e.secret).toBeUndefined(); expect(e.problems.join(' ')).toMatch(/at least 32/);
    try { requireSwarm(); throw new Error('should throw'); } catch (err) { expect((err as { status?: number }).status).toBe(503); expect(String((err as Error).message)).not.toContain(s20); }
  });
  it('a short fixture secret works only in a flagged dev/test run', () => {
    setEnv({ NODE_ENV: 'test', SWARM_SECRET: 'dev-secret-dev-secret-dev', SWARM_URL: 'http://localhost:8787' }); expect(requireSwarm().url).toBe('http://localhost:8787');
    setEnv({ NODE_ENV: 'production', SWARM_DEV: '1', SWARM_SECRET: 'dev-secret-dev-secret-dev', SWARM_URL: 'http://localhost:8787' }); expect(swarmEnv().secret).toBeTruthy();
    setEnv({ NODE_ENV: 'production', SWARM_DEV: '1', VERCEL_ENV: 'production', SWARM_SECRET: 'dev-secret-dev-secret-dev', SWARM_URL: 'https://w.example.com' }); expect(swarmEnv().secret).toBeUndefined();
  });
  it('unset configuration', () => { setEnv({ NODE_ENV: 'production' }); expect(() => requireSwarm()).toThrow(/needs its game server/); });
});

describe('SW-08 worker readiness (SW-F12, SW-F13)', () => {
  let t = 0; const now = () => (t += 10_000);
  beforeEach(() => setEnv({ NODE_ENV: 'production', SWARM_SECRET: S32, SWARM_URL: 'https://health.example.com' }));
  it('ok: healthy worker with the matching protocol; asks /healthz over the https origin', async () => {
    const f = jest.fn(async () => res(200, { ok: true, protocol: 'ss/1', worker: 'w' })); const h = await workerHealth(f as never, now);
    expect(h.status).toBe('ok'); expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://health.example.com/healthz');
  });
  it('offline, 503, bad JSON, not-ok body and protocol mismatch are told apart and never leak raw errors', async () => {
    expect((await workerHealth((async () => { throw new Error('ECONNREFUSED 10.0.0.5:443 secret-host'); }) as never, now))).toEqual({ status: 'offline', message: expect.not.stringMatching(/10\.0\.0\.5|ECONNREFUSED/) });
    expect((await workerHealth((async () => res(503, {})) as never, now)).status).toBe('unhealthy');
    expect((await workerHealth((async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }) as unknown as Response) as never, now)).status).toBe('unhealthy');
    expect((await workerHealth((async () => res(200, { ok: false })) as never, now)).status).toBe('unhealthy');
    expect((await workerHealth((async () => res(200, { ok: true, protocol: 'ss/0' })) as never, now)).status).toBe('protocol_mismatch');
  });
  it('misconfigured and unconfigured states', async () => {
    setEnv({ NODE_ENV: 'production', SWARM_SECRET: S32, SWARM_URL: 'wss://x.example.com' }); expect((await workerHealth((async () => res(200, {})) as never, now)).status).toBe('misconfigured');
    setEnv({ NODE_ENV: 'production' }); expect((await workerHealth((async () => res(200, {})) as never, now)).status).toBe('unconfigured');
  });
  it('is cached for a few seconds so a re-rendering setup page does not hammer the worker', async () => {
    setEnv({ NODE_ENV: 'production', SWARM_SECRET: S32, SWARM_URL: 'https://cache.example.com' }); const clock = 1_000_000; const f = jest.fn(async () => res(200, { ok: true, protocol: 'ss/1' }));
    await workerHealth(f as never, () => clock); await workerHealth(f as never, () => clock + 1000); expect(f).toHaveBeenCalledTimes(1);
    await workerHealth(f as never, () => clock + 6000); expect(f).toHaveBeenCalledTimes(2);
  });
});
