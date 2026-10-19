import 'server-only';
import { serviceDB } from './supabase';
import { AppError } from './errors';
import { ownsPath, quizMediaRefs } from './media';

/** Server-side guard run when a quiz is saved or published: a quiz may only point at uploads the saver owns (or that already appear in a published quiz,
 *  which is how duplicating/remixing works). Foreign or invented paths are refused so nobody can attach somebody else's private file to their own quiz
 *  (matrix M18). Publishing additionally requires every referenced upload to exist and be 'ready'. */
export async function assertMediaRefsAllowed(questions: { payload: Record<string, unknown> }[], userId: string, status: 'draft' | 'published') {
  const refs = quizMediaRefs(questions);
  if (!refs.length) return;
  const db = serviceDB();
  const foreign = refs.filter((r) => !ownsPath(userId, r));
  for (const path of foreign) {
    const { data, error } = await db.rpc('media_in_published_quiz', { p_path: path });
    if (error) { if (error.code === 'PGRST202') throw new AppError('Saving media needs the latest database update (migration 005).', 503); throw new AppError('Could not check the media in this quiz', 500); }
    if (data !== true) throw new AppError('This quiz uses a file that belongs to someone else. Upload your own copy and try again.', 400);
  }
  if (status === 'published') {
    const { data, error } = await db.from('media_assets').select('storage_path,status').in('storage_path', refs);
    if (error) throw new AppError('Could not check the media in this quiz', 500);
    const ready = new Set((data ?? []).filter((r) => r.status === 'ready').map((r) => r.storage_path as string));
    const missing = refs.filter((r) => !ready.has(r));
    if (missing.length) throw new AppError(`${missing.length} media file${missing.length === 1 ? ' is' : 's are'} missing or still uploading. Re-upload or remove ${missing.length === 1 ? 'it' : 'them'} before publishing.`, 400);
  }
}
