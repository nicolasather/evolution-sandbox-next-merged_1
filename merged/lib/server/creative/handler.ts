import { checkBrowserOrigin, actorFrom, BurstLimiter } from './guard';
import { jsonResponse, parseTryRequest, statusFor } from './http';
import { handleTryRecipe, type ServiceDeps } from './service';
import { logRequest, metrics, newRequestId } from './telemetry';

/* Ticket 071 — the testable core of POST /api/creative/try-recipe. Every failure mode answers with a small,
   fixed body; no internal error text, SQL, key or stack ever reaches a player. */

export const burst = new BurstLimiter();

export async function tryRecipeHandler(req: Request, getDeps: () => Promise<ServiceDeps | null>): Promise<Response> {
  const requestId = newRequestId();
  const t0 = Date.now();
  const res = await inner(req, getDeps);
  const ms = Date.now() - t0;
  let kind = `http_${res.status}`;
  try { const j = await res.clone().json() as { kind?: string; error?: string }; kind = j.kind ?? j.error ?? kind; } catch { /* body is optional */ }
  metrics.inc(`try.${kind}`); metrics.observe(ms);
  logRequest({ requestId, status: res.status, kind, ms });
  const h = new Headers(res.headers); h.set('x-request-id', requestId);
  return new Response(res.body, { status: res.status, headers: h });
}

async function inner(req: Request, getDeps: () => Promise<ServiceDeps | null>): Promise<Response> {
  const deps = await getDeps().catch(() => null);
  const cfg = deps?.cfg;
  const g = checkBrowserOrigin(req.headers, { allowedOrigins: cfg?.allowedOrigins ?? [] });
  if (!g.ok) return jsonResponse({ error: g.code }, g.status);

  let text: string;
  try { text = await req.text(); } catch { return jsonResponse({ error: 'bad_body' }, 400); }
  const parsed = parseTryRequest(text);
  if (!parsed.ok) return jsonResponse({ error: parsed.code }, parsed.status);

  if (!deps) return jsonResponse({ kind: 'unavailable' }, 503, { 'Retry-After': '60' });
  const actor = actorFrom(req.headers, deps.cfg);
  if (!burst.allow(actor, deps.now().getTime())) return jsonResponse({ kind: 'rate_limited', retryAfterSeconds: 60 }, 429, { 'Retry-After': '60' });

  try {
    const r = await handleTryRecipe(deps, parsed.request, actor);
    if (r.status === 'invalid') return jsonResponse({ error: 'unknown_item' }, 400);
    return jsonResponse(r.body, statusFor(r.body));
  } catch {
    return jsonResponse({ kind: 'unavailable' }, 503, { 'Retry-After': '30' });   // gameplay falls back to normal "nothing happens"
  }
}
