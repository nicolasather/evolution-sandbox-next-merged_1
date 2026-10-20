/** Configuration rules shared by the Next app, the browser and the persistent worker (SW-01, SW-02).
 *  Isomorphic on purpose: no node:crypto, no process-wide side effects. */

/** One production minimum for the shared HMAC secret, enforced identically by the Next app and the worker. */
export const SECRET_MIN_PRODUCTION = 32;
/** Explicitly flagged dev/test runs (worker SWARM_DEV=1, NODE_ENV!=production) may use shorter fixtures. */
export const SECRET_MIN_DEV = 16;

export type SecretCheck = { ok: true } | { ok: false; message: string };
/** `production` is the caller's decision (see {@link isProductionRuntime}); a weak secret is never echoed back. */
export function checkSecret(secret: unknown, o: { production: boolean }): SecretCheck {
  const min = o.production ? SECRET_MIN_PRODUCTION : SECRET_MIN_DEV;
  if (typeof secret !== 'string' || secret.trim() === '') return { ok: false, message: 'SWARM_SECRET is not set.' };
  if (secret.trim().length < min) return { ok: false, message: `SWARM_SECRET is too short: ${o.production ? 'a hosted deployment' : 'even a dev run'} needs at least ${min} characters (generate one with: openssl rand -base64 48).` };
  return { ok: true };
}
/** Hosted = production build. The dev allowance needs an explicit SWARM_DEV=1 and is ignored on a Vercel production deploy. */
export function isProductionRuntime(env: { NODE_ENV?: string; VERCEL_ENV?: string; SWARM_DEV?: string } = (typeof process !== 'undefined' ? process.env : {})): boolean {
  if (env.VERCEL_ENV === 'production') return true;
  if (env.SWARM_DEV === '1') return false;
  return env.NODE_ENV === 'production';
}

export class WorkerUrlError extends Error { constructor(message: string) { super(message); this.name = 'WorkerUrlError'; } }
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
export const isLoopbackHost = (hostname: string) => LOOPBACK.has(hostname.toLowerCase());

/** The canonical public address of the worker: an HTTPS origin (plain HTTP only for a loopback worker in development).
 *  `wss://` / `ws://` are rejected here, never passed on to fetch(): the socket address is derived by {@link workerWsUrl}. */
export function parseWorkerHttpOrigin(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new WorkerUrlError('The game server address is not set.');
  const raw = value.trim(); let u: URL;
  try { u = new URL(raw); } catch { throw new WorkerUrlError('The game server address is not a valid URL. Use its https origin, for example https://swarm.example.com.'); }
  if (u.protocol === 'wss:' || u.protocol === 'ws:') throw new WorkerUrlError(`The game server address must be an https origin, not ${u.protocol}//. The browser derives the wss:// socket address itself.`);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new WorkerUrlError('The game server address must start with https://.');
  if (u.protocol === 'http:' && !isLoopbackHost(u.hostname)) throw new WorkerUrlError('A hosted game server needs https:// (plain http is only for a worker on localhost).');
  if (u.username || u.password) throw new WorkerUrlError('The game server address must not contain a username or password.');
  if (u.search || u.hash || u.pathname !== '/') throw new WorkerUrlError('The game server address must be just an origin (no path, query or fragment).');
  return u.origin;
}
/** wss://host/ws for an https origin (ws:// for the loopback http one). */
export function workerWsUrl(httpOrigin: string): string {
  const u = new URL(parseWorkerHttpOrigin(httpOrigin)); u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; u.pathname = '/ws'; return u.toString();
}
export function workerJoinUrl(httpOrigin: string): string { return `${parseWorkerHttpOrigin(httpOrigin)}/join`; }
