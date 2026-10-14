import { killSwitchHandler } from '@/lib/server/creative/admin';
import { creativeDeps } from '@/lib/server/creative/runtime';

/* Owner-only (Phase 1 gate: closed on production). Ticket 080–082. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const d = await creativeDeps();
  if (!d) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return killSwitchHandler(req, { db: d.db });
}
