import { checkSecret, isProductionRuntime, parseWorkerHttpOrigin, workerWsUrl, workerJoinUrl, WorkerUrlError, SECRET_MIN_PRODUCTION } from '../config';
import { swarmUrl, swarmUrlProblem, wsUrlOf } from '../client/urls';

describe('SW-01 canonical worker origin (SW-F01..F03)', () => {
  it('accepts an https origin and derives wss only for the socket', () => {
    expect(parseWorkerHttpOrigin('https://swarm.example.com')).toBe('https://swarm.example.com');
    expect(parseWorkerHttpOrigin('  https://swarm.example.com/  ')).toBe('https://swarm.example.com');
    expect(workerJoinUrl('https://swarm.example.com')).toBe('https://swarm.example.com/join');
    expect(workerWsUrl('https://swarm.example.com')).toBe('wss://swarm.example.com/ws');
    expect(wsUrlOf('https://swarm.example.com:8443')).toBe('wss://swarm.example.com:8443/ws');
  });
  it('allows plain http only for a loopback development worker', () => {
    expect(parseWorkerHttpOrigin('http://localhost:8787')).toBe('http://localhost:8787');
    expect(parseWorkerHttpOrigin('http://127.0.0.1:8799')).toBe('http://127.0.0.1:8799');
    expect(workerWsUrl('http://localhost:8787')).toBe('ws://localhost:8787/ws');
    expect(() => parseWorkerHttpOrigin('http://swarm.example.com')).toThrow(/https/);
  });
  it('never lets a wss:// or ws:// value reach fetch()', () => {
    for (const bad of ['wss://swarm.example.com', 'ws://localhost:8787']) expect(() => parseWorkerHttpOrigin(bad)).toThrow(WorkerUrlError);
    expect(() => parseWorkerHttpOrigin('wss://swarm.example.com')).toThrow(/not wss/);
  });
  it('rejects credentials, paths, queries, fragments, junk and other schemes', () => {
    for (const bad of ['https://user:pw@swarm.example.com', 'https://swarm.example.com/join', 'https://swarm.example.com/?a=1', 'https://swarm.example.com/#x', 'not a url', 'ftp://swarm.example.com', 'javascript:alert(1)', '', '   ', undefined, null, 42])
      expect(() => parseWorkerHttpOrigin(bad as never)).toThrow(WorkerUrlError);
  });
  it('error messages never contain the credentials that were supplied', () => {
    try { parseWorkerHttpOrigin('https://admin:hunter2@swarm.example.com'); } catch (e) { expect(String((e as Error).message)).not.toMatch(/hunter2|admin/); }
  });
  describe('browser helpers read NEXT_PUBLIC_SWARM_URL', () => {
    const old = process.env.NEXT_PUBLIC_SWARM_URL; afterEach(() => { if (old === undefined) delete process.env.NEXT_PUBLIC_SWARM_URL; else process.env.NEXT_PUBLIC_SWARM_URL = old; });
    it('valid, unset, and invalid values', () => {
      process.env.NEXT_PUBLIC_SWARM_URL = 'https://w.example.com/'; expect(swarmUrl()).toBe('https://w.example.com'); expect(swarmUrlProblem()).toBeNull();
      delete process.env.NEXT_PUBLIC_SWARM_URL; expect(swarmUrl()).toBeNull(); expect(swarmUrlProblem()).toBeNull();
      process.env.NEXT_PUBLIC_SWARM_URL = 'wss://w.example.com'; expect(swarmUrl()).toBeNull(); expect(swarmUrlProblem()).toMatch(/https origin/);
    });
  });
});

describe('SW-02 one secret minimum (SW-F04, SW-F05)', () => {
  it('a 20-character secret is refused in production and accepted only in a flagged dev run', () => {
    const s20 = 'a'.repeat(20);
    const prod = checkSecret(s20, { production: true }); expect(prod.ok).toBe(false); if (!prod.ok) { expect(prod.message).toMatch(/at least 32/); expect(prod.message).not.toContain(s20); }
    expect(checkSecret(s20, { production: false }).ok).toBe(true);
    expect(checkSecret('a'.repeat(15), { production: false }).ok).toBe(false);
  });
  it('31 fails and 32 passes; empty and missing fail', () => {
    expect(checkSecret('x'.repeat(SECRET_MIN_PRODUCTION - 1), { production: true }).ok).toBe(false);
    expect(checkSecret('x'.repeat(SECRET_MIN_PRODUCTION), { production: true }).ok).toBe(true);
    for (const v of ['', '   ', undefined, null]) expect(checkSecret(v, { production: true }).ok).toBe(false);
  });
  it('production runtime detection: SWARM_DEV never relaxes a Vercel production deploy', () => {
    expect(isProductionRuntime({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionRuntime({ NODE_ENV: 'development' })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: 'production', SWARM_DEV: '1' })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: 'production', SWARM_DEV: '1', VERCEL_ENV: 'production' })).toBe(true);
  });
});
