import { assetsManifestHandler } from '@/lib/server/creative/admin';
import { creativeDeps } from '@/lib/server/creative/runtime';

/* Owner-only (Phase 1 gate: closed on production). Tickets 089/092. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const d = await creativeDeps();
  if (!d) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return assetsManifestHandler(req, { db: d.db, baseUrl: process.env.ASSET_PUBLIC_BASE_URL ?? '', hosts: (process.env.NEXT_PUBLIC_ASSET_HOSTS ?? '').split(',').map(s => s.trim()).filter(Boolean) });
}
