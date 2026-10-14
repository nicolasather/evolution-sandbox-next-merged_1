import { NextResponse } from 'next/server';
import { playDb } from '@/lib/processing';
import { checkOwner } from '@/lib/server/ownerAuth';
import { providerFromEnv } from '@/lib/server/aiRecipeProvider';
import { suggestAlternatives } from '@/lib/content/altService';
import { RateLimiter, limitsFromEnv } from '@/lib/server/rateLimit';

const limiter = new RateLimiter(limitsFromEnv());

/* Owner-only. Phase 1: proposals are returned for review and written NOWHERE.
   The route behaves as if it does not exist unless the developer gate and the
   owner token are both configured, and it can never run on production. */

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const auth = checkOwner(req.headers);
  if (!auth.ok) return new NextResponse(null, { status: auth.status, headers: NO_STORE });

  const gate = limiter.check();
  if (!gate.ok) return NextResponse.json({ error: 'rate_limited', reason: gate.reason }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(gate.retryAfterSec) } });

  const text = await req.text();
  if (text.length > 8_192) return NextResponse.json({ error: 'body_too_large' }, { status: 413, headers: NO_STORE });
  let body: { targetId?: unknown };
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400, headers: NO_STORE }); }
  if (typeof body.targetId !== 'string' || body.targetId.length > 80) return NextResponse.json({ error: 'targetId_required' }, { status: 400, headers: NO_STORE });

  const t0 = Date.now();
  // one log line per request: no key, no prompt, no model text
  const provider = providerFromEnv(process.env, e => console.info('[alt-ai]', JSON.stringify({ target: String(body.targetId).slice(0, 60), ...e })));
  const out = await suggestAlternatives(playDb, body.targetId, provider);
  console.info('[alt-ai] done', JSON.stringify({ target: out.targetId.slice(0, 60), outcome: out.outcome, provider: out.provider, status: out.providerStatus, ms: Date.now() - t0 }));
  return NextResponse.json({ ...out, providerStatus: provider.status?.() ?? null }, { status: out.error ? 404 : 200, headers: NO_STORE });
}
