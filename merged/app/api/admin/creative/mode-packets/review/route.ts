import { modePacketsReviewHandler } from '@/lib/server/creative/admin';
import { creativeDeps } from '@/lib/server/creative/runtime';

/* Owner-only (Phase 1 gate: closed on production). Tickets 093–097. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const d = await creativeDeps();
  if (!d) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return modePacketsReviewHandler(req, { db: d.db });
}
