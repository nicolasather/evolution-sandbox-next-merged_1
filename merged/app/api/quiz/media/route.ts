import { randomUUID } from 'node:crypto';
import { currentUser, serviceDB } from '@/lib/quiz/supabase';
import { BUCKET, USER_QUOTA_BYTES, checkUpload, mediaPath } from '@/lib/quiz/media';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';

export const runtime = 'nodejs';

/** Upload one image, audio or video file. The server sniffs the real file type (never trusts the name), enforces size and quota, and stores it under the owner's own folder. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'media-upload', 40, 3600, user.id);
    const form = await req.formData();
    const file = form.get('file');
    const alt = String(form.get('alt') ?? '').slice(0, 300);
    if (!(file instanceof File)) throw new AppError('Choose a file to upload', 400);
    if (file.size > 20_000_000) throw new AppError('That file is too large.', 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const db = serviceDB();
    const { data: used } = await db.from('media_assets').select('bytes').eq('owner_id', user.id).neq('status', 'deleted');
    const usedBytes = (used ?? []).reduce((n, r) => n + (r.bytes as number), 0);
    const verdict = checkUpload(bytes, { usedBytes, quotaBytes: USER_QUOTA_BYTES });
    if (!verdict.ok) throw new AppError(verdict.message, 400);
    const id = randomUUID();
    const path = mediaPath(user.id, id, verdict.ext);
    const key = path.slice(BUCKET.length + 1);
    const up = await db.storage.from(BUCKET).upload(key, bytes, { contentType: verdict.mime, upsert: false });
    if (up.error) throw new AppError('Uploads are not set up on this deployment yet. You can still link a YouTube or Vimeo video.', 503);
    const { error } = await db.from('media_assets').insert({ id, owner_id: user.id, storage_path: path, mime: verdict.mime, bytes: bytes.length, alt_text: alt });
    if (error) { await db.storage.from(BUCKET).remove([key]); throw new AppError('Could not record the upload', 500); }
    return success({ id, path, mime: verdict.mime, bytes: bytes.length, remainingBytes: USER_QUOTA_BYTES - usedBytes - bytes.length }, 201);
  } catch (e) { return failure(e); }
}

/** Short-lived signed read link for a file the caller owns, or one used by a published quiz. */
export async function GET(req: Request) {
  try {
    const path = new URL(req.url).searchParams.get('path') ?? '';
    if (!path.startsWith(`${BUCKET}/`) || path.includes('..') || path.split('/').length !== 3) throw new AppError('Invalid media path', 400);
    const user = await currentUser();
    const db = serviceDB();
    const { data: asset } = await db.from('media_assets').select('owner_id,quiz_id,status').eq('storage_path', path).maybeSingle();
    if (!asset || asset.status !== 'ready') throw new AppError('Not found', 404);
    let allowed = asset.owner_id === user.id;
    if (!allowed && asset.quiz_id) { const { data: q } = await db.from('quizzes').select('status').eq('id', asset.quiz_id).maybeSingle(); allowed = q?.status === 'published'; }
    if (!allowed) throw new AppError('Not found', 404);
    const { data } = await db.storage.from(BUCKET).createSignedUrl(path.slice(BUCKET.length + 1), 300);
    if (!data) throw new AppError('Not found', 404);
    return success({ url: data.signedUrl, expiresInSeconds: 300 });
  } catch (e) { return failure(e); }
}
