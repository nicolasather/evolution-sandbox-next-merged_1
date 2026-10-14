import { NextResponse } from 'next/server';
import { configFromEnv } from '@/lib/devlab/ollama';
import { contactSheet, type SheetCell } from '@/lib/devlab/preview';
import { existingResources, gateFor, hostOk, ollama, regenerate, sameOriginMutation } from '@/lib/devlab/server';
import { listResults, readDataset, readReviews, setReview } from '@/lib/devlab/store';
import type { Decision } from '@/lib/devlab/types';

/* DEVELOPMENT ONLY — local Visual Lab API.
   Closed (plain 404, no hint) unless VISUAL_LAB and ENABLE_DEV_TOOLS are on, the process is not on
   Vercel / production, and the request is addressed to a loopback host. Never deployed. */

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const closed = () => new NextResponse(null, { status: 404, headers: NO_STORE });

export async function GET(req: Request) {
  if (!gateFor(req.headers).open) return closed();
  const url = new URL(req.url);

  if (url.searchParams.get('sheet') === '1') {
    const ds = readDataset();
    const byId = new Map(listResults().map(r => [r.id, r]));
    const cells: SheetCell[] = ds.resources.map(r => {
      const g = byId.get(r.id);
      return { id: r.id, name: r.name, category: r.category, state: !g ? 'missing' : g.status, source: g?.source, markup: g?.markup, note: g?.failure?.kind };
    });
    return new NextResponse(contactSheet(cells), { headers: { ...NO_STORE, 'Content-Type': 'image/svg+xml' } });
  }

  const wantHealth = url.searchParams.get('health') === '1';
  const cfg = configFromEnv();
  let health: Awaited<ReturnType<ReturnType<typeof ollama>['health']>> | { ok: false; error: string } | null = null;
  if (wantHealth) {
    try { health = await ollama().health(); } catch (e) { health = { ok: false, error: (e as Error).message }; }
  }
  return NextResponse.json({
    dataset: readDataset(),
    records: listResults(),
    reviews: readReviews(),
    existing: existingResources(),
    ollama: { url: cfg.baseUrl, model: cfg.model, health },
  }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!gateFor(req.headers).open || !hostOk(req.headers)) return closed();
  if (!sameOriginMutation(req.headers)) return NextResponse.json({ error: 'cross-origin request refused' }, { status: 403, headers: NO_STORE });

  let body: { action?: string; id?: string; decision?: string; scores?: Record<string, number>; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400, headers: NO_STORE }); }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!readDataset().resources.some(r => r.id === id)) return NextResponse.json({ error: 'unknown resource id' }, { status: 400, headers: NO_STORE });

  if (body.action === 'review') {
    if (!['pending', 'approved', 'rejected'].includes(body.decision ?? '')) return NextResponse.json({ error: 'bad decision' }, { status: 400, headers: NO_STORE });
    const review = setReview(id, body.decision as Decision, { scores: body.scores, note: body.note });
    return NextResponse.json({ review }, { headers: NO_STORE });
  }
  if (body.action === 'regenerate') {
    try { return NextResponse.json({ record: await regenerate(id) }, { headers: NO_STORE }); }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409, headers: NO_STORE }); }
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400, headers: NO_STORE });
}
