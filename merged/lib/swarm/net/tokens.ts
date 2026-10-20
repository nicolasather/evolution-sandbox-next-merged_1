/** Signed, expiring identity tokens (HMAC-SHA256). Node-only: used by the Next routes that mint them and by the worker that verifies them.
 *  A token names ONE room and ONE subject. It carries no score, no team and no role: the worker's roster is the only authority for those. */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SECRET_MIN_DEV, SECRET_MIN_PRODUCTION } from '../config';

export type TokenKind = 'player' | 'host' | 'screen';
export type Claims = { v: 1; typ: TokenKind; room: string; sub: string; exp: number; iat: number; jti: string };

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const mac = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest();

export function signToken(c: { typ: TokenKind; room: string; sub: string; ttlSec: number; now?: number }, secret: string): string {
  // Hard floor only: the production minimum (SECRET_MIN_PRODUCTION) is enforced at the config boundaries (checkSecret in the Next app and the worker),
  // so a dev/test fixture can still sign, while a hosted deployment with a short secret never reaches this point.
  if (!secret || secret.length < SECRET_MIN_DEV) throw new Error(`SWARM_SECRET must be at least ${SECRET_MIN_DEV} characters (${SECRET_MIN_PRODUCTION} in production)`);
  const now = c.now ?? Date.now();
  const claims: Claims = { v: 1, typ: c.typ, room: c.room, sub: c.sub, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + c.ttlSec, jti: randomBytes(8).toString('hex') };
  const body = b64(JSON.stringify(claims));
  return `${body}.${b64(mac(body, secret))}`;
}

export type Verified = { ok: true; claims: Claims } | { ok: false; reason: 'malformed' | 'signature' | 'expired' | 'room' | 'kind' };
export function verifyToken(token: unknown, secret: string, o: { room?: string; typ?: TokenKind | TokenKind[]; now?: number } = {}): Verified {
  if (typeof token !== 'string' || token.length > 600) return { ok: false, reason: 'malformed' };
  const parts = token.split('.'); if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  let given: Buffer; try { given = Buffer.from(parts[1], 'base64url'); } catch { return { ok: false, reason: 'malformed' }; }
  const want = mac(parts[0], secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return { ok: false, reason: 'signature' };
  let c: Claims; try { c = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Claims; } catch { return { ok: false, reason: 'malformed' }; }
  if (c?.v !== 1 || typeof c.room !== 'string' || typeof c.sub !== 'string' || typeof c.exp !== 'number') return { ok: false, reason: 'malformed' };
  if (c.exp * 1000 < (o.now ?? Date.now())) return { ok: false, reason: 'expired' };
  if (o.room !== undefined && c.room !== o.room) return { ok: false, reason: 'room' };
  const kinds = o.typ === undefined ? null : Array.isArray(o.typ) ? o.typ : [o.typ];
  if (kinds && !kinds.includes(c.typ)) return { ok: false, reason: 'kind' };
  return { ok: true, claims: c };
}
export const newSubject = () => randomBytes(12).toString('hex');
