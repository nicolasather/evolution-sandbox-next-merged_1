import { failure, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';
import { cleanupMedia } from '@/lib/quiz/media/server';
import { timingSafeEqual } from 'node:crypto';

/** Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`. Deletes only stale rooms and limiter rows — never quizzes. */
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new AppError('Not found', 404);
    const given = req.headers.get('authorization') ?? '';
    const want = `Bearer ${secret}`;
    const a = Buffer.from(given), b = Buffer.from(want);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError('Unauthorized', 401);
    const stale = await rpc('cleanup_stale_data', {});
    return success({ stale, mediaRemoved: await cleanupMedia() });
  } catch (e) { return failure(e); }
}
