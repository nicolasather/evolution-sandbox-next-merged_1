import { failure, rpc, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';
import { serviceDB } from '@/lib/quiz/supabase';
import { BUCKET } from '@/lib/quiz/media';
import { timingSafeEqual } from 'node:crypto';

/** Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`. Deletes only stale rooms, limiter rows, expired telemetry and media nothing references — never quizzes. */
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new AppError('Not found', 404);
    const given = req.headers.get('authorization') ?? '';
    const want = `Bearer ${secret}`;
    const a = Buffer.from(given), b = Buffer.from(want);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError('Unauthorized', 401);
    const base = await rpc<Record<string, unknown>>('cleanup_stale_data', {});
    // Quiz Studio retention (telemetry, audit, orphaned/abandoned media). Absent until migration 004/005 is applied: report that, do not fail the whole job.
    const db = serviceDB();
    const studio = await db.rpc('cleanup_quiz_studio_data');
    let purged = 0; let purgeError: string | undefined;
    if (!studio.error) {
      // Remove the storage objects of media marked deleted, exactly once each (purged_at), in small batches.
      const { data: rows } = await db.from('media_assets').select('id,storage_path').eq('status', 'deleted').is('purged_at', null).limit(200);
      const list = rows ?? [];
      if (list.length) {
        const rm = await db.storage.from(BUCKET).remove(list.map((r) => (r.storage_path as string).slice(BUCKET.length + 1)));
        if (rm.error) purgeError = 'storage-remove-failed';
        else { await db.from('media_assets').update({ purged_at: new Date().toISOString() }).in('id', list.map((r) => r.id as string)); purged = list.length; }
      }
    }
    return success({ ...base, quizStudio: studio.error ? { skipped: studio.error.code ?? 'unavailable' } : { ...(studio.data as object), purgedFiles: purged, ...(purgeError ? { purgeError } : {}) } });
  } catch (e) { return failure(e); }
}
