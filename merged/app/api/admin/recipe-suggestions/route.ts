import { NextResponse } from 'next/server';
import { playDb } from '@/lib/processing';
import { checkOwner } from '@/lib/server/ownerAuth';
import { providerFromEnv } from '@/lib/server/aiRecipeProvider';
import { suggestAlternatives } from '@/lib/content/altService';

/* Owner-only. Phase 1: proposals are returned for review and written NOWHERE.
   The route behaves as if it does not exist unless the developer gate and the
   owner token are both configured, and it can never run on production. */

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const auth = checkOwner(req.headers);
  if (!auth.ok) return new NextResponse(null, { status: auth.status, headers: NO_STORE });

  const text = await req.text();
  if (text.length > 8_192) return NextResponse.json({ error: 'body_too_large' }, { status: 413, headers: NO_STORE });
  let body: { targetId?: unknown };
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400, headers: NO_STORE }); }
  if (typeof body.targetId !== 'string') return NextResponse.json({ error: 'targetId_required' }, { status: 400, headers: NO_STORE });

  const out = await suggestAlternatives(playDb, body.targetId, providerFromEnv());
  return NextResponse.json(out, { status: out.error ? 404 : 200, headers: NO_STORE });
}
