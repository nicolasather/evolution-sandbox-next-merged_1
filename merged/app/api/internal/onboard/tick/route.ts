import { onboardTickHandler } from '@/lib/server/creative/admin';
import { onboardDeps } from '@/lib/server/creative/runtime';

/* Optional scheduler hook (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). One item per call. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const run = async (req: Request) => onboardTickHandler(req, await onboardDeps().catch(() => null));
export const GET = run;
export const POST = run;
