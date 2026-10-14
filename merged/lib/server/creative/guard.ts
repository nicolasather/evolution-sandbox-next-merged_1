import { actorHash } from './recipeKey';
import type { CreativeConfig } from './config';

/* Ticket 086 — a browser can only reach this API from our own pages. Defence in depth, none of it is "auth":
   (1) Origin must equal Host (or an allow-listed origin), (2) Sec-Fetch-Site must not be cross-site,
   (3) JSON content type, (4) per-actor in-memory burst limit before any database work. */

type H = Pick<Headers, 'get'>;

export type GuardResult = { ok: true } | { ok: false; status: 403 | 415 | 429; code: string };

export function checkBrowserOrigin(h: H, cfg: Pick<CreativeConfig, 'allowedOrigins'>): GuardResult {
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!origin || origin === 'null') return { ok: false, status: 403, code: 'origin_required' };
  let o: URL;
  try { o = new URL(origin); } catch { return { ok: false, status: 403, code: 'bad_origin' }; }
  const same = !!host && o.host === host;
  if (!same && !cfg.allowedOrigins.includes(o.origin)) return { ok: false, status: 403, code: 'origin_mismatch' };
  const site = h.get('sec-fetch-site');
  if (site === 'cross-site') return { ok: false, status: 403, code: 'cross_site' };
  const ct = (h.get('content-type') ?? '').toLowerCase();
  if (!ct.startsWith('application/json')) return { ok: false, status: 415, code: 'json_required' };
  return { ok: true };
}

/** Guests are identified by network address only (a client-controlled id could be rotated to dodge quotas). */
export function actorFrom(h: H, cfg: Pick<CreativeConfig, 'actorSalt'>): string {
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  return actorHash(fwd.slice(0, 64), cfg.actorSalt || 'unsalted');
}

export class BurstLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max = 12, private windowMs = 60_000) {}
  allow(actor: string, nowMs: number): boolean {
    const keep = (this.hits.get(actor) ?? []).filter(t => nowMs - t < this.windowMs);
    if (keep.length >= this.max) { this.hits.set(actor, keep); return false; }
    keep.push(nowMs);
    this.hits.set(actor, keep);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some(t => nowMs - t < this.windowMs)) this.hits.delete(k);
    return true;
  }
}
