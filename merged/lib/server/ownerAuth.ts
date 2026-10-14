import { timingSafeEqual } from 'node:crypto';
import { serverDevToolsEnabled } from '../dev/env';

/* Owner-only gate for the content studio. Closed unless ALL hold:
   - the developer gate is open (never on a production deployment),
   - OWNER_REVIEW_TOKEN is configured on the server (never NEXT_PUBLIC),
   - the request carries `Authorization: Bearer <token>` (constant-time compared).
   No cookie, URL parameter or localStorage can open it. */

type EnvLike = Record<string, string | undefined>;

export type OwnerCheck = { ok: true } | { ok: false; status: 401 | 404; reason: 'closed' | 'missing_token' | 'bad_token' };

export function checkOwner(headers: Pick<Headers, 'get'>, env: EnvLike = process.env): OwnerCheck {
  // Behave as if the route does not exist whenever the surface is closed.
  if (!serverDevToolsEnabled(env) || !env.OWNER_REVIEW_TOKEN) return { ok: false, status: 404, reason: 'closed' };
  const h = headers.get('authorization') ?? '';
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) return { ok: false, status: 401, reason: 'missing_token' };
  const a = Buffer.from(m[1]);
  const b = Buffer.from(env.OWNER_REVIEW_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, reason: 'bad_token' };
  return { ok: true };
}
