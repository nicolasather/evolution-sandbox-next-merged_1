import { hostnameOf, isLoopbackHostname, labGate } from '../gate';

const ok = { VISUAL_LAB: 'true', ENABLE_DEV_TOOLS: 'true', NODE_ENV: 'development' };

describe('lab gate', () => {
  it('opens only when everything lines up', () => {
    expect(labGate(ok, 'localhost:3000').open).toBe(true);
    expect(labGate({ ...ok, VISUAL_LAB: undefined }, 'localhost').open).toBe(false);
    expect(labGate({ ...ok, ENABLE_DEV_TOOLS: 'false' }, 'localhost').open).toBe(false);
    expect(labGate({ ...ok, VERCEL: '1' }, 'localhost').open).toBe(false);
    expect(labGate({ ...ok, VERCEL_ENV: 'preview' }, 'localhost').open).toBe(false);
    expect(labGate({ ...ok, NODE_ENV: 'production' }, 'localhost').open).toBe(false);
    expect(labGate({ ...ok, VERCEL_ENV: 'production' }, 'localhost').open).toBe(false);
  });
  it('treats the .env.example default VERCEL_ENV=development as local', () => {
    expect(labGate({ ...ok, VERCEL_ENV: 'development' }, 'localhost').open).toBe(true);
    expect(labGate({ ...ok, VERCEL: '1', VERCEL_ENV: 'development' }, 'localhost').open).toBe(true);
    expect(labGate({ ...ok, VERCEL: '1' }, 'localhost').open).toBe(false);
  });
  it('refuses non-loopback hosts', () => {
    expect(labGate(ok, 'evo-git-0cba60.vercel.app').open).toBe(false);
    expect(labGate(ok, '192.168.1.20:3000').open).toBe(false);
    expect(labGate(ok, '').open).toBe(false);
    expect(labGate(ok, 'localhost.evil.com').open).toBe(false);
    expect(labGate(ok, '127.0.0.1:3000').open).toBe(true);
    expect(labGate(ok, '[::1]:3000').open).toBe(true);
  });
  it('parses host headers', () => {
    expect(hostnameOf('localhost:3000')).toBe('localhost');
    expect(hostnameOf('[::1]:3000')).toBe('::1');
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('example.com')).toBe(false);
  });
});
