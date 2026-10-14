/* Tiny in-memory limiter for the owner-only AI route.
   Per process: on serverless each instance counts separately, so this is a seat-belt against a runaway
   loop or a leaked token being hammered, NOT a billing guarantee. The real cost ceiling is that nothing
   in the game calls the route: only the owner, by hand, on a gated (non-production) deployment. */

export interface LimitConfig { perMinute: number; perHour: number }
export const DEFAULT_LIMITS: LimitConfig = { perMinute: 6, perHour: 40 };

export type Verdict = { ok: true } | { ok: false; reason: 'minute' | 'hour'; retryAfterSec: number };

export class RateLimiter {
  private hits: number[] = [];
  constructor(private cfg: LimitConfig = DEFAULT_LIMITS, private now: () => number = Date.now) {}

  /** Ask for one request. A refusal is not counted and says how many seconds to wait. */
  check(): Verdict {
    const t = this.now();
    this.hits = this.hits.filter(h => t - h < 3_600_000);
    const lastMinute = this.hits.filter(h => t - h < 60_000);
    if (this.hits.length >= this.cfg.perHour) return { ok: false, reason: 'hour', retryAfterSec: Math.max(1, Math.ceil((this.hits[0] + 3_600_000 - t) / 1000)) };
    if (lastMinute.length >= this.cfg.perMinute) return { ok: false, reason: 'minute', retryAfterSec: Math.max(1, Math.ceil((lastMinute[0] + 60_000 - t) / 1000)) };
    this.hits.push(t);
    return { ok: true };
  }
}

/** ALT_AI_RPM / ALT_AI_HOURLY: junk or non-positive values fall back to the defaults; the rest are clamped. */
export function limitsFromEnv(env: Record<string, string | undefined> = process.env): LimitConfig {
  const n = (v: string | undefined, d: number, hi: number) => { const x = Number(v); return v && Number.isFinite(x) && x > 0 ? Math.min(hi, Math.floor(x)) : d; };
  return { perMinute: n(env.ALT_AI_RPM, DEFAULT_LIMITS.perMinute, 60), perHour: n(env.ALT_AI_HOURLY, DEFAULT_LIMITS.perHour, 600) };
}
