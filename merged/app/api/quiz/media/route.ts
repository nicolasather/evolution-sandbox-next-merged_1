import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { currentUser, maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { BUCKET, MAX_UPLOAD_BYTES, MEDIA_EXTENSIONS, PROXY_UPLOAD_MAX_BYTES, USER_QUOTA_BYTES, checkUpload, isStoragePath, mediaPath } from '@/lib/quiz/media';
import { canReadMedia } from '@/lib/quiz/media-access';
import { getRoom, verifyPlayer } from '@/lib/quiz/rooms';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, jsonBody, rateLimit, success } from '@/lib/quiz/api';

export const runtime = 'nodejs';

const EXT_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };
const initSchema = z.object({ action: z.literal('init'), size: z.number().int().min(1).max(MAX_UPLOAD_BYTES), ext: z.enum(MEDIA_EXTENSIONS) }).strict();
const finalizeSchema = z.object({ action: z.literal('finalize'), id: z.string().uuid(), alt: z.string().max(300).optional() }).strict();

async function usedBytes(ownerId: string, exceptId?: string) {
  let q = serviceDB().from('media_assets').select('bytes').eq('owner_id', ownerId).in('status', ['ready', 'pending']);
  if (exceptId) q = q.neq('id', exceptId);
  const { data } = await q;
  return (data ?? []).reduce((n, r) => n + (r.bytes as number), 0);
}
const missingMigration = (e: { code?: string; message?: string } | null) => !!e && (e.code === 'PGRST202' || e.code === '42P01' || e.code === '42703' || e.code === '23514' || /could not find the function|does not exist/i.test(e.message ?? ''));

/** Uploads, in two ways:
 *   1. JSON `{action:'init'}` → signed PUT straight to PRIVATE storage (works for the full 25 MB; Vercel functions refuse request bodies over 4.5 MB)
 *      → JSON `{action:'finalize'}`: the server downloads the stored bytes, re-checks type (magic bytes), size, image dimensions, video/audio length and quota, and only then marks the file ready.
 *   2. multipart form (small files, up to PROXY_UPLOAD_MAX_BYTES): the server sniffs and stores it itself.
 *  Browser-supplied MIME, filename, width, height and duration are never trusted. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'media-upload', 60, 3600, user.id);
    const db = serviceDB();
    if ((req.headers.get('content-type') ?? '').includes('application/json')) {
      const body = (await jsonBody(req)) as { action?: string };
      if (body.action === 'init') {
        const { size, ext } = initSchema.parse(body);
        const used = await usedBytes(user.id);
        if (used + size > USER_QUOTA_BYTES) throw new AppError('This upload would go over your storage allowance. Delete media you no longer use and try again.', 400);
        const { count } = await db.from('media_assets').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('status', 'pending');
        if ((count ?? 0) >= 10) throw new AppError('Finish or wait for your earlier uploads before starting more.', 429);
        const id = randomUUID();
        const path = mediaPath(user.id, id, ext);
        const key = path.slice(BUCKET.length + 1);
        const signed = await db.storage.from(BUCKET).createSignedUploadUrl(key, { upsert: false });
        if (signed.error || !signed.data) throw new AppError('Uploads are not set up on this deployment yet (the private "quiz-media" storage bucket is missing). You can still link a YouTube or Vimeo video.', 503);
        const ins = await db.from('media_assets').insert({ id, owner_id: user.id, storage_path: path, mime: EXT_MIME[ext], bytes: size, status: 'pending' });
        if (ins.error) {
          if (missingMigration(ins.error)) throw new AppError('Uploads need the latest database update (migration 005).', 503);
          console.error('[quiz] media init', ins.error.code); throw new AppError('Could not start the upload', 500);
        }
        return success({ id, path, key, token: signed.data.token, uploadUrl: signed.data.signedUrl, maxBytes: size, expiresInSeconds: 7200 }, 201);
      }
      if (body.action === 'finalize') {
        const { id, alt } = finalizeSchema.parse(body);
        const { data: asset } = await db.from('media_assets').select('id,owner_id,storage_path,status,mime,bytes,alt_text').eq('id', id).eq('owner_id', user.id).maybeSingle();
        if (!asset || asset.status === 'deleted' || asset.status === 'quarantined') throw new AppError('Upload not found. Start it again.', 404);
        const quotaLeft = async () => USER_QUOTA_BYTES - (await usedBytes(user.id));
        if (asset.status === 'ready') return success({ id, path: asset.storage_path, mime: asset.mime, bytes: asset.bytes, remainingBytes: await quotaLeft() }); // idempotent
        const key = (asset.storage_path as string).slice(BUCKET.length + 1);
        const reject = async (message: string, status = 400): Promise<AppError> => {
          await db.storage.from(BUCKET).remove([key]);
          await db.from('media_assets').update({ status: 'deleted', purged_at: new Date().toISOString() }).eq('id', id);
          return new AppError(message, status);
        };
        // Cheap size check from storage metadata BEFORE downloading anything.
        const folder = key.split('/')[0]!;
        const listed = await db.storage.from(BUCKET).list(folder, { search: key.split('/')[1]!, limit: 2 });
        const meta = listed.data?.find((o) => `${folder}/${o.name}` === key);
        if (!meta) throw new AppError('The file has not finished uploading. Try again in a moment.', 409);
        const storedSize = Number((meta.metadata as { size?: number } | null)?.size ?? 0);
        if (storedSize > MAX_UPLOAD_BYTES) throw await reject(`That file is larger than the ${(MAX_UPLOAD_BYTES / 1048576).toFixed(0)} MB limit.`, 413);
        const dl = await db.storage.from(BUCKET).download(key);
        if (dl.error || !dl.data) throw new AppError('The file has not finished uploading. Try again in a moment.', 409);
        const bytes = new Uint8Array(await dl.data.arrayBuffer());
        const others = await usedBytes(user.id, id);
        const verdict = checkUpload(bytes, { usedBytes: others, quotaBytes: USER_QUOTA_BYTES, strict: true });
        if (!verdict.ok) throw await reject(verdict.message);
        if (!isStoragePath(asset.storage_path) || !(asset.storage_path as string).endsWith(`.${verdict.ext}`)) throw await reject('The file type does not match what was announced. Upload it again.');
        const upd = await db.from('media_assets').update({ status: 'ready', mime: verdict.mime, bytes: bytes.length, alt_text: (alt ?? '').slice(0, 300), finalized_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id).eq('status', 'pending').select('id');
        if (upd.error) { console.error('[quiz] media finalize', upd.error.code); throw new AppError('Could not record the upload', 500); }
        return success({ id, path: asset.storage_path, mime: verdict.mime, bytes: bytes.length, remainingBytes: USER_QUOTA_BYTES - others - bytes.length });
      }
      throw new AppError('Unknown upload step', 400);
    }
    // Legacy same-origin multipart upload, kept for small files only.
    const form = await req.formData();
    const file = form.get('file');
    const alt = String(form.get('alt') ?? '').slice(0, 300);
    if (!(file instanceof File)) throw new AppError('Choose a file to upload', 400);
    if (file.size > PROXY_UPLOAD_MAX_BYTES) throw new AppError(`Files over ${(PROXY_UPLOAD_MAX_BYTES / 1_000_000).toFixed(0)} MB must use the direct upload.`, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const used = await usedBytes(user.id);
    const verdict = checkUpload(bytes, { usedBytes: used, quotaBytes: USER_QUOTA_BYTES, strict: true });
    if (!verdict.ok) throw new AppError(verdict.message, 400);
    const id = randomUUID();
    const path = mediaPath(user.id, id, verdict.ext);
    const key = path.slice(BUCKET.length + 1);
    const up = await db.storage.from(BUCKET).upload(key, bytes, { contentType: verdict.mime, upsert: false });
    if (up.error) throw new AppError('Uploads are not set up on this deployment yet. You can still link a YouTube or Vimeo video.', 503);
    const { error } = await db.from('media_assets').insert({ id, owner_id: user.id, storage_path: path, mime: verdict.mime, bytes: bytes.length, alt_text: alt });
    if (error) { await db.storage.from(BUCKET).remove([key]); throw new AppError('Could not record the upload', 500); }
    return success({ id, path, mime: verdict.mime, bytes: bytes.length, remainingBytes: USER_QUOTA_BYTES - used - bytes.length }, 201);
  } catch (e) { return failure(e); }
}

/** Short-lived signed read link. The caller may be anonymous: the decision is made per branch in canReadMedia() (owner / published quiz / room snapshot),
 *  never from a bare storage path, and every denial looks identical (404). `?room=<id>` plus the `x-player-token` header (or the host's session) unlocks a live room's media. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path') ?? '';
    if (!isStoragePath(path)) throw new AppError('Invalid media path', 400);
    const roomParam = url.searchParams.get('room');
    const roomId = roomParam ? z.string().uuid().parse(roomParam) : null;
    await rateLimit(req, 'media-read', 3000, 600); // generous: a whole classroom may share one network address
    const user = await maybeUser(); // null for visitors with no session; only a missing configuration (503) propagates
    const db = serviceDB();
    const { data: asset } = await db.from('media_assets').select('owner_id,status').eq('storage_path', path).maybeSingle();
    const rpcBool = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(fn, args);
      if (error) { if (missingMigration(error)) throw new AppError('Media sharing needs the latest database update (migration 005).', 503); console.error('[quiz] media access', error.code); return false; }
      return data === true;
    };
    const allowed = await canReadMedia({
      asset: asset as { owner_id: string; status: string } | null,
      userId: user?.id ?? null,
      inPublishedQuiz: () => rpcBool('media_in_published_quiz', { p_path: path }),
      room: roomId ? {
        member: async () => {
          const room = await getRoom(roomId).catch(() => null);
          if (!room) return false;
          const token = req.headers.get('x-player-token');
          if (token) return !!(await verifyPlayer(room, token).catch(() => null));
          return !!user && room.host_id === user.id;
        },
        inSnapshot: () => rpcBool('media_in_room', { p_room: roomId, p_path: path }),
      } : undefined,
    });
    if (!allowed) throw new AppError('Not found', 404);
    const { data } = await db.storage.from(BUCKET).createSignedUrl(path.slice(BUCKET.length + 1), 300);
    if (!data) throw new AppError('Not found', 404);
    return success({ url: data.signedUrl, expiresInSeconds: 300 });
  } catch (e) { return failure(e); }
}
