import { z } from 'zod';
import { currentUser, serviceDB } from '@/lib/quiz/supabase';
import { BUCKET } from '@/lib/quiz/media';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

const schema = z.object({ scope: z.enum(['uploads', 'cosmetics', 'quizzes']), confirm: z.literal(true) });

/** Deletes one kind of the caller's own data. Requires an explicit confirm flag. Removing the whole account stays a separate, manual support step. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'account-delete', 5, 3600, user.id);
    const { scope } = schema.parse(await jsonBody(req));
    const db = serviceDB();
    if (scope === 'uploads') {
      const { data } = await db.from('media_assets').select('storage_path').eq('owner_id', user.id);
      const keys = (data ?? []).map((r) => (r.storage_path as string).slice(BUCKET.length + 1));
      if (keys.length) await db.storage.from(BUCKET).remove(keys);
      await db.from('media_assets').delete().eq('owner_id', user.id);
    } else if (scope === 'cosmetics') {
      await db.from('cosmetic_events').delete().eq('owner_id', user.id);
      await db.from('cosmetic_profiles').delete().eq('owner_id', user.id);
    } else {
      await db.from('quizzes').delete().eq('owner_id', user.id);
    }
    return success({ deleted: scope });
  } catch (e) { return failure(e); }
}
