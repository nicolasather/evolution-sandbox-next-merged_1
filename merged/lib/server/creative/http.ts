import { SCHEMA_VERSION, type TryCraftResponse, type TryRequest } from './types';
import { ACTION_RE, ITEM_ID_RE, MAX_SLOTS, MIN_SLOTS } from './recipeKey';

/* Ticket 071. Capped, exact-key, never trusting: a bad request is HTTP 400 and zero provider calls. */

export const MAX_BODY_BYTES = 2048;
export const ATTEMPT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const KEYS = ['schemaVersion', 'ingredientIds', 'actionId', 'releaseHash', 'attemptId'] as const;

export type ParseResult =
  | { ok: true; request: TryRequest }
  | { ok: false; status: 400 | 413; code: string };

export function parseTryRequest(text: string): ParseResult {
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return { ok: false, status: 413, code: 'body_too_large' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, status: 400, code: 'bad_json' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, status: 400, code: 'bad_shape' };
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== KEYS.length || keys.some(k => !(KEYS as readonly string[]).includes(k))) return { ok: false, status: 400, code: 'unexpected_fields' };
  if (o.schemaVersion !== SCHEMA_VERSION) return { ok: false, status: 400, code: 'bad_schema_version' };
  const ing = o.ingredientIds;
  if (!Array.isArray(ing) || ing.length < MIN_SLOTS || ing.length > MAX_SLOTS) return { ok: false, status: 400, code: 'bad_ingredient_count' };
  if (ing.some(x => typeof x !== 'string' || !ITEM_ID_RE.test(x))) return { ok: false, status: 400, code: 'bad_ingredient_id' };
  if (o.actionId !== null && (typeof o.actionId !== 'string' || !ACTION_RE.test(o.actionId))) return { ok: false, status: 400, code: 'bad_action' };
  if (typeof o.releaseHash !== 'string' || o.releaseHash.length < 8 || o.releaseHash.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(o.releaseHash)) return { ok: false, status: 400, code: 'bad_release_hash' };
  if (typeof o.attemptId !== 'string' || !ATTEMPT_ID_RE.test(o.attemptId)) return { ok: false, status: 400, code: 'bad_attempt_id' };
  return {
    ok: true,
    request: { schemaVersion: 1, ingredientIds: ing as string[], actionId: o.actionId as string | null, releaseHash: o.releaseHash, attemptId: o.attemptId },
  };
}

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const;

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

export const statusFor = (r: TryCraftResponse): number => (r.kind === 'rate_limited' ? 429 : r.kind === 'unavailable' ? 503 : 200);
