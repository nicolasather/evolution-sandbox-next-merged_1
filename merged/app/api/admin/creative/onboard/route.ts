import { onboardListHandler, onboardRunHandler } from '@/lib/server/creative/admin';
import { onboardDeps } from '@/lib/server/creative/runtime';

/* Owner-only (Phase 1 gate: closed on production). New verified items -> 3D draft job + private route proposals. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const closed = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
export async function GET(req: Request): Promise<Response> {
  const on = await onboardDeps(); if (!on) return closed();
  return onboardListHandler(req, { db: on.db, on });
}
export async function POST(req: Request): Promise<Response> {
  const on = await onboardDeps(); if (!on) return closed();
  return onboardRunHandler(req, { db: on.db, on });
}
