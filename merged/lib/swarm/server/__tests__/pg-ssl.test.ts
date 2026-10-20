/** @jest-environment node */
import net from 'node:net';
import tls from 'node:tls';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { pgConnection } from '../pg-ssl';

describe('SW-03 remote Postgres TLS configuration (config level)', () => {
  it('a remote database always verifies the server certificate', () => {
    const c = pgConnection('postgres://u:p@db.example.com:5432/postgres'); expect(c.remote).toBe(true); expect(c.ssl).toEqual({ rejectUnauthorized: true });
  });
  it('loopback keeps TLS optional (dev/CI)', () => {
    for (const h of ['localhost', '127.0.0.1', '[::1]']) { const c = pgConnection(`postgres://u:p@${h}:5432/x`); expect(c.remote).toBe(false); expect(c.ssl).toBeUndefined(); }
  });
  it('a hostname that merely CONTAINS localhost is still remote (the old regex tested the whole URL)', () => {
    expect(pgConnection('postgres://u:p@evil.example.com/db?note=localhost').remote).toBe(true);
    expect(pgConnection('postgres://u:p@localhost.evil.example.com/db').ssl).toEqual({ rejectUnauthorized: true });
    expect(pgConnection('postgres://u:localhost@db.example.com/x').remote).toBe(true);
  });
  it('refuses sslmode values that do not verify, and strips URL parameters that pg would let override the verified config', () => {
    for (const m of ['disable', 'allow', 'prefer', 'no-verify']) expect(() => pgConnection(`postgres://u:p@db.example.com/x?sslmode=${m}`)).toThrow(/does not verify/);
    const c = pgConnection('postgres://u:p@db.example.com/x?sslmode=require&sslrootcert=/tmp/x&application_name=swarm'); expect(c.connectionString).not.toMatch(/sslmode|sslrootcert/); expect(c.connectionString).toMatch(/application_name=swarm/); expect(c.ssl).toMatchObject({ rejectUnauthorized: true });
  });
  it('a provider CA can be supplied (also as a one-line value with \\n) and is never a switch to disable verification', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n';
    const c = pgConnection('postgres://u:p@db.example.com/x', pem.replace(/\n/g, '\\n')); expect(c.ssl).toEqual({ rejectUnauthorized: true, ca: pem });
    expect(pgConnection('postgres://u:p@db.example.com/x', '   ').ssl).toEqual({ rejectUnauthorized: true });
  });
  it('rejects non-postgres and malformed URLs without echoing them', () => {
    expect(() => pgConnection('mysql://u:secretpw@db.example.com/x')).toThrow(/postgres/);
    try { pgConnection('not a url with secretpw'); } catch (e) { expect(String((e as Error).message)).not.toMatch(/secretpw/); }
  });
});

const haveOpenssl = (() => { try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
(haveOpenssl ? describe : describe.skip)('SW-03 TLS handshake against a server presenting a self-signed certificate (SW-F06, F07)', () => {
  let dir: string; let key: string; let cert: string; let server: net.Server; let port: number;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'pgtls-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    key = readFileSync(join(dir, 'k.pem'), 'utf8'); cert = readFileSync(join(dir, 'c.pem'), 'utf8');
    // a minimal Postgres-looking endpoint: answer the SSLRequest with 'S' and finish the TLS handshake, then hang up.
    server = net.createServer((sock) => {
      sock.once('data', () => { sock.write('S'); const t = new tls.TLSSocket(sock, { isServer: true, key, cert }); t.on('error', () => undefined); t.on('secureConnect', () => undefined); t.once('data', () => t.destroy()); });
      sock.on('error', () => undefined);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r())); port = (server.address() as net.AddressInfo).port;
  });
  afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); rmSync(dir, { recursive: true, force: true }); });
  const attempt = async (ssl: unknown) => { const c = new Client({ host: '127.0.0.1', port, user: 'u', password: 'p', database: 'd', ssl: ssl as never, connectionTimeoutMillis: 4000 }); try { await c.connect(); return 'connected'; } catch (e) { return String((e as Error).message); } finally { c.end().catch(() => undefined); } };
  it('an unknown / self-signed certificate is refused by the worker configuration', async () => {
    const cfg = pgConnection('postgres://u:p@db.example.com/d'); const msg = await attempt(cfg.ssl); expect(msg).toMatch(/self[- ]signed|unable to verify|certificate/i);
  });
  it('the same certificate is accepted once that specific CA is intentionally trusted', async () => {
    const cfg = pgConnection('postgres://u:p@db.example.com/d', cert); const msg = await attempt(cfg.ssl); expect(msg).not.toMatch(/self[- ]signed|unable to verify|certificate/i); // the handshake passed; the stub then hangs up
  });
});
