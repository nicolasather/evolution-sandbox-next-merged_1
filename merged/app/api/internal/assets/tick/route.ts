import { tickHandler } from '@/lib/server/creative/admin';
import { assetWorkerDeps } from '@/lib/server/creative/runtime';

/* Ticket 089. Called by a scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). One bounded step per call. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const run = async (req: Request) => tickHandler(req, await assetWorkerDeps().catch(() => null));
export const GET = run;
export const POST = run;
